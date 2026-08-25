from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import logging
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import random

# ------------------------------------------------------------------
# DB
# ------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"

app = FastAPI()
api = APIRouter(prefix="/api")

# ------------------------------------------------------------------
# CONFIG  (single source of truth — edit here to re-price everything)
# ------------------------------------------------------------------
BRAND = {
    "name": "Sawari",
    "legal_name": "Sawari Media Networks Pvt Ltd",
    "logo": "🚕",
    "domain": "sawari.in",
    "support_email": "hello@sawari.in",
    "phone": "+91 80555 12345",
    "whatsapp": "+91 80555 12345",
    "city": "Pune",
    "demo_mode": True,
}

RULES = {
    "PRICE_PER_CAB": 4300,
    "HOURS_PER_DAY": 12,
    "PLAYS_PER_CAB_DAY": 720,
    "KM_PER_CAB_DAY": 132,
    "MIN_CABS": 15,
    "MAX_CABS": 200,
    "HARDWARE_COST": 350,
    "SIM_COST": 200,
    "GST": 18,
    "UPTIME_SLA": 90,
    "REVIEW_SLA_HOURS": 2,
    "PAYOUT_DAYS": [1, 16],
    "DRIVER_PHOTO_DAYS": 15,
    "DRIVER_PAY_PER_CAB_MONTH": 500,
    "DRIVER_DAILY": 60,
    "AD_SECONDS": 15,
    "ADS_PER_MINUTE": 4,
    "CYCLE_SECONDS": 60,
    "GSTIN": "27AABCS1234K1Z5",
    "STATE": "Maharashtra",
}

ZONES = ["Koregaon Park", "Baner", "Viman Nagar", "Hinjewadi", "Swargate", "Kothrud"]

# ------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str, portal: str) -> str:
    payload = {"sub": user_id, "portal": portal,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def clean(doc):
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    clean(user)
    user.pop("password_hash", None)
    return user

def require(portal: str):
    async def dep(user: dict = Depends(get_current_user)):
        if user["portal"] != portal:
            raise HTTPException(status_code=403, detail="Wrong portal for this account")
        return user
    return dep

async def log_activity(actor: str, action: str, portal: str = "ops"):
    await db.activity.insert_one({
        "id": str(uuid.uuid4()), "actor": actor, "action": action,
        "portal": portal, "ts": now_iso()
    })

# ------------------------------------------------------------------
# Auth models
# ------------------------------------------------------------------
class LoginIn(BaseModel):
    identifier: str
    password: str
    portal: str

@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    ident = body.identifier.strip().lower()
    user = await db.users.find_one({"$or": [{"email": ident}, {"phone": body.identifier.strip()}]})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user["portal"] != body.portal:
        raise HTTPException(status_code=403,
                            detail=f"These credentials belong to the {user['portal']} portal, not {body.portal}.")
    token = create_token(user["id"], user["portal"])
    response.set_cookie("access_token", token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")
    clean(user); user.pop("password_hash", None)
    return {"token": token, "user": user}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

# ------------------------------------------------------------------
# Config
# ------------------------------------------------------------------
@api.get("/config")
async def get_config():
    fleet = await db.fleet.find_one({"id": "fleet"})
    clean(fleet)
    return {"brand": BRAND, "rules": RULES, "fleet": fleet or {}}

class FleetIn(BaseModel):
    total_cabs: Optional[int] = None
    max_cabs: Optional[int] = None

@api.put("/config/fleet")
async def update_fleet(body: FleetIn, user: dict = Depends(require("ops"))):
    upd = {}
    if body.max_cabs is not None:
        upd["max_cabs"] = body.max_cabs
        RULES["MAX_CABS"] = body.max_cabs
    if body.total_cabs is not None:
        upd["total_cabs"] = body.total_cabs
    if upd:
        await db.fleet.update_one({"id": "fleet"}, {"$set": upd}, upsert=True)
        await log_activity(user["name"], f"updated fleet config {upd}")
    fleet = await db.fleet.find_one({"id": "fleet"}); clean(fleet)
    return fleet

# ------------------------------------------------------------------
# Cabs / slots
# ------------------------------------------------------------------
async def advertiser_name(aid):
    if not aid:
        return None
    a = await db.advertisers.find_one({"id": aid})
    return a["name"] if a else None

@api.get("/cabs")
async def list_cabs(request: Request, user: dict = Depends(get_current_user)):
    cabs = await db.cabs.find().sort("plate", 1).to_list(1000)
    out = []
    adv_map = {a["id"]: a["name"] for a in await db.advertisers.find().to_list(1000)}
    for c in cabs:
        clean(c)
        c["advertiser_name"] = adv_map.get(c.get("advertiser_id"))
        # mask advertiser name for business portal
        if user["portal"] == "business":
            own = c.get("advertiser_id") == user.get("advertiser_id")
            c["mine"] = own
            if not own:
                c["advertiser_name"] = None
        out.append(c)
    return out

@api.get("/slots/availability")
async def availability(user: dict = Depends(get_current_user)):
    cabs = await db.cabs.find().to_list(1000)
    total = len(cabs)
    available = sum(1 for c in cabs if c["status"] == "available")
    booked = sum(1 for c in cabs if c["status"] == "booked")
    offline = sum(1 for c in cabs if c["status"] == "offline")
    faulty = sum(1 for c in cabs if c["status"] == "faulty")
    return {"total": total, "available": available, "booked": booked,
            "offline": offline, "faulty": faulty,
            "revenue_potential": available * RULES["PRICE_PER_CAB"],
            "mrr_if_full": booked * RULES["PRICE_PER_CAB"]}

class CabIn(BaseModel):
    plate: str
    zone: Optional[str] = "Baner"
    status: Optional[str] = "available"

@api.post("/cabs")
async def add_cab(body: CabIn, user: dict = Depends(require("ops"))):
    cab = {"id": str(uuid.uuid4()), "plate": body.plate.upper(), "zone": body.zone,
           "status": body.status, "advertiser_id": None,
           "battery": 100, "signal": 4, "last_checkin": now_iso()}
    await db.cabs.insert_one(dict(cab))
    await log_activity(user["name"], f"added cab {cab['plate']}")
    clean(cab)
    return cab

class CabStatusIn(BaseModel):
    status: str

@api.patch("/cabs/{cab_id}")
async def set_cab_status(cab_id: str, body: CabStatusIn, user: dict = Depends(require("ops"))):
    cab = await db.cabs.find_one({"id": cab_id})
    if not cab:
        raise HTTPException(404, "Cab not found")
    upd = {"status": body.status}
    if body.status != "booked":
        upd["advertiser_id"] = None
    await db.cabs.update_one({"id": cab_id}, {"$set": upd})
    await log_activity(user["name"], f"set {cab['plate']} to {body.status}")
    return {"ok": True}

class AssignIn(BaseModel):
    advertiser_id: str

@api.post("/cabs/{cab_id}/assign")
async def assign_cab(cab_id: str, body: AssignIn, user: dict = Depends(require("ops"))):
    cab = await db.cabs.find_one({"id": cab_id})
    if not cab:
        raise HTTPException(404, "Cab not found")
    if cab["status"] != "available":
        raise HTTPException(400, "Cab is not available")
    await db.cabs.update_one({"id": cab_id}, {"$set": {"status": "booked", "advertiser_id": body.advertiser_id}})
    name = await advertiser_name(body.advertiser_id)
    await log_activity(user["name"], f"assigned {cab['plate']} to {name}")
    return {"ok": True}

@api.post("/cabs/{cab_id}/unassign")
async def unassign_cab(cab_id: str, user: dict = Depends(require("ops"))):
    cab = await db.cabs.find_one({"id": cab_id})
    if not cab:
        raise HTTPException(404, "Cab not found")
    await db.cabs.update_one({"id": cab_id}, {"$set": {"status": "available", "advertiser_id": None}})
    await log_activity(user["name"], f"unassigned {cab['plate']}")
    return {"ok": True}

# ------------------------------------------------------------------
# Advertisers
# ------------------------------------------------------------------
async def advertiser_stats(a):
    cabs = await db.cabs.count_documents({"advertiser_id": a["id"], "status": "booked"})
    a["cabs_booked"] = cabs
    a["spend"] = cabs * RULES["PRICE_PER_CAB"]
    return a

@api.get("/advertisers")
async def list_advertisers(user: dict = Depends(require("ops"))):
    out = []
    for a in await db.advertisers.find().to_list(1000):
        clean(a); await advertiser_stats(a)
        out.append(a)
    return out

@api.get("/advertisers/me")
async def my_advertiser(user: dict = Depends(require("business"))):
    a = await db.advertisers.find_one({"id": user["advertiser_id"]})
    if not a:
        raise HTTPException(404, "Advertiser not found")
    clean(a); await advertiser_stats(a)
    return a

class AdvertiserIn(BaseModel):
    name: str
    email: str
    gstin: Optional[str] = ""
    category: Optional[str] = "Retail"

@api.post("/advertisers")
async def add_advertiser(body: AdvertiserIn, user: dict = Depends(require("ops"))):
    aid = str(uuid.uuid4())
    adv = {"id": aid, "name": body.name, "email": body.email.lower(),
           "gstin": body.gstin, "category": body.category,
           "renewal_date": (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat(),
           "created_at": now_iso(), "notify_email": True, "notify_sms": False}
    await db.advertisers.insert_one(dict(adv))
    # create login
    await db.users.insert_one({"id": str(uuid.uuid4()), "email": body.email.lower(),
                               "password_hash": hash_password("demo1234"),
                               "name": body.name, "portal": "business",
                               "advertiser_id": aid, "created_at": now_iso()})
    await log_activity(user["name"], f"added advertiser {body.name}")
    clean(adv)
    return adv

# ------------------------------------------------------------------
# Drivers
# ------------------------------------------------------------------
def compliance_status(driver):
    last = driver.get("last_photo_date")
    if driver.get("pending_photo"):
        return "submitted"
    if not last:
        return "overdue"
    days = (datetime.now(timezone.utc) - datetime.fromisoformat(last)).days
    due_in = RULES["DRIVER_PHOTO_DAYS"] - days
    if due_in < 0:
        return "overdue"
    return "verified" if driver.get("photo_verified") else "not_due"

@api.get("/drivers")
async def list_drivers(user: dict = Depends(require("ops"))):
    out = []
    cab_map = {c["id"]: c for c in await db.cabs.find().to_list(1000)}
    for d in await db.drivers.find().to_list(1000):
        clean(d)
        d["compliance"] = compliance_status(d)
        c = cab_map.get(d.get("cab_id"))
        d["plate"] = c["plate"] if c else "-"
        out.append(d)
    return out

@api.get("/drivers/me")
async def my_driver(user: dict = Depends(require("partner"))):
    d = await db.drivers.find_one({"id": user["driver_id"]})
    if not d:
        raise HTTPException(404, "Driver not found")
    clean(d)
    d["compliance"] = compliance_status(d)
    c = await db.cabs.find_one({"id": d.get("cab_id")})
    d["plate"] = c["plate"] if c else "-"
    d["cab"] = clean(c) if c else None
    last = d.get("last_photo_date")
    days_since = (datetime.now(timezone.utc) - datetime.fromisoformat(last)).days if last else 999
    d["photo_due_in"] = RULES["DRIVER_PHOTO_DAYS"] - days_since
    return d

class DutyIn(BaseModel):
    on_duty: bool

@api.post("/drivers/me/duty")
async def set_duty(body: DutyIn, user: dict = Depends(require("partner"))):
    await db.drivers.update_one({"id": user["driver_id"]}, {"$set": {"on_duty": body.on_duty}})
    return {"ok": True}

class PhotoIn(BaseModel):
    image: str

@api.post("/drivers/me/compliance-photo")
async def submit_photo(body: PhotoIn, user: dict = Depends(require("partner"))):
    pid = str(uuid.uuid4())
    await db.compliance_photos.insert_one({
        "id": pid, "driver_id": user["driver_id"], "image": body.image,
        "status": "pending", "submitted_at": now_iso()})
    await db.drivers.update_one({"id": user["driver_id"]},
                                {"$set": {"pending_photo": True, "photo_verified": False}})
    d = await db.drivers.find_one({"id": user["driver_id"]})
    await log_activity(d["name"], "submitted compliance photo", "partner")
    return {"ok": True, "id": pid}

@api.get("/compliance-photos")
async def list_photos(user: dict = Depends(require("ops"))):
    out = []
    dmap = {d["id"]: d for d in await db.drivers.find().to_list(1000)}
    for p in await db.compliance_photos.find().sort("submitted_at", -1).to_list(200):
        clean(p)
        d = dmap.get(p["driver_id"])
        p["driver_name"] = d["name"] if d else "-"
        out.append(p)
    return out

@api.patch("/compliance-photos/{pid}/verify")
async def verify_photo(pid: str, user: dict = Depends(require("ops"))):
    p = await db.compliance_photos.find_one({"id": pid})
    if not p:
        raise HTTPException(404, "Not found")
    await db.compliance_photos.update_one({"id": pid}, {"$set": {"status": "verified"}})
    await db.drivers.update_one({"id": p["driver_id"]},
                                {"$set": {"pending_photo": False, "photo_verified": True,
                                          "last_photo_date": now_iso()}})
    await log_activity(user["name"], "verified compliance photo")
    return {"ok": True}

# ------------------------------------------------------------------
# Creatives
# ------------------------------------------------------------------
class CreativeIn(BaseModel):
    title: str
    duration: float
    video: str
    expiry: Optional[str] = None

@api.post("/creatives")
async def upload_creative(body: CreativeIn, user: dict = Depends(require("business"))):
    cid = str(uuid.uuid4())
    cr = {"id": cid, "advertiser_id": user["advertiser_id"], "title": body.title,
          "duration": body.duration, "video": body.video, "expiry": body.expiry,
          "status": "in_review", "reject_reason": None, "on_air": False,
          "created_at": now_iso()}
    await db.creatives.insert_one(dict(cr))
    a = await db.advertisers.find_one({"id": user["advertiser_id"]})
    await log_activity(a["name"], f"uploaded creative '{body.title}'", "business")
    clean(cr)
    return cr

@api.get("/creatives")
async def list_creatives(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if user["portal"] == "business":
        q["advertiser_id"] = user["advertiser_id"]
    if status:
        q["status"] = status
    out = []
    adv_map = {a["id"]: a["name"] for a in await db.advertisers.find().to_list(1000)}
    for c in await db.creatives.find(q).sort("created_at", -1).to_list(500):
        clean(c)
        c["advertiser_name"] = adv_map.get(c["advertiser_id"])
        out.append(c)
    return out

@api.get("/creatives/on-air")
async def on_air_creatives(user: dict = Depends(get_current_user)):
    adv_map = {a["id"]: a["name"] for a in await db.advertisers.find().to_list(1000)}
    out = []
    for c in await db.creatives.find({"on_air": True}).to_list(10):
        out.append({"id": c["id"], "title": c["title"],
                    "advertiser_name": adv_map.get(c["advertiser_id"]),
                    "duration": c.get("duration", 15)})
    return out[:4]

@api.patch("/creatives/{cid}/approve")
async def approve_creative(cid: str, user: dict = Depends(require("ops"))):
    c = await db.creatives.find_one({"id": cid})
    if not c:
        raise HTTPException(404, "Not found")
    await db.creatives.update_one({"id": cid}, {"$set": {"status": "approved", "reject_reason": None}})
    await log_activity(user["name"], f"approved creative '{c['title']}'")
    return {"ok": True}

class RejectIn(BaseModel):
    reason: str

@api.patch("/creatives/{cid}/reject")
async def reject_creative(cid: str, body: RejectIn, user: dict = Depends(require("ops"))):
    c = await db.creatives.find_one({"id": cid})
    if not c:
        raise HTTPException(404, "Not found")
    await db.creatives.update_one({"id": cid},
                                  {"$set": {"status": "rejected", "reject_reason": body.reason, "on_air": False}})
    await log_activity(user["name"], f"rejected creative '{c['title']}' — {body.reason}")
    return {"ok": True}

@api.patch("/creatives/{cid}/on-air")
async def put_on_air(cid: str, user: dict = Depends(require("business"))):
    c = await db.creatives.find_one({"id": cid, "advertiser_id": user["advertiser_id"]})
    if not c:
        raise HTTPException(404, "Not found")
    if c["status"] != "approved":
        raise HTTPException(400, "Only approved creatives can go on air")
    # take current on-air off
    await db.creatives.update_many({"advertiser_id": user["advertiser_id"], "on_air": True},
                                   {"$set": {"on_air": False}})
    await db.creatives.update_one({"id": cid}, {"$set": {"on_air": True}})
    a = await db.advertisers.find_one({"id": user["advertiser_id"]})
    await log_activity(a["name"], f"put '{c['title']}' on air", "business")
    return {"ok": True}

@api.delete("/creatives/{cid}")
async def delete_creative(cid: str, user: dict = Depends(require("business"))):
    c = await db.creatives.find_one({"id": cid, "advertiser_id": user["advertiser_id"]})
    if not c:
        raise HTTPException(404, "Not found")
    if c.get("on_air"):
        raise HTTPException(400, "Cannot delete a creative that is currently on air")
    await db.creatives.delete_one({"id": cid})
    return {"ok": True}

# ------------------------------------------------------------------
# Bookings + invoices
# ------------------------------------------------------------------
class BookingIn(BaseModel):
    cab_count: int

def gst_breakdown(base):
    gst = round(base * RULES["GST"] / 100)
    return {"base": base, "cgst": gst // 2, "sgst": gst - gst // 2, "gst": gst, "total": base + gst}

@api.get("/bookings/preview")
async def booking_preview(cab_count: int, user: dict = Depends(require("business"))):
    if cab_count < RULES["MIN_CABS"]:
        raise HTTPException(400, f"Minimum booking is {RULES['MIN_CABS']} cabs")
    available = await db.cabs.count_documents({"status": "available"})
    bookable = min(cab_count, available)
    waitlist = max(0, cab_count - available)
    base = bookable * RULES["PRICE_PER_CAB"]
    return {"requested": cab_count, "bookable": bookable, "waitlist": waitlist,
            "available_now": available, **gst_breakdown(base)}

@api.post("/bookings")
async def create_booking(body: BookingIn, user: dict = Depends(require("business"))):
    if body.cab_count < RULES["MIN_CABS"]:
        raise HTTPException(400, f"Minimum booking is {RULES['MIN_CABS']} cabs")
    cabs = await db.cabs.find({"status": "available"}).to_list(1000)
    take = cabs[:body.cab_count]
    waitlist = max(0, body.cab_count - len(take))
    for c in take:
        await db.cabs.update_one({"id": c["id"]},
                                 {"$set": {"status": "booked", "advertiser_id": user["advertiser_id"]}})
    base = len(take) * RULES["PRICE_PER_CAB"]
    gb = gst_breakdown(base)
    inv_no = f"INV-{datetime.now().strftime('%Y%m')}-{random.randint(1000,9999)}"
    inv = {"id": str(uuid.uuid4()), "number": inv_no, "advertiser_id": user["advertiser_id"],
           "cabs": len(take), "date": now_iso(), "status": "paid",
           "type": "invoice", **gb}
    await db.invoices.insert_one(dict(inv))
    bk = {"id": str(uuid.uuid4()), "advertiser_id": user["advertiser_id"],
          "cabs_booked": len(take), "waitlist": waitlist, "cab_ids": [c["id"] for c in take],
          "created_at": now_iso(), "invoice_id": inv["id"]}
    await db.bookings.insert_one(dict(bk))
    if waitlist:
        await db.waitlist.insert_one({"id": str(uuid.uuid4()), "advertiser_id": user["advertiser_id"],
                                      "count": waitlist, "created_at": now_iso()})
    a = await db.advertisers.find_one({"id": user["advertiser_id"]})
    await log_activity(a["name"], f"booked {len(take)} cabs (waitlist {waitlist})", "business")
    clean(inv)
    return {"booked": len(take), "waitlist": waitlist, "invoice": inv}

@api.get("/invoices")
async def list_invoices(user: dict = Depends(get_current_user)):
    q = {}
    if user["portal"] == "business":
        q["advertiser_id"] = user["advertiser_id"]
    out = []
    adv_map = {a["id"]: a for a in await db.advertisers.find().to_list(1000)}
    for i in await db.invoices.find(q).sort("date", -1).to_list(500):
        clean(i)
        a = adv_map.get(i["advertiser_id"])
        i["advertiser"] = {"name": a["name"], "gstin": a.get("gstin"), "email": a.get("email")} if a else {}
        out.append(i)
    return out

@api.get("/credit-notes")
async def list_credit_notes(user: dict = Depends(get_current_user)):
    q = {}
    if user["portal"] == "business":
        q["advertiser_id"] = user["advertiser_id"]
    out = [clean(c) for c in await db.credit_notes.find(q).sort("date", -1).to_list(200)]
    return out

# ------------------------------------------------------------------
# Payouts
# ------------------------------------------------------------------
@api.get("/payouts")
async def list_payouts(user: dict = Depends(require("ops"))):
    dmap = {d["id"]: d for d in await db.drivers.find().to_list(1000)}
    cabmap = {c["id"]: c for c in await db.cabs.find().to_list(1000)}
    # compute owed for current period per driver with a booked cab
    owed = []
    for d in dmap.values():
        c = cabmap.get(d.get("cab_id"))
        active = c and c["status"] == "booked"
        amount = RULES["DRIVER_PAY_PER_CAB_MONTH"] if active else 0
        already = await db.payouts.find_one({"driver_id": d["id"], "period": current_period()})
        owed.append({"driver_id": d["id"], "name": d["name"], "upi": d.get("payout_upi"),
                     "kyc": d.get("kyc_status"), "amount": amount,
                     "paid": bool(already), "utr": already.get("utr") if already else None})
    history = [clean(p) for p in await db.payouts.find().sort("date", -1).to_list(200)]
    return {"period": current_period(), "owed": owed, "history": history}

def current_period():
    return datetime.now(timezone.utc).strftime("%Y-%m")

class PayoutIn(BaseModel):
    driver_id: str
    amount: int

@api.post("/payouts/run")
async def run_payout(body: PayoutIn, user: dict = Depends(require("ops"))):
    d = await db.drivers.find_one({"id": body.driver_id})
    if not d:
        raise HTTPException(404, "Driver not found")
    if d.get("kyc_status") != "verified":
        raise HTTPException(400, "Cannot pay a driver with KYC pending")
    utr = f"UTR{random.randint(10**11, 10**12-1)}"
    p = {"id": str(uuid.uuid4()), "driver_id": body.driver_id, "driver_name": d["name"],
         "amount": body.amount, "utr": utr, "period": current_period(),
         "status": "paid", "date": now_iso()}
    await db.payouts.insert_one(dict(p))
    await log_activity(user["name"], f"paid ₹{body.amount} to {d['name']} ({utr})")
    clean(p)
    return p

@api.get("/payouts/me")
async def my_payouts(user: dict = Depends(require("partner"))):
    d = await db.drivers.find_one({"id": user["driver_id"]})
    history = [clean(p) for p in await db.payouts.find({"driver_id": user["driver_id"]}).sort("date", -1).to_list(50)]
    # next payout date
    today = datetime.now(timezone.utc).day
    next_day = 16 if today < 16 else 1
    return {"next_date": next_day, "history": history,
            "estimated": RULES["DRIVER_PAY_PER_CAB_MONTH"], "daily": RULES["DRIVER_DAILY"]}

# ------------------------------------------------------------------
# Finance
# ------------------------------------------------------------------
@api.get("/finance")
async def finance(user: dict = Depends(require("ops"))):
    booked = await db.cabs.count_documents({"status": "booked"})
    revenue = booked * RULES["PRICE_PER_CAB"]
    driver_cost = booked * RULES["DRIVER_PAY_PER_CAB_MONTH"]
    device_cost = booked * (RULES["HARDWARE_COST"] + RULES["SIM_COST"])
    gross = revenue - driver_cost - device_cost
    contribution = RULES["PRICE_PER_CAB"] - RULES["DRIVER_PAY_PER_CAB_MONTH"] - (RULES["HARDWARE_COST"] + RULES["SIM_COST"])
    return {"booked": booked, "revenue": revenue, "driver_cost": driver_cost,
            "device_cost": device_cost, "gross_margin": gross,
            "margin_pct": round(gross / revenue * 100, 1) if revenue else 0,
            "per_cab_contribution": contribution}

# ------------------------------------------------------------------
# Incidents
# ------------------------------------------------------------------
class IncidentIn(BaseModel):
    title: str
    severity: Optional[str] = "medium"
    assignee: Optional[str] = "Unassigned"

@api.get("/incidents")
async def list_incidents(user: dict = Depends(require("ops"))):
    return [clean(i) for i in await db.incidents.find().sort("created_at", -1).to_list(200)]

@api.post("/incidents")
async def add_incident(body: IncidentIn, user: dict = Depends(require("ops"))):
    inc = {"id": str(uuid.uuid4()), "title": body.title, "severity": body.severity,
           "assignee": body.assignee, "status": "open", "created_at": now_iso()}
    await db.incidents.insert_one(dict(inc))
    await log_activity(user["name"], f"opened incident '{body.title}'")
    clean(inc)
    return inc

@api.patch("/incidents/{iid}/close")
async def close_incident(iid: str, user: dict = Depends(require("ops"))):
    await db.incidents.update_one({"id": iid}, {"$set": {"status": "closed", "closed_at": now_iso()}})
    await log_activity(user["name"], "closed an incident")
    return {"ok": True}

# ------------------------------------------------------------------
# Activity + reports + dashboards
# ------------------------------------------------------------------
@api.get("/activity")
async def activity(user: dict = Depends(get_current_user)):
    return [clean(a) for a in await db.activity.find().sort("ts", -1).to_list(40)]

@api.get("/reports/plays")
async def reports_plays(user: dict = Depends(require("business"))):
    cabs = await db.cabs.count_documents({"advertiser_id": user["advertiser_id"], "status": "booked"})
    daily = []
    for row in await db.play_data.find().sort("date", 1).to_list(1000):
        daily.append(row)
    # aggregate scaled to advertiser cabs
    agg = {}
    for row in daily:
        agg.setdefault(row["date"], 0)
        agg[row["date"]] += row["plays"]
    total_cabs = await db.cabs.count_documents({})
    factor = cabs / total_cabs if total_cabs else 0
    days = [{"date": d, "plays": int(v * factor)} for d, v in sorted(agg.items())]
    hourly = [{"hour": f"{h}:00", "plays": int(cabs * random.randint(40, 70))} for h in range(8, 20)]
    per_cab = []
    mycabs = await db.cabs.find({"advertiser_id": user["advertiser_id"], "status": "booked"}).to_list(1000)
    for c in mycabs:
        per_cab.append({"plate": c["plate"], "plays": random.randint(650, 720),
                        "km": random.randint(110, 150), "uptime": random.randint(88, 99)})
    return {"daily": days, "hourly": hourly, "per_cab": per_cab,
            "uptime": round(sum(p["uptime"] for p in per_cab) / len(per_cab), 1) if per_cab else 0}

@api.get("/ops/dashboard")
async def ops_dashboard(user: dict = Depends(require("ops"))):
    cabs = await db.cabs.find().to_list(1000)
    total = len(cabs)
    booked = sum(1 for c in cabs if c["status"] == "booked")
    available = sum(1 for c in cabs if c["status"] == "available")
    mrr = booked * RULES["PRICE_PER_CAB"]
    driver_cost = booked * RULES["DRIVER_PAY_PER_CAB_MONTH"]
    device_cost = booked * (RULES["HARDWARE_COST"] + RULES["SIM_COST"])
    gross = mrr - driver_cost - device_cost
    plays_today = booked * RULES["PLAYS_PER_CAB_DAY"]
    pending = await db.creatives.count_documents({"status": "in_review"})
    overdue = 0
    for d in await db.drivers.find().to_list(1000):
        if compliance_status(d) == "overdue":
            overdue += 1
    return {"total_cabs": total, "booked": booked, "available": available,
            "mrr": mrr, "gross_margin": gross, "plays_today": plays_today,
            "pending_reviews": pending, "overdue_photos": overdue,
            "advertisers": await db.advertisers.count_documents({}),
            "drivers": await db.drivers.count_documents({})}

@api.get("/business/overview")
async def business_overview(user: dict = Depends(require("business"))):
    cabs = await db.cabs.count_documents({"advertiser_id": user["advertiser_id"], "status": "booked"})
    on_air = await db.creatives.find_one({"advertiser_id": user["advertiser_id"], "on_air": True})
    approved = await db.creatives.count_documents({"advertiser_id": user["advertiser_id"], "status": "approved"})
    pending = await db.creatives.count_documents({"advertiser_id": user["advertiser_id"], "status": "in_review"})
    plays_today = cabs * RULES["PLAYS_PER_CAB_DAY"]
    km_today = cabs * RULES["KM_PER_CAB_DAY"]
    if on_air:
        clean(on_air)
    return {"cabs": cabs, "on_air": on_air, "plays_today": plays_today, "km_today": km_today,
            "approved": approved, "pending": pending,
            "reach_estimate": plays_today * 3, "uptime": 96.4}

# ------------------------------------------------------------------
# Seeding
# ------------------------------------------------------------------
PUNE_SERIES = ["MH-12", "MH-14"]

async def seed():
    if await db.users.find_one({"seed_marker": True}) is None:
        pass
    already = await db.cabs.count_documents({})
    # Always ensure admin users exist / password fresh
    admin_users = [
        {"email": "jayborana3@gmail.com", "name": "Jay Borana", "portal": "ops", "role": "admin"},
        {"email": "admin@sawari.in", "name": "Admin", "portal": "ops", "role": "admin"},
        {"email": "reviewer@sawari.in", "name": "Reviewer", "portal": "ops", "role": "reviewer"},
    ]
    for au in admin_users:
        existing = await db.users.find_one({"email": au["email"]})
        if not existing:
            await db.users.insert_one({"id": str(uuid.uuid4()), "password_hash": hash_password("demo1234"),
                                       "created_at": now_iso(), **au})
        elif not verify_password("demo1234", existing["password_hash"]):
            await db.users.update_one({"email": au["email"]}, {"$set": {"password_hash": hash_password("demo1234")}})

    if already > 0:
        return  # data already seeded

    await db.fleet.update_one({"id": "fleet"}, {"$set": {"id": "fleet", "total_cabs": 68, "max_cabs": 200}}, upsert=True)

    # advertisers
    advs = [
        {"id": str(uuid.uuid4()), "name": "Pizza Palace", "email": "owner@pizzapalace.com",
         "gstin": "27AAACP1234F1Z2", "category": "Restaurant", "count": 15,
         "login": "owner@pizzapalace.com"},
        {"id": str(uuid.uuid4()), "name": "Kaveri Retail", "email": "ops@kaveri.in",
         "gstin": "27AABCK5678L1Z9", "category": "Retail", "count": 25,
         "login": "ops@kaveri.in"},
        {"id": str(uuid.uuid4()), "name": "Shagun Jewellers", "email": "hello@shagun.in",
         "gstin": "27AAJCS9012M1Z1", "category": "Jeweller", "count": 18, "login": None},
        {"id": str(uuid.uuid4()), "name": "FitZone Gym", "email": "hello@fitzone.in",
         "gstin": "27AAFCF3456N1Z7", "category": "Gym", "count": 6, "login": None},
    ]
    for a in advs:
        await db.advertisers.insert_one({
            "id": a["id"], "name": a["name"], "email": a["email"], "gstin": a["gstin"],
            "category": a["category"],
            "renewal_date": (datetime.now(timezone.utc) + timedelta(days=random.randint(8, 40))).date().isoformat(),
            "created_at": now_iso(), "notify_email": True, "notify_sms": False})
        if a["login"]:
            await db.users.insert_one({"id": str(uuid.uuid4()), "email": a["login"],
                                       "password_hash": hash_password("demo1234"),
                                       "name": a["name"], "portal": "business",
                                       "advertiser_id": a["id"], "created_at": now_iso()})

    # cabs (62): assign to advertisers, keep some available/offline/faulty
    plates = set()
    cabs = []
    for i in range(68):
        while True:
            p = f"{random.choice(PUNE_SERIES)}-{random.choice('ABCDEFGHJKLMNPQR')}{random.choice('ABCDEFGHJKLMNPQR')}-{random.randint(1000,9999)}"
            if p not in plates:
                plates.add(p); break
        cabs.append({"id": str(uuid.uuid4()), "plate": p, "zone": random.choice(ZONES),
                     "status": "available", "advertiser_id": None,
                     "battery": random.randint(45, 100), "signal": random.randint(2, 4),
                     "last_checkin": now_iso()})
    # assign
    idx = 0
    for a in advs:
        for _ in range(a["count"]):
            cabs[idx]["status"] = "booked"; cabs[idx]["advertiser_id"] = a["id"]; idx += 1
    # remaining: 62-58 = 4 -> 2 available, 1 offline, 1 faulty
    cabs[idx]["status"] = "available"; idx += 1
    cabs[idx]["status"] = "available"; idx += 1
    cabs[idx]["status"] = "offline"; idx += 1
    cabs[idx]["status"] = "faulty"; idx += 1
    for c in cabs:
        await db.cabs.insert_one(dict(c))

    # drivers, one per cab
    first = ["Ramesh", "Suresh", "Anil", "Vijay", "Prakash", "Ganesh", "Sachin", "Amit",
             "Nitin", "Deepak", "Sunil", "Rahul", "Santosh", "Manoj", "Kiran", "Balaji"]
    last = ["Pawar", "Jadhav", "Shinde", "Kulkarni", "Deshmukh", "More", "Patil", "Kadam",
            "Gaikwad", "Sawant", "Bhosale", "Chavan"]
    for n, c in enumerate(cabs):
        phone = f"98123{40001 + n:05d}"
        kyc = "verified" if n != 5 else "pending"
        drv = {"id": str(uuid.uuid4()), "name": f"{random.choice(first)} {random.choice(last)}",
               "phone": phone, "cab_id": c["id"], "kyc_status": kyc,
               "payout_upi": f"driver{n}@okhdfc", "on_duty": n % 3 != 0,
               "referral_code": f"SAW{random.randint(1000,9999)}",
               "last_photo_date": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 12))).isoformat(),
               "photo_verified": True, "pending_photo": False, "created_at": now_iso()}
        # first driver overdue (no recent photo)
        if n == 0:
            drv["last_photo_date"] = (datetime.now(timezone.utc) - timedelta(days=22)).isoformat()
            drv["photo_verified"] = False
        await db.drivers.insert_one(dict(drv))
        # partner login for the first driver
        if n == 0:
            await db.users.insert_one({"id": str(uuid.uuid4()), "phone": phone, "email": f"{phone}@partner.local",
                                       "password_hash": hash_password("1234"), "name": drv["name"],
                                       "portal": "partner", "driver_id": drv["id"], "created_at": now_iso()})

    # creatives: 4 brands share each cab screen — one 15s ad each, rotating every minute
    on_air_ads = [
        (advs[0]["id"], "Buy 1 Get 1 — Weekend Special"),
        (advs[1]["id"], "Monsoon Sale — Flat 40% Off"),
        (advs[2]["id"], "Diwali Gold — 0% Making Charges"),
        (advs[3]["id"], "Join Now — 3 Months Free"),
    ]
    for aid, title in on_air_ads:
        await db.creatives.insert_one({"id": str(uuid.uuid4()), "advertiser_id": aid,
            "title": title, "duration": 15.0, "video": "",
            "expiry": (datetime.now(timezone.utc) + timedelta(days=25)).date().isoformat(),
            "status": "approved", "reject_reason": None, "on_air": True, "created_at": now_iso()})
    await db.creatives.insert_one({"id": str(uuid.uuid4()), "advertiser_id": advs[1]["id"],
        "title": "Festive Combo Teaser", "duration": 15.0, "video": "",
        "expiry": (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat(),
        "status": "in_review", "reject_reason": None, "on_air": False, "created_at": now_iso()})

    # play data — 14 days
    for d in range(14):
        date = (datetime.now(timezone.utc) - timedelta(days=13 - d)).date().isoformat()
        for c in cabs:
            if c["status"] == "booked":
                await db.play_data.insert_one({"id": str(uuid.uuid4()), "date": date,
                    "cab_id": c["id"], "plays": random.randint(640, 720),
                    "km": random.randint(110, 150)})

    # credit note (SLA breach) for pizza
    base = 2 * RULES["PRICE_PER_CAB"]
    gst = round(base * RULES["GST"] / 100)
    await db.credit_notes.insert_one({"id": str(uuid.uuid4()), "advertiser_id": advs[0]["id"],
        "number": f"CN-{datetime.now().strftime('%Y%m')}-1001", "reason": "Uptime below 90% SLA on 2 cabs",
        "base": base, "gst": gst, "total": base + gst, "date": now_iso()})

    # payout history
    for a in [advs[0]]:
        pass
    dr = await db.drivers.find_one({})
    await db.payouts.insert_one({"id": str(uuid.uuid4()), "driver_id": dr["id"],
        "driver_name": dr["name"], "amount": 500, "utr": f"UTR{random.randint(10**11,10**12-1)}",
        "period": (datetime.now(timezone.utc) - timedelta(days=20)).strftime("%Y-%m"),
        "status": "paid", "date": (datetime.now(timezone.utc) - timedelta(days=15)).isoformat()})

    # invoice history for pizza & kaveri
    for a in advs[:2]:
        b = a["count"] * RULES["PRICE_PER_CAB"]
        g = round(b * RULES["GST"] / 100)
        await db.invoices.insert_one({"id": str(uuid.uuid4()),
            "number": f"INV-{datetime.now().strftime('%Y%m')}-{random.randint(1000,9999)}",
            "advertiser_id": a["id"], "cabs": a["count"], "date": now_iso(), "status": "paid",
            "type": "invoice", "base": b, "cgst": g // 2, "sgst": g - g // 2, "gst": g, "total": b + g})

    # incident
    await db.incidents.insert_one({"id": str(uuid.uuid4()), "title": "Tablet not powering on — MH-12",
        "severity": "high", "assignee": "Field Ops", "status": "open", "created_at": now_iso()})

    # compliance photo overdue for driver 0 already handled; seed a pending submission entry
    await log_activity("System", "seeded demo data")
    await log_activity("Pizza Palace", "put 'Buy 1 Get 1' on air", "business")

async def write_test_creds():
    content = """# Test Credentials

## Ops / Admin portal  (portal = "ops")
- jayborana3@gmail.com / demo1234  (owner/admin — real owner)
- admin@sawari.in / demo1234
- reviewer@sawari.in / demo1234

## Business / Advertiser portal  (portal = "business")
- owner@pizzapalace.com / demo1234  (15 cabs)
- ops@kaveri.in / demo1234  (25 cabs)

## Partner / Driver portal  (portal = "partner")
- 9812340001 / 1234  (driver, compliance photo OVERDUE)

## Notes
- Login endpoint: POST /api/auth/login {identifier, password, portal}
- Credentials are portal-locked: using them on the wrong portal returns 403.
- Auth via httpOnly cookie `access_token` (JWT). Also returns token in body.
"""
    Path("/app/memory/test_credentials.md").write_text(content)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email")
    await db.users.create_index("phone")
    await seed()
    await write_test_creds()

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown():
    client.close()
