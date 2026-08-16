const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/medicine-lookup
// { conversationId, drugName, doctorConfirmed }
// Only returns info from the curated `medicine_reference` table —
// never generates a new drug recommendation. If doctorConfirmed is
// false, the API refuses and tells the client to route to a doctor.
router.post('/', requireAuth, async (req, res) => {
  const { conversationId, drugName, doctorConfirmed } = req.body;

  if (!doctorConfirmed) {
    return res.status(403).json({
      error: 'not_doctor_confirmed',
      message: 'This reference only unlocks after a doctor-confirmed prescription.'
    });
  }

  await pool.query(
    `INSERT INTO medicine_lookups (conversation_id, drug_name, doctor_confirmed)
     VALUES ($1, $2, $3)`,
    [conversationId, drugName, true]
  );

  const { rows } = await pool.query(
    `SELECT drug_name, summary, source FROM medicine_reference WHERE lower(drug_name) = lower($1)`,
    [drugName]
  );

  if (rows.length === 0) {
    return res.json({
      found: false,
      message: 'No reference entry yet for this drug in our database. Please rely on your doctor or pharmacist\'s instructions.'
    });
  }

  res.json({ found: true, ...rows[0] });
});

module.exports = router;
