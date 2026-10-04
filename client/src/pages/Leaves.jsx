import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Search, Plus, ChevronLeft, ChevronRight, X, Trash2, AlertTriangle,
  RefreshCw, Building2, CalendarDays, SlidersHorizontal, Loader2, Info,
} from "lucide-react";
import { leaveApi, errorText } from "../lib/api";
import { Button, Field, Grid, Modal, Monogram, Pill, Select } from "../components/ui";

// balance colour by how much is left
const money = (n) =>
  "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");

function balTone(remaining, allotted) {
  if (allotted === 0) return "text-slate-400";
  if (remaining <= 0) return "text-rose-600";
  if (remaining <= allotted * 0.25) return "text-amber-600";
  return "text-navy";
}

export default function Leaves() {
  const outlet = useOutletContext() || {};
  const companyId = outlet.companyId ?? null;
  const companyName = outlet.company?.name || "";

  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [openEmp, setOpenEmp] = useState(null); // employee id for drawer
  const [policyOpen, setPolicyOpen] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      setData(await leaveApi.balances(companyId, year));
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [companyId, year]);

  useEffect(() => {
    load();
  }, [load]);

  const list = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.employees;
    return data.employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        (e.department || "").toLowerCase().includes(q)
    );
  }, [data, query]);

  const paidTypes = data?.leaveTypes?.filter((t) => t.paid) || [];

  if (!companyId) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-400">
          <Building2 size={22} />
        </div>
        <p className="text-sm font-medium text-slate-700">Pick a company first</p>
        <p className="mt-1 text-xs text-slate-400">
          Use the company selector at the top to load its leave records.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Leaves</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Record leave for {companyName}. Loss-of-pay leave is deducted at payroll automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-300 bg-white shadow-sm">
            <button onClick={() => setYear((y) => y - 1)} className="px-2 py-1.5 text-slate-500 hover:text-navy">
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-16 px-3 text-center text-sm font-medium text-navy">{year}</span>
            <button onClick={() => setYear((y) => y + 1)} className="px-2 py-1.5 text-slate-500 hover:text-navy">
              <ChevronRight size={16} />
            </button>
          </div>
          <Button variant="ghost" onClick={() => setPolicyOpen(true)}>
            <SlidersHorizontal size={15} /> Policy
          </Button>
          <Button variant="accent" onClick={() => setOpenEmp("pick")}>
            <Plus size={16} /> Add leave
          </Button>
        </div>
      </div>

      {/* how it works note */}
      <div className="flex items-start gap-2.5 rounded-xl bg-navy/5 px-5 py-3 text-xs text-slate-600 ring-1 ring-inset ring-navy/10">
        <Info size={15} className="mt-0.5 shrink-0 text-navy" />
        <span>
          Paid leave (Casual, Sick, Earned) draws down the yearly balance and does not reduce salary.
          Loss of Pay is marked absent in attendance, so payroll deducts it. Click any employee to see
          their balance and history.
        </span>
      </div>

      {loadError && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-rose-50 px-5 py-4 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          <AlertTriangle size={16} />
          <span>{loadError}</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={load}>
            <RefreshCw size={13} /> Try again
          </Button>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search employee"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-semibold">Employee</th>
                {paidTypes.map((t) => (
                  <th key={t.key} className="px-4 py-3 text-center font-semibold" title={t.label}>
                    {t.key} left
                  </th>
                ))}
                <th className="px-4 py-3 text-center font-semibold">LOP taken</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {loading &&
                [0, 1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td colSpan={paidTypes.length + 3} className="px-5 py-4">
                      <div className="h-9 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}

              {!loading &&
                list.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setOpenEmp(e.id)}
                    className="group cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Monogram name={e.name} size={34} />
                        <div className="min-w-0">
                          <div className="font-semibold text-navy">{e.name}</div>
                          <div className="truncate text-xs text-slate-400">
                            {e.code}{e.department ? ` · ${e.department}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    {e.balances.map((b) => (
                      <td key={b.key} className="px-4 py-3 text-center tabular-nums">
                        <span className={`font-semibold ${balTone(b.remaining, b.allotted)}`}>
                          {b.remaining}
                        </span>
                        <span className="text-xs text-slate-400">/{b.allotted}</span>
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center tabular-nums">
                      {e.lopTaken > 0 ? (
                        <span className="font-medium text-rose-600">{e.lopTaken}</span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className="pr-4 text-slate-300 transition group-hover:text-navy">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                ))}

              {!loading && !loadError && list.length === 0 && (
                <tr>
                  <td colSpan={paidTypes.length + 3} className="px-5 py-16 text-center">
                    <CalendarDays size={28} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">
                      {data?.employees?.length ? "No employee matches your search" : "No active employees"}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openEmp && (
        <LeaveDrawer
          companyId={companyId}
          year={year}
          employees={data?.employees || []}
          initialEmployeeId={openEmp === "pick" ? null : openEmp}
          leaveTypes={data?.leaveTypes || []}
          onClose={() => setOpenEmp(null)}
          onChanged={load}
        />
      )}

      {policyOpen && (
        <PolicyModal
          companyId={companyId}
          onClose={() => setPolicyOpen(false)}
          onSaved={() => {
            setPolicyOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- drawer */

function LeaveDrawer({ companyId, year, employees, initialEmployeeId, leaveTypes, onClose, onChanged }) {
  const [employeeId, setEmployeeId] = useState(initialEmployeeId || "");
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [encashDays, setEncashDays] = useState("");
  const [encashNote, setEncashNote] = useState("");
  const [encashing, setEncashing] = useState(false);
  const [form, setForm] = useState({
    leaveType: "CL",
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: "",
    reason: "",
  });

  const loadLedger = useCallback(async (id) => {
    if (!id) return setLedger(null);
    setLoading(true);
    try {
      setLedger(await leaveApi.employee(id, year));
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (employeeId) loadLedger(employeeId);
  }, [employeeId, loadLedger]);

  const meta = leaveTypes.find((t) => t.key === form.leaveType);
  const isPaid = meta?.paid;

  async function addLeave() {
    if (!employeeId) return toast.error("Pick an employee");
    if (!form.fromDate) return toast.error("Pick a date");
    setSaving(true);
    try {
      const r = await leaveApi.add({
        employeeId: Number(employeeId),
        leaveType: form.leaveType,
        fromDate: form.fromDate,
        toDate: form.toDate || form.fromDate,
        reason: form.reason,
      });
      toast.success(
        `${r.added} day(s) added` +
          (r.deductsSalary ? " — will be deducted at payroll" : "") +
          (r.skipped ? `, ${r.skipped} skipped` : "")
      );
      setForm((f) => ({ ...f, toDate: "", reason: "" }));
      await loadLedger(employeeId);
      onChanged();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeLeave(id) {
    try {
      await leaveApi.remove(id);
      toast.success("Leave removed");
      await loadLedger(employeeId);
      onChanged();
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  const elBalance = ledger?.balances?.find((b) => b.key === "EL");
  const elRemaining = elBalance ? elBalance.remaining : 0;
  const grossMonthly = ledger?.employee?.gross || 0;
  const dayRate = Math.round(grossMonthly / 30);
  const encashPreview = Math.round((Number(encashDays) || 0) * dayRate);

  async function encashEl() {
    const days = Number(encashDays);
    if (!employeeId) return toast.error("Pick an employee");
    if (!days || days <= 0) return toast.error("Enter days to encash");
    if (days > elRemaining) return toast.error(`Only ${elRemaining} EL day(s) available`);
    setEncashing(true);
    try {
      const r = await leaveApi.encash(Number(employeeId), days, encashNote);
      const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const paidMonth = r.month ? MONTHS[r.month - 1] : "this month";
      toast.success(`Encashed ${r.days} EL day(s) — ${money(r.amount)} · will be paid in ${paidMonth}'s payroll`);
      setEncashDays("");
      setEncashNote("");
      await loadLedger(employeeId);
      onChanged();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setEncashing(false);
    }
  }

  async function removeEncash(id) {
    try {
      await leaveApi.removeEncash(id);
      toast.success("Encashment removed");
      await loadLedger(employeeId);
      onChanged();
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="text-sm font-semibold text-navy">Leave record</div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* employee picker (when opened via top button) */}
          {!initialEmployeeId && (
            <Select
              label="Employee"
              value={employeeId}
              onChange={(v) => setEmployeeId(v)}
              options={[
                { value: "", label: "Select an employee" },
                ...employees.map((e) => ({ value: String(e.id), label: `${e.name} · ${e.code}` })),
              ]}
            />
          )}

          {employeeId && (
            <>
              {/* balances */}
              {loading ? (
                <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
              ) : ledger ? (
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <Monogram name={ledger.employee.name} size={38} />
                    <div>
                      <div className="font-medium text-navy">{ledger.employee.name}</div>
                      <div className="text-xs text-slate-400">
                        {ledger.employee.code}
                        {ledger.employee.designation ? ` · ${ledger.employee.designation}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {ledger.balances.map((b) => (
                      <div key={b.key} className="rounded-lg border border-slate-200 px-3 py-2 text-center">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                          {b.key}
                        </div>
                        <div className={`text-lg font-semibold tabular-nums ${balTone(b.remaining, b.allotted)}`}>
                          {b.remaining}
                        </div>
                        <div className="text-[11px] text-slate-400">of {b.allotted}</div>
                      </div>
                    ))}
                  </div>
                  {ledger.lopTaken > 0 && (
                    <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {ledger.lopTaken} loss-of-pay day(s) taken this year — already reflected in salary.
                    </div>
                  )}

                  {/* EL encashment for an active employee */}
                  <div className="mt-3 rounded-xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Encash Earned Leave
                      </span>
                      <span className="text-xs text-slate-500">
                        {elRemaining} EL day(s) available · ₹{dayRate.toLocaleString("en-IN")}/day
                      </span>
                    </div>
                    <p className="mb-2 text-[11px] text-slate-400">
                      Encashed amount is paid in the current month's payroll — run or re-run that month's payroll to include it.
                    </p>
                    <div className="flex items-end gap-2">
                      <Field
                        label="Days to encash"
                        type="number"
                        value={encashDays}
                        onChange={setEncashDays}
                        min={0}
                        max={elRemaining}
                      />
                      <Field
                        label="Note (optional)"
                        value={encashNote}
                        onChange={setEncashNote}
                        placeholder="e.g. annual EL payout"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-slate-600">
                        Payout: <b className="text-navy">{money(encashPreview)}</b>
                      </span>
                      <Button
                        variant="accent"
                        size="sm"
                        onClick={encashEl}
                        disabled={encashing || !Number(encashDays) || Number(encashDays) > elRemaining}
                      >
                        {encashing ? "Encashing…" : "Encash EL"}
                      </Button>
                    </div>
                    {ledger.encashments?.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2">
                        {ledger.encashments.map((en) => (
                          <div key={en.id} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">
                              {en.days} day(s) · {money(en.amount)}
                              {en.note ? ` · ${en.note}` : ""}
                            </span>
                            <button
                              onClick={() => removeEncash(en.id)}
                              className="text-slate-400 hover:text-rose-600"
                              title="Remove encashment"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* add form */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 text-sm font-semibold text-navy">Add leave</div>
                <div className="space-y-3">
                  <Select
                    label="Leave type"
                    value={form.leaveType}
                    onChange={(v) => setForm({ ...form, leaveType: v })}
                    options={leaveTypes.map((t) => ({
                      value: t.key,
                      label: `${t.label}${t.paid ? "" : " — salary deducted"}`,
                    }))}
                  />
                  <Grid>
                    <Field label="From date" type="date" value={form.fromDate} onChange={(v) => setForm({ ...form, fromDate: v })} />
                    <Field label="To date" type="date" value={form.toDate} onChange={(v) => setForm({ ...form, toDate: v })} hint="Leave blank for one day" />
                  </Grid>
                  <Field label="Reason (optional)" value={form.reason} onChange={(v) => setForm({ ...form, reason: v })} placeholder="Fever, personal work…" />

                  <div className={`rounded-lg px-3 py-2 text-xs ${isPaid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                    {isPaid
                      ? "Paid leave — drawn from balance, no salary impact."
                      : "Loss of Pay — this will reduce salary in payroll."}
                  </div>

                  <Button variant="accent" onClick={addLeave} disabled={saving} className="w-full">
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                    {saving ? "Adding…" : "Add leave"}
                  </Button>
                </div>
              </div>

              {/* history */}
              {ledger?.records?.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-semibold text-navy">
                    This year ({ledger.records.length})
                  </div>
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {ledger.records.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700">{r.date}</span>
                            <Pill tone={r.paid ? "green" : "amber"}>{r.label}</Pill>
                          </div>
                          {r.reason && <div className="mt-0.5 text-xs text-slate-400">{r.reason}</div>}
                        </div>
                        <button
                          onClick={() => removeLeave(r.id)}
                          className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- policy */

function PolicyModal({ companyId, onClose, onSaved }) {
  const [policy, setPolicy] = useState(null);
  const [types, setTypes] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    leaveApi
      .getPolicy(companyId)
      .then((r) => {
        setPolicy(r.policy);
        setTypes(r.leaveTypes.filter((t) => t.paid));
      })
      .catch((e) => toast.error(errorText(e)));
  }, [companyId]);

  async function save() {
    setSaving(true);
    try {
      await leaveApi.setPolicy(companyId, policy);
      toast.success("Leave policy updated");
      onSaved();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title="Leave policy"
      desc="Annual paid-leave entitlement for this company. Applies to every employee."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="accent" onClick={save} disabled={saving || !policy}>
            {saving ? "Saving…" : "Save policy"}
          </Button>
        </>
      }
    >
      {!policy ? (
        <div className="h-24 animate-pulse rounded bg-slate-100" />
      ) : (
        <Grid cols={3}>
          {types.map((t) => (
            <Field
              key={t.key}
              label={t.label}
              type="number"
              value={policy[t.key]}
              onChange={(v) => setPolicy({ ...policy, [t.key]: Math.max(0, Number(v) || 0) })}
              hint="days / year"
            />
          ))}
        </Grid>
      )}
    </Modal>
  );
}
