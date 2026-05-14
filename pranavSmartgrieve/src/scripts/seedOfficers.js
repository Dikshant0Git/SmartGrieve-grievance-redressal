const mongoose = require("mongoose");
const User = require("../models/user.model");
const Department = require("../models/department.model");
const { dummyOfficers } = require("../constants/officers");
const bcrypt = require("bcrypt");
require("dotenv").config(); // make sure path to .env is correct if running from root

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to DB");

        // 1. Delete existing officers and senior officers
        await User.deleteMany({ role: { $in: ["officer", "senior_officer"] } });
        console.log("Cleared existing officers and senior officers");

        // 2. Hash passwords
        const hashedOfficers = await Promise.all(
            dummyOfficers.map(async (officer) => {
                const hashedPassword = await bcrypt.hash(officer.password, 10);
                return {
                    ...officer,
                    password: hashedPassword
                };
            })
        );

        // 3. Insert officers
        const createdOfficers = await User.insertMany(hashedOfficers);
        console.log(`Seeded ${createdOfficers.length} new officers`);

        // 4. Update Departments
        // First, clear all officers arrays in all departments
        await Department.updateMany({}, { $set: { officers: [] } });

        // Then populate them
        for (const officer of createdOfficers) {
            await Department.findOneAndUpdate(
                { code: officer.department },
                { $push: { officers: officer._id } }
            );
        }
        
        console.log("Updated department officer lists");
        process.exit(0);

    } catch (error) {
        console.error("Seed failed:", error.message);
        process.exit(1);
    }
};

seed();
