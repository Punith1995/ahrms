import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft, ArrowRight, Check, RotateCcw, Loader2, AlertTriangle, Calculator,
  UserCheck, Trash2, Calendar,
} from "lucide-react";
import { exitApi, leaveApi, errorText } from "../lib/api";
import {
  Button, Card, Field, Grid, Modal, Monogram, Pill, Select, Toggle,
} from "../components/ui";

const money = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const clone = (o) => JSON.parse(JSON.stringify(o));

const STAGES = [
  { id: "initiated", label: "Details" },
  { id: "clearance", label: "Clearance" },
  { id: "settlement", label: "Settlement" },
  { id: "completed", label: "Complete" },
];
const stageIndex = (id) => Math.max(0, STAGES.findIndex((s) => s.id === id));

// grouped clearance items (mirrors server CLEARANCE_ITEMS)
const CLEARANCE = [
  { key: "idCard", label: "ID card returned", group: "Assets" },
  { key: "assets", label: "Laptop / tools / uniform returned", group: "Assets" },
  { key: "accessCard", label: "Access card / keys returned", group: "Assets" },
  { key: "handover", label: "Work handover completed", group: "Work" },
  { key: "knowledge", label: "Knowledge transfer done", group: "Work" },
  { key: "itRevoke", label: "Email / system access revoked", group: "IT" },
  { key: "advances", label: "Advances / loans settled", group: "Accounts" },
  { key: "reimburse", label: "Pending reimbursements cleared", group: "Accounts" },
  { key: "pfForm", label: "PF withdrawal / transfer form", group: "Statutory" },
  { key: "exitForm", label: "Exit interview / form signed", group: "HR" },
];
const CLEARANCE_GROUPS = ["Assets", "Work", "IT", "Accounts", "Statutory", "HR"];

export default function ExitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [stage, setStage] = useState("initiated");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await exitApi.get(id);
        if (!alive) return;
        setSaved(data);
        setForm(clone(data));
        setStage(data.stage === "completed" ? "completed" : data.stage || "initiated");

        // pull the employee's real EL balance and pre-fill days + encashment
        const empId = data.employee?.id;
        if (empId) {
          try {
            const yr = new Date(data.lastWorkingDay || Date.now()).getFullYear();
            const lb = await leaveApi.employee(empId, yr);
            const el = (lb.balances || []).find((b) => b.key === "EL");
            const elDays = el ? el.remaining : 0;
            if (alive && elDays > 0) {
              setLeaveBalance(elDays);
              const gross = data.employee?.salaryStructure?.gross || 0;
              // only pre-fill the amount if it hasn't been set yet
              setForm((f) =>
                f.leaveEncashment
                  ? f
                  : { ...f, leaveEncashment: Math.round((elDays * gross) / 30) }
              );
            }
          } catch {
            /* leave data optional — ignore */
          }
        }
      } catch (e) {
        if (alive) setLoadError(errorText(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const dirty = useMemo(
    () => (saved && form ? JSON.stringify(form) !== JSON.stringify(saved) : false),
    [form, saved]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (loadError || !form) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
        <AlertTriangle size={26} className="mx-auto mb-3 text-rose-400" />
        <p className="text-sm font-medium text-slate-700">{loadError || "Exit not found"}</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/exit")}>
          Back to exits
        </Button>
      </div>
    );
  }

  const done = form.status === "completed";
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setClear = (key, val) =>
    setForm((f) => ({ ...f, clearance: { ...f.clearance, [key]: val } }));

  async function save(nextStage) {
    setSaving(true);
    try {
      const body = {
        stage: nextStage || form.stage,
        exitType: form.exitType,
        reason: form.reason,
        notes: form.notes,
        resignedOn: form.resignedOn || null,
        lastWorkingDay: form.lastWorkingDay || null,
        noticeRequiredDays: form.noticeRequiredDays,
        noticeServedDays: form.noticeServedDays,
        clearance: form.clearance,
        pendingSalary: form.pendingSalary,
        leaveEncashment: form.leaveEncashment,
        gratuity: form.gratuity,
        bonus: form.bonus,
        otherEarnings: form.otherEarnings,
        noticeRecovery: form.noticeRecovery,
        loanRecovery: form.loanRecovery,
        otherDeductions: form.otherDeductions,
      };
      const updated = await exitApi.update(form.id, body);
      setSaved(updated);
      setForm(clone(updated));
      if (nextStage) setStage(nextStage);
      toast.success(nextStage ? "Saved" : "Changes saved");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function suggest() {
    try {
      const r = await exitApi.suggestSettlement(form.id, leaveBalance);
      setForm((f) => ({
        ...f,
        gratuity: r.suggested.gratuity,
        leaveEncashment: r.suggested.leaveEncashment,
        noticeRecovery: r.suggested.noticeRecovery,
      }));
      toast.success(
        r.gratuityEligible
          ? `Suggested — ${r.years} yrs service, gratuity applies`
          : `Suggested — ${r.years} yrs service, gratuity needs 5 yrs`
      );
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  async function completeExit() {
    setCompleting(true);
    try {
      const updated = await exitApi.complete(form.id);
      setSaved(updated);
      setForm(clone(updated));
      setConfirming(false);
      toast.success(`${updated.employee?.name} exited. F&F ${money(updated.netSettlement)}`);
      navigate("/exit");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setCompleting(false);
    }
  }

  async function cancelExit() {
    if (!window.confirm("Cancel this exit? The employee stays active.")) return;
    try {
      await exitApi.cancel(form.id);
      toast.success("Exit cancelled");
      navigate("/exit");
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  const at = stageIndex(stage);
  const totalEarnings =
    (form.pendingSalary || 0) + (form.leaveEncashment || 0) + (form.gratuity || 0) +
    (form.bonus || 0) + (form.otherEarnings || 0);
  const totalDeductions =
    (form.noticeRecovery || 0) + (form.loanRecovery || 0) + (form.otherDeductions || 0);
  const net = totalEarnings - totalDeductions;

  const clearedCount = CLEARANCE.filter((c) => form.clearance?.[c.key]).length;

  return (
    <div className="space-y-5 pb-24">
      <button
        onClick={() => navigate("/exit")}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy"
      >
        <ArrowLeft size={15} /> Exit
      </button>

      {/* header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start gap-5">
          <Monogram name={form.employee?.name || "?"} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg font-semibold text-navy">{form.employee?.name}</h1>
              <Pill tone={done ? "green" : "amber"}>
                {done ? "Completed" : "In progress"}
              </Pill>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {form.employee?.code} · {form.employee?.designation || "—"} · {form.company?.name}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
              <span>Type <b className="text-slate-700">{form.exitType}</b></span>
              <span>Joined <b className="text-slate-700">{form.employee?.doj || "—"}</b></span>
              <span>Last day <b className="text-slate-700">{form.lastWorkingDay || "Not set"}</b></span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Net settlement</div>
            <div className="text-lg font-semibold tabular-nums text-navy">
              {net ? money(net) : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* stepper */}
      <nav className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <ol className="grid grid-cols-4 divide-x divide-slate-200">
          {STAGES.map((s, i) => {
            const state = i < at ? "done" : i === at ? "current" : "todo";
            return (
              <li key={s.id}>
                <button
                  onClick={() => !done && setStage(s.id)}
                  className={`relative w-full px-4 py-3.5 text-left transition ${
                    state === "current" ? "bg-navy/5" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                        state === "done"
                          ? "bg-navy text-white"
                          : state === "current"
                          ? "bg-amber text-navy"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {state === "done" ? <Check size={13} /> : i + 1}
                    </span>
                    <span className={`text-sm ${state === "todo" ? "text-slate-400" : "font-medium text-navy"}`}>
                      {s.label}
                    </span>
                  </div>
                  {state === "current" && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-amber" />}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {stage === "initiated" && (
        <DetailsStage form={form} set={set} />
      )}
      {stage === "clearance" && (
        <ClearanceStage form={form} setClear={setClear} cleared={clearedCount} total={CLEARANCE.length} />
      )}
      {stage === "settlement" && (
        <SettlementStage
          form={form} set={set} net={net}
          totalEarnings={totalEarnings} totalDeductions={totalDeductions}
          leaveBalance={leaveBalance} setLeaveBalance={setLeaveBalance} onSuggest={suggest}
        />
      )}
      {stage === "completed" && (
        <CompleteStage
          form={form} done={done} net={net} cleared={clearedCount} total={CLEARANCE.length}
          onComplete={() => setConfirming(true)} onCancel={cancelExit} onJump={setStage}
        />
      )}

      {/* step nav */}
      {!done && (
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" disabled={at === 0} onClick={() => setStage(STAGES[at - 1].id)}>
            <ArrowLeft size={15} /> Back
          </Button>
          {at < STAGES.length - 1 && (
            <Button variant="primary" disabled={saving} onClick={() => save(STAGES[at + 1].id)}>
              {saving ? "Saving…" : "Save and continue"} <ArrowRight size={15} />
            </Button>
          )}
        </div>
      )}

      {/* unsaved bar */}
      {dirty && !done && (
        <div className="fixed bottom-0 left-60 right-0 z-40 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-600">You have unsaved changes.</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setForm(clone(saved))}>
                <RotateCcw size={15} /> Discard
              </Button>
              <Button variant="accent" onClick={() => save()} disabled={saving}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={confirming}
        title="Complete this exit"
        desc="This marks the employee as exited, removes them from headcount, and freezes the settlement."
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Not yet</Button>
            <Button variant="accent" onClick={completeExit} disabled={completing}>
              {completing ? "Completing…" : "Complete exit"}
            </Button>
          </>
        }
      >
        <dl className="divide-y divide-slate-100 text-sm">
          {[
            ["Employee", `${form.employee?.name} · ${form.employee?.code}`],
            ["Last working day", form.lastWorkingDay || "—"],
            ["Clearance", `${clearedCount} of ${CLEARANCE.length} done`],
            ["Total earnings", money(totalEarnings)],
            ["Total deductions", money(totalDeductions)],
            ["Net settlement", money(net)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-right font-medium text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
        {clearedCount < CLEARANCE.length && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Clearance is not fully ticked. You can still complete, but check nothing important is pending.
          </p>
        )}
      </Modal>
    </div>
  );
}

/* -------------------------------------------------------------- stages */

function DetailsStage({ form, set }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Exit details">
        <Grid>
          <Select
            label="Exit type"
            value={form.exitType}
            onChange={(v) => set("exitType", v)}
            options={["Resignation", "Termination", "End of contract", "Retirement", "Absconding"]}
          />
          <Field label="Resigned / notified on" type="date" value={form.resignedOn} onChange={(v) => set("resignedOn", v)} />
          <Field label="Last working day" type="date" value={form.lastWorkingDay} onChange={(v) => set("lastWorkingDay", v)} span={2} />
          <Field span={2} label="Reason" value={form.reason} onChange={(v) => set("reason", v)} placeholder="Better opportunity, relocation, etc." />
        </Grid>
      </Card>

      <Card title="Notice period" desc="Used to compute any shortfall recovery.">
        <Grid>
          <Field
            label="Notice required (days)"
            type="number"
            value={form.noticeRequiredDays}
            onChange={(v) => set("noticeRequiredDays", Number(v))}
          />
          <Field
            label="Notice served (days)"
            type="number"
            value={form.noticeServedDays}
            onChange={(v) => set("noticeServedDays", Number(v))}
          />
        </Grid>
        {form.noticeRequiredDays > form.noticeServedDays && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Shortfall of {form.noticeRequiredDays - form.noticeServedDays} days — recovery can be
            auto-calculated on the Settlement step.
          </p>
        )}
        <Field
          className="mt-4"
          label="Internal notes"
          value={form.notes}
          onChange={(v) => set("notes", v)}
        />
      </Card>
    </div>
  );
}

function ClearanceStage({ form, setClear, cleared, total }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-navy">Clearance checklist</div>
          <p className="mt-0.5 text-xs text-slate-500">
            Tick what's been returned or settled. Items that don't apply can be left unticked.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums text-navy">
            {cleared}<span className="text-slate-300">/{total}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {CLEARANCE_GROUPS.map((group) => {
          const rows = CLEARANCE.filter((c) => c.group === group);
          if (!rows.length) return null;
          return (
            <Card key={group} title={group}>
              <div className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <Toggle
                    key={c.key}
                    label={c.label}
                    checked={!!form.clearance?.[c.key]}
                    onChange={(v) => setClear(c.key, v)}
                  />
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SettlementStage({
  form, set, net, totalEarnings, totalDeductions,
  leaveBalance, setLeaveBalance, onSuggest,
}) {
  const s = form.employee?.salaryStructure || {};
  const dayRate = Math.round((s.gross || 0) / 30);
  const [pendingDays, setPendingDays] = useState("");
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <Card
          title="Auto-calculate"
          desc="Fills gratuity, leave encashment and notice recovery from the salary structure."
        >
          <Grid>
            <Field
              label="EL balance (days)"
              type="number"
              value={leaveBalance}
              onChange={(v) => {
                const days = Number(v) || 0;
                setLeaveBalance(days);
                set("leaveEncashment", Math.round((days * (s.gross || 0)) / 30));
              }}
              hint={`Encashment = days × ₹${dayRate.toLocaleString("en-IN")}/day`}
            />
            <Field
              label="Unpaid days (pending salary)"
              type="number"
              value={pendingDays}
              onChange={(v) => {
                const days = Number(v) || 0;
                setPendingDays(v);
                set("pendingSalary", Math.round((days * (s.gross || 0)) / 30));
              }}
              hint={`Pending salary = days × ₹${dayRate.toLocaleString("en-IN")}/day`}
            />
          </Grid>
          <Button variant="primary" onClick={onSuggest} className="mt-3 w-full">
            <Calculator size={15} /> Fill gratuity &amp; notice recovery
          </Button>
          <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
            EL days are pre-filled from the employee's leave balance. Enter unpaid days for pending
            salary — both amounts calculate automatically. The button fills gratuity and notice
            recovery from service length. Basis: basic {money(s.basic)}, gross {money(s.gross)} per month.
            All figures editable below.
          </div>
        </Card>

        <Card title="Earnings">
          <div className="space-y-3">
            <MoneyField label="Pending salary (auto from unpaid days above)" value={form.pendingSalary} onChange={(v) => set("pendingSalary", v)} />
            <MoneyField label="Leave encashment (auto from EL days above)" value={form.leaveEncashment} onChange={(v) => set("leaveEncashment", v)} />
            <MoneyField label="Gratuity" value={form.gratuity} onChange={(v) => set("gratuity", v)} />
            <MoneyField label="Bonus / ex-gratia" value={form.bonus} onChange={(v) => set("bonus", v)} />
            <MoneyField label="Other earnings" value={form.otherEarnings} onChange={(v) => set("otherEarnings", v)} />
          </div>
        </Card>

        <Card title="Deductions">
          <div className="space-y-3">
            <MoneyField label="Notice shortfall recovery" value={form.noticeRecovery} onChange={(v) => set("noticeRecovery", v)} />
            <MoneyField label="Loan / advance recovery" value={form.loanRecovery} onChange={(v) => set("loanRecovery", v)} />
            <MoneyField label="Other deductions" value={form.otherDeductions} onChange={(v) => set("otherDeductions", v)} />
          </div>
        </Card>
      </div>

      <div>
        <Card title="Full & final settlement">
          <div className="space-y-1">
            <SumRow label="Pending salary" value={form.pendingSalary} />
            <SumRow label="Leave encashment" value={form.leaveEncashment} />
            <SumRow label="Gratuity" value={form.gratuity} />
            <SumRow label="Bonus / ex-gratia" value={form.bonus} />
            <SumRow label="Other earnings" value={form.otherEarnings} />
            <SumRow label="Total earnings" value={totalEarnings} strong />
          </div>
          <div className="mt-4 space-y-1">
            <SumRow label="Notice recovery" value={-form.noticeRecovery} muted />
            <SumRow label="Loan recovery" value={-form.loanRecovery} muted />
            <SumRow label="Other deductions" value={-form.otherDeductions} muted />
            <SumRow label="Total deductions" value={-totalDeductions} strong />
          </div>
          <div className="mt-4 rounded-lg bg-navy px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-white/70">Net settlement</span>
              <span className="text-xl font-semibold tabular-nums text-amber">{money(net)}</span>
            </div>
          </div>
          {net < 0 && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Net is negative — recoveries exceed earnings. The employee owes this amount.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function CompleteStage({ form, done, net, cleared, total, onComplete, onCancel, onJump }) {
  return (
    <div className="space-y-5">
      {done ? (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-5 py-4 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
          <UserCheck size={18} />
          <span>
            <b>{form.employee?.name}</b> exited on {form.completedOn}. Net settlement {money(net)}.
          </span>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Summary label="Last working day" value={form.lastWorkingDay || "Not set"} warn={!form.lastWorkingDay} />
            <Summary label="Clearance" value={`${cleared} of ${total}`} warn={cleared < total} />
            <Summary label="Net settlement" value={money(net)} />
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Settlement summary" action={!done && (
          <button onClick={() => onJump("settlement")} className="text-xs text-navy underline">Edit</button>
        )}>
          <dl className="divide-y divide-slate-100 text-sm">
            <Line k="Total earnings" v={money(
              (form.pendingSalary || 0) + (form.leaveEncashment || 0) + (form.gratuity || 0) +
              (form.bonus || 0) + (form.otherEarnings || 0)
            )} />
            <Line k="Total deductions" v={money(
              (form.noticeRecovery || 0) + (form.loanRecovery || 0) + (form.otherDeductions || 0)
            )} />
            <Line k="Net payable" v={money(net)} strong />
          </dl>
        </Card>

        <Card title="Exit record">
          <dl className="divide-y divide-slate-100 text-sm">
            <Line k="Type" v={form.exitType} />
            <Line k="Resigned on" v={form.resignedOn || "—"} />
            <Line k="Last working day" v={form.lastWorkingDay || "—"} />
            <Line k="Reason" v={form.reason || "—"} />
          </dl>
        </Card>
      </div>

      {!done && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="text-sm font-medium text-navy">Ready to finalise?</div>
            <p className="mt-0.5 text-xs text-slate-500">
              Completing marks the employee Exited and removes them from headcount. This can't be undone easily.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="danger" onClick={onCancel}>
              <Trash2 size={15} /> Cancel exit
            </Button>
            <Button variant="accent" onClick={onComplete} disabled={!form.lastWorkingDay}>
              <UserCheck size={15} /> Complete exit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- small pieces ---- */

function MoneyField({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm text-slate-400">₹</span>
        <input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(Math.round(Number(e.target.value) || 0))}
          onWheel={(e) => e.currentTarget.blur()}
          placeholder="0"
          className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-navy focus:ring-2 focus:ring-navy/15 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
    </label>
  );
}

function SumRow({ label, value, strong, muted }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className={`text-sm ${muted ? "text-slate-500" : "text-slate-700"}`}>{label}</span>
      <span className={`tabular-nums ${strong ? "text-base font-semibold text-navy" : "text-sm text-slate-800"}`}>
        {money(value)}
      </span>
    </div>
  );
}

function Line({ k, v, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-slate-500">{k}</dt>
      <dd className={`text-right text-sm ${strong ? "font-semibold text-navy" : "font-medium text-slate-800"}`}>{v}</dd>
    </div>
  );
}

function Summary({ label, value, warn }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${warn ? "text-amber-600" : "text-navy"}`}>{value}</div>
    </div>
  );
}
