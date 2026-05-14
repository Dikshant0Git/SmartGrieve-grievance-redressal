/**
 * Service to transcribe audio to text using Gemini API.
 * Supports Hindi, English, and Hinglish.
 */

const { GoogleGenAI } = require("@google/genai");

if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY missing in .env");
}

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Transcribes audio to text using Gemini.
 * 
 * @param {Buffer} audioBuffer - The audio file as a buffer.
 * @param {string} mimeType - MIME type (e.g., 'audio/ogg', 'audio/mp3', 'audio/wav').
 * @param {string} language - Language hint: 'en', 'hi', 'hinglish', or 'auto' for auto-detection.
 * @returns {Promise<string>} - Transcribed text.
 */
async function transcribeAudio(audioBuffer, mimeType = 'audio/ogg', language = 'auto') {
    try {
        console.log(`🎵 Transcribing audio (${mimeType}, language: ${language})...`);

        if (!audioBuffer || audioBuffer.length === 0) {
            throw new Error("Audio buffer is empty");
        }

        // Prepare language instruction based on input
        let languageInstruction = "Transcribe the audio exactly as spoken.";
        if (language === 'hi') {
            languageInstruction = "Transcribe the audio in Hindi. Convert English words to Devanagari where applicable.";
        } else if (language === 'en') {
            languageInstruction = "Transcribe the audio in English.";
        } else if (language === 'hinglish') {
            languageInstruction = "Transcribe the audio in Hinglish (mix of Hindi and English). Use Devanagari for Hindi words and Latin for English words.";
        }

        const systemPrompt = `You are a professional audio transcription assistant. 
Your task is to transcribe the provided audio accurately.
${languageInstruction}
Return ONLY the transcribed text. Do not add any explanations, markdown, or additional commentary.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt,
            contents: [{
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: audioBuffer.toString('base64')
                        }
                    },
                    {
                        text: "Please transcribe this audio."
                    }
                ]
            }]
        });

        let transcribedText = response.text?.trim() || "";

        // Clean up markdown code blocks if present
        transcribedText = transcribedText
            .replace(/```[\s\S]*?```/g, "")
            .replace(/`/g, "")
            .trim();

        console.log(`✅ Audio transcribed successfully (${transcribedText.length} characters)`);
        return transcribedText;
    } catch (error) {
        console.error("❌ Audio transcription failed:", error.message);
        throw new Error(`Transcription failed: ${error.message}`);
    }
}

/**
 * Detects the language of transcribed text.
 * Returns a hint about which language is predominant.
 */
async function detectLanguage(text) {
    try {
        if (!text || text.length === 0) {
            return 'en';
        }

        const devanagariRegex = /[\u0900-\u097F]/g;
        const latinRegex = /[a-zA-Z]/g;

        const devanagariMatches = (text.match(devanagariRegex) || []).length;
        const latinMatches = (text.match(latinRegex) || []).length;

        if (devanagariMatches > latinMatches * 1.2) {
            return 'hi';
        } else if (latinMatches > devanagariMatches * 1.2) {
            return 'en';
        } else {
            return 'hinglish';
        }
    } catch (error) {
        return 'en';
    }
}

module.exports = {
    transcribeAudio,
    detectLanguage
};
