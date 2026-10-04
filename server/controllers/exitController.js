const prisma = require("../utils/prisma");
const {
  CLEARANCE_ITEMS, CLEARANCE_KEYS, EXIT_TYPES,
  computeGratuity, computeLeaveEncashment, computeNoticeRecovery, settle,
  yearsOfService,
} = require("../utils/exit");

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const toDate = (v) => (v ? new Date(v) : null);

function toDto(row) {
  const parts = {
    pendingSalary: row.pendingSalary,
    leaveEncashment: row.leaveEncashment,
    gratuity: row.gratuity,
    bonus: row.bonus,
    otherEarnings: row.otherEarnings,
    noticeRecovery: row.noticeRecovery,
    loanRecovery: row.loanRecovery,
    otherDeductions: row.otherDeductions,
  };
  return {
    id: row.id,
    companyId: row.companyId,
    employeeId: row.employeeId,
    employee: row.employee
      ? {
          id: row.employee.id,
          code: row.employee.employeeCode,
          name: row.employee.fullName,
          designation: row.employee.designation,
          department: row.employee.department,
          doj: iso(row.employee.doj),
          ctcMonthly: row.employee.ctcMonthly,
          salaryStructure: row.employee.salaryStructure,
          status: row.employee.status,
        }
      : null,
    company: row.company
      ? { id: row.company.id, name: row.company.name, code: row.company.code }
      : null,
    stage: row.stage,
    status: row.status,
    exitType: row.exitType,
    reason: row.reason || "",
    resignedOn: iso(row.resignedOn),
    lastWorkingDay: iso(row.lastWorkingDay),
    noticeServedDays: row.noticeServedDays,
    noticeRequiredDays: row.noticeRequiredDays,
    clearance: row.clearance || {},
    ...parts,
    ...settle(parts),
    completedOn: iso(row.completedOn),
    notes: row.notes || "",
  };
}

const include = { employee: true, company: true };

// --- reference data --------------------------------------------------------

exports.meta = (req, res) =>
  res.json({ clearanceItems: CLEARANCE_ITEMS, exitTypes: EXIT_TYPES });

// --- list ------------------------------------------------------------------

exports.list = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.companyId) where.companyId = Number(req.query.companyId);
    if (req.query.status) where.status = req.query.status;

    const rows = await prisma.exit.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map(toDto));
  } catch (e) {
    next(e);
  }
};

// employees eligible to start an exit (active, not already exiting)
exports.eligible = async (req, res, next) => {
  try {
    const companyId = Number(req.query.companyId);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });

    const existing = await prisma.exit.findMany({
      where: { companyId, status: { in: ["in_progress", "completed"] } },
      select: { employeeId: true },
    });
    const taken = new Set(existing.map((e) => e.employeeId));

    const roster = await prisma.employee.findMany({
      where: { companyId, status: "Active", joiningStatus: "joined" },
      orderBy: { fullName: "asc" },
      select: { id: true, employeeCode: true, fullName: true, designation: true },
    });

    res.json(
      roster
        .filter((e) => !taken.has(e.id))
        .map((e) => ({ id: e.id, code: e.employeeCode, name: e.fullName, designation: e.designation }))
    );
  } catch (e) {
    next(e);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const row = await prisma.exit.findUnique({
      where: { id: Number(req.params.id) },
      include,
    });
    if (!row) return res.status(404).json({ message: "Exit not found" });
    res.json(toDto(row));
  } catch (e) {
    next(e);
  }
};

// --- initiate --------------------------------------------------------------

exports.create = async (req, res, next) => {
  try {
    const employeeId = Number(req.body.employeeId);
    if (!employeeId) return res.status(400).json({ message: "Pick an employee" });

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    if (employee.status !== "Active") {
      return res.status(409).json({ message: "Only active employees can be exited" });
    }

    const dup = await prisma.exit.findUnique({ where: { employeeId } });
    if (dup) return res.status(409).json({ message: "An exit already exists for this employee" });

    const noticeRequired =
      Number(req.body.noticeRequiredDays) ||
      (employee.employmentType === "Probation" ? 15 : 30);

    const clearance = {};
    CLEARANCE_KEYS.forEach((k) => (clearance[k] = false));

    const row = await prisma.exit.create({
      data: {
        companyId: employee.companyId,
        employeeId,
        exitType: req.body.exitType || "Resignation",
        reason: req.body.reason || "",
        resignedOn: toDate(req.body.resignedOn),
        lastWorkingDay: toDate(req.body.lastWorkingDay),
        noticeRequiredDays: noticeRequired,
        clearance,
        stage: "initiated",
        status: "in_progress",
      },
      include,
    });

    res.status(201).json(toDto(row));
  } catch (e) {
    next(e);
  }
};

// --- update ----------------------------------------------------------------

const WRITABLE = [
  "stage", "exitType", "reason", "notes",
];
const NUMS = [
  "noticeServedDays", "noticeRequiredDays",
  "pendingSalary", "leaveEncashment", "gratuity", "bonus", "otherEarnings",
  "noticeRecovery", "loanRecovery", "otherDeductions",
];

exports.update = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = {};
    WRITABLE.forEach((k) => req.body[k] !== undefined && (data[k] = req.body[k]));
    NUMS.forEach((k) => req.body[k] !== undefined && (data[k] = Number(req.body[k]) || 0));
    if (req.body.resignedOn !== undefined) data.resignedOn = toDate(req.body.resignedOn);
    if (req.body.lastWorkingDay !== undefined) data.lastWorkingDay = toDate(req.body.lastWorkingDay);
    if (req.body.clearance !== undefined) data.clearance = req.body.clearance;

    const row = await prisma.exit.update({ where: { id }, data, include });
    res.json(toDto(row));
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Exit not found" });
    next(e);
  }
};

// --- settlement suggestion -------------------------------------------------

/**
 * Compute suggested F&F components from the employee's structure and the
 * exit's dates. The admin can override any figure before completing.
 * Body: { leaveBalanceDays }
 */
exports.suggestSettlement = async (req, res, next) => {
  try {
    const row = await prisma.exit.findUnique({
      where: { id: Number(req.params.id) },
      include,
    });
    if (!row) return res.status(404).json({ message: "Exit not found" });

    const emp = row.employee;
    const s = emp.salaryStructure || {};
    const basic = s.basic || 0;
    const gross = s.gross || 0;
    const leaveBalanceDays = Number(req.body.leaveBalanceDays) || 0;

    const grat = computeGratuity(basic, emp.doj, row.lastWorkingDay);
    const encash = computeLeaveEncashment(leaveBalanceDays, gross);
    const noticeRec = computeNoticeRecovery(
      row.noticeRequiredDays, row.noticeServedDays, gross
    );

    res.json({
      years: grat.years,
      gratuityEligible: grat.eligible,
      suggested: {
        gratuity: grat.amount,
        leaveEncashment: encash,
        noticeRecovery: noticeRec,
      },
      basis: {
        basic, gross, leaveBalanceDays,
        noticeRequiredDays: row.noticeRequiredDays,
        noticeServedDays: row.noticeServedDays,
      },
    });
  } catch (e) {
    next(e);
  }
};

// --- complete / cancel -----------------------------------------------------

exports.complete = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await prisma.exit.findUnique({ where: { id }, include });
    if (!row) return res.status(404).json({ message: "Exit not found" });
    if (row.status === "completed") {
      return res.status(409).json({ message: "This exit is already completed" });
    }
    if (!row.lastWorkingDay) {
      return res.status(422).json({ message: "Set the last working day before completing" });
    }

    const parts = {
      pendingSalary: row.pendingSalary,
      leaveEncashment: row.leaveEncashment,
      gratuity: row.gratuity,
      bonus: row.bonus,
      otherEarnings: row.otherEarnings,
      noticeRecovery: row.noticeRecovery,
      loanRecovery: row.loanRecovery,
      otherDeductions: row.otherDeductions,
    };
    const totals = settle(parts);

    const [exit] = await prisma.$transaction([
      prisma.exit.update({
        where: { id },
        data: {
          stage: "completed",
          status: "completed",
          completedOn: new Date(),
          netSettlement: totals.netSettlement,
          settlementSnapshot: {
            employee: {
              code: row.employee.employeeCode,
              name: row.employee.fullName,
              designation: row.employee.designation,
              doj: iso(row.employee.doj),
            },
            lastWorkingDay: iso(row.lastWorkingDay),
            years: yearsOfService(row.employee.doj, row.lastWorkingDay),
            ...parts,
            ...totals,
          },
        },
        include,
      }),
      prisma.employee.update({
        where: { id: row.employeeId },
        data: { status: "Exited" },
      }),
      prisma.company.update({
        where: { id: row.companyId },
        data: { headcount: { decrement: 1 } },
      }),
    ]);

    res.json(toDto(exit));
  } catch (e) {
    next(e);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await prisma.exit.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ message: "Exit not found" });
    if (row.status === "completed") {
      return res.status(409).json({ message: "A completed exit cannot be cancelled" });
    }
    await prisma.exit.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
