const express = require("express");
const { 
    registerController, 
    loginController, 
    officerLoginController,
    verifyOtpController,
    resendOtpController,
    forgotPasswordController,
    verifyForgotOtpController,
    resetPasswordController
} = require("../controllers/auth.controllers");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.post('/register', registerController)
router.post('/login', loginController)
router.post('/officer-login', officerLoginController)
router.post('/verify-otp', verifyOtpController)
router.post('/resend-otp', resendOtpController)

// Forgot Password Flow
router.post('/forgot-password', forgotPasswordController)
router.post('/verify-forgot-otp', verifyForgotOtpController)
router.post('/reset-password', resetPasswordController)

router.get('/me', authMiddleware, (req, res) => {
    res.json({ message: "Authenticated successfully", user: req.user })
})

router.post('/logout', (req, res) => {
    res.json({ success: true, message: "Logged out successfully" })
})

module.exports = router;