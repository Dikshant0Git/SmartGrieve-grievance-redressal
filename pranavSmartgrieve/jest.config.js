/**
 * Jest Configuration — Multi-project setup
 *
 * Projects:
 *   - unit:        Fast, isolated, no DB. Matches tests/unit/**
 *   - integration: Real Express, in-memory MongoDB. Matches tests/integration/**, tests/ai/**
 *   - contracts:   Agent output shape validation. Matches tests/contracts/**
 *   - security:    Auth, injection, resilience. Matches tests/security/**
 *   - performance: Index checks, latency. Matches tests/performance/**
 *
 * Coverage via built-in Istanbul with lcov + text reporters.
 */

const baseConfig = {
    testEnvironment: 'node',
    clearMocks: true,
    setupFiles: ['<rootDir>/tests/setup/env.js'],
    setupFilesAfterEnv: ['<rootDir>/tests/harness/setup.js'],
    collectCoverageFrom: [
        'src/**/*.{js,mjs}',
        '!src/scripts/**',
        '!src/intelligenceAgent.js',           // Legacy dead copy
        '!src/services/notification.service.js', // Dead code §13.14
        '!src/services/speechToText.service.js', // Dead code §13.15
        '!src/utils/assignOfficer.js',           // Dead code §13.16
        '!src/models/processedGrievance.model.js' // Dead code §13.13
    ]
};

module.exports = {
    coverageReporters: ['text', 'lcov', 'text-summary'],
    coverageThreshold: {
        global: {
            lines: 50,
            branches: 30,
            functions: 30,
            statements: 50
        },
        './src/services/agents/': {
            lines: 60,
            branches: 30,
            functions: 40,
            statements: 60
        }
    },
    // Default: run all test projects
    projects: [
        {
            ...baseConfig,
            displayName: 'unit',
            testMatch: ['<rootDir>/tests/unit/**/*.test.js']
        },
        {
            ...baseConfig,
            displayName: 'integration',
            testMatch: [
                '<rootDir>/tests/integration/**/*.test.js',
                '<rootDir>/tests/ai/**/*.test.js'
            ]
        },
        {
            ...baseConfig,
            displayName: 'contracts',
            testMatch: ['<rootDir>/tests/contracts/**/*.test.js']
        },
        {
            ...baseConfig,
            displayName: 'security',
            testMatch: ['<rootDir>/tests/security/**/*.test.js']
        },
        {
            ...baseConfig,
            displayName: 'performance',
            testMatch: ['<rootDir>/tests/performance/**/*.test.js']
        }
    ],

    // Fallback for `npx jest` without --selectProjects
    ...baseConfig,
    testMatch: ['**/tests/**/*.test.js']
};
