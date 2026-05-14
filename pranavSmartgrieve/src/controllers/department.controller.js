const Department = require("../models/department.model");
const User = require("../models/user.model");
const Complaint = require("../models/complaint.model");
const { DEPARTMENTS, CATEGORY_TO_DEPT } = require("../constants/departments");

// ─────────────────────────────────────────────
// GET /api/departments
// Public — list all departments
// ─────────────────────────────────────────────
exports.getAllDepartments = async (req, res) => {
    try {
        const departments = await Department.find()
            .select("-officers")  // don't expose officer IDs publicly
            .sort("name");

        res.json({
            success: true,
            count: departments.length,
            data: departments
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────
// GET /api/departments/:code
// Public — get single department info
// ─────────────────────────────────────────────
exports.getDepartmentByCode = async (req, res) => {
    try {
        const dept = await Department.findOne({ code: req.params.code.toUpperCase() })
            .select("-officers");

        if (!dept) {
            return res.status(404).json({
                success: false,
                message: `No department found with code: ${req.params.code}`
            });
        }

        res.json({ success: true, data: dept });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────
// POST /api/departments/:code/officers
// senior_officer only — assign an officer to a department
// ─────────────────────────────────────────────
exports.assignOfficer = async (req, res) => {
    try {
        const { officerId } = req.body;
        const deptCode = req.params.code.toUpperCase();

        if (!officerId) {
            return res.status(400).json({ success: false, message: "officerId is required" });
        }

        // Validate user exists and is actually an officer
        const user = await User.findById(officerId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        if (user.role !== "officer") {
            return res.status(400).json({
                success: false,
                message: "User must have role 'officer' to be assigned to a department"
            });
        }

        // Validate department exists
        const dept = await Department.findOne({ code: deptCode });
        if (!dept) {
            return res.status(404).json({ success: false, message: "Department not found" });
        }

        // Check if already assigned
        if (dept.officers.includes(officerId)) {
            return res.status(400).json({
                success: false,
                message: "Officer is already assigned to this department"
            });
        }

        // If officer was in another department, remove them first
        if (user.department && user.department !== deptCode) {
            await Department.findOneAndUpdate(
                { code: user.department },
                { $pull: { officers: officerId } }
            );
        }

        // Assign to new department
        dept.officers.push(officerId);
        await dept.save();

        user.department = deptCode;
        await user.save();

        res.json({
            success: true,
            message: `Officer ${user.name} assigned to ${dept.name}`
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────
// DELETE /api/departments/:code/officers/:officerId
// senior_officer only — remove an officer from a department
// ─────────────────────────────────────────────
exports.removeOfficer = async (req, res) => {
    try {
        const deptCode = req.params.code.toUpperCase();
        const { officerId } = req.params;

        const dept = await Department.findOne({ code: deptCode });
        if (!dept) {
            return res.status(404).json({ success: false, message: "Department not found" });
        }

        if (!dept.officers.includes(officerId)) {
            return res.status(400).json({
                success: false,
                message: "Officer is not assigned to this department"
            });
        }

        dept.officers.pull(officerId);
        await dept.save();

        await User.findByIdAndUpdate(officerId, { department: null });

        res.json({ success: true, message: "Officer removed from department" });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────
// GET /api/departments/:code/officers
// senior_officer only — list officers in a department
// ─────────────────────────────────────────────
exports.getDepartmentOfficers = async (req, res) => {
    try {
        const dept = await Department.findOne({ code: req.params.code.toUpperCase() })
            .populate("officers", "name email mobileNo role department");

        if (!dept) {
            return res.status(404).json({ success: false, message: "Department not found" });
        }

        res.json({
            success: true,
            count: dept.officers.length,
            data: dept.officers
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────
// GET /api/departments/:code/stats
// senior_officer only — performance stats for one department
// ─────────────────────────────────────────────
exports.getDepartmentStats = async (req, res) => {
    try {
        const deptCode = req.params.code.toUpperCase();

        // Verify dept exists
        const dept = await Department.findOne({ code: deptCode }).select("name code");
        if (!dept) {
            return res.status(404).json({ success: false, message: "Department not found" });
        }

        // Run all counts in parallel — don't await one by one
        const [total, resolved, escalated, open, underReview, slaBreached] = await Promise.all([
            Complaint.countDocuments({ assignedDept: deptCode }),
            Complaint.countDocuments({ assignedDept: deptCode, status: "resolved" }),
            Complaint.countDocuments({ assignedDept: deptCode, status: "escalated" }),
            Complaint.countDocuments({ assignedDept: deptCode, status: "open" }),
            Complaint.countDocuments({ assignedDept: deptCode, status: "under_review" }),
            Complaint.countDocuments({ assignedDept: deptCode, "sla.breached": true }),
        ]);

        // Avg resolution time — only on resolved complaints
        const resolvedDocs = await Complaint.find({
            assignedDept: deptCode,
            status: "resolved",
            "resolution.resolvedAt": { $exists: true }
        }).select("createdAt resolution.resolvedAt");

        let avgResolutionHours = null;
        if (resolvedDocs.length > 0) {
            const totalMs = resolvedDocs.reduce((sum, c) => {
                return sum + (new Date(c.resolution.resolvedAt) - new Date(c.createdAt));
            }, 0);
            avgResolutionHours = Math.round(totalMs / resolvedDocs.length / (1000 * 60 * 60));
        }

        res.json({
            success: true,
            data: {
                name: dept.name,
                code: dept.code,
                complaints: { total, open, underReview, resolved, escalated },
                resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
                slaBreached,
                slaAdherence: total > 0
                    ? Math.round(((total - slaBreached) / total) * 100)
                    : 100,
                avgResolutionHours
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────
// GET /api/departments/leaderboard
// senior_officer only — all departments ranked by score
// ─────────────────────────────────────────────
exports.getLeaderboard = async (req, res) => {
    try {
        const departments = await Department.find().select("name code");

        const leaderboard = await Promise.all(
            departments.map(async (dept) => {
                const [total, resolved, slaBreached] = await Promise.all([
                    Complaint.countDocuments({ assignedDept: dept.code }),
                    Complaint.countDocuments({ assignedDept: dept.code, status: "resolved" }),
                    Complaint.countDocuments({ assignedDept: dept.code, "sla.breached": true }),
                ]);

                const resolutionRate = total > 0 ? (resolved / total) : 1;
                const slaAdherence = total > 0 ? ((total - slaBreached) / total) : 1;

                // Score = 60% resolution rate + 40% SLA adherence
                const score = Math.round((resolutionRate * 0.6 + slaAdherence * 0.4) * 100);

                return {
                    name: dept.name,
                    code: dept.code,
                    total,
                    resolved,
                    resolutionRate: Math.round(resolutionRate * 100),
                    slaBreached,
                    slaAdherence: Math.round(slaAdherence * 100),
                    score
                };
            })
        );

        // Sort best score first
        leaderboard.sort((a, b) => b.score - a.score);

        res.json({ success: true, data: leaderboard });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};