import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Search, UserMinus, ChevronRight, AlertTriangle, RefreshCw, Inbox, Calendar,
} from "lucide-react";
import { exitApi, errorText } from "../lib/api";
import { Button, Field, Grid, Modal, Monogram, Pill, Select } from "../components/ui";

const money = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const STAGES = [
  { id: "initiated", label: "Initiated" },
  { id: "clearance", label: "Clearance" },
  { id: "settlement", label: "Settlement" },
  { id: "completed", label: "Completed" },
];

function daysUntil(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export default function Exit() {
  const outlet = useOutletContext() || {};
  const companyId = outlet.companyId ?? null;
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [eligible, setEligible] = useState([]);
  const [meta, setMeta] = useState({ exitTypes: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("in_progress");
  const [scope, setScope] = useState("company");
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    employeeId: "", exitType: "Resignation", reason: "",
    resignedOn: "", lastWorkingDay: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = {};
      if (tab !== "all") params.status = tab;
      if (scope === "company" && companyId) params.companyId = companyId;
      const [list, m] = await Promise.all([
        exitApi.list(params),
        meta.exitTypes.length ? Promise.resolve(meta) : exitApi.meta(),
      ]);
      setRows(list);
      setMeta(m);
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, scope, companyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function openStarter() {
    if (!companyId) return toast.error("Pick a company first");
    try {
      setEligible(await exitApi.eligible(companyId));
      setDraft({
        employeeId: "", exitType: "Resignation", reason: "",
        resignedOn: "", lastWorkingDay: "",
      });
      setStarting(true);
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  async function startExit() {
    if (!draft.employeeId) return toast.error("Choose the employee leaving");
    setSaving(true);
    try {
      const created = await exitApi.create({
        employeeId: Number(draft.employeeId),
        exitType: draft.exitType,
        reason: draft.reason,
        resignedOn: draft.resignedOn || null,
        lastWorkingDay: draft.lastWorkingDay || null,
      });
      toast.success("Exit initiated");
      setStarting(false);
      navigate(`/exit/${created.id}`);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (x) =>
        x.employee?.name.toLowerCase().includes(q) ||
        x.employee?.code.toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Exit</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Employees leaving — clearance and full &amp; final settlement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          
          <Button variant="accent" onClick={openStarter}>
            <UserMinus size={16} /> Initiate exit
          </Button>
        </div>
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or code"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
          />
        </div>
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm">
          {[
            { id: "in_progress", label: "In progress" },
            { id: "completed", label: "Completed" },
            { id: "all", label: "All" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                tab === t.id ? "bg-navy text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
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
                <th className="px-5 py-3 font-semibold">Employee</th>
                {scope === "all" && <th className="px-5 py-3 font-semibold">Company</th>}
                <th className="px-5 py-3 font-semibold">Type</th>
                <th className="px-5 py-3 font-semibold">Last working day</th>
                <th className="px-5 py-3 font-semibold">Stage</th>
                <th className="px-5 py-3 text-right font-semibold">Settlement</th>
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
                list.map((x) => {
                  const dleft = daysUntil(x.lastWorkingDay);
                  const stageIdx = STAGES.findIndex((s) => s.id === x.stage);
                  return (
                    <tr
                      key={x.id}
                      onClick={() => navigate(`/exit/${x.id}`)}
                      className="group cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Monogram name={x.employee?.name || "?"} size={34} />
                          <div className="min-w-0">
                            <div className="font-semibold text-navy">{x.employee?.name}</div>
                            <div className="truncate text-xs text-slate-400">
                              {x.employee?.code}
                              {x.employee?.designation ? ` · ${x.employee.designation}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      {scope === "all" && (
                        <td className="px-5 py-3.5 text-slate-600">{x.company?.name}</td>
                      )}
                      <td className="px-5 py-3.5 text-slate-600">{x.exitType}</td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {x.lastWorkingDay ? (
                          <span className="flex items-center gap-1.5">
                            <Calendar size={12} className="text-slate-400" />
                            {x.lastWorkingDay}
                            {x.status === "in_progress" && dleft !== null && dleft >= 0 && dleft <= 14 && (
                              <span className="text-xs text-amber-600">({dleft}d)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400">Not set</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {x.status === "completed" ? (
                          <Pill tone="green">Completed</Pill>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div className="flex gap-1">
                              {STAGES.slice(0, 3).map((s, i) => (
                                <span
                                  key={s.id}
                                  className={`h-1.5 w-5 rounded-full ${
                                    i < stageIdx ? "bg-navy" : i === stageIdx ? "bg-amber" : "bg-slate-200"
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-slate-600">
                              {STAGES[stageIdx]?.label}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-slate-700">
                        {x.status === "completed" || x.netSettlement
                          ? money(x.netSettlement)
                          : "—"}
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
                    <Inbox size={28} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">
                      {tab === "completed" ? "No completed exits" : "No exits in progress"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Initiate an exit when an employee resigns or their contract ends.
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
        title="Initiate exit"
        desc="Start the offboarding file. Clearance and settlement follow on the next screen."
        onClose={() => setStarting(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setStarting(false)}>Cancel</Button>
            <Button variant="accent" onClick={startExit} disabled={saving}>
              {saving ? "Creating…" : "Create and continue"}
            </Button>
          </>
        }
      >
        {eligible.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No active employees are available to exit for this company.
          </p>
        ) : (
          <Grid>
            <Select
              span={2}
              label="Employee"
              value={draft.employeeId}
              onChange={(v) => setDraft({ ...draft, employeeId: v })}
              options={[
                { value: "", label: "Select an employee" },
                ...eligible.map((e) => ({ value: String(e.id), label: `${e.name} · ${e.code}` })),
              ]}
            />
            <Select
              label="Exit type"
              value={draft.exitType}
              onChange={(v) => setDraft({ ...draft, exitType: v })}
              options={meta.exitTypes}
            />
            <Field
              label="Resigned / notified on"
              type="date"
              value={draft.resignedOn}
              onChange={(v) => setDraft({ ...draft, resignedOn: v })}
            />
            <Field
              span={2}
              label="Last working day"
              type="date"
              value={draft.lastWorkingDay}
              onChange={(v) => setDraft({ ...draft, lastWorkingDay: v })}
              hint="Can be adjusted later once notice is worked out."
            />
            <Field
              span={2}
              label="Reason (optional)"
              value={draft.reason}
              onChange={(v) => setDraft({ ...draft, reason: v })}
              placeholder="Better opportunity, relocation, etc."
            />
          </Grid>
        )}
      </Modal>
    </div>
  );
}
