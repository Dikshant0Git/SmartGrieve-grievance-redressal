const mongoose = require('mongoose');

const manualReviewGrievanceSchema = new mongoose.Schema({
    originalGrievanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Grievance',
        required: true,
        index: true
    },
    userId: { type: String, required: true },

    // Structured Data Extracted by AI
    status_tier: { type: String, enum: ['Green', 'Red', 'Yellow'], required: true },
    category: {
        type: String,
        enum: ['Sanitation', 'Roads', 'Water', 'Electricity', 'Health', 'Transport', 'Housing', 'Land', 'Corruption', 'Other', 'Rejected', 'Unclassified'],
        required: true
    },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], required: true },
    summary: { type: String, required: true },

    // RAG and System Context
    location: {
        zone: { type: Number },
        coordinates: [{ type: Number }], // [lat, lng]
        landmark: { type: String }
    },

    response_message: { type: String },

    // 📷 Media from complaint
    media: [{
        image_url: { type: String },
        public_id: { type: String }
    }],

    // Location resolution source
    location_source: {
        type: String,
        enum: ['text', 'exif', 'text+exif'],
        default: 'text'
    },

    // AI Confidence and Review
    confidence_score: { type: Number, min: 0, max: 100, default: 0 },
    requires_manual_review: { type: Boolean, default: true }, // Default to true for this collection

    // Geo-Resolution Method
    resolution_method: {
        type: String,
        enum: ['landmark_exact', 'landmark', 'ward_number_direct', 'ward_alias', 'zone_name', 'hub_centroid', 'exif_gps', 'ai_text', 'ai_fuzzy', 'unresolved', 'none'],
        default: 'unresolved'
    },

    // Duplicate Detection
    is_duplicate: { type: Boolean, default: false },
    duplicate_of: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcessedGrievance' },

    // City Intelligence Metadata
    departmentId: { type: String },
    cityEnrichment: { type: mongoose.Schema.Types.Mixed },
    leafletPayload: { type: mongoose.Schema.Types.Mixed },

    // Raw Output for Auditing
    rawAIResponse: { type: String },

    // Workflow fields for other backend teams
    workflow: {
        citizen: { type: String },
        text: { type: String },
        language: { type: String, default: 'en' },
        location: {
            district: { type: String, default: 'Bhopal' },
            ward: { type: String },
            coordinates: [{ type: Number }],
            state: { type: String, default: 'Madhya Pradesh' }
        },
        ai: {
            category: [{ type: String }],
            urgency: { type: String },
            confidence: { type: Number },
            manualOverride: { type: Boolean, default: false },
            overriddenBy: { type: String, default: null }
        },
        assignedDept: { type: String },
        sla: {
            deadlineAt: { type: Date },
            breached: { type: Boolean, default: false },
            escalatedAt: { type: Date, default: null }
        },
        status: { type: String, default: 'open' },
        resolution: {
            resolvedAt: { type: Date, default: null },
            resolvedBy: { type: String, default: null },
            note: { type: String, default: null },
            timeToResolveHours: { type: Number, default: null }
        },
        flags: {
            isDuplicate: { type: Boolean, default: false },
            isCluster: { type: Boolean, default: false },
            clusterId: { type: String, default: null }
        },
        grievanceId: { type: String }
    },

    createdAt: { type: Date, default: Date.now }
});

// Create indexes
manualReviewGrievanceSchema.index({ requires_manual_review: 1 });
manualReviewGrievanceSchema.index({ 'location.zone': 1, priority: -1 });

module.exports = mongoose.models.ManualReviewGrievance || mongoose.model('ManualReviewGrievance', manualReviewGrievanceSchema);
