const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/review/queue — triage results not yet reviewed by a clinician
router.get('/queue', requireAuth, requireRole('clinician'), async (req, res) => {
  const { rows } = await pool.query(`
    SELECT tr.id, tr.tier, tr.rule_version, tr.raw_inputs, tr.created_at,
           c.id AS conversation_id
    FROM triage_results tr
    JOIN conversations c ON c.id = tr.conversation_id
    LEFT JOIN clinician_reviews cr ON cr.triage_result_id = tr.id
    WHERE cr.id IS NULL
    ORDER BY tr.created_at ASC
    LIMIT 50
  `);
  res.json(rows);
});

// POST /api/review/:triageResultId
// { agreedWithTier, correctedTier, notes }
// This is the mechanism by which the system improves over time:
// clinicians audit real decisions, corrections feed the next rule revision.
router.post('/:triageResultId', requireAuth, requireRole('clinician'), async (req, res) => {
  const { agreedWithTier, correctedTier, notes } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO clinician_reviews (triage_result_id, clinician_id, agreed_with_tier, corrected_tier, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, reviewed_at`,
    [req.params.triageResultId, req.user.id, agreedWithTier, correctedTier || null, notes || null]
  );
  res.json(rows[0]);
});

module.exports = router;
