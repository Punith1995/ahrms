import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Search, Download, Eye, FileText, X,
  AlertTriangle, RefreshCw, Building2, Package, Lock,
} from "lucide-react";
import { payslipApi, errorText } from "../lib/api";
import { Button, Pill } from "../components/ui";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const money = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const initials = (name) =>
  (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const STATUS_META = {
  none: { tone: "slate", label: "Not run" },
  draft: { tone: "amber", label: "Draft" },
  finalised: { tone: "navy", label: "Finalised" },
  paid: { tone: "green", label: "Paid" },
};

export default function Payslips() {
  const outlet = useOutletContext() || {};
  const companyId = outlet.companyId ?? null; // null = all companies
  const companies = outlet.companies || [];
  const navigate = useNavigate();

  const now = new Date();
  const [year, setYear] = useState(
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  );
  const [month, setMonth] = useState(now.getMonth() === 0 ? 12 : now.getMonth());
  const [preview, setPreview] = useState(null); // shared drawer { payslipId, name }

  function shiftMonth(delta) {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
  }

  const boards = useMemo(() => {
    if (companyId) {
      const c = companies.find((x) => x.id === companyId);
      return c ? [c] : [{ id: companyId, name: outlet.company?.name || "" }];
    }
    return companies.filter((c) => (c.headcount ?? 1) > 0);
  }, [companyId, companies, outlet.company]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Payslips</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {companyId
              ? "Branded payslips drawn from the finalised payroll."
              : "All clients — every company's payslips for the month, in one place."}
          </p>
        </div>
        <div className="flex items-center overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
          <button onClick={() => shiftMonth(-1)} className="px-2.5 py-2 text-slate-500 transition hover:bg-slate-50 hover:text-navy">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-40 px-3 text-center text-sm font-semibold text-navy">
            {MONTHS[month - 1]} {year}
          </span>
          <button onClick={() => shiftMonth(1)} className="px-2.5 py-2 text-slate-500 transition hover:bg-slate-50 hover:text-navy">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {boards.length === 0 ? (
        <Empty title="No companies with employees yet" sub="Run payroll for a company, then its payslips appear here." />
      ) : (
        boards.map((c) => (
          <PayslipBoard
            key={c.id}
            companyId={c.id}
            companyName={c.name}
            year={year}
            month={month}
            navigate={navigate}
            onPreview={setPreview}
          />
        ))
      )}

      {/* shared preview drawer */}
      {preview && (
        <div className="fixed inset-0 z-50 flex justify-end bg-navy/40" onClick={() => setPreview(null)}>
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-navy">
                <FileText size={16} /> {preview.name} — payslip
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost"
                  onClick={() => window.open(payslipApi.pdfUrl(preview.payslipId, true), "_blank")}>
                  <Download size={13} /> Download
                </Button>
                <button onClick={() => setPreview(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
            </header>
            <iframe title="payslip" src={payslipApi.pdfUrl(preview.payslipId)} className="flex-1" />
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------- one company's payslips */

function PayslipBoard({ companyId, companyName, year, month, navigate, onPreview }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setData(await payslipApi.list(companyId, year, month));
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [companyId, year, month]);

  useEffect(() => { load(); }, [load]);

  const status = data?.exists ? data.status : "none";
  const meta = STATUS_META[status];

  const list = useMemo(() => {
    if (!data?.employees) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.employees;
    return data.employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        (e.department || "").toLowerCase().includes(q)
    );
  }, [data, query]);

  function downloadBulk() {
    window.open(payslipApi.bulkUrl(companyId, year, month), "_blank");
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-navy/10 text-xs font-bold text-navy">
            {initials(companyName)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-navy">{companyName}</h2>
              <Pill tone={meta.tone}>{meta.label}</Pill>
            </div>
            {data?.exists && (
              <div className="mt-0.5 text-xs text-slate-500">
                <b className="text-slate-700">{data.totals.employees}</b> payslips · net{" "}
                <b className="text-navy">{money(data.totals.net)}</b>
              </div>
            )}
          </div>
        </div>
        {data?.exists && (
          <div className="flex items-center gap-2">
            <div className="relative w-44">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
              />
            </div>
            
          </div>
        )}
      </div>

      {loadError ? (
        <div className="flex items-center gap-3 px-5 py-4 text-sm text-rose-700">
          <AlertTriangle size={16} /> {loadError}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={load}>
            <RefreshCw size={13} /> Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="m-4 h-32 animate-pulse rounded-xl bg-slate-100" />
      ) : !data?.exists ? (
        <div className="flex flex-wrap items-center gap-2 px-5 py-8 text-center text-sm text-slate-400">
          <div className="mx-auto">
            <FileText size={22} className="mx-auto mb-2 text-slate-300" />
            No payroll run for {MONTHS[month - 1]} {year}.{" "}
            <button onClick={() => navigate("/salary")} className="font-medium text-navy underline">
              Run it in Salary
            </button>
          </div>
        </div>
      ) : (
        <>
          {status === "draft" && (
            <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-2.5 text-xs text-amber-900">
              <AlertTriangle size={14} className="shrink-0" />
              <span>Payroll is still a draft — preview is fine, but finalise before sending these out.</span>
              <button onClick={() => navigate("/salary")} className="ml-auto shrink-0 font-medium underline underline-offset-2">
                Finalise
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2.5 font-semibold">Employee</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Paid days</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Gross</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Deductions</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Net pay</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Payslip</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.payslipId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy/10 text-[11px] font-bold text-navy">
                          {initials(e.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-navy">{e.name}</div>
                          <div className="truncate text-xs text-slate-400">
                            {e.code}{e.department ? ` · ${e.department}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center tabular-nums text-slate-600">
                      {e.payableDays}
                      {e.lopDays > 0 && <span className="ml-1 text-xs text-rose-500">-{e.lopDays}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{money(e.grossEarned)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{money(e.totalDeductions)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-navy">{money(e.netPay)}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => onPreview({ payslipId: e.payslipId, name: e.name })}>
                          <Eye size={13} /> View
                        </Button>
                        <Button size="sm" variant="subtle" onClick={() => window.open(payslipApi.pdfUrl(e.payslipId, true), "_blank")}>
                          <Download size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                      No employee matches your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Empty({ title, sub }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-400">
        <Building2 size={22} />
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  );
}
