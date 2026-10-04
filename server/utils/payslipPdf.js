const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { amountInWords } = require("./amountInWords");

const NAVY = "#1B3668";
const AMBER = "#F5A623";
const GREY = "#64748b";
const LINE = "#e2e8f0";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const rupee = (n) =>
  `Rs. ${Math.round(n || 0).toLocaleString("en-IN")}`;

/**
 * Render one payslip to a PDF buffer.
 * @param slip     Payslip row with employeeSnapshot, earnings, deductions...
 * @param company  the run's companySnapshot (name, logo, address, registrations)
 * @param period   { year, month }
 * @param uploadsDir absolute path to the uploads folder (for the logo file)
 */
function renderPayslip(slip, company, period, uploadsDir) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const emp = slip.employeeSnapshot || {};
    const pageW = doc.page.width;
    const left = 40;
    const right = pageW - 40;
    const contentW = right - left;

    // ---- header band: company logo + name -------------------------------
    let headerBottom = 40;
    const logoRel = company.logoUrl;
    const logoAbs = logoRel ? path.join(uploadsDir, logoRel) : null;
    const hasLogo = logoAbs && fs.existsSync(logoAbs);

    const textX = hasLogo ? left + 62 : left;
    if (hasLogo) {
      try {
        doc.image(logoAbs, left, 40, { fit: [52, 52] });
      } catch {
        /* ignore a bad image, fall back to text only */
      }
    }

    doc
      .fillColor(NAVY)
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(company.legalName || company.name || "", textX, 44, {
        width: contentW - (textX - left),
      });

    const addr = [company.address, company.city, company.state, company.pin]
      .filter(Boolean)
      .join(", ");
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(GREY)
      .text(addr, textX, doc.y + 1, { width: contentW - (textX - left) });

    const reg = company.registrations || {};
    const regLine = [
      reg.pan?.number ? `PAN ${reg.pan.number}` : null,
      reg.gstin?.number ? `GSTIN ${reg.gstin.number}` : null,
      reg.epf?.number ? `PF ${reg.epf.number}` : null,
      reg.esi?.number ? `ESI ${reg.esi.number}` : null,
    ]
      .filter(Boolean)
      .join("   ");
    if (regLine) {
      doc.fontSize(7).fillColor(GREY).text(regLine, textX, doc.y + 1, {
        width: contentW - (textX - left),
      });
    }

    headerBottom = Math.max(doc.y, hasLogo ? 92 : doc.y) + 8;

    // amber rule + payslip title
    doc.moveTo(left, headerBottom).lineTo(right, headerBottom)
      .lineWidth(2).strokeColor(AMBER).stroke();

    doc
      .fillColor(NAVY)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(
        `Payslip for ${MONTHS[period.month - 1]} ${period.year}`,
        left,
        headerBottom + 8,
        { width: contentW, align: "center" }
      );

    let y = headerBottom + 30;

    // ---- employee details grid ------------------------------------------
    const detail = [
      ["Employee", emp.name],
      ["Employee code", emp.code],
      ["Designation", emp.designation || "-"],
      ["Department", emp.department || "-"],
      ["Date of joining", emp.doj || "-"],
      ["Bank account", emp.bankAccountNo || "-"],
    ];
    // UAN and ESI number only when the employee actually has them
    if (emp.uan) detail.push(["UAN", emp.uan]);
    if (emp.esicIp) detail.push(["ESI number", emp.esicIp]);
    detail.push(["Paid days", `${slip.payableDays} / ${slip.totalDays}`]);
    detail.push(["LOP days", String(slip.lopDays || 0)]);

    const gridRows = Math.ceil(detail.length / 2);
    const gridH = gridRows * 19 + 12;
    doc.rect(left, y, contentW, gridH).lineWidth(0.5).strokeColor(LINE).stroke();
    const colW = contentW / 2;
    detail.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = left + col * colW + 10;
      const cy = y + 8 + row * 19;
      doc.font("Helvetica").fontSize(8).fillColor(GREY).text(`${k}`, cx, cy, { width: 90 });
      doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY)
        .text(String(v ?? "-"), cx + 92, cy, { width: colW - 104 });
    });
    y += gridH + 12;

    // ---- earnings / deductions table ------------------------------------
    const e = slip.earnings || {};
    const d = slip.deductions || {};
    const earnRows = [
      ["Basic", e.basic],
    ];
    if (e.da) earnRows.push(["Dearness Allowance (DA)", e.da]);
    earnRows.push(
      ["House Rent Allowance", e.hra],
      ["Conveyance", e.conveyance],
      ["Special Allowance", e.special],
    );
    if (e.travel) earnRows.push(["Travel Allowance", e.travel]);
    if (e.incentive) earnRows.push(["Production Incentive", e.incentive]);
    if (e.medical) earnRows.push(["Medical Allowance", e.medical]);
    if (e.other) earnRows.push(["Other Allowance", e.other]);
    (e.extraAllowances || []).forEach((a) => {
      if (a.amount) earnRows.push([a.type, a.amount]);
    });
    if (e.overtime) earnRows.push(["Overtime", e.overtime]);
    if (e.compOff) earnRows.push(["Comp-off", e.compOff]);
    if (e.elEncashment) earnRows.push(["Leave Encashment (EL)", e.elEncashment]);

    const dedRows = [
      ["Provident Fund", d.pf],
      ["ESI", d.esi],
      ["Professional Tax", d.professionalTax],
    ];
    if (d.lwf) dedRows.push(["Labour Welfare Fund", d.lwf]);
    if (d.food) dedRows.push(["Food", d.food]);
    if (d.transport) dedRows.push(["Transportation", d.transport]);
    if (d.uniform) dedRows.push(["Uniform / Shoe", d.uniform]);
    if (d.loan) dedRows.push(["Loan recovery", d.loan]);
    if (d.advance) dedRows.push(["Advance recovery", d.advance]);

    const tableTop = y;
    const midX = left + contentW / 2;
    const rowH = 18;
    const rows = Math.max(earnRows.length, dedRows.length);
    const bodyH = rows * rowH;
    const headH = 20;
    const totalH = 20;

    // header row
    doc.rect(left, tableTop, contentW, headH).fill(NAVY);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(9);
    doc.text("Earnings", left + 10, tableTop + 6);
    doc.text("Amount", midX - 80, tableTop + 6, { width: 70, align: "right" });
    doc.text("Deductions", midX + 10, tableTop + 6);
    doc.text("Amount", right - 80, tableTop + 6, { width: 70, align: "right" });

    // body
    const bodyTop = tableTop + headH;
    doc.font("Helvetica").fontSize(9).fillColor(NAVY);
    for (let i = 0; i < rows; i++) {
      const ry = bodyTop + i * rowH + 5;
      if (earnRows[i]) {
        doc.fillColor("#334155").text(earnRows[i][0], left + 10, ry, { width: 150 });
        doc.fillColor(NAVY).text(rupee(earnRows[i][1]), midX - 80, ry, { width: 70, align: "right" });
      }
      if (dedRows[i]) {
        doc.fillColor("#334155").text(dedRows[i][0], midX + 10, ry, { width: 150 });
        doc.fillColor(NAVY).text(rupee(dedRows[i][1]), right - 80, ry, { width: 70, align: "right" });
      }
    }

    // outer + middle borders
    doc.lineWidth(0.5).strokeColor(LINE);
    doc.rect(left, tableTop, contentW, headH + bodyH + totalH).stroke();
    doc.moveTo(midX, tableTop).lineTo(midX, bodyTop + bodyH + totalH).stroke();

    // totals row
    const totTop = bodyTop + bodyH;
    doc.rect(left, totTop, contentW, totalH).fill("#f1f5f9");
    doc.moveTo(midX, totTop).lineTo(midX, totTop + totalH).strokeColor(LINE).stroke();
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9);
    doc.text("Gross Earnings", left + 10, totTop + 6);
    doc.text(rupee(slip.grossEarned), midX - 80, totTop + 6, { width: 70, align: "right" });
    doc.text("Total Deductions", midX + 10, totTop + 6);
    doc.text(rupee(slip.totalDeductions), right - 80, totTop + 6, { width: 70, align: "right" });

    y = totTop + totalH + 16;

    // ---- net pay band ----------------------------------------------------
    doc.rect(left, y, contentW, 40).fill(NAVY);
    doc.fillColor("white").font("Helvetica").fontSize(9)
      .text("Net Pay", left + 14, y + 8);
    doc.fillColor(AMBER).font("Helvetica-Bold").fontSize(18)
      .text(rupee(slip.netPay), right - 200, y + 10, { width: 186, align: "right" });
    y += 46;

    doc.fillColor("#334155").font("Helvetica-Oblique").fontSize(8.5)
      .text(amountInWords(slip.netPay), left, y, { width: contentW });
    y += 24;

    // ---- employer contributions (informational) -------------------------
    const em = slip.employer || {};
    if (em.pf || em.esi || em.gratuity) {
      doc.font("Helvetica").fontSize(7.5).fillColor(GREY).text(
        `Employer contributions (not deducted from salary):  PF ${rupee(em.pf)}   ESI ${rupee(em.esi)}   Gratuity ${rupee(em.gratuity)}`,
        left, y, { width: contentW }
      );
      y += 20;
    }

    // ---- prominent computer-generated note -------------------------------
    const noteY = Math.min(y + 6, doc.page.height - 110);
    doc.rect(left, noteY, contentW, 22).fill("#f8fafc");
    doc.rect(left, noteY, 3, 22).fill(AMBER);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(NAVY).text(
      "This is a computer-generated payslip and does not require a signature.",
      left + 12, noteY + 7, { width: contentW - 20, align: "center" }
    );

    // ---- footer ----------------------------------------------------------
    const footY = doc.page.height - 70;
    doc.moveTo(left, footY).lineTo(right, footY).lineWidth(0.5).strokeColor(LINE).stroke();
    const sig = company.authorization?.signatoryName;
    if (sig) {
      doc.font("Helvetica").fontSize(7.5).fillColor(GREY).text(
        `For ${company.name} — authorised by ${sig}`,
        left, footY + 10, { width: contentW, align: "center" }
      );
    }

    doc.end();
  });
}

module.exports = { renderPayslip };
