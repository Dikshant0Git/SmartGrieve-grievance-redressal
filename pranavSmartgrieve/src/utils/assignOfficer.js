const User = require('../models/user.model');

/**
 * Assigns a random officer from the given department.
 * @param {string} deptCode - The department code (e.g., 'SNT', 'RDS')
 * @returns {Promise<mongoose.Types.ObjectId | null>} - The officer's _id or null if none found
 */
const assignRandomOfficer = async (deptCode) => {
    try {
        const officers = await User.find({ role: 'officer', department: deptCode });
        
        if (!officers || officers.length === 0) {
            console.warn(`[WARN] No officers found for department: ${deptCode}. Complaint assigned to null.`);
            return null;
        }

        const randomIndex = Math.floor(Math.random() * officers.length);
        const selectedOfficer = officers[randomIndex];
        
        return selectedOfficer._id;
    } catch (err) {
        console.error(`[ERROR] Failed to assign random officer for dept ${deptCode}:`, err);
        return null;
    }
};

module.exports = { assignRandomOfficer };
