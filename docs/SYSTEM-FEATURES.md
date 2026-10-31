# iFocus System Features

Reference for capstone paper preparation

Prepared 31 October 2026. This document describes the implemented application and the current repair build. It is a feature reference for the project team, not a completed thesis, an ISO certification, or evidence of improved academic performance. The team should use the descriptions to prepare the system overview, requirements, methodology, scope, and limitations, then add its own research citations and evaluation results.

## System purpose and users

iFocus is a browser-based study application that combines AI-assisted flashcards, a Pomodoro timer, active recall during breaks, reflection-based study recommendations, and study analytics. Students can prepare study materials, organize tasks, run focus sessions, and review their recorded activity in one application. The project is hosted on Vercel and uses a PostgreSQL database through Prisma. Installing the Progressive Web App is optional for ordinary browser access.

The student role manages personal study materials and activity. The administrator role manages student accounts, verification details, and aggregate system information. A student cannot access administrator endpoints merely by opening an administrator URL. Private records are associated with the authenticated owner.

| Main area | Main student activity |
| --- | --- |
| Dashboard | Organize tasks and control the focus timer |
| Flashcards or Vault | Generate, save, review, and practice flashcards |
| AI Coach | Submit reflections and review study recommendations |
| Analytics | Review focus history, activity charts, and mastery indicators |
| Settings | Manage preferences, profile, security, and notifications |

The system supports study planning and self-management. Its cognitive and fatigue indicators are software-generated interpretations of limited input and activity signals. They are not medical diagnoses or validated measurements of a student's attention, mental health, or learning ability.

<!-- pagebreak -->

## Accounts and dashboard

### Registration and authentication

Students can register an account and sign in using supported credentials. Registration collects identity and academic information such as name, email, username, and year level. Passwords are stored as bcrypt hashes. Login creates an authenticated session that private API routes check before returning or changing data. A password change requires the existing password.

The implementation also includes a Google OAuth integration, which requires provider credentials and deployment configuration. Its availability should be confirmed in the deployed environment before describing it as a tested login method.

The active-session guard supports one current login session per account. A newer login can invalidate an older login. Cross-device recovery should therefore be described as recovering a previous session after signing in elsewhere, rather than promising unrestricted simultaneous use of the same account on multiple devices.

### Dashboard and task organization

The Dashboard presents the focus timer, daily study progress, recorded session totals, study streak, task completion, and access to study tools. Students can create tasks, assign priorities, mark tasks as completed, and filter the task list. Priority and task order help students decide what to study next. Coach recommendations can influence the suggested task order.

An in-app Feature Guide and contextual help controls explain the main workflows, including the focus timer, soundscapes, and BreakGate. These instructions support navigation but do not replace a participant usability evaluation.

Daily focus totals use recorded session durations. The application displays hours and minutes for daily totals, so 67 minutes appears as 1h 7m. A decimal-hours display of 1.1h represents approximately 66 minutes after rounding; that format alone does not indicate a data retrieval error.

### Typical student workflow

1. Sign in and review the Dashboard.
2. Add study tasks and prepare or select a flashcard deck.
3. Optionally submit a reflection for a study recommendation.
4. Start a focus session and respond to presence checks when prompted.
5. Complete a break or BreakGate activity, then review the saved activity in Analytics.

<!-- pagebreak -->

## Flashcard preparation and practice

### AI assisted deck generation

Students can provide pasted study notes or upload a PDF to generate flashcards. The application sends the supported content to a server-side generation route that communicates with Gemini. Generated cards contain a question or front, an answer or back, and supporting fields such as a keyword and category tag. Categories include definition, enumeration, concept, formula, date, and fact.

The interface supports selecting the card quantity. Generated output should still be reviewed by the student because AI may omit details or produce inaccurate wording. A successful generation response does not independently establish that every card is academically correct. Text generation includes a heuristic fallback for some unavailable-AI cases; fallback output should not be presented as proof of successful Gemini connectivity.

PDF input is supported by the implemented generation path. General image OCR, support for every document format, and reliable processing of every scanned PDF are outside the verified scope.

### Deck storage and ownership

Students can name and save generated decks, view their collections, open a saved deck, and delete their own decks. Decks contain related card records in the database. The application checks ownership when accessing private deck resources, so another student cannot retrieve or delete a deck through an unauthorized request.

### Review and exam activities

The review interface supports flipping a card to reveal its answer, moving between cards, shuffling the review order, and marking cards as mastered. Students can mark an entire deck as mastered or change mastery selections. Mastery indicators summarize these application states and do not establish long-term retention by themselves.

The application also provides a multiple-choice practice mode using a selected deck. Students answer questions, receive feedback, move to the next item, and view a practice score. BreakGate reuses flashcard material for retrieval practice during the timer workflow.

<!-- pagebreak -->

## Focus timer and presence checks

### Pomodoro controls

Students can use the 25/5, 50/10, 15/3, and 90/20 focus-and-break presets or configure a custom duration and cycle count. The timer supports starting, pausing, continuing, resetting, and ending a session. Students can save an eligible partial session when ending early. A short unfinished checkpoint with less than one minute of progress is not offered as an unfinished session for recovery.

The global timer remains available across application routes. A saved deadline and local checkpoint preserve the timer state during a page reload. When an interrupted session is offered on a later login or device, the student can save eligible time or discard it. The resolution is synchronized so a previously discarded checkpoint is not repeatedly offered by another device after cloud synchronization.

### Active Presence and other reminders

Active Presence pauses the focus timer at the configured interval and asks the student to pause or continue. The paused reading remains available while the student decides. This is a periodic confirmation mechanism; it does not continuously verify that the student is studying.

The burnout check can prompt the student after its configured period when task progress has not been recorded. The AFK inactivity timeout provides a separate inactivity prompt when applicable. Settings list these controls in the order Active Presence, burnout check, and AFK timeout. Presence and burnout intervals are locked in the interface while a timer session is ongoing, including a paused ongoing session.

### BreakGate and saved time

An active flashcard deck can provide a short multiple-choice challenge before the break proceeds. Completed and skipped challenges contribute to the application's pacing telemetry. The interface also permits proceeding without BreakGate; it should not be described as an unavoidable assessment.

New focus records use elapsed time observed by the server after an online Start checkpoint. Requests cannot create an arbitrary 15-minute record without a tracked timer, and repeated saves use one record per timer. Server checks cap elapsed time at the planned duration and applicable presence boundary. This is basic protection for recorded durations, not proof of attention or a proctoring system.

<!-- pagebreak -->

## Reflections and AI Coach

### Reflection input and study feedback

Students can submit a short journal reflection describing their current study experience. The application uses the reflection and available activity signals to request study feedback from Gemini. Supported coaching states include Stressed, Distracted, Motivated, and Engaged. Typing timing, corrections, inactivity, and keyword rules may contribute to local telemetry or fallback interpretation.

The coach can recommend a focus duration, rest duration, target cycle count, task priority, and a written action plan. For example, a stressed state can produce shorter focus periods and a gentler task plan. Students can apply the suggested strategy to the Dashboard rather than manually re-entering the suggested timer configuration.

These recommendations are study aids. The application does not claim a clinically validated sentiment detector, psychological diagnosis, or guaranteed improvement in productivity. Students should review AI advice before following it.

### Coach interface

The AI adaptation dialog presents the proposed focus cadence, target sessions, task priority, and guidance. Its desktop layout provides more reading space while retaining a responsive layout on smaller screens. The cognitive-state card uses a concise summary rather than placing the entire AI reply inside a small card. Longer action plans remain in their dedicated content area.

The AI Coach page also presents study resilience or pacing indicators, a recommended rhythm, intervention messages, and a guided focus-reset protocol. A recovery flow can recommend a restorative break. These indicators come from the application's recorded events and rules, rather than an independent physiological measurement.

### Journal storage and retrieval

Reflection entries and related feedback are synchronized through the user's telemetry data. Entries can be merged and updated by identity so repeated synchronization does not create a duplicate journal item. The journal is displayed in AI Coach. Analytics displays study metrics; it does not currently provide a separate reflection-log list.

For the paper and questionnaire, describe this as storing and retrieving reflection logs in AI Coach. Avoid saying that a reflection journal is displayed in the Analytics Dashboard unless that screen is changed later.

<!-- pagebreak -->

## Analytics and background audio

### Study analytics

The Analytics page presents today's recorded focus time, weekly study totals, study streak, mastered concept counts, and recent saved focus sessions. Weekly focus activity is displayed in a chart with alternative time-scale controls. Dashboard and Analytics use explicit duration units to avoid treating seconds as minutes when retrieving saved sessions.

The page also displays BreakGate compliance, focus-to-rest information, and fatigue or recovery indicators derived from application telemetry. These summaries describe recorded use. They do not independently demonstrate learning gains, accurate emotion recognition, or continuous attention.

Daily totals use hours and minutes, while some aggregate chart labels may use rounded decimal hours. The team should explain the unit and rounding rule whenever comparing screenshots. A rounded weekly label and an exact daily label need not have identical text.

Pending study time that has not been accepted by the server is excluded from verified focus totals. A queued connection-recovery record becomes part of verified totals after the server accepts it. Existing saved history remains available; the new validation does not retroactively prove the accuracy of records created before these checks.

### Ambient soundscapes

Students can select background audio, control playback, and adjust volume. Available soundscapes include lo-fi or study music, rain, ocean ambience, binaural alpha, campfire, pink noise, and a cosmic drone. The global audio element allows playback to continue during ordinary in-app navigation.

Browser permission and autoplay rules affect audio behavior. Tab switching and client-side navigation can preserve playback, while a full reload or mobile operating-system suspension may require another user interaction. Do not promise uninterrupted audio after closing the application or locking every type of phone.

### Interpretation of recorded sessions

A saved focus record represents accepted timer time. A practice score, a self-marked mastery state, and a completed task are separate measures with different meanings. They should not be combined into a claim that the system has objectively measured academic achievement.

<!-- pagebreak -->

## Settings and PWA access

### Preferences and account controls

Settings organize Focus Preferences, Notifications, Privacy and Security, and Feedback and Support. Students can configure supported timer reminders, presence and inactivity preferences, ambient volume, completion chimes, and reflection preferences. Profile controls include supported username and avatar changes. Restricted official academic identity fields are handled through administrative controls.

Privacy and security controls include changing a password, exporting supported study data as JSON, and clearing the local session cache. The export contains profile information, decks and cards, study sessions, and tasks. It should not be described as an export of every internal telemetry field. Clearing the local cache is distinct from deleting cloud records.

The feedback form currently displays a simulated submission confirmation without a connected support-delivery backend. It is a user-interface placeholder, not a verified email or support-ticket service. The team should not list backend feedback delivery as a completed feature.

### Browser notifications

The notification settings show the current permission state and provide a permission-request control and a Test Notification button. If a user previously blocked permission, browser or device settings may require manual changes before another request can succeed. The application cannot force a blocked browser to display its permission prompt again.

Where supported, presence alerts include Pause and Continue actions. On iPhone, opening an alert may be required to reach the application controls. A notification can show a snapshot of the remaining time; the live countdown is displayed inside the open application. Lock-screen notification text is not a continuously updating countdown.

### PWA and connection recovery

The manifest and service worker support optional installation or adding the site to a phone's Home Screen, subject to browser support. The ordinary web application runs without a separate native installer. Responsive layouts adapt the main screens for desktop and mobile-sized viewports.

The project does not provide a complete offline mode. An existing online-started timer can retain a local restore point during a temporary interruption and retry eligible saves after reconnection. New server-verified time requires a server-observed Start. Scheduled push delivery while a phone is suspended depends on optional server scheduling; QStash is not configured in the current project setup.

<!-- pagebreak -->

## Administration and technical architecture

### Administrator functions

The administrator overview summarizes users, decks, cards, study sessions, and recorded focus totals. Student management supports searching or filtering accounts and reviewing available academic and study information. Authorized administrators can change account status, record a reason, update verification details and permitted identity fields, and reset a student password through the administrative flow.

Supported account states include active, on hold, and banned. Verification metadata includes pending, verified, and rejected. These are application-managed records; they do not imply integration with an external registrar or automated verification service. Additional restrictions protect privileged accounts from ordinary student-management changes.

### Application stack

| Layer | Implemented technology |
| --- | --- |
| Web application | Next.js 16 App Router and React 19 |
| Interface | CSS and Tailwind CSS tooling |
| Authentication | NextAuth with credential and optional OAuth support |
| Database access | Prisma ORM 6 with PostgreSQL |
| AI service | Server-side Gemini API integration |
| Charts | Chart.js with React integration |
| Hosting and source | Vercel deployment and GitHub repository |

The browser displays the interface and retains local timer checkpoints and selected caches. Next.js API routes authenticate requests, enforce resource ownership, communicate with Gemini, and save database records. API keys and database credentials belong in deployment environment variables and must not be included in the paper, screenshots, or source examples.

The main data relationships are User to Deck, Deck to Card, User to Todo, and User or Deck to StudySession. User telemetry stores journal entries, mastery information, recovery decisions, and other event summaries in a JSON-formatted field. Timer preferences are stored separately. Optional push-subscription and scheduled-job models support the conditional push integration.

<!-- pagebreak -->

## Security and paper scope

### Security mechanisms and their meaning

Authentication sessions use encrypted JWT cookies through NextAuth. Inspection of the tested session header identified A256GCM, meaning AES with a 256-bit key in Galois Counter Mode. HttpOnly prevents normal page JavaScript from reading that cookie. Production HTTPS and its cookie configuration should be checked on the deployed domain when presenting transport security.

Passwords use bcrypt hashing, which is a one-way password-verification mechanism. Hashing is different from reversible AES encryption. The browser cookie name or a random-looking value alone is not sufficient evidence of an encryption algorithm. Show redacted configuration or the encryption header rather than publishing a real session cookie.

Private API routes require authentication and check ownership for private resources. New focus records are validated against server-observed elapsed time and use stable record identities to prevent duplicate saves. These checks do not prove continuous attention or protect every client-generated telemetry value from a determined account owner.

Flashcards, reflections, and local storage should not be described as end-to-end encrypted or individually AES-encrypted by the application. The session cookie's encryption does not imply that all database fields have the same encryption. Database-provider encryption requires separate evidence from the hosting provider.

### Boundaries for the capstone paper

The implemented scope is a web-based study assistant with optional PWA access, AI-assisted learning materials, timer management, reflection-based suggestions, and recorded study analytics. Describe temporary connection handling as connection recovery or a restore point. Do not present the project as a native mobile app, complete offline application, clinical tool, or enterprise anti-cheat platform.

The 20 evaluation statements are project criteria grouped under the supplied quality dimensions. A passing automated check does not constitute ISO certification. Usability, long-term stability, physical-device compatibility, and learning outcomes require suitable participant or device evaluation. Keep measured test results separate from intended benefits.

For paper preparation, use the feature descriptions for functional requirements and system workflows; use the stack and data relationships for architecture and database sections; and use the explicit boundaries for scope and limitations. Add the team's own screenshots, research references, evaluation participants, and actual collected results. Never invent respondents, scores, deployment guarantees, or academic conclusions.
