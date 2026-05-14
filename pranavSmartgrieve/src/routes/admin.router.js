const express = require("express");
const { getAllComplaints, addOfficer, getOfficerPerformance } = require("../controllers/admin.controller");
const authmiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/role.middleware");

const adminrouter = express.Router();

adminrouter.get(
  ["/complaint", "/complaints"],
  authmiddleware,
  roleMiddleware("admin", "senior_officer"),
  getAllComplaints
);

adminrouter.post("/create/officer", authmiddleware,roleMiddleware("admin", "senior_officer"),addOfficer )
adminrouter.get("/officers/performance", authmiddleware, roleMiddleware("admin", "senior_officer"), getOfficerPerformance)

module.exports = adminrouter;