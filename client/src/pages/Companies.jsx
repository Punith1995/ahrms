import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Search, Plus, ChevronRight, AlertTriangle, Building2, RefreshCw,
  Users, FileWarning,
} from "lucide-react";
import { companyApi, errorText, fileUrl } from "../lib/api";
import {
  readiness, missingMandatory, states, entityTypes,
} from "../data/checklist";
import {
  Button, Field, Grid, Modal, Monogram, Pill, ReadinessBar, Select,
} from "../components/ui";

const blank = {
  name: "",
  legalName: "",
  entityType: "Private Limited",
  city: "",
  state: "Karnataka",
  salaryDate: 7,
};

export default function Companies() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(blank);

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      setRows(await companyApi.list());
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((c) => {
      const hit =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.legalName.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q);
      if (!hit) return false;
      if (filter === "incomplete") return missingMandatory(c).length > 0;
      if (filter === "active") return c.status === "Active";
      return true;
    });
  }, [rows, query, filter]);

  const totals = useMemo(
    () => ({
      firms: rows.length,
      heads: rows.reduce((s, c) => s + (c.headcount || 0), 0),
      flagged: rows.filter((c) => missingMandatory(c).length).length,
    }),
    [rows]
  );

  async function saveCompany() {
    if (!draft.legalName.trim()) {
      toast.error("Legal name is required");
      return;
    }
    setSaving(true);
    try {
      const created = await companyApi.create({
        name: draft.name.trim() || draft.legalName.trim(),
        legalName: draft.legalName.trim(),
        entityType: draft.entityType,
        city: draft.city,
        state: draft.state,
        status: "Onboarding",
        registrations: {},
        bank: { transferMode: "NEFT" },
        payroll: {
          wagePeriodFrom: 1,
          wagePeriodTo: 30,
          salaryDate: Number(draft.salaryDate) || 7,
          weeklyOff: "Sunday",
          holidayCount: 10,
          otApplicable: false,
          otRate: "",
          bonusPolicy: "",
          incentiveApplicable: false,
          reimbursementPolicy: "",
          loanRecovery: false,
        },
        compliance: {
          pfApplicable: true, pfEmployerRate: 13, pfEmployeeRate: 12,
          pfWageCeiling: 15000, esiApplicable: true, esiEmployerRate: 3.25,
          esiEmployeeRate: 0.75, esiWageLimit: 21000, ptState: draft.state,
          tdsApplicable: true, lwfApplicable: false,
        },
        authorization: {},
      });
      setAdding(false);
      setDraft(blank);
      toast.success(`${created.name} added`);
      navigate(`/companies/${created.id}`);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Companies</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Client firms whose payroll runs through Ashwija.
          </p>
        </div>
        <Button variant="accent" onClick={() => setAdding(true)}>
          <Plus size={16} /> Add company
        </Button>
      </div>

      {loadError && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-rose-50 px-5 py-4 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          <AlertTriangle size={16} />
          <span>
            Could not reach the server. {loadError}. Check that the backend is
            running on port 5000.
          </span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={load}>
            <RefreshCw size={13} /> Try again
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Building2} tint="navy" label="Client companies" value={loading ? "—" : totals.firms} />
        <Stat icon={Users} tint="sky" label="Employees on payroll" value={loading ? "—" : totals.heads} />
        <Stat icon={FileWarning} tint={totals.flagged ? "rose" : "emerald"}
          label="Missing mandatory papers" value={loading ? "—" : totals.flagged} warn={totals.flagged > 0} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, code or city"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
          />
        </div>
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm">
          {[
            { id: "all", label: "All" },
            { id: "active", label: "Active" },
            { id: "incomplete", label: "Papers pending" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                filter === t.id ? "bg-navy text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-semibold">Company</th>
                <th className="px-5 py-3 font-semibold">Location</th>
                <th className="px-5 py-3 text-right font-semibold">Employees</th>
                <th className="px-5 py-3 text-center font-semibold">Salary date</th>
                <th className="px-5 py-3 font-semibold">Documents on file</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {loading &&
                [0, 1, 2].map((i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td colSpan={7} className="px-5 py-4">
                      <div className="h-9 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}

              {!loading &&
                list.map((c) => {
                  const missing = missingMandatory(c);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/companies/${c.id}`)}
                      className="group cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Monogram name={c.name} logo={fileUrl(c.logo)} />
                          <div className="min-w-0">
                            <div className="font-semibold text-navy">{c.name}</div>
                            <div className="truncate text-xs text-slate-500">
                              {c.code} · {c.entityType}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {c.city || "—"}
                        <div className="text-xs text-slate-400">{c.state}</div>
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-slate-700">
                        {c.headcount}
                      </td>
                      <td className="px-5 py-3.5 text-center tabular-nums text-slate-700">
                        {c.payroll?.salaryDate ?? "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <ReadinessBar value={readiness(c)} />
                        {missing.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1 text-xs text-rose-600">
                            <AlertTriangle size={12} />
                            {missing.length} mandatory missing
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <Pill tone={c.status === "Active" ? "green" : "amber"}>
                          {c.status}
                        </Pill>
                      </td>
                      <td className="pr-4 text-slate-300 transition group-hover:text-navy">
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  );
                })}

              {!loading && !loadError && list.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Building2 size={28} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">
                      {rows.length ? "No company matches this search" : "No companies yet"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {rows.length
                        ? "Clear the search box, or add the company."
                        : "Add your first client company to get started."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={adding}
        title="Add company"
        desc="Enter the basics now. Registrations and documents come next."
        onClose={() => setAdding(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button variant="accent" onClick={saveCompany} disabled={saving}>
              {saving ? "Saving…" : "Save and open profile"}
            </Button>
          </>
        }
      >
        <Grid>
          <Field
            span={2}
            label="Legal name"
            value={draft.legalName}
            onChange={(v) => setDraft({ ...draft, legalName: v })}
            placeholder="Nexa Textiles Private Limited"
            hint="Printed on payslips and the bank letter."
          />
          <Field
            span={2}
            label="Short name (optional)"
            value={draft.name}
            onChange={(v) => setDraft({ ...draft, name: v })}
            placeholder="Nexa Textiles"
            hint="Used around the app. Leave blank to use the legal name. A company code is generated automatically."
          />
          <Select
            label="Entity type"
            value={draft.entityType}
            onChange={(v) => setDraft({ ...draft, entityType: v })}
            options={entityTypes}
          />
          <Field
            label="City"
            value={draft.city}
            onChange={(v) => setDraft({ ...draft, city: v })}
            placeholder="Bengaluru"
          />
          <Select
            label="State"
            value={draft.state}
            onChange={(v) => setDraft({ ...draft, state: v })}
            options={states}
          />
          <Field
            label="Salary paid on"
            type="number"
            value={draft.salaryDate}
            onChange={(v) => setDraft({ ...draft, salaryDate: v })}
            hint="Day of the month"
            min={1}
            max={31}
          />
        </Grid>
      </Modal>
    </div>
  );
}

const TINTS = {
  navy: "bg-navy/10 text-navy",
  sky: "bg-sky-100 text-sky-600",
  emerald: "bg-emerald-100 text-emerald-600",
  rose: "bg-rose-100 text-rose-600",
};

function Stat({ icon: Icon, label, value, tint = "navy", warn }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/70 bg-white px-5 py-4 shadow-sm">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${TINTS[tint]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className={`text-2xl font-bold tabular-nums ${warn ? "text-rose-600" : "text-navy"}`}>
          {value}
        </div>
        <div className="truncate text-xs font-medium text-slate-500">{label}</div>
      </div>
    </div>
  );
}
