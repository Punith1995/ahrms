const ExcelJS = require("exceljs");

const NAVY = "FF1B3668";
const AMBER = "FFF5A623";
const LIGHT = "FFF1F5F9";

const isNum = (t) => t === "money" || t === "num";

/** Build a styled workbook from a built report. Returns a Buffer. */
async function reportToExcel(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ashwija HR Consultancy";
  const ws = wb.addWorksheet(report.title.slice(0, 28) || "Report");

  const cols = report.columns;
  const lastCol = cols.length;
  const colLetter = (n) => {
    let s = "";
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  const span = `A1:${colLetter(lastCol)}1`;

  // title block
  ws.mergeCells(span);
  ws.getCell("A1").value = report.company.legalName || report.company.name;
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: NAVY } };

  ws.mergeCells(`A2:${colLetter(lastCol)}2`);
  ws.getCell("A2").value = `${report.title} — ${report.periodLabel}`;
  ws.getCell("A2").font = { size: 11, color: { argb: NAVY } };

  ws.mergeCells(`A3:${colLetter(lastCol)}3`);
  ws.getCell("A3").value = report.company.address || "";
  ws.getCell("A3").font = { size: 9, color: { argb: "FF64748B" } };

  // header row
  const headerRowIdx = 5;
  const header = ws.getRow(headerRowIdx);
  cols.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: c.align === "right" ? "right" : "left" };
    cell.border = { bottom: { style: "thin", color: { argb: NAVY } } };
  });
  header.height = 20;

  // data rows
  report.rows.forEach((r, ri) => {
    const row = ws.getRow(headerRowIdx + 1 + ri);
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const v = r[c.key];
      cell.value = isNum(c.type) ? Number(v) || 0 : v ?? "";
      cell.alignment = { horizontal: c.align === "right" ? "right" : "left" };
      if (c.type === "money") cell.numFmt = "#,##0";
      if (c.type === "num") cell.numFmt = "0.##";
      cell.font = { size: 10 };
      if (ri % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
      }
    });
  });

  // totals row
  const hasTotals = cols.some((c) => c.total);
  if (hasTotals) {
    const trow = ws.getRow(headerRowIdx + 1 + report.rows.length);
    cols.forEach((c, i) => {
      const cell = trow.getCell(i + 1);
      if (i === 0) cell.value = "TOTAL";
      else if (c.total) {
        cell.value = Number(report.totals[c.key]) || 0;
        if (c.type === "money") cell.numFmt = "#,##0";
        if (c.type === "num") cell.numFmt = "0.##";
      }
      cell.font = { bold: true, color: { argb: NAVY } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AMBER } };
      cell.alignment = { horizontal: c.align === "right" ? "right" : "left" };
    });
  }

  // widths
  cols.forEach((c, i) => {
    const maxLen = Math.max(
      c.label.length,
      ...report.rows.slice(0, 200).map((r) => String(r[c.key] ?? "").length)
    );
    ws.getColumn(i + 1).width = Math.min(Math.max(maxLen + 2, 8), 32);
  });

  return wb.xlsx.writeBuffer();
}

/** Plain CSV of the same data. */
function reportToCsv(report) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = report.columns.map((c) => esc(c.label)).join(",");
  const body = report.rows.map((r) =>
    report.columns.map((c) => esc(r[c.key])).join(",")
  );
  const totalRow = report.columns
    .map((c, i) =>
      i === 0 ? esc("TOTAL") : c.total ? esc(Math.round(report.totals[c.key] || 0)) : esc("")
    )
    .join(",");
  const hasTotals = report.columns.some((c) => c.total);
  return [head, ...body, ...(hasTotals ? [totalRow] : [])].join("\n");
}

module.exports = { reportToExcel, reportToCsv };
