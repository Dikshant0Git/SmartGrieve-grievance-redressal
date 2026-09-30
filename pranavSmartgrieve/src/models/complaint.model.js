const mongoose = require("mongoose");
const { DEPARTMENTS, CATEGORY_TO_DEPT } = require("../constants/departments");

// Derive valid values from constants — single source of truth
const DEPT_CODES = Object.values(DEPARTMENTS).map(d => d.code);
const ALL_CATEGORIES = Object.values(DEPARTMENTS).flatMap(d => d.categories);
const URGENCY_LEVELS = ["Low", "Medium", "High", "Critical"];
const VALID_STATUSES = [
    "open",
    "assigned",
    "processing",
    "under_review",
    "review_required",
    "in_progress",
    "pending",
    "escalated",
    "resolved",
    "Resolved",
    "rejected"
];


const complaintSchema = new mongoose.Schema({

    // ── Identity ──────────────────────────────
    grievanceId: {
        type: String,
        unique: true
    },
    ticketId: { // Short alias for WhatsApp
        type: String
    },
    source: {
        type: String,
        enum: ["Web", "WhatsApp"],
        default: "Web"
    },

    // ── Who filed it ──────────────────────────
    citizen: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false // Optional for initial WhatsApp intake
    },
    userId: { // Stores phone number for WhatsApp
        type: String
    },

    // ── What they said ────────────────────────
    text: {
        type: String,
        required: false, // Can be null during 'Collecting' phase
        trim: true
    },
    title: {
        type: String,
        trim: true
    },
    language: {
        type: String,
        enum: ["en", "hi", "mixed"],
        default: "en"
    },
    transcribedText: { type: String },

    // ── AI Swarm Internal Fields ──────────────
    finalTextForAI: { type: String },
    rawContent: [{ type: String }], // For WhatsApp bundling
    whatsappMessageIds: [{ type: String }], // For deduplication
    
    // 📷 Media Attachments (Images & Videos)
    media: [{
        type: { type: String, enum: ["image", "video"], default: "image" },
        image_url: { type: String }, // Keep for backward compat
        video_url: { type: String },
        public_id: { type: String },
        metadata: {
            format: { type: String },
            width: { type: Number },
            height: { type: Number },
            duration: { type: Number }
        },
        exif: {
            lat: { type: Number },
            lng: { type: Number },
            available: { type: Boolean, default: false }
        }
    }],

    // ── Where it happened ─────────────────────
    location: {
        district: {
            type: String,
            required: false, // Optional initially
            trim: true,
            default: "Bhopal"
        },
        ward: {
            type: String,
            trim: true,
            default: null
        },
        address: {
            type: String,
            trim: true
        },
        coordinates: {
            type: [Number],
            default: null
        }
    },

    // ── What AI decided ───────────────────────
    ai: {
        category: {
            type: [String],
            // enum: ALL_CATEGORIES // Removed strict enum to handle dynamic AI output
        },
        urgency: {
            type: String,
            enum: URGENCY_LEVELS
        },
        confidence: {
            type: Number,
            min: 0,
            max: 1
        }
    },

    // ── Where it's assigned ───────────────────
    assignedDept: {
        type: String,
        enum: DEPT_CODES
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },

    // Full history of every reroute
    routingHistory: [
        {
            fromDept: {
                type: String,
                enum: DEPT_CODES
            },
            toDept: {
                type: String,
                enum: DEPT_CODES
            },
            routedAt: {
                type: Date,
                default: Date.now
            },
            routedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },
            reason: {
                type: String,
                default: null
            }
        }
    ],

    // ── SLA ───────────────────────────────────
    sla: {
        deadlineAt: {
            type: Date,
            default: null  // set after AI classification
        },
        breached: {
            type: Boolean,
            default: false
        },
        escalatedAt: {
            type: Date,
            default: null
        }
    },

    // ── Current status ────────────────────────
    status: {
        type: String,
        enum: {
            values: VALID_STATUSES,
            message: "{VALUE} is not a valid status"
        },
        default: "open"
    },

    // Full history of every status change
    statusHistory: [
        {
            status: {
                type: String
            },
            changedAt: {
                type: Date,
                default: Date.now
            },
            changedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null  // null means system did it (e.g. SLA cron)
            },
            note: {
                type: String,
                default: null
            }
        }
    ],

    // ── Resolution ────────────────────────────
    resolution: {
        resolvedAt: {
            type: Date,
            default: null
        },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        note: {
            type: String,
            default: null
        },
        timeToResolveHours: {
            type: Number,
            default: null
        }
    },

    // ── Flags ─────────────────────────────────
    flags: {
        isDuplicate: {
            type: Boolean,
            default: false
        },
        isCluster: {
            type: Boolean,
            default: false  // true if part of a systemic issue cluster
        },
        clusterId: {
            type: String,
            default: null
        }
    },
    
    // ── Rating ────────────────────────────────
    rating: {
        stars: { type: Number, min: 1, max: 5, default: null },
        feedback: { type: String, default: null },
        ratedAt: { type: Date, default: null }
    }

}, { timestamps: true });

// ─────────────────────────────────────────────
// Pre-save hook — auto generate grievanceId
// Runs before every .save() call
// Format: GRV-2026-00001
// ─────────────────────────────────────────────
complaintSchema.pre("save", async function () {
    if (this.isNew && !this.grievanceId) {
        // Find the latest document to get the highest ID
        const lastDoc = await this.constructor.findOne({}, { grievanceId: 1 })
            .sort({ createdAt: -1 }) // Sort by createdAt as it's more reliable than alphanumeric grievanceId
            .limit(1);

        let nextNumber = 1;
        if (lastDoc && lastDoc.grievanceId) {
            const parts = lastDoc.grievanceId.split('-');
            if (parts.length === 3) {
                const lastNum = parseInt(parts[2]);
                if (!isNaN(lastNum)) {
                    nextNumber = lastNum + 1;
                }
            }
        }

        const year = new Date().getFullYear();
        const padded = String(nextNumber).padStart(5, "0");
        this.grievanceId = `GRV-${year}-${padded}`;

        // Generate short ticketId if not provided (for WhatsApp)
        if (!this.ticketId) {
            this.ticketId = Math.random().toString(36).substring(2, 8).toUpperCase();
        }

        // Push initial status into history automatically
        this.statusHistory.push({
            status: this.status,
            changedAt: new Date(),
            changedBy: null,  // system generated
            note: "Complaint filed"
        });
    }
});

// ─────────────────────────────────────────────
// Index — speeds up common queries
// ─────────────────────────────────────────────
complaintSchema.index({ assignedDept: 1, status: 1 });
complaintSchema.index({ citizen: 1 });
complaintSchema.index({ userId: 1 });
complaintSchema.index({ ticketId: 1 });
complaintSchema.index({ whatsappMessageIds: 1 });
complaintSchema.index({ "sla.breached": 1 });
complaintSchema.index({ "sla.deadlineAt": 1 });
complaintSchema.index({ createdAt: -1 });

const Complaint = mongoose.model("Complaint", complaintSchema);
module.exports = Complaint;