const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { runTriage } = require('../services/triageRules');

const router = express.Router();

// POST /api/conversations  -> start a new conversation
router.post('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `INSERT INTO conversations (user_id) VALUES ($1) RETURNING id, started_at`,
    [req.user.id]
  );
  res.json(rows[0]);
});

// POST /api/conversations/:id/messages  { sender, content }
router.post('/:id/messages', requireAuth, async (req, res) => {
  const { sender, content } = req.body;
  if (!['user', 'bot'].includes(sender) || !content) {
    return res.status(400).json({ error: 'sender must be user|bot and content is required' });
  }
  const { rows } = await pool.query(
    `INSERT INTO messages (conversation_id, sender, content)
     VALUES ($1, $2, $3) RETURNING id, created_at`,
    [req.params.id, sender, content]
  );
  res.json(rows[0]);
});

// POST /api/conversations/:id/triage
// Body: { primarySymptom, duration, severity, freeTextFlags }
// Runs the deterministic rule engine server-side and logs the result
// with the rule_version, so later clinician review is traceable.
router.post('/:id/triage', requireAuth, async (req, res) => {
  const result = runTriage(req.body);

  const { rows } = await pool.query(
    `INSERT INTO triage_results (conversation_id, tier, rule_version, raw_inputs)
     VALUES ($1, $2, $3, $4)
     RETURNING id, tier, rule_version, created_at`,
    [req.params.id, result.tier, result.ruleVersion, JSON.stringify(req.body)]
  );

  res.json(rows[0]);
});

// POST /api/conversations/:id/end
router.post('/:id/end', requireAuth, async (req, res) => {
  await pool.query(
    `UPDATE conversations SET status = 'completed', ended_at = now() WHERE id = $1`,
    [req.params.id]
  );
  res.json({ ok: true });
});

module.exports = router;
