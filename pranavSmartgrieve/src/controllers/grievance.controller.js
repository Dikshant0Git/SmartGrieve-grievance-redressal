const Grievance = require('../models/grievance.model.js');
const { processGrievanceWithAI } = require('../services/ai.service.js');
const { uploadToCloudinary } = require('../services/media.service.js');

/**
 * FEATURE: Web Input (Direct Submission)
 * Handles grievances sent directly from the React/Web frontend.
 */
const handleWebSubmission = async (req, res) => {
    const { userId, title, description, locationDetails, landmark } = req.body;
    const imageFile = req.file; // Optional uploaded image

    // Validation
    if (!userId || !description) {
        return res.status(400).json({
            success: false,
            message: "User ID and description are required."
        });
    }

    try {
        const ticketId = Math.random().toString(36).substring(2, 10).toUpperCase();

        let imageUrl = null;
        let mediaEntry = null;

        if (imageFile) {
            console.log(`📷 [WEB] Uploading image for ticket ${ticketId} to Cloudinary...`);
            const cloudResult = await uploadToCloudinary(imageFile.buffer, ticketId);
            if (cloudResult) {
                imageUrl = cloudResult.secure_url;
                mediaEntry = {
                    image_url: cloudResult.secure_url,
                    public_id: cloudResult.public_id,
                    image_metadata: cloudResult.metadata
                };
            }

            // Save to global buffers for Intelligence Agent (Gemini Vision)
            if (!global._mediaBuffers) global._mediaBuffers = new Map();
            const existing = global._mediaBuffers.get(userId) || [];
            existing.push({ buffer: imageFile.buffer, mimeType: imageFile.mimetype });
            global._mediaBuffers.set(userId, existing);
            console.log(`📷 [WEB] Image buffer saved for user ${userId}`);
        }

        // Combine fields for AI
        const finalTextForAI = `Subject: ${title || 'N/A'}\nDescription: ${description}\nLocation: ${locationDetails || 'N/A'}\nLandmark: ${landmark || 'N/A'}`;

        const newGrievance = new Grievance({
            source: 'Website',
            userId: userId,
            rawContent: [description],
            finalTextForAI: finalTextForAI,
            media: mediaEntry ? [mediaEntry] : [],
            status: 'Processing'
        });

        await newGrievance.save();

        // Trigger the shared AI service immediately 
        processGrievanceWithAI(newGrievance._id);

        res.status(201).json({
            success: true,
            message: "Grievance submitted. Our AI is analyzing it now.",
            data: {
                _id: newGrievance._id,
                status: newGrievance.status,
                imageUrl: imageUrl
            }
        });
    } catch (err) {
        console.error("❌ Web Submission Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

// Export as an object so you can add more functions later
module.exports = {
    handleWebSubmission
};