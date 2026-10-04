const path = require("path");
const archiver = require("archiver");
const prisma = require("../utils/prisma");
const { renderPayslip } = require("../utils/payslipPdf");

const UPLOADS = path.join(__dirname, "..", "uploads");
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const safe = (s) => String(s || "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

async function loadRun(companyId, year, month) {
  return prisma.payrollRun.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
    include: { payslips: { orderBy: { employeeId: "asc" } } },
  });
}

// --- list the payslips in a run --------------------------------------------

exports.list = async (req, res, next) => {
  try {
    const companyId = Number(req.query.companyId);
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!companyId || !year || !month) {
      return res.status(400).json({ message: "companyId, year and month are required" });
    }

    const run = await loadRun(companyId, year, month);
    if (!run) {
      return res.json({ exists: false, status: "none", employees: [] });
    }

    res.json({
      exists: true,
      runId: run.id,
      status: run.status,
      finalisedOn: iso(run.finalisedOn),
      paidOn: iso(run.paidOn),
      company: run.companySnapshot,
      totals: {
        employees: run.totalEmployees,
        gross: run.totalGross,
        net: run.totalNet,
      },
      employees: run.payslips.map((p) => ({
        payslipId: p.id,
        employeeId: p.employeeId,
        ...p.employeeSnapshot,
        payableDays: p.payableDays,
        lopDays: p.lopDays,
        grossEarned: p.grossEarned,
        totalDeductions: p.totalDeductions,
        netPay: p.netPay,
      })),
    });
  } catch (e) {
    next(e);
  }
};

// --- one payslip as PDF ----------------------------------------------------

exports.one = async (req, res, next) => {
  try {
    const payslip = await prisma.payslip.findUnique({
      where: { id: Number(req.params.payslipId) },
      include: { run: true },
    });
    if (!payslip) return res.status(404).json({ message: "Payslip not found" });

    const company = payslip.run.companySnapshot || {};
    const period = { year: payslip.run.year, month: payslip.run.month };
    const pdf = await renderPayslip(payslip, company, period, UPLOADS);

    const emp = payslip.employeeSnapshot || {};
    const name = `payslip-${safe(emp.code)}-${period.year}-${String(period.month).padStart(2, "0")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${req.query.download ? "attachment" : "inline"}; filename="${name}"`
    );
    res.send(pdf);
  } catch (e) {
    next(e);
  }
};

// --- all payslips in a run, zipped -----------------------------------------

exports.bulk = async (req, res, next) => {
  try {
    const companyId = Number(req.query.companyId);
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    const run = await loadRun(companyId, year, month);
    if (!run || !run.payslips.length) {
      return res.status(404).json({ message: "No payslips for this month" });
    }

    const company = run.companySnapshot || {};
    const period = { year, month };
    const zipName = `payslips-${safe(company.name)}-${year}-${String(month).padStart(2, "0")}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => next(err));
    archive.pipe(res);

    for (const p of run.payslips) {
      const pdf = await renderPayslip(p, company, period, UPLOADS);
      const emp = p.employeeSnapshot || {};
      archive.append(pdf, {
        name: `${safe(emp.code)}-${safe(emp.name)}.pdf`,
      });
    }

    archive.finalize();
  } catch (e) {
    next(e);
  }
};
