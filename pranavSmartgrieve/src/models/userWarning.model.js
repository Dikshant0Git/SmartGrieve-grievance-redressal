const mongoose = require('mongoose');

const userWarningSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    
    // Abuse tracking
    abuse_count: { type: Number, default: 0 },
    is_banned: { type: Boolean, default: false },
    
    // History of offenses
    offenses: [{
        text: { type: String },
        timestamp: { type: Date, default: Date.now }
    }],

    lastWarningAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserWarning', userWarningSchema);
