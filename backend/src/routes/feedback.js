const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/feedback  { conversationId, rating, comment }
router.post('/', requireAuth, async (req, res) => {
  const { conversationId, rating, comment } = req.body;
  await pool.query(
    `INSERT INTO feedback (conversation_id, user_id, rating, comment)
     VALUES ($1, $2, $3, $4)`,
    [conversationId || null, req.user.id, rating || null, comment || null]
  );
  res.json({ ok: true });
});

// POST /api/data-deletion-request — required for privacy compliance (DPDP/HIPAA-equivalent)
router.post('/data-deletion-request', requireAuth, async (req, res) => {
  await pool.query(
    `INSERT INTO data_deletion_requests (user_id) VALUES ($1)`,
    [req.user.id]
  );
  res.json({ ok: true, message: 'Your deletion request has been logged and will be processed.' });
});

module.exports = router;
