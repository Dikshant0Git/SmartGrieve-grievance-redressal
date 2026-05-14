import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY 
});

/**
 * Standard text-only Gemini call.
 * Uses JSON response mode for structured output.
 */
export const getGeminiResponse = async (systemPrompt, userPrompt, responseSchema = null) => {
    try {
        const config = {
            responseMimeType: 'application/json'
        };
        
        if (responseSchema) {
            config.responseSchema = responseSchema;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            systemInstruction: systemPrompt,
            config: config,
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
        });

        return response.text; 
    } catch (error) {
        console.error("❌ Gemini API Handshake Error:", error.message);
        throw error;
    }
};

/**
 * Multimodal Gemini call (text + image).
 * Used by the Intelligence Agent when a complaint has an attached image.
 * 
 * NOTE: This uses text/plain response mode, NOT JSON.
 * The vision step returns a natural language description, not structured data.
 * 
 * @param {string} systemPrompt - System instruction
 * @param {string} textPrompt - The user's complaint text
 * @param {Buffer} imageBuffer - The image as a buffer
 * @param {string} mimeType - e.g., 'image/jpeg'
 * @returns {string} The AI response text (plain text description)
 */
export const getGeminiVisionResponse = async (systemPrompt, textPrompt, imageBuffer, mimeType) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            systemInstruction: systemPrompt,
            contents: [{
                role: 'user',
                parts: [
                    { text: textPrompt },
                    { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBuffer.toString('base64') } }
                ]
            }]
        });

        return response.text;
    } catch (error) {
        console.error("❌ Gemini Vision API Error:", error.message);
        throw error;
    }
};

/**
 * Audio transcription using Gemini.
 * Sends audio as inline base64 data to get a text transcription.
 * 
 * @param {string} systemPrompt - System instruction for transcription context
 * @param {Buffer} audioBuffer - The audio as a buffer
 * @param {string} mimeType - e.g., 'audio/ogg', 'audio/mp3'
 * @returns {string} The transcribed text
 */
export const getGeminiAudioTranscription = async (systemPrompt, audioBuffer, mimeType) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            systemInstruction: systemPrompt,
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: mimeType || 'audio/ogg', data: audioBuffer.toString('base64') } },
                    { text: "Please transcribe this audio. It may contain Hindi, English, or Hinglish speech. Provide the output in plain text exactly as spoken." }
                ]
            }]
        });

        return response.text;
    } catch (error) {
        console.error("❌ Gemini Audio API Error:", error.message);
        throw error;
    }
};

/**
 * Gemini 1.5 Flash call with support for multimodal parts.
 * Used by the older intelligence agent.
 */
export const getGemini15Response = async (systemPrompt, userPrompt, mediaParts = []) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            systemInstruction: systemPrompt,
            config: {
                temperature: 0.2,
                topP: 0.85,
                topK: 40,
                maxOutputTokens: 1024,
            },
            contents: [{
                role: 'user',
                parts: [
                    { text: userPrompt },
                    ...mediaParts
                ]
            }]
        });

        return response.text;
    } catch (error) {
        console.error("❌ Gemini 1.5 API Error:", error.message);
        throw error;
    }
};

/**
 * Multimodal Gemini call (text + video).
 * Used by the Intelligence Agent when a complaint has an attached video.
 * 
 * @param {string} systemPrompt - System instruction
 * @param {string} textPrompt - The user's complaint text
 * @param {Buffer} videoBuffer - The video as a buffer
 * @param {string} mimeType - e.g., 'video/mp4'
 * @returns {string} The AI response text (plain text description)
 */
export const getGeminiVideoResponse = async (systemPrompt, textPrompt, videoBuffer, mimeType) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            systemInstruction: systemPrompt,
            contents: [{
                role: 'user',
                parts: [
                    { text: textPrompt },
                    { inlineData: { mimeType: mimeType || 'video/mp4', data: videoBuffer.toString('base64') } }
                ]
            }]
        });

        return response.text;
    } catch (error) {
        console.error("❌ Gemini Video API Error:", error.message);
        throw error;
    }
};