import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const ACCENTS = {
  ops: { color: "#2563EB", hover: "#1D4ED8", name: "Control Hub", sub: "Admin & Operations" },
  business: { color: "#D97706", hover: "#B45309", name: "Advertiser Portal", sub: "Grow your business" },
  partner: { color: "#10B981", hover: "#059669", name: "Partner App", sub: "Drive & earn" },
};

export function StatusBadge({ status }) {
  const map = {
    available: ["Available", "text-emerald-400 bg-emerald-500/15 border-emerald-500/30"],
    booked: ["Booked", "text-amber-400 bg-amber-500/15 border-amber-500/30"],
    offline: ["Offline", "text-slate-400 bg-slate-500/15 border-slate-500/30"],
    faulty: ["Faulty", "text-rose-400 bg-rose-500/15 border-rose-500/30"],
    approved: ["Approved", "text-emerald-400 bg-emerald-500/15 border-emerald-500/30"],
    in_review: ["In review", "text-amber-400 bg-amber-500/15 border-amber-500/30"],
    rejected: ["Rejected", "text-rose-400 bg-rose-500/15 border-rose-500/30"],
    verified: ["Verified", "text-emerald-400 bg-emerald-500/15 border-emerald-500/30"],
    submitted: ["Pending review", "text-amber-400 bg-amber-500/15 border-amber-500/30"],
    overdue: ["Overdue", "text-rose-400 bg-rose-500/15 border-rose-500/30"],
    not_due: ["Up to date", "text-slate-300 bg-slate-500/15 border-slate-500/30"],
    pending: ["Pending", "text-amber-400 bg-amber-500/15 border-amber-500/30"],
    paid: ["Paid", "text-emerald-400 bg-emerald-500/15 border-emerald-500/30"],
    open: ["Open", "text-rose-400 bg-rose-500/15 border-rose-500/30"],
    closed: ["Closed", "text-slate-300 bg-slate-500/15 border-slate-500/30"],
  };
  const [label, cls] = map[status] || [status, "text-slate-300 bg-slate-500/15 border-slate-500/30"];
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", cls)}>{label}</span>;
}

export function KPI({ label, value, sub, accent, testid, icon: Icon, light }) {
  return (
    <div data-testid={testid} className={cn("card-hover rounded-xl border p-5 animate-in", light ? "border-stone-200 bg-white shadow-sm" : "border-slate-800 bg-slate-900/60")}>
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-medium uppercase tracking-wide", light ? "text-stone-500" : "text-slate-400")}>{label}</span>
        {Icon && <Icon size={16} style={{ color: accent }} />}
      </div>
      <div className={cn("mt-2 font-display text-2xl font-extrabold tracking-tight", light ? "text-stone-900" : "text-white")}>{value}</div>
      {sub && <div className={cn("mt-1 text-xs", light ? "text-stone-400" : "text-slate-500")}>{sub}</div>}
    </div>
  );
}

export function AdRotator({ ads, light }) {
  const list = ads && ads.length ? ads : [];
  const [i, setI] = useState(0);
  const [p, setP] = useState(0);
  const dur = list[i]?.duration || 15;
  useEffect(() => {
    setP(0);
    const step = 100 / (dur * 10);
    const t = setInterval(() => {
      setP((x) => {
        if (x + step >= 100) { setI((n) => (n + 1) % Math.max(1, list.length)); return 0; }
        return x + step;
      });
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [i, dur, list.length]);
  const palette = ["#F59E0B", "#3B82F6", "#EC4899", "#10B981"];
  if (!list.length) return <div className={light ? "text-sm text-stone-400" : "text-sm text-slate-500"}>No ads on air.</div>;
  const cur = list[i];
  return (
    <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
      <div className="relative aspect-video overflow-hidden rounded-xl border-4 border-slate-800 bg-black">
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ background: `radial-gradient(circle at 50% 35%, ${palette[i % 4]}33, #000)` }}>
          <div className="text-3xl">🚕</div>
          <div className="mt-2 px-4 font-display text-xl font-bold text-white">{cur.title}</div>
          <div className="mt-1 text-xs font-semibold" style={{ color: palette[i % 4] }}>{cur.advertiser_name}</div>
        </div>
        <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-rose-500" /> LIVE · Ad {i + 1}/{list.length}
        </div>
        <div className="absolute bottom-0 left-0 h-1.5" style={{ width: p + "%", background: palette[i % 4], transition: "width .1s linear" }} />
      </div>
      <div className="space-y-2">
        <div className={cn("text-xs font-semibold uppercase tracking-wide", light ? "text-stone-500" : "text-slate-400")}>Rotation · 4 brands / minute</div>
        {list.map((a, n) => (
          <div key={a.id} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", n === i ? "" : light ? "border-stone-200" : "border-slate-800")}
            style={n === i ? { borderColor: palette[n % 4], background: palette[n % 4] + "1a" } : {}}>
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: palette[n % 4] }} />
            <span className={cn("truncate font-medium", light ? "text-stone-800" : "text-white")}>{a.advertiser_name}</span>
            <span className={cn("ml-auto text-xs", light ? "text-stone-400" : "text-slate-500")}>{Math.round(a.duration)}s</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SlotGrid({ cabs, onCellClick, selectedIds = [], testid }) {
  const color = (c) => {
    if (selectedIds.includes(c.id)) return "#3B82F6";
    return { available: "#10B981", booked: "#F59E0B", offline: "#6B7280", faulty: "#EF4444" }[c.status] || "#6B7280";
  };
  const testFor = (s) => ({ available: "admin-slot-item-green", booked: "admin-slot-item-amber", offline: "admin-slot-item-grey", faulty: "admin-slot-item-red" }[s]);
  return (
    <div data-testid={testid} className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(34px, 1fr))" }}>
      {cabs.map((c) => (
        <button
          key={c.id}
          data-testid={testFor(c.status)}
          title={`${c.plate} · ${c.status}${c.advertiser_name ? " · " + c.advertiser_name : ""}`}
          onClick={() => onCellClick && onCellClick(c)}
          className="slot tap aspect-square rounded-md border text-[9px] font-mono font-semibold leading-none flex items-center justify-center"
          style={{ background: color(c) + "22", borderColor: color(c) + "88", color: color(c) }}
        >
          {c.plate.slice(-4)}
        </button>
      ))}
    </div>
  );
}

export function Legend() {
  const items = [["Available", "#10B981"], ["Booked", "#F59E0B"], ["Offline", "#6B7280"], ["Faulty", "#EF4444"]];
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-400">
      {items.map(([l, c]) => (
        <span key={l} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{l}
        </span>
      ))}
    </div>
  );
}

export function LoginScreen({ portal, demoCreds, isPhone }) {
  const { login, config } = useAuth();
  const acc = ACCENTS[portal];
  const brand = config?.brand?.name || "Sawari";
  const demoMode = config?.brand?.demo_mode !== false;
  const [identifier, setId] = useState("");
  const [password, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setErr(""); setLoading(true);
    const r = await login(identifier, password, portal);
    setLoading(false);
    if (!r.ok) setErr(r.error);
  };

  const fill = (c) => { setId(c.id); setPw(c.pw); };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "radial-gradient(1200px 600px at 20% 0%, " + acc.color + "22, transparent), var(--bg-dark)" }}>
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className={cn("w-full rounded-2xl border border-slate-800 bg-slate-900/70 p-8 glass", isPhone ? "max-w-[420px]" : "max-w-md")}>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl" style={{ background: acc.color + "22" }}>{config?.brand?.logo || "🚕"}</div>
          <div>
            <div className="font-display text-xl font-extrabold text-white">{brand}</div>
            <div className="text-xs font-medium" style={{ color: acc.color }}>{acc.name} · {acc.sub}</div>
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold text-white">Sign in</h1>
        <p className="mb-6 mt-1 text-sm text-slate-400">Access is limited to the {acc.name}. Wrong-portal accounts are rejected.</p>
        <form onSubmit={submit} className="space-y-4" autoComplete="off">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">{isPhone ? "Phone number" : "Email"}</label>
            <input data-testid="login-email-input" value={identifier} onChange={(e) => setId(e.target.value)} autoComplete="off"
              className="tap w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-white outline-none focus:border-slate-500"
              placeholder={isPhone ? "9812340001" : "you@company.com"} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">{isPhone ? "PIN" : "Password"}</label>
            <input data-testid="login-password-input" type="password" value={password} onChange={(e) => setPw(e.target.value)} autoComplete="new-password"
              className="tap w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-white outline-none focus:border-slate-500"
              placeholder="••••••••" />
          </div>
          {err && <div data-testid="login-error" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{err}</div>}
          <button data-testid="login-submit-button" type="button" onClick={submit} disabled={loading}
            className="tap flex w-full items-center justify-center gap-2 rounded-lg py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: acc.color }}>
            {loading && <Loader2 className="animate-spin" size={16} />} Sign in
          </button>
        </form>
        {demoMode && demoCreds && (
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <div className="mb-2 text-xs font-semibold text-slate-400">Demo accounts — tap to autofill</div>
            <div className="space-y-1.5">
              {demoCreds.map((c, i) => (
                <button key={i} data-testid="demo-autofill-button" onClick={() => fill(c)}
                  className="flex w-full items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-left text-xs hover:border-slate-600">
                  <span className="font-mono text-slate-300">{c.id}</span>
                  <span className="text-slate-500">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <a href="#/" className="mt-5 block text-center text-xs text-slate-500 hover:text-slate-300">← All portals</a>
      </motion.div>
    </div>
  );
}

export function Modal({ open, onClose, children, title, wide, testid }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        data-testid={testid}
        onClick={(e) => e.stopPropagation()}
        className={cn("relative w-full rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl", wide ? "max-w-2xl" : "max-w-md")}>
        {title && <h3 className="mb-4 font-display text-lg font-bold text-white">{title}</h3>}
        {children}
      </motion.div>
    </div>
  );
}

export { ACCENTS };
