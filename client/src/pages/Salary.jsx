import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ChevronLeft, ChevronRight, ChevronDown, Play, Lock, Unlock, CheckCircle2, Search,
  AlertTriangle, RefreshCw, Building2, Download, Banknote, FileText, Loader2,
  Wallet, X,
} from "lucide-react";
import { payrollApi, monthlyDeductionApi, errorText } from "../lib/api";
import { Button, Pill } from "../components/ui";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const money = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

const EARN_LABELS = [
  ["basic", "Basic"], ["da", "Dearness allowance (DA)"], ["hra", "HRA"],
  ["conveyance", "Conveyance"], ["special", "Special allowance"],
  ["travel", "Travel allowance"], ["incentive", "Production incentive"],
  ["medical", "Medical allowance"], ["other", "Other allowance"],
  ["overtime", "Overtime"], ["compOff", "Comp-off"], ["elEncashment", "Leave encashment (EL)"],
];
const DED_LABELS = [
  ["pf", "Provident Fund"], ["esi", "ESI"], ["professionalTax", "Professional Tax"],
  ["lwf", "Labour Welfare Fund"], ["food", "Food"],
  ["transport", "Transportation"], ["uniform", "Uniform / Shoe"],
  ["loan", "Loan recovery"], ["advance", "Advance recovery"],
];
const earnItems = (e = {}) => [
  ...EARN_LABELS.filter(([k]) => e[k]).map(([k, l]) => [l, e[k]]),
  ...(e.extraAllowances || []).filter((a) => a.amount).map((a) => [a.type, a.amount]),
];
const dedItems = (d = {}) => DED_LABELS.filter(([k]) => d[k]).map(([k, l]) => [l, d[k]]);
const initials = (name) =>
  (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const STATUS_META = {
  none: { tone: "slate", label: "Not run" },
  draft: { tone: "amber", label: "Draft" },
  finalised: { tone: "navy", label: "Finalised" },
  paid: { tone: "green", label: "Paid" },
};

export default function Salary() {
  const outlet = useOutletContext() || {};
  const companyId = outlet.companyId ?? null; // null = all companies
  const companies = outlet.companies || [];
  const navigate = useNavigate();

  const now = new Date();
  const [year, setYear] = useState(
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  );
  const [month, setMonth] = useState(now.getMonth() === 0 ? 12 : now.getMonth());

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
          <h1 className="text-2xl font-bold tracking-tight text-navy">Salary</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {companyId
              ? "Monthly payroll register — run, finalise and export the bank file."
              : "All clients — run and finalise each company's payroll for the month."}
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
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-400">
            <Building2 size={22} />
          </div>
          <p className="text-sm font-medium text-slate-700">No companies with employees yet</p>
          <p className="mt-1 text-xs text-slate-400">Complete a joining, then run payroll here.</p>
        </div>
      ) : (
        boards.map((c) => (
          <PayrollBoard
            key={c.id}
            companyId={c.id}
            companyName={c.name}
            year={year}
            month={month}
            navigate={navigate}
          />
        ))
      )}
    </div>
  );
}

/* --------------------------------------------------- one company's payroll */

function PayrollBoard({ companyId, companyName, year, month, navigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [mdOpen, setMdOpen] = useState(false);
  const [openEmp, setOpenEmp] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setData(await payrollApi.preview(companyId, year, month));
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [companyId, year, month]);

  useEffect(() => { load(); }, [load]);

  const status = data?.run?.status || "none";
  const meta = STATUS_META[status];
  const editable = status === "none" || status === "draft";

  const lines = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.lines;
    return data.lines.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q) ||
        (l.department || "").toLowerCase().includes(q)
    );
  }, [data, query]);

  const heldCount = (data?.lines || []).filter((l) => l.onHold).length;

  async function act(kind, fn, successMsg) {
    setBusy(kind);
    try {
      const r = await fn();
      if (r?.warnings?.length) r.warnings.forEach((w) => toast(w, { icon: "⚠️" }));
      if (successMsg) toast.success(successMsg);
      await load();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy("");
    }
  }

  function exportBankFile() {
    const rows = (data?.lines || []).filter((l) => l.netPay > 0 && !l.onHold);
    if (!rows.length) return toast.error("Nothing to export");
    const headers = ["Employee code", "Name", "Bank account", "IFSC", "Net amount", "Remarks"];
    const body = rows.map((l) =>
      [l.code, l.name, l.bankAccountNo, l.bankIfsc, Math.round(l.netPay),
        `Salary ${MONTHS[month - 1]} ${year}`]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const total = rows.reduce((s, l) => s + Math.round(l.netPay), 0);
    body.push(`"","","","TOTAL","${total}",""`);
    const blob = new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bank-transfer-${companyName.replace(/\s+/g, "-")}-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* header: company + status + totals */}
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
            {data && (
              <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                <span><b className="text-slate-700">{data.totals.employees}</b> staff</span>
                <span>gross {money(data.totals.gross)}</span>
                <span>ded {money(data.totals.deductions)}</span>
                <span className="text-navy">net <b>{money(data.totals.net)}</b></span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <Button variant="ghost" size="sm" onClick={() => setMdOpen(true)}>
              <Wallet size={14} /> Deductions
            </Button>
          )}
          {editable && (
            <Button variant="accent" size="sm"
              onClick={() => act("run", () => payrollApi.run(companyId, year, month),
                status === "draft" ? "Payroll recalculated" : "Payroll run")}
              disabled={busy === "run"}>
              {busy === "run" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {status === "draft" ? "Re-run" : "Run payroll"}
            </Button>
          )}
          {status === "draft" && (
            <Button variant="primary" size="sm"
              onClick={() => act("finalise", () => payrollApi.finalise(companyId, year, month), "Payroll finalised")}
              disabled={busy === "finalise"}>
              <Lock size={14} /> Finalise
            </Button>
          )}
          {status === "finalised" && (
            <>
              <Button variant="primary" size="sm"
                onClick={() => act("paid", () => payrollApi.markPaid(companyId, year, month), "Marked as paid")}
                disabled={busy === "paid"}>
                <Banknote size={14} /> Mark paid
              </Button>
              <Button variant="ghost" size="sm"
                onClick={() => act("reopen", () => payrollApi.reopen(companyId, year, month), "Reopened")}
                disabled={busy === "reopen"}>
                <Unlock size={14} /> Reopen
              </Button>
            </>
          )}
          {(status === "finalised" || status === "paid") && (
            <Button variant="ghost" size="sm" onClick={() => navigate("/payslips")}>
              <FileText size={14} /> Payslips
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={exportBankFile} disabled={!data?.lines?.length}>
            <Download size={14} /> Bank file
          </Button>
        </div>
      </div>

      {loadError ? (
        <div className="flex items-center gap-3 px-5 py-4 text-sm text-rose-700">
          <AlertTriangle size={16} /> {loadError}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={load}>
            <RefreshCw size={13} /> Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="m-4 h-40 animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <>
          {/* attendance gate + hold note */}
          {data && !data.attendanceReady && editable && (
            <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-2.5 text-xs text-amber-900">
              <AlertTriangle size={14} className="shrink-0" />
              <span>Attendance isn't complete — pay for unmarked days may be understated.</span>
              <button onClick={() => navigate("/attendance")} className="ml-auto shrink-0 font-medium underline underline-offset-2">
                Open attendance
              </button>
            </div>
          )}
          {heldCount > 0 && (
            <div className="border-b border-rose-100 bg-rose-50 px-5 py-2.5 text-xs text-rose-700">
              {heldCount} employee(s) on salary hold appear here but are left out of the bank file.
            </div>
          )}

          {/* search */}
          {data?.lines?.length > 0 && (
            <div className="border-b border-slate-100 px-5 py-2.5">
              <div className="relative max-w-xs">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search employee"
                  className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
                />
              </div>
            </div>
          )}

          {/* register */}
          {lines.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 font-semibold">Employee</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Pay days</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Basic</th>
                    <th className="px-3 py-2.5 text-right font-semibold">HRA</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Allow.</th>
                    <th className="px-3 py-2.5 text-right font-semibold">OT</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Gross</th>
                    <th className="px-3 py-2.5 text-right font-semibold">PF</th>
                    <th className="px-3 py-2.5 text-right font-semibold">ESI</th>
                    <th className="px-3 py-2.5 text-right font-semibold">PT</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Net pay</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <Fragment key={l.employeeId}>
                    <tr
                      onClick={() => setOpenEmp(openEmp === l.employeeId ? null : l.employeeId)}
                      className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            size={14}
                            className={`shrink-0 text-slate-400 transition ${openEmp === l.employeeId ? "rotate-180" : ""}`}
                          />
                          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy/10 text-[10px] font-bold text-navy">
                            {initials(l.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-navy">{l.name}</span>
                              {l.onHold && <Pill tone="red">Held</Pill>}
                            </div>
                            <div className="text-xs text-slate-400">
                              {l.code}{l.department ? ` · ${l.department}` : ""}
                              {!l.attendanceComplete && <span className="ml-2 text-amber-600">{l.unmarked} unmarked</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">
                        <span className="text-slate-700">{l.payableDays}</span>
                        <span className="text-slate-400">/{l.totalDays}</span>
                        {l.lopDays > 0 && <div className="text-xs text-rose-500">-{l.lopDays} LOP</div>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{money(l.earnings.basic)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{money(l.earnings.hra)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{money(l.earnings.conveyance + l.earnings.special)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-amber-600">{l.earnings.overtime ? money(l.earnings.overtime) : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-800">{money(l.grossEarned)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{l.deductions.pf ? money(l.deductions.pf) : "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{l.deductions.esi ? money(l.deductions.esi) : "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{l.deductions.professionalTax ? money(l.deductions.professionalTax) : "—"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-navy">
                        {l.onHold ? <span className="text-slate-400 line-through">{money(l.netPay)}</span> : money(l.netPay)}
                      </td>
                    </tr>
                    {openEmp === l.employeeId && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={11} className="px-6 py-3">
                          <div className="grid gap-5 sm:grid-cols-2">
                            <div>
                              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Earnings</div>
                              <div className="space-y-1 text-xs">
                                {earnItems(l.earnings).map(([label, amt]) => (
                                  <div key={label} className="flex justify-between gap-4">
                                    <span className="text-slate-500">{label}</span>
                                    <span className="tabular-nums text-slate-700">{money(amt)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between gap-4 border-t border-slate-200 pt-1 font-medium text-navy">
                                  <span>Gross earnings</span><span className="tabular-nums">{money(l.grossEarned)}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Deductions</div>
                              <div className="space-y-1 text-xs">
                                {dedItems(l.deductions).length === 0 && <div className="text-slate-400">No deductions</div>}
                                {dedItems(l.deductions).map(([label, amt]) => (
                                  <div key={label} className="flex justify-between gap-4">
                                    <span className="text-slate-500">{label}</span>
                                    <span className="tabular-nums text-slate-700">{money(amt)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between gap-4 border-t border-slate-200 pt-1 font-medium text-slate-700">
                                  <span>Total deductions</span><span className="tabular-nums">{money(l.deductions.total)}</span>
                                </div>
                                <div className="flex justify-between gap-4 font-semibold text-navy">
                                  <span>Net pay</span><span className="tabular-nums">{money(l.netPay)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-navy">
                    <td className="px-4 py-2.5" colSpan={6}>Total · {lines.length} employees</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(lines.reduce((s, l) => s + l.grossEarned, 0))}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{money(lines.reduce((s, l) => s + l.deductions.pf, 0))}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{money(lines.reduce((s, l) => s + l.deductions.esi, 0))}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{money(lines.reduce((s, l) => s + l.deductions.professionalTax, 0))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-navy">{money(lines.reduce((s, l) => s + l.netPay, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              {data?.lines?.length ? "No employee matches your search." : "No active employees to pay yet."}
            </div>
          )}

          {status === "paid" && data?.run?.paidOn && (
            <div className="flex items-center gap-2 border-t border-emerald-100 bg-emerald-50 px-5 py-2.5 text-xs text-emerald-800">
              <CheckCircle2 size={14} /> Salaries marked paid on {data.run.paidOn}.
            </div>
          )}
        </>
      )}
      {mdOpen && (
        <MonthlyDeductionsModal
          companyId={companyId}
          companyName={companyName}
          year={year}
          month={month}
          onClose={() => setMdOpen(false)}
          onSaved={() => { setMdOpen(false); load(); }}
        />
      )}
    </section>
  );
}

function MonthlyDeductionsModal({ companyId, companyName, year, month, onClose, onSaved }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await monthlyDeductionApi.list(companyId, year, month);
        if (alive) setRows(data.rows);
      } catch (e) {
        toast.error(errorText(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [companyId, year, month]);

  function setCell(employeeId, key, value) {
    setRows((rs) => rs.map((r) => (r.employeeId === employeeId ? { ...r, [key]: value } : r)));
  }

  async function save() {
    setSaving(true);
    try {
      await monthlyDeductionApi.save(
        companyId, year, month,
        rows.map((r) => ({
          employeeId: r.employeeId,
          food: Number(r.food) || 0,
          transport: Number(r.transport) || 0,
          uniform: Number(r.uniform) || 0,
          note: r.note || "",
        }))
      );
      toast.success("Monthly deductions saved — re-run payroll to apply");
      onSaved();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  const shown = (rows || []).filter(
    (r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.code.toLowerCase().includes(q.toLowerCase())
  );
  const num = "w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-navy focus:ring-2 focus:ring-navy/15 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
              <Wallet size={16} /> Monthly deductions — {companyName}
            </h2>
            <p className="text-xs text-slate-400">{MONTHS[month - 1]} {year} · amounts apply only to this month</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </header>

        <div className="border-b border-slate-100 px-5 py-2.5">
          <div className="relative max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employee"
              className="w-full rounded-md border border-slate-300 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="grid place-items-center py-16 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Employee</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Food</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Transport</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Uniform / Shoe</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Loan</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Advance</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.employeeId} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-2">
                      <div className="font-medium text-navy">{r.name}</div>
                      <div className="text-xs text-slate-400">{r.code}{r.department ? ` · ${r.department}` : ""}</div>
                    </td>
                    {["food", "transport", "uniform", "loan", "advance"].map((k) => (
                      <td key={k} className="px-3 py-2 text-right">
                        <input type="number" min={0} value={r[k] || ""} placeholder="0"
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) => setCell(r.employeeId, k, e.target.value)} className={num} />
                      </td>
                    ))}
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">No employees.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <span className="text-xs text-slate-400">Leave a cell blank or 0 for no deduction that month.</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="accent" size="sm" onClick={save} disabled={saving || loading}>
              {saving ? "Saving…" : "Save deductions"}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
