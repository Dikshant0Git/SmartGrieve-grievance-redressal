const User = require('../../src/models/user.model');
const Complaint = require('../../src/models/complaint.model');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const createCitizen = async (overrides = {}) => {
    const defaultCitizen = {
        name: 'Test Citizen',
        mobileNo: `+9199999${Math.floor(10000 + Math.random() * 90000)}`,
        email: `citizen_${Date.now()}@test.com`,
        password: await bcrypt.hash('password123', 10),
        role: 'citizen',
        isEmailVerified: true,
        district: 'Bhopal'
    };

    return User.create({ ...defaultCitizen, ...overrides });
};

const createOfficer = async (department, overrides = {}) => {
    const defaultOfficer = {
        name: `Test Officer ${department}`,
        mobileNo: `+9188888${Math.floor(10000 + Math.random() * 90000)}`,
        email: `officer_${department}_${Date.now()}@test.com`,
        password: await bcrypt.hash('password123', 10),
        role: 'officer',
        department: department,
        employeeId: `EMP-${department}-${Math.floor(1000 + Math.random() * 9000)}`,
        isEmailVerified: true
    };

    return User.create({ ...defaultOfficer, ...overrides });
};

const createComplaint = async (citizenId, overrides = {}) => {
    const defaultComplaint = {
        citizen: citizenId || new mongoose.Types.ObjectId(),
        text: 'There is a massive pothole on Main Street causing traffic jams.',
        title: 'Massive Pothole on Main St',
        source: 'Web',
        language: 'en',
        location: {
            district: 'Bhopal',
            address: 'Main Street'
        },
        ai: {
            category: ['road_maintenance'],
            urgency: 'Medium',
            confidence: 0.95
        },
        assignedDept: 'PWD',
        status: 'open'
    };

    return Complaint.create({ ...defaultComplaint, ...overrides });
};

module.exports = {
    createCitizen,
    createOfficer,
    createComplaint
};
