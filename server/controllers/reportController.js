const path = require("path");
const { buildReport, buildConsolidated, REPORT_CATALOG } = require("../utils/reportBuilders");
const { reportToExcel, reportToCsv } = require("../utils/reportExcel");
const { reportToPdf } = require("../utils/reportPdf");

const UPLOADS = path.join(__dirname, "..", "uploads");
const safe = (s) => String(s || "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

exports.catalog = (req, res) => res.json(REPORT_CATALOG);

function parseParams(q) {
  const allCompanies = !q.companyId || q.companyId === "all";
  return {
    scope: q.scope === "annual" ? "annual" : "monthly",
    type: q.type,
    allCompanies,
    companyId: allCompanies ? null : Number(q.companyId),
    year: Number(q.year),
    month: Number(q.month) || 1,
    employeeId: q.employeeId ? Number(q.employeeId) : null,
  };
}

// --- preview (JSON) --------------------------------------------------------

exports.preview = async (req, res, next) => {
  try {
    const p = parseParams(req.query);
    if (!p.type || !p.year || (!p.allCompanies && !p.companyId)) {
      return res.status(400).json({ message: "type and year are required" });
    }
    const report = p.allCompanies ? await buildConsolidated(p) : await buildReport(p);
    if (report.error) return res.status(404).json({ message: report.error });

    // strip the heavy meta.run before sending to the browser
    const { meta, ...rest } = report;
    res.json({ ...rest, bankTransfer: !!meta?.bankTransfer });
  } catch (e) {
    next(e);
  }
};

// --- export (file) ---------------------------------------------------------

exports.export = async (req, res, next) => {
  try {
    const p = parseParams(req.query);
    const format = (req.query.format || "xlsx").toLowerCase();
    if (!p.type || !p.year || (!p.allCompanies && !p.companyId)) {
      return res.status(400).json({ message: "type and year are required" });
    }

    const report = p.allCompanies ? await buildConsolidated(p) : await buildReport(p);
    if (report.error) return res.status(404).json({ message: report.error });

    const base = `${safe(report.company.name)}-${safe(report.title)}-${safe(report.periodLabel)}`;

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${base}.csv"`);
      return res.send(reportToCsv(report));
    }

    if (format === "pdf") {
      const pdf = await reportToPdf(report, UPLOADS);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${base}.pdf"`);
      return res.send(pdf);
    }

    // default: xlsx
    const buf = await reportToExcel(report);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${base}.xlsx"`);
    return res.send(Buffer.from(buf));
  } catch (e) {
    next(e);
  }
};
