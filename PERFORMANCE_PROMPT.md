# SmartGrieve: performance and time-complexity optimisation (phased executor prompt)

Paste the SHARED RULES plus one phase at a time. The findings below are HYPOTHESES from the audit document, not verified facts. Phase 0 exists to confirm or reject each one.

---

## SHARED RULES

Read `AGENTS.md` (especially section 8), `PROJECT_CONTEXT.md` and `tests/TEST_PLAN.md` if it exists.

1. **Measure first, change second.** Every change needs a before and after number from the same test. No number, no change.
2. **Behaviour must not change.** Run `npx jest` before and after every phase; all tests stay green. The §27 contracts are frozen. Never weaken a test.
3. **One optimisation at a time,** each in its own commit with the message `perf: <what> (<before> -> <after>)`.
4. **Correctness beats speed.** If an optimisation adds risk to a citizen-facing behaviour (location, tier, assignment), skip it and report.
5. **No new dependency** unless the phase names it. Report versions.
6. **Do not touch** `guardrail.agent.js` logic, model field names, or the frontend unless the phase says so.
7. **Finish each phase with a report:** changes made; before/after table (query or function, complexity, measured time); anything skipped and why; risks.

---

## PHASE 0: baseline and profile (report only, no source changes)

1. Create `scripts/seed-perf.js` that fills a test database with 20,000 complaints (realistic Bhopal coordinates, categories, statuses, dates), 200 officers, and 5,000 staging grievances. Use the in-memory or a local MongoDB.
2. Measure and record in `docs/PERFORMANCE.md` (baseline table):
   - `explain('executionStats')` for: the duplicate-detection query, the public complaints endpoint query, the heatmap query, officer selection in `getBestOfficer`, staging lookups by phone number, dashboard list queries. Note `totalDocsExamined` versus `nReturned` and whether each is a `COLLSCAN`.
   - Latency (p50/p95/p99) with `autocannon` for: the WhatsApp webhook POST, `GET /api/complaints/public`, a dashboard list endpoint, login.
   - Per-stage timing of one complaint through the pipeline (guardrail, media, LLM, geo-resolution, duplicate check, assignment, DB write, notifications) using stubbed LLM and network.
   - A CPU profile (`node --cpu-prof`) of 500 complaints through the agents; list the top 10 functions by self time.
3. For each hypothesis below, mark CONFIRMED, REJECTED or UNKNOWN with evidence, and give the Big-O of the current implementation.

Hypotheses to test:
- H1: the duplicate detector scans the 50 most recent same-category complaints and runs Jaccard on each, instead of a geo-indexed query.
- H2: city-context lookups (landmarks, aliases, slang, sensitive zones) loop over arrays for every complaint, and the JSON may be re-parsed or the regexes recompiled per call.
- H3: `getBestOfficer` loads many officers or complaints and counts workload in JavaScript.
- H4: list and public endpoints are unpaginated and return full documents (no `.lean()`, no projection).
- H5: there are missing indexes (no `2dsphere` on location; no compound indexes on status/category/department/createdAt; no index on staging phone number; no unique index for WhatsApp message IDs).
- H6: independent I/O is done sequentially (media download, Cloudinary upload, DB writes, notifications) and notifications are awaited inside the job.
- H7: the BullMQ queues use default concurrency, keep completed jobs forever, and job payloads or globals hold raw media buffers.
- H8: HTTP calls to external services create a new connection every time (no keep-alive).
- H9: the heatmap and map load every complaint at once, and the frontend re-renders all markers on each update.
- H10: no compression, no cache headers, and no server-side cache on public endpoints.

STOP after Phase 0 and report.

---

## PHASE 1: database (indexes and queries)

- Add the missing indexes found in Phase 0. Expected candidates: `2dsphere` on `location`; compound `{ category: 1, status: 1, createdAt: -1 }`; `{ department: 1, status: 1, createdAt: -1 }`; staging `{ phone: 1, status: 1 }`; a unique sparse index on the WhatsApp message ID (idempotency); officers `{ department: 1, available: 1, activeCount: 1 }`. Declare them in the Mongoose schemas via `schema.index(...)`, and provide `scripts/ensure-indexes.js`. Adding an index is the only schema change allowed here; ask before anything else.
- Add a TTL index that expires abandoned staging grievances after a configurable period.
- Rewrite the duplicate lookup as a `$geoNear` or `$nearSphere` query filtered by category, open statuses and a time window, with a small `limit`. Complexity target: O(log n + k) instead of O(n).
- Rewrite `getBestOfficer` as one indexed query or aggregation (`$sort` by workload, `$limit 1`) instead of loading and counting in JavaScript.
- Use `.lean()` and field projection on every read-only query. Replace loops that run one query per item with a single `$in` query or `$lookup`.
- Move statistics and grouping (counts per category, ward or status) into `aggregate()` pipelines.
- Add tests asserting index usage via `explain()` (`IXSCAN`, and `totalDocsExamined` within 2x of `nReturned`).

---

## PHASE 2: algorithms and in-memory structures

- Load city context once at startup into frozen structures: `Map` for exact alias-to-landmark lookup, an inverted token index for fuzzy matching, and a grid or geohash bucket index for sensitive-zone and landmark proximity (check only the neighbouring cells instead of every zone). Complexity target: O(1) exact, O(k) fuzzy, O(1) proximity per complaint, down from O(n) or O(n x m).
- Precompile all regexes at module load. Replace `array.includes` and `find` inside loops with `Set` and `Map`.
- Text similarity: tokenise once and cache the token `Set`; use the size-ratio early exit (Jaccard is at most min(|A|,|B|) / max(|A|,|B|), so skip pairs that cannot reach the threshold). Haversine: apply a bounding-box prefilter before the trigonometry.
- Add micro-benchmarks (`tests/performance/*.bench.js`) with a scale test: run at n = 1,000 and n = 10,000 and assert the growth is sub-linear where the design promises it.
- Add a comment above each optimised function stating the Big-O before and after.

---

## PHASE 3: pipeline concurrency and I/O

- Run independent I/O in parallel with `Promise.all` (for example media download plus Cloudinary upload, and independent DB reads). Keep dependent steps sequential.
- Take WhatsApp and email notifications off the critical path: enqueue an `outbound` job (BullMQ) with backoff for transient errors and no retry for auth errors. The complaint job must complete without waiting for delivery.
- Tune BullMQ per queue: higher `concurrency` for I/O-bound workers; a `limiter` on the LLM queue that matches the provider's requests-per-minute; `removeOnComplete` (age and count) and `removeOnFail` limits; a dead-letter path for exhausted jobs.
- Replace the global media buffers with Redis (with a TTL) or a temp directory; jobs carry IDs or URLs only.
- Reuse HTTP connections to Meta, xAI, Gemini and Cloudinary with a keep-alive agent (`undici` Agent or `http.Agent({ keepAlive: true })`). Add timeouts and `AbortController` to every outbound call.
- Send an immediate short acknowledgement to the WhatsApp user ("Received, processing your complaint") inside the free service window, before the 30-second bundle window and the LLM call finish. This improves perceived speed at almost no cost. Make the bundle window configurable via an environment variable (`BUNDLE_WINDOW_MS`).
- Confirm the webhook acknowledges Meta with HTTP 200 in under 200 ms p95 (verify, enqueue, respond).

---

## PHASE 4: API layer

- Paginate every list endpoint (default 20, max 100), preferring cursor pagination on `createdAt` and `_id` for large sets. Return only the fields the UI needs.
- Add `compression`, `helmet`, and `express-rate-limit` (also a security gain), plus `Cache-Control` and ETag on public endpoints.
- Add a short Redis cache (5-10 seconds) for the heatmap and public complaint queries, invalidated or expired when new complaints arrive.
- Add a viewport query for the map (`$geoWithin` with `$box`, or `bbox` parameters) so the map loads only visible complaints, with a maximum result count.
- Add timing middleware and structured logs (`pino`) with per-request and per-pipeline-stage durations.

---

## PHASE 5: realtime and frontend

- Socket.IO: emit small delta payloads (id, status, coordinates, category, count), not full lists; scope rooms by department and area; batch or throttle map updates to at most one per second; use the Redis adapter if workers run in another process.
- Map: use marker clustering (`leaflet.markercluster`) or the canvas renderer for large sets; update markers by id instead of re-rendering all of them.
- React: lazy-load routes (including the map), `React.memo` and `useMemo` only where the profiler shows re-render cost, debounce search inputs, and cache server data with TanStack Query.
- Vite: analyse the bundle (`rollup-plugin-visualizer`), split vendor chunks, and set a budget (main bundle under 250 kB gzipped is a sensible starting target).

---

## PHASE 6: load test, budgets and documentation

Re-run the Phase 0 measurements at 20,000 and 100,000 complaints and fill in the after column. Proposed targets (tune to what your hardware allows):

| Path | Target |
|---|---|
| Webhook acknowledgement | p95 under 200 ms |
| `GET /api/complaints/public` (paginated or viewport) | p95 under 300 ms at 100k complaints |
| Duplicate/cluster query | under 20 ms, `IXSCAN` |
| Non-LLM pipeline overhead per complaint | under 150 ms |
| Officer assignment | under 30 ms |

Write `docs/PERFORMANCE.md`: a table of every changed function or query with Big-O before and after, measured numbers, remaining bottlenecks, and how to re-run the benchmarks. Add `npm run perf` to run the load and index-usage checks in CI, failing if a budget is missed by more than 20%.
