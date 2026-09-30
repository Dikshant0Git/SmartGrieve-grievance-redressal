/**
 * ORCHESTRATOR SERVICE (formerly ai.service.js)
 * 
 * Thin coordinator that calls the 3 agents in sequence:
 *   1. Guardrail Agent  → Pre-AI filter
 *   2. Intelligence Agent → Gemini call
 *   3. System Agent → Geo-resolve + Dedup + DB write
 * 
 * The BullMQ queue and worker logic lives here.
 */

const { Queue, Worker } = require('bullmq');
const Complaint = require('../models/complaint.model');
const Grievance = require('../models/grievance.model');
const { sendWhatsAppMessage } = require('./whatsapp.service');
const { QueueEvents } = require('bullmq');

// Agent imports
const guardrailAgent = require('./agents/guardrail.agent');
const intelligenceAgent = require('./agents/intelligence.agent');
const systemAgent = require('./agents/system.agent');
const mediaService = require('./media.service');

const connection = require('../config/redis.config');

connection.on('ready', () => {
    console.log('✅ Redis connected and ready...');
});

const aiQueue = new Queue('ai-processing', { connection });
const intakeQueue = new Queue('intake', { connection });
const bundleQueue = new Queue('bundle', { connection });

// ═══════════════════════════════════════════════════════════════════
//  THE WORKERS
// ═══════════════════════════════════════════════════════════════════
const worker = new Worker('ai-processing', async (job) => {
    const { id } = job.data;
    console.log(`🤖 [AI Worker] Job ${job.id} picked up for grievance ${id}`);

    let userId = null;
    try {
        const doc = await Grievance.findById(id);
        if (!doc) {
            console.warn(`⚠️ [AI Worker] Grievance ${id} not found in database.`);
            return;
        }

        userId = doc.userId;
        const previousStatus = doc.status; // Save previous status
        doc.status = 'Processing';
        await doc.save();

        // ─── AGENT 1: Guardrail ────────────────────────────────────
        console.log(`\n🛡️  [GUARDRAIL] Scanning message from ${doc.userId}...`);
        const guardResult = await guardrailAgent.run(doc);

        if (!guardResult.passed) {
            // Rejected at the gate — no AI call needed
            // Delete the junk document to keep the database clean
            await Grievance.findByIdAndDelete(doc._id);

            if (guardResult.warningMessage) {
                await sendWhatsAppMessage(doc.userId, guardResult.warningMessage);
            }

            console.log(` [GUARDRAIL] Message REJECTED (${guardResult.tier}). Deleted from DB. No AI call made.`);
            return;
        }

        console.log(` [GUARDRAIL] Passed. Emergency: ${guardResult.isEmergency}. Forwarding to Intelligence Agent...`);

        // ─── AGENT 2: Intelligence (Gemini Call) ───────────────────
        console.log(` [INTELLIGENCE] Calling Gemini for intent extraction...`);
        const { getGeminiResponse } = await import('./gemini.service.mjs');
        const aiResult = await intelligenceAgent.run(guardResult.normalized, getGeminiResponse, doc);

        // Check if AI failed (e.g., Quota Exceeded)
        if (aiResult.subCategory === 'System Error') {
            console.log(`❌ [INTELLIGENCE] AI call failed or quota exceeded. Deleting grievance to keep DB clean.`);
            await Grievance.findByIdAndDelete(doc._id);

            if (doc.source === 'WhatsApp') {
                await sendWhatsAppMessage(doc.userId, "The Servers are Down due to some issues please try again later.");
            }
            return;
        }

        console.log(` [INTELLIGENCE] Category: ${aiResult.category}, Priority: ${aiResult.priority}, Location Text: "${aiResult.location_text}", Confidence: ${aiResult.confidence_score}`);
        console.log(` [INTELLIGENCE] Summary: "${aiResult.summary}"`);
        console.log(` [INTELLIGENCE] Raw AI (first 200 chars): "${(aiResult.rawAIResponse || '').substring(0, 200)}"`);
        console.log(` [INTELLIGENCE] Complaint text was: "${(doc.finalTextForAI || '').substring(0, 100)}"`);


        // ─── AGENT 3: System (Resolver + Dedup + DB) ───────────────
        console.log(`  [SYSTEM] Resolving location and checking duplicates...`);
        const finalResult = await systemAgent.run(aiResult, doc, guardResult, previousStatus);

        if (finalResult.paused) {
            console.log(`  [SYSTEM] Ticket paused (Yellow). Awaiting user reply.`);
        } else {
            console.log(` [SYSTEM] Pipeline complete. Status: ${finalResult.statusTier}`);
        }

    } catch (err) {
        console.error(`\n WORKER ERROR [Job ${job.id}]:`, err.message);
        console.error(` Stack:`, err.stack);

        // Try to mark as failed so it's not stuck in 'Processing' forever
        try {
            // Check both collections as it might be in transition
            const failedDoc = await Grievance.findById(id) || await Complaint.findById(id);
            if (failedDoc && (failedDoc.status === 'Processing' || failedDoc.status === 'Pending')) {
                failedDoc.status = 'Failed';
                await failedDoc.save();
            }
        } catch (e) { /* best-effort */ }

        throw err;
    } finally {
        // ALWAYS clean up buffers
        if (userId) {
            if (global._mediaBuffers?.has(userId)) {
                global._mediaBuffers.delete(userId);
            }
            if (global._audioBuffers?.has(userId)) {
                global._audioBuffers.delete(userId);
            }
        }
    }
}, {
    connection,
    concurrency: 1,
    limiter: { max: 10, duration: 60000 }
});

// ═══════════════════════════════════════════════════════════════════
//  FAILSAFE — Handle AI Downtime & Permanent Failures
// ═══════════════════════════════════════════════════════════════════
worker.on('failed', async (job, err) => {
    console.error(` Job ${job?.id} completely failed. Reason: ${err.message}`);

    try {
        if (!job) return;
        const { id } = job.data;
        const doc = await Grievance.findById(id) || await Complaint.findById(id);
        if (doc) {
            doc.status = 'Failed';
            await doc.save();

            const fallbackMessage = ` *System Alert*\n\nCurrently our AI servers are overloaded or turned off due to quota limits.\n\nPlease request again later.`;
            await sendWhatsAppMessage(doc.userId, fallbackMessage);
        }
    } catch (fallbackErr) {
        console.error('Failed to execute fallback notification:', fallbackErr);
    }
});

// ═══════════════════════════════════════════════════════════════════
//  NEW WORKERS & BUNDLING
// ═══════════════════════════════════════════════════════════════════

const bundleWorker = new Worker('bundle', async (job) => {
    const { phoneNumber, grievanceId } = job.data;
    console.log(`🤖 30s silence reached for ${phoneNumber}. Finalizing bundle via BullMQ...`);

    try {
        const finalDoc = await Grievance.findById(grievanceId);
        if (!finalDoc) return;

        const combinedText = finalDoc.rawContent.join(" ").trim();
        console.log(`📦 Bundled ${finalDoc.rawContent.length} messages + ${finalDoc.media?.length || 0} images: "${combinedText}"`);

        finalDoc.finalTextForAI = combinedText;
        finalDoc.status = 'Pending';
        await finalDoc.save();

        await processGrievanceWithAI(finalDoc._id);

        console.log(`✅ Finalized report for ${phoneNumber} sent to AI Queue.`);
    } catch (err) {
        console.error("❌ Error finalizing bundle for AI:", err);
        throw err;
    }
}, { connection });

const intakeWorker = new Worker('intake', async (job) => {
    const body = job.data;
    const entry = body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];
    if (!message) return;

    const phoneNumber = message.from;
    const messageId = message.id;

    try {
        if (message.type === 'text') {
            const textBody = message.text.body;
            console.log(`📩 Message from ${phoneNumber}: "${textBody}"`);

            await bundleAndDispatch(phoneNumber, messageId, {
                $push: { rawContent: textBody },
                $set: {}
            });
        }
        else if (message.type === 'image') {
            const mediaId = message.image.id;
            const caption = message.image.caption || '';
            const mimeType = message.image.mime_type || 'image/jpeg';

            console.log(`📷 Image from ${phoneNumber} (media_id: ${mediaId})${caption ? `, caption: "${caption}"` : ''}`);

            const existingDoc = await Grievance.findOne({
                userId: phoneNumber,
                source: 'WhatsApp',
                status: { $in: ['Collecting', 'Awaiting_Input'] }
            });

            if (existingDoc && existingDoc.media && existingDoc.media.length >= mediaService.MAX_IMAGES_PER_COMPLAINT) {
                console.log(`📷 [MEDIA] Max ${mediaService.MAX_IMAGES_PER_COMPLAINT} images reached for ${phoneNumber}. Ignoring additional image.`);
                return;
            }

            const ticketId = (existingDoc?._id || messageId).toString().substring(0, 8).toUpperCase();
            console.log(`📷 [MEDIA] Processing image for ticket ${ticketId}...`);
            const mediaResult = await mediaService.processWhatsAppImage(mediaId, ticketId);

            const mediaEntry = {
                image_url: mediaResult.image_url,
                public_id: mediaResult.public_id,
                image_metadata: mediaResult.image_metadata,
                exif: mediaResult.exif
            };

            if (mediaResult.buffer) {
                if (!global._mediaBuffers) global._mediaBuffers = new Map();
                const existing = global._mediaBuffers.get(phoneNumber) || [];
                existing.push({ buffer: mediaResult.buffer, mimeType });
                global._mediaBuffers.set(phoneNumber, existing);
            }

            const pushFields = { media: mediaEntry };
            if (caption) {
                pushFields.rawContent = caption;
            }

            await bundleAndDispatch(phoneNumber, messageId, {
                $push: pushFields,
                $set: {}
            });
        }
        else if (message.type === 'video') {
            const mediaId = message.video.id;
            const caption = message.video.caption || '';
            const mimeType = message.video.mime_type || 'video/mp4';

            console.log(`🎬 Video from ${phoneNumber} (media_id: ${mediaId})${caption ? `, caption: "${caption}"` : ''}`);

            const existingDoc = await Grievance.findOne({
                userId: phoneNumber,
                source: 'WhatsApp',
                status: { $in: ['Collecting', 'Awaiting_Input'] }
            });

            const ticketId = (existingDoc?._id || messageId).toString().substring(0, 8).toUpperCase();
            console.log(`🎬 [MEDIA] Processing video for ticket ${ticketId}...`);
            const mediaResult = await mediaService.processWhatsAppVideo(mediaId, ticketId);

            const mediaEntry = {
                type: 'video',
                video_url: mediaResult.video_url,
                public_id: mediaResult.public_id,
                metadata: mediaResult.metadata
            };

            const pushFields = { media: mediaEntry };
            if (caption) {
                pushFields.rawContent = caption;
            }

            await bundleAndDispatch(phoneNumber, messageId, {
                $push: pushFields,
                $set: {}
            });
        }
        else if (message.type === 'audio' || message.type === 'voice') {
            const audioData = message.audio || message.voice;
            const mediaId = audioData.id;
            const mimeType = audioData.mime_type || 'audio/ogg';
            const isVoiceNote = audioData.voice || (message.type === 'voice');

            console.log(`🎤 Audio/Voice from ${phoneNumber} (media_id: ${mediaId}, voice_note: ${isVoiceNote})`);

            console.log(`🎤 [MEDIA] Downloading audio for processing...`);
            const audioResult = await mediaService.processWhatsAppAudio(mediaId);

            if (audioResult.buffer) {
                if (!global._audioBuffers) global._audioBuffers = new Map();
                const existing = global._audioBuffers.get(phoneNumber) || [];
                existing.push({ buffer: audioResult.buffer, mimeType });
                global._audioBuffers.set(phoneNumber, existing);
            }

            console.log(`🎤 [INTAKE] Voice note attached to bundle for ${phoneNumber}`);

            await bundleAndDispatch(phoneNumber, messageId, {
                $push: { rawContent: `[Voice note attached]` },
                $set: {}
            });
        }
    } catch (err) {
        console.error("❌ Intake Worker Error:", err);
        throw err;
    }
}, { connection });

async function bundleAndDispatch(phoneNumber, messageId, grievanceUpdate) {
    const isDuplicate = await Complaint.findOne({ whatsappMessageIds: messageId });
    if (isDuplicate) {
        console.log(`♻️  [INTAKE] Duplicate Message ID ${messageId} ignored.`);
        return;
    }

    console.log(`💾 [INTAKE] Updating grievance doc for ${phoneNumber}...`);

    const grievance = await Grievance.findOneAndUpdate(
        {
            userId: phoneNumber,
            source: 'WhatsApp',
            status: { $in: ['Collecting', 'Awaiting_Input'] }
        },
        {
            $push: {
                whatsappMessageIds: messageId,
                ...grievanceUpdate.$push
            },
            $set: {
                lastUpdated: Date.now(),
                status: 'Collecting',
                ...grievanceUpdate.$set
            }
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    console.log(`✅ [INTAKE] Grievance updated in DB. Managing bundle timer...`);

    const jobId = `bundle-${phoneNumber}`;
    const job = await bundleQueue.getJob(jobId);

    if (job) {
        try {
            // Attempt to reset the 30s timer
            await job.changeDelay(30000);
            console.log(`⏱️  [INTAKE] User ${phoneNumber} is still typing... resetting 30s timer.`);
        } catch (err) {
            console.warn(`⚠️ [INTAKE] Could not reset timer (State: ${await job.getState()}). Replacing job...`);
            try {
                await job.remove(); // Remove the old job explicitly
                await bundleQueue.add('bundle', { phoneNumber, grievanceId: grievance._id }, {
                    delay: 30000,
                    jobId: jobId,
                    removeOnComplete: true
                });
                console.log(`✅ [INTAKE] Fresh 30s timer started after replacement.`);
            } catch (removeErr) {
                console.error(`❌ [INTAKE] Critical error managing bundle timer:`, removeErr.message);
            }
        }
    } else {

        await bundleQueue.add('bundle', { phoneNumber, grievanceId: grievance._id }, {
            delay: 30000,
            jobId: jobId,
            removeOnComplete: true
        });
        console.log(`⏱️  [INTAKE] Started 30s bundling timer for ${phoneNumber}.`);
    }
    console.log(`🏁 [INTAKE] Bundle dispatch complete for ${messageId}.`);
}

// ═══════════════════════════════════════════════════════════════════
//  PUBLIC API — Called by Controllers
// ═══════════════════════════════════════════════════════════════════
const processGrievanceWithAI = async (id) => {
    try {
        const job = await aiQueue.add('classify', { id }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 }
        });
        console.log(` [Queue] New job added for ID: ${id}`);
        return job;
    } catch (err) {
        console.error(' Queue Error:', err);
    }
};

const addToIntakeQueue = async (body) => {
    try {
        await intakeQueue.add('intake', body);
        console.log(` [Queue] Added webhook payload to intake queue`);
    } catch (err) {
        console.error(' Queue Error (Intake):', err);
    }
};

const getQueueCounts = async () => {
    try {
        return {
            aiQueue: await aiQueue.getJobCounts(),
            intakeQueue: await intakeQueue.getJobCounts(),
            bundleQueue: await bundleQueue.getJobCounts()
        };
    } catch (err) {
        console.error('Error getting job counts:', err);
        return {};
    }
};

module.exports = { processGrievanceWithAI, addToIntakeQueue, getQueueCounts, connection };
