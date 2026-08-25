import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { LogOut, Menu, X } from "lucide-react";

export function Shell({ accent, portalName, nav, active, onNav, children }) {
  const { user, logout, config } = useAuth();
  const [open, setOpen] = useState(false);

  const NavList = ({ onClick }) => (
    <nav className="flex flex-col gap-1">
      {nav.map((n) => {
        const on = active === n.key;
        return (
          <button key={n.key} data-testid={`nav-${n.key}`}
            onClick={() => { onNav(n.key); onClick && onClick(); }}
            className={cn("tap flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              on ? "text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/50")}
            style={on ? { background: accent + "22", boxShadow: `inset 3px 0 0 ${accent}` } : {}}>
            <n.icon size={17} style={on ? { color: accent } : {}} />
            {n.label}
            {n.badge ? <span className="ml-auto rounded-full px-1.5 text-[10px] font-bold" style={{ background: accent, color: "#fff" }}>{n.badge}</span> : null}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-dark)]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-800 bg-slate-900/60 p-4 lg:flex">
        <Brand accent={accent} portalName={portalName} logo={config?.brand?.logo} brand={config?.brand?.name} />
        <div className="mt-6 flex-1 overflow-y-auto"><NavList /></div>
        <UserBox user={user} logout={logout} />
      </aside>

      {/* Mobile / tablet top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur lg:hidden">
        <button className="tap" onClick={() => setOpen(true)}><Menu size={22} /></button>
        <Brand accent={accent} portalName={portalName} logo={config?.brand?.logo} brand={config?.brand?.name} compact />
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-slate-900 p-4">
            <div className="mb-4 flex items-center justify-between">
              <Brand accent={accent} portalName={portalName} logo={config?.brand?.logo} brand={config?.brand?.name} compact />
              <button className="tap" onClick={() => setOpen(false)}><X size={22} /></button>
            </div>
            <NavList onClick={() => setOpen(false)} />
            <div className="mt-4"><UserBox user={user} logout={logout} /></div>
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

function Brand({ accent, portalName, logo, brand, compact }) {
  return (
    <a href="#/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg text-xl" style={{ background: accent + "22" }}>{logo || "🚕"}</span>
      <div className="leading-tight">
        <div className="font-display text-sm font-extrabold text-white">{brand || "Sawari"}</div>
        {!compact && <div className="text-[11px] font-medium" style={{ color: accent }}>{portalName}</div>}
      </div>
    </a>
  );
}

function UserBox({ user, logout }) {
  return (
    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="truncate text-sm font-semibold text-white">{user?.name}</div>
      <div className="truncate text-xs text-slate-500">{user?.email || user?.phone}</div>
      <button data-testid="logout-btn" onClick={logout}
        className="tap mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800">
        <LogOut size={13} /> Sign out
      </button>
    </div>
  );
}

export function PageHead({ title, sub, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-slate-400">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className }) {
  return <div className={cn("rounded-xl border border-slate-800 bg-slate-900/60 p-5", className)}>{children}</div>;
}
