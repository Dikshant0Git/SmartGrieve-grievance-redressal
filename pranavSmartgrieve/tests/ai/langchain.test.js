/**
 * LangChain AI Layer Tests
 *
 * Uses a stubbed LLM (no network calls). Tests:
 *   1. "there is a pothole" → location null, missing_fields contains 'location'
 *   2. "pothole near MP Nagar Zone 2" → location resolves
 *   3. severity 'Critical' → priority 'P1'
 *   4. location_evidence validation
 *   5. derivePriority escalation logic
 */

const { derivePriority, validateLocationEvidence } = require('../../src/ai/schemas/classification.schema');
const { buildClassifyPrompt, buildClassifyUserMessage } = require('../../src/ai/prompts/classify');
const { resolveLocationTool, checkEmergencyTool, resolveSlangAndDepartmentTool } = require('../../src/ai/tools/civic.tools');
const { runClassifyChain } = require('../../src/ai/chains/classify.chain');
const { createLLM } = require('../../src/ai/llm');

process.env.AI_HARNESS = 'langchain';

// ─── Stub LLM ─────────────────────────────────────────────────────
// Returns a fake structured response matching ClassificationSchema.
// No network calls are made.
function createStubLLM(overrides = {}) {
    const defaultResponse = {
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
        confidence: 0.85,
        reasoning: 'Pothole complaint on road.',
        suggestedReply: 'Aapki complaint darj ho gayi hai.',
        requiresManualReview: false,
        estimatedResolutionDays: 3,
        detectedLanguage: 'mixed',
        location_text: null,
        location_evidence: null,
        missing_fields: ['location'],
        ...overrides
    };

    return {
        withStructuredOutput: () => ({
            invoke: async () => defaultResponse
        })
    };
}

// ─── Tests ────────────────────────────────────────────────────────

describe('LangChain AI Layer', () => {

    // ── Schema: derivePriority ──
    describe('derivePriority()', () => {
        test('Critical severity maps to P1', () => {
            expect(derivePriority('Critical')).toBe('P1');
        });

        test('High severity maps to P2', () => {
            expect(derivePriority('High')).toBe('P2');
        });

        test('Medium severity maps to P3', () => {
            expect(derivePriority('Medium')).toBe('P3');
        });

        test('Low severity maps to P4', () => {
            expect(derivePriority('Low')).toBe('P4');
        });

        test('Emergency escalates P3 to P2', () => {
            expect(derivePriority('Medium', true, false)).toBe('P2');
        });

        test('Sensitive zone escalates P4 to P3', () => {
            expect(derivePriority('Low', false, true)).toBe('P3');
        });

        test('P1 stays P1 even with emergency', () => {
            expect(derivePriority('Critical', true, true)).toBe('P1');
        });
    });

    // ── Schema: validateLocationEvidence ──
    describe('validateLocationEvidence()', () => {
        test('valid evidence is a substring of input — location preserved', () => {
            const result = {
                location_text: 'MP Nagar',
                location_evidence: 'near MP Nagar',
                resolvedLocation: 'MP Nagar',
                coordinates: [23.23, 77.41],
                wardNumber: 50,
                wardName: 'Ward 50',
                zoneId: 11,
                zoneName: 'Zone 11',
                missing_fields: []
            };
            const validated = validateLocationEvidence(result, 'There is a pothole near MP Nagar Zone 2');
            expect(validated.location_text).toBe('MP Nagar');
            expect(validated.missing_fields).not.toContain('location');
        });

        test('fabricated evidence NOT in input — location nulled, location added to missing_fields', () => {
            const result = {
                location_text: 'DB Mall',
                location_evidence: 'DB Mall area',
                resolvedLocation: 'DB Mall',
                coordinates: [23.23, 77.43],
                wardNumber: 50,
                wardName: 'Ward 50',
                zoneId: 11,
                zoneName: 'Zone 11',
                missing_fields: []
            };
            const validated = validateLocationEvidence(result, 'There is a pothole on the road');
            expect(validated.location_text).toBeNull();
            expect(validated.location_evidence).toBeNull();
            expect(validated.resolvedLocation).toBeNull();
            expect(validated.coordinates).toBeNull();
            expect(validated.missing_fields).toContain('location');
        });

        test('no location_evidence and no EXIF — adds location to missing_fields', () => {
            const result = {
                location_text: null,
                location_evidence: null,
                resolvedLocation: null,
                coordinates: null,
                wardNumber: null,
                wardName: null,
                zoneId: null,
                zoneName: null,
                missing_fields: []
            };
            const validated = validateLocationEvidence(result, 'There is a pothole');
            expect(validated.missing_fields).toContain('location');
        });

        test('EXIF GPS present — location preserved even without evidence', () => {
            const result = {
                location_text: 'DB Mall',
                location_evidence: 'DB Mall area',
                resolvedLocation: 'DB Mall',
                coordinates: [23.23, 77.43],
                wardNumber: 50,
                wardName: 'Ward 50',
                zoneId: 11,
                zoneName: 'Zone 11',
                missing_fields: []
            };
            const validated = validateLocationEvidence(result, 'There is a pothole', true);
            expect(validated.location_text).toBe('DB Mall');
        });
    });

    // ── Tools ──
    describe('Tool wrappers (read-only)', () => {
        test('resolveLocationTool returns formatted string for unresolved input', () => {
            const result = resolveLocationTool('there is a pothole');
            expect(result.formatted).toContain('UNRESOLVED');
            expect(result.raw.resolution_method).toBe('unresolved');
        });

        test('resolveLocationTool resolves MP Nagar', () => {
            const result = resolveLocationTool('pothole near MP Nagar Zone 2');
            expect(result.formatted).toContain('RESOLVED');
            expect(result.cityResult.resolved).toBe(true);
        });

        test('checkEmergencyTool detects fire emergency', () => {
            const result = checkEmergencyTool('there is a fire in the building');
            expect(result.isEmergency).toBe(true);
            expect(result.matchedKeywords).toContain('fire');
        });

        test('checkEmergencyTool returns no emergency for normal complaint', () => {
            const result = checkEmergencyTool('pothole on road');
            expect(result.isEmergency).toBe(false);
        });

        test('resolveSlangAndDepartmentTool translates kachra', () => {
            const result = resolveSlangAndDepartmentTool('kachra pada hai sadak par');
            expect(result.slang.length).toBeGreaterThan(0);
            expect(result.departments.length).toBeGreaterThan(0);
        });
    });

    // ── Prompts ──
    describe('Prompt builders', () => {
        test('buildClassifyPrompt includes tool context', () => {
            const prompt = buildClassifyPrompt({
                locationContext: 'Location: UNRESOLVED',
                departmentContext: 'No departments matched.',
                slangContext: '',
                emergencyContext: 'No emergency.',
                duplicateContext: 'No duplicate found.'
            });
            expect(prompt).toContain('UNRESOLVED');
            expect(prompt).toContain('OUTPUT CONTRACT');
        });

        test('buildClassifyUserMessage wraps text in complaint tags', () => {
            const msg = buildClassifyUserMessage('pothole near MP Nagar');
            expect(msg).toContain('<complaint_content>');
            expect(msg).toContain('pothole near MP Nagar');
        });
    });

    // ── Integration: runClassifyChain with stubbed LLM ──
    describe('runClassifyChain (stubbed LLM)', () => {
        test('"there is a pothole" → location null, missing_fields contains location', async () => {
            const stubLLM = createStubLLM({
                location_text: null,
                location_evidence: null,
                resolvedLocation: null,
                missing_fields: ['location']
            });

            const result = await runClassifyChain(
                'there is a pothole',
                'there is a pothole',
                {
                    enrichedData: { departments: [], location: {}, is_emergency: false, sensitive_zones: [] },
                    leafletPayload: null,
                    llmOverride: stubLLM
                }
            );

            expect(result.location_text).toBeFalsy();
            expect(result.missing_fields).toContain('location');
            expect(result.category).toBe('Roads');
        });

        test('"pothole near MP Nagar Zone 2" → location resolves', async () => {
            const stubLLM = createStubLLM({
                location_text: 'MP Nagar',
                location_evidence: 'near MP Nagar',
                resolvedLocation: 'MP Nagar',
                wardNumber: 50,
                zoneId: 11,
                coordinates: [23.233, 77.414],
                missing_fields: []
            });

            const result = await runClassifyChain(
                'pothole near MP Nagar Zone 2',
                'pothole near MP Nagar Zone 2',
                {
                    enrichedData: { departments: [], location: { resolved: true }, is_emergency: false, sensitive_zones: [] },
                    leafletPayload: { lat: 23.233, lng: 77.414 },
                    llmOverride: stubLLM
                }
            );

            expect(result.location_text).toBeTruthy();
            expect(result.missing_fields).not.toContain('location');
        });

        test('severity Critical → priority P1', async () => {
            const stubLLM = createStubLLM({
                severity: 'Critical',
                isEmergency: true,
                missing_fields: []
            });

            const result = await runClassifyChain(
                'fire in building near AIIMS',
                'fire in building near AIIMS',
                {
                    enrichedData: { departments: [], location: {}, is_emergency: true, sensitive_zones: [] },
                    leafletPayload: null,
                    llmOverride: stubLLM
                }
            );

            expect(result.priority).toBe('P1');
            expect(result.severity).toBe('Critical');
        });

        test('sensitive zone escalates priority one level', async () => {
            const stubLLM = createStubLLM({
                severity: 'Medium',
                isEmergency: false,
                missing_fields: []
            });

            const result = await runClassifyChain(
                'garbage near hospital',
                'garbage near hospital',
                {
                    enrichedData: {
                        departments: [],
                        location: {},
                        is_emergency: false,
                        sensitive_zones: [{ zone_name: 'Hamidia Hospital' }]
                    },
                    leafletPayload: null,
                    llmOverride: stubLLM
                }
            );

            // Medium normally = P3, but sensitive zone escalates to P2
            expect(result.priority).toBe('P2');
        });

        test('createLLM throws clear error when GROQ_API_KEY is missing (fail fast at startup)', () => {
            const originalKey = process.env.GROQ_API_KEY;
            delete process.env.GROQ_API_KEY;
            try {
                expect(() => createLLM()).toThrow('GROQ_API_KEY environment variable is required to create LLM instance');
            } finally {
                process.env.GROQ_API_KEY = originalKey;
            }
        });

        test('fallback result on LLM failure returns confidence 0, requiresManualReview true, and logs at error level', async () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const failingLLM = {
                withStructuredOutput: () => ({
                    invoke: async () => { throw new Error('API timeout'); }
                })
            };

            const result = await runClassifyChain(
                'pothole',
                'pothole',
                {
                    enrichedData: { departments: [], location: {}, is_emergency: false, sensitive_zones: [] },
                    leafletPayload: null,
                    llmOverride: failingLLM
                }
            );

            expect(result.category).toBe('Unclassified');
            expect(result.confidence).toBe(0);
            expect(result.confidence_score).toBe(0);
            expect(result.requiresManualReview).toBe(true);
            expect(result._fallbackReason).toBe('API timeout');
            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });
});
