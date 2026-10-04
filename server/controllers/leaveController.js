const prisma = require("../utils/prisma");
const {
  LEAVE_TYPES, TYPE_KEYS, isPaidType, attendanceCodeFor, resolvePolicy,
  computeBalances, typeMeta,
} = require("../utils/leave");
const { weeklyOffDays } = require("../utils/attendance");

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const utcDate = (s) => new Date(`${s}T00:00:00.000Z`);
const yearOf = (s) => new Date(s).getUTCFullYear();

// --- reference -------------------------------------------------------------

exports.meta = (req, res) => res.json({ leaveTypes: LEAVE_TYPES });

// --- company balances table ------------------------------------------------

exports.balances = async (req, res, next) => {
  try {
    const companyId = Number(req.query.companyId);
    const year = Number(req.query.year) || new Date().getFullYear();
    if (!companyId) return res.status(400).json({ message: "companyId is required" });

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ message: "Company not found" });
    const policy = resolvePolicy(company.leavePolicy);

    const [roster, records, encashments] = await Promise.all([
      prisma.employee.findMany({
        where: { companyId, joiningStatus: "joined", status: "Active" },
        orderBy: [{ department: "asc" }, { fullName: "asc" }],
        select: { id: true, employeeCode: true, fullName: true, designation: true, department: true },
      }),
      prisma.leaveRecord.findMany({ where: { companyId, year } }),
      prisma.leaveEncashment.findMany({ where: { companyId, year } }),
    ]);

    const byEmp = new Map();
    records.forEach((r) => {
      if (!byEmp.has(r.employeeId)) byEmp.set(r.employeeId, []);
      byEmp.get(r.employeeId).push(r);
    });
    const encByEmp = new Map();
    encashments.forEach((e) => {
      encByEmp.set(e.employeeId, (encByEmp.get(e.employeeId) || 0) + e.days);
    });

    const employees = roster.map((e) => {
      const { balances, lopTaken, paidTaken } = computeBalances(
        policy, byEmp.get(e.id) || [], { EL: encByEmp.get(e.id) || 0 }
      );
      return {
        id: e.id,
        code: e.employeeCode,
        name: e.fullName,
        designation: e.designation || "",
        department: e.department || "",
        balances,
        lopTaken,
        paidTaken,
        totalTaken: paidTaken + lopTaken,
      };
    });

    res.json({ companyId, year, policy, leaveTypes: LEAVE_TYPES, employees });
  } catch (e) {
    next(e);
  }
};

// --- EL encashment for active employees ------------------------------------

/**
 * Encash earned leave for a working employee.
 * Body: { employeeId, days, note }. Amount = days × (monthly gross / 30).
 */
exports.encash = async (req, res, next) => {
  try {
    const employeeId = Number(req.body.employeeId);
    const days = Number(req.body.days);
    const note = (req.body.note || "").trim();
    if (!employeeId || !days || days <= 0) {
      return res.status(400).json({ message: "Employee and a positive number of days are required" });
    }

    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) return res.status(404).json({ message: "Employee not found" });

    const company = await prisma.company.findUnique({ where: { id: emp.companyId } });
    const policy = resolvePolicy(company?.leavePolicy);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // paid in the current month's payroll

    // check there's enough EL balance left
    const [records, encashments] = await Promise.all([
      prisma.leaveRecord.findMany({ where: { employeeId, year } }),
      prisma.leaveEncashment.findMany({ where: { employeeId, year } }),
    ]);
    const alreadyEncashed = encashments.reduce((s, e) => s + e.days, 0);
    const { balances } = computeBalances(policy, records, { EL: alreadyEncashed });
    const el = balances.find((b) => b.key === "EL");
    const remaining = el ? el.remaining : 0;
    if (days > remaining) {
      return res.status(400).json({
        message: `Only ${remaining} EL day(s) available to encash.`,
      });
    }

    const gross = emp.salaryStructure?.gross || 0;
    const amount = Math.round(days * (gross / 30));

    await prisma.leaveEncashment.create({
      data: { companyId: emp.companyId, employeeId, year, month, days, amount, note },
    });

    res.json({ ok: true, days, amount, month, remaining: remaining - days });
  } catch (e) {
    next(e);
  }
};

exports.removeEncash = async (req, res, next) => {
  try {
    await prisma.leaveEncashment.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Not found" });
    next(e);
  }
};

// --- single employee ledger ------------------------------------------------

exports.employee = async (req, res, next) => {
  try {
    const employeeId = Number(req.params.employeeId);
    const year = Number(req.query.year) || new Date().getFullYear();

    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) return res.status(404).json({ message: "Employee not found" });

    const company = await prisma.company.findUnique({ where: { id: emp.companyId } });
    const policy = resolvePolicy(company?.leavePolicy);

    const records = await prisma.leaveRecord.findMany({
      where: { employeeId, year },
      orderBy: { date: "desc" },
    });
    const encashments = await prisma.leaveEncashment.findMany({
      where: { employeeId, year },
      orderBy: { createdAt: "desc" },
    });
    const encashedEl = encashments.reduce((s, e) => s + e.days, 0);

    const { balances, lopTaken, paidTaken } = computeBalances(policy, records, { EL: encashedEl });

    res.json({
      employee: {
        id: emp.id, code: emp.employeeCode, name: emp.fullName,
        designation: emp.designation, department: emp.department,
        weeklyOff: emp.weeklyOff || "Sunday",
        gross: emp.salaryStructure?.gross || 0,
      },
      year,
      policy,
      balances,
      lopTaken,
      paidTaken,
      records: records.map((r) => ({
        id: r.id,
        date: iso(r.date),
        leaveType: r.leaveType,
        label: typeMeta(r.leaveType)?.label,
        paid: r.paid,
        reason: r.reason || "",
      })),
      encashments: encashments.map((e) => ({
        id: e.id,
        days: e.days,
        amount: e.amount,
        note: e.note || "",
        createdAt: iso(e.createdAt),
      })),
    });
  } catch (e) {
    next(e);
  }
};

// --- add leave -------------------------------------------------------------

/**
 * Add leave for one employee across a date (or a from–to range).
 * Weekly-off days in the range are skipped automatically.
 * Body: { employeeId, fromDate, toDate?, leaveType, reason? }
 */
exports.add = async (req, res, next) => {
  try {
    const employeeId = Number(req.body.employeeId);
    const leaveType = req.body.leaveType;
    const fromDate = req.body.fromDate;
    const toDate = req.body.toDate || fromDate;
    const reason = req.body.reason || "";

    if (!employeeId || !fromDate || !leaveType) {
      return res.status(400).json({ message: "Employee, date and leave type are required" });
    }
    if (!TYPE_KEYS.includes(leaveType)) {
      return res.status(400).json({ message: "Unknown leave type" });
    }
    if (utcDate(toDate) < utcDate(fromDate)) {
      return res.status(400).json({ message: "End date is before the start date" });
    }

    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) return res.status(404).json({ message: "Employee not found" });

    // build the list of working dates (skip the employee's weekly offs)
    const offs = weeklyOffDays(emp.weeklyOff);
    const dates = [];
    for (let d = utcDate(fromDate); d <= utcDate(toDate); d.setUTCDate(d.getUTCDate() + 1)) {
      if (offs.includes(d.getUTCDay())) continue;
      dates.push(new Date(d));
    }
    if (!dates.length) {
      return res.status(422).json({ message: "The selected range is only weekly-off days" });
    }

    // reject dates already having a leave, or in a locked month
    const existing = await prisma.leaveRecord.findMany({
      where: { employeeId, date: { in: dates } },
      select: { date: true },
    });
    const taken = new Set(existing.map((r) => iso(r.date)));

    const monthsNeeded = [...new Set(dates.map((d) => `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`))];
    const locks = await prisma.attendanceMonth.findMany({
      where: {
        employeeId, locked: true,
        OR: monthsNeeded.map((m) => {
          const [y, mo] = m.split("-").map(Number);
          return { year: y, month: mo };
        }),
      },
      select: { year: true, month: true },
    });
    const lockedMonths = new Set(locks.map((l) => `${l.year}-${l.month}`));

    const toApply = dates.filter(
      (d) =>
        !taken.has(iso(d)) &&
        !lockedMonths.has(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`)
    );
    if (!toApply.length) {
      return res.status(422).json({
        message: "Those dates already have leave, or fall in a finalised (locked) month",
      });
    }

    // paid leave must fit within the remaining balance
    const paid = isPaidType(leaveType);
    if (paid) {
      const company = await prisma.company.findUnique({ where: { id: emp.companyId } });
      const policy = resolvePolicy(company?.leavePolicy);
      const yearRecords = await prisma.leaveRecord.findMany({
        where: { employeeId, year: toApply[0].getUTCFullYear(), leaveType },
      });
      const remaining = (policy[leaveType] || 0) - yearRecords.length;
      if (toApply.length > remaining) {
        return res.status(422).json({
          message: `Only ${remaining} ${leaveType} day(s) left. Reduce the range, or record these as Loss of Pay.`,
        });
      }
    }

    const attCode = attendanceCodeFor(leaveType);

    await prisma.$transaction([
      prisma.leaveRecord.createMany({
        data: toApply.map((d) => ({
          companyId: emp.companyId,
          employeeId,
          date: d,
          leaveType,
          paid,
          reason,
          year: d.getUTCFullYear(),
        })),
      }),
      // mirror into the attendance register so payroll picks it up
      ...toApply.map((d) =>
        prisma.attendanceDay.upsert({
          where: { employeeId_date: { employeeId, date: d } },
          update: { status: attCode },
          create: { companyId: emp.companyId, employeeId, date: d, status: attCode },
        })
      ),
    ]);

    res.status(201).json({
      ok: true,
      added: toApply.length,
      skipped: dates.length - toApply.length,
      paid,
      deductsSalary: !paid,
    });
  } catch (e) {
    next(e);
  }
};

// --- remove leave ----------------------------------------------------------

exports.remove = async (req, res, next) => {
  try {
    const rec = await prisma.leaveRecord.findUnique({ where: { id: Number(req.params.id) } });
    if (!rec) return res.status(404).json({ message: "Leave not found" });

    // don't undo a leave in a locked month
    const lock = await prisma.attendanceMonth.findUnique({
      where: {
        employeeId_year_month: {
          employeeId: rec.employeeId,
          year: rec.date.getUTCFullYear(),
          month: rec.date.getUTCMonth() + 1,
        },
      },
    });
    if (lock?.locked) {
      return res.status(409).json({ message: "That month is finalised — reopen it first" });
    }

    await prisma.$transaction([
      prisma.leaveRecord.delete({ where: { id: rec.id } }),
      // removing a leave means the person was present that day
      prisma.attendanceDay.upsert({
        where: { employeeId_date: { employeeId: rec.employeeId, date: rec.date } },
        update: { status: "P" },
        create: {
          companyId: rec.companyId, employeeId: rec.employeeId, date: rec.date, status: "P",
        },
      }),
    ]);

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

// --- policy ----------------------------------------------------------------

exports.getPolicy = async (req, res, next) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: Number(req.query.companyId) },
    });
    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json({ policy: resolvePolicy(company.leavePolicy), leaveTypes: LEAVE_TYPES });
  } catch (e) {
    next(e);
  }
};

exports.setPolicy = async (req, res, next) => {
  try {
    const companyId = Number(req.body.companyId);
    const policy = resolvePolicy(req.body.policy || {});
    await prisma.company.update({ where: { id: companyId }, data: { leavePolicy: policy } });
    res.json({ ok: true, policy });
  } catch (e) {
    next(e);
  }
};
