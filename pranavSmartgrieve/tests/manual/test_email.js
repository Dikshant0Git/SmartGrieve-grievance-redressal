require('dotenv').config();
const { sendEmail } = require('../../src/services/mail.service');

async function test() {
    try {
        console.log("Testing OAuth2 Email Delivery...");
        const result = await sendEmail({
            to: process.env.OAUTH_EMAIL, // sending to self for testing
            subject: "OAuth2 Email Test - SmartGrieve",
            html: "<h1>Success!</h1><p>Your OAuth2 Google Workspace email delivery is working perfectly.</p>"
        });
        console.log("Test passed. Message ID:", result.messageId);
    } catch (error) {
        console.error("Test failed. Error:", error);
    }
}

test();
