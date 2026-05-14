/**
 * Service to handle sending outbound messages via the WhatsApp Cloud API.
 * Currently acts as a mock/logger for the prototype, but structured for immediate API integration.
 */

require('dotenv').config();
const axios = require('axios');

const WHATSAPP_API_URL = `https://graph.facebook.com/${process.env.VERSION}/${process.env.PHONE_NUMBER_ID}/messages`;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

/**
 * Sends a WhatsApp text message.
 * @param {string} to - The recipient's phone number.
 * @param {string} text - The message to send.
 */
async function sendWhatsAppMessage(to, text) {
    if (!to || !text) return;

    try {
        console.log(`\n📤 [WHATSAPP OUTBOUND] To: ${to}`);
        console.log(`💬 Message:\n${text}\n`);

        await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: "whatsapp",
                to: to,
                type: "text",
                text: { body: text }
            },
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );
    } catch (error) {
        console.error("❌ Failed to send WhatsApp message:", error?.response?.data || error.message);
    }
}

/**
 * Sends a WhatsApp audio message.
 * @param {string} to - The recipient's phone number.
 * @param {Buffer} audioBuffer - The audio file as a buffer.
 */
async function sendWhatsAppAudioMessage(to, audioBuffer) {
    if (!to || !audioBuffer) return;

    try {
        console.log(`📤 [WHATSAPP AUDIO] Uploading and sending to: ${to}`);

        // 1. Upload to WhatsApp to get mediaId
        const mediaId = await uploadMediaToWhatsApp(audioBuffer);

        // 2. Send the audio message
        await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: "whatsapp",
                to: to,
                type: "audio",
                audio: { id: mediaId }
            },
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );
        console.log(`✅ [WHATSAPP AUDIO] Sent successfully`);
    } catch (error) {
        console.error("❌ Failed to send WhatsApp audio message:", error?.response?.data || error.message);
    }
}

/**
 * Uploads media to WhatsApp.
 */
async function uploadMediaToWhatsApp(mediaBuffer, mimeType = 'audio/mpeg') {
    try {
        const WHATSAPP_MEDIA_URL = `https://graph.facebook.com/${process.env.VERSION}/${process.env.PHONE_NUMBER_ID}/media`;
        
        const form = new (require('form-data'))();
        form.append('file', mediaBuffer, {
            filename: 'reply.mp3',
            contentType: mimeType
        });
        form.append('messaging_product', 'whatsapp');

        const response = await axios.post(WHATSAPP_MEDIA_URL, form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${WHATSAPP_TOKEN}`
            }
        });

        return response.data.id;
    } catch (error) {
        console.error("❌ Failed to upload WhatsApp media:", error?.response?.data || error.message);
        throw error;
    }
}

module.exports = {
    sendWhatsAppMessage,
    sendWhatsAppAudioMessage
};
