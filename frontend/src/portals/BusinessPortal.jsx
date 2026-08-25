import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { http, inr, apiError, downloadCSV } from "@/lib/api";
import { LoginScreen, KPI, SlotGrid, Legend, StatusBadge, Modal, AdRotator } from "@/components/shared";
import { CreativePreview } from "@/portals/OpsPortal";
import { Shell, PageHead, Card } from "@/components/Shell";
import { toast } from "sonner";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  LayoutDashboard, Film, Upload as UploadIcon, ShoppingCart, BarChart3, Receipt,
  UserCog, LifeBuoy, Loader2, PlayCircle, Trash2, Minus, Plus, CheckCircle2, Radio, Download,
} from "lucide-react";

const ACCENT = "#D97706";
const NAV = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "creatives", label: "Creatives", icon: Film },
  { key: "upload", label: "Upload ad", icon: UploadIcon },
  { key: "book", label: "Book slots", icon: ShoppingCart },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "billing", label: "Billing", icon: Receipt },
  { key: "account", label: "Account", icon: UserCog },
  { key: "support", label: "Support", icon: LifeBuoy },
];

// light-theme helpers
const inputCls = "tap w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 placeholder:text-stone-400 outline-none focus:border-amber-500";
const H3 = ({ children }) => <h3 className="mb-3 font-display font-bold text-stone-900">{children}</h3>;
const Row = ({ l, v, bold }) => <div className="flex justify-between py-1 text-sm"><span className="text-stone-500">{l}</span><span className={`font-mono ${bold ? "font-bold text-stone-900" : "text-stone-700"}`}>{v}</span></div>;

export default function BusinessPortal() {
  const { user } = useAuth();
  const [screen, setScreen] = useState("overview");
  if (user === null) return <FullLoader />;
  if (!user || user.portal !== "business")
    return <LoginScreen portal="business" demoCreds={[
      { id: "owner@pizzapalace.com", pw: "demo1234", label: "Pizza Palace · 15 cabs" },
      { id: "ops@kaveri.in", pw: "demo1234", label: "Kaveri · 25 cabs" },
    ]} />;
  return (
    <Shell accent={ACCENT} portalName="Advertiser Portal" nav={NAV} active={screen} onNav={setScreen} theme="light">
      {screen === "overview" && <Overview />}
      {screen === "creatives" && <Creatives go={setScreen} />}
      {screen === "upload" && <UploadAd go={setScreen} />}
      {screen === "book" && <BookSlots />}
      {screen === "reports" && <Reports />}
      {screen === "billing" && <Billing />}
      {screen === "account" && <Account />}
      {screen === "support" && <Support />}
    </Shell>
  );
}

const FullLoader = () => <div className="flex min-h-screen items-center justify-center bg-[#F7F3EC]"><Loader2 className="animate-spin text-stone-400" /></div>;
function useFetch(url, dep = []) {
  const [data, setData] = useState(null);
  const reload = useCallback(() => { http.get(url).then((r) => setData(r.data)).catch(() => {}); }, [url]);
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, dep);
  return [data, reload, setData];
}

// ---------------- Overview ----------------
function Overview() {
  const [o] = useFetch("/business/overview");
  const [ads] = useFetch("/creatives/on-air");
  const [plays, setPlays] = useState(0);
  useEffect(() => {
    if (!o) return;
    setPlays(Math.floor(o.plays_today * 0.42));
    const perSec = o.plays_today / (12 * 3600);
    const t = setInterval(() => setPlays((p) => p + Math.max(1, Math.round(perSec * 2))), 2000);
    return () => clearInterval(t);
  }, [o]);
  if (!o) return <FullLoader />;
  return (
    <>
      <PageHead title="Campaign Overview" sub={`${o.cabs} cabs on the road across Pune`} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2 text-sm text-stone-500"><span className="live-dot h-2.5 w-2.5 rounded-full bg-emerald-500" /> {o.on_air ? "On air now" : "Nothing on air"}</div>
          <div className="mt-1 font-display text-xl font-bold text-stone-900">{o.on_air ? o.on_air.title : "Put an approved ad on air →"}</div>
          <div className="mt-6 text-xs uppercase tracking-wide text-stone-400">Live plays today</div>
          <div data-testid="business-overview-play-counter" className="font-display text-5xl font-extrabold tabular-nums" style={{ color: ACCENT }}>{plays.toLocaleString("en-IN")}</div>
          <div className="mt-1 text-xs text-stone-400">Projected {o.plays_today.toLocaleString("en-IN")} by end of day</div>
        </Card>
        <div className="grid grid-cols-2 gap-4">
          <KPI light label="Distance today" value={`${o.km_today.toLocaleString("en-IN")} km`} accent={ACCENT} />
          <KPI light label="Est. reach" value={o.reach_estimate.toLocaleString("en-IN")} accent={ACCENT} />
          <KPI light label="Approved ads" value={o.approved} accent={ACCENT} />
          <KPI light label="Uptime" value={`${o.uptime}%`} accent={ACCENT} />
        </div>
      </div>
      <Card className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <H3>What's on the cab screen now</H3>
          <span className="text-xs text-stone-400">Your ad shares a 4-brand rotation · 15s each</span>
        </div>
        <AdRotator ads={ads || []} light />
      </Card>
    </>
  );
}

// ---------------- Creatives ----------------
function Creatives({ go }) {
  const [creatives, reload] = useFetch("/creatives");
  const [preview, setPreview] = useState(null);
  const [delFor, setDelFor] = useState(null);
  if (!creatives) return <FullLoader />;
  const onAir = async (c) => { try { await http.patch(`/creatives/${c.id}/on-air`); toast.success("On air!"); reload(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };
  const del = async () => { try { await http.delete(`/creatives/${delFor.id}`); toast.success("Deleted"); setDelFor(null); reload(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); setDelFor(null); } };
  return (
    <>
      <PageHead title="Creatives" sub="Your ad library"
        action={<button data-testid="business-creatives-upload-btn" onClick={() => go("upload")} className="tap flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: ACCENT }}><Plus size={16} /> Upload ad</button>} />
      {creatives.length === 0 && <Card><div className="py-8 text-center text-stone-400">No creatives yet. Upload your first ad.</div></Card>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {creatives.map((c) => (
          <Card key={c.id}>
            <div className="relative mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-900">
              <button onClick={() => setPreview(c)} className="flex flex-col items-center gap-1.5 text-stone-300 hover:text-white"><PlayCircle size={36} /><span className="text-xs">{c.duration}s</span></button>
              {c.on_air && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white"><Radio size={10} /> ON AIR</span>}
            </div>
            <div className="flex items-start justify-between gap-2"><div className="font-semibold text-stone-900">{c.title}</div><StatusBadge status={c.status} /></div>
            {c.status === "rejected" && c.reject_reason && <div className="mt-2 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-600">Reason: {c.reject_reason}</div>}
            <div className="mt-3 flex gap-2">
              {c.status === "approved" && !c.on_air && <button onClick={() => onAir(c)} className="tap flex-1 rounded-md py-2 text-xs font-semibold text-white" style={{ background: ACCENT }}>Put on air</button>}
              <button onClick={() => setPreview(c)} className="tap flex-1 rounded-md border border-stone-300 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100">Preview</button>
              <button onClick={() => setDelFor(c)} className="tap rounded-md border border-stone-300 px-2.5 text-stone-400 hover:text-rose-500"><Trash2 size={14} /></button>
            </div>
          </Card>
        ))}
      </div>
      <CreativePreview creative={preview} onClose={() => setPreview(null)} />
      <Modal open={!!delFor} onClose={() => setDelFor(null)} title="Delete creative?">
        <p className="text-sm text-slate-400">This can't be undone. Creatives currently on air can't be deleted.</p>
        <div className="mt-4 flex gap-2"><button onClick={() => setDelFor(null)} className="tap flex-1 rounded-lg border border-slate-700 py-2.5 text-sm font-medium text-slate-300">Cancel</button><button onClick={del} className="tap flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white">Delete</button></div>
      </Modal>
    </>
  );
}

// ---------------- Upload ----------------
function UploadAd({ go }) {
  const [title, setTitle] = useState("");
  const [expiry, setExpiry] = useState("");
  const [video, setVideo] = useState(null);
  const [duration, setDuration] = useState(0);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => setDuration(Math.round(v.duration * 10) / 10);
    v.src = url;
    const reader = new FileReader();
    reader.onload = () => setVideo(reader.result);
    reader.readAsDataURL(f);
  };
  const submit = async () => {
    if (!title.trim() || !video) return toast.error("Add a title and pick a video");
    setBusy(true);
    try { await http.post("/creatives", { title, duration, video, expiry }); toast.success("Submitted for review (2h SLA)"); go("creatives"); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHead title="Upload a new ad" sub="MP4 recommended · 15s plays in a 4-brand rotation" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <label className="mb-1 block text-xs text-stone-500">Ad title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls + " mb-4"} placeholder="Weekend Combo Offer" />
          <label className="mb-1 block text-xs text-stone-500">Video file</label>
          <input ref={fileRef} type="file" accept="video/*" onChange={onFile} className="hidden" />
          <button onClick={() => fileRef.current.click()} className="tap mb-1 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-stone-400 py-8 text-stone-500 hover:border-amber-500">
            <UploadIcon size={18} /> {video ? "Change video" : "Pick a video file"}
          </button>
          {duration > 0 && <div className="mb-4 text-xs text-emerald-600">Duration read: {duration}s</div>}
          <label className="mb-1 mt-3 block text-xs text-stone-500">Expiry date</label>
          <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={inputCls + " mb-4"} />
          <button onClick={submit} disabled={busy} className="tap flex w-full items-center justify-center gap-2 rounded-lg py-3 font-semibold text-white disabled:opacity-60" style={{ background: ACCENT }}>{busy && <Loader2 size={16} className="animate-spin" />} Submit for review</button>
        </Card>
        <div className="space-y-4">
          <Card>
            <H3>Live preview</H3>
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border-4 border-stone-800 bg-black">
              {video ? <video src={video} controls className="h-full w-full object-contain" /> : <div className="text-sm text-stone-500">Preview appears here</div>}
            </div>
          </Card>
          <Card>
            <H3>Content policy</H3>
            <ul className="space-y-1.5 text-sm text-stone-600">
              <li>• No adult, alcohol, tobacco or political content</li>
              <li>• Clear, legible, 16:9, min 720p</li>
              <li>• Reviewed within 2 working hours</li>
              <li>• Must include your brand / contact</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

// ---------------- Book slots ----------------
function BookSlots() {
  const { config } = useAuth();
  const MIN = config?.rules?.MIN_CABS || 15;
  const [cabs, reloadCabs] = useFetch("/cabs");
  const [avail, reloadAvail] = useFetch("/slots/availability");
  const [count, setCount] = useState(MIN);
  const [preview, setPreview] = useState(null);
  const [checkout, setCheckout] = useState(false);
  const [success, setSuccess] = useState(null);
  useEffect(() => { setCount(MIN); }, [MIN]);
  useEffect(() => {
    if (count < MIN) return;
    http.get(`/bookings/preview?cab_count=${count}`).then((r) => setPreview(r.data)).catch(() => {});
  }, [count, MIN]);
  if (!cabs || !avail) return <FullLoader />;
  const presets = [15, 25, 50, 100];
  const pay = async () => {
    try {
      const { data } = await http.post("/bookings", { cab_count: count });
      setCheckout(false); setSuccess(data); reloadCabs(); reloadAvail();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  return (
    <>
      <PageHead title="Book cab slots" sub={`${config?.brand?.city || "Pune"} fleet · ₹${(config?.rules?.PRICE_PER_CAB || 4300).toLocaleString("en-IN")}/cab/month · min ${MIN}`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <KPI light label={`Total fleet in ${config?.brand?.city || "Pune"}`} value={`${avail.total} cabs`} accent={ACCENT} />
        <KPI light label="Slots currently taken" value={avail.booked} accent={ACCENT} />
        <KPI light label="Available now" value={avail.available} sub="bookable immediately" accent={ACCENT} />
      </div>
      <Card className="mt-6">
        <div className="mb-3 flex items-center justify-between"><H3>Live availability</H3><Legend /></div>
        <SlotGrid cabs={cabs} />
        <p className="mt-3 text-xs text-stone-400">Green cells are free and auto-picked when you book. Amber cells are taken by other advertisers.</p>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <H3>How many cabs?</H3>
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => setCount((c) => Math.max(MIN, c - 1))} className="tap flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 text-stone-700"><Minus size={18} /></button>
            <input data-testid="business-booking-cab-stepper" type="number" value={count} min={MIN}
              onChange={(e) => setCount(Math.max(MIN, Number(e.target.value) || MIN))}
              className="w-24 rounded-lg border border-stone-300 bg-white py-3 text-center font-display text-2xl font-bold text-stone-900" />
            <button onClick={() => setCount((c) => c + 1)} className="tap flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 text-stone-700"><Plus size={18} /></button>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {presets.map((p) => <button key={p} onClick={() => setCount(p)} className={`tap rounded-full border px-4 py-1.5 text-sm ${count === p ? "text-white" : "border-stone-300 text-stone-600"}`} style={count === p ? { background: ACCENT, borderColor: ACCENT } : {}}>{p}</button>)}
          </div>
          {preview?.waitlist > 0 && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Only <b>{preview.bookable}</b> cabs free right now. We'll waitlist <b>{preview.waitlist}</b> more and add them as they free up — no charge until they're live.
            </div>
          )}
        </Card>
        <Card>
          <H3>Price breakdown</H3>
          {preview && (
            <>
              <Row l={`${preview.bookable} cabs × ₹${(config?.rules?.PRICE_PER_CAB || 4300).toLocaleString("en-IN")}`} v={inr(preview.base)} />
              <Row l="CGST (9%)" v={inr(preview.cgst)} />
              <Row l="SGST (9%)" v={inr(preview.sgst)} />
              <div className="mt-2 border-t border-stone-200 pt-2"><Row l="Total payable" v={inr(preview.total)} bold /></div>
              <button data-testid="business-booking-proceed-payment" onClick={() => setCheckout(true)} disabled={preview.bookable === 0}
                className="tap mt-5 w-full rounded-lg py-3 font-semibold text-white disabled:opacity-50" style={{ background: ACCENT }}>
                Proceed to payment · {inr(preview.total)}
              </button>
            </>
          )}
        </Card>
      </div>
      <Modal open={checkout} onClose={() => setCheckout(false)} wide title="Checkout" testid="checkout-modal">
        {preview && <Checkout preview={preview} onPay={pay} config={config} />}
      </Modal>
      <Modal open={!!success} onClose={() => setSuccess(null)} testid="business-payment-success-modal">
        {success && (
          <div className="text-center">
            <CheckCircle2 size={56} className="mx-auto text-emerald-400" />
            <h3 className="mt-3 font-display text-xl font-bold text-white">Payment successful</h3>
            <p className="mt-1 text-sm text-slate-400">{success.booked} cabs booked{success.waitlist ? ` · ${success.waitlist} waitlisted` : ""}. Invoice {success.invoice.number} generated.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => printInvoice(success.invoice, config)} data-testid="business-download-gst-invoice" className="tap flex-1 rounded-lg border border-slate-700 py-2.5 text-sm font-medium text-slate-200">Print GST invoice</button>
              <button onClick={() => setSuccess(null)} className="tap flex-1 rounded-lg py-2.5 text-sm font-semibold text-white" style={{ background: ACCENT }}>Done</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function Checkout({ preview, onPay, config }) {
  const [method, setMethod] = useState("upi");
  const [timer, setTimer] = useState(300);
  useEffect(() => { const t = setInterval(() => setTimer((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(t); }, []);
  const DRow = ({ l, v, bold }) => <div className="flex justify-between py-1 text-sm"><span className="text-slate-400">{l}</span><span className={`font-mono ${bold ? "font-bold text-white" : "text-slate-200"}`}>{v}</span></div>;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <div className="mb-3 flex aspect-video items-center justify-center rounded-lg border-4 border-slate-700 bg-gradient-to-br from-slate-800 to-slate-950 text-3xl">🚕</div>
        <DRow l={`${preview.bookable} cabs`} v={inr(preview.base)} />
        <DRow l="CGST (9%)" v={inr(preview.cgst)} />
        <DRow l="SGST (9%)" v={inr(preview.sgst)} />
        <div className="mt-2 border-t border-slate-800 pt-2"><DRow l="Total" v={inr(preview.total)} bold /></div>
      </div>
      <div>
        <div className="mb-3 flex gap-2">
          {["upi", "card", "netbanking"].map((m) => <button key={m} onClick={() => setMethod(m)} className={`tap flex-1 rounded-lg border py-2 text-xs font-medium capitalize ${method === m ? "text-white" : "border-slate-700 text-slate-400"}`} style={method === m ? { background: ACCENT, borderColor: ACCENT } : {}}>{m}</button>)}
        </div>
        {method === "upi" && (
          <div className="rounded-lg border border-slate-800 p-4 text-center">
            <div data-testid="business-payment-upi-qr" className="mx-auto grid h-36 w-36 grid-cols-8 gap-0.5 rounded bg-white p-2">
              {Array.from({ length: 64 }).map((_, i) => <span key={i} style={{ background: Math.random() > 0.5 ? "#000" : "#fff" }} />)}
            </div>
            <div className="mt-2 font-mono text-xs text-slate-400">sawari@okhdfc</div>
            <div className="mt-1 text-xs text-slate-500">Expires in {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}</div>
          </div>
        )}
        {method === "card" && (
          <div className="space-y-2">
            <input placeholder="Card number" className="tap w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-white" />
            <div className="flex gap-2"><input placeholder="MM/YY" className="tap w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-white" /><input placeholder="CVV" className="tap w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-white" /></div>
          </div>
        )}
        {method === "netbanking" && <select className="tap w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-white"><option>HDFC Bank</option><option>ICICI Bank</option><option>SBI</option></select>}
        <button onClick={onPay} className="tap mt-4 w-full rounded-lg py-3 font-semibold text-white" style={{ background: ACCENT }}>Pay {inr(preview.total)} (demo)</button>
        <p className="mt-2 text-center text-[11px] text-slate-600">Mock payment — no real charge</p>
      </div>
    </div>
  );
}

// ---------------- Reports ----------------
function Reports() {
  const [r] = useFetch("/reports/plays");
  if (!r) return <FullLoader />;
  const exportCSV = () => {
    const rows = [["Plate", "Plays", "KM", "Uptime %"], ...r.per_cab.map((c) => [c.plate, c.plays, c.km, c.uptime])];
    downloadCSV("sawari-report.csv", rows); toast.success("CSV downloaded");
  };
  return (
    <>
      <PageHead title="Reports" sub={`Fleet uptime ${r.uptime}%`}
        action={<button onClick={exportCSV} className="tap flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700"><Download size={16} /> Export CSV</button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <H3>Plays per day</H3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={r.daily}><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT} stopOpacity={0.6} /><stop offset="100%" stopColor={ACCENT} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="#e7e1d8" vertical={false} /><XAxis dataKey="date" tick={{ fill: "#a8a29e", fontSize: 10 }} tickFormatter={(d) => d.slice(5)} /><YAxis tick={{ fill: "#a8a29e", fontSize: 10 }} /><Tooltip contentStyle={{ background: "#fff", border: "1px solid #e7e1d8", borderRadius: 8 }} />
              <Area type="monotone" dataKey="plays" stroke={ACCENT} fill="url(#g)" strokeWidth={2} /></AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <H3>Plays by hour</H3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={r.hourly}><CartesianGrid stroke="#e7e1d8" vertical={false} /><XAxis dataKey="hour" tick={{ fill: "#a8a29e", fontSize: 10 }} /><YAxis tick={{ fill: "#a8a29e", fontSize: 10 }} /><Tooltip contentStyle={{ background: "#fff", border: "1px solid #e7e1d8", borderRadius: 8 }} /><Bar dataKey="plays" fill={ACCENT} radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-sm"><thead><tr className="border-b border-stone-200 text-left text-xs uppercase text-stone-400">{["Cab", "Plays", "KM", "Uptime"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>{r.per_cab.map((c) => <tr key={c.plate} className="border-b border-stone-100"><td className="p-3 font-mono text-stone-700">{c.plate}</td><td className="p-3 text-stone-900">{c.plays}</td><td className="p-3 text-stone-500">{c.km}</td><td className="p-3 text-stone-500">{c.uptime}%</td></tr>)}</tbody>
        </table>
      </Card>
    </>
  );
}

// ---------------- Billing ----------------
function Billing() {
  const { config } = useAuth();
  const [invoices] = useFetch("/invoices");
  const [notes] = useFetch("/credit-notes");
  const [adv] = useFetch("/advertisers/me");
  if (!invoices || !notes || !adv) return <FullLoader />;
  return (
    <>
      <PageHead title="Billing" sub={`Current plan · ${adv.cabs_booked} cabs · ${inr(adv.spend)}/mo`} />
      <H3>Invoices</H3>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm"><thead><tr className="border-b border-stone-200 text-left text-xs uppercase text-stone-400">{["Invoice", "Cabs", "Amount", "Status", ""].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>{invoices.map((i) => <tr key={i.id} className="border-b border-stone-100"><td className="p-3 font-mono text-stone-700">{i.number}</td><td className="p-3 text-stone-900">{i.cabs}</td><td className="p-3 font-mono text-stone-900">{inr(i.total)}</td><td className="p-3"><StatusBadge status={i.status} /></td><td className="p-3"><button onClick={() => printInvoice(i, config)} className="text-xs font-medium" style={{ color: ACCENT }}>Print GST invoice</button></td></tr>)}</tbody>
        </table>
      </Card>
      <div className="mt-6"><H3>Credit notes (SLA breaches)</H3></div>
      {notes.length === 0 ? <Card><div className="py-6 text-center text-sm text-stone-400">No credit notes.</div></Card> : (
        <div className="space-y-3">{notes.map((n) => <Card key={n.id} className="flex items-center justify-between"><div><div className="font-mono text-sm text-stone-900">{n.number}</div><div className="text-xs text-stone-500">{n.reason}</div></div><div className="font-mono font-bold text-emerald-600">+{inr(n.total)}</div></Card>)}</div>
      )}
    </>
  );
}

// ---------------- Account ----------------
function Account() {
  const [adv] = useFetch("/advertisers/me");
  const { user } = useAuth();
  if (!adv) return <FullLoader />;
  return (
    <>
      <PageHead title="Account" sub="Business details & preferences" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <H3>Business</H3>
          <Row l="Name" v={adv.name} /><Row l="Email" v={adv.email} /><Row l="Category" v={adv.category} /><Row l="GSTIN" v={adv.gstin || "—"} /><Row l="Renewal" v={adv.renewal_date} />
        </Card>
        <Card>
          <H3>Notifications & team</H3>
          <Row l="Email alerts" v={adv.notify_email ? "On" : "Off"} /><Row l="SMS alerts" v={adv.notify_sms ? "On" : "Off"} />
          <div className="mt-3 border-t border-stone-200 pt-3"><Row l="Signed in as" v={user?.email} /></div>
        </Card>
      </div>
    </>
  );
}

// ---------------- Support ----------------
function Support() {
  const { config } = useAuth();
  const b = config?.brand || {};
  const faqs = [
    ["What is the minimum booking?", `${config?.rules?.MIN_CABS || 15} cabs per month.`],
    ["How does the ad rotation work?", "Each cab screen shows 4 brands' ads — 15 seconds each, cycling every minute."],
    ["When does my ad go live?", "After admin approval (within 2 working hours), tap 'Put on air'."],
    ["What if a cab has low uptime?", "Below 90% uptime, we auto-raise a credit note on your next invoice."],
  ];
  return (
    <>
      <PageHead title="Support" sub="We're here to help" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <H3>Contact</H3>
          <Row l="Email" v={b.support_email} /><Row l="Phone" v={b.phone} /><Row l="WhatsApp" v={b.whatsapp} />
        </Card>
        <Card>
          <H3>FAQ</H3>
          <div className="space-y-3">{faqs.map(([q, a], i) => <div key={i}><div className="text-sm font-semibold text-stone-900">{q}</div><div className="text-sm text-stone-500">{a}</div></div>)}</div>
        </Card>
      </div>
    </>
  );
}

function printInvoice(inv, config) {
  const b = config?.brand || {}; const r = config?.rules || {};
  const a = inv.advertiser || {};
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>${inv.number}</title><style>
    body{font-family:Inter,Arial,sans-serif;padding:40px;color:#111}
    h1{margin:0;font-size:22px} .muted{color:#666;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:24px}
    td,th{border-bottom:1px solid #ddd;padding:10px;text-align:left;font-size:13px}
    .right{text-align:right} .total{font-weight:700;font-size:16px}
    .box{display:flex;justify-content:space-between;margin-top:16px}
  </style></head><body>
    <div class="box"><div><h1>${b.logo || "🚕"} ${b.name || "Sawari"}</h1><div class="muted">${b.legal_name || ""}<br/>${b.city || ""} · GSTIN ${r.GSTIN || ""}</div></div>
    <div class="right"><h1>TAX INVOICE</h1><div class="muted">${inv.number}<br/>${new Date(inv.date).toLocaleDateString("en-IN")}</div></div></div>
    <div style="margin-top:20px" class="muted"><b>Bill to:</b><br/>${a.name || ""}<br/>GSTIN: ${a.gstin || "—"}<br/>${a.email || ""}</div>
    <table><tr><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr>
    <tr><td>Cab headrest ad slots (monthly)</td><td class="right">${inv.cabs}</td><td class="right">₹${(r.PRICE_PER_CAB||4300).toLocaleString("en-IN")}</td><td class="right">₹${inv.base.toLocaleString("en-IN")}</td></tr>
    <tr><td>CGST @ 9%</td><td></td><td></td><td class="right">₹${inv.cgst.toLocaleString("en-IN")}</td></tr>
    <tr><td>SGST @ 9%</td><td></td><td></td><td class="right">₹${inv.sgst.toLocaleString("en-IN")}</td></tr>
    <tr><td class="total">Total payable</td><td></td><td></td><td class="right total">₹${inv.total.toLocaleString("en-IN")}</td></tr>
    </table>
    <p class="muted" style="margin-top:30px">This is a computer-generated invoice. ${b.support_email || ""}</p>
    <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}
