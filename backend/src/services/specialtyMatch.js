/**
 * ACP Health — Symptom-to-specialty matching
 * =========================================================
 * Keyword-based routing only — this decides which KIND of
 * doctor to offer (cardiologist vs dermatologist vs GP), not
 * what's wrong with the patient. The doctor still does the
 * actual diagnosis. Draft mapping — a clinician should review
 * and expand this before real use, same as the triage rules.
 * =========================================================
 */

const SPECIALTY_KEYWORDS = [
  { specialty: 'Cardiology', keywords: ['chest pain', 'chest tightness', 'palpitations', 'heart racing', 'irregular heartbeat'] },
  { specialty: 'Dermatology', keywords: ['rash', 'skin', 'itchy patch', 'mole', 'acne', 'hives'] },
  { specialty: 'Pediatrics', keywords: ['my child', 'my son', 'my daughter', 'infant', 'toddler'] },
  { specialty: 'Mental Health', keywords: ['anxious', 'anxiety', 'panic attack', 'depressed', 'depression', "can't sleep", 'insomnia', 'overwhelmed'] },
  { specialty: 'ENT', keywords: ['sore throat', 'ear pain', 'earache', 'sinus', 'hearing', 'nasal congestion'] },
  { specialty: 'Gastroenterology', keywords: ['stomach pain', 'nausea', 'vomiting', 'diarrhea', 'abdominal pain', 'bloating'] },
  { specialty: 'Respiratory', keywords: ['cough', 'wheezing', 'shortness of breath', 'difficulty breathing'] },
];

/**
 * @param {string} primarySymptom — free text from the intake conversation
 * @returns {string} specialty — falls back to 'Family Medicine' if nothing matches
 */
function matchSpecialty(primarySymptom) {
  const text = (primarySymptom || '').toLowerCase();
  for (const entry of SPECIALTY_KEYWORDS) {
    if (entry.keywords.some(kw => text.includes(kw))) return entry.specialty;
  }
  return 'Family Medicine';
}

module.exports = { matchSpecialty, SPECIALTY_KEYWORDS };
