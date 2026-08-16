const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // In production, enable SSL and pin the cert.
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : false,
});

module.exports = { pool };
