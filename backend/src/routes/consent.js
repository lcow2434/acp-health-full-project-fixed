const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const CURRENT_TERMS_VERSION = 'draft-v0.1-pending-legal-review';

// POST /api/consent  { agreed: true }
router.post('/', requireAuth, async (req, res) => {
  if (req.body.agreed !== true) {
    return res.status(400).json({ error: 'agreed must be true to record consent' });
  }
  await pool.query(
    `INSERT INTO consents (user_id, terms_version) VALUES ($1, $2)`,
    [req.user.id, CURRENT_TERMS_VERSION]
  );
  res.json({ ok: true, termsVersion: CURRENT_TERMS_VERSION });
});

module.exports = router;
