const express = require("express")
const {ComplaintController, mycomplaintController, singleComplaintController,updateComplaintController, submitVoiceComplaint} = require("../controllers/complaint.controller")
const authmiddleware = require("../middlewares/authMiddleware")
const rolemiddleware = require("../middlewares/role.middleware")
const ComplaintRouter =  express.Router()
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

ComplaintRouter.post("/create", authmiddleware, upload.array("media", 5), ComplaintController )
ComplaintRouter.post("/voice", authmiddleware, upload.single("audio"), submitVoiceComplaint)

ComplaintRouter.get("/my", authmiddleware,mycomplaintController )

ComplaintRouter.get("/department", authmiddleware, rolemiddleware("officer", "senior_officer", "admin"), require("../controllers/complaint.controller").departmentComplaintsController )

ComplaintRouter.get("/:id", authmiddleware,singleComplaintController )

ComplaintRouter.get("/map/wards", authmiddleware, require("../controllers/complaint.controller").getWardStatsController );

ComplaintRouter.get("/analytics/summary", authmiddleware, rolemiddleware("admin", "senior_officer"), require("../controllers/complaint.controller").getAnalyticsSummary);

ComplaintRouter.patch("/:id/status", authmiddleware, rolemiddleware("officer", "admin", "senior_officer"), updateComplaintController );

// Rating
ComplaintRouter.post("/:id/rate", authmiddleware, require("../controllers/complaint.controller").rateComplaint);

module.exports = ComplaintRouter;
