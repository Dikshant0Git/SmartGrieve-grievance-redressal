const mongoose = require("mongoose");
const { DEPARTMENTS } = require("../constants/departments");

const DEPT_CODES = Object.values(DEPARTMENTS).map(d => d.code);
const ALL_CATEGORIES = Object.values(DEPARTMENTS).flatMap(d => d.categories);

const departmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        enum: {
            values: DEPT_CODES,
            message: "{VALUE} is not a valid department code"
        }
    },
    categories: {
        type: [String],
        enum: {
            values: ALL_CATEGORIES,
            message: "{VALUE} is not a valid category"
        },
        required: true
    },
    // Map of category → SLA days  e.g. { Sanitation: 3, Roads: 7 }
    sla: {
        type: Map,
        of: Number,
        required: true
    },
    officers: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ]
}, { timestamps: true });

const Department = mongoose.model("Department", departmentSchema);
module.exports = Department;