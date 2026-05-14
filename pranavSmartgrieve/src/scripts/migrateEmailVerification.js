const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load env vars
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const userModel = require("../models/user.model");

async function migrate() {
    try {
        console.log("🔗 Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ Connected.");

        console.log("🛠️ Starting migration: Setting isEmailVerified=true for all existing users...");
        
        const result = await userModel.updateMany(
            { isEmailVerified: { $exists: false } }, // Or just update all existing ones
            { $set: { isEmailVerified: true } }
        );

        console.log(`✅ Migration complete. Updated ${result.modifiedCount} users.`);
        
        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
}

migrate();
