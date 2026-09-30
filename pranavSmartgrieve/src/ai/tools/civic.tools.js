/**
 * Tool Wrappers — Read-only wrappers around existing SmartGrieve functions
 *
 * These are called BEFORE the single LLM classification call and their results
 * are injected into the prompt as context. The LLM never writes to the database.
 *
 * Following AI_PATTERN_SPEC.md §2 tool anatomy (name, description, schema).
 */

const cityContext = require('../../controllers/citycontext.controller');
const { resolveLocation } = require('../../services/system.resolver');

/**
 * resolve_location — Deterministic geo-resolution against Bhopal city data
 *
 * @param {string} text - Raw complaint text
 * @returns {Object} Formatted location context for prompt injection
 */
function resolveLocationTool(text) {
    const result = resolveLocation(text);
    const cityResult = cityContext.resolveLocation(text);

    let contextString = '--- LOCATION RESOLUTION ---\n';
    if (cityResult.resolved) {
        contextString += `Resolution: RESOLVED (${cityResult.precision} precision)\n`;
        if (cityResult.landmark_name) contextString += `Landmark: ${cityResult.landmark_name}\n`;
        contextString += `Ward: ${cityResult.ward_number || 'N/A'} — ${cityResult.ward_name || 'N/A'}\n`;
        contextString += `Zone: ${cityResult.zone_id || 'N/A'} — ${cityResult.zone_name || 'N/A'}\n`;
        contextString += `Coordinates: [${cityResult.coordinates?.join(', ')}]\n`;
    } else {
        contextString += 'Location: UNRESOLVED — no landmark, ward, or zone detected.\n';
        contextString += 'Ask the citizen for their exact location in the reply.\n';
    }

    return {
        formatted: contextString,
        raw: result,
        cityResult
    };
}

/**
 * check_emergency — Scans for auto-CRITICAL emergency keywords
 *
 * @param {string} text - Raw complaint text
 * @returns {Object} Emergency context for prompt injection
 */
function checkEmergencyTool(text) {
    const result = cityContext.checkEmergencyKeywords(text);
    const chronic = cityContext.checkChronicIssue(text);

    let contextString = '--- EMERGENCY & CHRONIC STATUS ---\n';
    if (result.isEmergency) {
        contextString += `🚨 EMERGENCY: Keywords detected: [${result.matchedKeywords.join(', ')}]\n`;
        contextString += 'Set severity to Critical. Include emergency helpline numbers in reply.\n';
    } else {
        contextString += 'No emergency keywords detected.\n';
    }

    if (chronic.isChronic) {
        contextString += `⚠️ CHRONIC ISSUE: Trigger phrase "${chronic.triggerPhrase}" detected.\n`;
        contextString += 'Elevate severity by one level.\n';
    }

    return {
        formatted: contextString,
        isEmergency: result.isEmergency,
        matchedKeywords: result.matchedKeywords,
        isChronic: chronic.isChronic,
        chronicTrigger: chronic.triggerPhrase
    };
}

/**
 * resolve_slang_and_department — Translates slang and matches departments
 *
 * @param {string} text - Raw complaint text
 * @returns {Object} Slang + department context for prompt injection
 */
function resolveSlangAndDepartmentTool(text) {
    const slang = cityContext.resolveSlang(text);
    const departments = cityContext.resolveDepartments(text);

    let slangContext = '';
    if (slang.length > 0) {
        slangContext = '--- LOCAL SLANG TRANSLATIONS ---\n';
        for (const s of slang) {
            slangContext += `  "${s.slang}" → ${s.meaning}\n`;
        }
    }

    let deptContext = '--- DEPARTMENT INTELLIGENCE ---\n';
    if (departments.length > 0) {
        deptContext += 'Matched Departments (ranked by relevance):\n';
        for (const dept of departments) {
            deptContext += `  • ${dept.department_name} [${dept.department_id}] | Agency: ${dept.agency}\n`;
            deptContext += `    Matched keywords: ${dept.matched_keywords.join(', ')}\n`;
        }
    } else {
        deptContext += 'No department keywords matched. Use complaint text to determine department.\n';
    }

    return {
        slangFormatted: slangContext,
        departmentFormatted: deptContext,
        slang,
        departments
    };
}

/**
 * check_duplicate — Checks for duplicate complaints (read-only)
 *
 * @param {Object} data - { summary, coordinates, category }
 * @returns {Object} Duplicate context for prompt injection
 */
async function checkDuplicateTool(data) {
    const { checkDuplicate } = require('../../services/duplicate.detector');

    let contextString = '--- DUPLICATE CHECK ---\n';
    try {
        const result = await checkDuplicate(data);
        if (result.isDuplicate) {
            contextString += `⚠️ POSSIBLE DUPLICATE: Similar complaint found (ID: ${result.matchedTicket}).\n`;
            contextString += 'Note this in reasoning but still classify normally.\n';
        } else {
            contextString += 'No duplicate found.\n';
        }
        return { formatted: contextString, ...result };
    } catch (err) {
        contextString += 'Duplicate check unavailable (non-blocking).\n';
        return { formatted: contextString, isDuplicate: false, matchedTicket: null };
    }
}

module.exports = {
    resolveLocationTool,
    checkEmergencyTool,
    resolveSlangAndDepartmentTool,
    checkDuplicateTool
};
