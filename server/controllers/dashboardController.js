const prisma = require("../utils/prisma");
const { documentChecklist } = require("../utils/documentChecklist");

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);

const MANDATORY = documentChecklist.filter((d) => d.mandatory);

// licences in the registrations JSON that carry an expiry worth tracking
const EXPIRING_REGS = [
  { key: "shops", label: "Shops & Establishment" },
  { key: "factory", label: "Factory Licence" },
  { key: "clra", label: "Labour Licence (CLRA)" },
];

exports.overview = async (req, res, next) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const soon = new Date(now.getTime() + 60 * 86400000); // 60-day horizon

    const [companies, activeEmployees, joiners, exits, runs, held] = await Promise.all([
      prisma.company.findMany({ include: { documents: true }, orderBy: { name: "asc" } }),
      prisma.employee.findMany({
        where: { status: "Active", joiningStatus: "joined" },
        select: { companyId: true, ctcMonthly: true },
      }),
      prisma.employee.findMany({
        where: { joiningStatus: "in_progress" },
        include: { company: { select: { name: true } } },
        orderBy: { startedOn: "asc" },
      }),
      prisma.exit.findMany({
        where: { status: "in_progress" },
        include: {
          employee: { select: { fullName: true, employeeCode: true } },
          company: { select: { name: true } },
        },
        orderBy: { lastWorkingDay: "asc" },
      }),
      prisma.payrollRun.findMany({ where: { year, month } }),
      prisma.employee.findMany({
        where: { status: "Active", joiningStatus: "joined", salaryHold: true },
        include: { company: { select: { name: true } } },
        orderBy: { fullName: "asc" },
      }),
    ]);

    // --- per-company aggregates ---
    const headByCompany = new Map();
    const ctcByCompany = new Map();
    activeEmployees.forEach((e) => {
      headByCompany.set(e.companyId, (headByCompany.get(e.companyId) || 0) + 1);
      ctcByCompany.set(e.companyId, (ctcByCompany.get(e.companyId) || 0) + (e.ctcMonthly || 0));
    });
    const runByCompany = new Map(runs.map((r) => [r.companyId, r]));

    const expiringLicences = [];
    let companiesWithMissingDocs = 0;

    const companyRows = companies.map((c) => {
      const received = new Set(
        c.documents.filter((d) => d.status === "received").map((d) => d.docKey)
      );
      const missing = MANDATORY.filter((d) => !received.has(d.key));
      if (missing.length) companiesWithMissingDocs += 1;

      // expiring / expired licences
      const regs = c.registrations || {};
      EXPIRING_REGS.forEach((r) => {
        const till = regs?.[r.key]?.validTill;
        if (till) {
          const d = new Date(till);
          if (d <= soon) {
            expiringLicences.push({
              companyId: c.id,
              company: c.name,
              licence: r.label,
              validTill: iso(till),
              expired: d < now,
              daysLeft: daysBetween(now, till),
            });
          }
        }
      });

      const run = runByCompany.get(c.id);
      return {
        id: c.id,
        name: c.name,
        code: c.code,
        status: c.status,
        headcount: headByCompany.get(c.id) || 0,
        payrollCost: ctcByCompany.get(c.id) || 0,
        missingDocs: missing.length,
        payrollStatus: run?.status || "none",
        payrollNet: run?.totalNet || 0,
      };
    });

    expiringLicences.sort((a, b) => a.daysLeft - b.daysLeft);

    // --- practice totals ---
    const totalEmployees = activeEmployees.length;
    const totalPayrollCost = activeEmployees.reduce((s, e) => s + (e.ctcMonthly || 0), 0);
    const activeCompanies = companies.filter((c) => c.status === "Active").length;

    const payrollDone = companyRows.filter(
      (c) => c.payrollStatus === "finalised" || c.payrollStatus === "paid"
    ).length;
    const payrollPending = companyRows.filter(
      (c) => c.headcount > 0 && (c.payrollStatus === "none" || c.payrollStatus === "draft")
    );

    // --- attention lists ---
    const joinersList = joiners.map((j) => ({
      id: j.id,
      name: j.fullName,
      code: j.employeeCode,
      company: j.company?.name,
      stage: j.joiningStage,
      daysOpen: daysBetween(j.startedOn, now),
    }));

    const exitsList = exits.map((x) => ({
      id: x.id,
      name: x.employee?.fullName,
      code: x.employee?.employeeCode,
      company: x.company?.name,
      lastWorkingDay: iso(x.lastWorkingDay),
      daysLeft: x.lastWorkingDay ? daysBetween(now, x.lastWorkingDay) : null,
    }));

    res.json({
      asOf: iso(now),
      period: { year, month },
      totals: {
        companies: companies.length,
        activeCompanies,
        employees: totalEmployees,
        payrollCost: Math.round(totalPayrollCost),
        payrollDone,
        payrollTotal: companyRows.filter((c) => c.headcount > 0).length,
      },
      companies: companyRows,
      attention: {
        payrollPending,
        joiners: joinersList,
        exits: exitsList,
        expiringLicences,
        companiesWithMissingDocs,
        docAlerts: companyRows.filter((c) => c.missingDocs > 0),
        salaryHold: held.map((h) => ({
          id: h.id,
          name: h.fullName,
          code: h.employeeCode,
          company: h.company?.name,
          reason: h.salaryHoldReason || "",
        })),
      },
    });
  } catch (e) {
    next(e);
  }
};
