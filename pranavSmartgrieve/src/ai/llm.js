/**
 * LLM Configuration — Groq via OpenAI-compatible endpoint
 *
 * Text classification uses Groq through @langchain/openai's ChatOpenAI
 * which supports any OpenAI-compatible API. Media (audio/image/video) keeps
 * using the existing Gemini service (gemini.service.mjs).
 *
 * Environment variables:
 *   GROQ_API_KEY  — API key for Groq
 *   GROQ_MODEL    — Model name
 */

const { ChatOpenAI } = require('@langchain/openai');

/**
 * Create and return a configured ChatOpenAI instance pointing to Groq.
 * Lazily instantiated so tests can set env vars before first use.
 * Throws clear error if GROQ_API_KEY is missing (fail fast at startup).
 *
 * @returns {ChatOpenAI}
 */
function createLLM() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error('GROQ_API_KEY environment variable is required to create LLM instance');
    }

    return new ChatOpenAI({
        apiKey,
        modelName: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        configuration: {
            baseURL: 'https://api.groq.com/openai/v1',
        },
        temperature: 0.1,
        maxTokens: 2048,
    });
}

module.exports = { createLLM };
