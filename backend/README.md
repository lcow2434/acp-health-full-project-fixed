# ACP Health — Pilot Backend

Real, runnable API layer for the private pilot: auth via invite codes, conversation
logging, a deterministic triage rule engine, a clinician review loop, a doctor-gated
medicine reference lookup, and a server-side clinic search proxy.

## What this is and isn't

**This is:** a legitimate backend skeleton you can deploy, connect a real database to,
and build the frontend against. The invite-code gating, JWT auth, and API key handling
are done properly here (server-side), unlike the client-side demo prototype.

**This is not:** cleared for real users. See "Before this touches real users" below.

## How "improving AI performance" actually works here

There is no step in this codebase where raw user conversations get fed back into a
model to auto-retrain it. Instead:

1. The triage engine (`src/services/triageRules.js`) is a plain deterministic function —
   inspectable, versioned, testable. It is not an LLM making a judgment call per-user.
2. Every triage decision is logged (`triage_results`) with the rule version that produced it.
3. Licensed clinicians review a queue of real decisions (`clinician_reviews`) and mark
   them correct or provide the correct tier.
4. **A human — you, with your clinical advisor — revises `triageRules.js` based on
   that accumulated review data**, and ships a new `RULE_VERSION`.

This is how the system gets better without the risk of an autonomous model quietly
drifting on health decisions. Treat any future request to "just let the AI learn from
conversations automatically" as a proposal to remove this safety mechanism — don't skip it.

## Setup

```bash
npm install
cp .env.example .env   # fill in real values
npm run migrate        # applies src/db/schema.sql
npm run dev
```

Requires a PostgreSQL database and a Google Places API key (server-side only —
see `src/routes/clinics.js`, the key never reaches the client).

## Generating invite codes

```bash
node scripts/generate_invite_code.js "ACPBETA01" 5 "first-pilot-batch"
```

This prints the SQL to insert a *hashed* code. The raw code is shown once in your
terminal — that's what you hand to a real invitee. The database never stores the
raw code, only its hash, so a database leak doesn't leak working invite codes.

## API surface

| Route | Purpose |
|---|---|
| `POST /api/invite/redeem` | Exchange an invite code for a JWT |
| `POST /api/consent` | Record T&C / disclaimer agreement |
| `POST /api/conversations` | Start a conversation |
| `POST /api/conversations/:id/messages` | Log a chat message |
| `POST /api/conversations/:id/triage` | Run the rule engine, log the result |
| `GET /api/review/queue` | (clinician only) pending triage decisions to review |
| `POST /api/review/:triageResultId` | (clinician only) record agreement/correction |
| `POST /api/medicine-lookup` | Doctor-gated reference lookup — refuses if not confirmed |
| `GET /api/clinics` | Server-side proxy to Google Places, results cached |
| `POST /api/feedback` | User feedback on a conversation |
| `POST /api/data-deletion-request` | Logs a right-to-deletion request |
| `POST /api/appointments` | Match a verified doctor, create a payment intent |
| `POST /api/appointments/webhook` | Stripe webhook — confirms payment, creates Zoom meeting, emails doctor |
| `GET /api/appointments/:id` | Poll appointment status |

## Doctor consultation booking (new)

Flow: patient finishes triage → requests a consultation → platform matches a
*verified, jurisdiction-licensed* doctor → patient pays via Stripe (destination
charge, doctor's cut goes straight to their own connected Stripe account, platform
keeps `PLATFORM_FEE_PERCENT`) → on payment success, a Zoom meeting is created under
the doctor's account and the doctor is emailed the visit summary + join link.

Nothing here has the AI diagnosing or prescribing — it's booking logistics for a
real human consultation, same category as the clinic-finder feature.

**Before this goes live, beyond the usual clinical/legal checklist:**
- [ ] Doctor onboarding flow with actual license verification (not built here —
      `doctors.verified` must only ever be set `true` by a human checking a real license)
- [ ] Doctor-jurisdiction matching logic needs your legal counsel's input — most
      places require the doctor be licensed where the *patient* is, not the doctor
- [ ] Confirm whether taking a cut of doctor fees requires money-transmitter or
      marketplace-facilitator registration in your jurisdiction(s)
- [ ] Doctor onboarding needs Stripe Connect account setup (not built here — see
      [Stripe Connect onboarding docs](https://stripe.com/docs/connect))
- [ ] Real Stripe webhook signature verification (this skeleton parses the raw
      body but doesn't verify the signature — see `stripe.webhooks.constructEvent`)
- [ ] Cancellation/refund policy and its implementation
- [ ] PCI scope: use Stripe.js/Elements on the frontend so card details never
      touch your server directly

## Before this touches real users

- [ ] A licensed clinician has reviewed and approved `triageRules.js` (currently a draft)
- [ ] `medicine_reference` table is populated from a licensed drug-information source,
      not left empty or filled by model output
- [ ] Legal counsel has reviewed and finalized the Terms/disclaimer
      (`CURRENT_TERMS_VERSION` in `src/routes/consent.js` is a placeholder)
- [ ] Data retention policy implemented (currently deletion requests are only logged,
      not auto-fulfilled — needs a real process)
- [ ] TLS/HTTPS termination in front of this API (not included here — handled by
      your hosting layer, e.g. a load balancer or reverse proxy)
- [ ] Real rate limiting / abuse monitoring tuned to expected traffic
- [ ] Security review of JWT secret handling and rotation policy
