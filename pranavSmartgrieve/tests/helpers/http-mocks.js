/**
 * Test Helper: HTTP Mocks (nock)
 *
 * Centralised mock setup for all external HTTP services:
 *   - Meta WhatsApp Cloud API (graph.facebook.com)
 *   - Cloudinary upload API
 *   - Groq (api.groq.com)
 *
 * Usage: call the setup function in beforeEach, nock.cleanAll() in afterEach.
 */
const nock = require('nock');

/**
 * Block all outbound HTTP by default.
 * Tests must explicitly mock any HTTP they need.
 */
function blockAllHttp() {
    nock.disableNetConnect();
    // Allow localhost for supertest
    nock.enableNetConnect('127.0.0.1');
}

/**
 * Restore HTTP after tests.
 */
function restoreHttp() {
    nock.cleanAll();
    nock.enableNetConnect();
}

/**
 * Mock Meta Graph API for WhatsApp message sending.
 * @param {number} statusCode - HTTP status to return (default 200)
 * @param {Object} body - Response body
 * @returns {nock.Scope}
 */
function mockWhatsAppSend(statusCode = 200, body = { messages: [{ id: 'wamid.mock' }] }) {
    return nock('https://graph.facebook.com')
        .post(/\/v[\d.]+\/\d+\/messages/)
        .reply(statusCode, body);
}

/**
 * Mock Meta Graph API for media URL fetch.
 * @param {string} mediaId
 * @param {string} url - The download URL to return
 * @returns {nock.Scope}
 */
function mockWhatsAppMediaUrl(mediaId, url = 'https://lookaside.fbsbx.com/mock-media') {
    return nock('https://graph.facebook.com')
        .get(new RegExp(`/v[\\d.]+/${mediaId}`))
        .reply(200, { url });
}

/**
 * Mock media download from Meta CDN.
 * @param {Buffer} buffer - The media buffer to return
 * @returns {nock.Scope}
 */
function mockMediaDownload(buffer = Buffer.from('fake-media-bytes')) {
    return nock('https://lookaside.fbsbx.com')
        .get(/\/mock-media/)
        .reply(200, buffer, { 'Content-Type': 'application/octet-stream' });
}

/**
 * Mock Cloudinary upload.
 * @param {Object} response - Cloudinary response shape
 * @returns {nock.Scope}
 */
function mockCloudinaryUpload(response = { secure_url: 'https://res.cloudinary.com/mock/image.jpg', public_id: 'mock_id' }) {
    return nock('https://api.cloudinary.com')
        .post(/\/v1_1\/.*\/upload/)
        .reply(200, response);
}

/**
 * Mock Groq API (OpenAI-compatible endpoint).
 * @param {Object} response - Chat completion response
 * @returns {nock.Scope}
 */
function mockGroqChat(response = null) {
    const defaultResponse = {
        id: 'chatcmpl-mock',
        object: 'chat.completion',
        choices: [{
            message: {
                role: 'assistant',
                content: JSON.stringify({
                    category: 'Roads', subCategory: 'Pothole', departmentId: 'MUNC',
                    assignedAgency: 'BMC', resolvedLocation: null, wardNumber: null,
                    wardName: null, zoneId: null, zoneName: null, coordinates: null,
                    severity: 'Medium', isEmergency: false, isChronic: false,
                    confidence: 0.85, reasoning: 'Pothole complaint',
                    suggestedReply: 'Noted.', requiresManualReview: false,
                    estimatedResolutionDays: 3, detectedLanguage: 'en',
                    location_text: null, location_evidence: null, missing_fields: ['location']
                })
            },
            finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    };

    return nock('https://api.groq.com')
        .post('/openai/v1/chat/completions')
        .reply(200, response || defaultResponse);
}

module.exports = {
    blockAllHttp,
    restoreHttp,
    mockWhatsAppSend,
    mockWhatsAppMediaUrl,
    mockMediaDownload,
    mockCloudinaryUpload,
    mockGroqChat
};
