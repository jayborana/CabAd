import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { http, inr, apiError } from "@/lib/api";
import { LoginScreen, KPI, SlotGrid, Legend, StatusBadge, Modal } from "@/components/shared";
import { Shell, PageHead, Card } from "@/components/Shell";
import { toast } from "sonner";
import {
  LayoutDashboard, Grid3x3, ClipboardCheck, Building2, Users, Wallet,
  TrendingUp, AlertTriangle, Loader2, Plus, Car, IndianRupee, PlayCircle,
} from "lucide-react";

const ACCENT = "#2563EB";
const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "fleet", label: "Fleet & Slots", icon: Grid3x3 },
  { key: "review", label: "Ad Review", icon: ClipboardCheck },
  { key: "advertisers", label: "Advertisers", icon: Building2 },
  { key: "drivers", label: "Drivers", icon: Users },
  { key: "payouts", label: "Payouts", icon: Wallet },
  { key: "finance", label: "Finance", icon: TrendingUp },
  { key: "incidents", label: "Incidents", icon: AlertTriangle },
];

export default function OpsPortal() {
  const { user } = useAuth();
  const [screen, setScreen] = useState("dashboard");
  if (user === null) return <FullLoader />;
  if (!user || user.portal !== "ops")
    return <LoginScreen portal="ops" demoCreds={[
      { id: "jayborana3@gmail.com", pw: "demo1234", label: "Owner" },
      { id: "admin@sawari.in", pw: "demo1234", label: "Admin" },
      { id: "reviewer@sawari.in", pw: "demo1234", label: "Reviewer" },
    ]} />;

  return (
    <Shell accent={ACCENT} portalName="Control Hub" nav={NAV} active={screen} onNav={setScreen}>
      {screen === "dashboard" && <Dashboard go={setScreen} />}
      {screen === "fleet" && <Fleet />}
      {screen === "review" && <Review />}
      {screen === "advertisers" && <Advertisers />}
      {screen === "drivers" && <Drivers />}
      {screen === "payouts" && <Payouts />}
      {screen === "finance" && <Finance />}
      {screen === "incidents" && <Incidents />}
    </Shell>
  );
}

const FullLoader = () => <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-slate-500" /></div>;

function useFetch(url, dep = []) {
  const [data, setData] = useState(null);
  const reload = useCallback(() => { http.get(url).then((r) => setData(r.data)).catch(() => {}); }, [url]);
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, dep);
  return [data, reload, setData];
}

// ---------------- Dashboard ----------------
function Dashboard({ go }) {
  const [kpi] = useFetch("/ops/dashboard");
  const [cabs, reloadCabs] = useFetch("/cabs");
  const [activity] = useFetch("/activity");
  if (!kpi || !cabs) return <FullLoader />;
  return (
    <>
      <PageHead title="Control Hub" sub="Founder dashboard — supply, demand & money at a glance." />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KPI testid="admin-dashboard-active-cabs-kpi" label="Total cabs" value={kpi.total_cabs} icon={Car} accent={ACCENT} />
        <KPI label="Slots sold" value={kpi.booked} sub={`${kpi.available} free`} icon={Grid3x3} accent={ACCENT} />
        <KPI testid="admin-dashboard-revenue-kpi" label="MRR" value={inr(kpi.mrr)} icon={IndianRupee} accent={ACCENT} />
        <KPI label="Gross margin" value={inr(kpi.gross_margin)} icon={TrendingUp} accent={ACCENT} />
        <KPI label="Plays today" value={kpi.plays_today.toLocaleString("en-IN")} icon={PlayCircle} accent={ACCENT} />
        <KPI label="Pending reviews" value={kpi.pending_reviews} sub={`${kpi.overdue_photos} photo overdue`} icon={ClipboardCheck} accent={ACCENT} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display font-bold text-white">Slot visualiser</h3>
            <button onClick={() => go("fleet")} className="text-xs font-medium" style={{ color: ACCENT }}>Manage →</button>
          </div>
          <Legend />
          <div className="mt-3"><SlotGrid testid="admin-slot-visualiser-grid" cabs={cabs} onCellClick={() => go("fleet")} /></div>
        </Card>
        <Card>
          <h3 className="mb-3 font-display font-bold text-white">Activity feed</h3>
          <div className="space-y-3">
            {(activity || []).slice(0, 12).map((a) => (
              <div key={a.id} className="flex gap-2.5 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full" style={{ background: ACCENT }} />
                <div>
                  <span className="text-slate-300"><b className="text-white">{a.actor}</b> {a.action}</span>
                  <div className="text-[11px] text-slate-600">{new Date(a.ts).toLocaleString("en-IN")}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

// ---------------- Fleet & slot management ----------------
function Fleet() {
  const [cabs, reload] = useFetch("/cabs");
  const [advs] = useFetch("/advertisers");
  const { config, setConfig } = useAuth();
  const [selected, setSelected] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [plate, setPlate] = useState("");
  const [maxCabs, setMaxCabs] = useState("");

  if (!cabs || !advs) return <FullLoader />;
  const avail = cabs.filter((c) => c.status === "available").length;
  const booked = cabs.filter((c) => c.status === "booked").length;

  const addCab = async () => {
    if (!plate.trim()) return;
    await http.post("/cabs", { plate });
    setPlate(""); setAddOpen(false); reload(); toast.success("Cab added");
  };
  const saveMax = async () => {
    const r = await http.put("/config/fleet", { max_cabs: Number(maxCabs) });
    setConfig({ ...config, fleet: r.data }); toast.success("Max cabs updated");
  };

  return (
    <>
      <PageHead title="Fleet & Slots" sub={`${cabs.length} cabs · ${avail} available · ${booked} booked`}
        action={<button data-testid="admin-fleet-add-cab-btn" onClick={() => setAddOpen(true)}
          className="tap flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: ACCENT }}><Plus size={16} /> Add cab</button>} />

      <div className="grid gap-4 sm:grid-cols-4">
        <KPI label="Ad slots available" value={avail} accent={ACCENT} />
        <KPI label="Slots sold" value={booked} accent={ACCENT} />
        <KPI label="Revenue potential" value={inr(avail * (config?.rules?.PRICE_PER_CAB || 4300))} accent={ACCENT} />
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Max cabs (cap)</div>
          <div className="mt-2 flex gap-2">
            <input value={maxCabs} onChange={(e) => setMaxCabs(e.target.value)} placeholder={String(config?.fleet?.max_cabs || 200)}
              className="tap w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 text-white" />
            <button onClick={saveMax} className="tap rounded-md px-3 text-sm font-semibold text-white" style={{ background: ACCENT }}>Set</button>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-display font-bold text-white">Slot grid — click a cell to manage</h3><Legend /></div>
        <SlotGrid cabs={cabs} onCellClick={setSelected} />
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Cab ${selected.plate}` : ""}>
        {selected && <CabManager cab={selected} advs={advs} onDone={() => { setSelected(null); reload(); }} />}
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a cab">
        <label className="mb-1.5 block text-xs text-slate-400">Plate number</label>
        <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="MH-12-AB-1234"
          className="tap mb-4 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-white" />
        <button onClick={addCab} className="tap w-full rounded-lg py-2.5 font-semibold text-white" style={{ background: ACCENT }}>Add cab</button>
      </Modal>
    </>
  );
}

function CabManager({ cab, advs, onDone }) {
  const [advId, setAdvId] = useState(advs[0]?.id || "");
  const setStatus = async (status) => { await http.patch(`/cabs/${cab.id}`, { status }); toast.success(`Marked ${status}`); onDone(); };
  const assign = async () => { try { await http.post(`/cabs/${cab.id}/assign`, { advertiser_id: advId }); toast.success("Assigned"); onDone(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };
  const unassign = async () => { await http.post(`/cabs/${cab.id}/unassign`); toast.success("Unassigned"); onDone(); };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><StatusBadge status={cab.status} />{cab.advertiser_name && <span className="text-sm text-slate-400">· {cab.advertiser_name}</span>}<span className="ml-auto text-xs text-slate-500">{cab.zone}</span></div>
      {cab.status === "available" && (
        <div className="rounded-lg border border-slate-800 p-3">
          <label className="mb-1.5 block text-xs text-slate-400">Assign to advertiser</label>
          <select value={advId} onChange={(e) => setAdvId(e.target.value)} className="tap mb-2 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-2 text-white">
            {advs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button onClick={assign} className="tap w-full rounded-md py-2 text-sm font-semibold text-white" style={{ background: ACCENT }}>Assign slot</button>
        </div>
      )}
      {cab.status === "booked" && <button onClick={unassign} className="tap w-full rounded-md border border-amber-500/40 py-2 text-sm font-semibold text-amber-300">Unassign / free this slot</button>}
      <div className="grid grid-cols-2 gap-2">
        {["available", "offline", "faulty"].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className="tap rounded-md border border-slate-700 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 capitalize">{s}</button>
        ))}
      </div>
    </div>
  );
}

// ---------------- Ad review queue ----------------
const REJECT_REASONS = ["Low resolution / blurry", "Prohibited content", "Missing brand/contact", "Wrong aspect ratio", "Misleading claims", "Audio issues"];
function Review() {
  const [creatives, reload] = useFetch("/creatives?status=in_review");
  const [preview, setPreview] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  if (!creatives) return <FullLoader />;

  const approve = async (c) => { await http.patch(`/creatives/${c.id}/approve`); toast.success("Approved — advertiser can now put it on air"); reload(); };
  const doReject = async () => { await http.patch(`/creatives/${rejectFor.id}/reject`, { reason }); toast.success("Rejected with reason"); setRejectFor(null); reload(); };

  return (
    <>
      <PageHead title="Ad Review Queue" sub={`SLA: approve within 2 working hours · ${creatives.length} pending`} />
      {creatives.length === 0 && <Card><div className="py-8 text-center text-slate-500">Queue is clear. Nice.</div></Card>}
      <div className="grid gap-4 md:grid-cols-2">
        {creatives.map((c) => (
          <Card key={c.id}>
            <div className="mb-3 aspect-video overflow-hidden rounded-lg border border-slate-800 bg-black flex items-center justify-center">
              <button onClick={() => setPreview(c)} className="flex flex-col items-center gap-2 text-slate-400 hover:text-white">
                <PlayCircle size={40} /><span className="text-xs">Preview {c.duration}s</span>
              </button>
            </div>
            <div className="flex items-start justify-between gap-2">
              <div><div className="font-semibold text-white">{c.title}</div><div className="text-xs text-slate-500">{c.advertiser_name}</div></div>
              <StatusBadge status={c.status} />
            </div>
            <div className="mt-3 flex gap-2">
              <button data-testid="admin-ad-review-approve-btn" onClick={() => approve(c)} className="tap flex-1 rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500">Approve</button>
              <button data-testid="admin-ad-review-reject-btn" onClick={() => setRejectFor(c)} className="tap flex-1 rounded-md border border-rose-500/40 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/10">Reject</button>
            </div>
          </Card>
        ))}
      </div>

      <CreativePreview creative={preview} onClose={() => setPreview(null)} />

      <Modal open={!!rejectFor} onClose={() => setRejectFor(null)} title="Reject creative — pick a reason">
        <div className="space-y-2">
          {REJECT_REASONS.map((r) => (
            <button key={r} onClick={() => setReason(r)} className={`tap block w-full rounded-md border px-3 py-2 text-left text-sm ${reason === r ? "border-rose-500 text-white" : "border-slate-700 text-slate-300"}`}>{r}</button>
          ))}
        </div>
        <button onClick={doReject} className="tap mt-4 w-full rounded-lg bg-rose-600 py-2.5 font-semibold text-white">Reject & notify advertiser</button>
      </Modal>
    </>
  );
}

export function CreativePreview({ creative, onClose }) {
  if (!creative) return null;
  return (
    <Modal open={!!creative} onClose={onClose} wide title="Cab-screen simulator (16:9)" testid="creative-preview-modal">
      <div className="relative aspect-video overflow-hidden rounded-lg border-4 border-slate-700 bg-black">
        {creative.video ? (
          <video src={creative.video} controls autoPlay className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 text-center">
            <div className="text-3xl">🚕</div>
            <div className="mt-2 font-display text-lg font-bold text-white">{creative.title}</div>
            <div className="text-xs text-slate-500">Headrest ad · {creative.duration}s</div>
          </div>
        )}
        <div className="absolute bottom-0 left-0 h-1 bg-white/80" style={{ animation: `progressBar ${creative.duration || 15}s linear infinite` }} />
      </div>
      <div className="mt-3 text-center text-xs text-slate-500">Passenger view — {creative.advertiser_name || "your ad"}</div>
    </Modal>
  );
}

// ---------------- Advertisers ----------------
function Advertisers() {
  const [advs, reload] = useFetch("/advertisers");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", gstin: "", category: "Retail" });
  if (!advs) return <FullLoader />;
  const add = async () => {
    try { await http.post("/advertisers", form); toast.success("Advertiser added (login: demo1234)"); setOpen(false); setForm({ name: "", email: "", gstin: "", category: "Retail" }); reload(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  return (
    <>
      <PageHead title="Advertisers" sub={`${advs.length} accounts`}
        action={<button onClick={() => setOpen(true)} className="tap flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: ACCENT }}><Plus size={16} /> Add advertiser</button>} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            {["Business", "Category", "Cabs", "Spend/mo", "GSTIN", "Renewal"].map((h) => <th key={h} className="p-3">{h}</th>)}
          </tr></thead>
          <tbody>
            {advs.map((a) => (
              <tr key={a.id} className="border-b border-slate-800/60">
                <td className="p-3"><div className="font-semibold text-white">{a.name}</div><div className="text-xs text-slate-500">{a.email}</div></td>
                <td className="p-3 text-slate-400">{a.category}</td>
                <td className="p-3 font-mono text-white">{a.cabs_booked}</td>
                <td className="p-3 font-mono text-white">{inr(a.spend)}</td>
                <td className="p-3 font-mono text-xs text-slate-400">{a.gstin || "—"}</td>
                <td className="p-3 text-slate-400">{a.renewal_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Add advertiser">
        <div className="space-y-3">
          {[["Business name", "name"], ["Email", "email"], ["GSTIN", "gstin"], ["Category", "category"]].map(([l, k]) => (
            <div key={k}><label className="mb-1 block text-xs text-slate-400">{l}</label>
              <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="tap w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-white" /></div>
          ))}
          <button onClick={add} className="tap w-full rounded-lg py-2.5 font-semibold text-white" style={{ background: ACCENT }}>Create account</button>
        </div>
      </Modal>
    </>
  );
}

// ---------------- Drivers ----------------
function Drivers() {
  const [drivers] = useFetch("/drivers");
  const [photos] = useFetch("/compliance-photos");
  if (!drivers) return <FullLoader />;
  const overdue = drivers.filter((d) => d.compliance === "overdue");
  return (
    <>
      <PageHead title="Drivers" sub={`${drivers.length} drivers · ${overdue.length} compliance overdue`} />
      {overdue.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <AlertTriangle size={16} /> {overdue.length} driver(s) overdue on compliance photo — flagged.
        </div>
      )}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            {["Driver", "Cab", "KYC", "Payout UPI", "Compliance photo"].map((h) => <th key={h} className="p-3">{h}</th>)}
          </tr></thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} className="border-b border-slate-800/60">
                <td className="p-3"><div className="font-semibold text-white">{d.name}</div><div className="text-xs text-slate-500">{d.phone}</div></td>
                <td className="p-3 font-mono text-slate-300">{d.plate}</td>
                <td className="p-3"><StatusBadge status={d.kyc_status === "verified" ? "verified" : "pending"} /></td>
                <td className="p-3 font-mono text-xs text-slate-400">{d.payout_upi}</td>
                <td className="p-3"><StatusBadge status={d.compliance} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ---------------- Payouts ----------------
function Payouts() {
  const [data, reload] = useFetch("/payouts");
  if (!data) return <FullLoader />;
  const pay = async (o) => {
    try { await http.post("/payouts/run", { driver_id: o.driver_id, amount: o.amount }); toast.success(`Paid ${inr(o.amount)} to ${o.name}`); reload(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  return (
    <>
      <PageHead title="Payouts" sub={`Period ${data.period} · runs on 1st & 16th · ₹500 per active cab`} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            {["Driver", "KYC", "Owed", "UPI", "Action"].map((h) => <th key={h} className="p-3">{h}</th>)}
          </tr></thead>
          <tbody>
            {data.owed.map((o) => (
              <tr key={o.driver_id} className="border-b border-slate-800/60">
                <td className="p-3 font-semibold text-white">{o.name}</td>
                <td className="p-3"><StatusBadge status={o.kyc === "verified" ? "verified" : "pending"} /></td>
                <td className="p-3 font-mono text-white">{inr(o.amount)}</td>
                <td className="p-3 font-mono text-xs text-slate-400">{o.upi}</td>
                <td className="p-3">
                  {o.paid ? <span className="font-mono text-xs text-emerald-400">{o.utr}</span> :
                    o.amount === 0 ? <span className="text-xs text-slate-600">No active cab</span> :
                      <button onClick={() => pay(o)} disabled={o.kyc !== "verified"} className="tap rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40" style={{ background: ACCENT }}>Run payout</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <h3 className="mb-3 mt-6 font-display font-bold text-white">Payout history</h3>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">{["Driver", "Amount", "UTR", "Period", "Date"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>{data.history.map((p) => (
            <tr key={p.id} className="border-b border-slate-800/60"><td className="p-3 text-white">{p.driver_name}</td><td className="p-3 font-mono">{inr(p.amount)}</td><td className="p-3 font-mono text-xs text-slate-400">{p.utr}</td><td className="p-3 text-slate-400">{p.period}</td><td className="p-3 text-slate-500">{new Date(p.date).toLocaleDateString("en-IN")}</td></tr>
          ))}</tbody>
        </table>
      </Card>
    </>
  );
}

// ---------------- Finance ----------------
function Finance() {
  const [f] = useFetch("/finance");
  const { config } = useAuth();
  const [fixed, setFixed] = useState("150000");
  if (!f) return <FullLoader />;
  const breakeven = Math.ceil(Number(fixed) / f.per_cab_contribution);
  return (
    <>
      <PageHead title="Finance" sub="Unit economics for the current month" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPI label="Revenue" value={inr(f.revenue)} accent={ACCENT} />
        <KPI label="Driver cost" value={inr(f.driver_cost)} accent={ACCENT} />
        <KPI label="Device + SIM" value={inr(f.device_cost)} accent={ACCENT} />
        <KPI label="Gross margin" value={inr(f.gross_margin)} sub={`${f.margin_pct}%`} accent={ACCENT} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-display font-bold text-white">Per-cab contribution</h3>
          <Row l="Price charged" v={inr(config?.rules?.PRICE_PER_CAB)} />
          <Row l="Driver payout" v={"− " + inr(config?.rules?.DRIVER_PAY_PER_CAB_MONTH)} />
          <Row l="Hardware (amortised)" v={"− " + inr(config?.rules?.HARDWARE_COST)} />
          <Row l="SIM / data" v={"− " + inr(config?.rules?.SIM_COST)} />
          <div className="mt-2 border-t border-slate-800 pt-2"><Row l="Contribution / cab" v={inr(f.per_cab_contribution)} bold /></div>
        </Card>
        <Card>
          <h3 className="mb-3 font-display font-bold text-white">Breakeven calculator</h3>
          <label className="mb-1 block text-xs text-slate-400">Fixed monthly cost (team, office, etc.)</label>
          <input value={fixed} onChange={(e) => setFixed(e.target.value)} className="tap mb-4 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-white" />
          <div className="rounded-lg bg-slate-950/50 p-4 text-center">
            <div className="text-xs text-slate-400">Cabs needed to break even</div>
            <div className="font-display text-4xl font-extrabold" style={{ color: ACCENT }}>{isFinite(breakeven) ? breakeven : "—"}</div>
            <div className="mt-1 text-xs text-slate-500">at {inr(f.per_cab_contribution)} contribution / cab</div>
          </div>
        </Card>
      </div>
    </>
  );
}
const Row = ({ l, v, bold }) => <div className="flex justify-between py-1 text-sm"><span className="text-slate-400">{l}</span><span className={`font-mono ${bold ? "font-bold text-white" : "text-slate-200"}`}>{v}</span></div>;

// ---------------- Incidents ----------------
function Incidents() {
  const [items, reload] = useFetch("/incidents");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", severity: "medium", assignee: "Field Ops" });
  if (!items) return <FullLoader />;
  const add = async () => { if (!form.title.trim()) return; await http.post("/incidents", form); toast.success("Incident opened"); setOpen(false); setForm({ title: "", severity: "medium", assignee: "Field Ops" }); reload(); };
  const close = async (i) => { await http.patch(`/incidents/${i.id}/close`); toast.success("Closed"); reload(); };
  return (
    <>
      <PageHead title="Incidents" sub="Playbook: open → assign → resolve → close"
        action={<button onClick={() => setOpen(true)} className="tap flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: ACCENT }}><Plus size={16} /> New incident</button>} />
      <div className="space-y-3">
        {items.map((i) => (
          <Card key={i.id} className="flex items-center justify-between">
            <div><div className="flex items-center gap-2"><span className="font-semibold text-white">{i.title}</span><StatusBadge status={i.status} /></div>
              <div className="mt-1 text-xs text-slate-500 capitalize">severity {i.severity} · {i.assignee}</div></div>
            {i.status === "open" && <button onClick={() => close(i)} className="tap rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800">Close</button>}
          </Card>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Open incident">
        <div className="space-y-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What happened?" className="tap w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-white" />
          <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="tap w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-white">
            {["low", "medium", "high"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} placeholder="Assign to" className="tap w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-white" />
          <button onClick={add} className="tap w-full rounded-lg py-2.5 font-semibold text-white" style={{ background: ACCENT }}>Open incident</button>
        </div>
      </Modal>
    </>
  );
}
