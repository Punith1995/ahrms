import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft, Check, RotateCcw, Loader2, AlertTriangle, Upload, Eye,
  Minus, FileText, UserMinus, Phone, Mail, Copy, Camera, PauseCircle, PlayCircle, X, Plus, Trash2,
} from "lucide-react";
import { employeeApi, errorText, fileUrl } from "../lib/api";
import {
  employeeChecklist, employeeGroups, departments, employmentTypes, shifts,
  docProgress, money,
} from "../data/employeeChecklist";
import {
  Button, Card, Field, Grid, Monogram, Pill, ReadinessBar, Select, Toggle,
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

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "employment", label: "Employment" },
  { id: "statutory", label: "Statutory & bank" },
  { id: "salary", label: "Salary" },
  { id: "documents", label: "Documents" },
];

const clone = (o) => JSON.parse(JSON.stringify(o));

// Seed the salary mode + editable components from the saved structure, so the
// manual editor round-trips and doesn't falsely flag unsaved changes on load.
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

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [tab, setTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [holdBusy, setHoldBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await employeeApi.get(id);
        if (!alive) return;
        const seeded = withSalaryDefaults(data);
        setSaved(seeded);
        setForm(clone(seeded));
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
        <p className="text-sm font-medium text-slate-700">
          {loadError || "Employee not found"}
        </p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/employees")}>
          Back to employees
        </Button>
      </div>
    );
  }

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const applyDoc = (docKey, rec) => {
    setForm((f) => ({ ...f, docs: { ...f.docs, [docKey]: rec } }));
    setSaved((s) => ({ ...s, docs: { ...s.docs, [docKey]: rec } }));
  };

  async function save() {
    setSaving(true);
    try {
      const { docs, company, ...body } = form;
      const updated = await employeeApi.update(form.id, body);
      const seeded = withSalaryDefaults(updated);
      setSaved(seeded);
      setForm(clone(seeded));
      toast.success("Changes saved");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function reactivate() {
    if (!window.confirm(`Re-activate ${form.fullName}? They will become an active employee again — no re-registration needed.`)) return;
    try {
      const updated = await employeeApi.reactivate(form.id);
      setForm((f) => ({ ...f, status: updated.status, joiningStatus: updated.joiningStatus, salaryHold: updated.salaryHold, salaryHoldReason: updated.salaryHoldReason }));
      setSaved((s) => ({ ...s, status: updated.status }));
      toast.success(`${form.fullName} re-activated`);
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  async function applyHold(hold, reason) {
    setHoldBusy(true);
    try {
      const updated = await employeeApi.hold(form.id, hold, reason);
      setForm((f) => ({
        ...f,
        salaryHold: updated.salaryHold,
        salaryHoldReason: updated.salaryHoldReason,
      }));
      setSaved((s) => ({
        ...s,
        salaryHold: updated.salaryHold,
        salaryHoldReason: updated.salaryHoldReason,
      }));
      setHoldOpen(false);
      setHoldReason("");
      toast.success(hold ? "Salary held" : "Salary released");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setHoldBusy(false);
    }
  }

  const exited = form.status === "Exited";

  return (
    <div className="space-y-5 pb-24">
      <button
        onClick={() => navigate("/employees")}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy"
      >
        <ArrowLeft size={15} /> Employees
      </button>

      {/* header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start gap-5">
          <EmployeePhoto form={form} setForm={setForm} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg font-semibold text-navy">{form.fullName}</h1>
              <Pill tone={form.status === "Active" ? "green" : "slate"}>
                {form.status}
              </Pill>
              {form.salaryHold && <Pill tone="red">Salary held</Pill>}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {form.employeeCode} · {form.designation || "No designation"} · {form.company?.name}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
              {form.mobile && (
                <a href={`tel:${form.mobile}`} className="flex items-center gap-1.5 hover:text-navy">
                  <Phone size={12} /> {form.mobile}
                </a>
              )}
              {form.email && (
                <a href={`mailto:${form.email}`} className="flex items-center gap-1.5 hover:text-navy">
                  <Mail size={12} /> {form.email}
                </a>
              )}
              <span>Joined <b className="text-slate-700">{form.joinedOn || form.doj || "—"}</b></span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <div className="text-xs text-slate-500">Take-home / month</div>
              <div className="text-lg font-semibold tabular-nums text-navy">
                {form.salaryStructure?.netPay ? money(form.salaryStructure.netPay) : "—"}
              </div>
            </div>
            {!exited && (
              <div className="flex gap-2">
                {form.salaryHold ? (
                  <Button variant="ghost" size="sm" onClick={() => applyHold(false)} disabled={holdBusy}>
                    <PlayCircle size={14} /> Release salary
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setHoldOpen(true)}>
                    <PauseCircle size={14} /> Hold salary
                  </Button>
                )}
                <Button variant="danger" size="sm" onClick={() => navigate("/exit")}>
                  <UserMinus size={14} /> Start exit
                </Button>
              </div>
            )}
            {exited && (
              <Button variant="accent" size="sm" onClick={reactivate}>
                <PlayCircle size={14} /> Re-activate employee
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.id
                ? "border-amber text-navy"
                : "border-transparent text-slate-500 hover:text-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileTab form={form} set={set} />}
      {tab === "employment" && <EmploymentTab form={form} set={set} />}
      {tab === "statutory" && <StatutoryTab form={form} set={set} />}
      {tab === "salary" && <SalaryTab form={form} set={set} />}
      {tab === "documents" && (
        <DocumentsTab employeeId={form.id} form={form} applyDoc={applyDoc} />
      )}

      {dirty && (
        <div className="fixed bottom-0 left-60 right-0 z-40 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-600">You have unsaved changes.</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setForm(clone(saved))}>
                <RotateCcw size={15} /> Discard
              </Button>
              <Button variant="accent" onClick={save} disabled={saving}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {holdOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-navy">Hold this salary</h2>
              <button onClick={() => setHoldOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </header>
            <div className="space-y-3 p-5">
              <p className="text-sm text-slate-600">
                Held salary is still calculated on the payroll register, but the employee is
                left out of the bank transfer until you release it.
              </p>
              <Field
                label="Reason (optional)"
                value={holdReason}
                onChange={setHoldReason}
                placeholder="Pending clearance, dispute, etc."
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => setHoldOpen(false)}>Cancel</Button>
                <Button variant="accent" onClick={() => applyHold(true, holdReason)} disabled={holdBusy}>
                  {holdBusy ? "Holding…" : "Hold salary"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeePhoto({ form, setForm }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return toast.error("Please choose an image file");
    }
    setBusy(true);
    try {
      const updated = await employeeApi.uploadPhoto(form.id, file);
      // keep edits, just refresh the photo
      setForm((f) => ({ ...f, photoUrl: updated.photoUrl }));
      toast.success("Photo updated");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const initials = (form.fullName || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative h-16 w-16 shrink-0">
      {form.photoUrl ? (
        <img
          src={fileUrl(`/uploads/${form.photoUrl}`)}
          alt={form.fullName}
          className="h-16 w-16 rounded-full object-cover ring-2 ring-slate-100"
        />
      ) : (
        <div className="grid h-16 w-16 place-items-center rounded-full bg-navy text-lg font-semibold text-white ring-2 ring-slate-100">
          {initials}
        </div>
      )}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Change photo"
        className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-amber text-navy shadow ring-2 ring-white hover:brightness-95"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
      </button>
      <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
    </div>
  );
}

/* ------------------------------------------------------------------ tabs */

function ProfileTab({ form, set }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Personal details">
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
            <Field span={2} label="Address" value={form.address} onChange={(v) => set("address", v)} />
          </Grid>
        </Card>

        <Card title="Emergency contact">
          <Grid>
            <Field label="Name" value={form.emergencyName} onChange={(v) => set("emergencyName", v)} />
            <Field label="Phone" value={form.emergencyPhone} onChange={(v) => set("emergencyPhone", v)} maxLength={10} />
          </Grid>
        </Card>
      </div>
    </div>
  );
}

function EmploymentTab({ form, set }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Role">
        <Grid>
          <Field
            label="Employee code (ID)"
            value={form.employeeCode}
            onChange={(v) => set("employeeCode", v.toUpperCase())}
            hint="Must be unique within the company."
          />
          <span />
          <Field label="Designation" value={form.designation} onChange={(v) => set("designation", v)} />
          <Select
            label="Department"
            value={form.department}
            onChange={(v) => set("department", v)}
            options={[{ value: "", label: "Select" }, ...departments]}
          />
          <Field label="Date of joining" type="date" value={form.doj} onChange={(v) => set("doj", v)} />
          <Select
            label="Employment type"
            value={form.employmentType}
            onChange={(v) => set("employmentType", v)}
            options={employmentTypes}
          />
          <Field label="Work location" value={form.workLocation} onChange={(v) => set("workLocation", v)} />
          <Field label="Reporting to" value={form.reportingTo} onChange={(v) => set("reportingTo", v)} />
        </Grid>
      </Card>

      <Card title="Attendance and shift">
        <Grid>
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
          <Field
            label="Probation (months)"
            type="number"
            value={form.probationMonths}
            onChange={(v) => set("probationMonths", Number(v))}
            min={0}
            max={24}
          />
          <span />
        </Grid>
      </Card>
    </div>
  );
}

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  if (!value) {
    return (
      <div>
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="mt-1 text-sm text-slate-400">Not on record</div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="mt-1 flex items-center gap-2 font-mono text-sm text-slate-800 hover:text-navy"
      >
        {value}
        {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} className="text-slate-400" />}
      </button>
    </div>
  );
}

function StatutoryTab({ form, set }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Statutory identifiers" desc="Tap a number to copy it for returns.">
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <CopyField label="Aadhaar" value={form.aadhaar} />
          <CopyField label="PAN" value={form.pan} />
          <CopyField label="UAN" value={form.uan} />
          <CopyField label="ESIC IP" value={form.esicIp} />
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <Grid>
            <Field label="Aadhaar" value={form.aadhaar} onChange={(v) => set("aadhaar", v.replace(/\D/g, ""))} maxLength={12} />
            <Field label="PAN" value={form.pan} onChange={(v) => set("pan", v.toUpperCase())} maxLength={10} />
            <Field label="UAN" value={form.uan} onChange={(v) => set("uan", v.replace(/\D/g, ""))} maxLength={12} />
            <Field label="ESIC IP number" value={form.esicIp} onChange={(v) => set("esicIp", v.replace(/\D/g, ""))} maxLength={17} />
          </Grid>
        </div>

        <div className="mt-3 divide-y divide-slate-100">
          <Toggle label="PF applies" checked={!!form.pfApplicable} onChange={(v) => set("pfApplicable", v)} />
          <Toggle label="ESI applies" checked={!!form.esiApplicable} onChange={(v) => set("esiApplicable", v)} />
          <Toggle label="Professional tax applies" checked={!!form.ptApplicable} onChange={(v) => set("ptApplicable", v)} />
        </div>
      </Card>

      <Card title="Bank account" desc="Salary is credited here.">
        <Grid>
          <Field span={2} label="Account holder name" value={form.bankAccountName} onChange={(v) => set("bankAccountName", v)} />
          <Field label="Bank" value={form.bankName} onChange={(v) => set("bankName", v)} />
          <Field label="IFSC" value={form.bankIfsc} onChange={(v) => set("bankIfsc", v.toUpperCase())} maxLength={11} />
          <Field span={2} label="Account number" value={form.bankAccountNo} onChange={(v) => set("bankAccountNo", v.replace(/\s/g, ""))} />
        </Grid>
        <p className="mt-4 text-xs text-slate-500">
          Changing pay or PF/ESI eligibility rebuilds the salary breakup automatically.
        </p>
      </Card>
    </div>
  );
}

function SalaryTab({ form, set }) {
  const s = form.salaryStructure || {};
  const [mode, setMode] = useState(form.salaryMode || "auto");
  const [components, setComponents] = useState(
    form.salaryComponents || {
      basic: s.basic || 0,
      daApplicable: s.daApplicable ?? false, da: s.da || 0, hra: s.hra || 0, conveyance: s.conveyance || 0,
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

  // push mode + components onto the form so save persists them. Components and
  // the split are always sent so the gratuity toggle also works in auto mode.
  useEffect(() => {
    set("salaryMode", mode);
    set("salaryComponents", components);
    set("salarySplit", { gratuityApplicable: components.gratuityApplicable });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, components]);

  function switchTo(next) {
    if (next === "manual" && !components.basic && preview.basic) {
      setComponents({
        basic: preview.basic || 0,
        daApplicable: preview.daApplicable ?? false, da: preview.da || 0, hra: preview.hra || 0,
        conveyance: preview.conveyance || 0, special: preview.special || 0,
        travelApplicable: preview.travelApplicable ?? false, travel: preview.travel || 0,
        incentiveApplicable: preview.incentiveApplicable ?? false, incentive: preview.incentive || 0,
        medicalApplicable: preview.medicalApplicable ?? false, medical: preview.medical || 0,
        otherApplicable: preview.otherApplicable ?? false, other: preview.other || 0,
        allowanceList: preview.allowanceList || [],
        pfRate: preview.pfRate ?? "", pfEmployerRate: preview.pfEmployerRate ?? "", pfUncapped: preview.pfUncapped ?? false,
        foodApplicable: preview.foodApplicable ?? false, food: preview.food || 0,
        transportApplicable: preview.transportApplicable ?? false, transport: preview.transport || 0,
        uniformApplicable: preview.uniformApplicable ?? false, uniform: preview.uniform || 0,
        gratuityApplicable: preview.gratuityApplicable ?? true,
        gratuity: preview.gratuity || 0,
      });
    }
    setMode(next);
  }

  // live preview: auto from CTC, manual from the components
  useEffect(() => {
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        if (mode === "manual") {
          setPreview(
            await employeeApi.salaryPreview({
              companyId: form.companyId, mode: "manual", components,
              pfApplicable: form.pfApplicable, esiApplicable: form.esiApplicable,
            })
          );
        } else {
          if (!form.ctcMonthly) return setPreview({});
          setPreview(
            await employeeApi.salaryPreview({
              companyId: form.companyId, ctcMonthly: form.ctcMonthly,
              pfApplicable: form.pfApplicable, esiApplicable: form.esiApplicable,
              salarySplit: { gratuityApplicable: components.gratuityApplicable },
            })
          );
        }
      } catch {
        // best-effort; server recalculates on save
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, components, form.ctcMonthly, form.companyId, form.pfApplicable, form.esiApplicable]);

  const b = preview || {};
  const Row = ({ label, value, muted, strong }) => (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className={`text-sm ${muted ? "text-slate-500" : "text-slate-700"}`}>{label}</span>
      <span className={`tabular-nums ${strong ? "text-base font-semibold text-navy" : "text-sm text-slate-800"}`}>
        {money(value)}
      </span>
    </div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card
        title="Salary setup"
        desc={mode === "auto"
          ? "Enter the monthly CTC — the split follows from it."
          : "Type each component. Deductions follow from company rules."}
        action={
          <div className="flex rounded-md border border-slate-300 bg-white p-0.5 text-xs">
            <button type="button" onClick={() => switchTo("auto")}
              className={`rounded px-2.5 py-1 font-medium transition ${mode === "auto" ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              Auto
            </button>
            <button type="button" onClick={() => switchTo("manual")}
              className={`rounded px-2.5 py-1 font-medium transition ${mode === "manual" ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              Manual
            </button>
          </div>
        }
      >
        {mode === "auto" ? (
          <div className="space-y-3">
            <Grid>
              <Field label="Monthly CTC (₹)" type="number" value={form.ctcMonthly}
                onChange={(v) => set("ctcMonthly", Number(v))} placeholder="28000" />
              <div className="flex items-end pb-1 text-sm text-slate-500">
                {form.ctcMonthly ? `${money(form.ctcMonthly * 12)} a year` : ""}
              </div>
            </Grid>
            <div className="rounded-lg border border-slate-200 p-3">
              <Toggle
                label="Include gratuity provision"
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
              <Toggle label="Include DA (Dearness Allowance)"
                checked={!!components.daApplicable}
                onChange={(v) => setComp("daApplicable", v)} />
              {components.daApplicable && (
                <div className="mt-2">
                  <Field label="DA (₹)" type="number" value={components.da}
                    onChange={(v) => setComp("da", Number(v))}
                    hint="Added to Basic when calculating PF." />
                </div>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">PF settings (optional)</div>
              <Grid>
                <Field label="Employee PF rate %" type="number" value={components.pfRate ?? ""}
                  onChange={(v) => setComp("pfRate", v === "" ? "" : Number(v))}
                  placeholder="12" hint="Blank = company default. 24 for double PF." />
                <Field label="Employer PF rate %" type="number" value={components.pfEmployerRate ?? ""}
                  onChange={(v) => setComp("pfEmployerRate", v === "" ? "" : Number(v))} placeholder="13" />
              </Grid>
              <div className="mt-2">
                <Toggle label="PF on full wage (ignore ₹15,000 ceiling)"
                  checked={!!components.pfUncapped}
                  onChange={(v) => setComp("pfUncapped", v)} />
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
              <Toggle label="Include gratuity provision"
                checked={components.gratuityApplicable}
                onChange={(v) => setComp("gratuityApplicable", v)} />
              {components.gratuityApplicable && (
                <div className="mt-2">
                  <Field label="Gratuity (₹ / month)" type="number" value={components.gratuity}
                    onChange={(v) => setComp("gratuity", Number(v))}
                    hint="Leave 0 to use the standard 4.81% of basic." />
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
          </div>
        )}

        <div className="mt-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            Earnings {busy && <Loader2 size={11} className="ml-1 inline animate-spin text-slate-400" />}
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
        <div className="mt-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Deductions</div>
          <div className="divide-y divide-slate-100">
            <Row label="Provident fund" value={b.employeePf} muted />
            <Row label="ESI" value={b.employeeEsi} muted />
            <Row label="Professional tax" value={b.professionalTax} muted />
            {b.lwf > 0 && <Row label="Labour welfare fund" value={b.lwf} muted />}
            {b.food > 0 && <Row label="Food" value={b.food} muted />}
            {b.transport > 0 && <Row label="Transportation" value={b.transport} muted />}
            {b.uniform > 0 && <Row label="Uniform / Shoe" value={b.uniform} muted />}
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-navy px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-white/70">Take-home each month</span>
            <span className="text-xl font-semibold tabular-nums text-amber">{money(b.netPay)}</span>
          </div>
        </div>
      </Card>

      <Card title="Cost to company">
        <div className="divide-y divide-slate-100">
          <Row label="Gross earnings" value={b.gross} />
          <Row label="Employer PF" value={b.employerPf} muted />
          <Row label="Employer ESI" value={b.employerEsi} muted />
          <Row label="Gratuity provision" value={b.gratuity} muted />
          <Row label={mode === "manual" ? "Total monthly CTC (implied)" : "Total monthly CTC"} value={b.ctc} strong />
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Annual CTC <b className="text-navy">{money((b.ctc || 0) * 12)}</b>
        </div>
        {b.notes?.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {b.notes.map((n) => (
              <li key={n} className="text-xs text-slate-500">· {n}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------- documents */

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
            <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">Required</span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-slate-500">
          {rec.status === "received"
            ? `${rec.file} · ${prettySize(rec.size)} · received ${rec.on}`
            : rec.status === "na"
            ? "Marked not applicable"
            : "Not received yet"}
        </div>
        {progress !== null && (
          <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-amber transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <Pill tone={meta.tone}>{meta.label}</Pill>
      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={onPick} className="hidden" />
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
            <><Loader2 size={13} className="animate-spin" /> {progress}%</>
          ) : (
            <><Upload size={13} /> {rec.status === "received" ? "Replace" : "Upload"}</>
          )}
        </Button>
        {!def.mandatory && rec.status !== "na" && (
          <Button size="sm" variant="ghost" onClick={() => patch("na")}>
            <Minus size={13} /> N/A
          </Button>
        )}
        {rec.status === "na" && (
          <Button size="sm" variant="ghost" onClick={() => patch("pending")}>Undo N/A</Button>
        )}
      </div>
    </div>
  );
}

function DocumentsTab({ employeeId, form, applyDoc }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-navy">Document file</div>
          <p className="mt-0.5 text-xs text-slate-500">
            Everything collected during joining, kept for the employee's full tenure.
          </p>
        </div>
        <div className="w-44">
          <ReadinessBar value={docProgress(form)} />
        </div>
      </div>

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
