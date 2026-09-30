/**
 * Classify Chain — Single-call classification pipeline
 *
 * Orchestrates: tools (pre-resolve) → prompt build → LLM call → parse → validate
 *
 * Following AI_PATTERN_SPEC.md §5: agent invocation via agent.invoke().
 * Uses ChatOpenAI with withStructuredOutput() for schema enforcement.
 */

const { createLLM } = require('../llm');
const { ClassificationSchema, derivePriority, validateLocationEvidence } = require('../schemas/classification.schema');
const { buildClassifyPrompt, buildClassifyUserMessage } = require('../prompts/classify');
const {
    resolveLocationTool,
    checkEmergencyTool,
    resolveSlangAndDepartmentTool,
    checkDuplicateTool
} = require('../tools/civic.tools');

/**
 * Run the full classification chain.
 *
 * 1. Call all tools (read-only) to gather city intelligence
 * 2. Build prompt with tool context injected
 * 3. Single LLM call with structured output
 * 4. Validate location_evidence against input text
 * 5. Derive priority from severity + emergency/sensitive flags
 * 6. Return result in the exact shape expected by system.agent.js
 *
 * @param {string} text - Enriched complaint text (may include media descriptions)
 * @param {string} originalText - Original raw text (for location_evidence validation)
 * @param {Object} options
 * @param {Object} options.enrichedData - Pre-built enriched data from citycontext
 * @param {Object} options.leafletPayload - Map payload from citycontext
 * @param {string} options.pastContext - Past user history text
 * @param {boolean} options.hasExifGps - Whether EXIF GPS is available
 * @param {Function} [options.llmOverride] - Optional LLM override (for testing)
 * @returns {Object} Classification result matching intelligence.agent.js return shape
 */
async function runClassifyChain(text, originalText, options = {}) {
    const {
        enrichedData,
        leafletPayload,
        pastContext = '',
        hasExifGps = false,
        llmOverride = null
    } = options;

    // ── Step 1: Pre-resolve with tools ──
    const locationResult = resolveLocationTool(text);
    const emergencyResult = checkEmergencyTool(text);
    const slangDeptResult = resolveSlangAndDepartmentTool(text);

    // Duplicate check needs category data, but we don't have it yet.
    // We pass a preliminary check with just the text summary.
    const duplicateResult = await checkDuplicateTool({
        summary: text.substring(0, 200),
        coordinates: locationResult.cityResult?.coordinates || [],
        category: slangDeptResult.departments[0]?.department_name || 'Other'
    });

    // ── Step 2: Build prompt with injected context ──
    const toolContext = {
        locationContext: locationResult.formatted,
        departmentContext: slangDeptResult.departmentFormatted,
        slangContext: slangDeptResult.slangFormatted,
        emergencyContext: emergencyResult.formatted,
        duplicateContext: duplicateResult.formatted
    };

    const systemPrompt = buildClassifyPrompt(toolContext);
    const userMessage = buildClassifyUserMessage(text, pastContext);

    // ── Step 3: LLM call with structured output ──
    const llm = llmOverride || createLLM();
    const structuredLLM = llm.withStructuredOutput(ClassificationSchema);

    let parsed;
    try {
        parsed = await structuredLLM.invoke([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ]);
    } catch (err) {
        console.error(`🧠 [LANGCHAIN] ❌ LLM call failed: ${err.message}`);
        // Return fallback result
        return buildFallbackResult(enrichedData, err.message);
    }

    // ── Step 4: Validate location evidence ──
    const validated = validateLocationEvidence(parsed, originalText, hasExifGps);

    // ── Step 5: Derive priority ──
    const hasSensitiveZone = enrichedData?.sensitive_zones?.length > 0;
    const priority = derivePriority(
        validated.severity,
        validated.isEmergency || emergencyResult.isEmergency,
        hasSensitiveZone
    );

    // ── Step 6: Build return object matching intelligence.agent.js shape ──
    const result = {
        ...validated,
        priority,
        // Backward compatibility fields for system.agent.js
        summary: validated.reasoning,
        location_text: validated.location_text || validated.resolvedLocation || '',
        confidence_score: Math.round(validated.confidence * 100),
        response_message: validated.suggestedReply,
        // Enrichment data
        leafletPayload,
        cityEnrichment: enrichedData,
        classifiedAt: new Date().toISOString(),
        rawAIResponse: JSON.stringify(parsed)
    };

    // Override with emergency/chronic from tool results if needed
    if (emergencyResult.isEmergency) {
        result.isEmergency = true;
        result.severity = 'Critical';
        result.priority = 'P1';
    }
    if (emergencyResult.isChronic) {
        result.isChronic = true;
    }

    console.log(`🧠 [LANGCHAIN] Result → Category: ${result.category}, Priority: ${result.priority}, Location: "${result.location_text}", Confidence: ${result.confidence_score}`);
    return result;
}

/**
 * Build a safe fallback result when the LLM call fails.
 */
function buildFallbackResult(enrichedData, errorMessage) {
    console.error(`🧠 [LANGCHAIN] Fallback triggered: ${errorMessage}`);
    const ed = enrichedData || { departments: [], location: {}, is_emergency: false, is_chronic: false };
    return {
        category: 'Unclassified',
        subCategory: 'System Error',
        departmentId: ed.departments?.[0]?.department_id || 'UNKNOWN',
        assignedAgency: 'Manual Review Required',
        resolvedLocation: ed.location?.area || null,
        wardNumber: ed.location?.ward_number || null,
        wardName: ed.location?.ward_name || null,
        zoneId: ed.location?.zone_id || null,
        zoneName: ed.location?.zone_name || null,
        coordinates: ed.location?.coordinates || null,
        severity: ed.is_emergency ? 'Critical' : 'Medium',
        isEmergency: ed.is_emergency || false,
        isChronic: ed.is_chronic || false,
        priority: ed.is_emergency ? 'P1' : 'P3',
        confidence: 0,
        reasoning: `LLM unavailable: ${errorMessage}. Routed to manual review.`,
        suggestedReply: 'Aapki shikayat darj ho gayi hai. Technical dikkat ke karan thodi der ho sakti hai.',
        requiresManualReview: true,
        estimatedResolutionDays: 3,
        detectedLanguage: 'mixed',
        location_text: ed.location?.area || '',
        location_evidence: null,
        missing_fields: [],
        // Backward compat
        summary: `LLM unavailable: ${errorMessage}`,
        confidence_score: 0,
        response_message: 'Aapki shikayat darj ho gayi hai. Technical dikkat ke karan thodi der ho sakti hai.',
        cityEnrichment: ed,
        classifiedAt: new Date().toISOString(),
        _fallbackReason: errorMessage
    };
}

module.exports = { runClassifyChain, buildFallbackResult };
