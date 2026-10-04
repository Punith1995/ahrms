import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, FileDown,
  AlertTriangle, RefreshCw, Building2, Banknote, Landmark, ClipboardList,
  CalendarDays, Users, TrendingUp,
} from "lucide-react";
import { reportApi, registersApi, employeeApi, errorText } from "../lib/api";
import { Button, Pill } from "../components/ui";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const money = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

// icon + one-line description per report id
const INFO = {
  bank: { icon: Banknote, blurb: "Employee-wise net with bank details and a grand total — submit to the bank.", pdf: true },
  "salary-register": { icon: ClipboardList, blurb: "Full earnings and deductions breakup for every employee.", pdf: true },
  pf: { icon: Landmark, blurb: "UAN-wise EPF wages and PF contributions for the return.", pdf: true },
  esi: { icon: Landmark, blurb: "IP-wise ESI wages and contributions for the return.", pdf: true },
  pt: { icon: Landmark, blurb: "Professional tax deducted, employee-wise.", pdf: true },
  attendance: { icon: CalendarDays, blurb: "Present, leave, LOP and payable days per employee.", pdf: true },
  "annual-salary": { icon: TrendingUp, blurb: "Month-wise net pay across the year, per employee.", pdf: true },
  "annual-pf": { icon: Landmark, blurb: "Month-wise PF contribution across the year.", pdf: true },
  "annual-esi": { icon: Landmark, blurb: "Month-wise ESI contribution across the year.", pdf: true },
  "annual-attendance": { icon: CalendarDays, blurb: "Month-wise payable days across the year.", pdf: true },
  headcount: { icon: Users, blurb: "Opening, joiners, exits and closing headcount by month.", pdf: true },
};

export default function Reports() {
  const outlet = useOutletContext() || {};
  const companyId = outlet.companyId ?? null;
  const companyName = outlet.company?.name || "";

  const now = new Date();
  const [scope, setScope] = useState("monthly");
  const [catalog, setCatalog] = useState({ monthly: [], annual: [] });
  const [type, setType] = useState("bank");
  const [year, setYear] = useState(
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  );
  const [month, setMonth] = useState(now.getMonth() === 0 ? 12 : now.getMonth());

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");

  // reports narrowed to one employee need a single company selected
  const individualOk = type !== "headcount" && !!companyId;
  // the value we send to the API: a company id, or "all" for consolidated
  const companyParam = companyId ?? "all";

  // load the company's employees for the individual filter
  useEffect(() => {
    if (!companyId) return setEmployees([]);
    employeeApi
      .list({ companyId })
      .then((rows) => setEmployees(rows || []))
      .catch(() => setEmployees([]));
    setEmployeeId("");
  }, [companyId]);

  // drop the employee filter if the report can't use it
  useEffect(() => {
    if (!individualOk && employeeId) setEmployeeId("");
  }, [individualOk]); // eslint-disable-line

  useEffect(() => {
    reportApi.catalog().then(setCatalog).catch(() => {});
  }, []);

  // keep the selected type valid when switching scope
  useEffect(() => {
    const list = catalog[scope] || [];
    if (list.length && !list.some((r) => r.id === type)) {
      setType(list[0].id);
    }
  }, [scope, catalog]); // eslint-disable-line

  const load = useCallback(async () => {
    if (!type) return;
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const params = { scope, type, companyId: companyParam, year };
      if (scope === "monthly") params.month = month;
      if (individualOk && employeeId) params.employeeId = employeeId;
      setReport(await reportApi.preview(params));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [companyParam, scope, type, year, month, employeeId, individualOk]);

  useEffect(() => {
    load();
  }, [load]);

  const exportParams = useMemo(() => {
    const p = { scope, type, companyId: companyParam, year };
    if (scope === "monthly") p.month = month;
    if (individualOk && employeeId) p.employeeId = employeeId;
    return p;
  }, [scope, type, companyParam, year, month, employeeId, individualOk]);

  function download(format) {
    window.open(reportApi.exportUrl({ ...exportParams, format }), "_blank");
  }

  function shiftMonth(delta) {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
  }

  const scopeName = companyName || "all companies";

  const [registers, setRegisters] = useState([]);
  useEffect(() => {
    registersApi.list().then(setRegisters).catch(() => setRegisters([]));
  }, []);

  const list = catalog[scope] || [];
  const info = INFO[type] || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-navy">Reports</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Statutory and management reports for {scopeName}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-slate-300 bg-white p-0.5">
            {[
              { id: "monthly", label: "Monthly" },
              { id: "annual", label: "Yearly" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setScope(t.id)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                  scope === t.id ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {scope === "monthly" ? (
            <div className="flex items-center rounded-md border border-slate-300 bg-white">
              <button onClick={() => shiftMonth(-1)} className="px-2 py-1.5 text-slate-500 hover:text-navy">
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-36 px-3 text-center text-sm font-medium text-navy">
                {MONTHS[month - 1]} {year}
              </span>
              <button onClick={() => shiftMonth(1)} className="px-2 py-1.5 text-slate-500 hover:text-navy">
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center rounded-md border border-slate-300 bg-white">
              <button onClick={() => setYear((y) => y - 1)} className="px-2 py-1.5 text-slate-500 hover:text-navy">
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-16 px-3 text-center text-sm font-medium text-navy">{year}</span>
              <button onClick={() => setYear((y) => y + 1)} className="px-2 py-1.5 text-slate-500 hover:text-navy">
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {individualOk && (
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="max-w-52 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-navy outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
              title="Filter the report to one employee"
            >
              <option value="">All employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName} · {e.employeeCode}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* report picker */}
        <div className="space-y-1.5">
          {list.map((r) => {
            const meta = INFO[r.id] || {};
            const Icon = meta.icon || FileText;
            const active = type === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setType(r.id)}
                className={`flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition ${
                  active
                    ? "border-navy bg-navy/5"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md ${
                  active ? "bg-navy text-amber" : "bg-slate-100 text-slate-500"
                }`}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-medium ${active ? "text-navy" : "text-slate-700"}`}>
                    {r.title}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">{meta.blurb}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* preview + exports */}
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
            <div className="text-sm">
              <span className="font-semibold text-navy">{report?.title || info.title || "Report"}</span>
              {report && (
                <span className="ml-2 text-slate-400">{report.rows.length} rows</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => download("xlsx")} disabled={!report}>
                <FileSpreadsheet size={14} /> Excel
              </Button>
              <Button variant="ghost" size="sm" onClick={() => download("csv")} disabled={!report}>
                <FileDown size={14} /> CSV
              </Button>
              <Button
                variant={info.icon === Banknote ? "accent" : "subtle"}
                size="sm"
                onClick={() => download("pdf")}
                disabled={!report}
              >
                <FileText size={14} /> PDF
              </Button>
            </div>
          </div>

          {error && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-5 py-4 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
              <AlertTriangle size={16} />
              <span>{error}</span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={load}>
                <RefreshCw size={13} /> Retry
              </Button>
            </div>
          )}

          {loading ? (
            <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
          ) : report ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="max-h-[65vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-navy text-left text-xs uppercase tracking-wide text-white">
                      {report.columns.map((c) => (
                        <th
                          key={c.key}
                          className={`whitespace-nowrap px-3 py-2.5 font-medium ${
                            c.align === "right" ? "text-right" : ""
                          }`}
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 odd:bg-slate-50/50">
                        {report.columns.map((c) => (
                          <td
                            key={c.key}
                            className={`whitespace-nowrap px-3 py-2 ${
                              c.align === "right" ? "text-right tabular-nums" : ""
                            } ${c.key === "name" ? "font-medium text-navy" : "text-slate-600"}`}
                          >
                            {c.type === "money"
                              ? money(row[c.key])
                              : row[c.key] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {report.rows.length === 0 && (
                      <tr>
                        <td colSpan={report.columns.length} className="px-5 py-12 text-center text-sm text-slate-400">
                          No data for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {report.rows.length > 0 && report.columns.some((c) => c.total) && (
                    <tfoot className="sticky bottom-0">
                      <tr className="border-t-2 border-slate-200 bg-amber-50 font-semibold text-navy">
                        {report.columns.map((c, i) => (
                          <td
                            key={c.key}
                            className={`whitespace-nowrap px-3 py-2.5 ${
                              c.align === "right" ? "text-right tabular-nums" : ""
                            }`}
                          >
                            {i === 0
                              ? "TOTAL"
                              : c.total
                              ? c.type === "money"
                                ? money(report.totals[c.key])
                                : Math.round((report.totals[c.key] || 0) * 100) / 100
                              : ""}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {report.bankTransfer && (
                <div className="flex items-center justify-between border-t border-slate-200 bg-navy px-5 py-3 text-white">
                  <span className="text-sm text-white/70">Total to transfer</span>
                  <span className="text-lg font-semibold tabular-nums text-amber">
                    {money(report.totals.net)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <FileText size={26} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-500">Select a report to preview it here.</p>
            </div>
          )}
        </div>
      </div>

      {/* statutory registers (Karnataka) */}
      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-navy">Statutory registers (Karnataka)</h2>
          <p className="text-xs text-slate-400">
            Legal-format Excel registers drawn from the finalised payroll for{" "}
            {companyId ? scopeName : "a company"} · {MONTHS[month - 1]} {year}.
          </p>
        </div>

        {!companyId ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            Pick a company from the top to download its statutory registers.
          </div>
        ) : registers.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">No registers available.</div>
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {registers.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-600">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div className="text-sm font-medium text-navy">{r.title}</div>
                </div>
                <a
                  href={registersApi.downloadUrl(r.id, { companyId, year, month })}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy transition hover:bg-slate-50"
                >
                  <Download size={13} /> Excel
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
