/**
 * GUARDRAIL AGENT — The Bouncer
 * 
 * Pre-AI filtering using ZERO LLM calls.
 * Handles: Banned check, Spam, Abuse, Hard Emergency detection, Schema normalization.
 * 
 * Returns early with RED tier for junk, saving Gemini API quota.
 * 
 * ORDERING (fail-fast, cheapest checks first):
 *   1. Banned user check (DB)
 *   2. Empty / Too short
 *   3. Pure greeting / Social filler
 *   4. Abuse detection + Strike counter
 *   5. Personal electronics (out-of-scope)
 *   6. Hard emergency flag
 *   7. Normalize → pass to Intelligence Agent
 */

const UserWarning = require('../../models/userWarning.model');
const cityContext = require('../../config/city-context.json');

const slangDict = cityContext.city_metadata.local_slang_dictionary || {};
const greetingSlangs = Object.keys(slangDict).filter(key => 
    slangDict[key].includes("ignore for classification") || 
    slangDict[key].includes("Greeting")
);

const SLANG_GREETINGS_REGEX = greetingSlangs.length > 0 
    ? new RegExp(`\\b(${greetingSlangs.join('|')})\\b`, 'gi')
    : null;

// ─── Regex Patterns ────────────────────────────────────────────────

// Greeting and social filler keywords (will be stripped to check if anything meaningful remains)
const GREETING_AND_FILLER = /\b(hi+|hello+|hey+|bhiya+|ji|sir|madam|maam|namaste|namaskar|good\s?(morning|evening|night|afternoon)|kaise\s?ho|kya\s?haal|sab\s?theek|jai\s?hind|pranam|suprabhat|bhai|yaar|dost|bro|ok(ay)?|theek\s?(hai)?|acch?ha|hmm+|haa+n|nahi+n?|thanks|thankyou|thank\s?you|shukriya|dhanyavaad|bye|tata|chalo|aur\s?batao|kya|haa\s?ji|nahi\s?ji|sorry|maaf|please|pls)\b/gi;

// Status-inquiry without complaint content
const STATUS_INQUIRY = /^\s*(status|update|kya\s?hua|kab\s?hoga|kab\s?tak|kitna\s?time|response\s?do|reply\s?karo|jawab\s?do|koi\s?sunai|sun\s?rahe\s?ho)\s*[!?.,]*\s*$/i;

// Broader abuse catching (removed strict word boundaries for some root words to catch variations like "fucking", "chutiyapa")
const ABUSE_WORDS = /(fuck|shit|asshole|bastard|bitch|chutiya|madarchod|bhenchod|mc|bc|bsdk|gaandu|saal[ea]|harami|kutt[ea]|kamin[ea]|bhosdik[ea]|lodu|randi|bakwas|suar|gadha|idiot|stupid|nonsense)/i;

const HARD_EMERGENCY = /\b(fire|aag|lagi|bleeding|khoon|current|shock|explosion|blast|accident|durghatna|murder|hatya|collapse|drowning|doob|earthquake|bhookamp)\b/i;

const PERSONAL_ELECTRONICS = /\b(alexa|laptop|phone|charger|wifi|router|tv|fridge|washing\s?machine|ac\s?repair|inverter\s?battery|mobile|computer|printer)\b/i;

// ─── Strike Thresholds ────────────────────────────────────────────
const STRIKE_WARNING_THRESHOLD = 8;

// Minimum characters for a meaningful complaint (excluding images)
const MIN_TEXT_LENGTH = 8;

/**
 * Run the Guardrail Agent on a raw grievance document.
 * 
 * @param {Object} doc - The raw Grievance mongoose document
 * @returns {Object} { passed, tier, isEmergency, warningMessage, normalized }
 */
async function run(doc) {
    const text = (doc.finalTextForAI || '').trim();
    const userId = doc.userId;
    const hasImages = doc.media && doc.media.some(m => m.type === 'image' || !m.type);
    const hasVideos = doc.media && doc.media.some(m => m.type === 'video');
    const hasAudio = doc.rawContent && doc.rawContent.some(c => c.includes('[Voice note attached]'));

    const result = {
        passed: false,
        tier: null,           // 'RED' if rejected
        isEmergency: false,
        warningMessage: null, // Message to send back to user
        normalized: null      // Clean payload for Intelligence Agent
    };

    // ─── Step 1: Banned User Check (FIRST — cheapest DB query) ─────
    // Must run before anything else so banned users get zero processing.
    try {
        const existingBan = await UserWarning.findOne({ userId, is_banned: true });
        if (existingBan) {
            result.tier = 'RED';
            result.warningMessage = '🚫 Your account has been suspended from Smartgrieve due to repeated guideline violations.';
            console.log(`🛡️ [GUARDRAIL] Banned user ${userId} blocked at gate.`);
            return result;
        }
    } catch (err) {
        // Non-blocking — if DB is down, let the message through rather than silently dropping it.
        console.error('⚠️ Guardrail: Ban check DB error (non-blocking):', err.message);
    }

    // ─── Step 2: Empty / Too Short ─────────────────────────────────
    // If images or audio are attached, that IS the complaint — don't reject for short text.
    if (text.length < MIN_TEXT_LENGTH && !hasImages && !hasAudio) {
        result.tier = 'RED';
        result.warningMessage = '🛑 Aapka message bahut chhota hai. Kripya apni civic samasya detail mein batayein (e.g., "sadak pe gaddha hai MP Nagar mein").';
        console.log(`🛡️ [GUARDRAIL] Too short (${text.length} chars): "${text}"`);
        return result;
    }

    // ─── Step 3: Pure Greeting / Social Filler ─────────────────────
    // Strip all greeting/filler words and punctuation. If nothing meaningful remains, reject it.
    let textWithoutFiller = text.replace(GREETING_AND_FILLER, '');
    if (SLANG_GREETINGS_REGEX) {
        textWithoutFiller = textWithoutFiller.replace(SLANG_GREETINGS_REGEX, '');
    }
    textWithoutFiller = textWithoutFiller.replace(/[!?.,\s]/g, '');
    
    if (textWithoutFiller.length < 4 && !hasImages && !hasAudio) {
        result.tier = 'RED';
        result.warningMessage = '🛑 Namaste! Yeh Smartgrieve hai — Bhopal ki civic complaint helpline.\n\nKripya apni samasya detail mein batayein (e.g., "Sadak pe gaddha hai", "Kachra nahi utha"). Sirf greeting ya chote messages process nahi honge.';
        console.log(`🛡️ [GUARDRAIL] Greeting/Filler detected (Remaining meaningful chars: ${textWithoutFiller.length}): "${text}"`);
        return result;
    }

    if (STATUS_INQUIRY.test(text)) {
        result.tier = 'RED';
        result.warningMessage = '🛑 Status enquiry ke liye abhi feature available nahi hai. Agar nayi samasya hai toh seedha likhein.';
        console.log(`🛡️ [GUARDRAIL] Status inquiry detected: "${text}"`);
        return result;
    }

    // ─── Step 4: Abuse Detection + Strike Counter ──────────────────
    if (ABUSE_WORDS.test(text)) {
        result.tier = 'RED';

        try {
            const warning = await UserWarning.findOneAndUpdate(
                { userId },
                { 
                    $inc: { abuse_count: 1 },
                    $push: { offenses: { text: text.substring(0, 100) } },
                    $set: { lastWarningAt: new Date() }
                },
                { upsert: true, returnDocument: 'after' }
            );

            const strikes = warning.abuse_count;

            if (strikes >= STRIKE_WARNING_THRESHOLD) {
                // Mark as banned
                await UserWarning.updateOne({ userId }, { $set: { is_banned: true } });
                result.warningMessage = `🚫 *Guideline Violation*\n\nYou have reached ${strikes} abuse strikes. Your account is now suspended from Smartgrieve. Contact the BMC helpline to appeal.`;
                console.log(`🛡️ [GUARDRAIL] User ${userId} BANNED at ${strikes} strikes.`);
            } else {
                result.warningMessage = `🛑 *Warning (${strikes}/${STRIKE_WARNING_THRESHOLD})*\n\nAbusive language is not tolerated. Please restate your civic issue respectfully.\n\n_${STRIKE_WARNING_THRESHOLD - strikes} more violations and your account will be suspended._`;
                console.log(`🛡️ [GUARDRAIL] Abuse strike ${strikes}/${STRIKE_WARNING_THRESHOLD} for ${userId}.`);
            }
        } catch (err) {
            console.error('⚠️ Guardrail: Failed to update abuse counter:', err.message);
            result.warningMessage = '🛑 Abusive language is not tolerated. Please restate your civic issue respectfully.';
        }

        return result;
    }

    // ─── Step 5: Personal Electronics (Out-of-Scope) ───────────────
    // Only reject if there's NO emergency keyword (e.g., "phone mein current laga" is valid)
    if (PERSONAL_ELECTRONICS.test(text) && !HARD_EMERGENCY.test(text)) {
        result.tier = 'RED';
        result.warningMessage = '🛑 Sorry, yeh personal/household issue lagta hai. Smartgrieve sirf civic issues handle karta hai jaise potholes, garbage, traffic, aur electricity.';
        console.log(`🛡️ [GUARDRAIL] Personal electronics detected: "${text}"`);
        return result;
    }

    // ─── Step 6: Hard Emergency Flag ───────────────────────────────
    if (HARD_EMERGENCY.test(text)) {
        result.isEmergency = true;
        console.log(`🛡️ [GUARDRAIL] ⚠️ HARD EMERGENCY flagged in: "${text}"`);
    }

    // ─── All checks passed → Normalize ─────────────────────────────
    result.passed = true;
    result.normalized = {
        text,
        userId,
        source: doc.source,
        ticketId: doc._id.toString().substring(0, 8).toUpperCase(),
        docId: doc._id,
        isEmergency: result.isEmergency,
        hasImage: hasImages,
        hasVideo: hasVideos,
        hasAudio: hasAudio
    };

    console.log(`🛡️ [GUARDRAIL] ✅ PASSED. Emergency: ${result.isEmergency}. Text: "${text.substring(0, 80)}..."`);
    return result;
}

module.exports = { run };
