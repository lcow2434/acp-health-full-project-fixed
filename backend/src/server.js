require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const inviteRoutes = require('./routes/invite');
const consentRoutes = require('./routes/consent');
const conversationRoutes = require('./routes/conversations');
const reviewRoutes = require('./routes/review');
const medicineRoutes = require('./routes/medicine');
const clinicRoutes = require('./routes/clinics');
const feedbackRoutes = require('./routes/feedback');
const appointmentRoutes = require('./routes/appointments');

const app = express();

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));

// Stripe webhooks need the raw body for signature verification — this must
// be registered BEFORE express.json(), or the body will already be parsed
// and signature verification will fail.
app.use('/api/appointments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// Basic abuse protection — tune per real traffic patterns
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/invite', inviteRoutes);
app.use('/api/consent', consentRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/medicine-lookup', medicineRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/appointments', appointmentRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`ACP Health backend listening on :${PORT}`));
