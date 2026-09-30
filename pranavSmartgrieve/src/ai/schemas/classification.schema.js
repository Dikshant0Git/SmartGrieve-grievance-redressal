/**
 * Classification Schema — Zod definition for structured AI output
 *
 * Matches the existing OUTPUT_SCHEMA in intelligence.agent.js with additions:
 *   - location_text (nullable): AI-extracted location string
 *   - location_evidence (nullable): verbatim quote from user text
 *   - missing_fields (string[]): fields the AI couldn't determine
 *
 * The model returns severity only; priority is derived in code by derivePriority().
 */

const { z } = require('zod');

const ClassificationSchema = z.object({
    category: z.enum([
        'Sanitation', 'Roads', 'Water', 'Electricity', 'Health',
        'Transport', 'Housing', 'Land', 'Corruption', 'Other', 'Rejected'
    ]).describe('Primary civic category for this complaint.'),

    subCategory: z.string().describe('More specific sub-category, e.g. "Pothole", "Garbage Dump".'),

    departmentId: z.string().describe('Department code: MUNC, ELEC, HLTH, TRNS, REVN, or GENL.'),

    assignedAgency: z.string().describe('Agency name, e.g. "Bhopal Municipal Corporation".'),

    resolvedLocation: z.string().nullable().describe('Resolved landmark or area name, or null if unknown.'),

    wardNumber: z.number().int().nullable().describe('Ward number (1-85) or null.'),

    wardName: z.string().nullable().describe('Ward name or null.'),

    zoneId: z.number().int().nullable().describe('Zone ID (1-14) or null.'),

    zoneName: z.string().nullable().describe('Zone name or null.'),

    coordinates: z.array(z.number()).length(2).nullable().describe('[lat, lng] or null.'),

    severity: z.enum(['Low', 'Medium', 'High', 'Critical']).describe('Severity level. Priority is derived from this in code.'),

    isEmergency: z.boolean().describe('True if this is an emergency requiring immediate action.'),

    isChronic: z.boolean().describe('True if this is a long-standing, unresolved issue.'),

    confidence: z.number().min(0).max(1).describe('Classification confidence from 0.0 to 1.0.'),

    reasoning: z.string().describe('Brief explanation of the classification decision.'),

    suggestedReply: z.string().describe('Reply to the citizen in the same language they used.'),

    requiresManualReview: z.boolean().describe('True if confidence is low or category is ambiguous.'),

    estimatedResolutionDays: z.number().int().describe('Estimated days to resolve (1-30).'),

    detectedLanguage: z.enum(['en', 'hi', 'mixed']).describe('Language detected in the complaint.'),

    location_text: z.string().nullable().describe('AI-extracted location string from the complaint text, or null if no location mentioned.'),

    location_evidence: z.string().nullable().describe('Verbatim quote from the citizen text that contains the location reference, or null.'),

    missing_fields: z.array(z.string()).describe('List of fields the AI could not determine, e.g. ["location", "category"].')
});

/**
 * Derive priority (P1-P4) from severity, then optionally escalate one level
 * for emergency or sensitive-zone complaints.
 *
 * Mapping: Critical=P1, High=P2, Medium=P3, Low=P4
 * Escalation: one level higher if isEmergency or hasSensitiveZone
 *
 * @param {string} severity - 'Low' | 'Medium' | 'High' | 'Critical'
 * @param {boolean} isEmergency
 * @param {boolean} hasSensitiveZone
 * @returns {string} 'P1' | 'P2' | 'P3' | 'P4'
 */
function derivePriority(severity, isEmergency = false, hasSensitiveZone = false) {
    const severityToP = {
        'Critical': 'P1',
        'High': 'P2',
        'Medium': 'P3',
        'Low': 'P4'
    };

    let priority = severityToP[severity] || 'P3';

    // Escalate one level if emergency or sensitive zone
    if (isEmergency || hasSensitiveZone) {
        const escalation = { 'P4': 'P3', 'P3': 'P2', 'P2': 'P1', 'P1': 'P1' };
        priority = escalation[priority];
    }

    return priority;
}

/**
 * Validate location_evidence against the original input text.
 * If location_evidence is not a substring of the input text and no EXIF GPS
 * exists, set location to null and add 'location' to missing_fields.
 *
 * @param {Object} result - Parsed classification result
 * @param {string} inputText - Original complaint text
 * @param {boolean} hasExifGps - Whether EXIF GPS data is available
 * @returns {Object} Validated result with location corrections
 */
function validateLocationEvidence(result, inputText, hasExifGps = false) {
    const validated = { ...result };

    if (validated.location_evidence) {
        const isSubstring = inputText.toLowerCase().includes(
            validated.location_evidence.toLowerCase()
        );

        if (!isSubstring && !hasExifGps) {
            validated.location_text = null;
            validated.location_evidence = null;
            validated.resolvedLocation = null;
            validated.coordinates = null;
            validated.wardNumber = null;
            validated.wardName = null;
            validated.zoneId = null;
            validated.zoneName = null;
            if (!validated.missing_fields.includes('location')) {
                validated.missing_fields = [...validated.missing_fields, 'location'];
            }
        }
    } else if (!validated.location_text && !hasExifGps) {
        if (!validated.missing_fields.includes('location')) {
            validated.missing_fields = [...validated.missing_fields, 'location'];
        }
    }

    return validated;
}

module.exports = {
    ClassificationSchema,
    derivePriority,
    validateLocationEvidence
};
