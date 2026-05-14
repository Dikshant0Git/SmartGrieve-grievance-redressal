/**
 * cityContextController.js
 * ========================
 * The nerve centre of Smartgrieve's geographic and civic intelligence.
 *
 * This module does three things:
 *   1. RESOLUTION  — Takes raw grievance text and resolves it to a specific
 *                    ward, zone, coordinates, and department using the city
 *                    constitution JSON as ground truth.
 *   2. ENRICHMENT  — Builds a structured context block that is injected into
 *                    the Gemini prompt so the AI classifies with full civic
 *                    awareness of Bhopal's actual geography.
 *   3. MAP OUTPUT  — Produces a clean payload for the Leaflet heatmap and
 *                    marker system, so the frontend can place a pin the moment
 *                    a grievance is resolved.
 *
 * Design principle: Every lookup is deterministic and O(n) or better.
 * No external API calls. No async operations. This runs synchronously
 * inside the intake worker, before the Gemini call, so it must be fast.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Load Constitution Once ──────────────────────────────────────────────────
// We load the JSON at module initialisation time (when the worker starts),
// not on every grievance. This means disk I/O happens once, not thousands
// of times. If the file is malformed, we crash early and loudly — far better
// than silently failing during a live demo.

const CONSTITUTION_PATH = path.resolve(__dirname, '../config/city-context.json');

let city;
try {
  city = JSON.parse(fs.readFileSync(CONSTITUTION_PATH, 'utf8'));
  console.log(`✅ City constitution loaded: ${city.city_metadata.city}, ${city.city_metadata.total_zones} zones, ${city.city_metadata.total_wards} wards.`);
} catch (err) {
  console.error('❌ FATAL: city-context.json could not be loaded.', err.message);
  process.exit(1); // Hard fail — the system cannot operate without this
}

// ─── Pre-build Lookup Indexes at Startup ─────────────────────────────────────
// Rather than scanning every ward and landmark on every grievance, we build
// flat lookup maps once. This turns O(n) scans into O(1) hash lookups.

/**
 * wardByNumber: { 50: wardObject, 51: wardObject, ... }
 * Used when user directly mentions a ward number.
 */
const wardByNumber = {};
for (const ward of city.wards) {
  wardByNumber[ward.ward_number] = ward;
}

/**
 * wardByAlias: { "mp nagar": wardObject, "db mall area": wardObject, ... }
 * Built from ward_name, area, and all aliases (lowercased for fuzzy match).
 */
const wardByAlias = {};
for (const ward of city.wards) {
  const keys = [
    ward.ward_name,
    ward.area,
    ...(ward.aliases || [])
  ];
  for (const key of keys) {
    if (key) wardByAlias[key.toLowerCase().trim()] = ward;
  }
}

/**
 * landmarkByAlias: { "db mall": landmarkObject, "db city": landmarkObject, ... }
 * Landmarks take priority over wards in resolution because they are more
 * specific (coordinate-level precision vs centroid-level precision).
 */
const landmarkByAlias = {};
for (const lm of city.landmarks) {
  const keys = [lm.name, ...(lm.aliases || [])];
  for (const key of keys) {
    if (key) landmarkByAlias[key.toLowerCase().trim()] = lm;
  }
}

/**
 * zoneById: { 1: zoneObject, 2: zoneObject, ... }
 */
const zoneById = {};
for (const zone of city.zones) {
  zoneById[zone.zone_id] = zone;
}

/**
 * slangMap: { "kachra": "Garbage/Solid Waste (Sanitation Department)", ... }
 * Pre-lowercased for fast lookup.
 */
const slangMap = {};
for (const [slang, meaning] of Object.entries(city.city_metadata.local_slang_dictionary)) {
  slangMap[slang.toLowerCase()] = meaning;
}

console.log(`   → Indexes built: ${Object.keys(wardByAlias).length} ward aliases, ${Object.keys(landmarkByAlias).length} landmark aliases.`);


// ─── Core Public API ──────────────────────────────────────────────────────────

/**
 * resolveLocation(text)
 * ---------------------
 * The most important function in this module. Given raw grievance text,
 * it returns the best available location resolution, in descending order
 * of precision:
 *
 *   Priority 1: Landmark match (most precise — actual GPS coordinates)
 *   Priority 2: Ward name / alias match (centroid coordinates)
 *   Priority 3: Zone name match (zone centroid — least precise)
 *   Priority 4: null (unresolved — human review required)
 *
 * @param {string} text - Raw grievance text from the user
 * @returns {LocationResult}
 */
function resolveLocation(text) {
  if (!text || typeof text !== 'string') return _unresolvedLocation();

  const lower = text.toLowerCase();

  // ── Priority 1: Landmark match ──
  // We iterate over all landmark aliases and return on the FIRST match.
  // Landmarks are more precise than wards, so they win.
  for (const [alias, landmark] of Object.entries(landmarkByAlias)) {
    if (lower.includes(alias)) {
      const zone  = zoneById[landmark.zone_id];
      const ward  = wardByNumber[landmark.ward_number];
      return {
        resolved:          true,
        resolution_method: 'landmark',
        precision:         'HIGH',          // Actual GPS coordinates
        landmark_name:     landmark.name,
        coordinates:       landmark.coordinates,
        zone_id:           landmark.zone_id,
        zone_name:         zone?.zone_name  || null,
        ward_number:       landmark.ward_number,
        ward_name:         ward?.ward_name  || null,
        area:              ward?.area       || null,
        priority_modifier: landmark.priority_modifier || null,
        leaflet_marker: {
          lat:     landmark.coordinates[0],
          lng:     landmark.coordinates[1],
          tooltip: landmark.name,
          zone_id: landmark.zone_id,
          ward:    landmark.ward_number,
        },
      };
    }
  }

  // ── Priority 2: Direct ward number mention ──
  // Citizens sometimes say "Ward 50 mein kachra nahi utha".
  const wardNumberMatch = lower.match(/ward\s*(?:no\.?\s*|number\s*)?(\d{1,2})/i);
  if (wardNumberMatch) {
    const num  = parseInt(wardNumberMatch[1], 10);
    const ward = wardByNumber[num];
    if (ward) {
      const zone = zoneById[ward.zone_id];
      return _wardToResult(ward, zone, 'ward_number_direct', 'MEDIUM');
    }
  }

  // ── Priority 3: Ward alias match ──
  // We try each alias from longest to shortest to avoid a short alias
  // ("E-5") matching before a more specific one ("E-5 Arera Colony").
  const sortedAliases = Object.keys(wardByAlias).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    if (lower.includes(alias)) {
      const ward = wardByAlias[alias];
      const zone = zoneById[ward.zone_id];
      return _wardToResult(ward, zone, 'ward_alias', 'MEDIUM');
    }
  }

  // ── Priority 4: Zone name match ──
  // Least precise — gives us a city zone centroid.
  for (const zone of city.zones) {
    if (lower.includes(zone.zone_name.toLowerCase())) {
      return {
        resolved:          true,
        resolution_method: 'zone_name',
        precision:         'LOW',           // Zone centroid only
        landmark_name:     null,
        coordinates:       zone.centroid,
        zone_id:           zone.zone_id,
        zone_name:         zone.zone_name,
        ward_number:       null,
        ward_name:         null,
        area:              zone.zone_name,
        priority_modifier: null,
        leaflet_marker: {
          lat:     zone.centroid[0],
          lng:     zone.centroid[1],
          tooltip: `Zone ${zone.zone_id}: ${zone.zone_name}`,
          zone_id: zone.zone_id,
          ward:    null,
        },
      };
    }
  }

  // ── Unresolved ──
  return _unresolvedLocation();
}


/**
 * resolveDepartments(text)
 * ------------------------
 * Scans grievance text against every department's keyword list and returns
 * all matching departments, ranked by keyword hit count.
 *
 * Why count hits rather than return on first match? Because a message like
 * "paani nahi hai aur naali bhi bhari hai" matches both Water_Supply and
 * Sanitation. We want both, with the stronger match ranked first.
 *
 * @param {string} text
 * @returns {Array<DepartmentMatch>}
 */
function resolveDepartments(text) {
  if (!text || typeof text !== 'string') return [];

  const lower   = text.toLowerCase();
  const matches = [];

  for (const [deptName, dept] of Object.entries(city.departments)) {
    let hitCount = 0;
    const hitKeywords = [];

    for (const keyword of (dept.keywords || [])) {
      if (lower.includes(keyword.toLowerCase())) {
        hitCount++;
        hitKeywords.push(keyword);
      }
    }

    if (hitCount > 0) {
      matches.push({
        department_name: deptName,
        department_id:   dept.id,
        agency:          dept.agency,
        assigned_role:   dept.assigned_role,
        priority_logic:  dept.priority_logic,
        contact:         dept.contact_escalation,
        hit_count:       hitCount,
        matched_keywords: hitKeywords,
      });
    }
  }

  // Sort by number of keyword matches descending — strongest match first
  return matches.sort((a, b) => b.hit_count - a.hit_count);
}


/**
 * resolveSlang(text)
 * ------------------
 * Translates Bhopal-specific slang terms found in the text into their
 * civic/official equivalents. Returns only the slang words actually found,
 * not the entire dictionary.
 *
 * This is injected into the Gemini prompt so the model understands that
 * "khadda" means pothole, not just a generic Hindi word.
 *
 * @param {string} text
 * @returns {Array<{slang: string, meaning: string}>}
 */
function resolveSlang(text) {
  if (!text || typeof text !== 'string') return [];

  const lower = text.toLowerCase();
  const found = [];

  for (const [slang, meaning] of Object.entries(slangMap)) {
    // Avoid matching greeting slang — those are spam filter signals, not content
    if (meaning.toLowerCase().includes('ignore')) continue;
    if (lower.includes(slang)) {
      found.push({ slang, meaning });
    }
  }

  return found;
}


/**
 * checkEmergencyKeywords(text)
 * ----------------------------
 * Scans for auto-CRITICAL emergency keywords. If ANY match, this grievance
 * must bypass the 30-second bundle window and go to the front of the queue.
 *
 * This runs BEFORE Gemini — it is a pure string check with zero latency.
 *
 * @param {string} text
 * @returns {{ isEmergency: boolean, matchedKeywords: string[] }}
 */
function checkEmergencyKeywords(text) {
  if (!text || typeof text !== 'string') return { isEmergency: false, matchedKeywords: [] };

  const lower   = text.toLowerCase();
  const matched = [];

  for (const kw of city.emergency_escalation_rules.auto_critical_keywords) {
    if (lower.includes(kw.toLowerCase())) {
      matched.push(kw);
    }
  }

  return { isEmergency: matched.length > 0, matchedKeywords: matched };
}


/**
 * checkChronicIssue(text)
 * -----------------------
 * Detects phrases that indicate a long-standing, unresolved complaint.
 * Chronic issues should be flagged and their priority elevated by one level,
 * because citizens escalating to WhatsApp means the official channels have
 * already failed them.
 *
 * @param {string} text
 * @returns {{ isChronic: boolean, triggerPhrase: string|null }}
 */
function checkChronicIssue(text) {
  if (!text || typeof text !== 'string') return { isChronic: false, triggerPhrase: null };

  const lower = text.toLowerCase();
  for (const phrase of city.system_rules.chronic_issue_flag.trigger_phrases) {
    if (lower.includes(phrase.toLowerCase())) {
      return { isChronic: true, triggerPhrase: phrase };
    }
  }
  return { isChronic: false, triggerPhrase: null };
}


/**
 * checkSpam(text, hasMedia)
 * -------------------------
 * Applies the constitution's spam rules deterministically.
 * Returns a reason string if the message should be rejected, or null if clean.
 *
 * This is called BEFORE department resolution or Gemini — spam costs nothing.
 *
 * @param {string} text
 * @param {boolean} hasMedia - true if image or voice note is attached
 * @returns {{ isSpam: boolean, reason: string|null }}
 */
function checkSpam(text, hasMedia = false) {
  if (!text || typeof text !== 'string') {
    // A media-only message (no text at all) is valid — the media contains the complaint
    if (hasMedia) return { isSpam: false, reason: null };
    return { isSpam: true, reason: 'empty_message' };
  }

  const trimmed   = text.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  // Rule: too short and no media
  if (wordCount < 4 && !hasMedia) {
    // But check if those few words contain a known emergency keyword
    const { isEmergency } = checkEmergencyKeywords(trimmed);
    if (!isEmergency) {
      return { isSpam: true, reason: 'too_short_no_media' };
    }
  }

  // Rule: only numeric content (phone numbers, test strings)
  if (/^[\d\s+\-()]+$/.test(trimmed)) {
    return { isSpam: true, reason: 'numeric_only' };
  }

  // Rule: only greeting slang from dictionary (messages marked 'ignore')
  const lower = trimmed.toLowerCase();
  const greetingSlang = Object.entries(city.city_metadata.local_slang_dictionary)
    .filter(([, meaning]) => meaning.toLowerCase().includes('ignore'))
    .map(([slang]) => slang.toLowerCase());

  // If the entire message, after removing greeting words, is empty → spam
  let remainingText = lower;
  for (const greeting of greetingSlang) {
    remainingText = remainingText.replace(new RegExp(greeting, 'g'), '').trim();
  }
  if (remainingText.length < 5 && !hasMedia) {
    return { isSpam: true, reason: 'greeting_only' };
  }

  return { isSpam: false, reason: null };
}


/**
 * getSensitiveZoneModifiers(coordinates)
 * ---------------------------------------
 * Given a resolved [lat, lng] coordinate pair, checks whether those
 * coordinates fall within any of the constitution's sensitive zones
 * (ecological, medical, VIP, environmental). Returns any applicable
 * escalation rules and priority overrides.
 *
 * This is what makes the system context-aware at the city-map level —
 * a garbage complaint near Hamidia Hospital is not the same severity
 * as one in the middle of a residential colony.
 *
 * @param {[number, number]|null} coordinates
 * @returns {Array<SensitiveZoneMatch>}
 */
function getSensitiveZoneModifiers(coordinates) {
  if (!coordinates) return [];

  const [lat, lng] = coordinates;
  const matches    = [];

  for (const zone of city.sensitive_zones) {
    const [cLat, cLng]   = zone.center;
    const distanceMeters = _haversineMeters(lat, lng, cLat, cLng);

    if (distanceMeters <= zone.radius_meters) {
      matches.push({
        zone_type:        zone.type,
        zone_name:        zone.name,
        distance_meters:  Math.round(distanceMeters),
        rule:             zone.rule,
        // If inside a sensitive zone, always force HIGH priority minimum
        force_min_priority: 'HIGH',
      });
    }
  }

  return matches;
}


/**
 * buildGeminiContext(text, hasMedia)
 * -----------------------------------
 * The master function. Called once per grievance, it runs all of the above
 * resolvers and assembles two things:
 *
 *   1. A structured `enrichedData` object — stored in MongoDB alongside the
 *      grievance for dashboard display, heatmap rendering, and analytics.
 *
 *   2. A `promptContext` string — injected directly into the Gemini system
 *      prompt so the model classifies with full knowledge of Bhopal's civic
 *      geography, without you having to dump the entire JSON into the prompt.
 *
 * This is the RAG (Retrieval Augmented Generation) layer. The constitution
 * is the knowledge base; this function does the retrieval; Gemini does the
 * generation. Clean separation of concerns.
 *
 * @param {string} text       - Grievance text (may include transcription from STT)
 * @param {boolean} hasMedia  - Whether an image or audio is attached
 * @returns {{ enrichedData: object, promptContext: string, leafletPayload: object }}
 */
function buildGeminiContext(text, hasMedia = false) {
  // Run all resolvers
  const location          = resolveLocation(text);
  const departments       = resolveDepartments(text);
  const slang             = resolveSlang(text);
  const emergency         = checkEmergencyKeywords(text);
  const chronic           = checkChronicIssue(text);
  const sensitiveZones    = location.resolved
    ? getSensitiveZoneModifiers(location.coordinates)
    : [];

  // ── Structured enriched data (for MongoDB + dashboard) ──
  const enrichedData = {
    city:            city.city_metadata.city,
    location,
    departments,
    slang_detected:  slang,
    is_emergency:    emergency.isEmergency,
    emergency_keywords: emergency.matchedKeywords,
    is_chronic:      chronic.isChronic,
    chronic_trigger: chronic.triggerPhrase,
    sensitive_zones: sensitiveZones,
    resolution_confidence: _calculateResolutionConfidence(location, departments),
  };

  // ── Leaflet map payload (for real-time heatmap marker) ──
  // This is what your frontend Leaflet controller consumes directly.
  // It knows the lat/lng, the ward, the zone, and the department colour coding.
  const leafletPayload = location.resolved ? {
    lat:          location.leaflet_marker.lat,
    lng:          location.leaflet_marker.lng,
    tooltip:      location.leaflet_marker.tooltip,
    zone_id:      location.leaflet_marker.zone_id,
    ward_number:  location.leaflet_marker.ward,
    precision:    location.precision,
    is_emergency: emergency.isEmergency,
    is_chronic:   chronic.isChronic,
    department:   departments[0]?.department_name || 'Unknown',
    // Leaflet circle radius is larger for low-precision fixes (zone centroid)
    // and smaller for landmark-level precision. This gives the viewer a visual
    // sense of location certainty.
    marker_radius_meters: location.precision === 'HIGH' ? 150 : location.precision === 'MEDIUM' ? 400 : 800,
    // Colour for the Leaflet circle marker — red for emergency, orange for chronic, blue default
    marker_color: emergency.isEmergency ? '#FF2D2D' : chronic.isChronic ? '#FF8C00' : '#1E90FF',
  } : null;

  // ── Gemini prompt context string ──
  // This is carefully structured so Gemini reads it as instructions, not data.
  // The most operationally critical information (location, emergency, department)
  // appears FIRST. General city information appears LAST.
  const promptContext = _buildPromptString(enrichedData, text);

  return { enrichedData, promptContext, leafletPayload };
}


// ─── Private Helpers ──────────────────────────────────────────────────────────

function _wardToResult(ward, zone, method, precision) {
  return {
    resolved:          true,
    resolution_method: method,
    precision,
    landmark_name:     null,
    coordinates:       ward.centroid,
    zone_id:           ward.zone_id,
    zone_name:         zone?.zone_name || null,
    ward_number:       ward.ward_number,
    ward_name:         ward.ward_name,
    area:              ward.area,
    priority_modifier: null,
    leaflet_marker: {
      lat:     ward.centroid[0],
      lng:     ward.centroid[1],
      tooltip: `Ward ${ward.ward_number}: ${ward.ward_name}`,
      zone_id: ward.zone_id,
      ward:    ward.ward_number,
    },
  };
}

function _unresolvedLocation() {
  return {
    resolved:          false,
    resolution_method: 'none',
    precision:         'NONE',
    landmark_name:     null,
    coordinates:       null,
    zone_id:           null,
    zone_name:         null,
    ward_number:       null,
    ward_name:         null,
    area:              null,
    priority_modifier: null,
    leaflet_marker:    null,
  };
}

/**
 * Haversine formula — calculates straight-line distance between two
 * GPS coordinates in metres. Used for sensitive zone proximity checks.
 */
function _haversineMeters(lat1, lng1, lat2, lng2) {
  const R   = 6371000; // Earth radius in metres
  const φ1  = lat1 * Math.PI / 180;
  const φ2  = lat2 * Math.PI / 180;
  const Δφ  = (lat2 - lat1) * Math.PI / 180;
  const Δλ  = (lng2 - lng1) * Math.PI / 180;
  const a   = Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
 * Calculates how confident we are in the overall resolution.
 * Used to decide whether to send to Gemini, flag for manual review,
 * or proceed with full confidence.
 */
function _calculateResolutionConfidence(location, departments) {
  let score = 0;
  // Location contributes up to 0.6
  if (location.precision === 'HIGH')   score += 0.60;
  if (location.precision === 'MEDIUM') score += 0.40;
  if (location.precision === 'LOW')    score += 0.20;
  // Departments contribute up to 0.4
  if (departments.length > 0) score += 0.25;
  if (departments.length > 1) score += 0.15; // Multi-department hit adds confidence
  return Math.min(score, 1.0);
}

/**
 * Builds the actual string that gets injected into the Gemini system prompt.
 * Format is chosen to be read as natural instructions, not JSON data.
 * Gemini responds much better to prose-format context than raw structured data.
 */
function _buildPromptString(enrichedData, originalText) {
  const lines = [];

  lines.push('=== SMARTGRIEVE CITY INTELLIGENCE CONTEXT ===');
  lines.push(`City: Bhopal, Madhya Pradesh | Governed by: BMC | Total Zones: 14 | Total Wards: 85`);
  lines.push('');

  // Emergency flag — appears at the very top so Gemini never misses it
  if (enrichedData.is_emergency) {
    lines.push(`🚨 EMERGENCY ALERT: The message contains emergency keywords: [${enrichedData.emergency_keywords.join(', ')}]`);
    lines.push('   → Set isEmergency: true. Set severity: "Critical". Route to emergency departments immediately.');
    lines.push('');
  }

  // Chronic issue flag
  if (enrichedData.is_chronic) {
    lines.push(`⚠️  CHRONIC ISSUE DETECTED: Trigger phrase found: "${enrichedData.chronic_trigger}"`);
    lines.push('   → This may be a repeat/unresolved complaint. Elevate priority by one level. Note as chronic.');
    lines.push('');
  }

  // Location resolution result
  lines.push('--- LOCATION RESOLUTION ---');
  if (enrichedData.location.resolved) {
    lines.push(`Resolution Method : ${enrichedData.location.resolution_method} (Precision: ${enrichedData.location.precision})`);
    if (enrichedData.location.landmark_name) {
      lines.push(`Resolved Landmark : ${enrichedData.location.landmark_name}`);
    }
    lines.push(`Ward              : ${enrichedData.location.ward_number || 'N/A'} — ${enrichedData.location.ward_name || 'N/A'}`);
    lines.push(`Zone              : ${enrichedData.location.zone_id || 'N/A'} — ${enrichedData.location.zone_name || 'N/A'}`);
    lines.push(`Area Description  : ${enrichedData.location.area || 'N/A'}`);
    lines.push(`GPS Coordinates   : [${enrichedData.location.coordinates?.join(', ')}]`);
    if (enrichedData.location.priority_modifier) {
      lines.push(`Priority Rule     : ${enrichedData.location.priority_modifier}`);
    }
  } else {
    lines.push('Location: UNRESOLVED — no landmark, ward, zone, or alias detected in the message text.');
    lines.push('   → Set resolvedLocation: null. Set ward: null. Request location clarification in your reply.');
  }
  lines.push('');

  // Sensitive zone warnings
  if (enrichedData.sensitive_zones.length > 0) {
    lines.push('--- SENSITIVE ZONE WARNINGS ---');
    for (const sz of enrichedData.sensitive_zones) {
      lines.push(`⚠️  ${sz.zone_type}: ${sz.zone_name} (${sz.distance_meters}m from complaint location)`);
      lines.push(`   Rule: ${sz.rule}`);
    }
    lines.push('');
  }

  // Department matches
  lines.push('--- DEPARTMENT INTELLIGENCE ---');
  if (enrichedData.departments.length > 0) {
    lines.push(`Matched Departments (ranked by relevance):`);
    for (const dept of enrichedData.departments) {
      lines.push(`  • ${dept.department_name} [${dept.department_id}] | Agency: ${dept.agency}`);
      lines.push(`    Matched keywords: ${dept.matched_keywords.join(', ')}`);
      lines.push(`    Priority rule: ${dept.priority_logic}`);
      lines.push(`    Contact: ${dept.contact}`);
    }
  } else {
    lines.push('No department keywords matched. Use grievance text context to determine best department.');
  }
  lines.push('');

  // Slang translations
  if (enrichedData.slang_detected.length > 0) {
    lines.push('--- LOCAL SLANG TRANSLATIONS ---');
    lines.push('The following Bhopal-specific terms were detected in the message:');
    for (const s of enrichedData.slang_detected) {
      lines.push(`  "${s.slang}" → ${s.meaning}`);
    }
    lines.push('');
  }

  lines.push('=== END OF CONTEXT ===');
  lines.push('');
  lines.push('Using ALL of the above intelligence, now classify the grievance below:');
  lines.push('---');

  return lines.join('\n');
}


// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Primary API — use this in your intake worker and Intelligence Agent
  buildGeminiContext,

  // Individual resolvers — available for unit testing or standalone use
  resolveLocation,
  resolveDepartments,
  resolveSlang,
  checkEmergencyKeywords,
  checkChronicIssue,
  checkSpam,
  getSensitiveZoneModifiers,

  // Expose raw constitution for any module that needs reference data
  // (e.g. a dashboard API endpoint that lists all wards)
  city,
  wardByNumber,
  zoneById,
};