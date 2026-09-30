/**
 * Fake Meta Graph API / WhatsApp payload generator.
 */

const generateWhatsAppTextMessage = (mobileNo, text, messageId) => {
    return {
        object: "whatsapp_business_account",
        entry: [
            {
                id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
                changes: [
                    {
                        value: {
                            messaging_product: "whatsapp",
                            metadata: {
                                display_phone_number: "1234567890",
                                phone_number_id: "PHONE_NUMBER_ID"
                            },
                            contacts: [
                                {
                                    profile: { name: "Test User" },
                                    wa_id: mobileNo.replace('+', '')
                                }
                            ],
                            messages: [
                                {
                                    from: mobileNo.replace('+', ''),
                                    id: messageId || `wamid.${Date.now()}`,
                                    timestamp: Math.floor(Date.now() / 1000).toString(),
                                    text: { body: text },
                                    type: "text"
                                }
                            ]
                        },
                        field: "messages"
                    }
                ]
            }
        ]
    };
};

module.exports = {
    generateWhatsAppTextMessage
};
