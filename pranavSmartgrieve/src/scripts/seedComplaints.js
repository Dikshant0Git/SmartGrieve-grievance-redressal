const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const bcrypt = require("bcrypt");
require("dotenv").config();

const User = require("../models/user.model");
const Department = require("../models/department.model");
const Complaint = require("../models/complaint.model");
const { DEPARTMENTS, CATEGORY_TO_DEPT } = require("../constants/departments");

// Paths
const GEOJSON_PATH = path.join(__dirname, "../../../React Map Feature/GoogleMaps/public/mygeodata/mygeodata.geojson");

// Templates for realistic complaints
const COMPLAINT_TEMPLATES = {
    "Sanitation": [
        { text: "Garbage not picked up from our street for a week.", lang: "en" },
        { text: "Public toilet in ward is extremely dirty and unusable.", lang: "en" },
        { text: "Open drainage causing foul smell and health hazard.", lang: "en" },
        { text: "Kachra wali gaadi pichle 4 din se nahi aayi hai.", lang: "hi" }
    ],
    "Roads": [
        { text: "Large pothole on main road causing accidents.", lang: "en" },
        { text: "Street lights are not working, making the road dangerous at night.", lang: "en" },
        { text: "Road completely damaged after rain, vehicles getting stuck.", lang: "en" },
        { text: "Road par bade gadde ho gaye hain, accident ka darr hai.", lang: "hi" }
    ],
    "Water": [
        { text: "Water supply completely cut off in our area since Monday.", lang: "en" },
        { text: "Contaminated water with mud coming from taps.", lang: "en" },
        { text: "Low water pressure, not even enough for basic needs.", lang: "en" },
        { text: "Nal mein ganda paani aa raha hai pichle 3 din se.", lang: "hi" }
    ],
    "Electricity": [
        { text: "Frequent power cuts during day time without any notice.", lang: "en" },
        { text: "Transformer sparking in our locality, please check.", lang: "en" },
        { text: "Voltage fluctuations damaging home appliances.", lang: "en" },
        { text: "Bijli baar baar ja rahi hai, koi sunwai nahi ho rahi.", lang: "hi" }
    ],
    "Health": [
        { text: "Mosquito breeding in stagnant water, fear of Dengue.", lang: "en" },
        { text: "Primary health center is closed during working hours.", lang: "en" },
        { text: "Lack of medicines in government hospital.", lang: "en" },
        { text: "Area mein bahut machhar ho gaye hain, bimari failne ka darr hai.", lang: "hi" }
    ],
    "Transport": [
        { text: "Bus frequency is very low in our ward.", lang: "en" },
        { text: "Illegal parking blocking the main bus stop.", lang: "en" },
        { text: "Public transport not following the designated route.", lang: "en" },
        { text: "Bus stop par bahut bheed rehti hai, buses samay par nahi aati.", lang: "hi" }
    ],
    "Housing": [
        { text: "Encroachment on public park land by local shops.", lang: "en" },
        { text: "Illegal construction happening without permit.", lang: "en" },
        { text: "Property tax issue, showing wrong amount.", lang: "en" },
        { text: "Sarkari zameen par avaidh kabza ho raha hai.", lang: "hi" }
    ],
    "Land": [
        { text: "Boundary wall of government school broken, needs repair.", lang: "en" },
        { text: "Land record verification pending for pichle 2 mahine.", lang: "hi" },
        { text: "Unauthorized occupation of community center space.", lang: "en" }
    ],
    "Corruption": [
        { text: "Officer asking for bribe for simple document verification.", lang: "en" },
        { text: "Funds allocated for park maintenance are being misused.", lang: "en" },
        { text: "Tender process for road construction seems biased.", lang: "en" },
        { text: "Kaam karwane ke liye paise mange ja rahe hain.", lang: "hi" }
    ],
    "Other": [
        { text: "Noise pollution from late night functions in the area.", lang: "en" },
        { text: "Street dogs attacking children in the park.", lang: "en" },
        { text: "Illegal hoardings blocking the view of traffic signals.", lang: "en" }
    ]
};

const getRandom = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const getWeightedRandom = (weights) => {
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    for (const [key, weight] of Object.entries(weights)) {
        if (random < weight) return key;
        random -= weight;
    }
};

const askQuestion = (query) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans.toLowerCase());
    }));
};

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("\x1b[32m%s\x1b[0m", "✓ Connected to MongoDB");

        // 1. Check Departments
        const deptCount = await Department.countDocuments();
        if (deptCount === 0) {
            console.error("\x1b[31m%s\x1b[0m", "Error: Departments not seeded. Run 'npm run seed:depts' first.");
            process.exit(1);
        }

        // 2. Handle existing complaints
        const existingCount = await Complaint.countDocuments();
        if (existingCount > 0) {
            const answer = 'y'; // Auto-confirm for now
            if (answer === 'y') {
                await Complaint.deleteMany({});
                console.log("✓ Existing complaints cleared.");
            } else {
                console.log("Skipping clear. Seeding additional data...");
            }
        }

        // 3. Get Resources
        let citizens = await User.find({ role: "citizen" });
        if (citizens.length === 0) {
            console.log("No citizens found. Creating 10 dummy citizens...");
            const hashedPassword = await bcrypt.hash("Citizen@123", 10);
            const dummyCitizens = [];
            for (let i = 1; i <= 10; i++) {
                dummyCitizens.push({
                    name: `Citizen ${i}`,
                    email: `citizen${i}.bhopal@example.com`,
                    mobileNo: `90000000${10 + i}`,
                    password: hashedPassword,
                    role: "citizen"
                });
            }
            citizens = await User.insertMany(dummyCitizens);
            console.log(`✓ Seeded ${citizens.length} dummy citizens.`);
        }

        const officers = await User.find({ role: "officer" });
        const seniorOfficers = await User.find({ role: "senior_officer" });

        // 4. Load Wards from GeoJSON
        if (!fs.existsSync(GEOJSON_PATH)) {
            console.error("\x1b[31m%s\x1b[0m", `Error: GeoJSON file not found at ${GEOJSON_PATH}`);
            process.exit(1);
        }
        const geoData = JSON.parse(fs.readFileSync(GEOJSON_PATH, "utf8"));
        const wards = geoData.features.map(f => f.properties.ward_lgd_name);
        console.log(`✓ Loaded ${wards.length} wards from GeoJSON.`);

        // 5. Generate Complaints
        const categories = Object.keys(CATEGORY_TO_DEPT);
        const complaintsToInsert = [];

        const stats = {
            total: 0,
            byWard: {},
            byCategory: {},
            byUrgency: {},
            byStatus: {}
        };

        const BHOPAL_CENTER = { lng: 77.4126, lat: 23.2599 };

        for (const ward of wards) {
            const count = getRandom(5, 50); // Random 5-50 complaints per ward
            stats.byWard[ward] = count;

            for (let i = 0; i < count; i++) {
                const category = categories[getRandom(0, categories.length - 1)];
                const templates = COMPLAINT_TEMPLATES[category] || COMPLAINT_TEMPLATES["Other"];
                const template = templates[getRandom(0, templates.length - 1)];
                
                const urgency = getWeightedRandom({ "Critical": 10, "High": 25, "Medium": 45, "Low": 20 });
                const status = getWeightedRandom({ "open": 30, "under_review": 25, "review_required": 15, "escalated": 10, "resolved": 20 });
                
                const createdAt = new Date(Date.now() - getRandom(0, 45 * 24 * 60 * 60 * 1000));
                const deptCode = CATEGORY_TO_DEPT[category];
                const slaDays = DEPARTMENTS[Object.keys(DEPARTMENTS).find(k => DEPARTMENTS[k].code === deptCode)].sla[category] || 7;
                
                const deadlineAt = new Date(createdAt.getTime() + slaDays * 24 * 60 * 60 * 1000);
                let resolvedAt = null;
                let timeToResolveHours = null;
                let resolvedBy = null;

                if (status === "resolved") {
                    // Resolve within 30 days of creation
                    resolvedAt = new Date(createdAt.getTime() + getRandom(1 * 3600000, 30 * 24 * 3600000));
                    if (resolvedAt > new Date()) resolvedAt = new Date();
                    timeToResolveHours = (resolvedAt - createdAt) / 3600000;
                    
                    const deptOfficers = officers.filter(o => o.department === deptCode);
                    if (deptOfficers.length > 0) {
                        resolvedBy = deptOfficers[getRandom(0, deptOfficers.length - 1)]._id;
                    }
                }

                let assignedTo = null;
                const deptOfficers = officers.filter(o => o.department === deptCode);
                if (deptOfficers.length > 0) {
                    assignedTo = deptOfficers[getRandom(0, deptOfficers.length - 1)]._id;
                }

                const complaintData = {
                    citizen: citizens[getRandom(0, citizens.length - 1)]._id,
                    title: `${category} Issue - ${ward}`,
                    description: template.text,
                    text: template.text,
                    language: template.lang,
                    location: {
                        district: "Bhopal",
                        ward: ward,
                        coordinates: [
                            BHOPAL_CENTER.lng + (Math.random() - 0.5) * 0.1,
                            BHOPAL_CENTER.lat + (Math.random() - 0.5) * 0.1
                        ]
                    },
                    ai: {
                        category: [category],
                        urgency: urgency,
                        confidence: (Math.random() * 0.2 + 0.78).toFixed(2),
                    },
                    assignedDept: deptCode,
                    assignedTo: assignedTo, // Set the personal assignment
                    department: deptCode,
                    status: status,
                    sla: {
                        deadlineAt: deadlineAt,
                        breached: (status === "escalated") || (resolvedAt && resolvedAt > deadlineAt),
                        escalatedAt: status === "escalated" ? new Date(deadlineAt.getTime() + 3600000) : null
                    },
                    resolution: status === "resolved" ? {
                        resolvedAt: resolvedAt,
                        resolvedBy: assignedTo || resolvedBy,
                        note: "Fixed by the department team.",
                        timeToResolveHours: timeToResolveHours
                    } : undefined,
                    createdAt: createdAt,
                    routingHistory: [],
                    statusHistory: [] // Will be populated in hook, we'll manually add more for non-open statuses
                };

                // Add Rerouting for 15%
                if (Math.random() < 0.15) {
                    const otherDepts = Object.values(DEPARTMENTS).filter(d => d.code !== deptCode);
                    const fromDept = otherDepts[getRandom(0, otherDepts.length - 1)].code;
                    complaintData.routingHistory.push({
                        fromDept: fromDept,
                        toDept: deptCode,
                        reason: "Initially misclassified by user description.",
                        routedAt: new Date(createdAt.getTime() + 10 * 60000) // 10 mins later
                    });
                }

                complaintsToInsert.push(complaintData);

                // Stats
                stats.total++;
                stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
                stats.byUrgency[urgency] = (stats.byUrgency[urgency] || 0) + 1;
                stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
            }
        }

        // Insert in chunks for better performance and reliability
        const chunkSize = 100;
        console.log(`Starting insertion of ${complaintsToInsert.length} complaints...`);
        
        for (let i = 0; i < complaintsToInsert.length; i += chunkSize) {
            const chunk = complaintsToInsert.slice(i, i + chunkSize);
            
            // Process sequentially within chunks to avoid race conditions in ID generation hook
            for (const data of chunk) {
                const c = new Complaint(data);
                
                // Add status history steps for resolved/under_review
                if (data.status !== "open") {
                    const steps = ["open"];
                    if (data.status === "under_review" || data.status === "resolved") steps.push("under_review");
                    if (data.status === "resolved") steps.push("resolved");
                    if (data.status === "escalated") steps.push("escalated");

                    let lastTime = data.createdAt.getTime();
                    c.statusHistory = steps.map(s => {
                        const stepTime = new Date(lastTime + getRandom(1, 24) * 3600000);
                        lastTime = stepTime.getTime();
                        return {
                            status: s,
                            changedAt: stepTime,
                            note: `Transitioned to ${s}`
                        };
                    });
                }

                await c.save();
            }
            process.stdout.write(`.`);
        }

        console.log("\n\x1b[32m%s\x1b[0m", "✓ Seeding complete!");
        
        // 6. Print Summary
        console.log("\n--- SEEDING SUMMARY ---");
        console.log(`Total Complaints: ${stats.total}`);
        
        console.log("\nBreakdown by Status:");
        Object.entries(stats.byStatus).forEach(([k, v]) => console.log(`  ${k.padEnd(15)}: ${v}`));

        console.log("\nBreakdown by Urgency:");
        Object.entries(stats.byUrgency).forEach(([k, v]) => console.log(`  ${k.padEnd(15)}: ${v}`));

        console.log("\nBreakdown by Category (Top 5):");
        Object.entries(stats.byCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([k, v]) => console.log(`  ${k.padEnd(15)}: ${v}`));

        process.exit(0);

    } catch (error) {
        console.error("\x1b[31m%s\x1b[0m", "Seed failed:", error.stack);
        process.exit(1);
    }
};

seed();
