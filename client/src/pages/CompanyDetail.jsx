import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft, Check, FileText, Upload, Minus, RotateCcw, AlertTriangle,
  Eye, Loader2,
} from "lucide-react";
import { companyApi, errorText, fileUrl } from "../lib/api";
import {
  documentChecklist, documentGroups, expiringDocs, readiness,
  missingMandatory, states, entityTypes,
} from "../data/checklist";
import {
  Button, Card, Field, Grid, Monogram, Pill, ReadinessBar, Select, Toggle,
} from "../components/ui";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "registrations", label: "Registrations" },
  { id: "documents", label: "Documents" },
  { id: "payroll", label: "Payroll setup" },
  { id: "compliance", label: "Compliance" },
  { id: "authorization", label: "Authorization" },
];

const clone = (o) => JSON.parse(JSON.stringify(o));

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [saved, setSaved] = useState(null); // last state from the server
  const [form, setForm] = useState(null); // what's on screen
  const [tab, setTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await companyApi.get(id);
        if (!alive) return;
        setSaved(data);
        setForm(clone(data));
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
          {loadError || "Company not found"}
        </p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/companies")}>
          Back to companies
        </Button>
      </div>
    );
  }

  const set = (path, value) =>
    setForm((f) => {
      const next = clone(f);
      const keys = path.split(".");
      let node = next;
      keys.slice(0, -1).forEach((k) => {
        if (node[k] === undefined || node[k] === null) node[k] = {};
        node = node[k];
      });
      node[keys.at(-1)] = value;
      return next;
    });

  /** Documents save the moment they change, so both copies are updated. */
  const applyDoc = (docKey, rec) => {
    setForm((f) => ({ ...f, docs: { ...f.docs, [docKey]: rec } }));
    setSaved((s) => ({ ...s, docs: { ...s.docs, [docKey]: rec } }));
  };

  async function save() {
    setSaving(true);
    try {
      const { docs, logo, ...body } = form;
      const updated = await companyApi.update(form.id, body);
      setSaved(updated);
      setForm(clone(updated));
      toast.success("Changes saved");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function changeLogo(file) {
    try {
      const updated = await companyApi.uploadLogo(form.id, file);
      setSaved(updated);
      setForm((f) => ({ ...clone(f), logo: updated.logo }));
      toast.success("Logo updated");
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  const missing = missingMandatory(form);

  return (
    <div className="space-y-5 pb-24">
      <button
        onClick={() => navigate("/companies")}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy"
      >
        <ArrowLeft size={15} /> Companies
      </button>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <Monogram name={form.name} logo={fileUrl(form.logo)} size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-lg font-semibold text-navy">{form.name}</h1>
                <Pill tone={form.status === "Active" ? "green" : "amber"}>
                  {form.status}
                </Pill>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{form.legalName}</p>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-500 sm:flex sm:flex-wrap sm:gap-x-6 sm:gap-y-1">
                <span>Code <b className="text-slate-700">{form.code}</b></span>
                <span>Employees <b className="text-slate-700">{form.headcount}</b></span>
                <span>Salary on <b className="text-slate-700">day {form.payroll?.salaryDate ?? "—"}</b></span>
                <span>Client since <b className="text-slate-700">{form.onboardedOn || "—"}</b></span>
              </div>
            </div>
          </div>
          <div className="w-full shrink-0 sm:w-44">
            <div className="text-xs font-medium text-slate-500">Documents on file</div>
            <div className="mt-2">
              <ReadinessBar value={readiness(form)} />
            </div>
          </div>
        </div>

        {missing.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
            <AlertTriangle size={15} className="shrink-0" />
            <span className="font-medium">Mandatory papers not yet received:</span>
            <span>{missing.map((d) => d.label).join(", ")}</span>
            <button
              onClick={() => setTab("documents")}
              className="ml-auto shrink-0 font-medium underline underline-offset-2"
            >
              Open documents
            </button>
          </div>
        )}
      </div>

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

      {tab === "profile" && (
        <ProfileTab form={form} set={set} onLogo={changeLogo} />
      )}
      {tab === "registrations" && <RegistrationsTab form={form} set={set} />}
      {tab === "documents" && (
        <DocumentsTab companyId={form.id} form={form} applyDoc={applyDoc} />
      )}
      {tab === "payroll" && <PayrollTab form={form} set={set} />}
      {tab === "compliance" && <ComplianceTab form={form} set={set} />}
      {tab === "authorization" && <AuthorizationTab form={form} set={set} />}

      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:left-64">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            <span className="hidden text-sm text-slate-600 sm:inline">You have unsaved changes.</span>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button variant="ghost" onClick={() => setForm(clone(saved))} className="flex-1 sm:flex-none">
                <RotateCcw size={15} /> Discard
              </Button>
              <Button variant="accent" onClick={save} disabled={saving} className="flex-1 sm:flex-none">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- documents */

const DOC_TONE = {
  received: { tone: "green", label: "On file" },
  pending: { tone: "amber", label: "Awaited" },
  na: { tone: "slate", label: "Not applicable" },
};

const prettySize = (b) =>
  !b ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

function DocumentRow({ companyId, def, rec, applyDoc }) {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const expired = rec.expires && rec.expires < today;
  const meta = DOC_TONE[rec.status] || DOC_TONE.pending;
  const tracksExpiry = expiringDocs.includes(def.key);

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is larger than 10 MB");
      return;
    }

    setProgress(0);
    try {
      const updated = await companyApi.uploadDocument(companyId, def.key, file, {
        expiresOn: rec.expires || "",
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

  async function patch(body) {
    try {
      const updated = await companyApi.patchDocument(companyId, def.key, body);
      applyDoc(def.key, updated);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 py-3.5">
      <FileText
        size={17}
        className={rec.status === "received" ? "text-navy" : "text-slate-300"}
      />

      <div className="min-w-48 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">{def.label}</span>
          {def.mandatory && rec.status !== "na" && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">
              Required
            </span>
          )}
        </div>

        <div className="mt-0.5 text-xs text-slate-500">
          {rec.status === "received"
            ? `${rec.file} · ${prettySize(rec.size)} · received ${rec.on}`
            : rec.status === "na"
            ? "Marked not applicable for this company"
            : "Not received yet"}
        </div>

        {progress !== null && (
          <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-amber transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {tracksExpiry && rec.status !== "na" && (
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Valid till
          <input
            type="date"
            value={rec.expires || ""}
            onChange={(e) => patch({ expiresOn: e.target.value })}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-800 outline-none focus:border-navy"
          />
        </label>
      )}

      <Pill tone={expired ? "red" : meta.tone}>
        {expired ? "Expired" : meta.label}
      </Pill>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={onPick}
        className="hidden"
      />

      <div className="flex gap-2">
        {rec.status === "received" && rec.url && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.open(fileUrl(rec.url), "_blank")}
          >
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

        {rec.status !== "na" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => patch({ status: "na" })}
            title="Does not apply to this company"
          >
            <Minus size={13} /> N/A
          </Button>
        )}

        {rec.status === "na" && (
          <Button size="sm" variant="ghost" onClick={() => patch({ status: "pending" })}>
            Undo N/A
          </Button>
        )}
      </div>
    </div>
  );
}

function DocumentsTab({ companyId, form, applyDoc }) {
  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">
        PDF, JPG or PNG, up to 10 MB. Documents save as soon as you upload them —
        the Save button below is only for the form fields.
      </p>

      {documentGroups.map((group) => {
        const rows = documentChecklist.filter((d) => d.group === group);
        if (!rows.length) return null;
        return (
          <Card key={group} title={group}>
            <div className="divide-y divide-slate-100">
              {rows.map((d) => (
                <DocumentRow
                  key={d.key}
                  companyId={companyId}
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

/* ------------------------------------------------------------------- tabs */

function ProfileTab({ form, set, onLogo }) {
  const logoRef = useRef(null);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Company details" desc="This is what prints on the payslip.">
        <Grid>
          <Field label="Short name" value={form.name} onChange={(v) => set("name", v)} />
          <Field label="Code" value={form.code} onChange={(v) => set("code", v.toUpperCase())} />
          <Field span={2} label="Legal name" value={form.legalName} onChange={(v) => set("legalName", v)} />
          <Select label="Entity type" value={form.entityType} onChange={(v) => set("entityType", v)} options={entityTypes} />
          <Field label="Industry" value={form.industry} onChange={(v) => set("industry", v)} placeholder="Textile manufacturing" />
          <Field span={2} label="Registered address" value={form.address} onChange={(v) => set("address", v)} />
          <Field label="City" value={form.city} onChange={(v) => set("city", v)} />
          <Select label="State" value={form.state} onChange={(v) => set("state", v)} options={states} />
          <Field label="PIN code" value={form.pin} onChange={(v) => set("pin", v)} maxLength={6} />
          <Select
            label="Status"
            value={form.status}
            onChange={(v) => set("status", v)}
            options={["Active", "Onboarding", "On hold", "Closed"]}
          />
        </Grid>
      </Card>

      <div className="space-y-5">
        <Card title="Payslip logo" desc="Ashwija's branding never appears on client payslips.">
          <div className="flex items-center gap-5">
            <Monogram name={form.name} logo={fileUrl(form.logo)} size={72} />
            <div>
              <input
                ref={logoRef}
                type="file"
                accept=".png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) onLogo(f);
                }}
              />
              <Button variant="ghost" size="sm" onClick={() => logoRef.current?.click()}>
                <Upload size={14} /> Upload logo
              </Button>
              <p className="mt-2 text-xs text-slate-500">
                PNG with a transparent background, at least 400px wide.
              </p>
            </div>
          </div>
        </Card>

        <Card title="Primary contact">
          <Grid>
            <Field label="Contact person" value={form.contactPerson} onChange={(v) => set("contactPerson", v)} />
            <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} maxLength={10} />
            <Field span={2} label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
          </Grid>
        </Card>

        <Card title="Bank account" desc="Used for the monthly salary transfer file.">
          <Grid>
            <Field span={2} label="Account name" value={form.bank?.accountName} onChange={(v) => set("bank.accountName", v)} />
            <Field label="Bank" value={form.bank?.bankName} onChange={(v) => set("bank.bankName", v)} />
            <Field label="Branch" value={form.bank?.branch} onChange={(v) => set("bank.branch", v)} />
            <Field label="Account number" value={form.bank?.accountNo} onChange={(v) => set("bank.accountNo", v)} />
            <Field label="IFSC" value={form.bank?.ifsc} onChange={(v) => set("bank.ifsc", v.toUpperCase())} maxLength={11} />
            <Select
              label="Transfer mode"
              value={form.bank?.transferMode || "NEFT"}
              onChange={(v) => set("bank.transferMode", v)}
              options={["NEFT", "RTGS", "IMPS", "Bank's own upload format"]}
            />
          </Grid>
        </Card>
      </div>
    </div>
  );
}

const REG_ROWS = [
  { key: "pan", label: "Company PAN", hint: "10 characters", expiry: false },
  { key: "tan", label: "TAN", hint: "For TDS filing", expiry: false },
  { key: "cin", label: "CIN / LLPIN", hint: "As on the incorporation certificate", expiry: false },
  { key: "gstin", label: "GSTIN", hint: "If registered", expiry: false },
  { key: "shops", label: "Shops & establishment", hint: "", expiry: true },
  { key: "factory", label: "Factory licence", hint: "Manufacturing units only", expiry: true },
  { key: "clra", label: "Labour licence (CLRA)", hint: "If contract labour is engaged", expiry: true },
  { key: "ptr", label: "Professional tax — PTR", hint: "Employer registration", expiry: false },
  { key: "ptec", label: "Professional tax — PTEC", hint: "Enrolment certificate", expiry: false },
  { key: "epf", label: "EPF code", hint: "", expiry: false },
  { key: "esi", label: "ESI code", hint: "", expiry: false },
  { key: "lwf", label: "LWF registration", hint: "Where the state requires it", expiry: false },
];

function RegistrationsTab({ form, set }) {
  return (
    <Card
      title="Statutory registrations"
      desc="Leave a field blank where the registration does not apply to this company."
    >
      <div className="divide-y divide-slate-100">
        {REG_ROWS.map((r) => (
          <div key={r.key} className="grid gap-4 py-3.5 sm:grid-cols-[1fr_1.2fr_auto] sm:items-center">
            <div>
              <div className="text-sm font-medium text-slate-700">{r.label}</div>
              {r.hint && <div className="text-xs text-slate-500">{r.hint}</div>}
            </div>
            <input
              value={form.registrations?.[r.key]?.number || ""}
              onChange={(e) => set(`registrations.${r.key}.number`, e.target.value)}
              placeholder="Not applicable"
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm tracking-wide text-slate-800 outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
            />
            {r.expiry ? (
              <label className="flex items-center gap-2 text-xs text-slate-500">
                Valid till
                <input
                  type="date"
                  value={form.registrations?.[r.key]?.validTill || ""}
                  onChange={(e) => set(`registrations.${r.key}.validTill`, e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-navy"
                />
              </label>
            ) : (
              <span className="hidden sm:block sm:w-40" />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function PayrollTab({ form, set }) {
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const p = form.payroll || {};
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Wage period and pay day">
        <Grid>
          <Select label="Wage period starts on" value={String(p.wagePeriodFrom ?? 1)} onChange={(v) => set("payroll.wagePeriodFrom", Number(v))} options={days} />
          <Select label="Wage period ends on" value={String(p.wagePeriodTo ?? 30)} onChange={(v) => set("payroll.wagePeriodTo", Number(v))} options={days} />
          <Select label="Salary credited on" value={String(p.salaryDate ?? 7)} onChange={(v) => set("payroll.salaryDate", Number(v))} options={days} />
          <Select
            label="Weekly off"
            value={p.weeklyOff || "Sunday"}
            onChange={(v) => set("payroll.weeklyOff", v)}
            options={["Sunday", "Saturday and Sunday", "Alternate Saturdays", "Rotational"]}
          />
          <Field
            label="Paid holidays per year"
            type="number"
            value={p.holidayCount ?? 10}
            onChange={(v) => set("payroll.holidayCount", Number(v))}
            hint="The dated list lives on the Leaves page."
          />
        </Grid>
      </Card>

      <Card title="Pay components" desc="Switch on only what this company actually pays.">
        <div className="divide-y divide-slate-100">
          <Toggle
            label="Overtime"
            hint="Calculated from the attendance register"
            checked={!!p.otApplicable}
            onChange={(v) => set("payroll.otApplicable", v)}
          />
          {p.otApplicable && (
            <div className="space-y-3 py-3">
              <Field label="Overtime rate" value={p.otRate} onChange={(v) => set("payroll.otRate", v)} placeholder="2x basic" />
              <Select
                label="Pay overtime as"
                value={p.otAsIncentive ? "incentive" : "overtime"}
                onChange={(v) => set("payroll.otAsIncentive", v === "incentive")}
                options={[
                  { value: "overtime", label: "Overtime (separate line)" },
                  { value: "incentive", label: "Production Incentive" },
                ]}
              />
              <p className="text-xs text-slate-400">
                Choose "Production Incentive" if this company pays the OT amount as incentive rather
                than a separate overtime line. The calculated amount is the same either way.
              </p>
            </div>
          )}
          <Toggle
            label="Incentive / variable pay"
            checked={!!p.incentiveApplicable}
            onChange={(v) => set("payroll.incentiveApplicable", v)}
          />
          <Toggle
            label="Recover loans and advances"
            hint="Deducted from net pay each month"
            checked={!!p.loanRecovery}
            onChange={(v) => set("payroll.loanRecovery", v)}
          />
          <div className="space-y-4 pt-4">
            <Field label="Bonus policy" value={p.bonusPolicy} onChange={(v) => set("payroll.bonusPolicy", v)} placeholder="Statutory 8.33% — paid at Deepavali" />
            <Field label="Reimbursement policy" value={p.reimbursementPolicy} onChange={(v) => set("payroll.reimbursementPolicy", v)} placeholder="Travel and mobile, against bills" />
          </div>
        </div>
      </Card>
    </div>
  );
}

function ComplianceTab({ form, set }) {
  const c = form.compliance || {};
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Provident fund">
        <Toggle label="PF applicable" checked={!!c.pfApplicable} onChange={(v) => set("compliance.pfApplicable", v)} />
        {c.pfApplicable && (
          <div className="pt-4">
            <Grid>
              <Field label="Employee share (%)" type="number" step="0.01" value={c.pfEmployeeRate} onChange={(v) => set("compliance.pfEmployeeRate", Number(v))} />
              <Field label="Employer share (%)" type="number" step="0.01" value={c.pfEmployerRate} onChange={(v) => set("compliance.pfEmployerRate", Number(v))} hint="Includes admin charges" />
              <Field span={2} label="Wage ceiling (₹)" type="number" value={c.pfWageCeiling} onChange={(v) => set("compliance.pfWageCeiling", Number(v))} hint="PF is capped at this basic wage unless the employee opts out." />
            </Grid>
          </div>
        )}
      </Card>

      <Card title="Employees' state insurance">
        <Toggle label="ESI applicable" checked={!!c.esiApplicable} onChange={(v) => set("compliance.esiApplicable", v)} />
        {c.esiApplicable && (
          <div className="pt-4">
            <Grid>
              <Field label="Employee share (%)" type="number" step="0.01" value={c.esiEmployeeRate} onChange={(v) => set("compliance.esiEmployeeRate", Number(v))} />
              <Field label="Employer share (%)" type="number" step="0.01" value={c.esiEmployerRate} onChange={(v) => set("compliance.esiEmployerRate", Number(v))} />
              <Field span={2} label="Gross wage limit (₹)" type="number" value={c.esiWageLimit} onChange={(v) => set("compliance.esiWageLimit", Number(v))} hint="Employees above this gross are outside ESI." />
            </Grid>
          </div>
        )}
      </Card>

      <Card title="Professional tax and TDS">
        <Grid>
          <Select label="PT slab follows" value={c.ptState || "Karnataka"} onChange={(v) => set("compliance.ptState", v)} options={states} />
          <span />
        </Grid>
        <div className="mt-2 divide-y divide-slate-100">
          <Toggle label="Deduct TDS on salary" hint="Uses each employee's declarations" checked={!!c.tdsApplicable} onChange={(v) => set("compliance.tdsApplicable", v)} />
          <Toggle label="Labour welfare fund" hint="Deducted at the interval the state prescribes" checked={!!c.lwfApplicable} onChange={(v) => set("compliance.lwfApplicable", v)} />
          {c.lwfApplicable && (
            <div className="pt-2">
              <Field
                label="LWF amount (₹ per year, employee share)"
                type="number"
                value={c.lwfAmount ?? 20}
                onChange={(v) => set("compliance.lwfAmount", Number(v))}
                hint="Karnataka revised this from ₹20 to ₹50 — enter the current amount. Charged in December."
              />
            </div>
          )}
        </div>
      </Card>

      <Card title="What this affects">
        <ul className="space-y-2.5 text-sm text-slate-600">
          {[
            "Every new employee inherits these settings as their default.",
            "Monthly payroll uses these rates to calculate deductions.",
            "PF and ESI returns are built from these numbers.",
            "Changing a rate applies from the next payroll run, not past ones.",
          ].map((line) => (
            <li key={line} className="flex gap-2.5">
              <Check size={16} className="mt-0.5 shrink-0 text-amber" />
              {line}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function AuthorizationTab({ form, set }) {
  const a = form.authorization || {};
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Authorised signatory" desc="Signs payslips and the bank transfer letter.">
        <Grid>
          <Field label="Name" value={a.signatoryName} onChange={(v) => set("authorization.signatoryName", v)} />
          <Field label="Designation" value={a.signatoryDesignation} onChange={(v) => set("authorization.signatoryDesignation", v)} />
          <Field span={2} label="Email" type="email" value={a.signatoryEmail} onChange={(v) => set("authorization.signatoryEmail", v)} />
        </Grid>
      </Card>

      <Card title="HR / payroll coordinator" desc="Ashwija's day-to-day point of contact.">
        <Grid>
          <Field label="Name" value={a.hrName} onChange={(v) => set("authorization.hrName", v)} />
          <Field label="Phone" value={a.hrPhone} onChange={(v) => set("authorization.hrPhone", v)} maxLength={10} />
          <Field span={2} label="Email" type="email" value={a.hrEmail} onChange={(v) => set("authorization.hrEmail", v)} />
        </Grid>
      </Card>

      <Card title="Where reports go" desc="Payslips and monthly registers are sent to these addresses.">
        <Field
          label="Email addresses"
          value={a.reportEmails}
          onChange={(v) => set("authorization.reportEmails", v)}
          placeholder="payroll@company.in, director@company.in"
          hint="Separate multiple addresses with commas."
        />
      </Card>

      <Card title="Service agreement">
        <Grid>
          <Field label="Signed on" type="date" value={a.agreementDate} onChange={(v) => set("authorization.agreementDate", v)} />
          <span />
        </Grid>
        <p className="mt-4 text-xs text-slate-500">
          The signed order and the authorisation letter are tracked under
          Documents, in the Authorization group.
        </p>
      </Card>
    </div>
  );
}
