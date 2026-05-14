/**
 * Service to convert text to speech using Google Cloud TTS.
 * This is used as the stable fallback when direct Gemini audio output is not available.
 */

const axios = require('axios');

const GOOGLE_TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY;
const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

/**
 * Generates speech from text.
 */
async function generateSpeech(text, language = 'en-IN') {
    try {
        if (!text || text.trim().length === 0) {
            throw new Error("Text cannot be empty");
        }

        if (!GOOGLE_TTS_API_KEY) {
            console.warn("⚠️ GOOGLE_TTS_API_KEY not configured. Falling back to mock audio.");
            return generateMockAudio();
        }

        console.log(`🎵 [TTS] Generating audio via Google Cloud: "${text.substring(0, 30)}..."`);

        const response = await axios.post(
            `${GOOGLE_TTS_URL}?key=${GOOGLE_TTS_API_KEY}`,
            {
                input: { text: text },
                voice: {
                    languageCode: language,
                    name: getVoiceName(language),
                    ssmlGender: "NEUTRAL"
                },
                audioConfig: {
                    audioEncoding: "MP3",
                    pitch: 0.0,
                    speakingRate: 1.0
                }
            }
        );

        const audioContent = response.data?.audioContent;
        if (!audioContent) {
            throw new Error("No audio content in TTS response");
        }

        return Buffer.from(audioContent, 'base64');
    } catch (error) {
        console.error("❌ Speech generation failed:", error.response?.data || error.message);
        return generateMockAudio();
    }
}

function getVoiceName(language) {
    const voiceMap = {
        'hi-IN': 'hi-IN-Neural2-A',
        'en-IN': 'en-IN-Neural2-C',
    };
    return voiceMap[language] || 'en-IN-Neural2-C';
}

function generateMockAudio() {
    // Minimal valid MP3 header for testing
    return Buffer.from([0xFF, 0xFB, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00]);
}

function mapLanguageToGoogleCode(language) {
    const codeMap = {
        'en': 'en-IN',
        'hi': 'hi-IN',
        'hinglish': 'hi-IN',
    };
    return codeMap[language] || 'en-IN';
}

module.exports = {
    generateSpeech,
    mapLanguageToGoogleCode
};
