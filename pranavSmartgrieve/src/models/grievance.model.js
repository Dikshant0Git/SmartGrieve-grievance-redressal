const mongoose = require('mongoose');

const grievanceSchema = new mongoose.Schema({
    source: { type: String, enum: ['WhatsApp', 'Website'], required: true },
    userId: { type: String, required: true, index: true },

    // 🛡️ IDEMPOTENCY: Store the unique WhatsApp IDs to prevent duplicates
    whatsappMessageIds: [{ type: String }],

    rawContent: [{ type: String }],
    finalTextForAI: { type: String },
    audioTranscription: { type: String },

    // 📷 Media Attachments (WhatsApp Images)
    media: [{
        image_url: { type: String },
        public_id: { type: String },
        image_metadata: {
            format: { type: String },
            width: { type: Number },
            height: { type: Number }
        },
        exif: {
            lat: { type: Number },
            lng: { type: Number },
            available: { type: Boolean, default: false }
        }
    }],

    classification: {
        category: { type: String, default: 'Unclassified' },
        priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Low' },
        summary: { type: String } // Added summary field
    },

    status: {
        type: String,
        // 🔄 Added 'Pending' (waiting for queue) and 'Failed' (AI error)
        enum: ['Collecting', 'Awaiting_Input', 'Pending', 'Processing', 'Resolved', 'Failed', 'Rejected'],
        default: 'Collecting'
    },

    createdAt: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now }
});
// PERFORMANCE INDEXES: Crucial for high load deduplication and bundling lookups
grievanceSchema.index({ whatsappMessageIds: 1 });
grievanceSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.models.Grievance || mongoose.model('Grievance', grievanceSchema);