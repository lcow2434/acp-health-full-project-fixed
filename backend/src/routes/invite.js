const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');

const router = express.Router();

function hashCode(code) {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

// POST /api/invite/redeem { code }
router.post('/redeem', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });

  const codeHash = hashCode(code);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM invite_codes
       WHERE code_hash = $1 AND active = true
         AND uses < max_uses
         AND (expires_at IS NULL OR expires_at > now())
       FOR UPDATE`,
      [codeHash]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Invalid, expired, or exhausted invite code' });
    }

    await client.query(
      `UPDATE invite_codes SET uses = uses + 1 WHERE id = $1`,
      [rows[0].id]
    );

    const userResult = await client.query(
      `INSERT INTO users (role) VALUES ('pilot_user') RETURNING id, role`
    );
    const user = userResult.rows[0];

    await client.query('COMMIT');

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, userId: user.id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
