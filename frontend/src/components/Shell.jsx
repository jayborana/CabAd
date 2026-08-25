import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { LogOut, Menu, X } from "lucide-react";

const ShellTheme = createContext("dark");
export const useShellTheme = () => useContext(ShellTheme);

export function Shell({ accent, portalName, nav, active, onNav, children, theme = "dark" }) {
  const { user, logout, config } = useAuth();
  const [open, setOpen] = useState(false);
  const light = theme === "light";
  useEffect(() => {
    document.body.style.background = light ? "#F7F3EC" : "";
    return () => { document.body.style.background = ""; };
  }, [light]);
  const t = light
    ? { root: "bg-[#F7F3EC]", aside: "border-stone-200 bg-white", header: "border-stone-200 bg-white/90",
        idle: "text-stone-500 hover:text-stone-900 hover:bg-stone-100", menu: "text-stone-700" }
    : { root: "bg-[var(--bg-dark)]", aside: "border-slate-800 bg-slate-900/60", header: "border-slate-800 bg-slate-900/80",
        idle: "text-slate-400 hover:text-white hover:bg-slate-800/50", menu: "text-white" };

  const NavList = ({ onClick }) => (
    <nav className="flex flex-col gap-1">
      {nav.map((n) => {
        const on = active === n.key;
        return (
          <button key={n.key} data-testid={`nav-${n.key}`}
            onClick={() => { onNav(n.key); onClick && onClick(); }}
            className={cn("tap flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              on ? (light ? "text-stone-900" : "text-white") : t.idle)}
            style={on ? { background: accent + (light ? "1f" : "22"), boxShadow: `inset 3px 0 0 ${accent}` } : {}}>
            <n.icon size={17} style={on ? { color: accent } : {}} />
            {n.label}
            {n.badge ? <span className="ml-auto rounded-full px-1.5 text-[10px] font-bold" style={{ background: accent, color: "#fff" }}>{n.badge}</span> : null}
          </button>
        );
      })}
    </nav>
  );

  return (
    <ShellTheme.Provider value={theme}>
    <div className={cn("min-h-screen", t.root)}>
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r p-4 lg:flex", t.aside)}>
        <Brand accent={accent} portalName={portalName} logo={config?.brand?.logo} brand={config?.brand?.name} light={light} />
        <div className="mt-6 flex-1 overflow-y-auto"><NavList /></div>
        <UserBox user={user} logout={logout} light={light} />
      </aside>

      <header className={cn("sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 backdrop-blur lg:hidden", t.header)}>
        <button className={cn("tap", t.menu)} onClick={() => setOpen(true)}><Menu size={22} /></button>
        <Brand accent={accent} portalName={portalName} logo={config?.brand?.logo} brand={config?.brand?.name} light={light} compact />
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className={cn("absolute inset-y-0 left-0 w-72 p-4", light ? "bg-white" : "bg-slate-900")}>
            <div className="mb-4 flex items-center justify-between">
              <Brand accent={accent} portalName={portalName} logo={config?.brand?.logo} brand={config?.brand?.name} light={light} compact />
              <button className={cn("tap", t.menu)} onClick={() => setOpen(false)}><X size={22} /></button>
            </div>
            <NavList onClick={() => setOpen(false)} />
            <div className="mt-4"><UserBox user={user} logout={logout} light={light} /></div>
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
    </ShellTheme.Provider>
  );
}

function Brand({ accent, portalName, logo, brand, compact, light }) {
  return (
    <a href="#/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg text-xl" style={{ background: accent + "22" }}>{logo || "🚕"}</span>
      <div className="leading-tight">
        <div className={cn("font-display text-sm font-extrabold", light ? "text-stone-900" : "text-white")}>{brand || "Sawari"}</div>
        {!compact && <div className="text-[11px] font-medium" style={{ color: accent }}>{portalName}</div>}
      </div>
    </a>
  );
}

function UserBox({ user, logout, light }) {
  return (
    <div className={cn("mt-4 rounded-lg border p-3", light ? "border-stone-200 bg-stone-50" : "border-slate-800 bg-slate-950/40")}>
      <div className={cn("truncate text-sm font-semibold", light ? "text-stone-900" : "text-white")}>{user?.name}</div>
      <div className={cn("truncate text-xs", light ? "text-stone-500" : "text-slate-500")}>{user?.email || user?.phone}</div>
      <button data-testid="logout-btn" onClick={logout}
        className={cn("tap mt-2 flex w-full items-center justify-center gap-2 rounded-md border py-2 text-xs font-medium",
          light ? "border-stone-300 text-stone-700 hover:bg-stone-100" : "border-slate-700 text-slate-300 hover:bg-slate-800")}>
        <LogOut size={13} /> Sign out
      </button>
    </div>
  );
}

export function PageHead({ title, sub, action }) {
  const light = useShellTheme() === "light";
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className={cn("font-display text-2xl font-extrabold tracking-tight sm:text-3xl", light ? "text-stone-900" : "text-white")}>{title}</h1>
        {sub && <p className={cn("mt-1 text-sm", light ? "text-stone-500" : "text-slate-400")}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className, ...rest }) {
  const light = useShellTheme() === "light";
  return <div className={cn("rounded-xl border p-5", light ? "border-stone-200 bg-white shadow-sm" : "border-slate-800 bg-slate-900/60", className)} {...rest}>{children}</div>;
}
