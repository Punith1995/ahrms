import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ChevronLeft, ChevronRight, Wand2, Lock, Unlock, AlertTriangle,
  RefreshCw, Building2, Check, Users, CalendarDays, Clock, TrendingDown,
  IndianRupee, Eraser, Upload, Download, X, FileSpreadsheet, Loader2,
} from "lucide-react";
import { attendanceApi, errorText } from "../lib/api";
import { Button, Pill } from "../components/ui";

const STATUS = {
  P:  { label: "Present",    cell: "bg-emerald-500 text-white",   dot: "bg-emerald-500" },
  A:  { label: "Absent/LOP", cell: "bg-rose-500 text-white",      dot: "bg-rose-500" },
  PL: { label: "Paid leave", cell: "bg-sky-500 text-white",       dot: "bg-sky-500" },
  HD: { label: "Half day",   cell: "bg-amber-400 text-amber-950", dot: "bg-amber-400" },
  WO: { label: "Weekly off", cell: "bg-slate-300 text-slate-700", dot: "bg-slate-400" },
  H:  { label: "Holiday",    cell: "bg-violet-500 text-white",    dot: "bg-violet-500" },
  CO: { label: "Comp-off",   cell: "bg-teal-600 text-white",      dot: "bg-teal-600" },
};
const ORDER = ["P", "A", "PL", "HD", "WO", "H", "CO"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const TODAY = new Date().toISOString().slice(0, 10);
const money = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const initials = (name) =>
  (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export default function Attendance() {
  const outlet = useOutletContext() || {};
  const companyId = outlet.companyId ?? null; // null = all companies
  const companies = outlet.companies || [];

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [brush, setBrush] = useState("P");
  const painting = useRef(false);

  useEffect(() => {
    const up = () => (painting.current = false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  function shiftMonth(delta) {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
  }

  // which companies to show: the selected one, or every client with people
  const boards = useMemo(() => {
    if (companyId) {
      const c = companies.find((x) => x.id === companyId);
      return c ? [c] : [{ id: companyId, name: outlet.company?.name || "" }];
    }
    return companies.filter((c) => (c.headcount ?? 1) > 0);
  }, [companyId, companies, outlet.company]);

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Attendance</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {companyId
              ? "Monthly register — this drives payable days and OT on the payslip."
              : "All clients — every company's muster for the month, in one place."}
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

      {/* shared brush toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mark as</span>
          {ORDER.map((code) => {
            const active = brush === code;
            return (
              <button
                key={code}
                onClick={() => setBrush(code)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? `${STATUS[code].cell} shadow-sm ring-2 ring-offset-1 ring-navy/30`
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {!active && <span className={`h-2.5 w-2.5 rounded-full ${STATUS[code].dot}`} />}
                <span>{code}</span>
                <span className="hidden sm:inline">{STATUS[code].label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setBrush("CLEAR")}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              brush === "CLEAR"
                ? "bg-slate-700 text-white shadow-sm ring-2 ring-offset-1 ring-navy/30"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
            title="Erase marks — click or drag over cells to clear them"
          >
            <Eraser size={13} /> Erase
          </button>
          <span className="ml-auto text-xs text-slate-400">
            {brush === "CLEAR"
              ? "Click or drag over cells to clear them."
              : "Click a cell or drag across a row to mark. Click a date to fill the day."}
          </span>
        </div>
      </div>

      {boards.length === 0 ? (
        <Empty icon={Building2} title="No companies with employees yet"
          sub="Add a company and complete a joining to start marking attendance." />
      ) : (
        boards.map((c) => (
          <CompanyBoard
            key={c.id}
            companyId={c.id}
            companyName={c.name}
            year={year}
            month={month}
            brush={brush}
            painting={painting}
            solo={!!companyId}
          />
        ))
      )}
    </div>
  );
}

/* ------------------------------------------------------ one company board */

function CompanyBoard({ companyId, companyName, year, month, brush, painting, solo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await attendanceApi.month(companyId, year, month));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [companyId, year, month]);

  useEffect(() => { load(); }, [load]);

  const locked = useMemo(
    () => !!data?.employees?.length && data.employees.every((e) => e.locked),
    [data]
  );

  const totals = useMemo(() => {
    if (!data) return null;
    const t = { payable: 0, lop: 0, otHours: 0, otPay: 0, unmarked: 0 };
    data.employees.forEach((e) => {
      t.payable += e.summary.payableDays;
      t.lop += e.summary.lopDays;
      t.otHours += e.otHours;
      t.otPay += e.otAmount || 0;
      t.unmarked += e.summary.unmarked;
    });
    return t;
  }, [data]);

  function applyLocal(updater) {
    setData((d) => {
      if (!d) return d;
      const next = { ...d, employees: d.employees.map((e) => ({ ...e })) };
      updater(next);
      return next;
    });
  }

  const recomputeRow = (emp) => {
    const c = { P: 0, A: 0, WO: 0, H: 0, PL: 0, HD: 0 };
    Object.values(emp.marks).forEach((s) => c[s] !== undefined && (c[s] += 1));
    const marked = c.P + c.A + c.WO + c.H + c.PL + c.HD;
    emp.summary = {
      ...emp.summary,
      payableDays: Math.round((c.P + c.WO + c.H + c.PL + c.HD * 0.5) * 100) / 100,
      lopDays: Math.round((c.A + c.HD * 0.5) * 100) / 100,
      unmarked: Math.max(0, emp.summary.totalDays - marked),
      complete: emp.summary.totalDays - marked === 0,
    };
  };

  const clearing = brush === "CLEAR";

  async function paintCell(emp, date) {
    if (emp.locked || locked) return;

    if (clearing) {
      if (!emp.marks[date]) return; // nothing to clear
      applyLocal((d) => {
        const e = d.employees.find((x) => x.id === emp.id);
        const next = { ...e.marks };
        delete next[date];
        e.marks = next;
        recomputeRow(e);
      });
      try {
        await attendanceApi.clear(emp.id, date);
      } catch (e) {
        toast.error(errorText(e));
        load();
      }
      return;
    }

    if (emp.marks[date] === brush) return;
    applyLocal((d) => {
      const e = d.employees.find((x) => x.id === emp.id);
      e.marks = { ...e.marks, [date]: brush };
      recomputeRow(e);
    });
    try {
      await attendanceApi.mark(companyId, [{ employeeId: emp.id, date, status: brush }]);
    } catch (e) {
      toast.error(errorText(e));
      load();
    }
  }

  async function fillColumn(date) {
    if (locked) return;
    const targets = data.employees.filter((e) => !e.locked);
    if (!targets.length) return;

    if (clearing) {
      applyLocal((d) => {
        d.employees.forEach((e) => {
          if (e.locked || !e.marks[date]) return;
          const next = { ...e.marks };
          delete next[date];
          e.marks = next;
          recomputeRow(e);
        });
      });
      try {
        await Promise.all(
          targets.filter((e) => e.marks[date]).map((e) => attendanceApi.clear(e.id, date))
        );
      } catch (e) { toast.error(errorText(e)); load(); }
      return;
    }

    const cells = targets.map((e) => ({ employeeId: e.id, date, status: brush }));
    applyLocal((d) => {
      d.employees.forEach((e) => {
        if (e.locked) return;
        e.marks = { ...e.marks, [date]: brush };
        recomputeRow(e);
      });
    });
    try {
      await attendanceApi.mark(companyId, cells);
    } catch (e) { toast.error(errorText(e)); load(); }
  }

  async function fillRow(emp) {
    if (emp.locked || locked) return;

    if (clearing) {
      const dates = data.days.map((d) => d.date).filter((dt) => emp.marks[dt]);
      applyLocal((d) => {
        const e = d.employees.find((x) => x.id === emp.id);
        e.marks = {};
        recomputeRow(e);
      });
      try {
        await Promise.all(dates.map((dt) => attendanceApi.clear(emp.id, dt)));
        toast.success(`${emp.name} cleared`);
      } catch (e) { toast.error(errorText(e)); load(); }
      return;
    }

    const cells = data.days.map((d) => ({ employeeId: emp.id, date: d.date, status: brush }));
    applyLocal((d) => {
      const e = d.employees.find((x) => x.id === emp.id);
      data.days.forEach((day) => (e.marks[day.date] = brush));
      e.marks = { ...e.marks };
      recomputeRow(e);
    });
    try {
      await attendanceApi.mark(companyId, cells);
      toast.success(`${emp.name} set to ${STATUS[brush].label}`);
    } catch (e) { toast.error(errorText(e)); load(); }
  }

  async function clearAll() {
    if (!window.confirm(`Clear all attendance for ${companyName} in this month? You can re-enter it after.`)) return;
    setBusy(true);
    try {
      const r = await attendanceApi.clearMonth(companyId, year, month);
      toast.success(r.cleared ? `Cleared ${r.cleared} marks` : "Nothing to clear");
      await load();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    if (!data) return;
    const header = ["Employee Code", "Name", ...data.days.map((d) => d.day)];
    const body = data.employees.map((e) => [e.code, e.name, ...data.days.map(() => "")]);
    const csv = [header, ...body]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-template-${companyName.replace(/\s+/g, "-")}-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const r = await attendanceApi.importCsv(companyId, year, month, text);
      let msg = `Imported ${r.marks} mark${r.marks === 1 ? "" : "s"}`;
      const notes = [];
      if (r.unknownCodes?.length) notes.push(`${r.unknownCodes.length} unknown code(s) skipped`);
      if (r.invalidCells) notes.push(`${r.invalidCells} invalid cell(s)`);
      if (r.skippedLocked) notes.push(`${r.skippedLocked} finalised employee(s) skipped`);
      if (notes.length) msg += ` · ${notes.join(" · ")}`;
      toast.success(msg);
      setImportOpen(false);
      await load();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setImporting(false);
    }
  }

  async function setOt(emp, hours) {
    applyLocal((d) => {
      const e = d.employees.find((x) => x.id === emp.id);
      e.otHours = hours;
      e.otAmount = Math.round(hours * (e.otRate || 0));
    });
    try {
      await attendanceApi.setOt(companyId, emp.id, year, month, hours);
    } catch (e) { toast.error(errorText(e)); }
  }

  async function prefill() {
    setBusy(true);
    try {
      const r = await attendanceApi.prefill(companyId, year, month);
      toast.success(r.filled ? `Filled ${r.filled} open days` : "Nothing left to fill");
      await load();
    } catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); }
  }

  async function toggleLock() {
    const next = !locked;
    if (next && totals?.unmarked > 0 &&
        !window.confirm(`${totals.unmarked} day(s) unmarked. Finalise anyway?`)) return;
    setBusy(true);
    try {
      await attendanceApi.lock(companyId, year, month, next);
      toast.success(next ? "Month finalised" : "Month reopened");
      await load();
    } catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* company header + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-navy/10 text-xs font-bold text-navy">
            {initials(companyName)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-navy">{companyName}</h2>
              {locked && <Pill tone="slate"><Lock size={10} /> finalised</Pill>}
              {totals && (totals.unmarked > 0
                ? <Pill tone="amber">{totals.unmarked} unmarked</Pill>
                : <Pill tone="green"><Check size={10} /> complete</Pill>)}
            </div>
            {totals && (
              <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                <span><b className="text-slate-700">{data.employees.length}</b> staff</span>
                <span className="text-emerald-600">{totals.payable} payable</span>
                <span className="text-rose-600">{totals.lop} LOP</span>
                <span className="text-amber-600">{totals.otHours} OT hrs · {money(totals.otPay)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={prefill} disabled={busy || locked}>
            <Wand2 size={14} /> Prefill
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)} disabled={busy || locked}>
            <Upload size={14} /> Import
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={busy || locked}>
            <Eraser size={14} /> Clear all
          </Button>
          <Button variant={locked ? "subtle" : "accent"} size="sm" onClick={toggleLock} disabled={busy}>
            {locked ? <Unlock size={14} /> : <Lock size={14} />}
            {locked ? "Reopen" : "Finalise"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-3 px-5 py-4 text-sm text-rose-700">
          <AlertTriangle size={16} /> {error}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={load}>
            <RefreshCw size={13} /> Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="m-4 h-40 animate-pulse rounded-xl bg-slate-100" />
      ) : data.employees.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-400">
          No one on payroll here yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-collapse text-sm" style={{ minWidth: "100%" }}>
            <thead>
              <tr>
                <th className="sticky left-0 z-20 min-w-52 border-b border-r border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Employee
                </th>
                {data.days.map((d) => {
                  const isToday = d.date === TODAY;
                  return (
                    <th
                      key={d.date}
                      onClick={() => fillColumn(d.date)}
                      title={`${d.weekday} — ${clearing ? "click to clear the day" : `fill with ${STATUS[brush].label}`}`}
                      className={`w-9 cursor-pointer border-b border-slate-200 py-1.5 text-center transition hover:bg-navy/5 ${
                        isToday ? "bg-amber/15" : d.isWeekend ? "bg-slate-100" : "bg-slate-50"
                      }`}
                    >
                      <div className={`text-[11px] font-semibold ${isToday ? "text-navy" : d.isWeekend ? "text-slate-400" : "text-slate-600"}`}>{d.day}</div>
                      <div className="text-[9px] font-medium text-slate-400">{d.weekday[0]}</div>
                    </th>
                  );
                })}
                <th className="border-b border-l border-slate-200 bg-slate-50 px-2 py-2.5 text-center text-[11px] font-semibold uppercase text-slate-500">Pay</th>
                <th className="border-b border-slate-200 bg-slate-50 px-2 py-2.5 text-center text-[11px] font-semibold uppercase text-slate-500">LOP</th>
                <th className="border-b border-slate-200 bg-slate-50 px-2 py-2.5 text-center text-[11px] font-semibold uppercase text-slate-500" title="Overtime hours">OT hrs</th>
                <th className="border-b border-slate-200 bg-slate-50 px-2 py-2.5 text-center text-[11px] font-semibold uppercase text-slate-500" title="Overtime pay">OT pay</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((emp) => (
                <tr key={emp.id} className="group">
                  <td className="sticky left-0 z-10 min-w-52 border-b border-r border-slate-100 bg-white px-4 py-2 group-hover:bg-slate-50">
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => fillRow(emp)}
                        disabled={emp.locked || locked}
                        title={`${clearing ? "Clear this row" : `Fill row with ${STATUS[brush].label}`}`}
                        className="text-slate-300 transition hover:text-navy disabled:opacity-30"
                      >
                        <ChevronRight size={15} />
                      </button>
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy/10 text-[11px] font-bold text-navy">
                        {initials(emp.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-navy">{emp.name}</div>
                        <div className="truncate text-xs text-slate-400">
                          {emp.code}{emp.department ? ` · ${emp.department}` : ""}
                        </div>
                      </div>
                    </div>
                  </td>

                  {data.days.map((d) => {
                    const s = emp.marks[d.date];
                    const isToday = d.date === TODAY;
                    return (
                      <td
                        key={d.date}
                        onMouseDown={() => { painting.current = true; paintCell(emp, d.date); }}
                        onMouseEnter={() => painting.current && paintCell(emp, d.date)}
                        className={`border-b border-r border-slate-50 p-0.5 text-center ${isToday ? "bg-amber/5" : ""} ${emp.locked || locked ? "cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div className={`mx-auto grid h-7 w-7 select-none place-items-center rounded-md text-[11px] font-bold transition ${
                          s ? STATUS[s].cell : d.isWeekend ? "bg-slate-50 text-slate-300" : "bg-slate-50/60 text-transparent hover:bg-navy/10 hover:text-navy/40"
                        } ${emp.locked || locked ? "opacity-70" : ""}`}>
                          {s || "·"}
                        </div>
                      </td>
                    );
                  })}

                  <td className="border-b border-l border-slate-100 px-2 text-center text-xs font-bold tabular-nums text-navy group-hover:bg-slate-50">
                    {emp.summary.payableDays}
                  </td>
                  <td className="border-b border-slate-100 px-2 text-center text-xs font-semibold tabular-nums text-rose-600 group-hover:bg-slate-50">
                    {emp.summary.lopDays || ""}
                  </td>
                  <td className="border-b border-slate-100 px-1 py-1.5 text-center group-hover:bg-slate-50">
                    <input
                      type="number" min={0}
                      value={emp.otHours || ""}
                      disabled={emp.locked || locked}
                      onChange={(e) => setOt(emp, Math.max(0, Number(e.target.value) || 0))}
                      placeholder="0"
                      className="w-12 rounded-md border border-slate-200 px-1 py-1 text-center text-xs outline-none focus:border-navy focus:ring-2 focus:ring-navy/15 disabled:bg-slate-50"
                    />
                  </td>
                  <td className="border-b border-slate-100 px-2 text-right text-xs font-semibold tabular-nums text-amber-600 group-hover:bg-slate-50">
                    {emp.otAmount ? money(emp.otAmount) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* legend (only worth showing once per board footer) */}
      {!loading && !error && data?.employees?.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 bg-slate-50/50 px-5 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Legend</span>
          {ORDER.map((code) => (
            <span key={code} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`grid h-4 w-4 place-items-center rounded text-[9px] font-bold ${STATUS[code].cell}`}>{code}</span>
              {STATUS[code].label}
            </span>
          ))}
          <span className="ml-auto flex items-center gap-1 text-xs text-slate-400">
            <IndianRupee size={12} /> OT pay = hours × basic hourly × company OT rate
          </span>
        </div>
      )}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4" onClick={() => !importing && setImportOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
                <Upload size={16} /> Import attendance — {companyName}
              </h2>
              <button onClick={() => !importing && setImportOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </header>
            <div className="space-y-4 p-5">
              <p className="text-sm text-slate-600">
                Upload a CSV for <b>{MONTHS[month - 1]} {year}</b>. The quickest way is to
                download the template below — it already lists this company's employees — fill in
                each day with a status code, and upload it back.
              </p>

              <button
                onClick={downloadTemplate}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-navy transition hover:bg-slate-50"
              >
                <Download size={15} /> Download template ({MONTHS[month - 1]} {year})
              </button>

              <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
                <div className="mb-1 font-semibold text-slate-600">Status codes</div>
                P Present · A Absent/LOP · PL Paid leave · HD Half day · WO Weekly off · H Holiday.
                Leave a cell blank to keep it unmarked. Rows are matched by Employee Code.
              </div>

              <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-center transition hover:border-navy/40 hover:bg-slate-50 ${importing ? "pointer-events-none opacity-60" : ""}`}>
                {importing ? (
                  <Loader2 size={22} className="animate-spin text-navy" />
                ) : (
                  <FileSpreadsheet size={22} className="text-slate-400" />
                )}
                <span className="text-sm font-medium text-navy">
                  {importing ? "Importing…" : "Choose a CSV file"}
                </span>
                <span className="text-xs text-slate-400">or drag it onto this box</span>
                <input type="file" accept=".csv,text/csv" onChange={handleFile} disabled={importing} className="hidden" />
              </label>

              <p className="text-xs text-slate-400">
                Finalised employees are skipped. Existing marks for a day are overwritten by the file.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Empty({ icon: Icon, title, sub }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-400">
        <Icon size={22} />
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  );
}
