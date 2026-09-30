const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;

const {
    otpEmailTemplate,
    forgotPasswordOtpTemplate,
    verificationEmailTemplate,
    passwordChangedTemplate,
    complaintConfirmationTemplate,
    statusUpdateTemplate
} = require('../utils/emailTemplates');

/**
 * CENTRAL MAIL SERVICE (Google Workspace OAuth2)
 * 
 * Replaces legacy Nodemailer / SMTP and Resend transport with Google Workspace OAuth2.
 */

const createTransporter = async () => {
  try {
    const oauth2Client = new OAuth2(
      process.env.OAUTH_CLIENT_ID,
      process.env.OAUTH_CLIENT_SECRET,
      "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.OAUTH_REFRESH_TOKEN
    });

    const accessToken = await new Promise((resolve, reject) => {
      oauth2Client.getAccessToken((err, token) => {
        if (err) {
          console.error('Failed to create access token', err);
          reject(err);
        }
        resolve(token);
      });
    });

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        type: 'OAuth2',
        user: process.env.OAUTH_EMAIL,
        accessToken,
        clientId: process.env.OAUTH_CLIENT_ID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET,
        refreshToken: process.env.OAUTH_REFRESH_TOKEN
      },
      family: 4 // Force IPv4 to prevent Render ENETUNREACH on IPv6
    });

    return transporter;
  } catch (error) {
    console.error("Error creating email transporter:", error);
    throw error;
  }
};

/**
 * Universal sendEmail function
 * 
 * Supports both interface styles:
 * 1. Object format: await sendEmail({ to, subject, html, text })
 * 2. Positional format (legacy): await sendEmail(to, subject, html)
 * 
 * @param {string|object} toOrOptions - Recipient email string OR options object
 * @param {string} [subjectParam] - Email subject if using positional arguments
 * @param {string} [htmlParam] - HTML body if using positional arguments
 * @returns {Promise<any>} Nodemailer sendMail response info
 */
const sendEmail = async (toOrOptions, subjectParam, htmlParam) => {
    let to;
    let subject;
    let html;
    let text;

    if (typeof toOrOptions === 'object' && toOrOptions !== null) {
        to = toOrOptions.to;
        subject = toOrOptions.subject;
        html = toOrOptions.html || toOrOptions.htmlContent;
        text = toOrOptions.text;
    } else {
        to = toOrOptions;
        subject = subjectParam;
        html = htmlParam;
    }

    if (!to || !subject || (!html && !text)) {
        throw new Error('Email delivery failed: "to", "subject", and content ("html" or "text") are required.');
    }

    try {
        const transporter = await createTransporter();
        const payload = {
            from: `"SmartGrieve No-Reply" <${process.env.OAUTH_EMAIL}>`,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            ...(html ? { html } : {}),
            ...(text ? { text } : {})
        };

        const info = await transporter.sendMail(payload);
        console.log(`📧 [MailService] Email sent successfully via OAuth2. ID: ${info.messageId}`);
        return info;
    } catch (err) {
        console.error('❌ [MailService] Unexpected error sending email:', err.message);
        throw new Error(`Email delivery failed: ${err.message}`);
    }
};

/**
 * Convenience helper: Send OTP verification email
 */
const sendOTPEmail = async ({ to, name, otp }) => {
    return sendEmail({
        to,
        subject: `Your SmartGrieve Verification Code — ${otp}`,
        html: otpEmailTemplate(name, otp)
    });
};

/**
 * Convenience helper: Send Password Reset OTP email
 */
const sendPasswordResetEmail = async ({ to, name, otp }) => {
    return sendEmail({
        to,
        subject: 'Reset Your SmartGrieve Password',
        html: forgotPasswordOtpTemplate(name, otp)
    });
};

/**
 * Convenience helper: Send Verification link email
 */
const sendVerificationEmail = async ({ to, name, verificationLink }) => {
    return sendEmail({
        to,
        subject: 'Verify Your SmartGrieve Account',
        html: verificationEmailTemplate(name, verificationLink)
    });
};

module.exports = {
    sendEmail,
    sendOTPEmail,
    sendPasswordResetEmail,
    sendVerificationEmail
};
