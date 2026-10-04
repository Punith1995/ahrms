const prisma = require("../utils/prisma");

/** GET /monthly-deductions?companyId&year&month
 *  Returns the active roster with each employee's saved amounts for the month. */
exports.list = async (req, res, next) => {
  try {
    const companyId = Number(req.query.companyId);
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!companyId || !year || !month) {
      return res.status(400).json({ message: "companyId, year and month are required" });
    }

    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    const [roster, saved] = await Promise.all([
      prisma.employee.findMany({
        where: { companyId, joiningStatus: "joined", status: "Active", doj: { lte: end } },
        orderBy: [{ department: "asc" }, { fullName: "asc" }],
        select: { id: true, employeeCode: true, fullName: true, department: true },
      }),
      prisma.monthlyDeduction.findMany({ where: { companyId, year, month } }),
    ]);
    const byEmp = new Map(saved.map((s) => [s.employeeId, s]));

    res.json({
      companyId, year, month,
      rows: roster.map((e) => {
        const d = byEmp.get(e.id);
        return {
          employeeId: e.id,
          code: e.employeeCode,
          name: e.fullName,
          department: e.department || "",
          food: d?.food || 0,
          transport: d?.transport || 0,
          uniform: d?.uniform || 0,
          loan: d?.loan || 0,
          advance: d?.advance || 0,
          note: d?.note || "",
        };
      }),
    });
  } catch (e) {
    next(e);
  }
};

/** POST /monthly-deductions  { companyId, year, month, rows: [{employeeId, food, transport, uniform, note}] }
 *  Upserts each row. A row that is all-zero and note-less is deleted. */
exports.save = async (req, res, next) => {
  try {
    const companyId = Number(req.body.companyId);
    const year = Number(req.body.year);
    const month = Number(req.body.month);
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!companyId || !year || !month) {
      return res.status(400).json({ message: "companyId, year and month are required" });
    }

    await prisma.$transaction(
      rows.map((r) => {
        const employeeId = Number(r.employeeId);
        const food = Math.max(0, Math.round(Number(r.food) || 0));
        const transport = Math.max(0, Math.round(Number(r.transport) || 0));
        const uniform = Math.max(0, Math.round(Number(r.uniform) || 0));
        const loan = Math.max(0, Math.round(Number(r.loan) || 0));
        const advance = Math.max(0, Math.round(Number(r.advance) || 0));
        const note = (r.note || "").trim();
        const empty = !food && !transport && !uniform && !loan && !advance && !note;

        if (empty) {
          return prisma.monthlyDeduction.deleteMany({
            where: { employeeId, year, month },
          });
        }
        return prisma.monthlyDeduction.upsert({
          where: { employeeId_year_month: { employeeId, year, month } },
          update: { food, transport, uniform, loan, advance, note },
          create: { companyId, employeeId, year, month, food, transport, uniform, loan, advance, note },
        });
      })
    );

    res.json({ ok: true, saved: rows.length });
  } catch (e) {
    next(e);
  }
};
