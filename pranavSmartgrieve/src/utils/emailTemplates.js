/**
 * EMAIL TEMPLATES
 * 
 * Professional HTML templates with inline CSS.
 * Colors: Navy (#0f172a), Amber (#f59e0b)
 */

const baseStyles = `
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #334155;
    background-color: #f8fafc;
    padding: 40px 20px;
`;

const containerStyles = `
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
`;

const headerStyles = `
    background-color: #0f172a;
    padding: 30px;
    text-align: center;
`;

const bodyStyles = `
    padding: 40px;
`;

const footerStyles = `
    background-color: #f1f5f9;
    padding: 20px;
    text-align: center;
    font-size: 12px;
    color: #64748b;
`;

const buttonStyles = `
    display: inline-block;
    background-color: #f59e0b;
    color: #ffffff;
    padding: 12px 24px;
    text-decoration: none;
    border-radius: 6px;
    font-weight: bold;
    margin: 20px 0;
`;

const brandName = `<span style="color: #f59e0b; font-weight: 800;">Griev</span><span style="color: #ffffff; font-weight: 800;">AI</span>`;

/**
 * Verification Email
 */
const verificationEmailTemplate = (name, verificationLink) => `
    <div style="${baseStyles}">
        <div style="${containerStyles}">
            <div style="${headerStyles}">
                <div style="font-size: 24px;">${brandName}</div>
            </div>
            <div style="${bodyStyles}">
                <h2 style="color: #0f172a;">Welcome, ${name}!</h2>
                <p>Thank you for registering with SmartGrieve. To activate your account and start filing grievances, please verify your email address.</p>
                <div style="text-align: center;">
                    <a href="${verificationLink}" style="${buttonStyles}">Verify Your Email</a>
                </div>
                <p style="font-size: 14px; color: #64748b;">This link will expire in 24 hours. If you did not create an account, please ignore this email.</p>
            </div>
            <div style="${footerStyles}">
                &copy; ${new Date().getFullYear()} SmartGrieve Bhopal. Empowering Citizens.
            </div>
        </div>
    </div>
`;

/**
 * Complaint Confirmation Email
 */
const complaintConfirmationTemplate = (name, grievanceId, category, urgency, department, slaDeadline) => `
    <div style="${baseStyles}">
        <div style="${containerStyles}">
            <div style="${headerStyles}">
                <div style="font-size: 24px;">${brandName}</div>
            </div>
            <div style="${bodyStyles}">
                <h2 style="color: #0f172a;">Complaint Registered</h2>
                <p>Hello ${name},</p>
                <p>Your grievance has been successfully registered and analyzed by our AI system.</p>
                
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                    <div style="font-size: 14px; color: #64748b;">Grievance ID</div>
                    <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${grievanceId}</div>
                </div>

                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #64748b;">Category</td>
                        <td style="padding: 8px 0; font-weight: 600;">${category}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #64748b;">Urgency</td>
                        <td style="padding: 8px 0; font-weight: 600;">${urgency}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #64748b;">Department</td>
                        <td style="padding: 8px 0; font-weight: 600;">${department}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #64748b;">Resolution Deadline</td>
                        <td style="padding: 8px 0; font-weight: 600; color: #ef4444;">${slaDeadline}</td>
                    </tr>
                </table>

                <p style="margin-top: 20px;">You can track the live status of your complaint on your dashboard using the Grievance ID above.</p>
            </div>
            <div style="${footerStyles}">
                &copy; ${new Date().getFullYear()} SmartGrieve Bhopal. Efficient Governance.
            </div>
        </div>
    </div>
`;

/**
 * Status Update Email
 */
const statusUpdateTemplate = (name, grievanceId, oldStatus, newStatus, officerName, note) => {
    let statusMessage = `The status of your complaint has been updated from <b>${oldStatus}</b> to <b style="color: #f59e0b;">${newStatus}</b>.`;
    
    if (newStatus.toLowerCase() === 'resolved') {
        statusMessage += `<p>Our team has marked this issue as resolved. Please log in to your dashboard to confirm the resolution. If you are not satisfied, you may reopen the complaint.</p>`;
    } else if (newStatus.toLowerCase() === 'escalated') {
        statusMessage += `<p>Your complaint has been escalated to senior management and will be prioritized for immediate action.</p>`;
    }

    return `
        <div style="${baseStyles}">
            <div style="${containerStyles}">
                <div style="${headerStyles}">
                    <div style="font-size: 24px;">${brandName}</div>
                </div>
                <div style="${bodyStyles}">
                    <h2 style="color: #0f172a;">Update on Your Complaint</h2>
                    <p>Hello ${name},</p>
                    <p>${statusMessage}</p>

                    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Grievance ID: ${grievanceId}</div>
                        <div style="font-size: 14px; font-weight: 600; color: #0f172a;">Updated by: ${officerName}</div>
                        ${note ? `<div style="margin-top: 10px; font-style: italic; color: #475569;">"${note}"</div>` : ''}
                    </div>

                    <p>Thank you for your patience as we work to resolve this matter.</p>
                </div>
                <div style="${footerStyles}">
                    &copy; ${new Date().getFullYear()} SmartGrieve Bhopal. Active Support.
                </div>
            </div>
        </div>
    `;
};

/**
 * OTP Verification Email
 */
const otpEmailTemplate = (name, otp) => `
    <div style="${baseStyles}">
        <div style="${containerStyles}">
            <div style="${headerStyles}">
                <div style="font-size: 24px;">${brandName}</div>
            </div>
            <div style="${bodyStyles}">
                <h2 style="color: #0f172a;">Verify Your Account</h2>
                <p>Hello ${name},</p>
                <p>Thank you for registering with SmartGrieve. Please use the following One-Time Password (OTP) to verify your email address. This code is valid for <b>10 minutes</b>.</p>
                
                <div style="text-align: center; margin: 40px 0;">
                    <div style="
                        display: inline-block;
                        padding: 20px 40px;
                        background-color: #fef3c7;
                        border: 2px solid #0f172a;
                        border-radius: 12px;
                        font-size: 36px;
                        font-weight: 800;
                        letter-spacing: 10px;
                        color: #0f172a;
                        font-family: monospace;
                    ">
                        ${otp}
                    </div>
                </div>

                <p style="font-size: 14px; color: #64748b; text-align: center;">
                    If you did not initiate this request, please ignore this email.<br>
                    <b>Do not share this OTP with anyone.</b>
                </p>
            </div>
            <div style="${footerStyles}">
                &copy; ${new Date().getFullYear()} SmartGrieve | Bhopal Municipal Corporation
            </div>
        </div>
    </div>
`;

/**
 * Forgot Password OTP Email
 */
const forgotPasswordOtpTemplate = (name, otp) => `
    <div style="${baseStyles}">
        <div style="${containerStyles}">
            <div style="${headerStyles}">
                <div style="font-size: 24px;">${brandName}</div>
            </div>
            <div style="${bodyStyles}">
                <h2 style="color: #0f172a;">Reset Your SmartGrieve Password</h2>
                <p>Hello ${name},</p>
                <p>We received a request to reset your password. Please use the following One-Time Password (OTP) to proceed. This code is valid for <b>10 minutes</b>.</p>
                
                <div style="text-align: center; margin: 40px 0;">
                    <div style="
                        display: inline-block;
                        padding: 20px 40px;
                        background-color: #fef3c7;
                        border: 2px solid #0f172a;
                        border-radius: 12px;
                        font-size: 36px;
                        font-weight: 800;
                        letter-spacing: 10px;
                        color: #0f172a;
                        font-family: monospace;
                    ">
                        ${otp}
                    </div>
                </div>

                <p style="font-size: 14px; color: #64748b; text-align: center;">
                    If you did not request a password reset, please ignore this email.<br>
                    <b>Do not share this OTP with anyone.</b>
                </p>
            </div>
            <div style="${footerStyles}">
                &copy; ${new Date().getFullYear()} SmartGrieve | Bhopal Municipal Corporation
            </div>
        </div>
    </div>
`;

/**
 * Password Changed Confirmation
 */
const passwordChangedTemplate = (name) => `
    <div style="${baseStyles}">
        <div style="${containerStyles}">
            <div style="${headerStyles}">
                <div style="font-size: 24px;">${brandName}</div>
            </div>
            <div style="${bodyStyles}">
                <h2 style="color: #0f172a;">Password Changed Successfully</h2>
                <p>Hello ${name},</p>
                <p>This is a confirmation that the password for your SmartGrieve account has been changed on ${new Date().toLocaleString()}.</p>
                
                <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 20px 0;">
                    <p style="margin: 0; color: #166534; font-weight: 600;">Your security is important to us.</p>
                </div>

                <p>If you did not perform this action, please contact our support team immediately at <a href="mailto:support@grievai.bhopal.gov.in" style="color: #f59e0b;">support@grievai.bhopal.gov.in</a>.</p>
            </div>
            <div style="${footerStyles}">
                &copy; ${new Date().getFullYear()} SmartGrieve Bhopal. Safe & Secure.
            </div>
        </div>
    </div>
`;

module.exports = {
    verificationEmailTemplate,
    complaintConfirmationTemplate,
    statusUpdateTemplate,
    otpEmailTemplate,
    forgotPasswordOtpTemplate,
    passwordChangedTemplate
};
