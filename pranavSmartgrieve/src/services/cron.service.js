const cron = require('node-cron');
const mongoose = require('mongoose');
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

    // Run initial scan 5 seconds after startup once DB is ready
    setTimeout(() => {
        console.log('⏰ [CRON] Initial SLA scan running...');
        monitorSLA();
    }, 5000);
};

const monitorSLA = async () => {
    try {
        // Prevent buffering timeouts if MongoDB is not connected
        if (mongoose.connection.readyState !== 1) {
            console.warn(`⏳ [CRON] MongoDB not connected yet (readyState: ${mongoose.connection.readyState}). Skipping SLA scan.`);
            return;
        }

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
            try {
                await Complaint.findByIdAndUpdate(complaint._id, {
                    $set: {
                        "sla.breached": true,
                        "sla.escalatedAt": now,
                        status: 'escalated'
                    },
                    $push: {
                        statusHistory: {
                            status: 'escalated',
                            changedAt: now,
                            changedBy: null, // System
                            note: 'Automated escalation due to SLA breach'
                        }
                    }
                });
                console.log(`🚩 [CRON] Escalated complaint ${complaint.grievanceId || complaint._id}`);
            } catch (singleErr) {
                console.error(`⚠️ [CRON] Failed to escalate complaint ${complaint._id}:`, singleErr.message);
            }
        }

    } catch (err) {
        console.error('❌ [CRON] Error in SLA monitoring job:', err.message);
    }
};

module.exports = { initCron };
