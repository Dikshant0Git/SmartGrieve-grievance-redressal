const mongoose = require("mongoose");
const Department = require("../models/department.model");
const { DEPARTMENTS } = require("../constants/departments");
const env = require("dotenv").config();

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to DB");

        await Department.deleteMany({});
        console.log("Cleared existing departments");

        const docs = Object.values(DEPARTMENTS);
        await Department.insertMany(docs);

        console.log("Seeded departments:");
        docs.forEach(d => console.log(`  ${d.code} — ${d.name}`));

        process.exit(0);

    } catch (error) {
        console.error("Seed failed:", error.message);
        process.exit(1);
    }
};

seed();