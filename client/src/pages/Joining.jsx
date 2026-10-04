import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Search, UserPlus, ChevronRight, AlertTriangle, RefreshCw, Clock, Inbox,
} from "lucide-react";
import { companyApi, employeeApi, errorText } from "../lib/api";
import {
  STAGES, stageIndex, docProgress, pendingItems, daysSince, money,
} from "../data/employeeChecklist";
import {
  Button, Field, Grid, Modal, Monogram, Pill, ReadinessBar, Select,
} from "../components/ui";

const blank = { companyId: "", fullName: "", mobile: "", designation: "", doj: "" };

export default function Joining() {
  const navigate = useNavigate();
  const outlet = useOutletContext() || {};

  const [rows, setRows] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [scope, setScope] = useState("company"); // company | all
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(blank);

  const activeCompanyId = outlet.companyId ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = { joiningStatus: "in_progress" };
      if (scope === "company" && activeCompanyId) params.companyId = activeCompanyId;
      const [joiners, firms] = await Promise.all([
        employeeApi.list(params),
        companies.length ? Promise.resolve(companies) : companyApi.list(),
      ]);
      setRows(joiners);
      setCompanies(firms);
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, activeCompanyId]);

  useEffect(() => {
    load();
  }, [load]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((e) => {
      const hit =
        !q ||
        e.fullName.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        (e.designation || "").toLowerCase().includes(q) ||
        (e.mobile || "").includes(q);
      if (!hit) return false;
      if (stageFilter !== "all" && e.joiningStage !== stageFilter) return false;
      return true;
    });
  }, [rows, query, stageFilter]);

  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(STAGES.map((s) => [s.id, 0]));
    rows.forEach((e) => {
      if (counts[e.joiningStage] !== undefined) counts[e.joiningStage] += 1;
    });
    return counts;
  }, [rows]);

  const stalled = useMemo(
    () => rows.filter((e) => daysSince(e.startedOn) >= 7).length,
    [rows]
  );

  async function startJoining() {
    if (!draft.companyId) return toast.error("Pick the company they're joining");
    if (!draft.fullName.trim()) return toast.error("Enter the joiner's full name");

    setSaving(true);
    try {
      const created = await employeeApi.create({
        companyId: Number(draft.companyId),
        fullName: draft.fullName.trim(),
        mobile: draft.mobile,
        designation: draft.designation,
        doj: draft.doj || null,
      });
      toast.success(`${created.employeeCode} created for ${created.fullName}`);
      setStarting(false);
      setDraft(blank);
      navigate(`/joining/${created.id}`);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  function openStarter() {
    setDraft({ ...blank, companyId: activeCompanyId ? String(activeCompanyId) : "" });
    setStarting(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Joining</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            New hires being brought onto payroll, and what each one is waiting on.
          </p>
        </div>
        <div className="flex items-center gap-2">
          
          <Button variant="accent" onClick={openStarter}>
            <UserPlus size={16} /> Start joining
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-rose-50 px-5 py-4 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          <AlertTriangle size={16} />
          <span>Could not load joiners. {loadError}</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={load}>
            <RefreshCw size={13} /> Try again
          </Button>
        </div>
      )}

      {/* pipeline — the signature of this page */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="grid grid-cols-2 divide-slate-200 sm:grid-cols-3 sm:divide-x lg:grid-cols-5">
          {STAGES.map((s, i) => {
            const count = stageCounts[s.id] || 0;
            const active = stageFilter === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStageFilter(active ? "all" : s.id)}
                className={`group relative px-5 py-4 text-left transition ${
                  active ? "bg-navy/5" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-slate-400">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {s.short}
                  </span>
                </div>
                <div
                  className={`mt-1 text-2xl font-semibold tabular-nums ${
                    count ? "text-navy" : "text-slate-300"
                  }`}
                >
                  {loading ? "—" : count}
                </div>
                <span
                  className={`absolute inset-x-0 bottom-0 h-0.5 transition ${
                    active ? "bg-amber" : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, code, role or mobile"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
          />
        </div>
        {stageFilter !== "all" && (
          <Button variant="ghost" size="sm" onClick={() => setStageFilter("all")}>
            Clear stage filter
          </Button>
        )}
        {stalled > 0 && (
          <Pill tone="amber">
            <Clock size={12} /> {stalled} open more than a week
          </Pill>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-semibold">Joiner</th>
                {scope === "all" && <th className="px-5 py-3 font-semibold">Company</th>}
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Joining on</th>
                <th className="px-5 py-3 text-right font-semibold">Monthly CTC</th>
                <th className="px-5 py-3 font-semibold">Stage</th>
                <th className="px-5 py-3 font-semibold">Documents</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {loading &&
                [0, 1, 2].map((i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td colSpan={8} className="px-5 py-4">
                      <div className="h-9 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}

              {!loading &&
                list.map((e) => {
                  const pending = pendingItems(e);
                  const waiting = daysSince(e.startedOn);
                  return (
                    <tr
                      key={e.id}
                      onClick={() => navigate(`/joining/${e.id}`)}
                      className="group cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Monogram name={e.fullName} size={36} />
                          <div className="min-w-0">
                            <div className="font-semibold text-navy">{e.fullName}</div>
                            <div className="truncate text-xs text-slate-500">
                              {e.employeeCode}
                              {waiting >= 7 && (
                                <span className="ml-2 text-amber-600">
                                  open {waiting} days
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {scope === "all" && (
                        <td className="px-5 py-3.5 text-slate-600">
                          {e.company?.name || "—"}
                        </td>
                      )}

                      <td className="px-5 py-3.5 text-slate-600">
                        {e.designation || <span className="text-slate-400">Not set</span>}
                        {e.department && (
                          <div className="text-xs text-slate-400">{e.department}</div>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-slate-600">
                        {e.doj || <span className="text-slate-400">Not set</span>}
                      </td>

                      <td className="px-5 py-3.5 text-right tabular-nums text-slate-700">
                        {e.ctcMonthly ? money(e.ctcMonthly) : <span className="text-slate-400">—</span>}
                      </td>

                      <td className="px-5 py-3.5">
                        <StageDots stage={e.joiningStage} />
                      </td>

                      <td className="px-5 py-3.5">
                        <ReadinessBar value={docProgress(e)} />
                        {pending.length > 0 && (
                          <div className="mt-1.5 text-xs text-slate-500">
                            {pending.length} item{pending.length > 1 ? "s" : ""} outstanding
                          </div>
                        )}
                      </td>

                      <td className="pr-4 text-slate-300 transition group-hover:text-navy">
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  );
                })}

              {!loading && !loadError && list.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Inbox size={28} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">
                      {rows.length ? "Nothing matches this filter" : "No joinings in progress"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {rows.length
                        ? "Clear the search or stage filter to see everyone."
                        : "Start a joining when a client sends you a new hire."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={starting}
        title="Start joining"
        desc="Just enough to open the file. Everything else follows on the next screen."
        onClose={() => setStarting(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setStarting(false)}>
              Cancel
            </Button>
            <Button variant="accent" onClick={startJoining} disabled={saving}>
              {saving ? "Creating…" : "Create and continue"}
            </Button>
          </>
        }
      >
        <Grid>
          <Select
            span={2}
            label="Joining which company"
            value={draft.companyId}
            onChange={(v) => setDraft({ ...draft, companyId: v })}
            options={[
              { value: "", label: "Select a company" },
              ...companies.map((c) => ({ value: String(c.id), label: c.name })),
            ]}
          />
          <Field
            span={2}
            label="Full name"
            value={draft.fullName}
            onChange={(v) => setDraft({ ...draft, fullName: v })}
            placeholder="As printed on the Aadhaar card"
            hint="Spelling must match the bank account, or salary transfers bounce."
          />
          <Field
            label="Mobile"
            value={draft.mobile}
            onChange={(v) => setDraft({ ...draft, mobile: v })}
            maxLength={10}
            placeholder="9845012345"
          />
          <Field
            label="Designation"
            value={draft.designation}
            onChange={(v) => setDraft({ ...draft, designation: v })}
            placeholder="Machine Operator"
          />
          <Field
            label="Date of joining"
            type="date"
            value={draft.doj}
            onChange={(v) => setDraft({ ...draft, doj: v })}
            hint="Can be changed later."
          />
        </Grid>
        <p className="mt-4 text-xs text-slate-500">
          The employee code is generated from the company code — NEX001, NEX002 and so on.
        </p>
      </Modal>
    </div>
  );
}

function StageDots({ stage }) {
  const at = stageIndex(stage);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {STAGES.map((s, i) => (
          <span
            key={s.id}
            title={s.label}
            className={`h-1.5 w-5 rounded-full ${
              i < at ? "bg-navy" : i === at ? "bg-amber" : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-slate-600">{STAGES[at]?.short}</span>
    </div>
  );
}
