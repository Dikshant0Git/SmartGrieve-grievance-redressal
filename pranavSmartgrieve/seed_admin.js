require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./src/models/user.model");
const bcrypt = require("bcrypt");

async function seedAdmin() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const adminExists = await User.findOne({ role: "admin" });
    if (adminExists) {
        console.log("Admin already exists");
        process.exit(0);
    }

    const hashedPassword = await bcrypt.hash("Admin@123", 10);
    const admin = await User.create({
        name: "Super Admin",
        mobileNo: "9999999999",
        email: "admin@smartgrieve.com",
        password: hashedPassword,
        employeeId: "ADMIN-001",
        role: "admin"
    });

    console.log("Admin created successfully:");
    console.log(JSON.stringify(admin, null, 2));
    process.exit(0);
}

seedAdmin();
