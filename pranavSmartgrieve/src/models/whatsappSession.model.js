const mongoose = require('mongoose');

const whatsappSessionSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        unique: true
    },
    partialComplaint: {
        type: Object,
        default: {}
    },
    missingFields: {
        type: [String],
        default: []
    },
    currentStep: {
        type: String,
        default: 'awaiting_details'
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // Document auto-deletes when current date > expiresAt
    }
});

module.exports = mongoose.model('WhatsAppSession', whatsappSessionSchema);
