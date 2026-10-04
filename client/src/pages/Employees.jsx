import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Search, Users, ChevronRight, AlertTriangle, RefreshCw, Download,
  UserPlus, Wallet,
} from "lucide-react";
import { employeeApi, errorText } from "../lib/api";
import { departments, money, daysSince } from "../data/employeeChecklist";
import { Button, Monogram, Pill } from "../components/ui";

const STATUS_TABS = [
  { id: "Active", label: "Active" },
  { id: "Exited", label: "Exited" },
  { id: "all", label: "All" },
];

export default function Employees() {
  const navigate = useNavigate();
  const outlet = useOutletContext() || {};
  const activeCompanyId = outlet.companyId ?? null;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Active");
  const [dept, setDept] = useState("all");
  const [scope, setScope] = useState("company");
  const [sort, setSort] = useState({ key: "fullName", dir: "asc" });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      // the roster is everyone who has finished joining
      const params = { joiningStatus: "joined" };
      if (status !== "all") params.status = status;
      if (scope === "company" && activeCompanyId) params.companyId = activeCompanyId;
      setRows(await employeeApi.list(params));
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [status, scope, activeCompanyId]);

  useEffect(() => {
    load();
  }, [load]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter((e) => {
      const hit =
        !q ||
        e.fullName.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        (e.designation || "").toLowerCase().includes(q) ||
        (e.mobile || "").includes(q) ||
        (e.pan || "").toLowerCase().includes(q);
      if (!hit) return false;
      if (dept !== "all" && e.department !== dept) return false;
      return true;
    });

    const { key, dir } = sort;
    out = [...out].sort((a, b) => {
      let av = a[key] ?? "";
      let bv = b[key] ?? "";
      if (key === "ctcMonthly") {
        av = a.ctcMonthly || 0;
        bv = b.ctcMonthly || 0;
      } else {
        av = String(av).toLowerCase();
        bv = String(bv).toLowerCase();
      }
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return out;
  }, [rows, query, dept, sort]);

  const totals = useMemo(() => {
    const active = rows.filter((e) => e.status === "Active");
    const payroll = active.reduce((s, e) => s + (e.ctcMonthly || 0), 0);
    const newThisMonth = active.filter((e) => daysSince(e.joinedOn) <= 30).length;
    return { head: active.length, payroll, newThisMonth };
  }, [rows]);

  const deptsInUse = useMemo(() => {
    const set = new Set(rows.map((e) => e.department).filter(Boolean));
    return ["all", ...departments.filter((d) => set.has(d))];
  }, [rows]);

  function exportCsv() {
    const headers = [
      "Code", "Name", "Designation", "Department", "Date of joining",
      "Mobile", "PAN", "UAN", "Bank account", "IFSC", "Monthly CTC", "Net pay", "Status",
    ];
    const lines = list.map((e) =>
      [
        e.employeeCode, e.fullName, e.designation, e.department, e.doj,
        e.mobile, e.pan, e.uan, e.bankAccountNo, e.bankIfsc,
        e.ctcMonthly, e.salaryStructure?.netPay ?? "", e.status,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const toggleSort = (key) =>
    setSort((s) => ({
      key,
      dir: s.key === key && s.dir === "asc" ? "desc" : "asc",
    }));

  const SortHead = ({ label, k, align = "left" }) => (
    <th className={`px-5 py-3 font-semibold ${align === "right" ? "text-right" : ""}`}>
      <button
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-navy"
      >
        {label}
        {sort.key === k && (
          <span className="text-[10px]">{sort.dir === "asc" ? "▲" : "▼"}</span>
        )}
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Employees</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Everyone on payroll across your client companies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          
          <Button variant="ghost" onClick={exportCsv} disabled={!list.length}>
            <Download size={15} /> Export
          </Button>
          <Button variant="accent" onClick={() => navigate("/joining")}>
            <UserPlus size={16} /> Add via joining
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-rose-50 px-5 py-4 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          <AlertTriangle size={16} />
          <span>Could not load employees. {loadError}</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={load}>
            <RefreshCw size={13} /> Try again
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Users} tint="navy" label="On payroll" value={loading ? "—" : totals.head} />
        <Stat
          icon={Wallet}
          tint="emerald"
          label="Monthly payroll cost"
          value={loading ? "—" : money(totals.payroll)}
        />
        <Stat
          icon={UserPlus}
          tint="sky"
          label="Joined in last 30 days"
          value={loading ? "—" : totals.newThisMonth}
        />
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
            placeholder="Search by name, code, role, mobile or PAN"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
          />
        </div>

        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-navy"
        >
          {deptsInUse.map((d) => (
            <option key={d} value={d}>
              {d === "all" ? "All departments" : d}
            </option>
          ))}
        </select>

        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setStatus(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                status === t.id ? "bg-navy text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
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
                <SortHead label="Employee" k="fullName" />
                {scope === "all" && <th className="px-5 py-3 font-semibold">Company</th>}
                <SortHead label="Designation" k="designation" />
                <SortHead label="Department" k="department" />
                <SortHead label="Joined" k="doj" />
                <SortHead label="Monthly CTC" k="ctcMonthly" align="right" />
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {loading &&
                [0, 1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td colSpan={8} className="px-5 py-4">
                      <div className="h-9 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}

              {!loading &&
                list.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => navigate(`/employees/${e.id}`)}
                    className="group cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Monogram name={e.fullName} size={36} />
                        <div className="min-w-0">
                          <div className="font-semibold text-navy">{e.fullName}</div>
                          <div className="truncate text-xs text-slate-500">
                            {e.employeeCode} · {e.mobile || "no mobile"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {scope === "all" && (
                      <td className="px-5 py-3.5 text-slate-600">
                        {e.company?.name || "—"}
                      </td>
                    )}

                    <td className="px-5 py-3.5 text-slate-700">
                      {e.designation || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {e.department || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{e.doj || "—"}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-slate-700">
                      {e.ctcMonthly ? money(e.ctcMonthly) : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <Pill tone={e.status === "Active" ? "green" : "slate"}>
                        {e.status}
                      </Pill>
                    </td>
                    <td className="pr-4 text-slate-300 transition group-hover:text-navy">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                ))}

              {!loading && !loadError && list.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Users size={28} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">
                      {rows.length ? "No one matches these filters" : "No employees yet"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {rows.length
                        ? "Clear the search or filters to see everyone."
                        : "Complete a joining and the employee appears here."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && list.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
            Showing {list.length} of {rows.length}
          </div>
        )}
      </div>
    </div>
  );
}

const TINTS = {
  navy: "bg-navy/10 text-navy",
  sky: "bg-sky-100 text-sky-600",
  emerald: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
};

function Stat({ icon: Icon, label, value, tint = "navy" }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/70 bg-white px-5 py-4 shadow-sm">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${TINTS[tint]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold tabular-nums text-navy">{value}</div>
        <div className="truncate text-xs font-medium text-slate-500">{label}</div>
      </div>
    </div>
  );
}
