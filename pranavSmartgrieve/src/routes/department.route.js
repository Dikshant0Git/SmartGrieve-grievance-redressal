const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/department.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/role.middleware");

const auth = authMiddleware;
const senior = roleMiddleware("senior_officer", "admin");

// ── Public ──────────────────────────────────
router.get("/", ctrl.getAllDepartments);

// ── Senior officer only — MUST be before /:code ──
router.get("/leaderboard", auth, senior, ctrl.getLeaderboard);

// ── Param routes come LAST ───────────────────
router.get("/:code", ctrl.getDepartmentByCode);
router.get("/:code/stats", auth, senior, ctrl.getDepartmentStats);
router.get("/:code/officers", auth, senior, ctrl.getDepartmentOfficers);
router.post("/:code/officers", auth, senior, ctrl.assignOfficer);
router.delete("/:code/officers/:officerId", auth, senior, ctrl.removeOfficer);

module.exports = router;