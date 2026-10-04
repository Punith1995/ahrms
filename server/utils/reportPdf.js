const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { amountInWords } = require("./amountInWords");

const NAVY = "#1B3668";
const AMBER = "#F5A623";
const GREY = "#64748b";
const LINE = "#e2e8f0";

const rupee = (n) => `Rs. ${Math.round(n || 0).toLocaleString("en-IN")}`;

function header(doc, report, uploadsDir) {
  const left = 40;
  const right = doc.page.width - 40;
  const c = report.company;

  const logoAbs = c.logoUrl ? path.join(uploadsDir, c.logoUrl) : null;
  const hasLogo = logoAbs && fs.existsSync(logoAbs);
  const textX = hasLogo ? left + 60 : left;

  if (hasLogo) {
    try { doc.image(logoAbs, left, 40, { fit: [50, 50] }); } catch {}
  }

  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(15)
    .text(c.legalName || c.name, textX, 44, { width: right - textX });
  doc.font("Helvetica").fontSize(8).fillColor(GREY)
    .text(c.address || "", textX, doc.y + 1, { width: right - textX });

  const reg = c.registrations || {};
  const regLine = [
    reg.pan?.number ? `PAN ${reg.pan.number}` : null,
    reg.epf?.number ? `PF ${reg.epf.number}` : null,
    reg.esi?.number ? `ESI ${reg.esi.number}` : null,
  ].filter(Boolean).join("   ");
  if (regLine) doc.fontSize(7).text(regLine, textX, doc.y + 1, { width: right - textX });

  const yLine = Math.max(doc.y, hasLogo ? 90 : doc.y) + 8;
  doc.moveTo(left, yLine).lineTo(right, yLine).lineWidth(2).strokeColor(AMBER).stroke();

  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(12)
    .text(report.title, left, yLine + 8, { width: right - left, align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor(GREY)
    .text(report.periodLabel, left, doc.y + 1, { width: right - left, align: "center" });

  return doc.y + 12;
}

/**
 * Table renderer for a built report. Draws headers, rows, page breaks and a
 * totals row. Column widths are proportional to a weight per column type.
 */
function table(doc, report, startY) {
  const left = 40;
  const right = doc.page.width - 40;
  const width = right - left;
  const cols = report.columns;

  const weight = (c) =>
    c.type === "money" ? 1.1 : c.type === "num" ? 0.7 : c.key === "name" ? 1.8 : 1.2;
  const weights = cols.map(weight);
  const wsum = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => (w / wsum) * width);
  const xs = [];
  let acc = left;
  widths.forEach((w) => { xs.push(acc); acc += w; });

  const rowH = 18;
  let y = startY;

  const drawHead = () => {
    doc.rect(left, y, width, 20).fill(NAVY);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(8);
    cols.forEach((c, i) => {
      doc.text(c.label, xs[i] + 3, y + 6, {
        width: widths[i] - 6,
        align: c.align === "right" ? "right" : "left",
      });
    });
    y += 20;
  };

  drawHead();
  doc.font("Helvetica").fontSize(8);

  report.rows.forEach((r, ri) => {
    if (y + rowH > doc.page.height - 90) {
      doc.addPage();
      y = 50;
      drawHead();
      doc.font("Helvetica").fontSize(8);
    }
    if (ri % 2 === 1) doc.rect(left, y, width, rowH).fill("#f8fafc");
    doc.fillColor("#334155");
    cols.forEach((c, i) => {
      let v = r[c.key];
      if (c.type === "money") v = rupee(v);
      else if (c.type === "num") v = String(v ?? "");
      doc.text(String(v ?? ""), xs[i] + 3, y + 5, {
        width: widths[i] - 6,
        align: c.align === "right" ? "right" : "left",
        lineBreak: false,
        ellipsis: true,
      });
    });
    y += rowH;
  });

  // totals
  if (cols.some((c) => c.total)) {
    if (y + rowH > doc.page.height - 90) { doc.addPage(); y = 50; }
    doc.rect(left, y, width, rowH + 2).fill("#fef3e2");
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(8.5);
    cols.forEach((c, i) => {
      let v = "";
      if (i === 0) v = "TOTAL";
      else if (c.total) v = c.type === "money" ? rupee(report.totals[c.key]) : String(Math.round((report.totals[c.key] || 0) * 100) / 100);
      doc.text(v, xs[i] + 3, y + 5, {
        width: widths[i] - 6,
        align: c.align === "right" ? "right" : "left",
      });
    });
    y += rowH + 2;
  }

  return y;
}

function bankFooter(doc, report, y) {
  const left = 40;
  const right = doc.page.width - 40;
  const total = report.totals.net || 0;

  if (y + 120 > doc.page.height - 40) { doc.addPage(); y = 50; }
  y += 16;

  doc.fillColor("#334155").font("Helvetica-Bold").fontSize(9)
    .text(`Total amount payable: ${rupee(total)}`, left, y);
  doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(GREY)
    .text(amountInWords(total), left, doc.y + 2, { width: right - left });

  const bank = report.company.bank || {};
  if (bank.accountNo) {
    y = doc.y + 10;
    doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text(
      `Please debit our account ${bank.accountNo} (${bank.bankName || ""}, IFSC ${bank.ifsc || ""}) and credit the above accounts.`,
      left, y, { width: right - left }
    );
  }

  const sig = report.company.authorization?.signatoryName;
  const desig = report.company.authorization?.signatoryDesignation;
  doc.y = Math.max(doc.y + 40, doc.page.height - 90);
  doc.font("Helvetica").fontSize(8.5).fillColor("#334155")
    .text(`For ${report.company.name}`, right - 200, doc.y, { width: 200, align: "right" });
  doc.moveDown(2);
  doc.text(sig || "Authorised signatory", right - 200, doc.y, { width: 200, align: "right" });
  if (desig) doc.fontSize(7.5).fillColor(GREY).text(desig, right - 200, doc.y + 1, { width: 200, align: "right" });
}

function reportToPdf(report, uploadsDir) {
  return new Promise((resolve, reject) => {
    const landscape = report.columns.length > 7;
    const doc = new PDFDocument({
      size: "A4",
      layout: landscape ? "landscape" : "portrait",
      margin: 40,
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const y = header(doc, report, uploadsDir);
    const endY = table(doc, report, y);

    if (report.meta?.bankTransfer) {
      bankFooter(doc, report, endY);
    } else {
      doc.font("Helvetica").fontSize(7).fillColor(GREY).text(
        "Generated by Ashwija HR Consultancy — for internal and statutory use.",
        40, doc.page.height - 55, { width: doc.page.width - 80, align: "center" }
      );
    }

    doc.end();
  });
}

module.exports = { reportToPdf };
