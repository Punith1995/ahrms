import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Loader2, Lock, Eye, EyeOff, Mail, ShieldCheck, CalendarCheck, Wallet,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { errorText } from "../lib/api";

// Drop your logo at client/public/logo.png; until then this shows a lock badge.
function LoginLogo({ size = 56, className = "" }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (broken) {
    return (
      <div style={style} className={`grid place-items-center rounded-2xl bg-amber text-navy ${className}`}>
        <Lock size={size * 0.42} />
      </div>
    );
  }
  return (
    <img
      src="/logo.png"
      alt="AHRMS"
      onError={() => setBroken(true)}
      style={style}
      className={`rounded-2xl bg-white object-contain p-1.5 shadow-lg ${className}`}
    />
  );
}

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit() {
    if (!email || !password) {
      toast.error("Enter your email and password");
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate("/");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#eef2f7]">
      {/* -------------------------------------------------- brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1e3a6b] to-[#0e1f3d] p-12 text-white lg:flex">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-amber/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <LoginLogo size={48} />
          <div>
            <div className="text-lg font-bold tracking-wide">AHRMS</div>
            <div className="text-xs text-white/55">Ashwija HR Consultancy</div>
          </div>
        </div>

        <div className="relative">
          <h2 className="max-w-md text-3xl font-bold leading-tight">
            Payroll & HR for all your client companies, in one place.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-white/60">
            Attendance, salary, statutory compliance and payslips — managed end to end.
          </p>
          <div className="mt-8 space-y-3">
            {[
              [CalendarCheck, "Attendance to payslip in a few clicks"],
              [Wallet, "PF, ESI, PT and bank files handled for you"],
              [ShieldCheck, "One secure admin console"],
            ].map(([Icon, text]) => (
              <div key={text} className="flex items-center gap-3 text-sm text-white/80">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
                  <Icon size={16} className="text-amber" />
                </div>
                {text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-white/40">
          © {new Date().getFullYear()} Ashwija HR Consultancy · Protected system
        </div>
      </div>

      {/* -------------------------------------------------- form panel */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* mobile brand */}
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <LoginLogo size={56} />
            <h1 className="mt-3 text-xl font-bold text-navy">AHRMS</h1>
            <p className="text-xs text-slate-500">Ashwija HR Consultancy</p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white p-8 shadow-xl">
            <h2 className="text-xl font-bold text-navy">Welcome back</h2>
            <p className="mb-6 mt-1 text-sm text-slate-500">Sign in to your admin console.</p>

            <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
            <div className="relative mb-4">
              <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ashwija.com"
                autoComplete="username"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
              />
            </div>

            <label className="mb-1 block text-xs font-medium text-slate-600">Password</label>
            <div className="relative mb-6">
              <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-10 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:text-navy"
                title={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              onClick={submit}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber py-2.5 font-semibold text-navy transition hover:brightness-95 disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            Protected system · authorised users only
          </p>
        </div>
      </div>
    </div>
  );
}
