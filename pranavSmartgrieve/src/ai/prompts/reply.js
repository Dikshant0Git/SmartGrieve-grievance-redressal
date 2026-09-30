/**
 * Reply Prompt — Conversational WhatsApp reply
 *
 * Generates a warm, citizen-facing reply that matches their language.
 * If fields are missing, the reply specifically asks for them.
 */

/**
 * Build a reply prompt for generating citizen-facing WhatsApp messages.
 *
 * @param {Object} classification - The classification result
 * @param {string[]} missingFields - Fields that need citizen input
 * @param {string} detectedLanguage - 'en' | 'hi' | 'mixed'
 * @returns {string}
 */
function buildReplyPrompt(classification, missingFields, detectedLanguage) {
    const langInstruction = {
        en: 'Respond in English.',
        hi: 'Respond in Hindi (Devanagari script).',
        mixed: 'Respond in natural Hinglish (mixed Hindi-English as spoken in Bhopal).'
    };

    const missingFieldDescriptions = {
        location: 'exact location (landmark, colony name, or Google Maps pin)',
        category: 'what type of civic issue this is',
        description: 'more details about the problem'
    };

    let missingInstructions = '';
    if (missingFields.length > 0) {
        const asks = missingFields
            .map(f => missingFieldDescriptions[f] || f)
            .join(', ');
        missingInstructions = `\nThe citizen has NOT provided: ${asks}. Ask for this SPECIFICALLY in the reply.\n`;
    }

    return `You are a friendly WhatsApp chatbot for Bhopal Municipal Corporation's Smartgrieve system.
Generate a reply to a citizen who just filed a complaint.

${langInstruction[detectedLanguage] || langInstruction.mixed}
${missingInstructions}
Rules:
- Keep it to 1-2 sentences maximum.
- Be warm and reassuring, not bureaucratic.
- Always confirm the complaint has been received.
- Do NOT mention internal details (ward numbers, department IDs, queue status).
- For emergencies: include helpline (Police: 100, Fire: 101, Ambulance: 108).

Category: ${classification.category}
Severity: ${classification.severity}
Summary: ${classification.reasoning}

Generate the reply now.`.trim();
}

module.exports = { buildReplyPrompt };
