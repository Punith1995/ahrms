import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  LayoutDashboard, Building2, Users, CalendarCheck, CalendarOff,
  Wallet, FileText, UserPlus, UserMinus, BarChart3, LogOut, KeyRound, X,
  ChevronDown, ChevronsUpDown,
} from "lucide-react";
import { companyApi, authApi, errorText } from "../lib/api";
import { useAuth } from "../lib/auth";

// grouped navigation for a clearer hierarchy
const navGroups = [
  {
    label: null,
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    label: "People",
    items: [
      { to: "/companies", label: "Companies", icon: Building2 },
      { to: "/employees", label: "Employees", icon: Users },
      { to: "/joining", label: "Joining", icon: UserPlus },
      { to: "/exit", label: "Exit", icon: UserMinus },
    ],
  },
  {
    label: "Payroll",
    items: [
      { to: "/attendance", label: "Attendance", icon: CalendarCheck },
      { to: "/leaves", label: "Leaves", icon: CalendarOff },
      { to: "/salary", label: "Salary", icon: Wallet },
      { to: "/payslips", label: "Payslips", icon: FileText },
    ],
  },
  {
    label: "Insights",
    items: [{ to: "/reports", label: "Reports", icon: BarChart3 }],
  },
];

const initials = (s) =>
  (s || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

// Drop your logo at client/public/logo.png and it appears everywhere below.
// Until then, each spot falls back to its letter/initials automatically.
const LOGO_SRC = "/logo.png";
function Logo({ size, rounded = "rounded-xl", fallbackClass = "", children }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (broken) {
    return (
      <div style={style} className={`grid shrink-0 place-items-center ${rounded} ${fallbackClass}`}>
        {children}
      </div>
    );
  }
  return (
    <img
      src={LOGO_SRC}
      alt="AHRMS"
      onError={() => setBroken(true)}
      style={style}
      className={`shrink-0 bg-white object-contain p-0.5 ${rounded}`}
    />
  );
}

const todayLabel = new Date().toLocaleDateString("en-IN", {
  weekday: "short", day: "numeric", month: "short", year: "numeric",
});

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(null);
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    companyApi
      .list()
      .then((rows) => {
        if (!alive) return;
        setCompanies(rows);
        setCompanyId((id) => (id === undefined ? null : id)); // default: All companies
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  function doLogout() {
    logout();
    navigate("/login");
  }

  const selected = companies.find((c) => c.id === companyId) || null;

  return (
    <div className="min-h-screen bg-[#eef2f7]">
      {/* ---------------------------------------------------------- sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-gradient-to-b from-[#1e3a6b] to-[#0e1f3d] text-white">
        {/* brand */}
        <div className="flex items-center gap-3 px-5 py-5">
          <Logo size={40} rounded="rounded-xl" fallbackClass="bg-amber font-black text-navy shadow-lg shadow-amber/20">
            A
          </Logo>
          <div className="leading-tight">
            <div className="text-base font-bold tracking-wide">AHRMS</div>
            <div className="text-[11px] text-white/55">Ashwija HR Consultancy</div>
          </div>
        </div>

        {/* nav */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {navGroups.map((group, gi) => (
            <div key={gi} className="mb-3">
              {group.label && (
                <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-white/35">
                  {group.label}
                </div>
              )}
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `relative mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                      isActive
                        ? "bg-white/10 font-semibold text-white"
                        : "text-white/65 hover:bg-white/5 hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-amber" />
                      )}
                      <Icon size={17} className={isActive ? "text-amber" : ""} />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* user footer */}
        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
            <Logo size={36} rounded="rounded-full" fallbackClass="bg-amber text-sm font-bold text-navy">
              {initials(user?.name || user?.email)}
            </Logo>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{user?.name || "Admin"}</div>
              <div className="truncate text-[11px] text-white/50">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={() => setPwOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/65 transition hover:bg-white/5 hover:text-white"
          >
            <KeyRound size={15} /> Change password
          </button>
          <button
            onClick={doLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/65 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>

      {/* ---------------------------------------------------- main column */}
      <div className="flex min-h-screen min-w-0 flex-col pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/70 bg-white/85 px-6 backdrop-blur">
          {/* company selector */}
          {companies.length > 0 ? (
            <div className="relative">
              <Building2 size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/60" />
              <select
                value={companyId ?? "all"}
                onChange={(e) =>
                  setCompanyId(e.target.value === "all" ? null : Number(e.target.value))
                }
                className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm font-semibold text-navy shadow-sm outline-none transition hover:border-navy/30 focus:border-navy focus:ring-2 focus:ring-navy/15"
              >
                <option value="all">All companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronsUpDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          ) : (
            <span className="text-sm text-slate-400">No companies yet</span>
          )}

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-400 sm:inline">{todayLabel}</span>
            <div className="flex items-center gap-2.5">
              <Logo size={32} rounded="rounded-full" fallbackClass="bg-navy text-xs font-bold text-white">
                {initials(user?.name || user?.email)}
              </Logo>
              <span className="hidden text-sm font-medium text-slate-700 md:inline">
                {user?.name || "Admin"}
              </span>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <Outlet context={{ companyId, company: selected, companies, allCompanies: companyId === null }} />
        </main>
      </div>

      {pwOpen && <ChangePassword onClose={() => setPwOpen(false)} />}
    </div>
  );
}

function ChangePassword({ onClose }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (next.length < 8) return toast.error("New password must be at least 8 characters");
    if (next !== confirm) return toast.error("New passwords do not match");
    setBusy(true);
    try {
      await authApi.changePassword(cur, next);
      toast.success("Password changed");
      onClose();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-navy">Change password</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>
        <div className="space-y-3 p-5">
          {[
            ["Current password", cur, setCur],
            ["New password", next, setNext],
            ["Confirm new password", confirm, setConfirm],
          ].map(([label, val, set]) => (
            <div key={label}>
              <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
              <input
                type="password"
                value={val}
                onChange={(e) => set(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
              />
            </div>
          ))}
          <button
            onClick={submit}
            disabled={busy}
            className="mt-2 w-full rounded-lg bg-amber py-2.5 font-semibold text-navy transition hover:brightness-95 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Update password"}
          </button>
        </div>
      </div>
    </div>
  );
}
