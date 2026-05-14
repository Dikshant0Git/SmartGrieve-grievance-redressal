const User = require("../models/user.model");
const Complaint = require("../models/complaint.model");

/**
 * ASSIGNMENT SERVICE
 * 
 * Logic to assign a complaint to the most appropriate officer.
 * Features:
 *   1. Workload-based: Pick officer with lowest active complaint count.
 *   2. AI-powered Override: Critical complaints go to highest resolution rate officer.
 *   3. Tie-breaking: Random among tied officers.
 */
class AssignmentService {
    /**
     * Assign an officer to a complaint based on department workload and performance.
     * 
     * @param {Object} complaint - The Complaint mongoose document
     * @returns {Promise<ObjectId|null>} - The ID of the assigned officer or null
     */
    static async getBestOfficer(complaint) {
        const { assignedDept, ai } = complaint;
        const isCritical = ai?.urgency === 'Critical';

        if (!assignedDept) return null;

        try {
            // Fetch all active officers in the department
            const officers = await User.find({
                role: 'officer',
                department: assignedDept,
                isActive: true
            }).select('_id name performanceStats');

            if (!officers.length) {
                console.warn(`⚠️ [ASSIGN] No active officers found for department ${assignedDept}`);
                return null;
            }

            // ─── AI OVERRIDE FOR CRITICAL COMPLAINTS ───
            if (isCritical) {
                console.log(`🔥 [ASSIGN] Critical complaint detected. Searching for top performer in ${assignedDept}...`);
                
                // Resolution rate = resolved / total assigned (last 30 days would be better, but we use aggregate for now)
                const performancePool = officers.map(o => {
                    const stats = o.performanceStats || { totalResolved: 0, totalAssigned: 0 };
                    const rate = stats.totalAssigned > 0 ? (stats.totalResolved / stats.totalAssigned) : 0;
                    return { id: o._id, name: o.name, rate };
                });

                // Check if we have any resolution data
                const hasData = performancePool.some(p => p.rate > 0);
                
                if (hasData) {
                    performancePool.sort((a, b) => b.rate - a.rate);
                    const bestRate = performancePool[0].rate;
                    const topPerformers = performancePool.filter(p => p.rate === bestRate);
                    const chosen = topPerformers[Math.floor(Math.random() * topPerformers.length)];
                    
                    console.log(`🏆 [ASSIGN] Critical complaint assigned to top performer: ${chosen.name} (Rate: ${(chosen.rate * 100).toFixed(1)}%)`);
                    return chosen.id;
                }
                console.log(`ℹ️ [ASSIGN] No performance data yet. Falling back to workload assignment.`);
            }

            // ─── STANDARD WORKLOAD-BASED ASSIGNMENT ───
            // Count active complaints per officer in parallel
            const workloads = await Promise.all(
                officers.map(async (officer) => {
                    const count = await Complaint.countDocuments({
                        assignedTo: officer._id, // Field name in Complaint model is assignedTo
                        status: { $nin: ['resolved', 'rejected'] }
                    });
                    return { officerId: officer._id, name: officer.name, count };
                })
            );

            // Sort by workload ascending
            workloads.sort((a, b) => a.count - b.count);

            // Find minimum workload
            const minCount = workloads[0].count;

            // All officers tied at minimum
            const leastLoaded = workloads.filter(w => w.count === minCount);

            // Pick randomly among tied officers
            const chosen = leastLoaded[Math.floor(Math.random() * leastLoaded.length)];

            console.log(`⚖️ [ASSIGN] Assigned to least loaded officer: ${chosen.name} (Active: ${chosen.count})`);
            return chosen.officerId;

        } catch (err) {
            console.error("❌ [ASSIGN] Error during assignment logic:", err.message);
            return null;
        }
    }
}

module.exports = AssignmentService;
