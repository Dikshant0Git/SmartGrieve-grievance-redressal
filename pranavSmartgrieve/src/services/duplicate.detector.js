/**
 * DUPLICATE DETECTOR — Hybrid Dedup Engine
 * 
 * Three-factor check:
 *   1. Text Similarity (Jaccard n-gram) > 0.85
 *   2. Geo Distance (Haversine) < 500m
 *   3. Time Window < 24 hours
 * 
 * All three must pass for a duplicate match.
 */

const Complaint = require('../models/complaint.model');

/**
 * Compute Jaccard similarity between two strings using word-level n-grams.
 */
function jaccardSimilarity(textA, textB) {
    if (!textA || !textB) return 0;

    const setA = new Set(textA.toLowerCase().split(/\s+/));
    const setB = new Set(textB.toLowerCase().split(/\s+/));

    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
}

/**
 * Haversine distance between two [lat, lng] points in meters.
 */
function haversineDistance(coordsA, coordsB) {
    if (!coordsA?.length || !coordsB?.length) return Infinity;

    const [lat1, lon1] = coordsA;
    const [lat2, lon2] = coordsB;

    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Check if a new grievance is a duplicate of recent ones.
 * 
 * @param {Object} newData - { summary, coordinates, category }
 * @returns {Object} { isDuplicate, matchedTicket }
 */
async function checkDuplicate(newData) {
    const result = { isDuplicate: false, matchedTicket: null };

    try {
        // Only check grievances from the last 24 hours in the same category
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const recent = await Complaint.find({
            "ai.category": newData.category,
            status: { $in: ['open', 'under_review', 'review_required'] },
            "flags.isDuplicate": { $ne: true },
            createdAt: { $gte: cutoff }
        }).sort({ createdAt: -1 }).limit(50);

        for (const existing of recent) {
            const similarity = jaccardSimilarity(newData.summary, existing.text || existing.title);
            const distance = haversineDistance(
                newData.coordinates, 
                existing.location?.coordinates || []
            );
            const timeGapHours = (Date.now() - new Date(existing.createdAt).getTime()) / (1000 * 60 * 60);

            if (similarity > 0.85 && distance < 500 && timeGapHours < 24) {
                result.isDuplicate = true;
                result.matchedTicket = existing._id;
                
                console.log(`🔍 [DEDUP] Match found! Similarity: ${(similarity * 100).toFixed(1)}%, Distance: ${distance.toFixed(0)}m, Age: ${timeGapHours.toFixed(1)}h`);
                return result;
            }
        }
    } catch (err) {
        console.error('⚠️ Duplicate detector error:', err.message);
    }

    return result;
}

module.exports = { checkDuplicate, jaccardSimilarity, haversineDistance };
