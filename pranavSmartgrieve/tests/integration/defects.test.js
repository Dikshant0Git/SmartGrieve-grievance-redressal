const mongoose = require('mongoose');
const request = require('supertest');
const Grievance = require('../../src/models/grievance.model');
const Complaint = require('../../src/models/complaint.model');
const { createCitizen } = require('../harness/factories');

// Mock external dependencies
jest.mock('bullmq', () => {
    const { FakeQueue, FakeWorker } = require('../harness/fakeRedis');
    return { Queue: FakeQueue, Worker: FakeWorker, QueueEvents: class {} };
});
jest.mock('../../src/config/redis.config', () => {
    const EventEmitter = require('events');
    const mock = new EventEmitter();
    mock.status = 'ready';
    mock.disconnect = jest.fn();
    mock.quit = jest.fn();
    return mock;
});
jest.mock('../../src/services/whatsapp.service', () => ({
    sendWhatsAppMessage: jest.fn()
}));
jest.mock('../../src/services/gemini.service.mjs', () => ({
    getGeminiResponse: jest.fn(),
    getGeminiAudioTranscription: jest.fn(),
    getGeminiVisionResponse: jest.fn(),
    getGeminiVideoResponse: jest.fn()
}));

const aiService = require('../../src/services/ai.service');
const systemAgent = require('../../src/services/agents/system.agent');
const intelligenceAgent = require('../../src/services/agents/intelligence.agent');
const app = require('../../src/config/app');
const bcrypt = require('bcrypt');

describe('Section 13 Defect Validations (Behavioral)', () => {
    beforeAll(() => {
        process.env.AI_HARNESS = 'langchain';
    });
    
    test('T-001 [13.1] FIXED: processWhatsAppVideo correctly imported and called in ai.service.js', async () => {
        const { getWorker } = require('../harness/fakeRedis');
        const intakeWorker = getWorker('intake');
        
        // Mock processWhatsAppVideo before running the worker
        const mediaService = require('../../src/services/media.service');
        jest.spyOn(mediaService, 'processWhatsAppVideo').mockResolvedValue({
            video_url: 'mock_url',
            public_id: 'mock_id',
            metadata: {}
        });

        const job = {
            data: {
                entry: [{
                    changes: [{
                        value: {
                            messages: [{
                                type: 'video',
                                from: '+919999999999',
                                id: 'wamid.123',
                                video: { id: 'media_id_123', mime_type: 'video/mp4' }
                            }]
                        }
                    }]
                }]
            }
        };

        // This will now process successfully without throwing a ReferenceError
        await expect(intakeWorker.simulateJobProcessing(job)).resolves.toBeUndefined();
        
        // Verify the function was called
        expect(mediaService.processWhatsAppVideo).toHaveBeenCalledWith('media_id_123', expect.any(String));
        
        mediaService.processWhatsAppVideo.mockRestore();
    });

    test('T-002 [13.2] FIXED: processWhatsAppAudio returns a valid buffer', async () => {
        const mediaService = require('../../src/services/media.service');
        
        jest.spyOn(mediaService, 'fetchMetaMediaUrl').mockResolvedValue('http://mock-url.com/audio');
        jest.spyOn(mediaService, 'downloadMedia').mockResolvedValue(Buffer.from('mock-audio-data'));

        const result = await mediaService.processWhatsAppAudio('media_id_123');
        
        expect(result).toHaveProperty('buffer');
        expect(Buffer.isBuffer(result.buffer)).toBe(true);
        expect(result.mimeType).toBe('audio/ogg');

        mediaService.fetchMetaMediaUrl.mockRestore();
        mediaService.downloadMedia.mockRestore();
    });

    test('T-003 [13.3] FIXED: Duplicate Complaint Creation Prevented', async () => {
        const citizen = await createCitizen();
        const doc = await Grievance.create({
            userId: citizen.mobileNo,
            source: 'WhatsApp',
            status: 'Collecting',
            rawContent: ['Pothole here']
        });

        const aiResultYellow = {
            category: 'Roads',
            priority: 'Medium',
            confidence_score: 90,
            location_text: null,
            summary: 'Pothole'
        };
        const guardResult = { passed: true, normalized: { userId: doc.userId } };
        await systemAgent.run(aiResultYellow, doc, guardResult, 'Collecting');

        const aiResultGreen = { ...aiResultYellow, location_text: 'DB Mall' };
        await systemAgent.run(aiResultGreen, doc, guardResult, 'Awaiting_Input');

        const complaintsCount = await Complaint.countDocuments({ userId: doc.userId });
        expect(complaintsCount).toBe(1);
    });

    test('T-004 [13.5] FIXED: Memory Leak cleared on guardrail rejection', async () => {
        const doc = await Grievance.create({
            userId: '+919999999999',
            source: 'WhatsApp',
            status: 'Collecting'
        });
        
        global._mediaBuffers = new Map();
        global._mediaBuffers.set(doc.userId, [{ buffer: Buffer.from('test'), mimeType: 'image/jpeg' }]);

        const guardrailAgent = require('../../src/services/agents/guardrail.agent');
        jest.spyOn(guardrailAgent, 'run').mockResolvedValue({ passed: false, tier: 'Red' });
        
        const { getWorker } = require('../harness/fakeRedis');
        const aiWorker = getWorker('ai-processing');
        
        await aiWorker.simulateJobProcessing({ id: 'test-job', data: { id: doc._id } });
        
        expect(global._mediaBuffers.size).toBe(0);
        
        guardrailAgent.run.mockRestore();
    });

    test('T-005 [13.6] FIXED: Priority Field properly maps to P1-P4', async () => {
        const parsed = {
            category: 'Roads',
            subCategory: 'Pothole',
            departmentId: 'MUNC',
            assignedAgency: 'Bhopal Municipal Corporation',
            severity: 'Critical',
            isEmergency: false,
            isChronic: false,
            confidence: 0.85,
            reasoning: 'Critical pothole on road',
            suggestedReply: 'Complaint registered',
            requiresManualReview: false,
            estimatedResolutionDays: 3,
            detectedLanguage: 'en',
            location_text: null,
            location_evidence: null,
            missing_fields: ['location']
        };

        const llmModule = require('../../src/ai/llm');
        const llmSpy = jest.spyOn(llmModule, 'createLLM').mockReturnValue({
            withStructuredOutput: () => ({
                invoke: async () => parsed
            })
        });

        const { getGeminiResponse } = require('../../src/services/gemini.service.mjs');
        getGeminiResponse.mockResolvedValueOnce(JSON.stringify({ severity: 'Critical', category: 'Roads' }));

        const doc = await Grievance.create({ userId: '123', status: 'Collecting', finalTextForAI: 'huge pothole', source: 'WhatsApp' });
        const result = await intelligenceAgent.run({ userId: '123', text: 'huge pothole', hasImage: false, hasAudio: false }, getGeminiResponse, doc);

        // Expected numeric P1-P4 priority
        expect(result.priority).toMatch(/^P[1-4]$/);
        expect(result.priority).toBe('P1'); // Since severity is Critical

        llmSpy.mockRestore();
    });

    test('T-006 [13.8] FIXED: Global Error Middleware handles Promise Rejections', async () => {
        // Express 5 natively catches this async error in the test route and passes it to our global handler.
        const res = await request(app).get('/test-error');

        // Verify the global error handler caught it and returned JSON
        expect(res.status).toBe(500);
        expect(res.headers['content-type']).toMatch(/json/);
        expect(res.body).toHaveProperty('error', 'Internal Server Error');
    });

    test('Unresolved text location "Main St" results in Yellow tier (Awaiting_Input)', async () => {
        const citizen = await createCitizen();
        const doc = await Grievance.create({
            userId: citizen.mobileNo,
            source: 'WhatsApp',
            status: 'Collecting',
            rawContent: ['Pothole on Main St']
        });

        const aiResult = {
            category: 'Roads',
            priority: 'Medium',
            confidence_score: 80,
            location_text: 'Main St',
            summary: 'Pothole on Main St'
        };
        const guardResult = { passed: true, normalized: { userId: doc.userId } };

        const result = await systemAgent.run(aiResult, doc, guardResult, 'Collecting');

        expect(result.statusTier).toBe('Yellow');
        expect(result.paused).toBe(true);
        expect(doc.status).toBe('Awaiting_Input');
        const complaintsCount = await Complaint.countDocuments({ userId: doc.userId });
        expect(complaintsCount).toBe(0);
    });

    test('Area-only location "Indrapuri" results in Yellow tier (Awaiting_Input)', async () => {
        const citizen = await createCitizen();
        const doc = await Grievance.create({
            userId: citizen.mobileNo,
            source: 'WhatsApp',
            status: 'Collecting',
            rawContent: ['Garbage in Indrapuri']
        });

        const aiResult = {
            category: 'Sanitation',
            priority: 'Medium',
            confidence_score: 80,
            location_text: 'Indrapuri',
            summary: 'Garbage in Indrapuri'
        };
        const guardResult = { passed: true, normalized: { userId: doc.userId } };

        const result = await systemAgent.run(aiResult, doc, guardResult, 'Collecting');

        expect(result.statusTier).toBe('Yellow');
        expect(result.paused).toBe(true);
        expect(doc.status).toBe('Awaiting_Input');
        const complaintsCount = await Complaint.countDocuments({ userId: doc.userId });
        expect(complaintsCount).toBe(0);
    });

});
