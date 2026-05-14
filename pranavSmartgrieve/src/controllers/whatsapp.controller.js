const { addToIntakeQueue } = require('../services/ai.service');

/**
 * 1. Webhook Verification (GET)
 */
const handleWebhookVerification = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
        console.log('✅ Webhook Verified Successfully!');
        return res.status(200).set('Content-Type', 'text/plain').send(challenge);
    } else {
        console.error('❌ Verification Failed: Token Mismatch');
        return res.status(403).send("Forbidden: Token Mismatch");
    }
};

/**
 * 2. Incoming Message Handler (POST)
 * Pushes payload to intake queue and returns 200 OK immediately.
 */
const handleIncomingMessage = async (req, res) => {
    // 🛡️ Acknowledge Meta immediately
    res.sendStatus(200);

    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    try {
        await addToIntakeQueue(body);
    } catch (err) {
        console.error("❌ Failed to add to intake queue:", err);
    }
};;

module.exports = {
    handleWebhookVerification,
    handleIncomingMessage
};