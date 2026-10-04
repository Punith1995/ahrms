const prisma = require("../utils/prisma");
const {
  STATUS, STATUS_CODES, isValidStatus, daysInMonth, summarize, weeklyOffDays,
} = require("../utils/attendance");

const iso = (d) => new Date(d).toISOString().slice(0, 10);

function monthRange(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month - 1, daysInMonth(year, month)));
  return { start, end };
}

/** Active, joined employees for a company as of the given month. */
async function rosterFor(companyId, year, month) {
  const { end } = monthRange(year, month);
  return prisma.employee.findMany({
    where: {
      companyId,
      joiningStatus: "joined",
      doj: { lte: end },
      // once Exit exists, also exclude those who left before the month
    },
    orderBy: [{ department: "asc" }, { fullName: "asc" }],
  });
}

// --- month grid ------------------------------------------------------------

// day headers are the same for every company in a month
function buildDays(year, month, total) {
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1, i + 1));
    const dow = d.getUTCDay();
    return {
      date: iso(d),
      day: i + 1,
      weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow],
      isWeekend: dow === 0 || dow === 6,
    };
  });
}

// normal hourly wage = basic / (26 days × 8 hours); OT paid at company multiple
function otRateFor(emp, multiplier) {
  const basic = emp.salaryStructure?.basic || 0;
  const hourly = basic / (26 * 8);
  return Math.round(hourly * (multiplier ?? 2) * 100) / 100;
}

/** Build the employee rows for one company for the month. */
async function employeesForMonth(company, year, month) {
  const { start, end } = monthRange(year, month);
  const multiplier = company.payroll?.otRateMultiplier ?? 2;

  const [roster, records, months] = await Promise.all([
    rosterFor(company.id, year, month),
    prisma.attendanceDay.findMany({
      where: { companyId: company.id, date: { gte: start, lte: end } },
    }),
    prisma.attendanceMonth.findMany({
      where: { companyId: company.id, year, month },
    }),
  ]);

  const byEmployee = new Map();
  records.forEach((r) => {
    if (!byEmployee.has(r.employeeId)) byEmployee.set(r.employeeId, {});
    byEmployee.get(r.employeeId)[iso(r.date)] = r.status;
  });
  const monthByEmp = new Map(months.map((m) => [m.employeeId, m]));

  return roster.map((e) => {
    const marks = byEmployee.get(e.id) || {};
    const extra = monthByEmp.get(e.id);
    const marksArray = Object.entries(marks).map(([date, status]) => ({ date, status }));
    const otRate = otRateFor(e, multiplier);
    const otHours = extra?.otHours || 0;
    return {
      id: e.id,
      companyId: company.id,
      code: e.employeeCode,
      name: e.fullName,
      department: e.department || "",
      designation: e.designation || "",
      weeklyOff: e.weeklyOff || "Sunday",
      doj: e.doj ? iso(e.doj) : null,
      marks,
      otHours,
      otRate,                                   // ₹ per OT hour (incl. multiplier)
      otAmount: Math.round(otHours * otRate),   // OT pay for the hours entered
      locked: extra?.locked || false,
      summary: summarize(marksArray, { year, month, otHours }),
    };
  });
}

// --- month grid ------------------------------------------------------------

exports.getMonth = async (req, res, next) => {
  try {
    const companyId = Number(req.query.companyId);
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!companyId || !year || !month) {
      return res.status(400).json({ message: "companyId, year and month are required" });
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ message: "Company not found" });

    const total = daysInMonth(year, month);
    const days = buildDays(year, month, total);
    const employees = await employeesForMonth(company, year, month);

    res.json({
      companyId, year, month, totalDays: total,
      days,
      statuses: STATUS,
      employees,
    });
  } catch (e) {
    next(e);
  }
};

// --- all companies at once -------------------------------------------------

exports.getAll = async (req, res, next) => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!year || !month) {
      return res.status(400).json({ message: "year and month are required" });
    }

    const total = daysInMonth(year, month);
    const days = buildDays(year, month, total);

    const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
    const groups = [];
    for (const company of companies) {
      const employees = await employeesForMonth(company, year, month);
      if (!employees.length) continue; // skip companies with no one on payroll
      groups.push({
        companyId: company.id,
        companyName: company.name,
        locked: employees.length > 0 && employees.every((e) => e.locked),
        employees,
      });
    }

    res.json({ year, month, totalDays: total, days, statuses: STATUS, companies: groups });
  } catch (e) {
    next(e);
  }
};

// --- marking ---------------------------------------------------------------

/** One or many cells in a single call. Body: { companyId, cells:[{employeeId,date,status}] } */
exports.mark = async (req, res, next) => {
  try {
    const companyId = Number(req.body.companyId);
    const cells = Array.isArray(req.body.cells) ? req.body.cells : [];
    if (!companyId || !cells.length) {
      return res.status(400).json({ message: "companyId and at least one cell are required" });
    }

    const bad = cells.find((c) => !isValidStatus(c.status));
    if (bad) {
      return res.status(400).json({ message: `Unknown status "${bad.status}"` });
    }

    // block edits on months already finalised
    const lockedRows = await prisma.attendanceMonth.findMany({
      where: {
        companyId,
        locked: true,
        employeeId: { in: [...new Set(cells.map((c) => Number(c.employeeId)))] },
      },
    });
    const lockedEmp = new Set(lockedRows.map((r) => r.employeeId));

    const writes = cells
      .filter((c) => !lockedEmp.has(Number(c.employeeId)))
      .map((c) => {
        const date = new Date(`${c.date}T00:00:00.000Z`);
        return prisma.attendanceDay.upsert({
          where: {
            employeeId_date: { employeeId: Number(c.employeeId), date },
          },
          update: { status: c.status },
          create: {
            companyId,
            employeeId: Number(c.employeeId),
            date,
            status: c.status,
          },
        });
      });

    await prisma.$transaction(writes);

    res.json({
      ok: true,
      written: writes.length,
      skippedLocked: cells.length - writes.length,
    });
  } catch (e) {
    next(e);
  }
};

/** Clear a cell (unmark). Body: { employeeId, date } */
exports.clear = async (req, res, next) => {
  try {
    const employeeId = Number(req.body.employeeId);
    const date = new Date(`${req.body.date}T00:00:00.000Z`);
    await prisma.attendanceDay.deleteMany({ where: { employeeId, date } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

/** Wipe every mark for a company's month (except finalised employees). */
exports.clearMonth = async (req, res, next) => {
  try {
    const companyId = Number(req.body.companyId);
    const year = Number(req.body.year);
    const month = Number(req.body.month);
    if (!companyId || !year || !month) {
      return res.status(400).json({ message: "companyId, year and month are required" });
    }
    const { start, end } = monthRange(year, month);

    // don't touch employees whose month is finalised/locked
    const locked = await prisma.attendanceMonth.findMany({
      where: { companyId, year, month, locked: true },
      select: { employeeId: true },
    });
    const lockedIds = locked.map((l) => l.employeeId);

    const result = await prisma.attendanceDay.deleteMany({
      where: {
        companyId,
        date: { gte: start, lte: end },
        employeeId: lockedIds.length ? { notIn: lockedIds } : undefined,
      },
    });
    res.json({ ok: true, cleared: result.count });
  } catch (e) {
    next(e);
  }
};

/**
 * Bulk-import a month of attendance from CSV text.
 * Body: { companyId, year, month, csv }
 * CSV: first column is the employee code; any column whose header is a day
 * number (1..N) is that day's status. A "Name" column is ignored. Blank cells
 * are left unmarked. Statuses: P, A, WO, H, PL, HD (case-insensitive).
 */
exports.importCsv = async (req, res, next) => {
  try {
    const companyId = Number(req.body.companyId);
    const year = Number(req.body.year);
    const month = Number(req.body.month);
    const csv = String(req.body.csv || "");
    if (!companyId || !year || !month || !csv.trim()) {
      return res.status(400).json({ message: "companyId, year, month and csv are required" });
    }

    const total = daysInMonth(year, month);

    // tiny CSV parse — splits rows/commas, trims, strips surrounding quotes
    const rows = csv
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));

    if (rows.length < 2) {
      return res.status(400).json({ message: "The file has no data rows" });
    }

    const header = rows[0];
    // find the code column and map the day columns
    let codeCol = header.findIndex((h) => /code/i.test(h));
    if (codeCol < 0) codeCol = 0;
    const dayCols = [];
    header.forEach((h, i) => {
      const n = Number(h);
      if (Number.isInteger(n) && n >= 1 && n <= total) dayCols.push({ col: i, day: n });
    });
    if (!dayCols.length) {
      return res.status(400).json({
        message: "No day columns found. The header row needs day numbers (1, 2, 3 …).",
      });
    }

    // match employees by code within this company
    const roster = await rosterFor(companyId, year, month);
    const byCode = new Map(roster.map((e) => [String(e.employeeCode).toUpperCase(), e]));

    const locked = await prisma.attendanceMonth.findMany({
      where: { companyId, year, month, locked: true },
      select: { employeeId: true },
    });
    const lockedIds = new Set(locked.map((l) => l.employeeId));

    const cells = [];
    const unknownCodes = [];
    let invalid = 0;
    let skippedLocked = 0;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const code = (row[codeCol] || "").toUpperCase();
      if (!code) continue;
      const emp = byCode.get(code);
      if (!emp) { unknownCodes.push(row[codeCol]); continue; }
      if (lockedIds.has(emp.id)) { skippedLocked++; continue; }

      for (const { col, day } of dayCols) {
        let s = (row[col] || "").toUpperCase();
        if (!s || s === "-") continue;               // blank = leave unmarked
        if (!isValidStatus(s)) { invalid++; continue; }
        const date = new Date(Date.UTC(year, month - 1, day));
        cells.push({ employeeId: emp.id, date, status: s });
      }
    }

    if (cells.length) {
      await prisma.$transaction(
        cells.map((c) =>
          prisma.attendanceDay.upsert({
            where: { employeeId_date: { employeeId: c.employeeId, date: c.date } },
            update: { status: c.status },
            create: { companyId, employeeId: c.employeeId, date: c.date, status: c.status },
          })
        )
      );
    }

    res.json({
      ok: true,
      marks: cells.length,
      unknownCodes: [...new Set(unknownCodes)],
      invalidCells: invalid,
      skippedLocked,
    });
  } catch (e) {
    next(e);
  }
};

// --- overtime --------------------------------------------------------------

exports.setOt = async (req, res, next) => {
  try {
    const { companyId, employeeId, year, month } = req.body;
    const hours = Math.max(0, Number(req.body.hours) || 0);
    const row = await prisma.attendanceMonth.upsert({
      where: {
        employeeId_year_month: {
          employeeId: Number(employeeId),
          year: Number(year),
          month: Number(month),
        },
      },
      update: { otHours: hours },
      create: {
        companyId: Number(companyId),
        employeeId: Number(employeeId),
        year: Number(year),
        month: Number(month),
        otHours: hours,
      },
    });
    res.json({ employeeId: row.employeeId, otHours: row.otHours });
  } catch (e) {
    next(e);
  }
};

// --- prefill ---------------------------------------------------------------

/**
 * Fill every unmarked day for the month: weekly offs as WO, the rest as P.
 * Existing marks are never overwritten. Body: { companyId, year, month }
 */
exports.prefill = async (req, res, next) => {
  try {
    const companyId = Number(req.body.companyId);
    const year = Number(req.body.year);
    const month = Number(req.body.month);
    if (!companyId || !year || !month) {
      return res.status(400).json({ message: "companyId, year and month are required" });
    }

    const { start, end } = monthRange(year, month);
    const total = daysInMonth(year, month);

    const [roster, existing, locks] = await Promise.all([
      rosterFor(companyId, year, month),
      prisma.attendanceDay.findMany({
        where: { companyId, date: { gte: start, lte: end } },
        select: { employeeId: true, date: true },
      }),
      prisma.attendanceMonth.findMany({
        where: { companyId, year, month, locked: true },
        select: { employeeId: true },
      }),
    ]);

    const has = new Set(existing.map((r) => `${r.employeeId}:${iso(r.date)}`));
    const locked = new Set(locks.map((l) => l.employeeId));

    const rows = [];
    for (const e of roster) {
      if (locked.has(e.id)) continue;
      const offs = weeklyOffDays(e.weeklyOff);
      const joinedAt = e.doj ? iso(e.doj) : null;

      for (let d = 1; d <= total; d++) {
        const date = new Date(Date.UTC(year, month - 1, d));
        const key = `${e.id}:${iso(date)}`;
        if (has.has(key)) continue;
        // don't mark days before the employee joined
        if (joinedAt && iso(date) < joinedAt) continue;

        const status = offs.includes(date.getUTCDay()) ? "WO" : "P";
        rows.push({ companyId, employeeId: e.id, date, status });
      }
    }

    if (rows.length) {
      await prisma.attendanceDay.createMany({ data: rows, skipDuplicates: true });
    }

    res.json({ ok: true, filled: rows.length });
  } catch (e) {
    next(e);
  }
};

// --- lock ------------------------------------------------------------------

/** Finalise (or reopen) the month for the whole company. Body: { companyId, year, month, locked } */
exports.setLock = async (req, res, next) => {
  try {
    const companyId = Number(req.body.companyId);
    const year = Number(req.body.year);
    const month = Number(req.body.month);
    const locked = !!req.body.locked;

    const roster = await rosterFor(companyId, year, month);
    await prisma.$transaction(
      roster.map((e) =>
        prisma.attendanceMonth.upsert({
          where: { employeeId_year_month: { employeeId: e.id, year, month } },
          update: { locked },
          create: { companyId, employeeId: e.id, year, month, locked },
        })
      )
    );
    res.json({ ok: true, locked, employees: roster.length });
  } catch (e) {
    next(e);
  }
};

// --- payroll summary -------------------------------------------------------

/**
 * What the payslip run consumes. One row per employee for the month, with
 * payable days, LOP and OT. GET /api/attendance/summary?companyId&year&month
 */
exports.summary = async (req, res, next) => {
  try {
    const companyId = Number(req.query.companyId);
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!companyId || !year || !month) {
      return res.status(400).json({ message: "companyId, year and month are required" });
    }

    const { start, end } = monthRange(year, month);
    const [roster, records, months] = await Promise.all([
      rosterFor(companyId, year, month),
      prisma.attendanceDay.findMany({
        where: { companyId, date: { gte: start, lte: end } },
      }),
      prisma.attendanceMonth.findMany({ where: { companyId, year, month } }),
    ]);

    const byEmp = new Map();
    records.forEach((r) => {
      if (!byEmp.has(r.employeeId)) byEmp.set(r.employeeId, []);
      byEmp.get(r.employeeId).push({ date: iso(r.date), status: r.status });
    });
    const monthByEmp = new Map(months.map((m) => [m.employeeId, m]));

    const rows = roster.map((e) => {
      const extra = monthByEmp.get(e.id);
      const s = summarize(byEmp.get(e.id) || [], {
        year, month, otHours: extra?.otHours || 0,
      });
      return {
        employeeId: e.id,
        code: e.employeeCode,
        name: e.fullName,
        ...s,
        locked: extra?.locked || false,
      };
    });

    res.json({
      companyId, year, month,
      allComplete: rows.every((r) => r.complete),
      allLocked: rows.length > 0 && rows.every((r) => r.locked),
      employees: rows,
    });
  } catch (e) {
    next(e);
  }
};
