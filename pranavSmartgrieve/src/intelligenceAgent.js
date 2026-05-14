'use strict';

/**
 * intelligenceAgent.js
 * ====================
 * The single Gemini-facing layer of Smartgrieve. This module is the ONLY
 * file in the codebase that calls the Gemini API for grievance processing.
 *
 * It replaces the old RAG service entirely. City intelligence is now sourced
 * exclusively from cityContextController.js, which pre-resolves location,
 * department, slang, emergency flags, and sensitive zones before Gemini
 * ever sees the text.
 *
 * Data flow into this agent:
 *   grievance bundle (text + mediaUrl + hasAudio + hasImage)
 *     → buildGeminiContext()   [cityContextController.js]
 *     → buildSystemPrompt()    [this file]
 *     → callGemini()           [this file]
 *     → parseAndValidate()     [this file]
 *     → enriched result        [returned to AI worker]
 *
 * The agent never reads city-context.json directly.
 * The controller owns the constitution. The agent owns the model conversation.
 */

const {
  buildGeminiContext,
  checkSpam,
  checkEmergencyKeywords,
} = require('./cityContextController');

// Gemini client initialization moved to gemini.service.mjs


// ─── Output Schema Definition ─────────────────────────────────────────────────
// This is the exact JSON shape Gemini must return. It is embedded in the
// system prompt as instructions AND used by parseAndValidate() to check the
// response. If Gemini's output doesn't match this shape, we catch it and
// either retry or fallback gracefully.
//
// Every field has a comment explaining WHY it exists — not just what it is.
// This matters because when you tune the prompt later, you need to know
// the purpose of each field to decide whether to keep, remove, or modify it.

const OUTPUT_SCHEMA = {
  // Primary classification fields
  category:          'string  — the top-level civic department category name from the city constitution',
  subCategory:       'string  — the most specific sub-type of complaint within that category',
  departmentId:      'string  — the dept ID from city constitution e.g. DEPT_SAN_01',
  assignedAgency:    'string  — the full agency name e.g. "BMC Health Department"',

  // Location fields — populated from controller pre-resolution, confirmed by Gemini
  resolvedLocation:  'string | null — official landmark or area name, or null if unresolvable',
  wardNumber:        'number | null — BMC ward number 1-85, or null',
  wardName:          'string | null — official ward name from BMC records, or null',
  zoneId:            'number | null — BMC zone number 1-14, or null',
  zoneName:          'string | null — official zone name, or null',
  coordinates:       '[number, number] | null — [latitude, longitude] pair, or null',

  // Severity and routing
  severity:          '"Low" | "Medium" | "High" | "Critical"',
  isEmergency:       'boolean — true only if immediate danger to life or property',
  isChronic:         'boolean — true if complaint indicates a long-standing unresolved issue',
  priority:          '"P1" | "P2" | "P3" | "P4" — P1 is highest, P4 is lowest',

  // Media content (populated by STT/Vision if present)
  audioTranscription:  'string | null — plain text of voice note content, or null',
  imageDescription:    'string | null — plain text description of image content, or null',

  // AI reasoning (critical for manual review cases)
  confidence:        'number — 0.0 to 1.0, your certainty in this classification',
  reasoning:         'string — one sentence explaining your classification decision in English',

  // Citizen-facing reply
  // This is what gets sent back to the citizen via WhatsApp.
  // Must be in the same language the citizen used (Hindi, Hinglish, or English).
  // Must be polite, brief (1-2 sentences), and confirm receipt with a ticket hint.
  suggestedReply:    'string — WhatsApp reply to citizen in their own language',

  // Flags for downstream systems
  requiresManualReview: 'boolean — true if confidence < threshold or category is Unclassified',
  estimatedResolutionDays: 'number — realistic days to resolve based on severity and category',
};


// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * classifyGrievance(bundle)
 * -------------------------
 * The single entry point for the Intelligence Agent. Called by the AI worker
 * after the bundle timer fires and the grievance is in 'Pending' state.
 *
 * @param {object} bundle
 * @param {string}  bundle.text       - Combined text (user messages joined, STT appended)
 * @param {string}  bundle.phone      - User's phone number (for context only, not sent to Gemini)
 * @param {boolean} bundle.hasImage   - Whether an image is in the bundle
 * @param {boolean} bundle.hasAudio   - Whether a voice note is in the bundle
 * @param {string|null} bundle.mediaUrl  - Path or URL to media file (image or audio)
 * @param {string}  bundle.language   - 'hi' | 'en' | 'mixed' — detected input language
 *
 * @returns {Promise<ClassificationResult>}
 */
async function classifyGrievance(bundle) {
  const { text, hasImage, hasAudio, mediaUrl, language = 'mixed' } = bundle;

  // ── Step 1: Spam guard ──
  // This should already have run in the intake worker, but we double-check here
  // as a safety net. We never call Gemini for spam — it wastes a free-tier slot.
  const spamCheck = checkSpam(text, hasImage || hasAudio);
  if (spamCheck.isSpam) {
    return _buildRejectionResult(spamCheck.reason, bundle);
  }

  // ── Step 2: Build city intelligence context ──
  // This is the controller doing its job — resolving location, departments,
  // slang, emergency flags, sensitive zones, all deterministically.
  // The result has three things we care about:
  //   enrichedData   → we'll store this in MongoDB
  //   promptContext  → we'll inject this into the Gemini system prompt
  //   leafletPayload → we'll send this to the frontend map immediately
  const { enrichedData, promptContext, leafletPayload } = buildGeminiContext(
    text,
    hasImage || hasAudio
  );

  // ── Step 3: Handle media content ──
  // If there's audio or image, we need to feed it to Gemini alongside the text.
  // Gemini 1.5 Flash is multimodal — it can read audio and images natively.
  // We build a parts array that may contain text, image bytes, and/or audio bytes.
  let mediaParts = [];
  if (mediaUrl && (hasImage || hasAudio)) {
    mediaParts = await _buildMediaParts(mediaUrl, hasImage, hasAudio);
  }

  // ── Step 4: Build the full Gemini prompt ──
  const systemPrompt = _buildSystemPrompt(promptContext, language);
  const userMessage  = _buildUserMessage(text, hasImage, hasAudio);

  // ── Step 5: Call Gemini (with retry on failure) ──
  let rawResponse;
  try {
    rawResponse = await _callGeminiWithRetry(systemPrompt, userMessage, mediaParts);
  } catch (err) {
    // If Gemini fails after all retries, we fall back gracefully.
    // The grievance is NOT lost — it gets saved as Unclassified and routed to manual review.
    console.error(`[IntelligenceAgent] Gemini call failed for ${bundle.phone}:`, err.message);
    return _buildFallbackResult(enrichedData, leafletPayload, bundle, err.message);
  }

  // ── Step 6: Parse and validate the response ──
  const parsed = _parseAndValidate(rawResponse, enrichedData);

  // ── Step 7: Apply post-processing rules ──
  // These rules override Gemini's output in cases where the controller has
  // already determined something with certainty. We trust deterministic rules
  // over probabilistic model output for safety-critical decisions.
  const finalResult = _applyPostProcessingRules(parsed, enrichedData, leafletPayload);

  return finalResult;
}


// ─── Prompt Construction ──────────────────────────────────────────────────────

/**
 * _buildSystemPrompt(promptContext, language)
 * -------------------------------------------
 * Builds the complete Gemini system prompt. Structure is deliberately ordered:
 *
 *   Block 1 — Role definition (WHO Gemini is)
 *   Block 2 — Output format contract (WHAT it must return)
 *   Block 3 — City intelligence context (WHAT IT KNOWS about Bhopal)
 *   Block 4 — Classification rules (HOW it should decide)
 *   Block 5 — Language instructions (HOW it should reply to the citizen)
 *
 * Block 2 (output format) appears BEFORE Block 3 (city data) intentionally.
 * If the output format is stated after a large block of city data, the model
 * sometimes loses track of the format requirements. Stating the contract first
 * anchors it in the model's attention throughout the rest of the prompt.
 */
function _buildSystemPrompt(promptContext, language) {
  return `
You are the AI Classification Engine for Smartgrieve — a civic grievance management system
for Bhopal Municipal Corporation (BMC), Madhya Pradesh, India.

Your job is to analyse a citizen's complaint message (which may include voice transcriptions
and image descriptions) and classify it into the civic infrastructure system.

════════════════════════════════════════════════
OUTPUT CONTRACT — READ THIS FIRST
════════════════════════════════════════════════
You MUST return ONLY a single valid JSON object. No markdown fences. No preamble.
No explanation text outside the JSON. If you cannot classify, still return valid JSON
with "category": "Unclassified" and "confidence": 0.

The JSON object must contain exactly these fields:

{
  "category":               string,
  "subCategory":            string,
  "departmentId":           string,
  "assignedAgency":         string,
  "resolvedLocation":       string or null,
  "wardNumber":             number or null,
  "wardName":               string or null,
  "zoneId":                 number or null,
  "zoneName":               string or null,
  "coordinates":            [latitude, longitude] or null,
  "severity":               "Low" | "Medium" | "High" | "Critical",
  "isEmergency":            boolean,
  "isChronic":              boolean,
  "priority":               "P1" | "P2" | "P3" | "P4",
  "audioTranscription":     string or null,
  "imageDescription":       string or null,
  "confidence":             number between 0.0 and 1.0,
  "reasoning":              string (one sentence in English),
  "suggestedReply":         string (in citizen's language),
  "requiresManualReview":   boolean,
  "estimatedResolutionDays": number
}

Priority mapping rule: P1 = Critical/Emergency, P2 = High, P3 = Medium, P4 = Low.

════════════════════════════════════════════════
CITY INTELLIGENCE — PRE-RESOLVED BY SYSTEM
════════════════════════════════════════════════
The system has already analysed the complaint using Bhopal's civic database.
Use this intelligence as ground truth. DO NOT override resolved location coordinates
unless you have strong evidence from the complaint text that they are wrong.

${promptContext}

════════════════════════════════════════════════
CLASSIFICATION RULES
════════════════════════════════════════════════

RULE 1 — LOCATION TRUST HIERARCHY
If the system resolved a landmark → use its wardNumber, wardName, zoneId, coordinates exactly.
If the system resolved a ward → confirm or refine using your own reading of the text.
If location is UNRESOLVED → attempt your own resolution from the text. If still unable, set all location fields to null and set requiresManualReview: true.

RULE 2 — DEPARTMENT ASSIGNMENT
Use the matched departments from the city intelligence context as your primary signal.
The first matched department (highest keyword hit count) is usually correct.
For multi-department complaints (e.g. broken road AND flooding), assign the PRIMARY department
to "departmentId" and mention the secondary in your "reasoning" field.

RULE 3 — SEVERITY ESCALATION
Apply these rules in order, stopping at the first match:
  → CRITICAL if: isEmergency is true, OR complaint is near Hamidia Hospital / AIIMS Bhopal,
    OR involves live electrical wires, OR involves Upper Lake / any water body pollution.
  → HIGH if: complaint is on an arterial road (Hoshangabad Rd, Raisen Rd, Berasia Rd, BRTS),
    OR near DB Mall / Chetak Bridge / any transit hub, OR isChronic is true.
  → MEDIUM if: standard residential complaint with clear department match.
  → LOW if: single-household issue or cosmetic/aesthetic complaint.

RULE 4 — CONFIDENCE AND MANUAL REVIEW
Set requiresManualReview: true if:
  - confidence < 0.65 for any category
  - confidence < 0.80 for "Corruption" or "Administrative" categories
  - category resolves to "Unclassified"
  - location is completely unresolved AND no media provides visual context

RULE 5 — MEDIA HANDLING
If audio transcription is provided: treat it as part of the complaint text.
If image is provided: describe what you see in imageDescription, then use that
description to inform classification (e.g. a photo of a pothole confirms PWD category).
If both text and media conflict: trust the media — citizens sometimes describe things
inaccurately but a photo is direct evidence.

RULE 6 — DO NOT HALLUCINATE
If you cannot determine a field with confidence: return null for that field.
Never invent ward numbers, coordinates, or department names that are not in
the city intelligence context.

════════════════════════════════════════════════
LANGUAGE RULES FOR suggestedReply
════════════════════════════════════════════════
Detected citizen language: ${language === 'hi' ? 'Hindi' : language === 'en' ? 'English' : 'Hinglish (mixed Hindi-English)'}

Rules for the WhatsApp reply to the citizen:
  - Write in the SAME language the citizen used. Hindi complaint → Hindi reply.
  - Keep it to 1-2 sentences maximum.
  - Be warm and reassuring, not bureaucratic.
  - Always confirm the complaint has been registered.
  - For emergencies: include the relevant helpline number (Police: 100, Fire: 101, Ambulance: 108).
  - Do NOT mention internal system details (ward numbers, department IDs, queue status).
  - Good example (Hindi): "आपकी शिकायत दर्ज कर ली गई है। संबंधित विभाग को सूचित कर दिया गया है और जल्द ही कार्रवाई की जाएगी।"
  - Good example (Hinglish): "Aapki complaint register ho gayi hai. Team ko bhej diya gaya hai, jald hi fix hoga."
`.trim();
}


/**
 * _buildUserMessage(text, hasImage, hasAudio)
 * --------------------------------------------
 * Builds the user-turn message. This is kept deliberately simple —
 * all the intelligence is in the system prompt. The user turn is just
 * the raw grievance content.
 */
function _buildUserMessage(text, hasImage, hasAudio) {
  let message = 'CITIZEN COMPLAINT:\n';

  if (text && text.trim()) {
    message += text.trim();
  }

  if (hasImage && !hasAudio) {
    message += '\n\n[An image has been attached. Describe what you see and use it to inform classification.]';
  }

  if (hasAudio && !hasImage) {
    message += '\n\n[A voice note has been attached. Transcribe it, populate audioTranscription, and use it to inform classification.]';
  }

  if (hasImage && hasAudio) {
    message += '\n\n[Both an image and a voice note are attached. Transcribe the audio and describe the image. Use both to classify.]';
  }

  return message;
}


// ─── Gemini API Call ──────────────────────────────────────────────────────────

/**
 * _callGeminiWithRetry(systemPrompt, userMessage, mediaParts)
 * ------------------------------------------------------------
 * Calls the Gemini API with up to 2 retries on transient failures.
 * Uses exponential backoff between retries.
 *
 * We use generateContent (single turn) rather than startChat (multi-turn)
 * because grievance classification is always a single exchange — no
 * conversation history is needed. Single-turn calls are faster and
 * use fewer tokens.
 *
 * Rate limit awareness: We do NOT implement rate limiting here — that is
 * handled by BullMQ's concurrency: 1 setting. This function assumes it
 * has been given the green light to fire.
 */
async function _callGeminiWithRetry(systemPrompt, userMessage, mediaParts, maxRetries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { getGemini15Response } = await import('./services/gemini.service.mjs');
      const responseText = await getGemini15Response(systemPrompt, userMessage, mediaParts);
      if (!responseText || !responseText.trim()) {
        throw new Error('Gemini returned an empty response');
      }

      return responseText;

    } catch (err) {
      lastError = err;
      console.warn(`[IntelligenceAgent] Gemini attempt ${attempt + 1} failed: ${err.message}`);

      // Don't wait after the last attempt
      if (attempt < maxRetries) {
        const backoffMs = 1000 * Math.pow(2, attempt); // 1s, then 2s
        await _sleep(backoffMs);
      }
    }
  }

  throw lastError;
}


// ─── Media Handling ───────────────────────────────────────────────────────────

/**
 * _buildMediaParts(mediaUrl, hasImage, hasAudio)
 * -----------------------------------------------
 * Reads the media file from disk (or eventually from a URL) and converts
 * it into the parts format that Gemini's multimodal API expects.
 *
 * For the hackathon: files live at /tmp/media_<messageId> on disk.
 * Post-hackathon: replace readFileSync with a fetch() call to the S3 URL.
 *
 * Gemini supports these MIME types for audio: audio/ogg, audio/mpeg, audio/wav, audio/webm
 * WhatsApp voice notes arrive as audio/ogg — Gemini handles this natively.
 * WhatsApp images arrive as image/jpeg — Gemini handles this natively.
 */
async function _buildMediaParts(mediaUrl, hasImage, hasAudio) {
  const fs = require('fs');
  const parts = [];

  try {
    // mediaUrl is a file path for hackathon mode, or an https:// URL post-hackathon
    let buffer;

    if (mediaUrl.startsWith('http')) {
      // Post-hackathon: fetch from S3/Cloudinary
      const response = await fetch(mediaUrl);
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      // Hackathon mode: read from /tmp
      buffer = fs.readFileSync(mediaUrl);
    }

    const base64Data = buffer.toString('base64');
    const mimeType   = hasImage ? 'image/jpeg' : 'audio/ogg';

    parts.push({
      inlineData: {
        mimeType,
        data: base64Data,
      },
    });

  } catch (err) {
    // Media read failed — log and continue with text-only classification.
    // Better to classify without the media than to crash the whole job.
    console.error(`[IntelligenceAgent] Could not read media at ${mediaUrl}:`, err.message);
  }

  return parts;
}


// ─── Response Parsing ─────────────────────────────────────────────────────────

/**
 * _parseAndValidate(rawResponse, enrichedData)
 * ---------------------------------------------
 * Parses Gemini's raw text output into a validated JavaScript object.
 *
 * Why do we need this? Because Gemini, despite being told "return only JSON",
 * occasionally wraps the JSON in markdown fences (```json ... ```) or adds
 * a preamble sentence. This function handles all those cases gracefully.
 *
 * After parsing, we apply field-level validation to ensure required fields
 * are present and in the correct format. Missing or malformed fields are
 * filled with safe defaults rather than crashing the worker.
 */
function _parseAndValidate(rawResponse, enrichedData) {
  let parsed;

  try {
    // Step 1: Strip markdown fences if present
    let cleanResponse = rawResponse.trim();
    cleanResponse = cleanResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    // Step 2: Find the JSON object — sometimes Gemini prepends a sentence
    const jsonStart = cleanResponse.indexOf('{');
    const jsonEnd   = cleanResponse.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('No JSON object found in response');
    }

    const jsonString = cleanResponse.slice(jsonStart, jsonEnd + 1);
    parsed = JSON.parse(jsonString);

  } catch (err) {
    console.error('[IntelligenceAgent] Failed to parse Gemini JSON:', err.message);
    console.error('[IntelligenceAgent] Raw response was:', rawResponse?.slice(0, 300));

    // Return a safe Unclassified result rather than crashing
    return _buildUnclassifiedResult(enrichedData, 'json_parse_failure');
  }

  // Step 3: Field-level validation and safe defaults
  // We trust Gemini's values where they exist, but never let a missing or
  // malformed field propagate downstream and crash the DB write or the
  // WhatsApp notification.
  return {
    category:                parsed.category            || 'Unclassified',
    subCategory:             parsed.subCategory         || 'Unknown',
    departmentId:            parsed.departmentId        || enrichedData.departments[0]?.department_id || 'UNKNOWN',
    assignedAgency:          parsed.assignedAgency      || enrichedData.departments[0]?.agency || 'Manual Review Required',

    // For location fields: prefer Gemini's output, but fall back to what the controller resolved.
    // This is important — if Gemini couldn't improve on the controller's resolution, we keep
    // the controller's result rather than losing location data entirely.
    resolvedLocation:        parsed.resolvedLocation    || enrichedData.location.landmark_name || enrichedData.location.area || null,
    wardNumber:              _safeInt(parsed.wardNumber)  ?? enrichedData.location.ward_number  ?? null,
    wardName:                parsed.wardName            || enrichedData.location.ward_name    || null,
    zoneId:                  _safeInt(parsed.zoneId)      ?? enrichedData.location.zone_id      ?? null,
    zoneName:                parsed.zoneName            || enrichedData.location.zone_name    || null,
    coordinates:             _safeCoords(parsed.coordinates) ?? enrichedData.location.coordinates ?? null,

    severity:                _validateEnum(parsed.severity, ['Low','Medium','High','Critical'], 'Medium'),
    isEmergency:             typeof parsed.isEmergency === 'boolean' ? parsed.isEmergency : enrichedData.is_emergency,
    isChronic:               typeof parsed.isChronic   === 'boolean' ? parsed.isChronic   : enrichedData.is_chronic,
    priority:                _validateEnum(parsed.priority, ['P1','P2','P3','P4'], 'P3'),

    audioTranscription:      parsed.audioTranscription  || null,
    imageDescription:        parsed.imageDescription    || null,

    confidence:              typeof parsed.confidence   === 'number'
                               ? Math.max(0, Math.min(1, parsed.confidence))
                               : 0.5,
    reasoning:               parsed.reasoning           || 'Classification performed without explicit reasoning.',
    suggestedReply:          parsed.suggestedReply      || 'Aapki shikayat darj ho gayi hai. Jald hi karyavahi ki jayegi.',
    requiresManualReview:    typeof parsed.requiresManualReview === 'boolean' ? parsed.requiresManualReview : true,
    estimatedResolutionDays: typeof parsed.estimatedResolutionDays === 'number' ? parsed.estimatedResolutionDays : 7,
  };
}


// ─── Post-Processing Rules ────────────────────────────────────────────────────

/**
 * _applyPostProcessingRules(parsed, enrichedData, leafletPayload)
 * ---------------------------------------------------------------
 * Applies deterministic overrides AFTER Gemini's output has been parsed.
 *
 * Think of this as the system having the final say on safety-critical fields.
 * Gemini can be wrong. The controller's deterministic rules cannot be wrong
 * (because they're based on verified geographic and civic data).
 *
 * The principle: Gemini handles ambiguous classification. The system handles
 * certain facts. We never let uncertainty override certainty.
 */
function _applyPostProcessingRules(parsed, enrichedData, leafletPayload) {
  const result = { ...parsed };

  // Rule 1: If the controller detected emergency keywords, isEmergency MUST be true.
  // We do not allow Gemini to override this — emergency detection is safety-critical.
  if (enrichedData.is_emergency) {
    result.isEmergency  = true;
    result.severity     = 'Critical';
    result.priority     = 'P1';
    result.requiresManualReview = true; // Emergencies always get human eyes
  }

  // Rule 2: If a sensitive zone was matched by the controller, enforce minimum priority.
  // A sanitation complaint near Hamidia Hospital MUST be at least HIGH,
  // regardless of what Gemini thought.
  if (enrichedData.sensitive_zones.length > 0) {
    const currentSeverityRank = { Low: 0, Medium: 1, High: 2, Critical: 3 };
    for (const sz of enrichedData.sensitive_zones) {
      if (currentSeverityRank[result.severity] < currentSeverityRank['High']) {
        result.severity = 'High';
        result.priority = result.priority === 'P4' ? 'P3' : result.priority;
        result.reasoning += ` (Severity elevated: within ${sz.zone_name} sensitive zone.)`;
      }
    }
  }

  // Rule 3: If controller resolved location with HIGH precision (landmark-level),
  // and Gemini returned null coordinates, restore the controller's coordinates.
  // We always prefer known good data over null.
  if (!result.coordinates && enrichedData.location.coordinates) {
    result.coordinates = enrichedData.location.coordinates;
    result.wardNumber  = result.wardNumber  || enrichedData.location.ward_number;
    result.wardName    = result.wardName    || enrichedData.location.ward_name;
    result.zoneId      = result.zoneId      || enrichedData.location.zone_id;
    result.zoneName    = result.zoneName    || enrichedData.location.zone_name;
  }

  // Rule 4: Chronic issues always get at least MEDIUM severity and manual review flag.
  if (enrichedData.is_chronic && result.severity === 'Low') {
    result.severity  = 'Medium';
    result.isChronic = true;
    result.requiresManualReview = true;
  }

  // Rule 5: Confidence-based manual review thresholds.
  // These thresholds are intentionally conservative for the hackathon —
  // a confidently wrong automated reply is worse than a slightly slower
  // human-reviewed one.
  const thresholds = {
    'Corruption':     0.85,
    'Administrative': 0.80,
    'Unclassified':   0.00, // Always manual
    '__default__':    0.65,
  };
  const threshold = thresholds[result.category] ?? thresholds['__default__'];
  if (result.confidence < threshold) {
    result.requiresManualReview = true;
  }

  // Attach the Leaflet payload so the AI worker can forward it to the map
  result.leafletPayload     = leafletPayload;

  // Attach enriched city data for MongoDB storage
  result.cityEnrichment     = enrichedData;

  // Timestamp the classification
  result.classifiedAt       = new Date().toISOString();

  return result;
}


// ─── Fallback & Rejection Builders ───────────────────────────────────────────

function _buildFallbackResult(enrichedData, leafletPayload, bundle, errorMessage) {
  return {
    category:                'Unclassified',
    subCategory:             'System Error',
    departmentId:            enrichedData.departments[0]?.department_id || 'UNKNOWN',
    assignedAgency:          'Manual Review Required',
    resolvedLocation:        enrichedData.location.area || null,
    wardNumber:              enrichedData.location.ward_number || null,
    wardName:                enrichedData.location.ward_name || null,
    zoneId:                  enrichedData.location.zone_id || null,
    zoneName:                enrichedData.location.zone_name || null,
    coordinates:             enrichedData.location.coordinates || null,
    severity:                enrichedData.is_emergency ? 'Critical' : 'Medium',
    isEmergency:             enrichedData.is_emergency,
    isChronic:               enrichedData.is_chronic,
    priority:                enrichedData.is_emergency ? 'P1' : 'P3',
    audioTranscription:      null,
    imageDescription:        null,
    confidence:              0.0,
    reasoning:               `Gemini API unavailable: ${errorMessage}. Routed to manual review.`,
    suggestedReply:          'Aapki shikayat darj ho gayi hai. Kuch technical dikkat ke karan processing mein thodi der ho sakti hai. Aapko jald hi jawab milega.',
    requiresManualReview:    true,
    estimatedResolutionDays: 3,
    leafletPayload,
    cityEnrichment:          enrichedData,
    classifiedAt:            new Date().toISOString(),
    _fallbackReason:         errorMessage,
  };
}

function _buildRejectionResult(reason, bundle) {
  const replies = {
    greeting_only:      'Namaste! Smartgrieve civic complaint system mein aapka swagat hai. Kripaya apni samasya batayein (jaise: road tooti hai, bijli nahi hai, kachra nahi utha). Hum turant karyvahi karenge.',
    too_short_no_media: 'Kripaya apni shikayat thodi detail mein batayein — kya samasya hai aur kahan hai. Isse hum jaldi madad kar payenge.',
    numeric_only:       'Yeh message process nahi ho saka. Kripaya apni civic shikayat text mein likhein.',
    empty_message:      'Koi sandesh nahi mila. Kripaya dobara koshish karein.',
  };

  return {
    category:             'Rejected',
    subCategory:          reason,
    isEmergency:          false,
    isChronic:            false,
    confidence:           1.0,
    reasoning:            `Message rejected at spam guard: ${reason}`,
    suggestedReply:       replies[reason] || replies.empty_message,
    requiresManualReview: false,
    _rejected:            true,
    _rejectionReason:     reason,
    classifiedAt:         new Date().toISOString(),
  };
}

function _buildUnclassifiedResult(enrichedData, reason) {
  return {
    category:             'Unclassified',
    subCategory:          reason,
    departmentId:         enrichedData.departments[0]?.department_id || 'UNKNOWN',
    assignedAgency:       'Manual Review Required',
    resolvedLocation:     enrichedData.location.area || null,
    wardNumber:           enrichedData.location.ward_number || null,
    wardName:             enrichedData.location.ward_name || null,
    zoneId:               enrichedData.location.zone_id || null,
    zoneName:             enrichedData.location.zone_name || null,
    coordinates:          enrichedData.location.coordinates || null,
    severity:             'Medium',
    isEmergency:          enrichedData.is_emergency,
    isChronic:            enrichedData.is_chronic,
    priority:             'P3',
    confidence:           0.0,
    reasoning:            `Could not parse Gemini output (${reason}). Manual review required.`,
    suggestedReply:       'Aapki shikayat hamare system mein darj ho gayi hai. Team jald hi aapse sampark karegi.',
    requiresManualReview: true,
    estimatedResolutionDays: 5,
    cityEnrichment:       enrichedData,
    classifiedAt:         new Date().toISOString(),
  };
}


// ─── Utility Helpers ──────────────────────────────────────────────────────────

function _safeInt(value) {
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
}

function _safeCoords(value) {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [lat, lng] = value.map(Number);
  if (isNaN(lat) || isNaN(lng)) return null;
  // Sanity check: Bhopal is roughly at 23.2°N 77.4°E
  // Reject coordinates that are wildly outside Bhopal's bounding box
  if (lat < 23.0 || lat > 23.5 || lng < 77.1 || lng > 77.7) return null;
  return [lat, lng];
}

function _validateEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


module.exports = { classifyGrievance };
