const crypto = require('crypto');

/**
 * Generate a secure 6-digit OTP
 */
const generateOtp = () => {
    return crypto.randomInt(100000, 999999).toString();
};

/**
 * Hash the OTP using SHA-256 for secure storage
 */
const hashOtp = (otp) => {
    return crypto.createHash('sha256').update(otp).digest('hex');
};

module.exports = { generateOtp, hashOtp };
