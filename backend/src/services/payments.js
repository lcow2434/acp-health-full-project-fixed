/**
 * ACP Health — Payments (Stripe Connect)
 * =========================================================
 * Marketplace pattern: the patient pays the platform, the
 * platform takes a cut, and the rest goes straight to the
 * doctor's own connected Stripe account. This is a "destination
 * charge" — Stripe moves the doctor's share automatically, so
 * the platform never custody-holds the doctor's earnings longer
 * than the payout cycle.
 *
 * Requires: doctor.stripe_account_id already set up via Stripe
 * Connect onboarding (not built here — see README note).
 * =========================================================
 */

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT || 8); // 5-10% range, configurable

function calculateSplit(feeCents) {
  const platformFeeCents = Math.round(feeCents * (PLATFORM_FEE_PERCENT / 100));
  const doctorPayoutCents = feeCents - platformFeeCents;
  return { platformFeeCents, doctorPayoutCents };
}

/**
 * Creates a PaymentIntent that charges the patient and routes
 * the doctor's share directly to their connected account.
 */
async function createConsultationPayment({ doctor, appointmentId, currency }) {
  const { platformFeeCents, doctorPayoutCents } = calculateSplit(doctor.fee_cents);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: doctor.fee_cents,
    currency: currency || doctor.currency || 'cad',
    application_fee_amount: platformFeeCents,
    transfer_data: {
      destination: doctor.stripe_account_id,
    },
    metadata: {
      appointmentId,
      doctorId: doctor.id,
      platformFeeCents: String(platformFeeCents),
      doctorPayoutCents: String(doctorPayoutCents),
    },
  });

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amountCents: doctor.fee_cents,
    platformFeeCents,
    doctorPayoutCents,
  };
}

module.exports = { createConsultationPayment, calculateSplit, PLATFORM_FEE_PERCENT };
