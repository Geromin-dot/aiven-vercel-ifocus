# System additions verification — November 22, 2026

## Implemented behavior

- Guidance Counselor and College Dean appear above the existing telephone contacts in support dialogs, and on the Coach page. Email addresses remain explicitly pending verification; there are no invented email links.
- Flashcard creation includes an upload guide: existing lecture/module/slides PDF, maximum 3 MB; PowerPoint must be exported as PDF; pasted notes maximum 35,000 characters. It explains readability, draft output, and source review. Oversized inputs are rejected before AI allowance is consumed.
- Task effort guidance explains Low/Medium/High and the all-High case. Equal-effort ties retain the supplied list order unless an explicit task preference overrides it. A contradictory model order falls back to consistent guidance.
- Focus sessions retain their starting device category: personal computer (desktop/laptop), mobile (phone/tablet), or unknown. Old sessions are not retrospectively labeled. Analytics summarizes recorded device categories; device or gender does not establish stress, cause a diagnosis, or alter the AI assessment.
- Gender identity is required for new registration and Google account completion. Existing student accounts see a profile notice. Choices include “Prefer not to say.” The server conditionally writes only when the stored value is null. Settings shows the saved value read-only; repeated/concurrent replacement requests fail.
- Coaching instructions encourage one specific achievable step, natural English/Taglish, and student choice, without invented accomplishments, health claims, or guaranteed outcomes. This changes instructions, not model training. Existing rest, health, and safety support remains ahead of study scheduling.

| State | Focus / break | Cycles |
| --- | --- | --- |
| Stressed | 12 / 3 minutes | Student selection, 1–5 |
| Distracted | 25 / 5 minutes | Student selection, 1–5 |
| Engaged | 35 / 10 minutes | Student selection, 1–5 |
| Motivated | 50 / 10 minutes | Student selection, 1–5 |

These mappings are developer-defined, research-informed suggestions, not validated prescriptions for particular emotional states. Explicit custom requests remain bounded to 5–120 focus minutes, 1–60 break minutes, and 1–5 cycles. Rest disclosures return support instead of a study plan. The separate typing-signal recovery action retains its existing five-minute recovery behavior.

## Daily AI allowance

Each account has separate server-side allowances of 10 Quick Reflection AI attempts and 3 flashcard generation attempts per Philippine calendar day. Midnight in UTC+8 starts a new allowance. Conditional database upserts enforce caps across simultaneous requests, tabs, and devices. A valid submitted AI attempt consumes an allowance even if the provider later fails or returns unusable content. Authentication/input failures and locally handled safety/rest support do not consume an AI attempt. Exhaustion returns HTTP 429, displays an explanation, and does not call an AI provider.

The additive database changes in `prisma/student-context.sql` were applied and the Prisma client regenerated. No existing student values were invented or overwritten.

## Verification evidence

- Production build and Prisma schema validation passed.
- Coach suite: 142 tests passed, including provider selection, fallback, safety precedence, task preferences, and daily allowance rejection.
- Timer suite: 74 tests passed; authentication suite: 18 passed; synchronization suite: 4 passed.
- Student context and flashcard route suite: 14 tests passed. The opt-in database test is separate.
- Real database concurrency test passed: 17 concurrent reflection reservations admitted exactly 10; 8 concurrent flashcard reservations admitted exactly 3. It also verified one winning gender write and persisted session device metadata. Only a uniquely named temporary account was created and then deleted with its test records.
- Browser coverage includes new/existing account flows, quota messages, support ordering, journal retention, task ordering, and timer recovery. Screenshots cover Dashboard, flashcard creation, Analytics, Coach, and Settings at 320, 390, 768, 1024, and 1440 px. Registration is also checked at 320, 768, and 1440 px; existing reflection layout checks cover up to 1920 px.
- The full browser run passed 61 checks. Its recovery check initially retained an incorrect expected recovery-break duration; after preserving the existing five-minute recovery expectation while asserting the new twelve-minute subsequent focus block, the targeted rerun passed. All 62 browser scenarios are covered by these successful results.
- Lint passed for the new shared components/helpers/endpoints and modified AI client/routes.

## AI benchmarking boundaries

This run used controlled provider fixtures for AI route/browser tests; it did not make a paid live OpenAI or Gemini generation. A live OpenAI key is not configured in the local workspace. These results establish application behavior, not real model accuracy, motivation effectiveness, real-provider response time, or psychologist validation.

The controlled flashcard fixture uses source text “Mitosis is cell division” and checks a definition card with front “Mitosis,” keyword “Cell division,” and back “Division into two daughter cells.” This is a test fixture, not an independently generated live model sample. PDF tests verify request construction, response validation, refusals, malformed outputs, and errors; they do not establish extraction accuracy on arbitrary documents.

For live manuscript evidence, submit a representative reflection and readable study PDF in the deployed app and record the response/output against its source. Both routes expose `X-iFocus-AI-Provider`, the resolved `X-iFocus-AI-Model` when available, and `Server-Timing`. Runtime logs record timing and fallback status without reflection text or key values. OpenAI requests use `gpt-6-luna`; the Gemini path prefers `gemini-2.5-flash` and reports its resolved model when the helper falls through to another model. Keep live model evidence separate from controlled test results.
