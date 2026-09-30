# SmartGrieve Test Architecture & Strategy

## Phase 0: Environment and Framework Selection Evidence
- **Framework Choice**: **Jest** (with `supertest` and `mongodb-memory-server`).
- **Evidence**: `package.json` does not contain `"type": "module"` and the source code uses CommonJS (`require()`). Therefore, Jest is the appropriate choice.
- **Express App Export**: The Express app is properly exported separately from `listen()`. It is defined and exported in `src/config/app.js` (`module.exports = app`), and then imported into `server.js` where `server.listen()` is called. No changes are required to the application entry points for testing.

## 1. Overview
This test suite provides a comprehensive, deterministic, offline-capable verification pipeline for the SmartGrieve civic grievance backend (`WhatsApp intake -> BullMQ debounce -> AI triage -> complaint lifecycle -> dashboard API`).

## 2. Test Runner Justification
- **Framework**: Jest with `supertest` and `mongodb-memory-server`.
- **Justification**: Matches the backend's CommonJS module system as verified in Phase 0. Provides robust mocking and an out-of-the-box environment for Express integration tests.

## 3. Testing Layers
1. **Unit Layer (`tests/unit/`)**:
   - Tests pure business logic and helper functions in complete isolation.
   - External dependencies (Gemini, Meta Graph API, Cloudinary, Redis) are mocked with deterministic fakes using Jest's mocking system.
2. **Integration Layer (`tests/integration/`)**:
   - Tests component interaction (e.g. WhatsApp intake staging, BullMQ debouncing, triage agents, Mongoose document lifecycle).
   - Uses an ephemeral in-memory MongoDB (`mongodb-memory-server`) to test real Mongoose queries, schema validations, and rollbacks.
3. **Contract Layer (`tests/contract/`)**:
   - Uses `supertest` against Express (`src/config/app.js`).
   - Asserts HTTP status codes, security headers, role-based auth barriers, and JSON response shapes.
4. **AI Evaluation Layer (`tests/ai-eval/`)**:
   - Runs a 25-case multilingual golden benchmark (English, Hindi, Hinglish, typos, multi-issue).
   - Validates schema conformance, category/urgency enums, fallback behavior under rate-limits (429) or malformed LLM responses.
5. **Opt-in Live Smoke Layer (`tests/smoke/`)**:
   - Runs only when `LIVE_SMOKE=1`.
   - Capped at 8 calls with 7-second pacing to strictly respect the Gemini 10 RPM quota.

## 4. Directory Layout
```
tests/
├── README.md                    # Test architecture and execution guide
├── harness/                     # Fixtures, in-memory DB, and fakes
│   ├── setup.js                 # Global hooks and env sanitization
│   ├── inMemoryDb.js            # MongoMemoryServer fixture
│   ├── factories.js             # Grievance, Complaint, User factories
│   ├── fakeGemini.js            # Configurable Gemini SDK stub
│   ├── fakeMeta.js              # WhatsApp Cloud API payload generator
│   ├── fakeCloudinary.js        # Media upload mock
│   └── fakeRedis.js             # In-memory BullMQ/ioredis mock
├── unit/                        # Isolated unit tests
├── integration/                 # Multi-component and defect reproduction tests
├── contract/                    # Express route API contract tests
├── ai-eval/                     # 25-case golden triage evaluation
└── smoke/                       # Live opt-in smoke test (LIVE_SMOKE=1)
```

## 5. Execution Commands
```bash
npm test                 # Run all unit, integration, contract, and AI-eval tests
npm run test:unit        # Run unit tests only
npm run test:integration # Run integration and defect reproduction tests
npm run test:contract    # Run API route contract tests
npm run test:ai          # Run offline AI evaluation suite
npm run test:live        # Opt-in live smoke test against real endpoints
```
