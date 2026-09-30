/**
 * Fake Gemini SDK to bypass actual API calls during tests.
 * This can be used to inject deterministic AI responses.
 */

let nextResponse = {
    response: {
        text: () => JSON.stringify({
            categories: ["road_maintenance"],
            urgency: "Medium",
            confidence: 0.95,
            department: "PWD",
            summary: "Pothole on road"
        })
    }
};

const setNextResponse = (mockResponseObj) => {
    nextResponse = {
        response: {
            text: () => JSON.stringify(mockResponseObj)
        }
    };
};

const fakeGeminiClient = {
    models: {
        generateContent: jest.fn().mockImplementation(async () => nextResponse)
    }
};

module.exports = {
    fakeGeminiClient,
    setNextResponse
};
