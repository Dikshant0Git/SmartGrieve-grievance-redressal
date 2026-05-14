const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();
const User = require("../models/user.model");

const maleNames = ["Aarav", "Rohan", "Vikram", "Rahul", "Amit", "Suresh", "Ramesh", "Anil", "Sunil", "Rajesh", "Raj", "Karthik", "Sanjay", "Manish", "Deepak", "Vijay", "Ashok", "Harish", "Kunal", "Vivek"];
const femaleNames = ["Priya", "Neha", "Pooja", "Anjali", "Sneha", "Riya", "Kavita", "Meera", "Kiran", "Sunita", "Anita", "Swati", "Ritu", "Divya", "Aarti", "Geeta", "Rekha", "Shikha", "Nidhi", "Aditi"];
const lastNames = ["Sharma", "Verma", "Singh", "Kumar", "Gupta", "Patel", "Reddy", "Desai", "Joshi", "Yadav", "Mishra", "Das", "Iyer", "Nair", "Agarwal", "Bansal"];

const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const generateMobile = () => {
    let num = ["9", "8", "7"][Math.floor(Math.random() * 3)];
    for (let i = 0; i < 9; i++) {
        num += Math.floor(Math.random() * 10).toString();
    }
    return num;
};

const seedCitizens = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✓ Connected to MongoDB");

        // Clear existing citizens (optional - keeping them might be better if you have tests)
        // For a clean realistic demo, let's clear them
        const result = await User.deleteMany({ role: "citizen" });
        console.log(`✓ Cleared ${result.deletedCount} existing citizens.`);

        const hashedPassword = await bcrypt.hash("Citizen@123", 10);
        const citizens = [];
        const usedEmails = new Set();
        const usedMobiles = new Set();

        console.log("Generating 200 citizens...");

        for (let i = 0; i < 200; i++) {
            const isMale = Math.random() > 0.5;
            const firstName = isMale ? getRandomItem(maleNames) : getRandomItem(femaleNames);
            const lastName = getRandomItem(lastNames);
            const fullName = `${firstName} ${lastName}`;
            
            let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
            let mobileNo = generateMobile();

            while (usedEmails.has(email)) {
                email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}@example.com`;
            }
            usedEmails.add(email);

            while (usedMobiles.has(mobileNo)) {
                mobileNo = generateMobile();
            }
            usedMobiles.add(mobileNo);

            citizens.push({
                name: fullName,
                email: email,
                mobileNo: mobileNo,
                password: hashedPassword,
                role: "citizen",
                isActive: true
            });
        }

        await User.insertMany(citizens);
        console.log("✓ Successfully seeded 200 citizens.");
        process.exit(0);
    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    }
};

seedCitizens();
