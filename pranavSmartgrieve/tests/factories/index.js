/**
 * Test Factories
 *
 * Data builders for creating test entities with sensible defaults.
 * Re-exports and extends the existing harness/factories.
 */
const { createCitizen, createOfficer, createComplaint } = require('../harness/factories');
const Grievance = require('../../src/models/grievance.model');
const mongoose = require('mongoose');

/**
 * Create a Grievance staging document.
 */
const createGrievance = async (overrides = {}) => {
    const defaults = {
        userId: `+9199999${Math.floor(10000 + Math.random() * 90000)}`,
        source: 'WhatsApp',
        status: 'Collecting',
        rawContent: ['Test grievance message'],
        finalTextForAI: 'Test grievance message',
        ...overrides
    };
    return Grievance.create(defaults);
};

/**
 * Build a mock WhatsApp webhook payload.
 */
const buildWebhookPayload = (overrides = {}) => {
    const msgId = overrides.messageId || `wamid.test.${Date.now()}`;
    const from = overrides.from || '919999999999';
    const type = overrides.type || 'text';

    const message = { from, id: msgId, timestamp: Date.now().toString(), type };

    if (type === 'text') {
        message.text = { body: overrides.text || 'There is a pothole on the main road near MP Nagar' };
    } else if (type === 'image') {
        message.image = { id: overrides.mediaId || 'media_img_123', mime_type: 'image/jpeg', caption: overrides.caption || '' };
    } else if (type === 'audio' || type === 'voice') {
        const audioData = { id: overrides.mediaId || 'media_aud_123', mime_type: 'audio/ogg' };
        if (type === 'voice') { audioData.voice = true; message.voice = audioData; }
        else { message.audio = audioData; }
    } else if (type === 'video') {
        message.video = { id: overrides.mediaId || 'media_vid_123', mime_type: 'video/mp4', caption: overrides.caption || '' };
    } else if (type === 'location') {
        message.location = { latitude: overrides.lat || 23.2599, longitude: overrides.lng || 77.4126 };
    }

    return {
        object: 'whatsapp_business_account',
        entry: [{
            id: '12345',
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: { display_phone_number: '911234567890', phone_number_id: '1123625167495768' },
                    contacts: [{ profile: { name: overrides.name || 'Test User' }, wa_id: from }],
                    messages: [message]
                }
            }]
        }]
    };
};

/**
 * Build a mock AI result matching §27.2 Intelligence Agent Contract.
 */
const buildAIResult = (overrides = {}) => ({
    category: 'Roads',
    subCategory: 'Pothole',
    departmentId: 'MUNC',
    assignedAgency: 'Bhopal Municipal Corporation',
    resolvedLocation: null,
    wardNumber: null,
    wardName: null,
    zoneId: null,
    zoneName: null,
    coordinates: null,
    severity: 'Medium',
    isEmergency: false,
    isChronic: false,
    priority: 'P3',
    priority_label: 'Medium',
    confidence: 0.85,
    confidence_score: 85,
    reasoning: 'Pothole complaint on road.',
    summary: 'Pothole complaint on road.',
    suggestedReply: 'Aapki complaint darj ho gayi hai.',
    response_message: 'Aapki complaint darj ho gayi hai.',
    requiresManualReview: false,
    estimatedResolutionDays: 3,
    detectedLanguage: 'mixed',
    location_text: '',
    location_evidence: null,
    missing_fields: ['location'],
    rawAIResponse: '{}',
    ...overrides
});

module.exports = {
    createCitizen,
    createOfficer,
    createComplaint,
    createGrievance,
    buildWebhookPayload,
    buildAIResult
};
