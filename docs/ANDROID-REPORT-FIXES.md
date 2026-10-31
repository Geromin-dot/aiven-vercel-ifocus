# Android report fixes and current screenshots

31 October 2026

The tutorial now uses a native dialog with a responsive header, scrollable topic list on phones, independently scrolling content, and reachable Previous and Next controls. All 12 steps have current desktop and mobile screenshots. The landing page also uses four new captures from the real application with an isolated demo account.

| Concern | Change |
| --- | --- |
| Tutorial categories and footer overflow on phones | Responsive dialog, horizontal topic navigation, visible footer, image enlargement, keyboard dismissal and focus handling |
| Avatar Cancel and Apply are unreachable | Dialog rendered above navigation, bounded visible height, scrolling body, fixed action area, reachable close button and Escape dismissal |
| Landing links open anonymous application screens | Server redirect to login for Dashboard, Flashcards, Coach, Analytics, Settings and Admin; private APIs keep their existing authentication checks |
| Install banner remains in installed mode or cannot be reopened | Installation lifecycle and display-mode listeners; Settings installation-help control can reopen dismissed guidance; native installation still depends on the browser |
| Hello or Ty creates a long assessment | Shared input validation on client and server asks for context; recognizable short moods such as tired or pagod remain accepted; AI can also request context rather than invent a state |
| Sign Out is too prominent in the mobile header | Compact labeled icon button; full Sign Out remains in Settings |
| Task Add extends outside its card | Phone input occupies its own row, with effort and Add controls underneath |
| Apply Strategy and Dismiss have mismatched sizes | Equal action sizing with full-width stacked buttons on phones |
| Skip to Break wraps vertically | Separate, nonshrinking button and wrapping deck heading |
| Screenshots and descriptions are outdated | 24 current tutorial images, four current landing previews, corrected control names and guide text |

Validation: 59 timer/history regression tests and two reflection-input tests passed. Browser checks covered all 12 guide steps at 320, 390, 844 landscape and 1440 pixels, image loading, zoom and Escape, task creation, compact Sign Out, rejected low-context API input, avatar controls at short phone and landscape sizes, and simulated installation lifecycle events. Six unauthenticated app routes redirected to login in the capture run.

Captures use actual application components and synthetic demonstration data, never real student information. Temporary test accounts were removed. The database had one transient connection failure during setup; later capture and browser runs connected successfully. Early capture failures from page compilation or a prior demo recovery dialog were superseded by the completed focused runs.

The browser was Chromium. Phone-sized and simulated standalone checks are not physical Android or iPhone Safari testing. The operating system controls the native install prompt; Settings can reopen guidance but cannot force a browser to present a suppressed native prompt. Retest installation and the tutorial on the students' actual phones after deployment.
