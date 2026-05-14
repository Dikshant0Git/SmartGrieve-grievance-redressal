const { DEPARTMENTS } = require('./departments.js');

const maleNames = ["Aarav", "Rohan", "Vikram", "Rahul", "Amit", "Suresh", "Ramesh", "Anil", "Sunil", "Rajesh", "Raj", "Karthik", "Sanjay", "Manish", "Deepak", "Vijay", "Ashok", "Harish", "Kunal", "Vivek"];
const femaleNames = ["Priya", "Neha", "Pooja", "Anjali", "Sneha", "Riya", "Kavita", "Meera", "Kiran", "Sunita", "Anita", "Swati", "Ritu", "Divya", "Aarti", "Geeta", "Rekha", "Shikha", "Nidhi", "Aditi"];
const lastNames = ["Sharma", "Verma", "Singh", "Kumar", "Gupta", "Patel", "Reddy", "Desai", "Joshi", "Yadav", "Mishra", "Das", "Iyer", "Nair", "Agarwal", "Bansal"];

const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Generate random mobile number starting with 9, 8, or 7
const generateMobile = () => {
    let num = ["9", "8", "7"][Math.floor(Math.random() * 3)];
    for (let i = 0; i < 9; i++) {
        num += Math.floor(Math.random() * 10).toString();
    }
    return num;
};

const dummyOfficers = [];

const deptCodes = Object.values(DEPARTMENTS).map(d => d.code);

// Ensure uniqueness of emails and mobiles generated
const usedEmails = new Set();
const usedMobiles = new Set();

deptCodes.forEach(code => {
    // Generate 12 officers for each department (6 male, 6 female)
    for (let i = 0; i < 12; i++) {
        const isMale = i % 2 === 0;
        const firstName = isMale ? getRandomItem(maleNames) : getRandomItem(femaleNames);
        const lastName = getRandomItem(lastNames);
        const fullName = `${firstName} ${lastName}`;
        
        let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${code.toLowerCase()}@example.com`;
        
        // Handle duplicate emails if any
        let counter = 1;
        while (usedEmails.has(email)) {
            email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${counter}.${code.toLowerCase()}@example.com`;
            counter++;
        }
        usedEmails.add(email);

        let mobileNo = generateMobile();
        while (usedMobiles.has(mobileNo)) {
            mobileNo = generateMobile();
        }
        usedMobiles.add(mobileNo);

        dummyOfficers.push({
            name: fullName,
            email: email,
            mobileNo: mobileNo,
            password: "Password@123", // Default password for dummy users
            role: "officer",
            department: code,
            employeeId: `${code}-${1000 + i}` // e.g. MUNC-1000
        });
    }

    // Generate 1 senior officer for each department
    const isMaleSenior = Math.random() > 0.5;
    const seniorFirstName = isMaleSenior ? getRandomItem(maleNames) : getRandomItem(femaleNames);
    const seniorLastName = getRandomItem(lastNames);
    const seniorFullName = `${seniorFirstName} ${seniorLastName}`;

    let seniorEmail = `admin.${code.toLowerCase()}@example.com`;
    let seniorMobileNo = generateMobile();
    while (usedMobiles.has(seniorMobileNo)) {
        seniorMobileNo = generateMobile();
    }
    usedMobiles.add(seniorMobileNo);

    dummyOfficers.push({
        name: seniorFullName,
        email: seniorEmail,
        mobileNo: seniorMobileNo,
        password: "Admin@123", // Distinct password for senior officers
        role: "senior_officer",
        department: code,
        employeeId: `${code}-ADMIN` // e.g. MUNC-ADMIN
    });
});

module.exports = { dummyOfficers };
