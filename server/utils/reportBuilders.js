// ---------------------------------------------------------------------------
// Report builders.
//
// Every report is described the same way: a set of columns, a set of rows,
// and a totals object. The preview endpoint sends this straight to the
// browser; the Excel/CSV/PDF exporters format the very same structure. One
// source of truth, so the screen and the download can never disagree.
// ---------------------------------------------------------------------------

const prisma = require("./prisma");
const { summarize, daysInMonth } = require("./attendance");

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const col = (key, label, type = "text", extra = {}) => ({
  key, label, type, // type: text | num | money
  align: type === "text" ? "left" : "right",
  total: extra.total || false,
  ...extra,
});

// --- data assembly ---------------------------------------------------------

async function loadRun(companyId, year, month) {
  return prisma.payrollRun.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
    include: { payslips: { orderBy: { employeeId: "asc" } } },
  });
}

/** Merge each payslip with the employee master, so reports can show UAN etc. */
async function monthlyRows(companyId, year, month) {
  const run = await loadRun(companyId, year, month);
  if (!run || !run.payslips.length) return null;

  const ids = run.payslips.map((p) => p.employeeId);
  const emps = await prisma.employee.findMany({ where: { id: { in: ids } } });
  const map = new Map(emps.map((e) => [e.id, e]));

  const rows = run.payslips.map((p) => {
    const e = map.get(p.employeeId) || {};
    const s = p.employeeSnapshot || {};
    const earn = p.earnings || {};
    const ded = p.deductions || {};
    const emp = p.employer || {};
    return {
      employeeId: p.employeeId,
      code: s.code || e.employeeCode,
      name: s.name || e.fullName,
      designation: s.designation || e.designation || "",
      department: s.department || e.department || "",
      doj: iso(e.doj),
      uan: e.uan || "",
      esicIp: e.esicIp || "",
      pan: e.pan || "",
      aadhaar: e.aadhaar || "",
      bankName: e.bankName || "",
      bankAccountName: e.bankAccountName || s.name || "",
      bankAccountNo: s.bankAccountNo || e.bankAccountNo || "",
      bankIfsc: s.bankIfsc || e.bankIfsc || "",
      payableDays: p.payableDays,
      lopDays: p.lopDays,
      totalDays: p.totalDays,
      otHours: p.otHours,
      basic: earn.basic || 0,
      da: earn.da || 0,
      hra: earn.hra || 0,
      conveyance: earn.conveyance || 0,
      special: earn.special || 0,
      travel: earn.travel || 0,
      incentive: earn.incentive || 0,
      medical: earn.medical || 0,
      other: earn.other || 0,
      extraAllow: (earn.extraAllowances || []).reduce((s, a) => s + (a.amount || 0), 0),
      overtime: earn.overtime || 0,
      compOff: earn.compOff || 0,
      elEncashment: earn.elEncashment || 0,
      gross: p.grossEarned,
      pf: ded.pf || 0,
      esi: ded.esi || 0,
      pt: ded.professionalTax || 0,
      lwf: ded.lwf || 0,
      food: ded.food || 0,
      transport: ded.transport || 0,
      uniform: ded.uniform || 0,
      loan: ded.loan || 0,
      advance: ded.advance || 0,
      totalDeductions: p.totalDeductions,
      employerPf: emp.pf || 0,
      employerEsi: emp.esi || 0,
      net: p.netPay,
      onHold: s.onHold || false,
    };
  });

  return { run, rows };
}

async function attendanceRows(companyId, year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month - 1, daysInMonth(year, month)));

  const [roster, records, months] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId, joiningStatus: "joined", status: "Active", doj: { lte: end } },
      orderBy: [{ department: "asc" }, { fullName: "asc" }],
    }),
    prisma.attendanceDay.findMany({ where: { companyId, date: { gte: start, lte: end } } }),
    prisma.attendanceMonth.findMany({ where: { companyId, year, month } }),
  ]);

  const byEmp = new Map();
  records.forEach((r) => {
    if (!byEmp.has(r.employeeId)) byEmp.set(r.employeeId, []);
    byEmp.get(r.employeeId).push({ date: iso(r.date), status: r.status });
  });
  const otByEmp = new Map(months.map((m) => [m.employeeId, m.otHours]));

  return roster.map((e) => {
    const s = summarize(byEmp.get(e.id) || [], {
      year, month, otHours: otByEmp.get(e.id) || 0,
    });
    return {
      employeeId: e.id,
      code: e.employeeCode,
      name: e.fullName,
      department: e.department || "",
      ...s,
    };
  });
}

function sumTotals(rows, columns) {
  const totals = {};
  columns.forEach((c) => {
    if (c.total) totals[c.key] = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
  });
  return totals;
}

// --- monthly report configs ------------------------------------------------

const MONTHLY = {
  bank: {
    title: "Salary Bank Transfer Statement",
    async build(companyId, year, month) {
      const data = await monthlyRows(companyId, year, month);
      if (!data) return null;
      const columns = [
        col("sno", "Sr.", "num"),
        col("name", "Employee name"),
        col("bankAccountName", "Account holder"),
        col("bankName", "Bank"),
        col("bankAccountNo", "Account number"),
        col("bankIfsc", "IFSC"),
        col("net", "Amount", "money", { total: true }),
      ];
      const rows = data.rows
        .filter((r) => r.net > 0 && !r.onHold)
        .map((r, i) => ({ ...r, sno: i + 1 }));
      return {
        columns, rows,
        totals: sumTotals(rows, columns),
        meta: { run: data.run, bankTransfer: true },
      };
    },
  },

  "salary-register": {
    title: "Salary Register",
    async build(companyId, year, month) {
      const data = await monthlyRows(companyId, year, month);
      if (!data) return null;
      const has = (k) => data.rows.some((r) => (r[k] || 0) !== 0);
      const optional = (k, ...args) => (has(k) ? [col(k, ...args)] : []);
      const columns = [
        col("code", "Code"),
        col("name", "Name"),
        col("payableDays", "Paid days", "num"),
        col("lopDays", "LOP", "num"),
        col("basic", "Basic", "money", { total: true }),
        ...optional("da", "DA", "money", { total: true }),
        col("hra", "HRA", "money", { total: true }),
        col("conveyance", "Conv.", "money", { total: true }),
        col("special", "Special", "money", { total: true }),
        ...optional("travel", "Travel", "money", { total: true }),
        ...optional("incentive", "Incentive", "money", { total: true }),
        ...optional("medical", "Medical", "money", { total: true }),
        ...optional("other", "Other allow.", "money", { total: true }),
        ...optional("extraAllow", "Allowances", "money", { total: true }),
        ...optional("overtime", "OT", "money", { total: true }),
        ...optional("compOff", "Comp-off", "money", { total: true }),
        ...optional("elEncashment", "EL encash", "money", { total: true }),
        col("gross", "Gross", "money", { total: true }),
        col("pf", "PF", "money", { total: true }),
        col("esi", "ESI", "money", { total: true }),
        col("pt", "PT", "money", { total: true }),
        ...optional("food", "Food", "money", { total: true }),
        ...optional("transport", "Transport", "money", { total: true }),
        ...optional("uniform", "Uniform", "money", { total: true }),
        ...optional("loan", "Loan", "money", { total: true }),
        ...optional("advance", "Advance", "money", { total: true }),
        col("totalDeductions", "Deductions", "money", { total: true }),
        col("net", "Net pay", "money", { total: true }),
      ];
      return { columns, rows: data.rows, totals: sumTotals(data.rows, columns), meta: { run: data.run } };
    },
  },

  pf: {
    title: "PF (EPF) Statement",
    async build(companyId, year, month) {
      const data = await monthlyRows(companyId, year, month);
      if (!data) return null;
      const rows = data.rows.filter((r) => r.pf > 0 || r.employerPf > 0);
      const columns = [
        col("uan", "UAN"),
        col("code", "Code"),
        col("name", "Name"),
        col("basic", "EPF wages", "money", { total: true }),
        col("pf", "Employee PF", "money", { total: true }),
        col("employerPf", "Employer PF", "money", { total: true }),
      ];
      return { columns, rows, totals: sumTotals(rows, columns), meta: {} };
    },
  },

  esi: {
    title: "ESI Statement",
    async build(companyId, year, month) {
      const data = await monthlyRows(companyId, year, month);
      if (!data) return null;
      const rows = data.rows.filter((r) => r.esi > 0 || r.employerEsi > 0);
      const columns = [
        col("esicIp", "IP number"),
        col("code", "Code"),
        col("name", "Name"),
        col("gross", "ESI wages", "money", { total: true }),
        col("esi", "Employee ESI", "money", { total: true }),
        col("employerEsi", "Employer ESI", "money", { total: true }),
      ];
      return { columns, rows, totals: sumTotals(rows, columns), meta: {} };
    },
  },

  pt: {
    title: "Professional Tax Statement",
    async build(companyId, year, month) {
      const data = await monthlyRows(companyId, year, month);
      if (!data) return null;
      const rows = data.rows.filter((r) => r.pt > 0);
      const columns = [
        col("code", "Code"),
        col("name", "Name"),
        col("gross", "Gross wages", "money", { total: true }),
        col("pt", "PT deducted", "money", { total: true }),
      ];
      return { columns, rows, totals: sumTotals(rows, columns), meta: {} };
    },
  },

  attendance: {
    title: "Attendance Summary",
    async build(companyId, year, month) {
      const rows = await attendanceRows(companyId, year, month);
      const columns = [
        col("code", "Code"),
        col("name", "Name"),
        col("department", "Department"),
        col("presentDays", "Present", "num", { total: true }),
        col("paidLeaveDays", "Paid leave", "num", { total: true }),
        col("weeklyOffDays", "Wk off", "num", { total: true }),
        col("holidayDays", "Holiday", "num", { total: true }),
        col("absentDays", "LOP", "num", { total: true }),
        col("payableDays", "Payable", "num", { total: true }),
        col("otHours", "OT hrs", "num", { total: true }),
      ];
      return { columns, rows, totals: sumTotals(rows, columns), meta: {} };
    },
  },
};

// --- annual report configs -------------------------------------------------

/** Collect 12 months of monthly rows, keyed by employee. */
async function annualByEmployee(companyId, year, pick) {
  const monthsData = await Promise.all(
    Array.from({ length: 12 }, (_, i) => monthlyRows(companyId, year, i + 1))
  );

  const byEmp = new Map(); // code -> { name, months:{1..12}, total }
  monthsData.forEach((md, idx) => {
    if (!md) return;
    md.rows.forEach((r) => {
      if (!byEmp.has(r.code)) {
        byEmp.set(r.code, { employeeId: r.employeeId, code: r.code, name: r.name, months: {}, total: 0 });
      }
      const rec = byEmp.get(r.code);
      const v = pick(r);
      rec.months[idx + 1] = v;
      rec.total += v;
    });
  });
  return [...byEmp.values()];
}

function annualConfig(title, pick, moneyType = "money") {
  return {
    title,
    async build(companyId, year) {
      const emps = await annualByEmployee(companyId, year, pick);
      if (!emps.length) return null;
      const columns = [
        col("code", "Code"),
        col("name", "Name"),
        ...MONTHS_SHORT.map((m, i) =>
          col(`m${i + 1}`, m, moneyType, { total: true })
        ),
        col("total", "Total", moneyType, { total: true }),
      ];
      const rows = emps.map((e) => {
        const row = { employeeId: e.employeeId, code: e.code, name: e.name, total: e.total };
        for (let m = 1; m <= 12; m++) row[`m${m}`] = e.months[m] || 0;
        return row;
      });
      return { columns, rows, totals: sumTotals(rows, columns), meta: {} };
    },
  };
}

const ANNUAL = {
  "annual-salary": annualConfig("Annual Salary Register (Net Pay)", (r) => r.net),
  "annual-pf": annualConfig("Annual PF Contribution (Employee)", (r) => r.pf),
  "annual-esi": annualConfig("Annual ESI Contribution (Employee)", (r) => r.esi),
  "annual-attendance": annualConfig("Annual Attendance (Payable Days)", (r) => r.payableDays, "num"),

  headcount: {
    title: "Headcount & Attrition",
    async build(companyId, year) {
      const [emps, exits] = await Promise.all([
        prisma.employee.findMany({
          where: { companyId, joiningStatus: "joined" },
          select: { doj: true },
        }),
        prisma.exit.findMany({
          where: { companyId, status: "completed" },
          select: { completedOn: true, lastWorkingDay: true },
        }),
      ]);

      const yStart = new Date(Date.UTC(year, 0, 1));
      let opening = emps.filter((e) => e.doj && new Date(e.doj) < yStart).length;

      const columns = [
        col("month", "Month"),
        col("opening", "Opening", "num"),
        col("joined", "Joined", "num", { total: true }),
        col("exited", "Exited", "num", { total: true }),
        col("closing", "Closing", "num"),
      ];

      const rows = [];
      for (let m = 0; m < 12; m++) {
        const mStart = new Date(Date.UTC(year, m, 1));
        const mEnd = new Date(Date.UTC(year, m + 1, 0, 23, 59, 59));
        const joined = emps.filter(
          (e) => e.doj && new Date(e.doj) >= mStart && new Date(e.doj) <= mEnd
        ).length;
        const exited = exits.filter((x) => {
          const d = x.lastWorkingDay || x.completedOn;
          return d && new Date(d) >= mStart && new Date(d) <= mEnd;
        }).length;
        const closing = opening + joined - exited;
        rows.push({ month: MONTHS_LONG[m], opening, joined, exited, closing });
        opening = closing;
      }

      return { columns, rows, totals: sumTotals(rows, columns), meta: {} };
    },
  },
};

// --- registry + entry point ------------------------------------------------

const REPORTS = {
  monthly: MONTHLY,
  annual: ANNUAL,
};

const REPORT_CATALOG = {
  monthly: Object.entries(MONTHLY).map(([id, r]) => ({ id, title: r.title })),
  annual: Object.entries(ANNUAL).map(([id, r]) => ({ id, title: r.title })),
};

async function buildReport({ scope, type, companyId, year, month, employeeId }) {
  const group = REPORTS[scope];
  if (!group || !group[type]) return { error: "Unknown report" };

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { error: "Company not found" };

  const result =
    scope === "monthly"
      ? await group[type].build(companyId, year, month)
      : await group[type].build(companyId, year);

  if (!result) {
    return {
      error:
        scope === "monthly"
          ? "No payroll run for this month. Run and finalise payroll first."
          : "No payroll data for this year yet.",
    };
  }

  // Narrow to one employee, if asked and the report is per-employee. Totals
  // and the serial number are recomputed so the filtered view stays correct.
  let employeeName = null;
  if (employeeId && result.rows.length && result.rows[0].employeeId !== undefined) {
    result.rows = result.rows.filter((r) => r.employeeId === Number(employeeId));
    employeeName = result.rows[0]?.name || null;
    result.totals = {};
    result.columns.forEach((c) => {
      if (c.total) {
        result.totals[c.key] = result.rows.reduce(
          (s, r) => s + (Number(r[c.key]) || 0),
          0
        );
      }
    });
    result.rows.forEach((r, i) => {
      if (r.sno !== undefined) r.sno = i + 1;
    });
  }

  const periodLabel =
    scope === "monthly" ? `${MONTHS_LONG[month - 1]} ${year}` : `Year ${year}`;

  return {
    scope,
    type,
    title: group[type].title,
    periodLabel: employeeName ? `${employeeName} — ${periodLabel}` : periodLabel,
    company: {
      name: company.name,
      legalName: company.legalName,
      logoUrl: company.logoUrl,
      address: [company.address, company.city, company.state, company.pin].filter(Boolean).join(", "),
      registrations: company.registrations,
      bank: company.bank,
      authorization: company.authorization,
    },
    ...result,
  };
}

// --- consolidated across every company -------------------------------------

/**
 * Run a per-company report for every client and stack the rows into one table
 * with a leading "Company" column. Used when "All companies" is selected.
 * The bank transfer statement is deliberately not consolidated — it's a
 * per-company submission — so it returns a message instead.
 */
async function buildConsolidated({ scope, type, year, month }) {
  const group = REPORTS[scope];
  if (!group || !group[type]) return { error: "Unknown report" };
  if (type === "bank") {
    return {
      error: "The bank transfer statement is prepared per company. Pick a company to generate it.",
    };
  }

  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });

  let baseColumns = null;
  const rows = [];
  for (const company of companies) {
    const result =
      scope === "monthly"
        ? await group[type].build(company.id, year, month)
        : await group[type].build(company.id, year);
    if (!result || !result.rows.length) continue;
    if (!baseColumns) baseColumns = result.columns;
    result.rows.forEach((r) => rows.push({ company: company.name, ...r }));
  }

  if (!baseColumns || !rows.length) {
    return {
      error:
        scope === "monthly"
          ? "No finalised payroll in any company for this month yet."
          : "No payroll data across companies for this year yet.",
    };
  }

  const columns = [col("company", "Company"), ...baseColumns];
  const totals = {};
  columns.forEach((c) => {
    if (c.total) totals[c.key] = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
  });

  const periodLabel =
    scope === "monthly" ? `${MONTHS_LONG[month - 1]} ${year}` : `Year ${year}`;

  return {
    scope,
    type,
    title: group[type].title,
    periodLabel: `All companies — ${periodLabel}`,
    company: {
      name: "All Companies",
      legalName: "Ashwija HR Consultancy",
      address: "",
      registrations: {},
      bank: {},
      authorization: {},
    },
    columns,
    rows,
    totals,
    meta: {},
  };
}

module.exports = { buildReport, buildConsolidated, REPORT_CATALOG };
