import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft, ArrowRight, Check, Upload, Minus, Eye, Loader2, FileText,
  AlertTriangle, RotateCcw, UserCheck, Trash2, Plus,
} from "lucide-react";
import { employeeApi, errorText, fileUrl } from "../lib/api";
import {
  employeeChecklist, employeeGroups, STAGES, stageIndex, docProgress,
  pendingItems, departments, employmentTypes, shifts, money,
} from "../data/employeeChecklist";
import {
  Button, Card, Field, Grid, Modal, Monogram, Pill, ReadinessBar, Select, Toggle,
} from "../components/ui";

const ALLOWANCE_TYPES = ["Compensatory Allowance", "Medical Allowance", "Project Allowance", "Other Allowance"];
function AllowancesPicker({ list, onChange }) {
  const [type, setType] = useState(ALLOWANCE_TYPES[0]);
  const [amount, setAmount] = useState("");
  const items = Array.isArray(list) ? list : [];
  function add() {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    onChange([...items, { type, amount: amt }]);
    setAmount("");
  }
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Allowances</div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1">
          <Select label="Allowance" value={type} onChange={setType} options={ALLOWANCE_TYPES} />
        </div>
        <div className="w-32">
          <Field label="Amount (₹)" type="number" value={amount} onChange={setAmount} />
        </div>
        <Button variant="ghost" size="sm" onClick={add} className="mb-0.5"><Plus size={14} /> Add</Button>
      </div>
      {items.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {items.map((a, i) => (
            <div key={i} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-sm">
              <span className="text-slate-700">{a.type}</span>
              <div className="flex items-center gap-3">
                <span className="tabular-nums text-navy">₹{Number(a.amount).toLocaleString("en-IN")}</span>
                <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-rose-600"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const clone = (o) => JSON.parse(JSON.stringify(o));

// Carry the salary mode and editable components on the record, derived from
// the saved structure, so the manual editor round-trips without falsely
// flagging "unsaved changes" on load.
const withSalaryDefaults = (data) => {
  const s = data.salaryStructure || {};
  return {
    ...data,
    salaryMode: s.mode === "manual" ? "manual" : "auto",
    salaryComponents: {
      basic: s.basic || 0,
      daApplicable: s.daApplicable ?? false, da: s.da || 0,
      hra: s.hra || 0,
      conveyance: s.conveyance || 0,
      special: s.special || 0,
      travelApplicable: s.travelApplicable ?? false, travel: s.travel || 0,
      incentiveApplicable: s.incentiveApplicable ?? false, incentive: s.incentive || 0,
      medicalApplicable: s.medicalApplicable ?? false, medical: s.medical || 0,
      otherApplicable: s.otherApplicable ?? false, other: s.other || 0,
      allowanceList: s.allowanceList || [],
      pfRate: s.pfRate ?? "", pfEmployerRate: s.pfEmployerRate ?? "", pfUncapped: s.pfUncapped ?? false,
      foodApplicable: s.foodApplicable ?? false, food: s.food || 0,
      transportApplicable: s.transportApplicable ?? false, transport: s.transport || 0,
      uniformApplicable: s.uniformApplicable ?? false, uniform: s.uniform || 0,
      gratuityApplicable: s.gratuityApplicable ?? true,
      gratuity: s.gratuity || 0,
    },
  };
};

export default function JoiningDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [stage, setStage] = useState("personal");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = withSalaryDefaults(await employeeApi.get(id));
        if (!alive) return;
        setSaved(data);
        setForm(clone(data));
        setStage(data.joiningStage || "personal");
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
        <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (loadError || !form) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
        <AlertTriangle size={26} className="mx-auto mb-3 text-rose-400" />
        <p className="text-sm font-medium text-slate-700">
          {loadError || "This joining record no longer exists"}
        </p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/joining")}>
          Back to joining
        </Button>
      </div>
    );
  }

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const applyDoc = (docKey, rec) => {
    setForm((f) => ({ ...f, docs: { ...f.docs, [docKey]: rec } }));
    setSaved((s) => ({ ...s, docs: { ...s.docs, [docKey]: rec } }));
  };

  async function save(nextStage) {
    setSaving(true);
    try {
      const { docs, company, ...body } = form;
      if (nextStage) body.joiningStage = nextStage;
      const updated = withSalaryDefaults(await employeeApi.update(form.id, body));
      setSaved(updated);
      setForm(clone(updated));
      if (nextStage) setStage(nextStage);
      toast.success(nextStage ? "Saved — moving on" : "Changes saved");
      return true;
    } catch (e) {
      toast.error(errorText(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function completeJoining() {
    setCompleting(true);
    try {
      const updated = await employeeApi.complete(form.id);
      setSaved(updated);
      setForm(clone(updated));
      setConfirming(false);
      toast.success(`${updated.fullName} is now active on payroll`);
      navigate("/joining");
    } catch (e) {
      const blockers = e?.response?.data?.blockers;
      if (blockers?.length) {
        toast.error(`Still missing: ${blockers.slice(0, 3).join(", ")}`);
      } else {
        toast.error(errorText(e));
      }
    } finally {
      setCompleting(false);
    }
  }

  async function withdraw() {
    if (!window.confirm(`Withdraw the joining for ${form.fullName}?`)) return;
    try {
      await employeeApi.withdraw(form.id, "Withdrawn before joining");
      toast.success("Joining withdrawn");
      navigate("/joining");
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  const at = stageIndex(stage);
  const pending = pendingItems(form);
  const done = form.joiningStatus === "joined";

  return (
    <div className="space-y-5 pb-24">
      <button
        onClick={() => navigate("/joining")}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy"
      >
        <ArrowLeft size={15} /> Joining
      </button>

      {/* header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start gap-5">
          <Monogram name={form.fullName} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg font-semibold text-navy">{form.fullName}</h1>
              <Pill tone={done ? "green" : "amber"}>
                {done ? "Joined" : "In progress"}
              </Pill>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {form.employeeCode} · {form.company?.name}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
              <span>Role <b className="text-slate-700">{form.designation || "Not set"}</b></span>
              <span>Joining <b className="text-slate-700">{form.doj || "Not set"}</b></span>
              <span>CTC <b className="text-slate-700">{form.ctcMonthly ? money(form.ctcMonthly) : "Not set"}</b></span>
              <span>File opened <b className="text-slate-700">{form.startedOn}</b></span>
            </div>
          </div>
          <div className="w-44">
            <div className="text-xs font-medium text-slate-500">Documents collected</div>
            <div className="mt-2">
              <ReadinessBar value={docProgress(form)} />
            </div>
          </div>
        </div>
      </div>

      {/* stepper */}
      <nav className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <ol className="grid grid-cols-2 divide-slate-200 sm:grid-cols-3 sm:divide-x lg:grid-cols-5">
          {STAGES.map((s, i) => {
            const state = i < at ? "done" : i === at ? "current" : "todo";
            return (
              <li key={s.id}>
                <button
                  onClick={() => setStage(s.id)}
                  className={`relative w-full px-5 py-3.5 text-left transition ${
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
                    <span
                      className={`text-sm ${
                        state === "todo"
                          ? "text-slate-400"
                          : "font-medium text-navy"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {state === "current" && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-amber" />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {stage === "personal" && <PersonalStage form={form} set={set} />}
      {stage === "employment" && <EmploymentStage form={form} set={set} />}
      {stage === "statutory" && <StatutoryStage form={form} set={set} />}
      {stage === "documents" && (
        <DocumentsStage employeeId={form.id} form={form} applyDoc={applyDoc} />
      )}
      {stage === "review" && (
        <ReviewStage
          form={form}
          pending={pending}
          done={done}
          onJump={setStage}
          onComplete={() => setConfirming(true)}
          onWithdraw={withdraw}
        />
      )}

      {/* step navigation */}
      {!done && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            disabled={at === 0}
            onClick={() => setStage(STAGES[at - 1].id)}
          >
            <ArrowLeft size={15} /> Back
          </Button>
          {at < STAGES.length - 1 && (
            <Button
              variant="primary"
              disabled={saving}
              onClick={() => save(STAGES[at + 1].id)}
            >
              {saving ? "Saving…" : `Save and continue`} <ArrowRight size={15} />
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
        title="Complete this joining"
        desc="This adds the employee to payroll. Attendance and salary start from the date of joining."
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Not yet
            </Button>
            <Button variant="accent" onClick={completeJoining} disabled={completing}>
              {completing ? "Completing…" : "Complete joining"}
            </Button>
          </>
        }
      >
        <dl className="divide-y divide-slate-100 text-sm">
          {[
            ["Employee", `${form.fullName} · ${form.employeeCode}`],
            ["Company", form.company?.name],
            ["Role", `${form.designation || "—"}${form.department ? ` · ${form.department}` : ""}`],
            ["Date of joining", form.doj || "—"],
            ["Monthly CTC", form.ctcMonthly ? money(form.ctcMonthly) : "—"],
            ["Take-home", form.salaryStructure?.netPay ? money(form.salaryStructure.netPay) : "—"],
            ["Bank", form.bankAccountNo ? `${form.bankName || ""} ${form.bankAccountNo}`.trim() : "—"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-right font-medium text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------- stage 1 */

function PersonalStage({ form, set }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Personal details" desc="Names must match the Aadhaar card exactly.">
        <Grid>
          <Field span={2} label="Full name" value={form.fullName} onChange={(v) => set("fullName", v)} />
          <Field span={2} label="Father's or spouse's name" value={form.fatherSpouseName} onChange={(v) => set("fatherSpouseName", v)} />
          <Field label="Date of birth" type="date" value={form.dob} onChange={(v) => set("dob", v)} />
          <Select
            label="Gender"
            value={form.gender}
            onChange={(v) => set("gender", v)}
            options={[{ value: "", label: "Select" }, "Male", "Female", "Other"]}
          />
          <Select
            label="Marital status"
            value={form.maritalStatus}
            onChange={(v) => set("maritalStatus", v)}
            options={[{ value: "", label: "Select" }, "Single", "Married", "Other"]}
          />
          <span />
        </Grid>
      </Card>

      <div className="space-y-5">
        <Card title="Contact">
          <Grid>
            <Field label="Mobile" value={form.mobile} onChange={(v) => set("mobile", v)} maxLength={10} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
            <Field span={2} label="Address" value={form.address} onChange={(v) => set("address", v)} placeholder="House, street, area, city, PIN" />
          </Grid>
        </Card>

        <Card title="Emergency contact" desc="Required under most factory and facility contracts.">
          <Grid>
            <Field label="Name" value={form.emergencyName} onChange={(v) => set("emergencyName", v)} />
            <Field label="Phone" value={form.emergencyPhone} onChange={(v) => set("emergencyPhone", v)} maxLength={10} />
          </Grid>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- stage 2 */

function EmploymentStage({ form, set }) {
  const s = form.salaryStructure || {};
  // mode + components are seeded onto the form at load (withSalaryDefaults)
  const [mode, setMode] = useState(form.salaryMode || "auto");
  const [components, setComponents] = useState(
    form.salaryComponents || {
      basic: s.basic || 0,
      daApplicable: s.daApplicable ?? false, da: s.da || 0,
      hra: s.hra || 0,
      conveyance: s.conveyance || 0,
      special: s.special || 0,
      travelApplicable: s.travelApplicable ?? false, travel: s.travel || 0,
      incentiveApplicable: s.incentiveApplicable ?? false, incentive: s.incentive || 0,
      medicalApplicable: s.medicalApplicable ?? false, medical: s.medical || 0,
      otherApplicable: s.otherApplicable ?? false, other: s.other || 0,
      allowanceList: s.allowanceList || [],
      pfRate: s.pfRate ?? "", pfEmployerRate: s.pfEmployerRate ?? "", pfUncapped: s.pfUncapped ?? false,
      foodApplicable: s.foodApplicable ?? false, food: s.food || 0,
      transportApplicable: s.transportApplicable ?? false, transport: s.transport || 0,
      uniformApplicable: s.uniformApplicable ?? false, uniform: s.uniform || 0,
      gratuityApplicable: s.gratuityApplicable ?? true,
      gratuity: s.gratuity || 0,
    }
  );
  const [preview, setPreview] = useState(s);
  const [busy, setBusy] = useState(false);

  const setComp = (k, v) => setComponents((c) => ({ ...c, [k]: v }));

  // tell the parent form which mode + components to save. Components (which
  // carry the gratuity choice) and the split are always sent, so the gratuity
  // toggle works in auto mode too; the server only uses components in manual.
  useEffect(() => {
    set("salaryMode", mode);
    set("salaryComponents", components);
    set("salarySplit", { gratuityApplicable: components.gratuityApplicable });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, components]);

  // when switching into manual the first time, seed the fields from the
  // current auto breakup so the admin starts from a sensible split
  function switchTo(next) {
    if (next === "manual" && (!components.basic && preview.basic)) {
      setComponents({
        basic: preview.basic || 0,
        hra: preview.hra || 0,
        conveyance: preview.conveyance || 0,
        special: preview.special || 0,
        gratuityApplicable: preview.gratuityApplicable ?? false,
        gratuity: preview.gratuity || 0,
      });
    }
    setMode(next);
  }

  // live preview — auto recomputes from CTC, manual from the components
  useEffect(() => {
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        if (mode === "manual") {
          setPreview(
            await employeeApi.salaryPreview({
              companyId: form.companyId,
              mode: "manual",
              components,
              pfApplicable: form.pfApplicable,
              esiApplicable: form.esiApplicable,
            })
          );
        } else {
          if (!form.ctcMonthly) return setPreview({});
          setPreview(
            await employeeApi.salaryPreview({
              companyId: form.companyId,
              ctcMonthly: form.ctcMonthly,
              pfApplicable: form.pfApplicable,
              esiApplicable: form.esiApplicable,
              salarySplit: { gratuityApplicable: components.gratuityApplicable },
            })
          );
        }
      } catch {
        // best-effort; the server recalculates on save anyway
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, components, form.ctcMonthly, form.companyId, form.pfApplicable, form.esiApplicable]);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <Card title="Role">
          <Grid>
            <Field label="Designation" value={form.designation} onChange={(v) => set("designation", v)} placeholder="Machine Operator" />
            <Select
              label="Department"
              value={form.department}
              onChange={(v) => set("department", v)}
              options={[{ value: "", label: "Select" }, ...departments]}
            />
            <Field label="Date of joining" type="date" value={form.doj} onChange={(v) => set("doj", v)} hint="Attendance and salary start from this date." />
            <Select
              label="Employment type"
              value={form.employmentType}
              onChange={(v) => set("employmentType", v)}
              options={employmentTypes}
            />
            <Field label="Work location" value={form.workLocation} onChange={(v) => set("workLocation", v)} placeholder="Peenya unit" />
            <Field label="Reporting to" value={form.reportingTo} onChange={(v) => set("reportingTo", v)} />
            <Field
              label="Probation (months)"
              type="number"
              value={form.probationMonths}
              onChange={(v) => set("probationMonths", Number(v))}
              min={0}
              max={24}
            />
            <span />
            <Select
              label="Shift"
              value={form.shiftPattern}
              onChange={(v) => set("shiftPattern", v)}
              options={[{ value: "", label: "Select" }, ...shifts]}
            />
            <Select
              label="Weekly off"
              value={form.weeklyOff || "Sunday"}
              onChange={(v) => set("weeklyOff", v)}
              options={["Sunday", "Saturday and Sunday", "Alternate Saturdays", "Rotational"]}
            />
          </Grid>
        </Card>

        <Card
          title="Salary"
          desc="Auto splits a monthly CTC for you. Switch to Manual to type each component yourself."
          action={
            <div className="flex rounded-md border border-slate-300 bg-white p-0.5">
              {[
                { id: "auto", label: "Auto" },
                { id: "manual", label: "Manual" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => switchTo(m.id)}
                  className={`rounded px-3 py-1 text-xs font-medium transition ${
                    mode === m.id ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          }
        >
          {mode === "auto" ? (
            <div className="space-y-3">
              <Grid>
                <Field
                  label="Monthly CTC (₹)"
                  type="number"
                  value={form.ctcMonthly}
                  onChange={(v) => set("ctcMonthly", Number(v))}
                  placeholder="28000"
                />
                <div className="flex items-end pb-1 text-sm text-slate-500">
                  {form.ctcMonthly ? `${money(form.ctcMonthly * 12)} a year` : ""}
                </div>
              </Grid>
              <div className="rounded-lg border border-slate-200 p-3">
                <Toggle
                  label="Provide gratuity"
                  checked={components.gratuityApplicable}
                  onChange={(v) => setComp("gratuityApplicable", v)}
                />
                <p className="mt-1 text-xs text-slate-400">
                  When on, 4.81% of basic is set aside as gratuity and added to the CTC cost.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Grid>
                <Field label="Basic (₹)" type="number" value={components.basic} onChange={(v) => setComp("basic", Number(v))} />
                <Field label="HRA (₹)" type="number" value={components.hra} onChange={(v) => setComp("hra", Number(v))} />
                <Field label="Conveyance (₹)" type="number" value={components.conveyance} onChange={(v) => setComp("conveyance", Number(v))} />
                <Field label="Special allowance (₹)" type="number" value={components.special} onChange={(v) => setComp("special", Number(v))} />
              </Grid>

              <div className="rounded-lg border border-slate-200 p-3">
                <Toggle
                  label="Include DA (Dearness Allowance)"
                  checked={!!components.daApplicable}
                  onChange={(v) => setComp("daApplicable", v)}
                />
                {components.daApplicable && (
                  <div className="mt-2">
                    <Field
                      label="DA (₹)"
                      type="number"
                      value={components.da}
                      onChange={(v) => setComp("da", Number(v))}
                      hint="Added to Basic when calculating PF."
                    />
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">PF settings (optional)</div>
                <Grid>
                  <Field
                    label="Employee PF rate %"
                    type="number"
                    value={components.pfRate ?? ""}
                    onChange={(v) => setComp("pfRate", v === "" ? "" : Number(v))}
                    placeholder="12"
                    hint="Blank = company default. Use 24 for double/voluntary PF."
                  />
                  <Field
                    label="Employer PF rate %"
                    type="number"
                    value={components.pfEmployerRate ?? ""}
                    onChange={(v) => setComp("pfEmployerRate", v === "" ? "" : Number(v))}
                    placeholder="13"
                  />
                </Grid>
                <div className="mt-2">
                  <Toggle
                    label="PF on full wage (ignore ₹15,000 ceiling)"
                    checked={!!components.pfUncapped}
                    onChange={(v) => setComp("pfUncapped", v)}
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ["travel", "Travel allowance"],
                  ["incentive", "Production incentive"],
                  ["medical", "Medical allowance"],
                  ["other", "Other allowance"],
                ].map(([key, label]) => (
                  <div key={key} className="rounded-lg border border-slate-200 p-3">
                    <Toggle
                      label={label}
                      checked={!!components[`${key}Applicable`]}
                      onChange={(v) => setComp(`${key}Applicable`, v)}
                    />
                    {components[`${key}Applicable`] && (
                      <div className="mt-2">
                        <Field
                          label={`${label} (₹)`}
                          type="number"
                          value={components[key]}
                          onChange={(v) => setComp(key, Number(v))}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <AllowancesPicker
                list={components.allowanceList}
                onChange={(l) => setComp("allowanceList", l)}
              />

              <div className="rounded-lg border border-slate-200 p-3">
                <Toggle
                  label="Provide gratuity"
                  checked={components.gratuityApplicable}
                  onChange={(v) => setComp("gratuityApplicable", v)}
                />
                {components.gratuityApplicable && (
                  <div className="mt-2">
                    <Field
                      label="Gratuity provision (₹ / month)"
                      type="number"
                      value={components.gratuity}
                      onChange={(v) => setComp("gratuity", Number(v))}
                      hint="Leave 0 to use the standard 4.81% of basic."
                    />
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Recoveries / deductions</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ["food", "Food"],
                    ["transport", "Transportation"],
                    ["uniform", "Uniform / Shoe"],
                  ].map(([key, label]) => (
                    <div key={key} className="rounded-lg border border-slate-200 p-3">
                      <Toggle
                        label={label}
                        checked={!!components[`${key}Applicable`]}
                        onChange={(v) => setComp(`${key}Applicable`, v)}
                      />
                      {components[`${key}Applicable`] && (
                        <div className="mt-2">
                          <Field
                            label={`${label} (₹ / month)`}
                            type="number"
                            value={components[key]}
                            onChange={(v) => setComp(key, Number(v))}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-500">Gross</span>
                <span className="font-semibold tabular-nums text-navy">
                  {money(
                    (Number(components.basic) || 0) +
                    (components.daApplicable ? Number(components.da) || 0 : 0) +
                    (Number(components.hra) || 0) +
                    (Number(components.conveyance) || 0) +
                    (Number(components.special) || 0) +
                    (components.travelApplicable ? Number(components.travel) || 0 : 0) +
                    (components.incentiveApplicable ? Number(components.incentive) || 0 : 0) +
                    (components.medicalApplicable ? Number(components.medical) || 0 : 0) +
                    (components.otherApplicable ? Number(components.other) || 0 : 0) +
                    (components.allowanceList || []).reduce((t, a) => t + (Number(a.amount) || 0), 0)
                  )}
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>

      <SalaryBreakup breakup={preview} busy={busy} ctc={mode === "manual" ? preview.gross : form.ctcMonthly} manual={mode === "manual"} />
    </div>
  );
}

function SalaryBreakup({ breakup, busy, ctc, manual }) {
  const b = breakup || {};
  const has = manual ? !!b.gross : !!ctc;

  const Row = ({ label, value, muted, strong }) => (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className={`text-sm ${muted ? "text-slate-500" : "text-slate-700"}`}>
        {label}
      </span>
      <span
        className={`tabular-nums ${
          strong ? "text-base font-semibold text-navy" : "text-sm text-slate-800"
        }`}
      >
        {money(value)}
      </span>
    </div>
  );

  return (
    <Card
      title="Salary breakup"
      desc="Calculated from this company's own PF, ESI and PT settings."
      action={busy ? <Loader2 size={15} className="animate-spin text-slate-400" /> : null}
    >
      {!has ? (
        <p className="py-8 text-center text-sm text-slate-400">
          {manual
            ? "Enter the salary components to see the breakup."
            : "Enter a monthly CTC to see the breakup."}
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Earnings
            </div>
            <div className="divide-y divide-slate-100">
              <Row label="Basic" value={b.basic} />
              {b.da > 0 && <Row label="Dearness allowance (DA)" value={b.da} />}
              <Row label="House rent allowance" value={b.hra} />
              <Row label="Conveyance" value={b.conveyance} />
              <Row label="Special allowance" value={b.special} />
              {b.travel > 0 && <Row label="Travel allowance" value={b.travel} />}
              {b.incentive > 0 && <Row label="Production incentive" value={b.incentive} />}
              {b.medical > 0 && <Row label="Medical allowance" value={b.medical} />}
              {b.other > 0 && <Row label="Other allowance" value={b.other} />}
              {(b.allowanceList || []).map((a, i) => (a.amount > 0 ? <Row key={i} label={a.type} value={a.amount} /> : null))}
              <Row label="Gross earnings" value={b.gross} strong />
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Employee deductions
            </div>
            <div className="divide-y divide-slate-100">
              <Row label="Provident fund" value={b.employeePf} muted />
              <Row label="ESI" value={b.employeeEsi} muted />
              <Row label="Professional tax" value={b.professionalTax} muted />
              {b.lwf > 0 && <Row label="Labour welfare fund" value={b.lwf} muted />}
            </div>
          </div>

          <div className="rounded-lg bg-navy px-4 py-3 text-white">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-white/70">Take-home each month</span>
              <span className="text-xl font-semibold tabular-nums text-amber">
                {money(b.netPay)}
              </span>
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Employer cost on top of gross
            </div>
            <div className="divide-y divide-slate-100">
              <Row label="PF contribution" value={b.employerPf} muted />
              <Row label="ESI contribution" value={b.employerEsi} muted />
              <Row label="Gratuity provision" value={b.gratuity} muted />
              <Row label={manual ? "Total cost to company (implied)" : "Total cost to company"} value={b.ctc} strong />
            </div>
          </div>

          {b.notes?.length > 0 && (
            <ul className="space-y-1.5 rounded-lg bg-slate-50 px-4 py-3">
              {b.notes.map((n) => (
                <li key={n} className="text-xs text-slate-600">
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------- stage 3 */

function StatutoryStage({ form, set }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Statutory identifiers" desc="These carry through to PF and ESI returns.">
        <Grid>
          <Field label="Aadhaar number" value={form.aadhaar} onChange={(v) => set("aadhaar", v.replace(/\D/g, ""))} maxLength={12} placeholder="12 digits" />
          <Field label="PAN" value={form.pan} onChange={(v) => set("pan", v.toUpperCase())} maxLength={10} placeholder="ABCDE1234F" />
          <Field
            label="UAN"
            value={form.uan}
            onChange={(v) => set("uan", v.replace(/\D/g, ""))}
            maxLength={12}
            hint={form.previousPfMember ? "Transfer the existing UAN" : "Generate a new UAN on the EPFO portal"}
          />
          <Field label="ESIC IP number" value={form.esicIp} onChange={(v) => set("esicIp", v.replace(/\D/g, ""))} maxLength={17} hint="Only if ESI applies" />
        </Grid>

        <div className="mt-2 divide-y divide-slate-100">
          <Toggle
            label="Was an EPF member before"
            hint="Declared on Form 11 — decides transfer versus fresh UAN"
            checked={!!form.previousPfMember}
            onChange={(v) => set("previousPfMember", v)}
          />
          <Toggle
            label="PF applies"
            hint="Inherited from the company, override only with a reason"
            checked={!!form.pfApplicable}
            onChange={(v) => set("pfApplicable", v)}
          />
          <Toggle
            label="ESI applies"
            hint="Only where gross is within the ESI wage limit"
            checked={!!form.esiApplicable}
            onChange={(v) => set("esiApplicable", v)}
          />
          <Toggle
            label="Professional tax applies"
            checked={!!form.ptApplicable}
            onChange={(v) => set("ptApplicable", v)}
          />
        </div>
      </Card>

      <Card
        title="Bank account"
        desc="Salary is credited here. Check it against the cancelled cheque."
      >
        <Grid>
          <Field
            span={2}
            label="Account holder name"
            value={form.bankAccountName}
            onChange={(v) => set("bankAccountName", v)}
            hint="A mismatch with the employee's name is the most common reason a transfer fails."
          />
          <Field label="Bank" value={form.bankName} onChange={(v) => set("bankName", v)} placeholder="HDFC Bank" />
          <Field label="IFSC" value={form.bankIfsc} onChange={(v) => set("bankIfsc", v.toUpperCase())} maxLength={11} placeholder="HDFC0001234" />
          <Field span={2} label="Account number" value={form.bankAccountNo} onChange={(v) => set("bankAccountNo", v.replace(/\s/g, ""))} />
        </Grid>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- stage 4 */

const DOC_TONE = {
  received: { tone: "green", label: "On file" },
  pending: { tone: "amber", label: "Awaited" },
  na: { tone: "slate", label: "Not applicable" },
};

const prettySize = (b) =>
  !b ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

function DocumentRow({ employeeId, def, rec, applyDoc }) {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const meta = DOC_TONE[rec.status] || DOC_TONE.pending;

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("File is larger than 10 MB");

    setProgress(0);
    try {
      const updated = await employeeApi.uploadDocument(employeeId, def.key, file, {
        onProgress: setProgress,
      });
      applyDoc(def.key, updated);
      toast.success(`${def.label} uploaded`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setProgress(null);
    }
  }

  async function patch(status) {
    try {
      applyDoc(def.key, await employeeApi.patchDocument(employeeId, def.key, { status }));
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 py-3.5">
      <FileText size={17} className={rec.status === "received" ? "text-navy" : "text-slate-300"} />

      <div className="min-w-48 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">{def.label}</span>
          {def.mandatory && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">
              Required
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-slate-500">
          {rec.status === "received"
            ? `${rec.file} · ${prettySize(rec.size)} · received ${rec.on}`
            : rec.status === "na"
            ? "Marked not applicable"
            : def.hint || "Not received yet"}
        </div>
        {progress !== null && (
          <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-amber transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      <Pill tone={meta.tone}>{meta.label}</Pill>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={onPick}
        className="hidden"
      />

      <div className="flex gap-2">
        {rec.status === "received" && rec.url && (
          <Button size="sm" variant="ghost" onClick={() => window.open(fileUrl(rec.url), "_blank")}>
            <Eye size={13} /> View
          </Button>
        )}
        <Button
          size="sm"
          variant={rec.status === "received" ? "subtle" : "ghost"}
          onClick={() => inputRef.current?.click()}
          disabled={progress !== null}
        >
          {progress !== null ? (
            <>
              <Loader2 size={13} className="animate-spin" /> {progress}%
            </>
          ) : (
            <>
              <Upload size={13} /> {rec.status === "received" ? "Replace" : "Upload"}
            </>
          )}
        </Button>
        {!def.mandatory && rec.status !== "na" && (
          <Button size="sm" variant="ghost" onClick={() => patch("na")}>
            <Minus size={13} /> N/A
          </Button>
        )}
        {rec.status === "na" && (
          <Button size="sm" variant="ghost" onClick={() => patch("pending")}>
            Undo N/A
          </Button>
        )}
      </div>
    </div>
  );
}

function DocumentsStage({ employeeId, form, applyDoc }) {
  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">
        PDF, JPG or PNG, up to 10 MB. Documents save the moment you upload them.
      </p>
      {employeeGroups.map((group) => {
        const rows = employeeChecklist.filter((d) => d.group === group);
        if (!rows.length) return null;
        return (
          <Card key={group} title={group}>
            <div className="divide-y divide-slate-100">
              {rows.map((d) => (
                <DocumentRow
                  key={d.key}
                  employeeId={employeeId}
                  def={d}
                  rec={form.docs?.[d.key] || { status: "pending" }}
                  applyDoc={applyDoc}
                />
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- stage 5 */

function ReviewStage({ form, pending, done, onJump, onComplete, onWithdraw }) {
  const s = form.salaryStructure || {};

  const Line = ({ k, v, to }) => (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-slate-500">{k}</dt>
      <dd className="flex items-center gap-2 text-right text-sm font-medium text-slate-800">
        {v || <span className="text-rose-500">Not set</span>}
        {to && !v && (
          <button onClick={() => onJump(to)} className="text-xs font-normal text-navy underline">
            add
          </button>
        )}
      </dd>
    </div>
  );

  return (
    <div className="space-y-5">
      {done ? (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-5 py-4 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
          <UserCheck size={18} />
          <span>
            <b>{form.fullName}</b> joined on {form.joinedOn} and is active on payroll.
          </span>
        </div>
      ) : pending.length > 0 ? (
        <div className="rounded-xl bg-amber-50 px-5 py-4 ring-1 ring-inset ring-amber-200">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <AlertTriangle size={16} />
            {pending.length} thing{pending.length > 1 ? "s" : ""} left before this joining can be completed
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1">
            {pending.map((p) => (
              <li key={p} className="text-sm text-amber-900/80">
                · {p}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-5 py-4 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
          <Check size={18} />
          Everything's in place. Complete the joining to put this employee on payroll.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Employee">
          <dl className="divide-y divide-slate-100">
            <Line k="Full name" v={form.fullName} to="personal" />
            <Line k="Employee code" v={form.employeeCode} />
            <Line k="Date of birth" v={form.dob} to="personal" />
            <Line k="Mobile" v={form.mobile} to="personal" />
            <Line k="Aadhaar" v={form.aadhaar} to="statutory" />
            <Line k="PAN" v={form.pan} to="statutory" />
            <Line k="UAN" v={form.pfApplicable ? form.uan : "PF not applicable"} to="statutory" />
          </dl>
        </Card>

        <Card title="Role and pay">
          <dl className="divide-y divide-slate-100">
            <Line k="Company" v={form.company?.name} />
            <Line k="Designation" v={form.designation} to="employment" />
            <Line k="Department" v={form.department} to="employment" />
            <Line k="Date of joining" v={form.doj} to="employment" />
            <Line k="Employment type" v={form.employmentType} />
            <Line k="Monthly CTC" v={form.ctcMonthly ? money(form.ctcMonthly) : ""} to="employment" />
            <Line k="Take-home" v={s.netPay ? money(s.netPay) : ""} to="employment" />
          </dl>
        </Card>

        <Card title="Bank">
          <dl className="divide-y divide-slate-100">
            <Line k="Account holder" v={form.bankAccountName} to="statutory" />
            <Line k="Bank" v={form.bankName} to="statutory" />
            <Line k="Account number" v={form.bankAccountNo} to="statutory" />
            <Line k="IFSC" v={form.bankIfsc} to="statutory" />
          </dl>
        </Card>

        <Card
          title="Documents"
          action={
            <button onClick={() => onJump("documents")} className="text-xs text-navy underline">
              Open
            </button>
          }
        >
          <div className="mb-4">
            <ReadinessBar value={docProgress(form)} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {employeeChecklist.map((d) => {
              const st = form.docs?.[d.key]?.status || "pending";
              return (
                <span
                  key={d.key}
                  title={d.label}
                  className={`rounded px-2 py-1 text-xs ${
                    st === "received"
                      ? "bg-emerald-50 text-emerald-700"
                      : st === "na"
                      ? "bg-slate-100 text-slate-400 line-through"
                      : d.mandatory
                      ? "bg-rose-50 text-rose-600"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {d.label}
                </span>
              );
            })}
          </div>
        </Card>
      </div>

      {!done && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="text-sm font-medium text-navy">Ready to put on payroll?</div>
            <p className="mt-0.5 text-xs text-slate-500">
              Completing adds the employee to the company headcount and starts attendance from the joining date.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="danger" onClick={onWithdraw}>
              <Trash2 size={15} /> Withdraw
            </Button>
            <Button variant="accent" onClick={onComplete} disabled={pending.length > 0}>
              <UserCheck size={15} /> Complete joining
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
