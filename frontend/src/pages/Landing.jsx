import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, Megaphone, Car, ArrowRight } from "lucide-react";

const PORTALS = [
  { key: "ops", href: "#/ops", icon: ShieldCheck, color: "#2563EB", title: "Control Hub", sub: "Admin & Operations", desc: "Fleet, slots, ad review, payouts, finance." },
  { key: "business", href: "#/business", icon: Megaphone, color: "#D97706", title: "Advertiser Portal", sub: "Business Owners", desc: "Book cab slots, upload ads, track reach." },
  { key: "partner", href: "#/partner", icon: Car, color: "#10B981", title: "Partner App", sub: "Drivers", desc: "Shift, earnings, device & compliance photo." },
];

export default function Landing() {
  const { config } = useAuth();
  const brand = config?.brand?.name || "Sawari";
  const demoMode = config?.brand?.demo_mode !== false;
  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(1000px 500px at 50% -10%, #2563EB22, transparent), var(--bg-dark)" }}>
      <div className="mx-auto max-w-5xl px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-4xl shadow-lg">{config?.brand?.logo || "🚕"}</div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{brand}</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">Digital advertising on tablet screens behind {config?.brand?.city || "Pune"} cab headrests. Three portals, three logins — pick yours.</p>
        </motion.div>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {PORTALS.map((p, i) => (
            <motion.a key={p.key} href={p.href} data-testid={`portal-link-${p.key}`}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}
              className="card-hover group rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: p.color + "22" }}>
                <p.icon size={22} style={{ color: p.color }} />
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: p.color }}>{p.sub}</div>
              <div className="mt-1 font-display text-xl font-bold text-white">{p.title}</div>
              <p className="mt-2 text-sm text-slate-400">{p.desc}</p>
              <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-slate-300 group-hover:gap-2.5 transition-all" style={{ color: p.color }}>
                Enter <ArrowRight size={15} />
              </div>
            </motion.a>
          ))}
        </div>
        {demoMode && (
          <p className="mt-10 text-center text-xs text-slate-600">Demo mode · seeded data · payments are mocked</p>
        )}
      </div>
    </div>
  );
}
