const nodemailer = require("nodemailer");

/**
 * NODEMAILER CONFIGURATION
 * 
 * Uses Gmail SMTP with App Passwords.
 * Ensure EMAIL_USER, EMAIL_PASS, and EMAIL_FROM are set in .env
 */

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Generic function to send an email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML body
 */
const sendEmail = async (to, subject, htmlContent) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || `"GrievAI Support" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html: htmlContent,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Email sent: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error("❌ Nodemailer Error:", error.message);
        throw error;
    }
};

module.exports = { transporter, sendEmail };
