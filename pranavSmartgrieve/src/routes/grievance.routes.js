const express = require('express');
const router = express.Router();
const {handleWebSubmission} = require('../controllers/grievance.controller');
const upload = require('../middlewares/upload.middleware');

// General Grievance Submissions (from the Web form)
router.post('/submit', upload.single('image'), handleWebSubmission);

// You can also add routes here for the Dashboard later
// router.get('/all', gController.getAllGrievances); 

module.exports = router;