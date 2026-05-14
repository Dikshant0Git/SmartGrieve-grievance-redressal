const cron = require('node-cron');
const Complaint = require('../models/complaint.model');
const User = require('../models/user.model');

/**
 * SLA MONITORING SERVICE
 * 
 * Runs periodically to scan for breached complaints.
 * 1. Checks if deadlineAt < current time and status is not 'resolved' or 'rejected'.
 * 2. Marks them as breached: true.
 * 3. Updates status to 'escalated'.
 */

const initCron = () => {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', async () => {
        console.log('⏰ [CRON] Running SLA monitoring job...');
        await monitorSLA();
    });

    // Run once on startup after 10 seconds to catch up
    setTimeout(() => {
        console.log('⏰ [CRON] Initial SLA scan running...');
        monitorSLA();
    }, 10000);
};

const monitorSLA = async () => {
    try {
        const now = new Date();

        // Find complaints that are:
        // 1. Not resolved or rejected
        // 2. Deadline has passed
        // 3. Not already marked as breached (to avoid redundant processing)
        const breachedComplaints = await Complaint.find({
            status: { $nin: ['resolved', 'rejected', 'escalated'] },
            "sla.deadlineAt": { $lt: now },
            "sla.breached": false
        });

        if (breachedComplaints.length === 0) {
            console.log('✅ [CRON] No new SLA breaches detected.');
            return;
        }

        console.log(`🚨 [CRON] Detected ${breachedComplaints.length} new SLA breaches!`);

        for (const complaint of breachedComplaints) {
            complaint.sla.breached = true;
            complaint.sla.escalatedAt = now;
            complaint.status = 'escalated';
            
            // Log status change
            complaint.statusHistory.push({
                status: 'escalated',
                changedAt: now,
                changedBy: null, // System
                note: 'Automated escalation due to SLA breach'
            });

            await complaint.save();
            console.log(`🚩 [CRON] Escalated complaint ${complaint.grievanceId} (${complaint._id})`);

            // TODO: In production, notify Senior Officer of the department here.
            // For now, as per user request, we skip notifications.
            // console.log(`📢 [CRON] Notification suppressed for Senior Officer of ${complaint.assignedDept}`);
        }

    } catch (err) {
        console.error('❌ [CRON] Error in SLA monitoring job:', err.message);
    }
};

module.exports = { initCron };
