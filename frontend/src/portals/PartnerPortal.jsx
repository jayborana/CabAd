import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { http, inr, apiError } from "@/lib/api";
import { LoginScreen, StatusBadge, Modal } from "@/components/shared";
import { toast } from "sonner";
import {
  Home, Wallet, Cpu, User, Loader2, Camera, AlertTriangle, Radio, Battery,
  Signal, MapPin, Gift, CheckCircle2, RefreshCw, Flag,
} from "lucide-react";

const ACCENT = "#10B981";
const TABS = [
  { key: "today", label: "Today", icon: Home, testid: "partner-bottom-nav-today" },
  { key: "earnings", label: "Earnings", icon: Wallet, testid: "partner-bottom-nav-earnings" },
  { key: "device", label: "Device", icon: Cpu, testid: "partner-bottom-nav-device" },
  { key: "profile", label: "Profile", icon: User, testid: "partner-bottom-nav-profile" },
];

export default function PartnerPortal() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("today");
  if (user === null) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-slate-500" /></div>;
  if (!user || user.portal !== "partner")
    return <LoginScreen portal="partner" isPhone demoCreds={[{ id: "9812340001", pw: "1234", label: "Driver" }]} />;

  return (
    <div className="min-h-screen bg-slate-950/60" style={{ background: "radial-gradient(600px 300px at 50% 0%, #10B98118, transparent), var(--bg-dark)" }}>
      <div className="relative mx-auto min-h-screen max-w-[460px] border-x border-slate-800 bg-[var(--bg-dark)] pb-24 shadow-2xl">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2"><span className="text-xl">🚕</span><span className="font-display font-extrabold text-white">Sawari Partner</span></div>
          <button onClick={logout} data-testid="logout-btn" className="text-xs text-slate-400">Sign out</button>
        </div>
        <div className="p-4">
          {tab === "today" && <Today />}
          {tab === "earnings" && <Earnings />}
          {tab === "device" && <Device />}
          {tab === "profile" && <Profile />}
        </div>
        <nav className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-[460px] -translate-x-1/2 border-t border-slate-800 bg-slate-900/95 backdrop-blur">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button key={t.key} data-testid={t.testid} onClick={() => setTab(t.key)}
                className="tap flex flex-1 flex-col items-center gap-0.5 py-2.5" style={on ? { color: ACCENT } : { color: "#64748b" }}>
                <t.icon size={20} /><span className="text-[10px] font-medium">{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function useDriver() {
  const [d, setD] = useState(null);
  const reload = useCallback(() => http.get("/drivers/me").then((r) => setD(r.data)).catch(() => {}), []);
  useEffect(() => { reload(); }, [reload]);
  return [d, reload];
}
const Loader = () => <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-500" /></div>;
const Card = ({ children, className = "", ...rest }) => <div className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-4 ${className}`} {...rest}>{children}</div>;

// ---------------- Today ----------------
function Today() {
  const [d, reload] = useDriver();
  const [onScreen] = useState({ title: "Buy 1 Get 1 — Weekend Special", advertiser: "Pizza Palace" });
  const [camOpen, setCamOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const { config } = useAuth();
  if (!d) return <Loader />;

  const dueIn = d.photo_due_in;
  const overdue = dueIn < 0;
  const veryOverdue = dueIn < -3;
  const daily = config?.rules?.DRIVER_DAILY || 60;
  const earnedPct = d.on_duty ? 0.55 : 0.2;
  const earned = Math.round(daily * earnedPct);

  const toggle = async () => { await http.post("/drivers/me/duty", { on_duty: !d.on_duty }); reload(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><div className="text-xs text-slate-500">Namaste 👋</div><div className="font-display text-xl font-extrabold text-white">{d.name}</div></div>
        <button data-testid="partner-duty-toggle-switch" onClick={toggle}
          className="tap flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
          style={d.on_duty ? { background: ACCENT, color: "#fff" } : { background: "#1f2937", color: "#94a3b8" }}>
          <span className="h-2 w-2 rounded-full" style={{ background: d.on_duty ? "#fff" : "#64748b" }} />{d.on_duty ? "On duty" : "Off duty"}
        </button>
      </div>

      {(overdue || d.compliance === "overdue") ? (
        <ComplianceCard status="overdue" dueIn={dueIn} onSubmit={() => setCamOpen(true)} veryOverdue={veryOverdue} />
      ) : d.compliance === "submitted" ? (
        <ComplianceCard status="submitted" onSubmit={() => setCamOpen(true)} />
      ) : (
        <ComplianceCard status="ok" dueIn={dueIn} onSubmit={() => setCamOpen(true)} />
      )}

      <Card data-testid="partner-today-earnings-card">
        <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wide text-slate-500">Earnings today</span><span className="text-xs text-slate-500">₹{daily} / day</span></div>
        <div className="mt-1 font-display text-3xl font-extrabold" style={{ color: ACCENT }}>{inr(earned)}</div>
        <div className="mt-2 h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full" style={{ width: `${earnedPct * 100}%`, background: ACCENT }} /></div>
        <div className="mt-1 text-xs text-slate-500">Pro-rated on active hours</div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-xs text-slate-400"><Radio size={13} className="text-emerald-400" /> On screen now</div>
        <div className="mt-1 font-semibold text-white">{onScreen.title}</div>
        <div className="text-xs text-slate-500">{onScreen.advertiser}</div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card><div className="text-xs text-slate-500">Plays today</div><div className="font-display text-xl font-bold text-white">{(config?.rules?.PLAYS_PER_CAB_DAY || 720)}</div></Card>
        <Card><div className="text-xs text-slate-500">Distance</div><div className="font-display text-xl font-bold text-white">{config?.rules?.KM_PER_CAB_DAY || 132} km</div></Card>
      </div>

      <button onClick={() => setReportOpen(true)} className="tap flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300"><Flag size={15} /> Report a problem</button>

      <CameraModal open={camOpen} onClose={() => setCamOpen(false)} onDone={reload} />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}

function ComplianceCard({ status, dueIn, onSubmit, veryOverdue }) {
  const cfg = {
    overdue: { bg: "border-rose-500/50 bg-rose-500/10", icon: <AlertTriangle className="text-rose-400" />, title: "Compliance photo OVERDUE", text: `Was due ${Math.abs(dueIn)} day(s) ago. Submit now to avoid a hold.` },
    submitted: { bg: "border-amber-500/50 bg-amber-500/10", icon: <RefreshCw className="text-amber-400" />, title: "Photo under review", text: "Admin will verify shortly." },
    ok: { bg: "border-emerald-500/40 bg-emerald-500/10", icon: <CheckCircle2 className="text-emerald-400" />, title: "Compliance up to date", text: `Next photo due in ${dueIn} day(s).` },
  }[status];
  return (
    <div className={`rounded-2xl border p-4 ${cfg.bg}`}>
      <div className="flex items-center gap-2">{cfg.icon}<span className="font-display font-bold text-white">{cfg.title}</span></div>
      <p className="mt-1 text-sm text-slate-300">{cfg.text}</p>
      {veryOverdue && <p className="mt-1 text-xs font-semibold text-rose-300">⚠ Flagged to admin — 3+ days overdue.</p>}
      {status !== "submitted" && (
        <button data-testid="partner-compliance-photo-trigger" onClick={onSubmit}
          className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white" style={{ background: ACCENT }}>
          <Camera size={17} /> Submit compliance photo
        </button>
      )}
    </div>
  );
}

function CameraModal({ open, onClose, onDone }) {
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const onFile = (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setImg(r.result); r.readAsDataURL(f); };
  const submit = async () => { setBusy(true); try { await http.post("/drivers/me/compliance-photo", { image: img }); toast.success("Submitted for review"); onDone(); setImg(null); onClose(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setBusy(false); } };
  return (
    <Modal open={open} onClose={onClose} title="Compliance photo" testid="compliance-camera-modal">
      <p className="mb-3 text-sm text-slate-400">Photograph the tablet mounted behind the headrest with an ad playing.</p>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
      {!img ? (
        <button data-testid="partner-camera-capture-btn" onClick={() => fileRef.current.click()}
          className="tap flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-600 text-slate-400">
          <Camera size={44} /><span className="text-sm">Open camera / choose photo</span>
        </button>
      ) : (
        <div>
          <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-slate-700">
            <img src={img} alt="preview" className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-dashed border-white/50" />
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => { setImg(null); fileRef.current.value = ""; }} className="tap flex-1 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300">Retake</button>
            <button data-testid="partner-compliance-submit-btn" onClick={submit} disabled={busy} className="tap flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white" style={{ background: ACCENT }}>{busy && <Loader2 size={15} className="animate-spin" />} Confirm & submit</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

const PROBLEMS = ["Tablet not turning on", "Screen cracked", "No internet / SIM issue", "Ad not playing", "Mount loose", "Other"];
function ReportModal({ open, onClose }) {
  const [sel, setSel] = useState(PROBLEMS[0]);
  const send = () => { toast.success("Reported to ops — someone will reach out"); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title="Report a problem">
      <div className="space-y-2">{PROBLEMS.map((p) => <button key={p} onClick={() => setSel(p)} className={`tap block w-full rounded-lg border px-3 py-2.5 text-left text-sm ${sel === p ? "text-white" : "border-slate-700 text-slate-300"}`} style={sel === p ? { borderColor: ACCENT, background: ACCENT + "22" } : {}}>{p}</button>)}</div>
      <button onClick={send} className="tap mt-4 w-full rounded-xl py-3 font-semibold text-white" style={{ background: ACCENT }}>Send report</button>
    </Modal>
  );
}

// ---------------- Earnings ----------------
function Earnings() {
  const [p, setP] = useState(null);
  useEffect(() => { http.get("/payouts/me").then((r) => setP(r.data)).catch(() => {}); }, []);
  if (!p) return <Loader />;
  const week = [["Mon", 60], ["Tue", 60], ["Wed", 45], ["Thu", 60], ["Fri", 60], ["Sat", 30], ["Sun", 0]];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${ACCENT}, #047857)` }}>
        <div className="text-xs opacity-90">Next payout · {p.next_date}th</div>
        <div className="font-display text-3xl font-extrabold">{inr(p.estimated)}</div>
        <div className="text-xs opacity-90">₹500 per cab · paid on 1st & 16th</div>
      </div>
      <Card>
        <h3 className="mb-3 font-display font-bold text-white">This week</h3>
        <div className="flex items-end justify-between gap-2" style={{ height: 100 }}>
          {week.map(([d, v]) => <div key={d} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-t" style={{ height: `${(v / 60) * 80 + 4}px`, background: ACCENT + (v ? "" : "44") }} /><span className="text-[10px] text-slate-500">{d}</span></div>)}
        </div>
      </Card>
      <Card>
        <h3 className="mb-3 font-display font-bold text-white">Payout history</h3>
        {p.history.length === 0 ? <div className="py-4 text-center text-sm text-slate-500">No payouts yet.</div> :
          p.history.map((h) => <div key={h.id} className="flex items-center justify-between border-b border-slate-800/60 py-2 last:border-0"><div><div className="text-sm text-white">{h.period}</div><div className="font-mono text-[10px] text-slate-500">{h.utr}</div></div><div className="font-mono font-bold text-emerald-400">{inr(h.amount)}</div></div>)}
      </Card>
    </div>
  );
}

// ---------------- Device ----------------
function Device() {
  const [d] = useDriver();
  if (!d) return <Loader />;
  const cab = d.cab || {};
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-3 font-display font-bold text-white">Tablet status</h3>
        <Stat icon={Battery} label="Battery" value={`${cab.battery ?? 82}%`} />
        <Stat icon={Signal} label="Signal" value={"▮".repeat(cab.signal ?? 4) + "▯".repeat(4 - (cab.signal ?? 4))} />
        <Stat icon={Cpu} label="Screen" value="Playing" ok />
        <Stat icon={MapPin} label="Zone" value={cab.zone || "Baner"} />
        <Stat icon={RefreshCw} label="Last check-in" value={cab.last_checkin ? new Date(cab.last_checkin).toLocaleTimeString("en-IN") : "just now"} />
      </Card>
      <Card>
        <h3 className="mb-2 font-display font-bold text-white">Serial</h3>
        <div className="font-mono text-sm text-slate-400">SW-TAB-{(d.id || "").slice(0, 8).toUpperCase()}</div>
      </Card>
      <Card>
        <h3 className="mb-2 font-display font-bold text-white">Rules of the road</h3>
        <ul className="space-y-1.5 text-sm text-slate-400"><li>• Keep the tablet powered and mounted at all times.</li><li>• Submit the compliance photo every 15 days.</li><li>• Don't cover or turn off the screen during shifts.</li><li>• Report faults immediately from the Today tab.</li></ul>
      </Card>
    </div>
  );
}
const Stat = ({ icon: Icon, label, value, ok }) => <div className="flex items-center justify-between border-b border-slate-800/60 py-2.5 last:border-0"><span className="flex items-center gap-2 text-sm text-slate-400"><Icon size={15} /> {label}</span><span className={`font-mono text-sm ${ok ? "text-emerald-400" : "text-white"}`}>{value}</span></div>;

// ---------------- Profile ----------------
function Profile() {
  const [d] = useDriver();
  if (!d) return <Loader />;
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center py-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full text-3xl" style={{ background: ACCENT + "22" }}>👨‍✈️</div>
        <div className="mt-2 font-display text-xl font-extrabold text-white">{d.name}</div>
        <div className="text-sm text-slate-500">{d.phone}</div>
        <div className="mt-1"><StatusBadge status={d.kyc_status === "verified" ? "verified" : "pending"} /></div>
      </div>
      {d.kyc_status !== "verified" && <button className="tap w-full rounded-xl py-3 font-semibold text-white" style={{ background: ACCENT }}>Complete KYC</button>}
      <Card>
        <Row l="Cab plate" v={d.plate} /><Row l="Payout UPI" v={d.payout_upi} /><Row l="On duty" v={d.on_duty ? "Yes" : "No"} />
      </Card>
      <div className="rounded-2xl border border-dashed p-4 text-center" style={{ borderColor: ACCENT + "66" }}>
        <Gift size={22} className="mx-auto" style={{ color: ACCENT }} />
        <div className="mt-1 text-sm text-slate-400">Refer a driver, earn</div>
        <div className="font-display text-lg font-extrabold text-white">₹300 per referral</div>
        <div className="mt-2 inline-block rounded-lg bg-slate-800 px-4 py-1.5 font-mono text-sm text-white">{d.referral_code}</div>
      </div>
    </div>
  );
}
const Row = ({ l, v }) => <div className="flex justify-between border-b border-slate-800/60 py-2 text-sm last:border-0"><span className="text-slate-400">{l}</span><span className="font-mono text-white">{v}</span></div>;
