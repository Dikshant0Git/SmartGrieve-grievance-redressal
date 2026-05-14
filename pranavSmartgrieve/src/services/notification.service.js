const axios = require('axios');

const sendWhatsAppMessage = async (recipientPhone, messageBody) => {
    try {
        const url = `https://graph.facebook.com/${process.env.VERSION}/${process.env.PHONE_NUMBER_ID}/messages`;
        
        const data = {
            messaging_product: "whatsapp",
            to: recipientPhone,
            type: "text",
            text: { body: messageBody }
        };

        const config = {
            headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };

        const response = await axios.post(url, data, config);
        console.log("Message Sent successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("Error sending message:", error.response?.data || error.message);
        throw error;
    }
};

module.exports = { sendWhatsAppMessage };