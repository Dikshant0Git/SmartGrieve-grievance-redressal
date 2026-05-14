const mongoose = require("mongoose");
const { DEPARTMENTS } = require('../constants/departments.js');

const DEPT_CODES = Object.values(DEPARTMENTS).map(d => d.code);

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    mobileNo: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    employeeId: {
        type: String,
        unique: true,
        sparse: true, // only required for officers/admin
        trim: true
    },

    role: {
        type: String,
        enum: ["citizen", "officer", "senior_officer", "admin"],
        default: "citizen"
    },

    department: {
        type: String,
        enum: {
            values: [...DEPT_CODES, null],
            message: '{VALUE} is not a valid department code'
        },
        default: null
    },

    isActive: {
        type: Boolean,
        default: true
    },

    activeComplaintsCount: {
        type: Number,
        default: 0
    },
    ward: {
        type: String,
        default: null
    },
    district: {
        type: String,
        default: "Bhopal"
    },

    isEmailVerified: {
        type: Boolean,
        default: false
    },
    otp: {
        code: { type: String, default: null },
        expiresAt: { type: Date, default: null },
        attempts: { type: Number, default: 0 }
    },
    passwordReset: {
        token: { type: String, default: null },
        expiresAt: { type: Date, default: null }
    },
    performanceStats: {
        totalRatings: { type: Number, default: 0 },
        averageRating: { type: Number, default: 0 },
        totalResolved: { type: Number, default: 0 },
        totalAssigned: { type: Number, default: 0 }
    }

}, { timestamps: true })

const userModel = mongoose.model('User', userSchema);
module.exports = userModel;