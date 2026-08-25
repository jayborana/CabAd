# Sawari — Cab Advertising Platform (PRD)

## Original problem statement
Production-ready cab-headrest digital advertising platform (Pune, ₹ INR) with THREE portal-locked, separately-authenticated portals: Ops/Admin (blue), Business/Advertiser (amber), Partner/Driver mobile app (green). Advertisers buy tablet ad slots on cabs (₹4,300/cab/month, min 15). All pricing in a single RULES config.

## Architecture
- Frontend: React (HashRouter, #/ops #/business #/partner), Tailwind, framer-motion, recharts, lucide-react, sonner.
- Backend: FastAPI + MongoDB (motor). JWT auth (bcrypt), token in httpOnly cookie + returned in body; frontend stores it in localStorage `sawari_token` and sends `Authorization: Bearer` (primary path since preview envs drop cookies).
- Config: RULES + BRAND objects at top of server.py (single source of truth). ZONES for Pune.
- Subdomain locking map in App.js (ops./app./partner.).

## User personas
- Founder / Ops manager / Ad reviewer (Ops portal).
- Local business owner / advertiser (Business portal).
- Cab driver (Partner mobile app).

## Core requirements (static)
- Portal-locked login; wrong-portal credentials rejected (403).
- Ops: dashboard KPIs, slot visualiser grid (assign/unassign), fleet input, ad review queue, advertisers, drivers (KYC + compliance), payouts (KYC guard, UTR), finance (breakeven), incidents, activity feed.
- Business: overview (live play counter), creatives (approval status, on-air), video upload (real duration + preview), book slots (real-time availability grid, min-15 stepper, waitlist, GST breakdown, mock checkout), reports (charts + CSV export), billing (printable GST invoice CGST/SGST, credit notes), account, support.
- Partner (mobile ≤460px, bottom tabs): today (duty toggle, prorated earnings, on-screen now, compliance photo card), earnings, device, profile. Compliance photo via camera capture (file input capture=environment) → ops verifies.

## Implemented (2026-06)
- All three portals fully functional and verified by testing agent (backend 17/18 pytest, frontend ~95%).
- JWT auth with portal lock, seeded demo accounts (idempotent).
- Seed data: 62 cabs (Pune plates), 3 advertisers (15/25/18), driver per cab, 14 days play data, 1 pending creative, 1 overdue compliance driver, 1 open incident, credit note + payout + invoice history.
- Real features: video upload+preview, camera compliance photo, CSV export, printable GST invoice, live-updating slot grids, audit/activity log.
- Payments are MOCKED (UPI/card/netbanking checkout UI, no gateway).

## Backlog / remaining
- P1: Ops fleet "total fleet size" bulk input UI (max_cabs editable now; total derived from cabs).
- P2: GET /api/bookings history listing (currently only preview + create).
- P2: Split server.py into per-resource routers.
- P2: Real payment gateway (Stripe/Razorpay) when going live; set BRAND.demo_mode=false to hide demo creds.

## Test credentials
See /app/memory/test_credentials.md
