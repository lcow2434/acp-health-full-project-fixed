/**
 * Generate invite codes for the private pilot.
 * Usage: node scripts/generate_invite_code.js "ACPBETA01" 5 "clinician-batch-1"
 *        (code, max_uses, label)
 * Prints the SQL to run, and the raw code to hand out (only shown once).
 */
require('dotenv').config();
const crypto = require('crypto');

const [, , rawCode, maxUses = '1', label = ''] = process.argv;

if (!rawCode) {
  console.error('Usage: node generate_invite_code.js <CODE> [maxUses] [label]');
  process.exit(1);
}

const hash = crypto.createHash('sha256').update(rawCode.trim().toUpperCase()).digest('hex');

console.log('\nRaw code to give the invitee (shown once):', rawCode.toUpperCase());
console.log('\nRun this SQL against your database:\n');
console.log(
  `INSERT INTO invite_codes (code_hash, label, max_uses) VALUES ('${hash}', '${label}', ${Number(maxUses)});`
);
