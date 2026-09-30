/**
 * Test Environment Setup
 *
 * Runs before any test suite via Jest's setupFiles.
 * Ensures tests run in an isolated test environment without loading .env.
 */
process.env.NODE_ENV = 'test';
process.env.GROQ_API_KEY = 'test-key';
process.env.GEMINI_API_KEY = 'test-key';
process.env.JWT_SECRET = 'test_secret_key';
