const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { sendEmail } = require("../config/nodemailer");
const { otpEmailTemplate } = require("../utils/emailTemplates");
const { generateOtp, hashOtp } = require("../utils/generateOtp");

/**
 * Utility to mask email for security (e.g. r*****@gmail.com)
 */
const maskEmail = (email) => {
    const [user, domain] = email.split("@");
    return `${user[0]}${"*".repeat(5)}@${domain}`;
};

const registerController = async (req, res) => {
    try {
        const { name, mobileNo, email, password, role, department } = req.body;

        if (!name || !mobileNo || !email || !password) {
            return res.status(400).json({ message: "All fields are required" })
        }

        const user = await userModel.findOne({ email });
        if (user) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate OTP
        const otpCode = generateOtp();
        const hashedOtp = hashOtp(otpCode);

        const newUser = await userModel.create({
            name,
            mobileNo,
            email,
            password: hashedPassword,
            role: "citizen",
            department: null,
            isEmailVerified: false,
            otp: {
                code: hashedOtp,
                expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
                attempts: 0
            }
        });

        // Send OTP email
        await sendEmail(
            newUser.email,
            `Your GrievAI Verification Code — ${otpCode}`,
            otpEmailTemplate(newUser.name, otpCode)
        );

        return res.status(201).json({
            success: true,
            message: "Registration successful. Please check your email for the OTP to verify your account.",
            email: maskEmail(newUser.email)
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }


}

const loginController = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const user = await userModel.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: "Invalid password" });
        }

        // Check if email is verified (only for citizens)
        if (user.role === "citizen" && !user.isEmailVerified) {
            return res.status(403).json({ 
                success: false,
                message: "Please verify your email first.",
                requiresVerification: true,
                email: maskEmail(user.email)
            });
        }

        const token = jwt.sign({ id: user._id, role: user.role, department: user.department }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.cookie("token", token);

        return res.status(200).json({
            success: true,
            message: "User logged in successfully",
            user: user,
            token
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

const officerLoginController = async (req, res) => {
    try {
        const { name, employeeId, password } = req.body;

        if (!name || !employeeId || !password) {
            return res.status(400).json({ message: "Name, Employee ID, and Password are required" });
        }

        const user = await userModel.findOne({ employeeId, name });
        if (!user) {
            return res.status(404).json({ message: "Officer not found with provided Name and ID" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: "Invalid password" });
        }

        if (user.role === "citizen") {
            return res.status(403).json({ message: "Access denied. Use citizen login." });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role, department: user.department },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("token", token);

        return res.status(200).json({
            success: true,
            message: "Officer logged in successfully",
            user: user,
            token
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

const verifyOtpController = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: "Email and OTP are required" });
        }

        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ message: "Email is already verified" });
        }

        // Check attempts
        if (user.otp.attempts >= 5) {
            return res.status(403).json({ message: "Too many wrong attempts. Please request a new OTP." });
        }

        // Check expiry
        if (user.otp.expiresAt < Date.now()) {
            return res.status(400).json({ message: "OTP has expired. Please request a new one." });
        }

        // Verify OTP
        const hashedIncomingOtp = hashOtp(otp);
        if (user.otp.code !== hashedIncomingOtp) {
            user.otp.attempts += 1;
            await user.save();
            return res.status(400).json({ message: "Invalid OTP code." });
        }

        // Success
        user.isEmailVerified = true;
        user.otp.code = null;
        user.otp.expiresAt = null;
        user.otp.attempts = 0;
        await user.save();

        const token = jwt.sign(
            { id: user._id, role: user.role, department: user.department },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("token", token);

        return res.status(200).json({
            success: true,
            message: "Email verified successfully. Welcome to GrievAI.",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const resendOtpController = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });

        const user = await userModel.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.isEmailVerified) {
            return res.status(400).json({ message: "Email is already verified" });
        }

        // Prevent spam: Check if last OTP was sent less than 60s ago
        const lastSentTime = new Date(user.otp.expiresAt).getTime() - 10 * 60 * 1000;
        if (Date.now() - lastSentTime < 60000) {
            const waitTime = Math.ceil((60000 - (Date.now() - lastSentTime)) / 1000);
            return res.status(429).json({ message: `Please wait ${waitTime} seconds before requesting a new OTP.` });
        }

        const otpCode = generateOtp();
        const hashedOtp = hashOtp(otpCode);

        user.otp = {
            code: hashedOtp,
            expiresAt: Date.now() + 10 * 60 * 1000,
            attempts: 0
        };
        await user.save();

        await sendEmail(
            user.email,
            `Your GrievAI Verification Code — ${otpCode}`,
            otpEmailTemplate(user.name, otpCode)
        );

        return res.status(200).json({
            success: true,
            message: "New OTP has been sent to your email."
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const forgotPasswordController = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });

        // Account enumeration protection: vague message if not found
        const user = await userModel.findOne({ email, role: 'citizen', isEmailVerified: true });
        if (!user) {
            return res.status(200).json({ 
                success: true, 
                message: "If this email is registered you will receive an OTP.",
                email: maskEmail(email)
            });
        }

        const otpCode = generateOtp();
        const hashedOtp = hashOtp(otpCode);

        user.otp = {
            code: hashedOtp,
            expiresAt: Date.now() + 10 * 60 * 1000, // 10 mins
            attempts: 0
        };
        await user.save();

        const { forgotPasswordOtpTemplate } = require("../utils/emailTemplates");
        await sendEmail(
            user.email,
            "Reset Your GrievAI Password",
            forgotPasswordOtpTemplate(user.name, otpCode)
        );

        return res.status(200).json({
            success: true,
            message: "If this email is registered you will receive an OTP.",
            email: maskEmail(user.email)
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const verifyForgotOtpController = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

        const user = await userModel.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.otp.attempts >= 5) {
            return res.status(403).json({ message: "Too many wrong attempts. Please request a new OTP." });
        }

        if (user.otp.expiresAt < Date.now()) {
            return res.status(400).json({ message: "OTP has expired." });
        }

        const hashedIncomingOtp = hashOtp(otp);
        if (user.otp.code !== hashedIncomingOtp) {
            user.otp.attempts += 1;
            await user.save();
            return res.status(400).json({ message: "Invalid OTP code." });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        user.passwordReset = {
            token: hashedToken,
            expiresAt: Date.now() + 5 * 60 * 1000 // 5 mins
        };
        // Clear OTP
        user.otp.code = null;
        user.otp.expiresAt = null;
        user.otp.attempts = 0;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "OTP verified. You can now reset your password.",
            resetToken: resetToken // Return unhashed token
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const resetPasswordController = async (req, res) => {
    try {
        const { resetToken, newPassword, email } = req.body;
        if (!resetToken || !newPassword || !email) return res.status(400).json({ message: "All fields are required" });

        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        const user = await userModel.findOne({
            email,
            "passwordReset.token": hashedToken,
            "passwordReset.expiresAt": { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired reset token." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.passwordReset.token = null;
        user.passwordReset.expiresAt = null;
        user.otp.code = null;
        user.otp.expiresAt = null;
        user.otp.attempts = 0;
        await user.save();

        const { passwordChangedTemplate } = require("../utils/emailTemplates");
        await sendEmail(
            user.email,
            "GrievAI Password Changed",
            passwordChangedTemplate(user.name)
        );

        return res.status(200).json({
            success: true,
            message: "Password has been reset successfully. Please login with your new password."
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { 
    registerController, 
    loginController, 
    officerLoginController,
    verifyOtpController,
    resendOtpController,
    forgotPasswordController,
    verifyForgotOtpController,
    resetPasswordController
};