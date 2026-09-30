# SmartGrieve — Test Plan (Phase 0: Inventory)

> Generated from `TEST_SUITE_PROMPT.md` Phase 0.
> Baseline: **29 tests (28 passing, 1 failing), ~20.84% line coverage**

---

## 1. Backend Module Inventory

### 1.1 Configuration & Infrastructure

| Module | Path | Tests Planned | §13/§27 Coverage |
|--------|------|---------------|------------------|
| `app.js` | `src/config/app.js` | Integration: CORS, error middleware, 404 JSON | §13.8 (error MW), §13.9 (CORS) |
| `redis.config.js` | `src/config/redis.config.js` | Unit: missing REDIS_URL fail-fast, connection string parse | — |
| `db.js` | `src/database/db.js` | Unit: missing MONGODB_URI fail-fast | — |
| `city-context.json` | `src/config/city-context.json` | Unit: schema shape assertions (zones, wards, depts) | — |
| `server.js` | `server.js` | Integration: server start, Socket.IO init | §13.7 (Socket) |

### 1.2 Models

| Module | Path | Tests Planned | §13/§27 Coverage |
|--------|------|---------------|------------------|
| `user.model.js` | `src/models/user.model.js` | Unit: validation (required fields, enum, hashing) | §27.5 |
| `grievance.model.js` | `src/models/grievance.model.js` | Unit: status enum, default values | — |
| `complaint.model.js` | `src/models/complaint.model.js` | Unit: schema shape, complaintId format, status enum, location coords | §27.4 |
| `department.model.js` | `src/models/department.model.js` | Unit: schema shape | — |
| `userWarning.model.js` | `src/models/userWarning.model.js` | Unit: strike count default, schema | — |
| `processedGrievance.model.js` | `src/models/processedGrievance.model.js` | **EXCLUDED** (dead code §13.13) | §13.13 |
| `whatsappSession.model.js` | `src/models/whatsappSession.model.js` | Unit: schema shape | — |
| `manualReview.model.js` | `src/models/manualReview.model.js` | Unit: schema shape | — |

### 1.3 Controllers

| Module | Path | Tests Planned | §13/§27 Coverage |
|--------|------|---------------|------------------|
| `whatsapp.controller.js` | `src/controllers/whatsapp.controller.js` | Integration: GET verify, POST intake, missing fields | — |
| `auth.controllers.js` | `src/controllers/auth.controllers.js` | Integration: register, login, OTP verify, token refresh, role-based | §27.5, §14.1 |
| `complaint.controller.js` | `src/controllers/complaint.controller.js` | Integration: CRUD, public endpoint shape, pagination, validation 400s | §27.4 |
| `admin.controller.js` | `src/controllers/admin.controller.js` | Integration: admin-only access, stats, complaint update | — |
| `department.controller.js` | `src/controllers/department.controller.js` | Integration: dept CRUD, officer query | — |
| `citycontext.controller.js` | `src/controllers/citycontext.controller.js` | Unit: resolveLocation, resolveDepartments, resolveSlang, checkEmergency, checkChronic, checkSpam, buildGeminiContext, Haversine, sensitive zones | §27.2, §13.6 |
| `grievance.controller.js` | `src/controllers/grievance.controller.js` | Integration: grievance list/query | — |

### 1.4 Services

| Module | Path | Tests Planned | §13/§27 Coverage |
|--------|------|---------------|------------------|
| `ai.service.js` | `src/services/ai.service.js` | Integration: intake→bundle→guardrail→intelligence→system flow, bundle timer, duplicate message ID, all message types | §13.1, §13.3, §13.5, §6.1 |
| `assignment.service.js` | `src/services/assignment.service.js` | Unit: getBestOfficer, workload balance, empty dept fallback | §17 |
| `cron.service.js` | `src/services/cron.service.js` | Unit: SLA check logic, escalation | §16 |
| `duplicate.detector.js` | `src/services/duplicate.detector.js` | Unit: Jaccard similarity, cluster decision, nearby same-category | §18 |
| `mail.service.js` | `src/services/mail.service.js` | Unit: Resend client init, missing API key, send success/failure | — |
| `media.service.js` | `src/services/media.service.js` | Unit: processWhatsAppImage, processWhatsAppVideo, processWhatsAppAudio, fetchMetaMediaUrl | §13.1, §13.2 |
| `system.resolver.js` | `src/services/system.resolver.js` | Unit: resolveLocation, landmark/ward/zone matching | §27.2 |
| `whatsapp.service.js` | `src/services/whatsapp.service.js` | Unit: sendWhatsAppMessage, token header, error handling | — |
| `gemini.service.mjs` | `src/services/gemini.service.mjs` | Contract: mock boundary, response shape | §15 |
| `textToSpeech.service.js` | `src/services/textToSpeech.service.js` | Unit: TTS call shape, missing key fallback | — |
| `notification.service.js` | `src/services/notification.service.js` | **EXCLUDED** (dead code §13.14) | §13.14 |
| `speechToText.service.js` | `src/services/speechToText.service.js` | **EXCLUDED** (dead code §13.15) | §13.15 |

### 1.5 Agents

| Module | Path | Tests Planned | §13/§27 Coverage |
|--------|------|---------------|------------------|
| `guardrail.agent.js` | `src/services/agents/guardrail.agent.js` | Unit: spam rules, status inquiry, abusive content, emergency bypass, strike logic, all tier outputs | §27.1 |
| `intelligence.agent.js` | `src/services/agents/intelligence.agent.js` | Unit+Integration: priority derivation, image-only confidence cap, media enrichment, LangChain switch, fallback on LLM failure | §27.2, §13.6 |
| `system.agent.js` | `src/services/agents/system.agent.js` | Integration: Green/Yellow/Red tier flows, duplicate detection, Yellow→Green follow-up (no duplicate Complaint), location resolution, officer assignment, SLA assignment | §27.3, §13.3, §13.4 |

### 1.6 AI Layer (LangChain)

| Module | Path | Tests Planned | §13/§27 Coverage |
|--------|------|---------------|------------------|
| `llm.js` | `src/ai/llm.js` | Unit: createLLM config, missing API key | — |
| `classification.schema.js` | `src/ai/schemas/classification.schema.js` | Unit: derivePriority, validateLocationEvidence, Zod parse valid/invalid | §27.2 |
| `classify.js` | `src/ai/prompts/classify.js` | Unit: prompt builder includes context | — |
| `reply.js` | `src/ai/prompts/reply.js` | Unit: reply prompt language selection | — |
| `media.js` | `src/ai/prompts/media.js` | Unit: prompt exports exist | — |
| `civic.tools.js` | `src/ai/tools/civic.tools.js` | Unit: tool wrapper outputs match expected shapes | — |
| `classify.chain.js` | `src/ai/chains/classify.chain.js` | Integration: stubbed LLM end-to-end, fallback on failure | — |

### 1.7 Routes

| Module | Path | Tests Planned | §13/§27 Coverage |
|--------|------|---------------|------------------|
| `whatsapp.routes.js` | `src/routes/whatsapp.routes.js` | Integration: GET /webhook, POST /webhook | — |
| `auth.route.js` | `src/routes/auth.route.js` | Integration: all auth endpoints | §27.5 |
| `complaint.router.js` | `src/routes/complaint.router.js` | Integration: CRUD endpoints | §27.4 |
| `admin.router.js` | `src/routes/admin.router.js` | Integration: admin endpoints, RBAC | — |
| `department.route.js` | `src/routes/department.route.js` | Integration: dept endpoints | — |
| `grievance.routes.js` | `src/routes/grievance.routes.js` | Integration: grievance endpoints | — |

### 1.8 Middlewares

| Module | Path | Tests Planned | §13/§27 Coverage |
|--------|------|---------------|------------------|
| `authMiddleware.js` | `src/middlewares/authMiddleware.js` | Unit: valid JWT, expired JWT, missing token, forged token | §27.5 |
| `role.middleware.js` | `src/middlewares/role.middleware.js` | Unit: allowed role passes, disallowed role returns 403 | — |
| `upload.middleware.js` | `src/middlewares/upload.middleware.js` | Unit: multer config | — |

### 1.9 Utilities

| Module | Path | Tests Planned | §13/§27 Coverage |
|--------|------|---------------|------------------|
| `emailTemplates.js` | `src/utils/emailTemplates.js` | Unit: template functions return HTML strings with expected placeholders | — |
| `generateOtp.js` | `src/utils/generateOtp.js` | Unit: returns 6-digit string, never starts with leading zero | — |
| `assignOfficer.js` | `src/utils/assignOfficer.js` | **EXCLUDED** (dead code §13.16) | §13.16 |

### 1.10 Constants

| Module | Path | Tests Planned | §13/§27 Coverage |
|--------|------|---------------|------------------|
| `departments.js` | `src/constants/departments.js` | Unit: CATEGORY_TO_DEPT keys match system.agent.js copy | §13.12 |
| `officers.js` | `src/constants/officers.js` | Unit: shape assertions | — |

---

## 2. Frontend Module Inventory (pranavFrontend)

| Module | Path | Tests Planned | §13/§27 Coverage |
|--------|------|---------------|------------------|
| `App.jsx` | `src/App.jsx` | Component: routing, protected routes render | — |
| `AuthContext.jsx` | `src/AuthContext.jsx` | Component: provider supplies user/token | — |
| `LoginRegister.jsx` | `src/LoginRegister.jsx` | Component: form validation, submit, error states | — |
| `OfficerLogin.jsx` | `src/OfficerLogin.jsx` | Component: form validation, submit, error states | — |
| `VerifyOtp.jsx` | `src/VerifyOtp.jsx` | Component: OTP input validation, resend logic | — |
| `ForgotPassword.jsx` | `src/ForgotPassword.jsx` | Component: email input, submit, error states | — |
| `Citizen.jsx` | `src/Citizen.jsx` | Component: complaint form, validation, media attach | — |
| `CitizenDashboard.jsx` | `src/CitizenDashboard.jsx` | Component: loading/empty/error, complaint cards, socket hook, voice recorder | §13.7, §27.4 |
| `OfficerDashboard.jsx` | `src/OfficerDashboard.jsx` | Component: complaint list, status update, socket live update | §13.7, §27.4 |
| `AdminDashboard.jsx` | `src/AdminDashboard.jsx` | Component: stats, filters, admin actions | — |
| `Heatmap.jsx` | `src/Heatmap.jsx` | Component: Leaflet mock, coordinates [lat,lng], markers with area/count | §27.4 |
| `ProtectedRoute.jsx` | `src/ProtectedRoute.jsx` | Component: redirect when no token | — |
| `api.js` | `src/api.js` | Unit: base URL, interceptors | — |

---

## 3. Queue & Worker Inventory

| Component | Location | Tests Planned | §13/§27 Coverage |
|-----------|----------|---------------|------------------|
| Intake Queue | `ai.service.js:31` | Integration: addToIntakeQueue, idempotent message IDs | — |
| Intake Worker | `ai.service.js:187-315` | Integration: text/image/audio/video/location pin/unsupported types | §13.1, §13.2 |
| Bundle Queue | `ai.service.js:32` | Integration: 30s debounce (fake timers), timer reset on new message | §9.1 |
| Bundle Worker | `ai.service.js:163-185` | Integration: finalize bundle, trigger AI queue | — |
| AI Processing Queue | `ai.service.js:30` | Integration: guardrail→intelligence→system pipeline | §6.3 |
| AI Worker | `ai.service.js:37-135` | Integration: failure handling, retry, dead-letter | §9.2 |
| AI Worker Failed | `ai.service.js:140-157` | Integration: fallback notification, status=Failed | §AGENTS.md rule 4 |

---

## 4. Excluded Modules (Dead Code)

| Module | Path | Reason | §13 Reference |
|--------|------|--------|---------------|
| `notification.service.js` | `src/services/notification.service.js` | Duplicates whatsapp.service.js | §13.14 |
| `speechToText.service.js` | `src/services/speechToText.service.js` | Superseded by gemini.service.mjs | §13.15 |
| `assignOfficer.js` | `src/utils/assignOfficer.js` | Superseded by assignment.service.js | §13.16 |
| `processedGrievance.model.js` | `src/models/processedGrievance.model.js` | Never imported | §13.13 |
| `intelligenceAgent.js` (root) | `src/intelligenceAgent.js` | Legacy copy of intelligence.agent.js | — |

---

## 5. Coverage Gap Analysis

| Area | Current Lines % | Target % | Gap | Priority |
|------|----------------|----------|-----|----------|
| `src/services/agents/` | 38.06% | 80% | **41.94%** | **Critical** |
| `src/services/agents/guardrail.agent.js` | 18.42% | 80% | 61.58% | P1 |
| `src/services/agents/intelligence.agent.js` | 15.88% | 80% | 64.12% | P1 |
| `src/services/agents/system.agent.js` | 62.16% | 80% | 17.84% | P2 |
| `src/controllers/` | 23.39% | 70% | **46.61%** | **Critical** |
| `src/controllers/auth.controllers.js` | 9.88% | 70% | 60.12% | P1 |
| `src/controllers/complaint.controller.js` | 9.67% | 70% | 60.33% | P1 |
| `src/controllers/citycontext.controller.js` | 58.68% | 70% | 11.32% | P3 |
| `src/services/` (non-agent) | 24.78% | 70% | **45.22%** | **Critical** |
| `src/services/ai.service.js` | 37.74% | 70% | 32.26% | P2 |
| `src/services/media.service.js` | 15.47% | 70% | 54.53% | P1 |
| `src/services/duplicate.detector.js` | 21.62% | 70% | 48.38% | P2 |
| `src/middlewares/` | 20.00% | 70% | **50.00%** | **High** |
| `src/utils/` | 40.90% | 70% | **29.10%** | **Medium** |
| **Backend Overall** | **~25%** | **70%** | **~45%** | **Critical** |
| **Frontend** | **0%** | **60%** | **60%** | **Critical** |

---

## 6. Test Type Distribution Plan

| Phase | Type | Estimated Tests | Files |
|-------|------|-----------------|-------|
| Phase 1 | Tooling & structure | 0 (setup only) | jest.config.js, helpers, CI |
| Phase 2 | Unit tests | ~120 | tests/unit/**/*.test.js |
| Phase 3 | Integration tests | ~60 | tests/integration/**/*.test.js |
| Phase 4 | AI pipeline (contract + golden set) | ~50 | tests/contracts/, tests/fixtures/golden.json |
| Phase 5 | Security & resilience | ~30 | tests/security/**/*.test.js |
| Phase 6 | Frontend component | ~40 | pranavFrontend/tests/**/*.test.jsx |
| Phase 7 | E2E (Playwright) | ~5 journeys | tests/e2e/**/*.spec.js |
| Phase 8 | Performance & mutation | ~10 + mutation report | tests/performance/**/*.test.js |
| **Total** | | **~315** | |

---

## 7. Existing Tests (Protected — Never Weaken)

| Test ID | File | Status | Defect |
|---------|------|--------|--------|
| T-001 | `tests/integration/defects.test.js` | ✅ Passing | §13.1 — processWhatsAppVideo import |
| T-002 | `tests/integration/defects.test.js` | ✅ Passing | §13.2 — processWhatsAppAudio buffer |
| T-003 | `tests/integration/defects.test.js` | ✅ Passing | §13.3 — Duplicate Complaint prevention |
| T-004 | `tests/integration/defects.test.js` | ✅ Passing | §13.5 — Memory leak cleanup |
| T-005 | `tests/integration/defects.test.js` | ✅ Passing | §13.6 — Priority P1-P4 mapping |
| T-006 | `tests/integration/defects.test.js` | ✅ Passing | §13.8 — Global error middleware |
| LangChain suite (23) | `tests/ai/langchain.test.js` | ✅ All passing | derivePriority, validation, tools, chain |

---

## 8. Planned Test Directory Structure (Phase 1)

```
tests/
├── unit/                          # Mirrors src/, fast, no DB
│   ├── config/
│   ├── controllers/
│   │   └── citycontext.test.js
│   ├── middlewares/
│   │   ├── auth.test.js
│   │   └── role.test.js
│   ├── models/
│   ├── services/
│   │   ├── agents/
│   │   │   ├── guardrail.test.js
│   │   │   ├── intelligence.test.js
│   │   │   └── system.test.js
│   │   ├── assignment.test.js
│   │   ├── duplicate.test.js
│   │   ├── mail.test.js
│   │   └── media.test.js
│   └── utils/
│       ├── generateOtp.test.js
│       └── emailTemplates.test.js
├── integration/                   # Real Express app, in-memory MongoDB
│   ├── defects.test.js            # EXISTING (protected)
│   ├── webhook.test.js
│   ├── queue-flow.test.js
│   ├── auth.test.js
│   ├── complaints.test.js
│   ├── assignment-sla.test.js
│   └── socket.test.js
├── contracts/                     # Agent output shape validation
│   ├── guardrail.contract.test.js
│   ├── intelligence.contract.test.js
│   └── system.contract.test.js
├── security/                      # Auth bypass, injection, signatures
│   ├── auth.test.js
│   ├── injection.test.js
│   ├── webhook-signature.test.js
│   └── resilience.test.js
├── performance/                   # Index checks, latency budgets
│   └── queries.test.js
├── e2e/                           # Playwright (Phase 7)
├── ai/                            # EXISTING: langchain.test.js
│   ├── langchain.test.js          # EXISTING (protected)
│   ├── golden.test.js
│   ├── hallucination.test.js
│   └── injection.test.js
├── factories/                     # Data builders
│   └── index.js
├── fixtures/                      # Static test data
│   └── golden.json
├── helpers/                       # Shared setup
│   ├── db.js
│   ├── redis.js
│   ├── http-mocks.js
│   ├── time.js
│   └── app.js
└── harness/                       # EXISTING (protected)
    ├── factories.js
    ├── fakeCloudinary.js
    ├── fakeGemini.js
    ├── fakeMeta.js
    ├── fakeRedis.js
    ├── inMemoryDb.js
    └── setup.js
```

---

## Phase 0 Report

1. **Files created:** `tests/TEST_PLAN.md` (this file)
2. **Test counts:** 28 passing, 1 failing, 0 skipped (baseline)
3. **Coverage:** ~25% lines backend, 0% frontend (baseline 20.84% as of §22)
4. **Bugs found:** None in this phase (read-only inventory)
5. **Cannot test:** Dead code modules are excluded per `AGENTS.md §7`. The `intelligenceAgent.js` at the root of `src/` appears to be a legacy duplicate of `src/services/agents/intelligence.agent.js`.
