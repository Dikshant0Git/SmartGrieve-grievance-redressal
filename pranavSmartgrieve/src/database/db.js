const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error("Neither MONGODB_URI nor MONGO_URI is set in .env");
        }
        await mongoose.connect(mongoUri);
        console.log(`MongoDB Connected`);
    } catch (error) {
        console.log(`Error: ${error.message}`);
        process.exit(1);
    }
}

module.exports = connectDB;