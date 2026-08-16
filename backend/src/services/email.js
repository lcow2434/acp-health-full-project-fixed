/**
 * ACP Health — Doctor notification email
 * =========================================================
 * Sends the doctor their new appointment: patient's visit-prep
 * summary (symptoms, duration, severity, triage tier), the Zoom
 * link, and the payout amount they'll receive. Uses SendGrid,
 * but any transactional email provider works the same way.
 * =========================================================
 */

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendDoctorAppointmentEmail({ doctor, appointment, triageSummary, zoomJoinUrl, doctorPayoutCents, currency }) {
  const payoutDisplay = (doctorPayoutCents / 100).toFixed(2);

  const msg = {
    to: doctor.email,
    from: process.env.NOTIFICATIONS_FROM_EMAIL,
    subject: `New consultation request — ${triageSummary.tierLabel}`,
    html: `
      <p>Hi Dr. ${doctor.name},</p>
      <p>A patient has booked a consultation through ACP Health and payment has been confirmed.</p>
      <h3>Visit summary</h3>
      <ul>
        <li><b>Reported concern:</b> ${triageSummary.primarySymptom}</li>
        <li><b>Duration:</b> ${triageSummary.duration}</li>
        <li><b>Self-reported severity:</b> ${triageSummary.severity}</li>
        <li><b>System urgency tier:</b> ${triageSummary.tierLabel} <i>(informational only — please assess independently)</i></li>
      </ul>
      <p><b>Zoom meeting:</b> <a href="${zoomJoinUrl}">${zoomJoinUrl}</a></p>
      <p><b>Your payout for this consultation:</b> ${currency} $${payoutDisplay} (paid out automatically via Stripe after the call)</p>
      <p>Appointment ID: ${appointment.id}</p>
    `,
  };

  await sgMail.send(msg);
}

module.exports = { sendDoctorAppointmentEmail };
