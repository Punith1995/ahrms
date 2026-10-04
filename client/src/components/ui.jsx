import { X } from "lucide-react";

// --- monogram tile (stands in for a company logo) ---------------------------
export function Monogram({ name, size = 40, logo = "" }) {
  const initials = name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  if (logo) {
    return (
      <img
        src={logo}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-lg object-contain bg-white border border-slate-200"
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className="rounded-lg bg-navy text-amber font-bold grid place-items-center tracking-tight shrink-0"
    >
      {initials}
    </div>
  );
}

// --- status pill ------------------------------------------------------------
const tones = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  navy: "bg-navy/5 text-navy ring-navy/15",
};

export function Pill({ tone = "slate", children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

// --- card -------------------------------------------------------------------
export function Card({ title, desc, action, children, className = "" }) {
  return (
    <section
      className={`bg-white rounded-xl border border-slate-200 ${className}`}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-navy">{title}</h2>
            {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

// --- form controls ----------------------------------------------------------
const inputBase =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-navy focus:ring-2 focus:ring-navy/15 disabled:bg-slate-50 disabled:text-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

export function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  hint = "",
  span = 1,
  ...rest
}) {
  const isNum = type === "number";
  // Number fields start blank instead of showing a pre-filled 0.
  const shown = isNum
    ? (value === 0 || value === null || value === undefined ? "" : value)
    : (value ?? "");
  return (
    <label className={span === 2 ? "sm:col-span-2" : ""}>
      <span className="block text-xs font-medium text-slate-600 mb-1.5">
        {label}
      </span>
      <input
        type={type}
        value={shown}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        onWheel={isNum ? (e) => e.currentTarget.blur() : undefined}
        className={inputBase}
        {...rest}
      />
      {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export function Select({ label, value, onChange, options = [], span = 1 }) {
  return (
    <label className={span === 2 ? "sm:col-span-2" : ""}>
      <span className="block text-xs font-medium text-slate-600 mb-1.5">
        {label}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className={inputBase}
      >
        {options.map((o) => {
          const val = typeof o === "string" ? o : o.value;
          const lbl = typeof o === "string" ? o : o.label;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function Toggle({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div>
        <div className="text-sm font-medium text-slate-700">{label}</div>
        {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange?.(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 ${
          checked ? "bg-navy" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export function Grid({ children, cols = 2 }) {
  return (
    <div
      className={`grid gap-x-5 gap-y-4 ${
        cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
      }`}
    >
      {children}
    </div>
  );
}

// --- buttons ----------------------------------------------------------------
export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}) {
  const variants = {
    primary: "bg-navy text-white hover:bg-navy/90",
    accent: "bg-amber text-navy font-semibold hover:brightness-95",
    ghost: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
    subtle: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    danger: "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50",
  };
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// --- modal ------------------------------------------------------------------
export function Modal({ open, title, desc, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/40 p-4 sm:p-8">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-navy">{title}</h2>
            {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </header>
        <div className="px-5 py-5">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

// --- readiness meter --------------------------------------------------------
export function ReadinessBar({ value, showLabel = true }) {
  const tone =
    value === 100 ? "bg-emerald-500" : value >= 70 ? "bg-amber" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all ${tone}`}
          style={{ width: `${value}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium tabular-nums text-slate-600">
          {value}%
        </span>
      )}
    </div>
  );
}
