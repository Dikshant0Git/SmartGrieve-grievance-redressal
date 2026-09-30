/**
 * SYSTEM AGENT — The Enforcer
 * 
 * Hard-coded geo-resolution, duplicate detection, and final DB write.
 * NEVER calls the AI. Takes Intelligence Agent output and:
 *   1. Resolves location_text to exact coordinates via SystemResolver
 *   2. Checks for duplicates
 *   3. Determines final status_tier
 *   4. Writes to ProcessedGrievance
 *   5. Triggers WhatsApp notification
 */

const Grievance = require('../../models/grievance.model');
const Complaint = require('../../models/complaint.model');
const User = require('../../models/user.model');
const Department = require('../../models/department.model');
const AssignmentService = require('../assignment.service');
const { resolveLocation, resolveZoneFromCoords } = require('../system.resolver');
const { checkDuplicate } = require('../duplicate.detector');
const { sendWhatsAppMessage, sendWhatsAppAudioMessage } = require('../whatsapp.service');
const { generateSpeech, mapLanguageToGoogleCode } = require('../textToSpeech.service');

const CATEGORY_TO_DEPT = {
    "Sanitation": "MUNC",
    "Roads": "MUNC",
    "Water": "MUNC",
    "Electricity": "ELEC",
    "Health": "HLTH",
    "Transport": "TRNS",
    "Housing": "REVN",
    "Land": "REVN",
    "Corruption": "GENL",
    "Other": "GENL"
};

/**
 * Run the System Agent.
 * 
 * @param {Object} aiResult - Output from Intelligence Agent
 * @param {Object} doc - The raw Grievance mongoose document
 * @param {Object} guardResult - Output from Guardrail (for emergency flag)
 * @returns {Object} The final ProcessedGrievance document
 */
async function run(aiResult, doc, guardResult, previousStatus) {
    const ticketId = doc._id.toString().substring(0, 8).toUpperCase();

    // ─── Step 1: Geo-Resolution ────────────────────────────────────
    // Priority chain: EXIF GPS (98) > Landmark (95) > Hub (80) > Unresolved
    let geoResult = resolveLocation(aiResult.location_text);
    let locationSource = 'text';

    // Check for EXIF GPS data from attached images
    const exifMedia = doc.media?.find(m => m.exif?.available);
    if (exifMedia) {
        const exifCoords = [exifMedia.exif.lat, exifMedia.exif.lng];
        const zoneInfo = resolveZoneFromCoords(exifMedia.exif.lat, exifMedia.exif.lng);

        // EXIF GPS has highest priority (confidence 98)
        if (geoResult.resolution_method === 'unresolved') {
            // No text location found, use EXIF entirely
            geoResult.coordinates = exifCoords;
            geoResult.zone = zoneInfo.zone;
            geoResult.landmark = zoneInfo.landmark;
            geoResult.confidence = 98;
            geoResult.resolution_method = 'exif_gps';
            locationSource = 'exif';
            console.log(`📍 [SYSTEM] EXIF GPS used: [${exifCoords}] → Zone ${zoneInfo.zone}`);
        } else {
            // Text location also found, combine for highest confidence
            locationSource = 'text+exif';
            console.log(`📍 [SYSTEM] Both text and EXIF locations available. Using text-resolved location, enriched with EXIF.`);
        }
    }

    // ─── Also try resolving from the FULL complaint text ───────────
    // The AI might return a vague location_text, but the full complaint
    // text may contain landmark names that the resolver can match directly.
    if (geoResult.resolution_method === 'unresolved' && doc.finalTextForAI) {
        console.log(`📍 [SYSTEM] AI location_text unresolved. Trying full complaint text...`);
        const fullTextResult = resolveLocation(doc.finalTextForAI);
        if (fullTextResult.resolution_method !== 'unresolved') {
            geoResult = fullTextResult;
            console.log(`📍 [SYSTEM] ✅ Full-text fallback matched: ${geoResult.landmark}`);
        }
    }

    // ─── Handle text-based location when resolver can't match ──────
    // The AI extracted location_text (e.g., "MP Nagar", "mere ghar ke paas").
    // Even if our resolver can't match it to coordinates, the text-based location
    // is STILL VALID *only if* it's not too vague.
    const vagueStrings = [
        'not specified', 'unknown', 'none', 'n/a', 'location not mentioned', 
        'not mentioned', 'not available', 'null', 'undefined', 'bhopal',
        'mere ghar', 'apne ghar', 'my house', 'home', 'yahan', 'wahan', 'yaha', 
        'pass mein', 'nearby', 'near me', 'around', 'inside', 'office', 
        'yaha par', 'idhar', 'udhar', 'apne area mein', 'mere area mein', 
        'road par', 'sadak par', 'hamare yahan', 'apne yahan'
    ];

    const isLocationVague = (text) => {
        if (!text) return true;
        const clean = text.trim().toLowerCase();
        if (clean.length < 4) return true; // Too short to be a landmark
        if (vagueStrings.some(v => clean.includes(v) && clean.length < v.length + 5)) return true;
        return false;
    };

    let hasTextLocation = aiResult.location_text && !isLocationVague(aiResult.location_text);

    // ─── SAFETY NET: If AI returned empty location_text, try extracting from raw text ─
    // Gemini sometimes returns "" for location_text even when the user clearly
    // mentioned a place. Scan the complaint text for location-indicating patterns.
    if (!hasTextLocation && doc.finalTextForAI) {
        const rawText = doc.finalTextForAI;
        // Regex to extract text near location indicator words
        const locationPatterns = [
            /(?:near|paas|pass|saamne|peeche|aage)\s+(.{3,30})/i,
            // Removed 'me', 'mai' because they heavily overlap with English pronouns/words ('me', 'may')
            /(.{3,30})\s+(?:|area|colony|nagar|road|chowk|square|ward|zone|sector|phase|chauraha|naka)/i,
            /(?:at|in|near|on)\s+(.{3,30})/i,
            /(?:ward|zone)\s*(?:no\.?)?\s*(\d+)/i,
        ];

        for (const pattern of locationPatterns) {
            const match = rawText.match(pattern);
            if (match && match[1]) {
                const extracted = match[1].trim().replace(/[.,!?]+$/, '');
                if (!isLocationVague(extracted)) {
                    aiResult.location_text = extracted;
                    hasTextLocation = true;
                    console.log(`📍 [SYSTEM] Fallback location extracted from raw text: "${aiResult.location_text}"`);
                    break;
                } else {
                    console.log(`📍 [SYSTEM] Extracted fallback "${extracted}" was too vague. Skipping.`);
                }
            }
        }
    }

    if (geoResult.resolution_method === 'unresolved' && hasTextLocation) {
        // Text-based location was extracted but could not be resolved against Bhopal constitution.
        // Keep unresolved: it must NOT be accepted as Green.
        geoResult.landmark = aiResult.location_text.trim();
        console.log(`📍 [SYSTEM] Unresolved text location: "${geoResult.landmark}" (no coordinate or landmark match)`);
    } else if ((geoResult.resolution_method === 'hub_centroid' || geoResult.resolution_method === 'ward_alias') && hasTextLocation) {
        // If it resolved to a ward, but the user provided a more specific text (like a colony name), use it for display
        if (aiResult.location_text.trim().length > geoResult.landmark.length) {
            geoResult.landmark = aiResult.location_text.trim();
        }
    }

    let invalidLocation = false;

    // Merge confidence — clamp to 0-100 range
    let finalConfidence = aiResult.confidence_score || 50;
    if (geoResult.resolution_method === 'exif_gps') {
        finalConfidence = Math.max(finalConfidence, 98);
    } else if (geoResult.resolution_method === 'landmark_exact') {
        finalConfidence = Math.max(finalConfidence, 95);
    } else if (geoResult.resolution_method === 'hub_centroid') {
        finalConfidence = Math.max(finalConfidence, 80);
    } else if (geoResult.resolution_method === 'ai_text') {
        finalConfidence = Math.max(finalConfidence, 60);
    } else if (geoResult.resolution_method === 'unresolved' && !guardResult.isEmergency) {
        finalConfidence = Math.min(finalConfidence, 40);
    }
    // Clamp to valid range (Mongoose schema has max: 100)
    finalConfidence = Math.min(100, Math.max(0, finalConfidence));

    // Map common AI misclassifications
    const validCategories = ['Sanitation', 'Roads', 'Water', 'Electricity', 'Health', 'Transport', 'Housing', 'Land', 'Corruption', 'Other', 'Rejected'];
    let finalCategory = aiResult.category || 'Other';

    // Normalize case: Capitalize first letter
    if (typeof finalCategory === 'string' && finalCategory.length > 0) {
        finalCategory = finalCategory.charAt(0).toUpperCase() + finalCategory.slice(1);
    }

    // Map common AI misclassifications or rejections
    if (finalCategory === 'Waste Management' || finalCategory === 'Waste management') finalCategory = 'Sanitation';
    if (finalCategory === 'Traffic' || finalCategory === 'traffic') finalCategory = 'Transport';
    if (finalCategory === 'PWD' || finalCategory === 'Pwd') finalCategory = 'Roads';

    // If Spam, handle accordingly
    if (finalCategory === 'Spam' || finalCategory === 'spam') {
        finalCategory = 'Rejected';
    }

    if (!validCategories.includes(finalCategory)) {
        if (finalCategory === 'Unclassified') {
            console.warn(`⚠️ [SYSTEM] Unclassified category received. Mapping to Other for manual review.`);
            finalCategory = 'Other';
        } else {
            console.warn(`⚠️ [SYSTEM] Invalid or rejection category "${finalCategory}" received. Mapping to Rejected.`);
            finalCategory = 'Rejected';
        }
    }

    // Assign department based on category
    aiResult.departmentId = CATEGORY_TO_DEPT[finalCategory] || 'GENL';

    // ─── Step 2: Determine Status Tier ─────────────────────────────
    // GREEN: valid complaint with exact or landmark location
    // YELLOW: unresolved location or area-only (needs citizen to provide landmark/street/pin)
    // RED: rejected by AI (out of scope)
    let statusTier;
    const isExistingComplaint = doc.constructor.modelName === 'Complaint'; // True for Web flow, False for WhatsApp flow

    const isAreaOnly = !isExistingComplaint && (
                       geoResult.resolution_method === 'hub_centroid' || 
                       geoResult.resolution_method === 'ward_alias' || 
                       geoResult.resolution_method === 'zone_name');
    
    const isUnresolved = isExistingComplaint 
        ? (!hasTextLocation && !geoResult.landmark) 
        : (geoResult.resolution_method === 'unresolved' || 
           geoResult.resolution_method === 'none' ||
           geoResult.resolution_method === 'ai_text' ||
           !geoResult.landmark);

    if (finalCategory === 'Rejected') {
        statusTier = 'Red';
    } else if ((isUnresolved || isAreaOnly) && !guardResult?.isEmergency) {
        // Unresolved or area-only -> Yellow (ask)
        statusTier = 'Yellow';
    } else {
        // Exact/landmark location or emergency -> Green
        statusTier = 'Green';
    }

    // ─── Step 3: Response Message Construction ─────────────────────
    // Build a proper, contextual response that tells the user what's happening
    let responseMessage = aiResult.response_message || aiResult.suggestedReply;

    const lang = aiResult.detectedLanguage || 'mixed';

    // OVERRIDE AI's generic response for Yellow tier to prevent mixed messaging
    if (invalidLocation) {
        if (lang === 'en') {
            responseMessage = 'Citizen, Bhopal has only 14 zones. The zone you mentioned is not valid. Please share the correct zone or address.';
        } else if (lang === 'hi') {
            responseMessage = 'नागरिक, भोपाल में सिर्फ 14 जोन हैं। आपने जो जोन बताया है वह मान्य नहीं है। कृपया सही जोन या पता साझा करें।';
        } else {
            responseMessage = 'Bhiya, Bhopal mein sirf 14 zones hain. Aapne jo zone bataya hai woh valid nahi hai. Kripya sahi zone ya address share karein.';
        }
    } else if (statusTier === 'Yellow') {
        if (previousStatus === 'Awaiting_Input') {
            if (lang === 'en') {
                responseMessage = 'Citizen, we asked for location before but couldn\'t confirm it. This complaint has been sent for manual review, but you can try again with the correct location.';
            } else if (lang === 'hi') {
                responseMessage = 'नागरिक, हमने पहले भी लोकेशन पूछी थी पर कन्फर्म नहीं हो पाई। यह शिकायत मैनुअल रिव्यू के लिए भेज दी गई है, पर आप चाहें तो सही लोकेशन के साथ फिर से लिख सकते हैं।';
            } else {
                responseMessage = 'Bhiya, humne pehle bhi location puchi thi par confirm nahi ho payi. Ye complaint manual review ke liye bhej di gayi hai, par aap chahein toh sahi location ke saath fir se likh sakte hain.';
            }
        } else {
            if (lang === 'en') {
                responseMessage = 'Citizen, we understood your complaint but we need the *exact location* to proceed. We won\'t be able to resolve the issue without a location.';
            } else if (lang === 'hi') {
                responseMessage = 'नागरिक, आपकी शिकायत समझ आ गई है लेकिन आगे बढ़ने के लिए हमें *exact location* चाहिए। बिना लोकेशन के हम समस्या का समाधान नहीं कर पाएंगे।';
            } else {
                responseMessage = 'Bhiya, aapki complaint samajh aa gayi hai lekin aage badhne ke liye hume *exact location* chahiye. Bina location ke hum issue resolve nahi kar payenge.';
            }
        }
    } else if (!responseMessage || responseMessage.trim() === '') {
        if (statusTier === 'Green') {
            if (lang === 'en') {
                responseMessage = 'Thank you, your complaint has been logged and the concerned department has been notified.';
            } else if (lang === 'hi') {
                responseMessage = 'शुक्रिया, आपकी शिकायत दर्ज कर ली गई है और संबंधित विभाग को सूचित कर दिया गया है।';
            } else {
                responseMessage = 'Shukriya Bhiya, aapki complaint log ho gayi hai aur concerned department ko notify kar diya gaya hai.';
            }
        } else {
            if (lang === 'en') {
                responseMessage = 'Sorry, this request cannot be processed. Please report only civic issues.';
            } else if (lang === 'hi') {
                responseMessage = 'क्षमा करें, इस अनुरोध पर कार्रवाई नहीं की जा सकती। कृपया केवल नागरिक समस्याओं की रिपोर्ट करें।';
            } else {
                responseMessage = 'Sorry, is request ko process nahi kiya ja sakta. Please civic issues hi report karein.';
            }
        }
    }

    // ─── YELLOW PAUSE: Ask for location details ───────────────────
    if (statusTier === 'Yellow') {
        // Still save to Grievance so data is NOT lost
        doc.classification = {
            category: finalCategory,
            priority: aiResult.priority || 'Medium',
            summary: aiResult.summary || 'Pending location details'
        };
        doc.status = 'Awaiting_Input';
        try {
            await doc.save();
            console.log(`💾 [SYSTEM] Grievance ${ticketId} saved with status Awaiting_Input.`);
        } catch (saveErr) {
            console.error(`❌ [SYSTEM] Failed to save Grievance ${ticketId}:`, saveErr.message);
        }

        // Preliminary Complaint creation removed to prevent T-003 Duplicate Complaint bug.
        // The Grievance remains in Awaiting_Input state and will be converted to a single Complaint
        // upon receiving the location and reaching the Green state.

        // Send detailed WhatsApp message asking for specifics
        const notification = `⚠️ *Location Required*\nTicket ID: \`${ticketId}\`\n\n${responseMessage}\n\n📍 *Kripya yeh details bhejein:*\n• Paas ka koi landmark (DB Mall, Kamla Park, etc.)\n• Colony/Area ka naam\n• Ya Google Maps location share karein\n\n_Aapki complaint safe hai aur location milte hi process ho jayegi._`;
        await sendWhatsAppMessage(doc.userId, notification);

        console.log(`\n⏸️  [AWAITING INPUT] Ticket ${ticketId} paused, waiting for user location...`);
        return { statusTier: 'Yellow', paused: true, responseMessage };
    }

    // ─── Step 4: Duplicate Detection ───────────────────────────────
    let isDuplicate = false;
    let duplicateOf = null;

    if (statusTier === 'Green') {
        try {
            const dedupResult = await checkDuplicate({
                summary: aiResult.summary,
                coordinates: geoResult.coordinates,
                category: finalCategory
            });
            isDuplicate = dedupResult.isDuplicate;
            duplicateOf = dedupResult.matchedTicket;
        } catch (dedupErr) {
            console.error(`⚠️ [SYSTEM] Dedup check failed (non-blocking):`, dedupErr.message);
        }
    }

    // ─── Step 5: Save or Delete raw Grievance ─────────────────────────────
    doc.classification = {
        category: finalCategory,
        priority: aiResult.priority,
        summary: aiResult.summary
    };
    if (!isExistingComplaint) {
        doc.status = statusTier === 'Red' ? 'Rejected' : 'Resolved';
        try {
            if (statusTier === 'Red') {
                // Delete the staging grievance if rejected
                await Grievance.findByIdAndDelete(doc._id);
                console.log(`🗑️ [SYSTEM] Grievance ${ticketId} DELETED (Rejected by AI)`);
            } else {
                await doc.save();
                console.log(`💾 [SYSTEM] Grievance ${ticketId} saved with status ${doc.status}.`);
            }
        } catch (saveErr) {
            console.error(`❌ [SYSTEM] Failed to save/delete Grievance ${ticketId}:`, saveErr.message);
        }
    } else {
        if (statusTier === 'Red') {
             // Web flow rejection happens in complaint.controller, but just in case:
             doc.status = 'Rejected';
        }
    }

    // ─── Step 6: Save to ProcessedGrievance ────────────────────────
    const mediaForDb = (doc.media || []).filter(m => m.image_url).map(m => ({
        image_url: m.image_url,
        public_id: m.public_id
    }));

    let finalOfficer = null;

    if (statusTier !== 'Red') {
        try {
            // Fetch dynamic SLA from Department model
            const dept = await Department.findOne({ code: aiResult.departmentId });
            const slaDays = (dept && dept.sla && dept.sla.get(finalCategory)) || 7;

            const deadlineAt = new Date();
            deadlineAt.setDate(deadlineAt.getDate() + slaDays);

            let requiresManualReview = aiResult.requiresManualReview || false;

            if (aiResult.category === 'Unclassified' && geoResult.resolution_method !== 'unresolved' && aiResult.departmentId !== 'UNKNOWN') {
                requiresManualReview = false;
            } else if (aiResult.category === 'Unclassified') {
                requiresManualReview = true;
            }

            // isExistingComplaint is now defined above

            const complaintData = {
                source: doc.source || (isExistingComplaint ? doc.source : 'WhatsApp'),
                userId: doc.userId || (isExistingComplaint ? doc.userId : null),
                status: requiresManualReview ? "review_required" : "open",
                text: doc.finalTextForAI || aiResult.summary || doc.text,
                location: {
                    district: "Bhopal",
                    ward: (doc.location?.ward) || (geoResult.ward ? geoResult.ward.toString() : null),
                    coordinates: geoResult.coordinates?.length ? geoResult.coordinates : (doc.location?.coordinates || null),
                    address: geoResult.landmark || doc.location?.address || "Bhopal"
                },
                ai: {
                    category: [finalCategory],
                    urgency: aiResult.severity || 'Medium',
                    confidence: finalConfidence / 100,
                    summary: aiResult.summary
                },
                assignedDept: aiResult.departmentId,
                sla: {
                    deadlineAt: deadlineAt,
                    breached: false,
                    escalatedAt: null
                },
                media: mediaForDb,
                ticketId: ticketId || doc.ticketId,
                finalTextForAI: doc.finalTextForAI,
                flags: {
                    isDuplicate: isDuplicate
                }
            };

            let finalComplaint;
            if (isExistingComplaint) {
                // Update existing Complaint (Web flow)
                console.log(`📝 [SYSTEM] Updating existing Complaint ${doc._id} (Web flow).`);
                doc.set(complaintData);
                finalComplaint = doc;
            } else {
                // Create new Complaint (WhatsApp flow)
                console.log(`💾 [SYSTEM] Creating new Complaint for ${ticketId} (WhatsApp flow).`);
                finalComplaint = new Complaint(complaintData);
            }
            
            // Smart Officer Assignment
            const assignedOfficerId = await AssignmentService.getBestOfficer(finalComplaint);
            if (assignedOfficerId) {
                finalComplaint.assignedTo = assignedOfficerId;
                // Update Officer Stats
                await User.findByIdAndUpdate(assignedOfficerId, {
                    $inc: { "performanceStats.totalAssigned": 1 }
                });
            }

            await finalComplaint.save();
            console.log(`💾 [SYSTEM] Complaint ${finalComplaint._id} saved. Ward: ${finalComplaint.location?.ward}, Status: ${finalComplaint.status}`);
        } catch (procErr) {
            console.error(`❌ [SYSTEM] CRITICAL: Failed to save Complaint:`, procErr.message);
        }
    } else {
        console.log(`🚫 [SYSTEM] Skipped saving Complaint for ${ticketId} (Rejected by AI)`);
    }

    // ─── Step 7: WhatsApp Notification ──────────────────────────────
    const deptNames = {
        'MUNC': 'Municipal Corporation',
        'ELEC': 'Electricity Board',
        'HLTH': 'Health Department',
        'TRNS': 'Transport Department',
        'REVN': 'Revenue Department',
        'GENL': 'General Administration'
    };

    let notification = '';
    if (statusTier === 'Green') {
        if (isDuplicate) {
            notification = `ℹ️ *Duplicate Detected*\nTicket ID: \`${ticketId}\`\n\nIs area mein ek similar complaint pehle se logged hai aur hamari team kaam kar rahi hai!\n\nCategory: ${finalCategory}\nArea: ${geoResult.landmark || 'Bhopal'}`;
        } else {
            const deptName = deptNames[aiResult.departmentId] || 'General Administration';
            const officerName = finalOfficer ? finalOfficer.name : 'Allocating...';
            
            notification = `✅ *Complaint Registered*\nTicket ID: \`${ticketId}\`\n\n${responseMessage}\n\n📋 *Details:*\n• Department: ${deptName}\n• Category: ${finalCategory}\n• Priority: ${aiResult.priority}\n• Area: ${geoResult.landmark || 'Bhopal'}\n• Officer: ${officerName}\n\n_Aapki complaint concerned department ko forward kar di gayi hai._`;
        }
    } else if (statusTier === 'Red') {
        notification = `🛑 *Request Rejected*\n\n${responseMessage}\n\n_Note: Smartgrieve sirf civic issues handle karta hai jaise sadak, bijli, safai, aur paani._`;
    }

    if (notification) {
        await sendWhatsAppMessage(doc.userId, notification);
        
        // If the user sent a voice note, also send an audio confirmation
        const wasVoiceNote = doc.audioTranscription || (doc.rawContent && doc.rawContent.some(c => c.includes('[Voice note attached]')));
        if (wasVoiceNote && doc.source === 'WhatsApp') {
            try {
                console.log(`🎵 [SYSTEM] User sent a voice note. Generating audio reply...`);
                const audioLangCode = mapLanguageToGoogleCode(aiResult.detectedLanguage || 'mixed');
                // Create a slightly cleaner version for audio
                const audioText = notification.replace(/\*/g, '').replace(/_/g, '').replace(/`/g, '');
                const audioBuffer = await generateSpeech(audioText, audioLangCode);
                
                if (audioBuffer && audioBuffer.length > 8) { // check if not mock
                    await sendWhatsAppAudioMessage(doc.userId, audioBuffer);
                    console.log(`✅ [SYSTEM] Audio reply sent to ${doc.userId}`);
                }
            } catch (ttsErr) {
                console.error(`⚠️ [SYSTEM] Failed to send audio reply:`, ttsErr.message);
            }
        }
    }

    // ─── Step 8: Terminal Dashboard ─────────────────────────────────
    const dedup = isDuplicate ? '⚠️ DUPLICATE' : '✅ UNIQUE';
    console.log(`\n╔════════════════════════════════════════════════════════════════════╗`);
    console.log(`║           🏠 CITYGRIEVE AGENT SWARM DASHBOARD                    ║`);
    console.log(`╠════════════════════════════════════════════════════════════════════╣`);
    console.log(`║  🎫 TICKET    : ${ticketId.padEnd(50)} ║`);
    console.log(`║  👤 USER      : ${(doc.userId || 'Unknown').padEnd(50)} ║`);
    console.log(`╠════════════════════════════════════════════════════════════════════╣`);
    console.log(`║  📂 CATEGORY  : ${(finalCategory).toUpperCase().padEnd(50)} ║`);
    console.log(`║  🚨 PRIORITY  : ${(aiResult.priority || 'Unknown').toUpperCase().padEnd(50)} ║`);
    console.log(`║  📊 CONFIDENCE: ${finalConfidence.toString().padEnd(50)} ║`);
    console.log(`║  📍 LOCATION  : ${(geoResult.landmark || 'Unknown').padEnd(50)} ║`);
    console.log(`║  🗺️  RESOLVED  : ${(geoResult.resolution_method || 'unknown').padEnd(50)} ║`);
    console.log(`║  📡 LOC SRC   : ${locationSource.padEnd(50)} ║`);
    console.log(`║  🚥 STATUS    : ${statusTier.toUpperCase().padEnd(50)} ║`);
    console.log(`║  📷 IMAGES    : ${(mediaForDb.length.toString() + ' attached').padEnd(50)} ║`);
    console.log(`║  🔍 DUPLICATE : ${dedup.padEnd(50)} ║`);
    console.log(`╠════════════════════════════════════════════════════════════════════╣`);
    console.log(`║  📝 SUMMARY:                                                      ║`);

    const summaryText = aiResult.summary || 'No summary';
    const words = summaryText.split(' ');
    let line = '';
    words.forEach(word => {
        if ((line + word).length < 60) {
            line += word + ' ';
        } else {
            console.log(`║  ${line.padEnd(65)} ║`);
            line = word + ' ';
        }
    });
    console.log(`║  ${line.padEnd(65)} ║`);
    console.log(`╠════════════════════════════════════════════════════════════════════╣`);
    console.log(`║  ✅ STATUS    : PROCESSED & LOGGED TO DATABASE                     ║`);
    console.log(`╚════════════════════════════════════════════════════════════════════╝\n`);

    // ─── Step 9: Finalize Staging Document ──────────────────────────
    if (!isExistingComplaint) {
        try {
            doc.status = 'Resolved';
            await doc.save();
            console.log(`🏁 [SYSTEM] Staging Grievance ${ticketId} marked as Resolved.`);
        } catch (finalErr) {
            console.error(`⚠️ [SYSTEM] Failed to resolve staging document:`, finalErr.message);
        }
    }

    return { statusTier, paused: false };
}

module.exports = { run };
