const ComplaintModel = require("../models/complaint.model");
const UserModel = require("../models/user.model");
const DepartmentModel = require("../models/department.model");
const bcrypt = require("bcrypt")
const { DEPARTMENTS } = require("../constants/departments");
const DEPT_CODES = Object.values(DEPARTMENTS).map(d => d.code);

const getAllComplaints = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "senior_officer") {
      query = { assignedDept: req.user.department };
    }

    const complaints = await ComplaintModel.find(query)
      .populate("citizen", "name email mobileNo")
      .populate("assignedTo", "name employeeId department")
      .sort({ createdAt: -1 });

    // Map internal fields to frontend-friendly names
    const mappedComplaints = complaints.map(c => ({
      ...c.toObject(),
      department: c.assignedDept,
      priority: c.ai?.urgency || 'Medium'
    }));

    return res.status(200).json({
      success: true,
      message: "All complaints fetched successfully",
      total: complaints.length,
      complaints: mappedComplaints,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


const addOfficer = async (req, res) => {
  console.log("📝 [ADMIN] Attempting to create officer:", req.body);
  try {
    let { name, email, password, department, mobileNo, employeeId } = req.body

    if (!name || !email || !password || !mobileNo || !department || !employeeId) {
      console.warn("⚠️ [ADMIN] Missing fields in create officer request");
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (!DEPT_CODES.includes(department)) {
      console.warn(`⚠️ [ADMIN] Invalid department: ${department}`);
      return res.status(400).json({ success: false, message: `Invalid department code. Must be one of: ${DEPT_CODES.join(", ")}` });
    }

    // A senior officer can only create officers for their own department
    if (req.user.role === "senior_officer" && req.user.department !== department) {
      console.warn(`⚠️ [ADMIN] Unauthorized department creation by senior officer: ${req.user.department} trying to create for ${department}`);
      return res.status(403).json({ success: false, message: "Senior officers can only create officers for their own department" });
    }

    // Check for existing user by email, employeeId, OR mobileNo
    const isExisted = await UserModel.findOne({
      $or: [{ email }, { employeeId }, { mobileNo }]
    });

    if (isExisted) {
      let duplicateField = "Email, Employee ID, or Mobile Number";
      if (isExisted.email === email) duplicateField = "Email";
      else if (isExisted.employeeId === employeeId) duplicateField = "Employee ID";
      else if (isExisted.mobileNo === mobileNo) duplicateField = "Mobile Number";

      console.warn(`⚠️ [ADMIN] User already exists with this ${duplicateField}`);
      return res.status(409).json({
        success: false,
        message: `${duplicateField} already registered`
      });
    }

    console.log("🔐 Hashing password...");
    let hashedPass = await bcrypt.hash(password, 10)

    console.log("💾 Creating officer in DB...");
    let officer = await UserModel.create({
      name,
      email,
      password: hashedPass,
      mobileNo,
      department,
      employeeId,
      role: "officer"
    });

    // Also update the Department model's officers array to ensure dashboard visibility
    console.log(`🔗 Linking officer ${officer._id} to department ${department}...`);
    await DepartmentModel.findOneAndUpdate(
      { code: department },
      { $addToSet: { officers: officer._id } }
    );

    console.log("✅ Officer created successfully");
    return res.status(201).json({
      success: true,
      message: "Officer created successfully",
      officer
    });
  }
  catch (error) {
    console.error("❌ [ADMIN] Error in addOfficer:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
}


const getOfficerPerformance = async (req, res) => {
    try {
        let query = { role: 'officer' };
        if (req.user.role === 'senior_officer') {
            query.department = req.user.department;
        }

        const officers = await UserModel.find(query)
            .select('name email department performanceStats employeeId mobileNo createdAt')
            .sort({ "performanceStats.averageRating": -1 });

        // Calculate resolution rates and handle nulls
        const performanceData = officers.map(o => {
            const stats = o.performanceStats || {};
            const totalAssigned = stats.totalAssigned || 0;
            const totalResolved = stats.totalResolved || 0;
            const resRate = totalAssigned > 0 ? (totalResolved / totalAssigned) * 100 : 0;

            return {
                _id: o._id,
                name: o.name,
                email: o.email,
                employeeId: o.employeeId,
                department: o.department,
                totalAssigned,
                totalResolved,
                resolutionRate: resRate.toFixed(1),
                averageRating: (stats.averageRating || 0).toFixed(1),
                totalRatings: stats.totalRatings || 0,
                joinedAt: o.createdAt
            };
        });

        return res.status(200).json({
            success: true,
            officers: performanceData
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getAllComplaints, addOfficer, getOfficerPerformance };