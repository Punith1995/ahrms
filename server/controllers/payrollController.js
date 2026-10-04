const prisma = require("../utils/prisma");
const { runPayslip } = require("../utils/payroll");
const { summarize, daysInMonth } = require("../utils/attendance");

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function monthRange(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month - 1, daysInMonth(year, month)));
  return { start, end };
}

/** Build every employee's payslip figures for a company-month, in memory. */
async function computeRun(companyId, year, month) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { error: "Company not found" };

  const { start, end } = monthRange(year, month);

  const [roster, records, months, monthlyDeds, encashments] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId, joiningStatus: "joined", status: "Active", doj: { lte: end } },
      orderBy: [{ department: "asc" }, { fullName: "asc" }],
    }),
    prisma.attendanceDay.findMany({
      where: { companyId, date: { gte: start, lte: end } },
    }),
    prisma.attendanceMonth.findMany({ where: { companyId, year, month } }),
    prisma.monthlyDeduction.findMany({ where: { companyId, year, month } }),
    prisma.leaveEncashment.findMany({ where: { companyId, year, month } }),
  ]);
  const mdByEmp = new Map(monthlyDeds.map((m) => [m.employeeId, m]));
  const encashByEmp = new Map();
  encashments.forEach((e) =>
    encashByEmp.set(e.employeeId, (encashByEmp.get(e.employeeId) || 0) + e.amount)
  );

  const marksByEmp = new Map();
  records.forEach((r) => {
    if (!marksByEmp.has(r.employeeId)) marksByEmp.set(r.employeeId, []);
    marksByEmp.get(r.employeeId).push({ date: iso(r.date), status: r.status });
  });
  const monthByEmp = new Map(months.map((m) => [m.employeeId, m]));

  // OT settings live on the company (per your setup). Rate is a multiple of
  // the normal hourly wage; default 2× if not configured.
  const otRate = company.payroll?.otRatePerHour;         // explicit ₹/hr (optional)
  const otMultiplier = company.payroll?.otRateMultiplier ?? 2;

  const lines = roster.map((e) => {
    const extra = monthByEmp.get(e.id);
    const att = summarize(marksByEmp.get(e.id) || [], {
      year, month, otHours: extra?.otHours || 0,
    });
    const compliance = {
      ...(company.compliance || {}),
      pfApplicable: e.pfApplicable,
      esiApplicable: e.esiApplicable,
    };
    const md = mdByEmp.get(e.id);
    const slip = runPayslip(e.salaryStructure || {}, att, compliance, {
      month,
      otRatePerHour: otRate,
      otRateMultiplier: otMultiplier,
      otAsIncentive: !!company.payroll?.otAsIncentive,
      monthlyDeduction: md
        ? { food: md.food || 0, transport: md.transport || 0, uniform: md.uniform || 0, loan: md.loan || 0, advance: md.advance || 0 }
        : undefined,
      elEncashment: encashByEmp.get(e.id) || 0,
    });

    return {
      employeeId: e.id,
      code: e.employeeCode,
      name: e.fullName,
      designation: e.designation || "",
      department: e.department || "",
      doj: iso(e.doj),
      uan: e.uan || "",
      esicIp: e.esicIp || "",
      bankAccountNo: e.bankAccountNo || "",
      bankIfsc: e.bankIfsc || "",
      ctcMonthly: e.ctcMonthly || 0,
      onHold: e.salaryHold || false,
      attendanceComplete: att.complete,
      unmarked: att.unmarked,
      locked: extra?.locked || false,
      ...slip,
    };
  });

  const totals = lines.reduce(
    (t, l) => {
      t.gross += l.grossEarned;
      t.deductions += l.totalDeductions;
      t.net += l.netPay;
      t.employer += l.employerCost;
      return t;
    },
    { gross: 0, deductions: 0, net: 0, employer: 0 }
  );

  return {
    company,
    year,
    month,
    lines,
    totals: {
      employees: lines.length,
      gross: Math.round(totals.gross),
      deductions: Math.round(totals.deductions),
      net: Math.round(totals.net),
      employer: Math.round(totals.employer),
    },
    attendanceReady: lines.every((l) => l.attendanceComplete),
    attendanceLocked: lines.length > 0 && lines.every((l) => l.locked),
  };
}

function companySnapshot(c) {
  return {
    name: c.name,
    legalName: c.legalName,
    logoUrl: c.logoUrl,
    address: c.address,
    city: c.city,
    state: c.state,
    pin: c.pin,
    registrations: c.registrations,
    bank: c.bank,
    authorization: c.authorization,
  };
}

// --- preview (no write) ----------------------------------------------------

exports.preview = async (req, res, next) => {
  try {
    const companyId = Number(req.query.companyId);
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!companyId || !year || !month) {
      return res.status(400).json({ message: "companyId, year and month are required" });
    }

    const existing = await prisma.payrollRun.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
      include: { payslips: true },
    });

    const computed = await computeRun(companyId, year, month);
    if (computed.error) return res.status(404).json({ message: computed.error });

    res.json({
      companyId, year, month,
      companyName: computed.company.name,
      run: existing
        ? {
            id: existing.id,
            status: existing.status,
            finalisedOn: iso(existing.finalisedOn),
            paidOn: iso(existing.paidOn),
          }
        : null,
      totals: computed.totals,
      attendanceReady: computed.attendanceReady,
      attendanceLocked: computed.attendanceLocked,
      lines: computed.lines,
    });
  } catch (e) {
    next(e);
  }
};

// --- run / re-run (writes draft) -------------------------------------------

exports.run = async (req, res, next) => {
  try {
    const companyId = Number(req.body.companyId);
    const year = Number(req.body.year);
    const month = Number(req.body.month);
    if (!companyId || !year || !month) {
      return res.status(400).json({ message: "companyId, year and month are required" });
    }

    const computed = await computeRun(companyId, year, month);
    if (computed.error) return res.status(404).json({ message: computed.error });
    if (!computed.lines.length) {
      return res.status(422).json({ message: "No active employees to run payroll for" });
    }

    const existing = await prisma.payrollRun.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
    });
    if (existing && existing.status !== "draft") {
      return res.status(409).json({
        message: `Payroll for this month is already ${existing.status}. Reopen it to re-run.`,
      });
    }

    const run = await prisma.$transaction(async (tx) => {
      const saved = await tx.payrollRun.upsert({
        where: { companyId_year_month: { companyId, year, month } },
        update: {
          status: "draft",
          companySnapshot: companySnapshot(computed.company),
          totalEmployees: computed.totals.employees,
          totalGross: computed.totals.gross,
          totalDeductions: computed.totals.deductions,
          totalNet: computed.totals.net,
          totalEmployerCost: computed.totals.employer,
        },
        create: {
          companyId, year, month, status: "draft",
          companySnapshot: companySnapshot(computed.company),
          totalEmployees: computed.totals.employees,
          totalGross: computed.totals.gross,
          totalDeductions: computed.totals.deductions,
          totalNet: computed.totals.net,
          totalEmployerCost: computed.totals.employer,
        },
      });

      await tx.payslip.deleteMany({ where: { runId: saved.id } });
      await tx.payslip.createMany({
        data: computed.lines.map((l) => ({
          runId: saved.id,
          employeeId: l.employeeId,
          employeeSnapshot: {
            code: l.code, name: l.name, designation: l.designation,
            department: l.department, bankAccountNo: l.bankAccountNo,
            bankIfsc: l.bankIfsc,
            // added for the payslip:
            doj: l.doj, uan: l.uan, esicIp: l.esicIp,
            onHold: l.onHold,
          },
          payableDays: l.payableDays,
          lopDays: l.lopDays,
          totalDays: l.totalDays,
          otHours: l.otHours,
          earnings: l.earnings,
          deductions: l.deductions,
          employer: l.employer,
          grossEarned: l.grossEarned,
          totalDeductions: l.totalDeductions,
          netPay: l.netPay,
          employerCost: l.employerCost,
        })),
      });

      return saved;
    });

    res.json({
      ok: true,
      runId: run.id,
      status: run.status,
      totals: computed.totals,
      warnings: computed.attendanceReady
        ? []
        : ["Attendance is not complete for every employee — some pay may be understated."],
    });
  } catch (e) {
    next(e);
  }
};

// --- get a saved run -------------------------------------------------------

exports.getRun = async (req, res, next) => {
  try {
    const companyId = Number(req.query.companyId);
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    const run = await prisma.payrollRun.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
      include: { payslips: { orderBy: { employeeId: "asc" } } },
    });
    if (!run) return res.status(404).json({ message: "No payroll run saved for this month" });

    res.json({
      id: run.id,
      companyId, year, month,
      status: run.status,
      finalisedOn: iso(run.finalisedOn),
      paidOn: iso(run.paidOn),
      company: run.companySnapshot,
      totals: {
        employees: run.totalEmployees,
        gross: run.totalGross,
        deductions: run.totalDeductions,
        net: run.totalNet,
        employer: run.totalEmployerCost,
      },
      lines: run.payslips.map((p) => ({
        id: p.id,
        employeeId: p.employeeId,
        ...p.employeeSnapshot,
        payableDays: p.payableDays,
        lopDays: p.lopDays,
        totalDays: p.totalDays,
        otHours: p.otHours,
        earnings: p.earnings,
        deductions: p.deductions,
        employer: p.employer,
        grossEarned: p.grossEarned,
        totalDeductions: p.totalDeductions,
        netPay: p.netPay,
        employerCost: p.employerCost,
      })),
    });
  } catch (e) {
    next(e);
  }
};

// --- status transitions ----------------------------------------------------

exports.finalise = async (req, res, next) => {
  try {
    const { companyId, year, month } = req.body;
    const run = await prisma.payrollRun.findUnique({
      where: {
        companyId_year_month: {
          companyId: Number(companyId), year: Number(year), month: Number(month),
        },
      },
    });
    if (!run) return res.status(404).json({ message: "Run this month's payroll first" });
    if (run.status === "paid") {
      return res.status(409).json({ message: "This payroll is already marked paid" });
    }

    const updated = await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: "finalised", finalisedOn: new Date() },
    });
    res.json({ ok: true, status: updated.status });
  } catch (e) {
    next(e);
  }
};

exports.markPaid = async (req, res, next) => {
  try {
    const { companyId, year, month } = req.body;
    const run = await prisma.payrollRun.findUnique({
      where: {
        companyId_year_month: {
          companyId: Number(companyId), year: Number(year), month: Number(month),
        },
      },
    });
    if (!run) return res.status(404).json({ message: "Run not found" });
    if (run.status === "draft") {
      return res.status(409).json({ message: "Finalise the payroll before marking it paid" });
    }

    const updated = await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: "paid", paidOn: new Date() },
    });
    res.json({ ok: true, status: updated.status });
  } catch (e) {
    next(e);
  }
};

exports.reopen = async (req, res, next) => {
  try {
    const { companyId, year, month } = req.body;
    const run = await prisma.payrollRun.findUnique({
      where: {
        companyId_year_month: {
          companyId: Number(companyId), year: Number(year), month: Number(month),
        },
      },
    });
    if (!run) return res.status(404).json({ message: "Run not found" });

    const updated = await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: "draft", finalisedOn: null, paidOn: null },
    });
    res.json({ ok: true, status: updated.status });
  } catch (e) {
    next(e);
  }
};
