# iFocus IT evaluation retest and demonstration guide

31 October 2026 · Repair build based on 3953858

The two confirmed defects are repaired: fabricated focus durations are rejected by the server, and Settings no longer overflows at 320 px. Final classification of the supplied 20 statements: **10 PASS within the measured scope, 10 PARTIAL or needing human/device evidence, 0 confirmed FAIL in the final bounded checks.** This is not an ISO certification.

The partial classifications are not ten newly discovered broken features. They mark broad claims, questionnaire wording, or evidence that automation cannot establish. In particular, reflection logs appear in AI Coach rather than Analytics, phone suspension needs actual-device checks, and navigation clarity needs student feedback.

## Test scope

Local optimized production build, actual PostgreSQL, live Gemini, and Microsoft Edge Chromium. Temporary dummy users were created and removed; real student records were not edited. Chart data was an isolated synthetic 67-minute fixture, not claimed as actual study activity. No new paid service, database table or QStash setup is required for these repairs.

**59 regression tests passed; production build passed; Prisma schema validation passed; new helper lint passed.** Existing full-source lint remains at 59 errors and 19 warnings. Physical phones, other browser engines, OS minimization, long soak/load tests and participant usability scoring were not performed.

A real one-minute browser run also passed: presence paused a two-minute timer at 01:00 remaining, the manual partial save recorded 60 seconds, and a recovery retry returned the same record. See `minute-partial-save.json` in the evidence folder.

## All 20 criteria

| Item | Dimension | Result | Evidence and limits |
| --- | --- | --- | --- |
| 1 | Functional Suitability | PASS | Actual timer start, route changes, reload, and a real one-minute presence deadline preserved the session and froze at 120 seconds in a three-minute fixture. |
| 2 | Functional Suitability | PASS | Actual flashcard endpoint returned three cards. The real reflection UI returned sentiment feedback. Settled online browser runs had zero runtime exceptions and zero console errors. |
| 3 | Functional Suitability | PARTIAL | Journal storage, same-ID updates, UTF-8 text, and retrieval passed. The journal is displayed in AI Coach, not as a reflection-log list in Analytics. |
| 4 | Performance Efficiency | PASS | Ten actual client navigations completed in 66–276 ms for route shells. No runtime exceptions in the focused online run. This is a local short sample. |
| 5 | Performance Efficiency | PARTIAL | Analytics loaded with synthetic chart fixtures. JavaScript heap measured 6.32 to 7.55 MiB after ten navigations and garbage collection; this is not total browser memory or a long-term leak test. |
| 6 | Performance Efficiency | PARTIAL | The focused navigation capture recorded 20 API requests and 2043 encoded API bytes. Cached, in-flight and media responses are not a complete bandwidth budget. Audio asset cost remains separate. |
| 7 | Compatibility | PASS | A different foreground Chromium tab did not lose timer progress. The one-minute presence pause still occurred, and audio continued in the focused retest. No broad OS-conflict certification was performed. |
| 8 | Compatibility | PASS | Actual Gemini returned HTTP 200 in 1251 ms. Real flashcard generation and reflection submission also succeeded. |
| 9 | Usability | PARTIAL | Presence runs automatically while the browser remains able to execute it. QStash is not configured, so closed/suspended mobile-app delivery is not verified. |
| 10 | Usability | PARTIAL | All five main routes were reachable through real in-app links. Whether users find navigation clear requires participant observation, not automation alone. |
| 11 | Usability | PASS | All five main routes fit 1440, 390 and 320 CSS-pixel viewports after authentication and data settled. All four Settings categories also fit without horizontal overflow. |
| 12 | Reliability | PARTIAL | Regular online navigation, AI use, reload and timer checks completed without unexpected runtime exceptions in the final runs. Long-duration stability remains unmeasured. Complete offline navigation is outside the intended product scope. |
| 13 | Reliability | PARTIAL | An online-started timer retained a connection restore point, queued its completion during a temporary disconnection, and saved exactly one accepted record after reconnection. Full offline use and every interrupted editing workflow are outside this check. |
| 14 | Reliability | PARTIAL | The same audio element continued across actual in-app navigation and another foreground tab, advancing from about 0.003 to 2.475 seconds. Physical-device suspension and actual OS minimization remain untested; reload may require another play gesture. |
| 15 | Security | PASS | Five private endpoints rejected unauthenticated access (401); wrong password was rejected (401); another account could not read/delete a deck (404); student admin access was denied (403). Session header A256GCM and HttpOnly plus bcrypt storage were verified without recording a token. |
| 16 | Security | PASS | Basic duration integrity passed: fabricated 900-second, forged-timestamp and batch requests returned 422 with zero fabricated rows; incoming private-clock edits were ignored. Real server-timed saves worked, retries created one row, and another account could not claim that timer. This is not proof of attention. |
| 17 | Maintainability | PARTIAL | Shared modules and API routes are separated. The 59-test suite, production build, Prisma validation and scoped lint for the new helpers passed. Full source lint still reports 59 errors and 19 warnings, matching the preexisting baseline. |
| 18 | Maintainability | PASS | Prisma schema validation passed. Real deck/card/session storage and retrieval worked; declared user/deck/card/session relationships and cascades were inspected. Journal data currently lives inside a telemetry JSON field. |
| 19 | Portability | PARTIAL | All five actual pages fit 1440, 390 and 320 CSS-pixel Chromium viewports with no horizontal overflow. Real iPhone/Android, Safari and Firefox testing remains necessary for device-specific claims. |
| 20 | Portability | PASS | A real browser login form and all main routes worked in the local production build without installing a client application. The development/test tools are not requirements for end users. |

## How to demonstrate each criterion

Use a dedicated demonstration account and a clean browser. Keep real student information and login cookie values off the projector.

1. **Functional Suitability:** Start a three-minute timer with a one-minute presence interval. Switch pages, refresh, then show the automatic pause at 02:00.

2. **Functional Suitability:** Generate cards from the supplied biology notes; submit a short reflection; show the outputs and the Console.

3. **Functional Suitability:** Show the reflection in AI Coach, reload, then show its cloud-backed retrieval. Correct the questionnaire location.

4. **Performance Efficiency:** Use the app links between Dashboard, Cards, Coach, Analytics and Settings while the timer runs.

5. **Performance Efficiency:** Show Analytics plus a before/after Memory or browser Task Manager measurement; identify the measurement as a short sample.

6. **Performance Efficiency:** In Network, separate Fetch/XHR from Media, compare transferred sizes, and disclose the media cost.

7. **Compatibility:** Open another tab for one minute, then return to the paused focus session.

8. **Compatibility:** Show actual AI generation and a successful API response. Distinguish successful Gemini use from the app’s heuristic fallback.

9. **Usability:** Leave the active browser session alone until presence pauses automatically. Do not promise locked-phone delivery.

10. **Usability:** Ask a classmate to open Cards, start Timer, find Coach, then open Analytics without coaching them.

11. **Usability:** Open Settings at desktop width and 320 px. Switch all four categories and show that no horizontal scroll is needed.

12. **Reliability:** Run a short normal-use sequence, then separately disclose the offline navigation issue and remaining soak test.

13. **Reliability:** Start a one-minute timer while online. After Start reaches the server, temporarily disconnect near completion. Reconnect and show one saved record. Describe this as connection recovery, not offline mode.

14. **Reliability:** Start audio with a user click, navigate using app links, switch tabs, and return. Do not equate this with all phone lock-screen behavior.

15. **Security:** Show failed login, two isolated test accounts, and redacted session/encryption configuration. Do not display actual cookie values.

16. **Security:** Start and save a genuine timer. Show one resulting record, then show that a fabricated 900-second request is rejected and a repeated valid save does not create a duplicate.

17. **Maintainability:** Show the module structure and build, and retain the code-quality finding for technical review.

18. **Maintainability:** Show User → Deck → Card and User/Deck → StudySession relationships, using only dummy records.

19. **Portability:** Demonstrate the desktop and phone-sized layouts. Repeat the key flow on an actual Android and iPhone before claiming physical-device compatibility.

20. **Portability:** Open the deployed HTTPS URL in a normal browser and sign in. Explain that Home Screen installation is optional for basic web access.

## Simple presentation sequence

1. Sign in and show the Dashboard, tasks and daily progress.
2. Generate three flashcards from a short biology note, save the deck, review it and try a practice question.
3. Submit a reflection, show the short cognitive summary, and apply the suggested timer strategy. Show the saved journal in AI Coach after reload.
4. Start a three-minute custom timer with a one-minute presence interval. Navigate, refresh and switch to another browser tab. Return and show the automatic pause at 02:00. Continue once.
5. Play an ambient track using a click, navigate through the app links and switch tabs. Explain browser limits for reload and phone suspension.
6. Show recorded activity in Analytics and explain that h/m and rounded decimal hours use different formatting.
7. Open Settings at desktop and 320 px widths. Show that presence/burnout controls are locked during an ongoing session. Reset the timer before changing intervals.
8. Demonstrate connection recovery with an online-started one-minute session. Disconnect only after Start reaches the server, reconnect and show one accepted record. No complete offline mode is claimed.
9. Show a rejected invented-duration request using a dummy account. Show only the response status/message, not a real token.
10. Let classmates independently find Vault, Coach, Timer and Analytics, then collect actual usability responses. Repeat the main flow on real phones.

## Suggested questionnaire wording corrections

- Item 3: “Student reflection logs are reliably stored, updated, and retrieved in the AI Coach journal without missing or duplicated entries.”
- Item 13: “The system retains an existing timer restore point during a temporary connection interruption and retries eligible synchronization after reconnection.”
- Item 14: “The active timer and user-started audio continue during supported browser-tab switching and in-app navigation.” Evaluate physical-phone suspension separately.
- Item 16: “The server validates newly recorded focus time against a tracked timer and prevents duplicate saves for the same session.” Avoid claiming proof that the student paid attention.

## Reading the raw evidence

The final verdicts use final-retest.json together with retest-evidence.json, retest-followup.json and repair-verification.json. The broad audio-widget timeout was a test-navigation mistake and is superseded by the successful focused audio run. Connection recovery passed in the final broad run and in the final ten-second repair fixture. Earlier exploratory files are historical and must not replace these final verdicts.
