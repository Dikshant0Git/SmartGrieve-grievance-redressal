# AGENTS.md: rules for any AI coding tool working on SmartGrieve

Read this file completely before touching anything. Copy it to GEMINI.md or CLAUDE.md if your tool expects that name.

## 1. What this project is
SmartGrieve is a WhatsApp-and-web civic grievance system for Bhopal Municipal Corporation.
- Backend: Node, Express 5, MongoDB (Mongoose), BullMQ + Redis, Cloudinary, Gemini for media understanding.
- Frontend: React + Vite + TailwindCSS v4 + Leaflet (`pranavFrontend/`).
- AI pipeline: Guardrail agent -> Intelligence agent -> System agent.
- `PROJECT_CONTEXT.md` is the source of truth for architecture and the §27 data contracts. Read the relevant section before changing anything.

## 2. Golden rules
1. **One task at a time.** Do only what the task says. No drive-by refactors, renames, or "improvements".
2. **Model proposes, code decides.** An LLM may extract and suggest. It never writes to the database, assigns officers, sets tiers, or sends messages. Those live in code.
3. **Never invent data.** If the location, department or any field is not in the citizen's input or a tool result, it is `null`. A missing location means ask the citizen, never guess.
4. **Never destroy citizen data.** Do not delete a Grievance or Complaint on any failure. Flag it (`status: 'Failed'` or `requiresManualReview`) and let the job retry.
5. **Notifications are best-effort.** WhatsApp and email sends are wrapped in try/catch, logged, and can never change or fail the grievance. Never retry auth errors (WhatsApp code 190).
6. **Complete files only.** No `...`, no "rest of function", no placeholders.

## 3. Protected: do not modify unless the task names it explicitly
- `guardrail.agent.js` (deterministic, zero-LLM)
- Mongoose model schemas (ask first; a schema change needs a migration note)
- The §27 contracts in `PROJECT_CONTEXT.md` (the shapes passed between agents are frozen)
- `.env` and any secret. Never print, log, or commit secrets.
- Everything under `pranavFrontend/` when the task is backend-only, and vice versa.
- Existing tests: see section 5.

## 4. Location rules (the most common source of bugs here)
Location specificity is decided by code, in four levels:
- `exact` (WhatsApp location pin, EXIF GPS) and `landmark` (named road or landmark) may proceed.
- `area` (a colony or ward name such as "Indrapuri") and `none` must pause the grievance and ask the citizen for a landmark, street or location pin.
- An area centroid is never a resolved location, and is never used for assignment or duplicate clustering.
- A follow-up reply refines the staged grievance. It must never create a second Complaint.

## 5. Tests
- The suite is Jest + mongodb-memory-server + supertest with `fakeRedis.js`. Run `npx jest` before you start and after you finish, and report both results.
- **Never weaken a test to make it pass.** Do not delete, skip, loosen an `expect`, change an input, or rewrite a mock so a bug cannot trigger. If a test must change, state which line and why in your report.
- Every bug fix or new behaviour ships with a test that fails on the old code.
- Tests never call a live API (Gemini, Grok, Meta, email). Stub them.
- `test.failing` marks a known unfixed defect. When you fix the bug, convert it to a normal `test`.

## 6. Environment switches
- `AI_HARNESS=langchain` enables the new AI layer. If unset, the legacy pipeline runs.
- `WHATSAPP_NOTIFICATIONS=off|sandbox|live` and `EMAIL_NOTIFICATIONS=off|test|live` control outbound messages. In `sandbox`/`test` mode, send only to an allow-list.

## 7. Working style
- Work on a branch. Never force-push. Make small commits.
- Ask before adding a dependency, and report its version.
- Prefer indexed database queries over scanning collections.
- Do not touch dead code (`notification.service.js`, `speechToText.service.js`, unused models) unless the task says to remove it.
- Finish every task with a 3-line report: files changed, what changed, test result.

## 8. Performance rules (apply to every change)
- **Measure before optimising.** Never "optimise" on a hunch. Record a before/after number for any performance change.
- **Every query on a growing collection must use an index.** Check with `explain('executionStats')`: `totalDocsExamined` should be close to `nReturned`. No collection scans in a request path.
- **No unbounded reads.** List endpoints always paginate, with a default and a maximum limit, and use field projection and `.lean()`.
- **No database calls or `await` inside loops.** Batch the query, or use `Promise.all` for independent I/O. Watch for N+1 patterns (`populate` in loops, per-item lookups).
- **Hot lookups use prebuilt structures.** Load static data (city context, departments) once at startup into a `Map` or `Set`. Precompile regular expressions at module load. Never use `array.includes` or `find` inside a loop over large data.
- **Never block the event loop.** No synchronous fs, no CPU-heavy work over about 10 ms in a request or job handler. Move it to a queue or worker thread.
- **Keep notifications off the critical path.** WhatsApp and email sends are enqueued or fire-and-log, never awaited before responding or completing the job.
- **Jobs and events carry IDs or URLs, not buffers.** Keep queue payloads small. Set `removeOnComplete` and `removeOnFail` limits.
- **State the Big-O in a comment** for any new algorithm that runs per request or per complaint.
- **Performance changes must keep all tests green and must not change the §27 contracts.**
