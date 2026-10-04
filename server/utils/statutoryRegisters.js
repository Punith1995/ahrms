// Karnataka statutory registers, generated as Excel (.xlsx) from the finalised
// payroll run for a company + month. New forms are added to REGISTERS below and
// automatically appear in the app.
//
// Implemented so far: Form B (Wage Register).
// Planned next: Form 22 (Muster roll cum wage), Form 9 (Overtime),
//               Form 1 (Fines/deductions), ESI & PF register.

const ExcelJS = require("exceljs");
const prisma = require("./prisma");

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const dmy = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";

// ------------------------------------------------------------ data assembly

async function gather(companyId, year, month) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { error: "Company not found" };

  const run = await prisma.payrollRun.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
    include: { payslips: { orderBy: { employeeId: "asc" } } },
  });
  if (!run || !run.payslips.length) {
    return { error: "No finalised payroll for this month. Run and finalise payroll first." };
  }

  const ids = run.payslips.map((p) => p.employeeId);
  const employees = await prisma.employee.findMany({ where: { id: { in: ids } } });
  const empMap = new Map(employees.map((e) => [e.id, e]));
  const months = await prisma.attendanceMonth.findMany({ where: { companyId, year, month } });
  const otMap = new Map(months.map((m) => [m.employeeId, m.otHours || 0]));

  // daily attendance marks for the muster roll
  const totalDays = new Date(year, month, 0).getDate();
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month - 1, totalDays, 23, 59, 59));
  const attDays = await prisma.attendanceDay.findMany({
    where: { companyId, date: { gte: start, lte: end } },
  });
  const marksByEmp = new Map();
  attDays.forEach((a) => {
    const day = new Date(a.date).getUTCDate();
    if (!marksByEmp.has(a.employeeId)) marksByEmp.set(a.employeeId, {});
    marksByEmp.get(a.employeeId)[day] = a.status;
  });

  const rows = run.payslips.map((p, i) => {
    const e = empMap.get(p.employeeId) || {};
    const s = p.employeeSnapshot || {};
    const earn = p.earnings || {};
    const ded = p.deductions || {};
    return {
      sno: i + 1,
      code: s.code || e.employeeCode || "",
      name: s.name || e.fullName || "",
      father: e.fatherSpouseName || "",
      sex: (e.gender || "").charAt(0).toUpperCase(),
      designation: s.designation || e.designation || "",
      department: e.department || "",
      doj: e.doj || null,
      esiNo: e.esicIp || "",
      uan: e.uan || "",
      bankAccountNo: s.bankAccountNo || e.bankAccountNo || "",
      rateOfWage: e.ctcMonthly || 0,
      daysWorked: p.payableDays || 0,
      lopDays: p.lopDays || 0,
      otHours: otMap.get(p.employeeId) || 0,
      marks: marksByEmp.get(p.employeeId) || {},
      basic: earn.basic || 0,
      hra: earn.hra || 0,
      conveyance: earn.conveyance || 0,
      special: earn.special || 0,
      travel: earn.travel || 0,
      incentive: earn.incentive || 0,
      medical: earn.medical || 0,
      otherAllow: (earn.other || 0) + (earn.extraAllowances || []).reduce((s, a) => s + (a.amount || 0), 0),
      elEncashment: earn.elEncashment || 0,
      overtime: earn.overtime || 0,
      gross: p.grossEarned || 0,
      pf: ded.pf || 0,
      esi: ded.esi || 0,
      pt: ded.professionalTax || 0,
      food: ded.food || 0,
      transport: ded.transport || 0,
      uniform: ded.uniform || 0,
      otherDed: (ded.food || 0) + (ded.transport || 0) + (ded.uniform || 0) + (ded.loan || 0) + (ded.advance || 0),
      totalDeductions:
        p.totalDeductions ?? ((ded.pf || 0) + (ded.esi || 0) + (ded.professionalTax || 0)),
      net: p.netPay || 0,
    };
  });

  return { company, run, rows, year, month, totalDays };
}

// ------------------------------------------------------------ shared styling

const THIN = { style: "thin", color: { argb: "FF999999" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function box(cell, opts = {}) {
  cell.border = BORDER;
  cell.alignment = { vertical: "middle", horizontal: opts.align || "left", wrapText: true };
  if (opts.bold) cell.font = { bold: true, size: opts.size || 9 };
  else cell.font = { size: opts.size || 9 };
  if (opts.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
  if (opts.numFmt) cell.numFmt = opts.numFmt;
}

function title(ws, from, to, text, size = 12) {
  ws.mergeCells(`${from}:${to}`);
  const c = ws.getCell(from);
  c.value = text;
  c.font = { bold: true, size };
  c.alignment = { horizontal: "center", vertical: "middle" };
}

// establishment info line (label + value), spanning the sheet width
function infoRow(ws, rowNum, lastCol, label, value) {
  ws.mergeCells(rowNum, 1, rowNum, 2);
  ws.mergeCells(rowNum, 3, rowNum, lastCol);
  const l = ws.getCell(rowNum, 1);
  l.value = label;
  l.font = { bold: true, size: 9 };
  l.alignment = { vertical: "middle", wrapText: true };
  const v = ws.getCell(rowNum, 3);
  v.value = value || "";
  v.font = { size: 9 };
  v.alignment = { vertical: "middle", wrapText: true };
}

// ------------------------------------------------------------------- Form B

function formB(wb, ctx) {
  const { company, rows, year, month } = ctx;
  const reg = company.registrations || {};
  const auth = company.authorization || {};
  const ws = wb.addWorksheet("Form B", {
    views: [{ state: "frozen", ySplit: 8 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  const address = [company.address, company.city, company.state, company.pin].filter(Boolean).join(", ");
  const LAST = 30; // number of columns

  title(ws, "A1", "AD1", "FORM B", 12);
  title(ws, "A2", "AD2", "[See rule 2(1)]", 9);
  title(ws, "A3", "AD3", "WAGE REGISTER", 11);

  infoRow(ws, 4, LAST, "Name of the Establishment", company.legalName || company.name);
  infoRow(ws, 5, LAST, "Address", address);
  infoRow(ws, 6, LAST, "Name of Owner / Contractor", auth.ownerName || auth.managerName || "");
  infoRow(ws, 7, LAST, "Wage Period",
    `${dmy(new Date(year, month - 1, 1))}  to  ${dmy(new Date(year, month, 0))}`);

  // header row (row 8)
  const headers = [
    "Sl. No.", "Employee Register No.", "Name", "Rate of Wage", "No. of Days Worked",
    "Overtime Hours Worked", "Basic & DA", "Special Basic", "Payment of Over Time",
    "HRA", "Conveyance / Travel Allowance", "Med. Allowance", "CCA",
    "Incentive / Arrears / Leave Encashment", "Others", "Total Earnings",
    "PF", "ESIC", "Society", "TDS", "PT", "Insurance", "Others", "Recoveries",
    "Other Deductions", "Total Deductions", "Net Payment",
    "Receipt (Bank / NEFT ID)", "Date of Payment", "Remarks",
  ];
  const hRow = ws.getRow(8);
  headers.forEach((h, i) => {
    hRow.getCell(i + 1).value = h;
    box(hRow.getCell(i + 1), { bold: true, align: "center", fill: "FFEDF1F7", size: 8 });
  });
  hRow.height = 42;

  const MONEY = "#,##0";
  let r = 9;
  for (const row of rows) {
    const vals = [
      row.sno, row.code, row.name, row.rateOfWage, row.daysWorked,
      row.otHours || "", row.basic, row.special || "", row.overtime || "",
      row.hra, (row.conveyance + row.travel) || "", row.medical || "", "",
      (row.incentive + row.elEncashment) || "", row.otherAllow || "", row.gross,
      row.pf || "", row.esi || "", "", "", row.pt || "", "", row.otherDed || "", "", "",
      row.totalDeductions, row.net, "NEFT", "", "",
    ];
    const excelRow = ws.getRow(r);
    vals.forEach((v, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = v;
      const numeric = [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 21, 23, 26, 27].includes(i + 1);
      box(cell, {
        align: numeric ? "right" : i + 1 <= 3 ? "left" : "center",
        numFmt: numeric && typeof v === "number" ? MONEY : undefined,
        size: 8,
      });
    });
    r++;
  }

  // totals row
  const totalRow = ws.getRow(r);
  const sum = (key) => rows.reduce((a, x) => a + (Number(x[key]) || 0), 0);
  totalRow.getCell(3).value = `Total — ${rows.length} employees`;
  const totalsMap = {
    7: sum("basic"), 8: sum("special"), 9: sum("overtime"), 10: sum("hra"),
    11: sum("conveyance") + sum("travel"), 12: sum("medical"),
    14: sum("incentive") + sum("elEncashment"), 15: sum("otherAllow"),
    16: sum("gross"), 17: sum("pf"), 18: sum("esi"), 21: sum("pt"),
    23: sum("otherDed"),
    26: sum("totalDeductions"), 27: sum("net"),
  };
  for (let i = 1; i <= LAST; i++) {
    const cell = totalRow.getCell(i);
    if (totalsMap[i] !== undefined) cell.value = totalsMap[i];
    box(cell, {
      bold: true, fill: "FFF3F6FA", align: i >= 4 ? "right" : "left",
      numFmt: totalsMap[i] !== undefined ? MONEY : undefined, size: 8,
    });
  }

  // widths
  const widths = [6, 14, 22, 11, 9, 9, 11, 11, 11, 10, 12, 10, 8, 14, 8, 12, 9, 9, 8, 8, 8, 9, 8, 9, 11, 12, 12, 14, 12, 12];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  return ws;
}

// ------------------------------------------------------------------ Form 22

// muster mark: weekly off shows as W (govt convention), rest as-is
const musterChar = (s) => (s === "WO" ? "W" : s || "");

function form22(wb, ctx) {
  const { company, rows, year, month, totalDays } = ctx;
  const auth = company.authorization || {};
  const ws = wb.addWorksheet("Form 22", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 9 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  const address = [company.address, company.city, company.state, company.pin].filter(Boolean).join(", ");
  const N = totalDays;

  // column layout
  const A0 = 9;              // first day column
  const TOTAL = A0 + N;      // total days
  const W0 = TOTAL + 1;      // first wage column
  const wageCols = ["Basic & DA", "HRA", "Travel Allow.", "Med. Allow.", "Fixed Allow.", "Spl. All.", "OT", "Incentive / Arrears / Leave Enc.", "Total"];
  const D0 = W0 + wageCols.length;
  const dedCols = ["ESI", "PF", "PT", "TDS", "Socy.", "Insurance", "Sal. Adv.", "Fine", "Damage/Loss", "Others", "Total"];
  const NET = D0 + dedCols.length;
  const SIGN = NET + 1;
  const LAST = SIGN;
  const colLetter = (n) => ws.getColumn(n).letter;

  // titles
  title(ws, `A1`, `${colLetter(LAST)}1`, "FORM No. 22", 12);
  title(ws, `A2`, `${colLetter(LAST)}2`, "[See Rule 137]", 9);
  title(ws, `A3`, `${colLetter(LAST)}3`,
    `MUSTER ROLL CUM REGISTER OF WAGES / SALARY / SUBSISTENCE ALLOWANCE FOR THE MONTH OF ${MONTHS[month - 1].toUpperCase()} ${year}`, 10);

  infoRow(ws, 4, LAST, "Name & Address of the Factory / Establishment",
    `${company.legalName || company.name}${address ? ", " + address : ""}`);
  infoRow(ws, 5, LAST, "Name & Address of the Contractor (if any)", auth.contractorName || "N/A");
  infoRow(ws, 6, LAST, "Name & Address of the Principal Employer",
    `${auth.ownerName || auth.managerName || ""}${company.legalName ? " — " + company.legalName : ""}`);
  infoRow(ws, 7, LAST, "Place of Work / Month & Year",
    `${address || company.name}    |    ${MONTHS[month - 1]} ${year}`);

  // ---- header rows 8 (group) + 9 (sub) ----
  const gh = ws.getRow(8);
  const sh = ws.getRow(9);
  gh.height = 30;
  sh.height = 22;

  const fixed = [
    "Serial No.", "Name of the Employee", "Sex", "Emp. No.", "Deptn / Dept",
    "Date of Joining", "ESI No.", "UAN No.",
  ];
  fixed.forEach((h, i) => {
    const col = i + 1;
    ws.mergeCells(8, col, 9, col);
    const c = ws.getCell(8, col);
    c.value = h;
    box(c, { bold: true, align: "center", fill: "FFEDF1F7", size: 8 });
  });

  // attendance group
  ws.mergeCells(8, A0, 8, TOTAL - 1);
  box(ws.getCell(8, A0), { bold: true, align: "center", fill: "FFEDF1F7", size: 8 });
  ws.getCell(8, A0).value = `Attendance — for the period ending ${MONTHS[month - 1]} ${N}`;
  for (let d = 1; d <= N; d++) {
    const c = ws.getCell(9, A0 + d - 1);
    c.value = d;
    box(c, { bold: true, align: "center", fill: "FFF3F6FA", size: 7 });
    ws.getColumn(A0 + d - 1).width = 3.2;
  }

  // TOTAL days
  ws.mergeCells(8, TOTAL, 9, TOTAL);
  ws.getCell(8, TOTAL).value = "Total Days";
  box(ws.getCell(8, TOTAL), { bold: true, align: "center", fill: "FFEDF1F7", size: 8 });

  // wages group
  ws.mergeCells(8, W0, 8, D0 - 1);
  ws.getCell(8, W0).value = "RATE OF WAGES / SALARY";
  box(ws.getCell(8, W0), { bold: true, align: "center", fill: "FFEDF1F7", size: 8 });
  wageCols.forEach((h, i) => {
    const c = ws.getCell(9, W0 + i);
    c.value = h;
    box(c, { bold: true, align: "center", fill: "FFF3F6FA", size: 7 });
  });

  // deductions group
  ws.mergeCells(8, D0, 8, NET - 1);
  ws.getCell(8, D0).value = "DEDUCTIONS";
  box(ws.getCell(8, D0), { bold: true, align: "center", fill: "FFEDF1F7", size: 8 });
  dedCols.forEach((h, i) => {
    const c = ws.getCell(9, D0 + i);
    c.value = h;
    box(c, { bold: true, align: "center", fill: "FFF3F6FA", size: 7 });
  });

  // net + signature
  ws.mergeCells(8, NET, 9, NET);
  ws.getCell(8, NET).value = "Net Payable";
  box(ws.getCell(8, NET), { bold: true, align: "center", fill: "FFEDF1F7", size: 8 });
  ws.mergeCells(8, SIGN, 9, SIGN);
  ws.getCell(8, SIGN).value = "Signature / Thumb";
  box(ws.getCell(8, SIGN), { bold: true, align: "center", fill: "FFEDF1F7", size: 8 });

  // ---- data rows from row 10 ----
  const MONEY = "#,##0";
  let r = 10;
  for (const row of rows) {
    const er = ws.getRow(r);
    const fixedVals = [
      row.sno, row.name, row.sex, row.code, row.department,
      row.doj ? dmy(row.doj) : "", row.esiNo, row.uan,
    ];
    fixedVals.forEach((v, i) => {
      const c = er.getCell(i + 1);
      c.value = v;
      box(c, { align: i === 1 ? "left" : "center", size: 8 });
    });
    // attendance
    for (let d = 1; d <= N; d++) {
      const c = er.getCell(A0 + d - 1);
      c.value = musterChar(row.marks[d]);
      box(c, { align: "center", size: 7 });
    }
    // total days
    box(er.getCell(TOTAL), { align: "center", bold: true, size: 8 });
    er.getCell(TOTAL).value = row.daysWorked;
    // wages
    const wageVals = [row.basic, row.hra, row.conveyance + row.travel, row.medical, row.otherAllow, row.special, row.overtime, row.incentive + row.elEncashment, row.gross];
    wageVals.forEach((v, i) => {
      const c = er.getCell(W0 + i);
      c.value = v || "";
      box(c, { align: "right", numFmt: typeof v === "number" && v ? MONEY : undefined, size: 7 });
    });
    // deductions
    const dedVals = [row.esi, row.pf, row.pt, 0, 0, 0, 0, 0, 0, row.otherDed, row.totalDeductions];
    dedVals.forEach((v, i) => {
      const c = er.getCell(D0 + i);
      c.value = v || "";
      box(c, { align: "right", numFmt: typeof v === "number" && v ? MONEY : undefined, size: 7 });
    });
    // net + signature
    er.getCell(NET).value = row.net;
    box(er.getCell(NET), { align: "right", bold: true, numFmt: MONEY, size: 8 });
    box(er.getCell(SIGN), { align: "center", size: 8 });
    r++;
  }

  // totals row
  const tr = ws.getRow(r);
  const sum = (k) => rows.reduce((a, x) => a + (Number(x[k]) || 0), 0);
  ws.mergeCells(r, 1, r, 8);
  tr.getCell(1).value = `Total — ${rows.length} employees`;
  box(tr.getCell(1), { bold: true, fill: "FFF3F6FA", align: "left", size: 8 });
  for (let d = 0; d < N; d++) box(tr.getCell(A0 + d), { fill: "FFF3F6FA", size: 7 });
  const wt = [sum("basic"), sum("hra"), sum("conveyance") + sum("travel"), sum("medical"), sum("otherAllow"), sum("special"), sum("overtime"), sum("incentive") + sum("elEncashment"), sum("gross")];
  wt.forEach((v, i) => {
    const c = tr.getCell(W0 + i);
    c.value = v || "";
    box(c, { bold: true, fill: "FFF3F6FA", align: "right", numFmt: v ? MONEY : undefined, size: 7 });
  });
  const dt = [sum("esi"), sum("pf"), sum("pt"), 0, 0, 0, 0, 0, 0, sum("otherDed"), sum("totalDeductions")];
  dt.forEach((v, i) => {
    const c = tr.getCell(D0 + i);
    c.value = v || "";
    box(c, { bold: true, fill: "FFF3F6FA", align: "right", numFmt: v ? MONEY : undefined, size: 7 });
  });
  box(tr.getCell(TOTAL), { fill: "FFF3F6FA", size: 8 });
  tr.getCell(NET).value = sum("net");
  box(tr.getCell(NET), { bold: true, fill: "FFF3F6FA", align: "right", numFmt: MONEY, size: 8 });
  box(tr.getCell(SIGN), { fill: "FFF3F6FA" });

  // fixed column widths
  const fixedW = [6, 22, 5, 12, 12, 12, 12, 14];
  fixedW.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.getColumn(TOTAL).width = 7;
  wageCols.forEach((_, i) => (ws.getColumn(W0 + i).width = 9));
  dedCols.forEach((_, i) => (ws.getColumn(D0 + i).width = 8));
  ws.getColumn(NET).width = 11;
  ws.getColumn(SIGN).width = 12;

  return ws;
}

// ------------------------------------------------------------------- Form 9

function form9(wb, ctx) {
  const { company, rows, year, month, run } = ctx;
  const ws = wb.addWorksheet("Form 9", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  const address = [company.address, company.city, company.state, company.pin].filter(Boolean).join(", ");
  const LAST = 13;
  const L = ws.getColumn(LAST).letter;

  title(ws, "A1", `${L}1`, "FORM NO. 9", 12);
  title(ws, "A2", `${L}2`, "[See Rule 107]", 9);
  title(ws, "A3", `${L}3`, "REGISTER OF OVERTIME AND PAYMENT", 11);
  title(ws, "A4", `${L}4`, "Form No. 9 under Rule 107 of Karnataka Factories Rules, 1969", 8);
  title(ws, "A5", `${L}5`, "Form No. XIII under Rule 78(1)(a)(iii) of Contract Labour (R&A) Karnataka Rules, 1974", 8);
  title(ws, "A6", `${L}6`, "Form No. IV under Rule 28(2) of Karnataka Minimum Wages Rules, 1958", 8);
  title(ws, "A7", `${L}7`, `Name & Address of the Factory / Establishment: ${company.legalName || company.name}${address ? ", " + address : ""}`, 8);
  title(ws, "A8", `${L}8`, `FOR THE MONTH OF ${MONTHS[month - 1].toUpperCase()}-${year}`, 9);

  // header rows 9 (group) + 10 (sub)
  const single = {
    1: "Sl. No.", 2: "Employee Name / Father-Husband Name", 3: "Sex",
    4: "Designation / Emp. No.", 7: "Normal Rate of Wages per Hour",
    8: "Overtime Wages per Hour", 9: "Normal Piece Rate of Wages",
    10: "OT Piece Rate of Wages", 11: "Total OT Earning", 12: "Date of Payment",
    13: "Signature / Thumb Impression",
  };
  Object.entries(single).forEach(([col, label]) => {
    const c = Number(col);
    ws.mergeCells(9, c, 10, c);
    ws.getCell(9, c).value = label;
    box(ws.getCell(9, c), { bold: true, align: "center", fill: "FFEDF1F7", size: 8 });
  });
  ws.mergeCells(9, 5, 9, 6);
  ws.getCell(9, 5).value = "Particulars of Work";
  box(ws.getCell(9, 5), { bold: true, align: "center", fill: "FFEDF1F7", size: 8 });
  ws.getCell(10, 5).value = "Date";
  ws.getCell(10, 6).value = "Hours";
  box(ws.getCell(10, 5), { bold: true, align: "center", fill: "FFF3F6FA", size: 8 });
  box(ws.getCell(10, 6), { bold: true, align: "center", fill: "FFF3F6FA", size: 8 });
  ws.getRow(9).height = 26;

  const otRows = rows.filter((r) => (r.otHours || 0) > 0);
  const MONEY = "#,##0";
  const paidOn = run?.paidOn ? dmy(run.paidOn) : "";
  let r = 11;

  if (!otRows.length) {
    ws.mergeCells(r, 1, r, LAST);
    ws.getCell(r, 1).value = "NIL — no overtime worked during this month.";
    box(ws.getCell(r, 1), { align: "center", bold: true, size: 9 });
    ws.getRow(r).height = 22;
  } else {
    for (const row of otRows) {
      const normalHourly = Math.round((row.basic / (26 * 8)) || 0);
      const otPerHour = row.otHours ? Math.round(row.overtime / row.otHours) : 0;
      const vals = [
        row.sno,
        row.father ? `${row.name}\n${row.father}` : row.name,
        row.sex,
        row.designation ? `${row.designation} / ${row.code}` : row.code,
        `${MONTHS[month - 1]} ${year}`,
        row.otHours,
        normalHourly, otPerHour, "", "", row.overtime, paidOn, "",
      ];
      const er = ws.getRow(r);
      vals.forEach((v, i) => {
        const c = er.getCell(i + 1);
        c.value = v;
        const numeric = [6, 7, 8, 11].includes(i + 1);
        box(c, {
          align: numeric ? "right" : i + 1 === 2 ? "left" : "center",
          numFmt: numeric && typeof v === "number" && v ? MONEY : undefined,
          size: 8,
        });
      });
      er.height = 26;
      r++;
    }
  }

  ws.mergeCells(r + 1, 1, r + 1, 5);
  ws.getCell(r + 1, 1).value = "Signature of Employer / Manager / Authorised Person";
  box(ws.getCell(r + 1, 1), { bold: true, size: 9 });
  ws.getCell(r + 1, 1).border = undefined;

  const widths = [6, 26, 5, 18, 12, 8, 12, 12, 12, 12, 12, 13, 16];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  return ws;
}

// ------------------------------------------------------------------- Form 1

function form1(wb, ctx) {
  const { company, year, month } = ctx;
  const auth = company.authorization || {};
  const ws = wb.addWorksheet("Form 1", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  const address = [company.address, company.city, company.state, company.pin].filter(Boolean).join(", ");
  const LAST = 16;
  const L = ws.getColumn(LAST).letter;

  title(ws, "A1", `${L}1`, "FORM NO. 1", 12);
  title(ws, "A2", `${L}2`, "REGISTER OF FINES DEDUCTIONS FOR DAMAGES OR LOSS AND ADVANCES (SEE RULE 4)", 10);

  infoRow(ws, 3, LAST, "Name & Address of the Establishment",
    `${company.legalName || company.name}${address ? ", " + address : ""}`);
  infoRow(ws, 4, LAST, "Name & Address of the Contractor (if any)", auth.contractorName || "N/A");
  infoRow(ws, 5, LAST, "Employer / Authorised Person", auth.ownerName || auth.managerName || "");
  infoRow(ws, 6, LAST, "Month & Year", `${MONTHS[month - 1]} ${year}`);

  // header rows 7 (label) + 8 (installment split) + number row 9
  const labels = {
    1: "Serial Number", 2: "Name", 3: "Father's / Husband's Name", 4: "Sex",
    5: "Department", 6: "Nature and date of the offence for which fine imposed",
    7: "Date and particulars of damages / loss caused",
    8: "Date and purpose for which advance was made",
    9: "Whether worker showed cause against fine / deduction",
    10: "Amount of the imposed deduction / advance made",
    11: "No. of installments granted for repayment of fine / deduction",
    14: "Date of recovery of fine / deduction / advance",
    15: "Designation and Signature of the employee", 16: "Remarks",
  };
  Object.entries(labels).forEach(([col, label]) => {
    const c = Number(col);
    ws.mergeCells(7, c, 8, c);
    ws.getCell(7, c).value = label;
    box(ws.getCell(7, c), { bold: true, align: "center", fill: "FFEDF1F7", size: 8 });
  });
  ws.mergeCells(7, 12, 7, 13);
  ws.getCell(7, 12).value = "Wages period and rate of wages payable";
  box(ws.getCell(7, 12), { bold: true, align: "center", fill: "FFEDF1F7", size: 8 });
  ws.getCell(8, 12).value = "First installment";
  ws.getCell(8, 13).value = "Last installment";
  box(ws.getCell(8, 12), { bold: true, align: "center", fill: "FFF3F6FA", size: 8 });
  box(ws.getCell(8, 13), { bold: true, align: "center", fill: "FFF3F6FA", size: 8 });
  ws.getRow(7).height = 46;

  // number row 9
  const numRow = ws.getRow(9);
  for (let c = 1; c <= 11; c++) { numRow.getCell(c).value = c; box(numRow.getCell(c), { align: "center", size: 8 }); }
  ws.mergeCells(9, 12, 9, 13);
  numRow.getCell(12).value = 12; box(numRow.getCell(12), { align: "center", size: 8 });
  numRow.getCell(14).value = 13; box(numRow.getCell(14), { align: "center", size: 8 });
  numRow.getCell(15).value = 14; box(numRow.getCell(15), { align: "center", size: 8 });
  numRow.getCell(16).value = 15; box(numRow.getCell(16), { align: "center", size: 8 });

  // NIL note
  ws.mergeCells(10, 1, 10, LAST);
  ws.getCell(10, 1).value = `No fine imposed during the month of ${MONTHS[month - 1]} - ${year}.`;
  box(ws.getCell(10, 1), { align: "center", bold: true, size: 9 });
  ws.getRow(10).height = 24;

  // signature
  ws.mergeCells(12, 1, 12, 5);
  ws.getCell(12, 1).value = "Signature of Employer / Manager / Authorised Person";
  ws.getCell(12, 1).font = { bold: true, size: 9 };

  const widths = [8, 18, 18, 5, 12, 18, 16, 16, 16, 14, 14, 12, 12, 14, 18, 12];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  return ws;
}

// ------------------------------------------------------- ESI & PF register

function esiPf(wb, ctx) {
  const { company, year, month } = ctx;
  const ws = wb.addWorksheet("ESI & PF Register", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  const address = [company.address, company.city, company.state, company.pin].filter(Boolean).join(", ");
  const estab = `${company.legalName || company.name}${address ? ", " + address : ""}`;
  const LAST = 14;
  const L = ws.getColumn(LAST).letter;

  title(ws, "A1", `${L}1`, "ESIC / PF INSPECTION REGISTER", 12);
  title(ws, "A2", `${L}2`, "(Prescribed Under Employees' Provident Funds Scheme, 1952)", 9);
  title(ws, "A3", `${L}3`,
    "Inspecting / Visiting Officer's Remarks — Particulars of Action taken by the management on the Remarks of Inspecting / Visiting Officers", 8);

  infoRow(ws, 4, LAST, "Name & Address of the Establishment under which the contract work is carried on", estab);
  infoRow(ws, 5, LAST, "Name & Location of Work", estab);
  infoRow(ws, 6, LAST, "Month & Year", `${MONTHS[month - 1]} ${year}`);

  // header rows 7 (label) + 8 (recovery split)
  const labels = {
    1: "Sl. No.", 2: "Name of the Workmen", 3: "Father / Husband's Name",
    4: "Designation", 5: "Particulars of Damages or Loss", 6: "Date of Damage",
    7: "Whether Workmen Showed Cause Against Deduction",
    8: "Name of Person in whose Presence Employee's Explanation was Heard",
    9: "Amount of Deduction Imposed", 10: "No. of Installments",
    13: "Remarks", 14: "Sign of the Employer or his Representative",
  };
  Object.entries(labels).forEach(([col, label]) => {
    const c = Number(col);
    ws.mergeCells(7, c, 8, c);
    ws.getCell(7, c).value = label;
    box(ws.getCell(7, c), { bold: true, align: "center", fill: "FFEDF1F7", size: 8 });
  });
  ws.mergeCells(7, 11, 7, 12);
  ws.getCell(7, 11).value = "Date of Recovery";
  box(ws.getCell(7, 11), { bold: true, align: "center", fill: "FFEDF1F7", size: 8 });
  ws.getCell(8, 11).value = "First Instalment";
  ws.getCell(8, 12).value = "Last Instalment";
  box(ws.getCell(8, 11), { bold: true, align: "center", fill: "FFF3F6FA", size: 8 });
  box(ws.getCell(8, 12), { bold: true, align: "center", fill: "FFF3F6FA", size: 8 });
  ws.getRow(7).height = 46;

  // NIL note
  ws.mergeCells(9, 1, 9, LAST);
  ws.getCell(9, 1).value = `No ESIC / PF Inspection for the month of ${MONTHS[month - 1]}-${year}.`;
  box(ws.getCell(9, 1), { align: "center", bold: true, size: 10 });
  ws.getRow(9).height = 26;

  // signature
  ws.mergeCells(11, 1, 11, 5);
  ws.getCell(11, 1).value = "Signature of Employer / Manager / Authorised Person";
  ws.getCell(11, 1).font = { bold: true, size: 9 };

  const widths = [6, 20, 18, 14, 16, 12, 16, 18, 14, 12, 13, 13, 14, 18];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  return ws;
}

// ------------------------------------------------------------------ registry

const REGISTERS = {
  formB: { id: "formB", title: "Form B — Wage Register", build: formB },
  formMuster: { id: "formMuster", title: "Form 22 — Muster Roll cum Register of Wages", build: form22 },
  formOt: { id: "formOt", title: "Form 9 — Register of Overtime and Payment", build: form9 },
  formFines: { id: "formFines", title: "Form 1 — Register of Fines, Deductions & Advances", build: form1 },
  esiPf: { id: "esiPf", title: "ESI & PF Register", build: esiPf },
};

function listRegisters() {
  return Object.values(REGISTERS).map((r) => ({ id: r.id, title: r.title }));
}

async function buildWorkbook(id, companyId, year, month) {
  const def = REGISTERS[id];
  if (!def) return { error: "Unknown register" };

  const ctx = await gather(companyId, year, month);
  if (ctx.error) return { error: ctx.error };

  const wb = new ExcelJS.Workbook();
  wb.creator = "AHRMS — Ashwija HR Consultancy";
  def.build(wb, ctx);

  const safeName = (ctx.company.name || "company").replace(/[^\w]+/g, "-");
  const filename = `${def.title.split("—")[0].trim().replace(/\s+/g, "-")}-${safeName}-${year}-${String(month).padStart(2, "0")}.xlsx`;
  return { wb, filename, title: def.title };
}

module.exports = { listRegisters, buildWorkbook };
