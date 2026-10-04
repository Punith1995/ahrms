import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Building2, Users, Wallet, CheckCircle2, AlertTriangle, RefreshCw,
  UserPlus, UserMinus, FileWarning, CalendarClock, ChevronRight, Clock,
  ArrowUpRight, PauseCircle, TrendingUp,
} from "lucide-react";
import { dashboardApi, errorText } from "../lib/api";
import { Button, Pill } from "../components/ui";

const money = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const moneyShort = (n) => {
  const v = Math.round(n || 0);
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${v}`;
};
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const initials = (name) =>
  (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const PAYROLL_META = {
  none: { tone: "slate", label: "Not run" },
  draft: { tone: "amber", label: "Draft" },
  finalised: { tone: "navy", label: "Finalised" },
  paid: { tone: "green", label: "Paid" },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const outlet = useOutletContext() || {};
  const filterId = outlet.companyId ?? null;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await dashboardApi.overview());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // narrow the whole dashboard to the header's company when one is picked
  const view = useMemo(() => {
    if (!data) return null;
    if (!filterId) return data;
    const row = data.companies.find((c) => c.id === filterId);
    if (!row) return data;
    const name = row.name;
    const done = row.payrollStatus === "finalised" || row.payrollStatus === "paid";
    return {
      ...data,
      scopedTo: name,
      totals: {
        companies: 1,
        activeCompanies: row.status === "Active" ? 1 : 0,
        employees: row.headcount,
        payrollCost: row.payrollCost,
        payrollDone: done ? 1 : 0,
        payrollTotal: row.headcount > 0 ? 1 : 0,
      },
      companies: [row],
      attention: {
        payrollPending: data.attention.payrollPending.filter((c) => c.id === filterId),
        joiners: data.attention.joiners.filter((j) => j.company === name),
        exits: data.attention.exits.filter((x) => x.company === name),
        expiringLicences: data.attention.expiringLicences.filter((l) => l.companyId === filterId),
        docAlerts: data.attention.docAlerts.filter((c) => c.id === filterId),
        salaryHold: (data.attention.salaryHold || []).filter((h) => h.company === name),
      },
    };
  }, [data, filterId]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-200/60" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/60" />)}
        </div>
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200/60" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <AlertTriangle size={26} className="mx-auto mb-3 text-rose-400" />
        <p className="text-sm font-medium text-slate-700">{error}</p>
        <Button variant="ghost" className="mt-4" onClick={load}>
          <RefreshCw size={14} /> Try again
        </Button>
      </div>
    );
  }

  const { totals, companies, attention, period } = view;
  const monthLabel = `${MONTHS[period.month - 1]} ${period.year}`;
  const scopeLabel = view.scopedTo || "All clients";
  const payrollProgress =
    totals.payrollTotal > 0 ? Math.round((totals.payrollDone / totals.payrollTotal) * 100) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {/* hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e3a6b] to-[#0e1f3d] px-6 py-6 text-white shadow-lg">
        <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-amber/10 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm text-white/60">{greeting}</div>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight">Overview</h1>
            <p className="mt-1 text-sm text-white/70">
              {scopeLabel} · {monthLabel}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums text-amber">{moneyShort(totals.payrollCost)}</div>
              <div className="text-xs text-white/60">monthly payroll</div>
            </div>
            <button onClick={load} className="rounded-lg bg-white/10 p-2 text-white/80 transition hover:bg-white/20" title="Refresh">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} tint="navy" label="Client companies" value={totals.companies}
          sub={`${totals.activeCompanies} active`} onClick={() => navigate("/companies")} />
        <StatCard icon={Users} tint="sky" label="Employees on payroll" value={totals.employees}
          sub="across all clients" onClick={() => navigate("/employees")} />
        <StatCard icon={Wallet} tint="emerald" label="Monthly payroll" value={moneyShort(totals.payrollCost)}
          sub="total cost" />
        <StatCard icon={CheckCircle2} tint="amber" label="Payroll this month"
          value={`${totals.payrollDone}/${totals.payrollTotal}`} sub={`${payrollProgress}% finalised`}
          progress={payrollProgress} onClick={() => navigate("/salary")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* payroll status */}
        <div className="lg:col-span-2">
          <Panel title="Payroll status" subtitle={monthLabel}
            action={<button onClick={() => navigate("/salary")} className="text-xs font-semibold text-navy hover:underline">Go to Salary →</button>}>
            <div className="divide-y divide-slate-100">
              {companies.map((c) => {
                const meta = PAYROLL_META[c.payrollStatus];
                return (
                  <div key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy/10 text-xs font-bold text-navy">
                      {initials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-navy">{c.name}</span>
                        {c.missingDocs > 0 && (
                          <span title={`${c.missingDocs} mandatory documents missing`}>
                            <FileWarning size={13} className="text-rose-400" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {c.headcount} employees · {moneyShort(c.payrollCost)}/mo
                      </div>
                    </div>
                    <div className="text-right">
                      {c.payrollNet > 0 && (
                        <div className="text-sm font-semibold tabular-nums text-slate-700">{moneyShort(c.payrollNet)}</div>
                      )}
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </div>
                  </div>
                );
              })}
              {companies.length === 0 && (
                <div className="py-10 text-center text-sm text-slate-400">No companies yet.</div>
              )}
            </div>
          </Panel>
        </div>

        {/* attention */}
        <div className="space-y-5">
          {attention.payrollPending.length > 0 && (
            <Alert tone="amber" icon={Clock}
              title={`${attention.payrollPending.length} payroll${attention.payrollPending.length > 1 ? "s" : ""} pending`}
              body={attention.payrollPending.map((c) => c.name).join(", ")}
              actionLabel="Run payroll →" onAction={() => navigate("/salary")} />
          )}

          <Panel title="Joining" subtitle={`${attention.joiners.length} in progress`} dense>
            {attention.joiners.length === 0 ? <Empty text="No joinings in progress" /> :
              attention.joiners.slice(0, 5).map((j) => (
                <Row key={j.id} icon={UserPlus} tint="sky" title={j.name} sub={`${j.company} · ${j.stage}`}
                  right={j.daysOpen >= 7 ? <Pill tone="amber">{j.daysOpen}d</Pill> : null}
                  onClick={() => navigate(`/joining/${j.id}`)} />
              ))}
          </Panel>

          <Panel title="Exits" subtitle={`${attention.exits.length} in progress`} dense>
            {attention.exits.length === 0 ? <Empty text="No exits in progress" /> :
              attention.exits.slice(0, 5).map((x) => (
                <Row key={x.id} icon={UserMinus} tint="rose" title={x.name}
                  sub={`${x.company}${x.lastWorkingDay ? ` · LWD ${x.lastWorkingDay}` : ""}`}
                  right={x.daysLeft !== null && x.daysLeft >= 0 && x.daysLeft <= 14 ? <Pill tone="amber">{x.daysLeft}d</Pill> : null}
                  onClick={() => navigate(`/exit/${x.id}`)} />
              ))}
          </Panel>

          {attention.salaryHold?.length > 0 && (
            <Panel title="Salary on hold" subtitle={`${attention.salaryHold.length} employees`} dense>
              {attention.salaryHold.slice(0, 6).map((h) => (
                <Row key={h.id} icon={PauseCircle} tint="rose" title={h.name}
                  sub={`${h.company}${h.reason ? ` · ${h.reason}` : ""}`} right={<Pill tone="red">Held</Pill>}
                  onClick={() => navigate(`/employees/${h.id}`)} />
              ))}
            </Panel>
          )}

          <Panel title="Licences expiring" subtitle="next 60 days" dense>
            {attention.expiringLicences.length === 0 ? <Empty text="Nothing expiring soon" /> :
              attention.expiringLicences.slice(0, 5).map((l, i) => (
                <Row key={i} icon={CalendarClock} tint="amber" title={l.licence} sub={`${l.company} · ${l.validTill}`}
                  right={<Pill tone={l.expired ? "red" : "amber"}>{l.expired ? "expired" : `${l.daysLeft}d`}</Pill>}
                  onClick={() => navigate(`/companies/${l.companyId}`)} />
              ))}
          </Panel>

          {attention.docAlerts.length > 0 && (
            <Panel title="Documents pending" subtitle={`${attention.docAlerts.length} companies`} dense>
              {attention.docAlerts.slice(0, 5).map((c) => (
                <Row key={c.id} icon={FileWarning} tint="rose" title={c.name} sub={`${c.missingDocs} mandatory missing`}
                  onClick={() => navigate(`/companies/${c.id}`)} />
              ))}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- pieces */

const TINTS = {
  navy: "bg-navy/10 text-navy",
  sky: "bg-sky-100 text-sky-600",
  emerald: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
  rose: "bg-rose-100 text-rose-600",
};

function StatCard({ icon: Icon, label, value, sub, progress, tint = "navy", onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-2xl border border-slate-200/70 bg-white px-5 py-4 text-left shadow-sm transition ${
        onClick ? "hover:-translate-y-0.5 hover:shadow-md" : "cursor-default"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${TINTS[tint]}`}>
          <Icon size={18} />
        </div>
        {onClick && <ArrowUpRight size={15} className="text-slate-300" />}
      </div>
      <div className="mt-3 text-2xl font-bold tabular-nums text-navy">{value}</div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
      {progress !== undefined && (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-amber to-amber/70 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </button>
  );
}

function Panel({ title, subtitle, action, children, dense }) {
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-navy">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className={dense ? "px-2 py-1.5" : "px-5 py-4"}>{children}</div>
    </section>
  );
}

function Row({ icon: Icon, title, sub, right, tint = "navy", onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-slate-50">
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TINTS[tint]}`}>
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-700">{title}</div>
        <div className="truncate text-xs text-slate-400">{sub}</div>
      </div>
      {right}
    </button>
  );
}

function Alert({ tone, icon: Icon, title, body, actionLabel, onAction }) {
  const tones = { amber: "bg-amber-50 text-amber-900 ring-amber-200" };
  return (
    <div className={`rounded-2xl px-4 py-3.5 ring-1 ring-inset ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon size={16} /> {title}
      </div>
      {body && <p className="mt-1 line-clamp-2 text-xs opacity-80">{body}</p>}
      {actionLabel && (
        <button onClick={onAction} className="mt-2 text-xs font-semibold underline underline-offset-2">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function Empty({ text }) {
  return <div className="px-3 py-6 text-center text-xs text-slate-400">{text}</div>;
}
