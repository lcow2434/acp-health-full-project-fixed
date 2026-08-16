const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { createConsultationPayment } = require('../services/payments');
const { createZoomMeeting } = require('../services/zoom');
const { sendDoctorAppointmentEmail } = require('../services/email');
const { matchSpecialty } = require('../services/specialtyMatch');

const router = express.Router();

const TIER_LABELS = { emergency: 'Emergency', urgent: 'Urgent', self_care: 'Self-care' };

/**
 * POST /api/appointments
 * Body: { conversationId, triageResultId, jurisdiction, specialty? }
 * Matches an available, verified doctor licensed for the patient's
 * jurisdiction, creates a 'requested' appointment, and returns a
 * payment client secret for the frontend to collect payment.
 *
 * NOTE: emergency-tier conversations should route to real emergency
 * services in the UI, not to this booking flow — see roadmap doc.
 */
router.post('/', requireAuth, async (req, res) => {
  const { conversationId, triageResultId, jurisdiction, specialty: specialtyOverride } = req.body;
  if (!conversationId || !jurisdiction) {
    return res.status(400).json({ error: 'conversationId and jurisdiction are required' });
  }

  // If the caller didn't pin a specialty, derive one from what the patient
  // actually reported during triage — chest pain routes to Cardiology,
  // a skin complaint routes to Dermatology, etc. Falls back to Family Medicine.
  let specialty = specialtyOverride;
  if (!specialty && triageResultId) {
    const triageRes = await pool.query(`SELECT raw_inputs FROM triage_results WHERE id = $1`, [triageResultId]);
    const primarySymptom = triageRes.rows[0]?.raw_inputs?.primarySymptom;
    specialty = matchSpecialty(primarySymptom);
  }

  const doctorQuery = await pool.query(
    `SELECT * FROM doctors
     WHERE verified = true AND active = true
       AND license_jurisdiction = $1
       AND ($2::text IS NULL OR specialty = $2)
     ORDER BY random() LIMIT 1`,
    [jurisdiction, specialty || null]
  );

  if (doctorQuery.rows.length === 0) {
    return res.status(404).json({ error: 'no_doctor_available', message: `No verified ${specialty || ''} doctor is currently available for your area. Please try a clinic from the nearby-care list instead.` });
  }
  const doctor = doctorQuery.rows[0];

  const apptResult = await pool.query(
    `INSERT INTO appointments (conversation_id, patient_id, doctor_id, triage_result_id, status)
     VALUES ($1, $2, $3, $4, 'payment_pending')
     RETURNING id`,
    [conversationId, req.user.id, doctor.id, triageResultId || null]
  );
  const appointmentId = apptResult.rows[0].id;

  const payment = await createConsultationPayment({
    doctor,
    appointmentId,
    currency: doctor.currency,
  });

  await pool.query(
    `INSERT INTO payments (appointment_id, amount_cents, platform_fee_cents, doctor_payout_cents, currency, stripe_payment_intent_id, status)
     VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
    [appointmentId, payment.amountCents, payment.platformFeeCents, payment.doctorPayoutCents, doctor.currency, payment.paymentIntentId]
  );

  res.json({
    appointmentId,
    doctor: { name: doctor.name, specialty: doctor.specialty },
    amountCents: payment.amountCents,
    currency: doctor.currency,
    clientSecret: payment.clientSecret, // frontend uses this with Stripe.js to collect card details
  });
});

/**
 * POST /api/appointments/webhook
 * Stripe webhook — on payment_intent.succeeded, this is where the
 * booking actually becomes real: confirm the appointment, create
 * the Zoom meeting, and email the doctor. Register this URL in
 * your Stripe dashboard; verify the signature in production
 * (omitted here — see stripe docs for constructEvent).
 */
router.post('/webhook', async (req, res) => {
  let event;
  try {
    // production: verify via stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET)
    // instead of a bare JSON.parse, so forged requests can't fake a payment success.
    event = JSON.parse(req.body.toString('utf8'));
  } catch (err) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  if (event.type !== 'payment_intent.succeeded') return res.json({ received: true });

  const intent = event.data.object;
  const { appointmentId, platformFeeCents, doctorPayoutCents } = intent.metadata;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE payments SET status = 'succeeded' WHERE stripe_payment_intent_id = $1`,
      [intent.id]
    );

    const apptRes = await client.query(
      `UPDATE appointments SET status = 'confirmed', scheduled_at = now() + interval '15 minutes'
       WHERE id = $1 RETURNING *`,
      [appointmentId]
    );
    const appointment = apptRes.rows[0];

    const doctorRes = await client.query(`SELECT * FROM doctors WHERE id = $1`, [appointment.doctor_id]);
    const doctor = doctorRes.rows[0];

    const triageRes = appointment.triage_result_id
      ? await client.query(`SELECT * FROM triage_results WHERE id = $1`, [appointment.triage_result_id])
      : { rows: [] };
    const triage = triageRes.rows[0];
    const inputs = triage?.raw_inputs || {};

    const zoom = await createZoomMeeting({
      doctorZoomEmail: doctor.zoom_host_email,
      topic: `ACP Health consultation — ${appointment.id}`,
      startTime: appointment.scheduled_at,
    });

    await client.query(
      `UPDATE appointments SET zoom_meeting_id = $1, zoom_join_url = $2, zoom_host_url = $3 WHERE id = $4`,
      [zoom.meetingId, zoom.joinUrl, zoom.hostUrl, appointment.id]
    );

    await sendDoctorAppointmentEmail({
      doctor,
      appointment,
      triageSummary: {
        primarySymptom: inputs.primarySymptom || 'Not captured',
        duration: inputs.duration || 'Not captured',
        severity: inputs.severity || 'Not captured',
        tierLabel: TIER_LABELS[triage?.tier] || 'Unknown',
      },
      zoomJoinUrl: zoom.joinUrl,
      doctorPayoutCents: Number(doctorPayoutCents),
      currency: doctor.currency,
    });

    await client.query('COMMIT');
    res.json({ received: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to finalize appointment' });
  } finally {
    client.release();
  }
});

// GET /api/appointments/:id — poll for status (frontend uses this after payment)
router.get('/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM appointments WHERE id = $1`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

module.exports = router;
