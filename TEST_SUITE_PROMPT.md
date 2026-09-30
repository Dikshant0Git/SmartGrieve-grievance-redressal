# SmartGrieve: full test suite (phased executor prompt)

Paste the SHARED RULES plus one phase at a time. Do not run phases together. Each phase ends with a green run and a report.

---

## SHARED RULES (include with every phase)

Read `AGENTS.md`, `PROJECT_CONTEXT.md` (especially §13 defects and §27 contracts) and `tests/integration/defects.test.js` first.

1. **Do NOT modify anything under `src/` or `pranavFrontend/src/`.** You only add tests, test config, fixtures, helpers and CI files. If you find a bug, report it.
2. **Test intended behaviour, not current behaviour.** Take expected results from §27, `AGENTS.md`, and the documented rules, not from what the code happens to return. Where code contradicts intent, write the correct assertion and mark it `test.failing` with a comment `// BUG: <id> <one line>`. Never encode a bug as expected behaviour.
3. **Never weaken, delete, skip or loosen an existing test.** The six T-001 to T-006 regression tests stay.
4. **Deterministic and offline.** No live network. Mock Meta/WhatsApp, xAI/Grok, Gemini, Cloudinary and email at the HTTP boundary (`nock` for backend, `msw` for frontend). Use fake timers for the 30-second bundle window and freeze `Date` where time matters. No sleeping, no random values without a fixed seed.
5. **Isolation.** Every test cleans its own data. No test depends on another test's order.
6. **Conventions:** Arrange-Act-Assert; one behaviour per test; names read as `should <behaviour> when <condition>`; files mirror the source tree; shared setup in `tests/helpers/`, data builders in `tests/factories/`, static data in `tests/fixtures/`.
7. **Dependencies:** you are authorised to install ONLY the devDependencies named in the phase. Report their versions.
8. **Finish with a 5-line report:** files created; test counts (passing, `test.failing`, skipped); coverage for touched areas; bugs found (id, file:line, one line); anything you could not test and why.

---

## PHASE 0: inventory (read only, writes one file)

Create only `tests/TEST_PLAN.md`. For the backend, frontend, queues/workers, agents, models, routes and socket layer, list every module and, for each, the tests planned (unit / integration / e2e / security / performance) and the §13 or §27 behaviours it covers. Mark modules that are dead code (`notification.service.js`, `speechToText.service.js`, unused models) as "excluded". Include a coverage-gap table against the current 20.84% baseline. Then STOP and report. Write no test code in this phase.

---

## PHASE 1: tooling and structure

devDependencies allowed: `jest` (existing), `supertest`, `mongodb-memory-server`, `ioredis-mock` (or keep `fakeRedis.js`), `nock`, `socket.io-client`, `fast-check`, `eslint` plus a standard config.

Create:
```
tests/
  unit/ (mirrors src)   integration/   contracts/   security/   performance/   e2e/
  factories/            fixtures/      helpers/  (db.js, redis.js, http-mocks.js, time.js, app.js)
```
`jest.config.js` with separate projects for `unit` and `integration`. Scripts in `package.json`: `test`, `test:unit`, `test:integration`, `test:security`, `test:perf`, `test:coverage`, `test:ci`. Coverage via built-in Istanbul with lcov and text reporters. Add `.github/workflows/ci.yml`: install, lint, unit, integration, coverage upload.

---

## PHASE 2: unit tests (fast, isolated, no DB)

Cover every pure function and small module, with boundaries and error paths:
- priority derivation (severity to P1-P4, escalation), SLA calculation
- location specificity (`exact`, `landmark`, `area`, `none`), coordinate handling, longitude/latitude order, Haversine
- text similarity (Jaccard), duplicate/cluster decision functions
- slang, department and category mapping, emergency keywords, sensitive-zone modifiers
- guardrail rules (spam, status inquiries, abusive content, strike logic)
- message bundling helpers, input sanitisation, phone/email validation
- env/config loader (missing variables fail fast)

Add **property-based tests** with `fast-check` for: Haversine (symmetry, zero distance, triangle inequality), Jaccard (range 0-1, symmetric, identical text equals 1), priority mapping (always one of P1-P4, never lower after escalation).

---

## PHASE 3: integration tests (real Express app, in-memory MongoDB, fake Redis, mocked HTTP)

Using `supertest` against the real app:
- **WhatsApp webhook:** verification handshake, POST intake, every message type (text, image, audio, video, location pin, unsupported), idempotency on repeated message IDs, malformed payloads
- **Queue flow:** intake -> bundle (fake timers) -> guardrail -> intelligence -> system, for Green, Yellow and Red tiers
- **Yellow to Green follow-up:** exactly ONE Complaint (T-003 regression); "Indrapuri"-only asks for detail; the follow-up refines the staged grievance
- **Duplicates and clustering:** nearby same-category complaints link to a parent and increment `reportCount`; different category, far away or old ones do not
- **Failure handling:** LLM throws 503 -> grievance kept with `Failed`; WhatsApp 190 -> grievance unaffected, no retry; email rejects address -> grievance unaffected; DB error mid-pipeline
- **REST API:** auth (register, login, token expiry), role-based access (citizen, officer, admin), CRUD on complaints, `/api/complaints/public` response shape, pagination, validation errors returning JSON 400s, unknown route returning JSON 404, thrown error returning JSON 500 (T-006)
- **Assignment and SLA:** officer selection, workload balance, SLA deadline
- **Socket.IO** with `socket.io-client`: joining a department room, and events on create, update and assign

---

## PHASE 4: AI pipeline tests (stubbed model at the provider boundary)

- **Contract tests:** every agent output validated against the §27 zod schemas
- **Golden set:** `tests/fixtures/golden.json` with 40 complaints (English, Hindi, Hinglish; with and without location; emergencies; spam; media-only) and expected department, location level and tier
- **Hallucination guards:** no-location input never yields a location; a quote in `location_evidence` that is not in the text is discarded
- **Prompt injection fixtures:** complaints containing "ignore your instructions", role-play and JSON-breaking text must not change tier, department or leak the system prompt
- **Cost and speed guards:** exactly one model call per complaint (assert the stub's call count); timeout produces the fallback object, never a crash
- **Provider switch:** the same golden set passes with the Grok stub and the Gemini stub

---

## PHASE 5: security and resilience

- WhatsApp `X-Hub-Signature-256` verification (valid, invalid, missing)
- Authentication and authorisation: expired or forged JWT, privilege escalation, accessing another citizen's data
- NoSQL injection payloads in query and body, oversized bodies, rate limiting, malformed JSON
- File and media handling: wrong MIME type, oversized upload, missing media ID
- Secrets never appear in logs or error responses
- Resilience: Redis down, Mongo reconnect, queue job retries and stalled jobs (no silent loss)

---

## PHASE 6: frontend unit and component tests

devDependencies allowed: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `msw`.

Cover forms (validation, submit, error states), auth flow, dashboards (loading, empty, error, data), the Leaflet map and heatmap components (mock Leaflet; assert that coordinates are passed as `[lat, lng]` and that markers show area and report count), and the socket hook (an event updates the UI). Use accessible queries (`getByRole`) first.

---

## PHASE 7: end-to-end (Playwright)

devDependency allowed: `@playwright/test`. Start the backend in test mode with in-memory MongoDB and stubbed external APIs via a `tests/helpers/startTestServer.js`. Critical journeys:
1. citizen registers, logs in, submits a complaint through the web form, sees the ticket ID and status
2. officer logs in and sees the complaint appear live (socket), changes its status, and the citizen view updates
3. two citizens report the same nearby issue; the officer sees ONE bundled item with a count of 2
4. admin views the map and heatmap, and the complaint appears with its area
5. a WhatsApp webhook payload posted to the server (simulating Meta) results in a complaint visible in the dashboard
Capture traces and screenshots on failure.

---

## PHASE 8: performance, mutation and gates

- **Performance:** assert via `explain()` that the duplicate/cluster query and public complaint queries use an index (no collection scan); a light `autocannon` smoke test on the webhook and `/api/complaints/public` with a stated latency budget
- **Mutation testing:** install `@stryker-mutator/core` with the Jest runner and run it on `guardrail.agent.js`, the priority and location functions, and the duplicate detector. Report the mutation score and list surviving mutants (these are the weak spots in the tests)
- **Coverage gates:** thresholds in `jest.config.js`: 80% lines on `src/services/agents` and utilities, 70% backend overall, 60% frontend
- **CI:** extend the workflow to run all layers and fail on threshold breaches
