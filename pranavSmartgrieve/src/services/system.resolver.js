/**
 * SYSTEM RESOLVER — Deterministic Geo-Resolution
 * 
 * Takes a raw location_text string from the Intelligence Agent
 * and performs a STRICT lookup against citycontext.controller.js.
 * 
 * ZERO AI involvement. Every coordinate is guaranteed real.
 */

const cityContext = require('../controllers/citycontext.controller');

/**
 * Resolve a location_text to exact coordinates, zone, and landmark.
 * Adapts cityContext's resolveLocation to the format expected by system.agent.js
 * 
 * @param {string} locationText - Raw location text from the AI (e.g., "MP Nagar", "near DB Mall")
 * @returns {Object} { zone, coordinates, landmark, confidence, resolution_method }
 */
function resolveLocation(locationText) {
    if (!locationText || typeof locationText !== 'string' || locationText.trim() === '') {
        console.log(`📍 [RESOLVER] Empty location_text, returning unresolved.`);
        return {
            zone: null,
            ward: null,
            coordinates: [],
            landmark: null,
            confidence: 0,
            resolution_method: 'unresolved'
        };
    }

    const res = cityContext.resolveLocation(locationText);

    if (!res.resolved) {
        console.log(`📍 [RESOLVER] ❌ No match for: "${locationText}"`);
        return {
            zone: null,
            ward: null,
            coordinates: [],
            landmark: null,
            confidence: 0,
            resolution_method: 'unresolved'
        };
    }

    let confidence = 0;
    if (res.precision === 'HIGH') confidence = 95;
    else if (res.precision === 'MEDIUM') confidence = 80;
    else confidence = 60; // LOW

    // system.agent.js expects a numeric zone ID
    const zone = res.zone_id ? res.zone_id : null; 
    const ward = res.ward_number ? res.ward_number : null;
    
    // Choose the best landmark string
    let landmark = res.landmark_name || res.ward_name || res.zone_name;
    if (res.resolution_method === 'ward_number_direct') {
        landmark = `Ward ${res.ward_number} ${res.ward_name ? '- ' + res.ward_name : ''}`;
    }

    console.log(`📍 [RESOLVER] ✅ Matched: "${locationText}" → ${landmark} [${res.coordinates}] Zone ${res.zone_id}, Ward ${res.ward_number}`);

    return {
        zone,
        ward,
        coordinates: res.coordinates || [],
        landmark,
        confidence,
        resolution_method: res.precision === 'HIGH' ? 'landmark_exact' : 'hub_centroid' // map to existing constants for safety
    };
}

/**
 * Resolve raw GPS coordinates to a zone by finding the nearest zone centroid.
 * Used for EXIF GPS data where we have coords but need the administrative zone.
 * 
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Object} { zone, landmark, distance_m }
 */
function resolveZoneFromCoords(lat, lng) {
    const R = 6371000;
    let minDistance = Infinity;
    let closestZone = null;

    // Use the zoneById export from citycontext.controller.js
    for (const zoneId in cityContext.zoneById) {
        const zone = cityContext.zoneById[zoneId];
        if (!zone.centroid || zone.centroid.length !== 2) continue;

        const [cLat, cLng] = zone.centroid;
        const dLat = (cLat - lat) * Math.PI / 180;
        const dLon = (cLng - lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat * Math.PI / 180) * Math.cos(cLat * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
        const d = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        if (d < minDistance) {
            minDistance = d;
            closestZone = zone;
        }
    }

    if (closestZone) {
        return {
            zone: closestZone.zone_id,
            landmark: `Near ${closestZone.zone_name} (EXIF GPS)`,
            distance_m: Math.round(minDistance)
        };
    }

    return { zone: null, landmark: null, distance_m: Infinity };
}

module.exports = { resolveLocation, resolveZoneFromCoords };
