# ACP Health — Full Project Archive

## Fastest way to see it running (no setup, no dependencies)

```bash
node serve-frontend.js
```

Then open **http://localhost:8080** in your browser. That's it — no `npm install`,
no `npx`, no internet connection needed. It serves the `frontend-prototypes/`
folder and automatically opens the most complete prototype
(`05_doctor_booking_specialty_matched.html`) at the root URL.

If you prefer `npm`:
```bash
npm start
```
(same thing — `package.json`'s `start` script just runs `serve-frontend.js`.)

### If port 8080 is already taken
```bash
PORT=8081 node serve-frontend.js
```

### Why the earlier `ERR_CONNECTION_REFUSED` / 404 happened
Nothing was ever actually listening on port 8080 before — the project had no
server for the static prototypes, and `npx http-server` depends on npm
downloading a package over the internet the first time, which can silently
fail depending on machine/network setup. `serve-frontend.js` has zero
dependencies, so that failure mode is gone.

## What's in here

**`serve-frontend.js`** / **`package.json`** — the static server described
above. Only thing needed to preview the UI.

**`backend/`** — the real, runnable Express + PostgreSQL API. Auth, deterministic
triage rule engine, clinician review loop, doctor-gated medicine reference, clinic
search proxy, and doctor consultation booking (Stripe Connect payment split, Zoom
meeting creation, doctor email notification, specialty matching). This is separate
from the static server above and needs its own setup — see `backend/README.md`.
It is **not** required just to view the frontend prototypes.

**`frontend-prototypes/`** — the interactive HTML prototypes, in the order they
were built, so you can see how the design evolved:

| File | What it demonstrates |
|---|---|
| `01_initial_prototype.html` | First working triage chat + urgency tiers + doctor-gated medicine lookup |
| `02_styled_with_live_clinics.html` | Warmer visual design, real clinic photos/ratings pulled live |
| `03_beta_gated.html` | Invite-code + consent gate in front of the whole app |
| `04_backend_connected_demo.html` | Triage results actually persisted and reviewable in a clinician queue |
| `05_doctor_booking_specialty_matched.html` | Full flow: triage → specialty-matched doctor → payment → Zoom + email ticket |

Each prototype uses the artifact platform's storage as a stand-in for the real
database in `backend/` — same data shapes, same logic, different backing store.

**`docs/`** — `ACP_Health_Roadmap_and_Triage_Draft.docx`: the draft triage rule
table (needs clinician sign-off), team roadmap, and open decisions.

## What still has to happen before any of this touches real users

1. A licensed clinician reviews and approves the triage rules
   (`backend/src/services/triageRules.js` and the docx, Section 4)
2. A licensed clinician also reviews `backend/src/services/specialtyMatch.js`
3. Legal counsel confirms your regulatory path and whether the doctor-fee cut
   requires marketplace/money-transmitter registration where you operate
4. Doctor onboarding with real license verification — nothing should ever
   auto-set `doctors.verified = true`
5. Real Stripe, Zoom, and SendGrid credentials, plus Stripe webhook signature
   verification (currently stubbed — see `backend/README.md`)

None of the prototypes or backend code here are cleared to be pointed at a
real domain with real users yet — see the checklists in `backend/README.md`
and the docx for exactly what's outstanding.
