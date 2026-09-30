/**
 * Test Helper: App Instance
 *
 * Provides a pre-configured Express app for supertest.
 * BullMQ is mocked so no real Redis is needed.
 */

// Mock BullMQ before requiring the app
jest.mock('bullmq', () => {
    const { FakeQueue, FakeWorker } = require('../harness/fakeRedis');
    return { Queue: FakeQueue, Worker: FakeWorker, QueueEvents: class {} };
});

// Mock WhatsApp outbound so tests never call Meta
jest.mock('../../src/services/whatsapp.service', () => ({
    sendWhatsAppMessage: jest.fn().mockResolvedValue(undefined),
    sendWhatsAppAudioMessage: jest.fn().mockResolvedValue(undefined)
}));

// Mock Gemini so tests never call Google
jest.mock('../../src/services/gemini.service.mjs', () => ({
    getGeminiResponse: jest.fn(),
    getGeminiAudioTranscription: jest.fn(),
    getGeminiVisionResponse: jest.fn(),
    getGeminiVideoResponse: jest.fn(),
    getGemini15Response: jest.fn()
}));

const app = require('../../src/config/app');

module.exports = app;
