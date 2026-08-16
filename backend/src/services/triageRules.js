/**
 * ACP Health — Triage Rule Engine
 * =========================================================
 * DRAFT v1 — NOT clinically reviewed. Do not use with real
 * users until a licensed clinician has validated this logic
 * (see ACP_Health_Roadmap_and_Triage_Draft.docx, Section 4).
 *
 * Design principle: this is a plain deterministic function,
 * not an LLM call. The conversational layer's only job is to
 * turn free text into the structured `inputs` object below.
 * The tier decision itself must stay inspectable, testable,
 * and versioned — never a black box.
 * =========================================================
 */

const RULE_VERSION = 'v1-draft-2026-07-01';

const RED_FLAG_KEYWORDS = [
  'chest pain', 'chest tightness', 'can\'t breathe', 'difficulty breathing',
  'severe bleeding', 'unconscious', 'stroke', 'slurred speech', 'face drooping',
  'suicidal', 'seizure', 'severe allergic reaction', 'anaphylaxis'
];

/**
 * @param {object} inputs
 * @param {string} inputs.primarySymptom
 * @param {string} inputs.duration          // e.g. 'today' | '2-3 days' | 'week' | 'more than a week'
 * @param {string} inputs.severity          // e.g. 'mild' | 'moderate' | 'severe' | 'scary'
 * @param {string[]} [inputs.freeTextFlags] // any red-flag phrases the conversational layer detected verbatim
 * @returns {{ tier: 'emergency'|'urgent'|'self_care', ruleVersion: string, reason: string }}
 */
function runTriage(inputs) {
  const symptom = (inputs.primarySymptom || '').toLowerCase();
  const severity = (inputs.severity || '').toLowerCase();
  const flags = (inputs.freeTextFlags || []).map(f => f.toLowerCase());

  // Hard-coded red flags always win, regardless of anything else reported.
  const hasRedFlag =
    RED_FLAG_KEYWORDS.some(kw => symptom.includes(kw) || flags.some(f => f.includes(kw))) ||
    severity.includes('scary') || severity.includes('getting worse fast');

  if (hasRedFlag) {
    return { tier: 'emergency', ruleVersion: RULE_VERSION, reason: 'red_flag_match' };
  }

  if (severity.includes('severe') || severity.includes('moderate')) {
    return { tier: 'urgent', ruleVersion: RULE_VERSION, reason: 'severity_moderate_or_severe' };
  }

  return { tier: 'self_care', ruleVersion: RULE_VERSION, reason: 'no_red_flag_mild_severity' };
}

module.exports = { runTriage, RULE_VERSION, RED_FLAG_KEYWORDS };
