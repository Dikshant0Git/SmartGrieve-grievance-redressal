const complaintModel = require("../models/complaint.model");
const User = require("../models/user.model");
const { uploadToCloudinary } = require("../services/media.service");
const guardrailAgent = require("../services/agents/guardrail.agent");
const intelligenceAgent = require("../services/agents/intelligence.agent");
const systemAgent = require("../services/agents/system.agent");
const { sendEmail } = require("../services/mail.service");
const { complaintConfirmationTemplate, statusUpdateTemplate } = require("../utils/emailTemplates");
const { DEPARTMENTS } = require("../constants/departments");
const { transcribeAudio } = require("../services/speechToText.service");
const { generateSpeech, mapLanguageToGoogleCode } = require("../services/textToSpeech.service");

const ComplaintController = async (req, res) => {
    try {
        const { text, district, ward, coordinates } = req.body;

        if (!text) {
            return res.status(400).json({ success: false, message: "Complaint text is required" });
        }

        // 1. Initial Document Creation (Status: processing)
        const complaint = await complaintModel.create({
            citizen: req.user.id || req.user._id,
            text,
            title: req.body.title || text.substring(0, 30) + "...",
            location: {
                district: district || "Bhopal",
                ward: ward || null,
                address: req.body.location || null
            },
            status: 'processing',
            source: 'Web'
        });

        // 2. Handle Media Uploads (Images & Videos)
        if (req.files && req.files.length > 0) {
            console.log(`📷 [Web] Processing ${req.files.length} media files...`);
            const mediaResults = [];
            const mediaBuffers = [];
            
            for (const file of req.files) {
                const isVideo = file.mimetype.startsWith('video');
                const resourceType = isVideo ? 'video' : 'image';
                
                const cloudResult = await uploadToCloudinary(file.buffer, complaint._id.toString().substring(0, 8), resourceType);
                
                if (cloudResult) {
                    const mediaEntry = {
                        type: resourceType,
                        public_id: cloudResult.public_id,
                        metadata: cloudResult.metadata
                    };

                    if (isVideo) {
                        mediaEntry.video_url = cloudResult.secure_url;
                    } else {
                        mediaEntry.image_url = cloudResult.secure_url;
                    }

                    mediaResults.push(mediaEntry);
                    
                    mediaBuffers.push({
                        buffer: file.buffer,
                        mimeType: file.mimetype
                    });
                }
            }
            complaint.media = mediaResults;
            await complaint.save();

            // Populate global buffer for AI Agent (Isolation: use citizen ID)
            if (!global._mediaBuffers) global._mediaBuffers = new Map();
            global._mediaBuffers.set(complaint.citizen.toString(), mediaBuffers);
        }

        // 3. AI Pipeline Translation Layer
        // Inject fields expected by legacy agents (dikshantAI logic)
        complaint.finalTextForAI = text;
        complaint.userId = complaint.citizen.toString(); // Map citizen -> userId for AI tracking

        console.log(`🛡️  [Web] Running AI Swarm for ${complaint._id}`);
        
        // Guardrail
        const guardResult = await guardrailAgent.run(complaint);
        if (!guardResult.passed) {
            await complaintModel.findByIdAndDelete(complaint._id);
            return res.status(400).json({ success: false, message: guardResult.warningMessage || "Complaint rejected by security filters." });
        }

        // Intelligence (Gemini)
        const { getGeminiResponse } = await import('../services/gemini.service.mjs');
        const aiResult = await intelligenceAgent.run(guardResult.normalized, getGeminiResponse, complaint);

        // System (Geo-resolve + Dedup + Finalize)
        const finalResult = await systemAgent.run(aiResult, complaint, guardResult, 'processing');

        if (finalResult.statusTier === 'Yellow') {
            return res.status(400).json({
                success: false,
                needsLocation: true,
                message: finalResult.responseMessage || "Bhiya, aapki complaint samajh aa gayi hai lekin aage badhne ke liye hume exact location chahiye. Bina location ke hum issue resolve nahi kar payenge.",
                complaintId: complaint._id
            });
        }

        // 4. Results are already saved to the DB by systemAgent.run()
        // We just need to return the updated document.
        const finalComplaint = await complaintModel.findById(complaint._id).populate('citizen', 'name mobileNo email');

        // 5. Send Confirmation Email (Async)
        complaint.populate('citizen', 'name email').then(popDoc => {
            if (popDoc.citizen && popDoc.citizen.email) {
                const deptName = DEPARTMENTS[popDoc.assignedDept]?.name || popDoc.assignedDept;
                const slaDate = popDoc.sla?.deadlineAt ? new Date(popDoc.sla.deadlineAt).toLocaleDateString() : 'N/A';
                
                sendEmail(
                    popDoc.citizen.email,
                    `Complaint Registered - ${popDoc.grievanceId}`,
                    complaintConfirmationTemplate(
                        popDoc.citizen.name,
                        popDoc.grievanceId,
                        popDoc.ai?.category?.[0] || 'General',
                        popDoc.ai?.urgency || 'Medium',
                        deptName,
                        slaDate
                    )
                ).catch(err => console.error('❌ Confirmation Email failed:', err.message));
            }
        });

        // 6. Notify via Socket
        const io = req.app.get('io');
        if (io && (finalResult.assignedDept || aiResult.departmentId)) {
            const deptId = finalResult.assignedDept || aiResult.departmentId;
            io.to(`dept_${deptId}`).emit('queue:new_complaint', finalComplaint);
        }

        return res.status(201).json({
            success: true,
            message: "Complaint registered and analyzed successfully. A confirmation email has been sent.",
            complaint: finalComplaint,
            aiSummary: aiResult.summary
        });

    } catch (error) {
        console.error("Error in ComplaintController:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * 🎤 Submit Voice Complaint
 * POST /api/complaint/voice
 */
const submitVoiceComplaint = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No audio file provided" });
        }

        const citizenId = req.user.id;
        const languageHint = req.body.language || 'auto'; // 'hi' or 'en'
        const district = req.body.district || "Bhopal";
        const ward = req.body.ward || null;

        // 1. Transcribe Audio using Gemini
        const audioBuffer = req.file.buffer;
        const mimeType = req.file.mimetype;
        
        const transcribedText = await transcribeAudio(audioBuffer, mimeType, languageHint);
        
        if (!transcribedText || transcribedText.trim().length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Could not understand the voice note. Please try again or type your complaint." 
            });
        }

        // 2. Create placeholder complaint
        const complaint = new complaintModel({
            citizen: citizenId,
            text: transcribedText,
            transcribedText: transcribedText,
            finalTextForAI: transcribedText, // Required for agents
            userId: citizenId.toString(),    // Required for agents
            source: "Web",
            status: "processing",
            location: {
                district: district,
                ward: ward
            }
        });
        await complaint.save();

        // 3. Run AI Swarm (Full Pipeline)
        console.log(`🛡️ [Voice] Running AI Swarm for ${complaint._id}`);
        
        // Guardrail
        const guardResult = await guardrailAgent.run(complaint);
        if (!guardResult.passed) {
            await complaintModel.findByIdAndDelete(complaint._id);
            return res.status(400).json({ 
                success: false, 
                message: guardResult.warningMessage || "Voice complaint rejected by security filters." 
            });
        }

        // Intelligence (Gemini)
        const { getGeminiResponse } = await import('../services/gemini.service.mjs');
        const aiResult = await intelligenceAgent.run(guardResult.normalized, getGeminiResponse, complaint);

        // System (Geo-resolve + Dedup + Finalize)
        const finalResult = await systemAgent.run(aiResult, complaint, guardResult, 'processing');
        
        if (finalResult.statusTier === 'Yellow') {
            let audioResponse = null;
            try {
                const audioText = finalResult.responseMessage || "Bhiya, aapki complaint samajh aa gayi hai lekin aage badhne ke liye hume exact location chahiye. Bina location ke hum issue resolve nahi kar payenge.";
                const langCode = mapLanguageToGoogleCode(aiResult.detectedLanguage || 'mixed');
                const audioBuffer = await generateSpeech(audioText, langCode);
                if (audioBuffer && audioBuffer.length > 8) {
                    audioResponse = audioBuffer.toString('base64');
                }
            } catch (audioErr) {
                console.error('⚠️ [Voice] Failed to generate audio response for frontend:', audioErr.message);
            }

            return res.status(400).json({
                success: false,
                needsLocation: true,
                message: finalResult.responseMessage || "Bhiya, aapki complaint samajh aa gayi hai lekin aage badhne ke liye hume exact location chahiye. Bina location ke hum issue resolve nahi kar payenge.",
                transcribedText: transcribedText,
                complaintId: complaint._id,
                audioResponse: audioResponse
            });
        }

        // 4. Return the fully processed document
        const finalComplaint = await complaintModel.findById(complaint._id).populate('citizen', 'name mobileNo email');

        // 5. Send Confirmation Email (Async)
        if (finalComplaint.citizen && finalComplaint.citizen.email) {
            const deptName = DEPARTMENTS[finalComplaint.assignedDept]?.name || finalComplaint.assignedDept;
            const slaDate = finalComplaint.sla?.deadlineAt ? new Date(finalComplaint.sla.deadlineAt).toLocaleDateString() : 'N/A';
            
            sendEmail(
                finalComplaint.citizen.email,
                `Complaint Registered - ${finalComplaint.grievanceId}`,
                complaintConfirmationTemplate(
                    finalComplaint.citizen.name,
                    finalComplaint.grievanceId,
                    finalComplaint.ai?.category?.[0] || 'General',
                    finalComplaint.ai?.urgency || 'Medium',
                    deptName,
                    slaDate
                )
            ).catch(err => console.error('❌ Confirmation Email failed:', err.message));
        }

        // 6. Generate Audio Response for Frontend
        let audioResponse = null;
        try {
            const audioText = finalResult.response_message || aiResult.suggestedReply;
            const langCode = mapLanguageToGoogleCode(aiResult.detectedLanguage || 'mixed');
            const audioBuffer = await generateSpeech(audioText, langCode);
            if (audioBuffer && audioBuffer.length > 8) {
                audioResponse = audioBuffer.toString('base64');
            }
        } catch (audioErr) {
            console.error('⚠️ [Voice] Failed to generate audio response for frontend:', audioErr.message);
        }

        // 7. Notify via Socket
        const io = req.app.get('io');
        if (io && finalComplaint.assignedDept) {
            io.to(`dept_${finalComplaint.assignedDept}`).emit('queue:new_complaint', finalComplaint);
        }

        return res.status(201).json({
            success: true,
            message: "Voice complaint registered and analyzed successfully.",
            transcribedText: transcribedText,
            complaint: finalComplaint,
            aiSummary: finalComplaint.ai?.summary,
            audioResponse: audioResponse
        });

    } catch (error) {
        console.error("❌ Error in submitVoiceComplaint:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const mycomplaintController = async (req, res) => {
    try {
        let id = req.user.id || req.user._id;
        let mycomplaint = await complaintModel.find({ citizen: id })
            .populate("assignedTo", "name employeeId department")
            .sort({ createdAt: -1 });
        
        if (mycomplaint.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No complaint found"
            });
        }

        return res.json({
            success: true,
            message: "Complaints fetched successfully",
            mycomplaint,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const singleComplaintController = async (req, res) => {
    try {
        let { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid parameters"
            });
        }

        let complaint = await complaintModel.findById(id)
            .populate("citizen", "name mobileNo email")
            .populate("assignedTo", "name employeeId department");
        
        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found",
            });
        }
        
        return res.status(200).json({
            success: true,
            message: "Complaint fetched successfully",
            complaint,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const updateComplaintController = async (req, res) => {
    try {
        let { id } = req.params;
        let { status, note, remarks } = req.body;
        const finalNote = note || remarks || "Status updated";
        
        if (!id || !status) {
            return res.status(400).json({
                success: false,
                message: "Status and ID are required"
            });
        }

        const allowedStatus = ["open", "under_review", "review_required", "escalated", "resolved", "rejected"];

        if (!allowedStatus.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status"
            });
        }

        let existingComplaint = await complaintModel.findById(id).populate('citizen');

        if (!existingComplaint) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found",
            });
        }

        if (
            req.user.role === "officer" &&
            existingComplaint.assignedDept !== req.user.department
        ) {
            return res.status(403).json({
                success: false,
                message: "You can update only your department complaints",
            });
        }

        const oldStatus = existingComplaint.status;
        existingComplaint.status = status;
        existingComplaint.statusHistory.push({
            status,
            changedAt: new Date(),
            changedBy: req.user.id || req.user._id,
            note: finalNote
        });

        if (status === "resolved") {
            existingComplaint.resolution = {
                resolvedAt: new Date(),
                resolvedBy: req.user.id || req.user._id,
                note: finalNote
            };
            
            // Update Officer Performance
            if (existingComplaint.assignedTo) {
                await User.findByIdAndUpdate(existingComplaint.assignedTo, {
                    $inc: { "performanceStats.totalResolved": 1 }
                });
            }
        }

        const updatedComplaint = await existingComplaint.save();

        // 1. Email Notification
        updatedComplaint.populate([
            { path: 'citizen', select: 'name email mobileNo' },
            { path: 'statusHistory.changedBy', select: 'name' }
        ]).then(async (popDoc) => {
            const officerName = req.user.name || "System Officer";

            if (popDoc.citizen && popDoc.citizen.email) {
                sendEmail(
                    popDoc.citizen.email,
                    `Update on Your Complaint ${popDoc.grievanceId} - ${status}`,
                    statusUpdateTemplate(
                        popDoc.citizen.name,
                        popDoc.grievanceId,
                        oldStatus,
                        status,
                        officerName,
                        finalNote
                    )
                ).catch(err => console.error('❌ Status Email failed:', err.message));
            }

            // 2. WhatsApp Notification
            const whatsappId = popDoc.citizen?.mobileNo || popDoc.userId;
            if (whatsappId) {
                const { sendWhatsAppMessage } = require("../services/whatsapp.service");
                const msg = `🔔 *Update on Your Complaint*\nTicket: \`${popDoc.grievanceId}\`\n\nStatus changed from *${oldStatus}* to *${status}*.\n\n👤 *Officer:* ${officerName}\n📝 *Note:* ${finalNote}\n\n_Dhanyavad, SmartGrieve Bhopal._`;
                await sendWhatsAppMessage(whatsappId, msg).catch(err => console.error('❌ Status WhatsApp failed:', err.message));
            }
        });

        const io = req.app.get('io');
        if (io) {
            io.to(`dept_${updatedComplaint.assignedDept}`).emit('complaint:updated', updatedComplaint);
            io.to(`user_${updatedComplaint.citizen}`).emit('complaint:status_changed', updatedComplaint);
        }

        return res.status(200).json({
            success: true,
            message: "Complaint status updated successfully",
            updatedComplaint,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const departmentComplaintsController = async (req, res) => {
    try {
        const department = req.user.department;
        if (!department && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "No department assigned to this officer" });
        }

        let query = {};
        if (req.user.role === 'officer') {
            // Regular officers only see their specific assignments
            query = { 
                assignedDept: department,
                assignedTo: req.user.id || req.user._id 
            };
        } else if (req.user.role === 'senior_officer') {
            // Senior officers see EVERYTHING in their department
            query = { assignedDept: department };
        }
        // Admin (handled by top-level empty query if needed, or explicitly here)
        if (req.user.role === 'admin') query = {};
        
        const complaints = await complaintModel.find(query)
            .populate("citizen", "name mobileNo email")
            .populate("assignedTo", "name employeeId department")
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            count: complaints.length,
            complaints
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getWardStatsController = async (req, res) => {
    try {
        const stats = await complaintModel.aggregate([
            {
                $group: {
                    _id: "$location.ward",
                    count: { $sum: 1 },
                    resolved: {
                        $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    ward: "$_id",
                    count: 1,
                    resolved: 1
                }
            }
        ]);

        return res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getAnalyticsSummary = async (req, res) => {
    try {
        const stats = await complaintModel.aggregate([
            {
                $group: {
                    _id: "$assignedDept",
                    total: { $sum: 1 },
                    open: {
                        $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] }
                    },
                    resolved: {
                        $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] }
                    },
                    pending: {
                        $sum: { $cond: [{ $in: ["$status", ["under_review", "review_required", "escalated"]] }, 1, 0] }
                    }
                }
            }
        ]);

        return res.json({
            success: true,
            departments: stats
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const rateComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const { stars, feedback } = req.body;

        if (!stars || stars < 1 || stars > 5) {
            return res.status(400).json({ success: false, message: "Valid rating (1-5) is required" });
        }

        const complaint = await complaintModel.findById(id);
        if (!complaint) return res.status(404).json({ success: false, message: "Complaint not found" });

        if (complaint.citizen.toString() !== (req.user.id || req.user._id).toString()) {
            return res.status(403).json({ success: false, message: "Only the citizen who filed this can rate it" });
        }

        if (complaint.status !== 'resolved') {
            return res.status(400).json({ success: false, message: "Only resolved complaints can be rated" });
        }

        if (complaint.rating.stars) {
            return res.status(400).json({ success: false, message: "This complaint has already been rated" });
        }

        complaint.rating = {
            stars,
            feedback,
            ratedAt: new Date()
        };

        await complaint.save();

        // Update Officer Average Rating
        if (complaint.assignedTo) {
            const officer = await User.findById(complaint.assignedTo);
            if (officer) {
                const oldTotal = officer.performanceStats.totalRatings || 0;
                const oldAvg = officer.performanceStats.averageRating || 0;
                
                const newTotal = oldTotal + 1;
                const newAvg = ((oldAvg * oldTotal) + stars) / newTotal;

                officer.performanceStats.totalRatings = newTotal;
                officer.performanceStats.averageRating = newAvg;
                await officer.save();
            }
        }

        return res.status(200).json({
            success: true,
            message: "Thank you for your feedback!",
            complaint
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { 
    ComplaintController, 
    mycomplaintController, 
    singleComplaintController, 
    updateComplaintController, 
    departmentComplaintsController, 
    getWardStatsController,
    getAnalyticsSummary,
    submitVoiceComplaint,
    rateComplaint
};