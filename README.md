# GSC Malaysia Playwright UI Automation (Demo)

A small, self-contained Playwright + TypeScript UI automation project for the
official Golden Screen Cinemas Malaysia website (https://www.gsc.com.my/).

This is a demonstration project, not a purchasing tool: **no test ever
completes a purchase**. Every booking-flow test stops at the review/checkout
screen, before the "Checkout & Pay" button is clicked.

**Working on this repo with an AI assistant?** Read [`CLAUDE.md`](./CLAUDE.md)
first (hard rules — no real purchases, no hardcoded credentials, no
unverified selectors presented as confirmed) and
[`AI_GUIDELINES.md`](./AI_GUIDELINES.md) for architecture notes and
conventions.

## Prerequisites

- Node.js 18 or newer (Node 20+ recommended)
- npm
- Playwright browsers (installed via the command below)

## Installation

```bash
npm install
npx playwright install
```

## TypeScript validation

```bash
npx tsc --noEmit
```

This should complete with no errors, no source changes required.

## Run all tests, visibly (headed)

```bash
npx playwright test --headed
```

`--headed` opens a real, visible Chromium window so you can watch the
automation click through the GSC site as it runs. Omit `--headed`
(`npx playwright test`) to run the exact same tests headlessly (e.g. in CI).

## Run each test independently

Every spec file is fully independent — each one starts its own fresh browser
session from the GSC homepage, so any of them can be run alone, in any order,
without editing any source file:

```bash
npx playwright test tests/login.spec.ts --headed
npx playwright test tests/browse-and-select.spec.ts --headed
npx playwright test tests/select-showtime.spec.ts --headed
npx playwright test tests/continue-booking.spec.ts --headed
npx playwright test tests/negative-validation.spec.ts --headed
```

Equivalent npm scripts are provided:

```bash
npm run test:login
npm run test:browse
npm run test:showtime
npm run test:booking
npm run test:negative
npm run test:headed   # all tests, headed
npm run test          # all tests, headless
```

## View the HTML report

```bash
npx playwright show-report
```

This opens the standard Playwright HTML report for the most recent run,
containing test names, pass/fail status, duration, and — per this project's
configuration — screenshots and video for every test (not just failures),
plus trace files retained on failure/retry for deep debugging.

Screenshots are also written directly to
`test-results/screenshots/*.png` at each checkpoint the tests describe below,
independent of the report.

## Test coverage

### `login.spec.ts` — Log in to a GSC account
Standalone login coverage. GSC has no independent login URL to load directly —
the login gate only appears once an anonymous visitor tries to select a
showtime — so this test drives movie → date → showtime selection just far
enough to reach that gate, then focuses on the login behaviour itself: without
a QA/demo account configured it verifies, with a real assertion, that GSC
correctly requires authentication and stops there; with
`GSC_TEST_MOBILE_NUMBER` / `GSC_TEST_PASSWORD` configured, it logs in and
verifies the session actually reaches the seat map. Every other spec in this
project performs its own login inline as part of its own flow — this file
exists to test login on its own, independent of any particular booking
journey.

### 1. `browse-and-select.spec.ts` — Browse and select an available movie/cinema
Loads the GSC homepage, verifies it rendered, then **discovers** a movie that
currently has a working "Buy Now" link (rather than hard-coding a title that
could disappear from the site), selects it, and verifies the resulting
showtime-selection screen shows the movie title, at least one cinema, and an
enabled showtime — confirming the next booking step is reachable.

### 2. `select-showtime.spec.ts` — Select available date and showtime
Independently repeats movie selection, then inspects the real "Select Date"
row and picks the first **enabled** date (never assumes today is bookable),
then inspects the cinema/showtime list and picks the first **enabled**
showtime (never hard-codes a time like "7:30 PM"). Verifies the selection is
reflected in the booking journey and that the flow can continue.

### 3. `continue-booking.spec.ts` — Continue booking and verify booking information
Drives the full journey — movie → cinema → date → showtime → seat selection →
booking summary → review/checkout stage — stopping before payment. See
**Important live-site behaviour** below: this test adapts automatically to
whether a GSC test account is configured.

### 4. `negative-validation.spec.ts` — Unavailable showtime cannot be selected
A genuine negative/validation scenario using real site data: GSC's "Coming
Soon" movies are not yet open for booking. The test confirms such a movie is
rendered with only a "More Info" link (never a "Buy Now" link) both on the
listing tile and on the movie's own detail page — i.e. a real user cannot
select a showtime for it. Nothing is mocked or artificially forced.

## Important live-site behaviour

GSC is a live, constantly changing cinema booking site — movie titles,
cinemas, dates, showtimes and seat maps can and do change at any time. Every
test discovers currently-available options at run time via reusable helper
methods in `pages/*.ts` (`findAvailableMovie`, `findAvailableDate`,
`findAvailableShowtime`, `findAvailableSeat`, and their `selectAvailable*`
counterparts) instead of depending on fixed values.

**Seat selection requires a signed-in GSC account.** While building this
project we confirmed that clicking a showtime while *not* logged in redirects
an anonymous visitor to a "Log In" screen — the live booking app will not show
the seat map to a guest. This is real, current GSC behaviour, not a bug in
this automation.

`continue-booking.spec.ts` handles this correctly rather than papering over
it:

- **Without credentials** (the default — nothing to configure), the test
  verifies, with a real assertion, that GSC correctly requires authentication
  before seat selection, logs a clear explanation, and stops there. The test
  **passes** — it has validated genuine site behaviour, not skipped anything
  silently.
- **With credentials**, set the following environment variables to a GSC
  account you control (a personal or QA/demo account — never commit real
  credentials to source control), and the test will log in and continue all
  the way through seat selection, the booking summary, and the review/
  checkout screen:

  ```bash
  # macOS/Linux
  export GSC_TEST_MOBILE_NUMBER="6011XXXXXXXX"
  export GSC_TEST_PASSWORD="your-account-password"
  npx playwright test tests/continue-booking.spec.ts --headed

  # Windows PowerShell
  $env:GSC_TEST_MOBILE_NUMBER = "6011XXXXXXXX"
  $env:GSC_TEST_PASSWORD = "your-account-password"
  npx playwright test tests/continue-booking.spec.ts --headed
  ```

  Credentials are read only from environment variables at run time — they are
  never written into source files, logs, screenshots are of the booking
  summary only, and the password value is never printed.

If the specific showtime selected turns out to have no available seats (sold
out) once the seat map loads, the test automatically falls back to another
available showtime rather than failing outright.

**No purchase is ever made.** `verifyReachedCheckoutStage()` in
`pages/GscBookingPage.ts` asserts the "Checkout & Pay" button is visible and
enabled — and deliberately never clicks it.

## Project structure

```text
gsc-playwright/
├── package.json
├── playwright.config.ts
├── tsconfig.json
├── README.md
├── pages/
│   ├── GscHomePage.ts        # homepage: movie discovery/selection
│   ├── GscShowtimesPage.ts   # date + cinema/showtime selection
│   └── GscBookingPage.ts     # login gate, seats, upsells, review/checkout
├── tests/
│   ├── login.spec.ts
│   ├── browse-and-select.spec.ts
│   ├── select-showtime.spec.ts
│   ├── continue-booking.spec.ts
│   └── negative-validation.spec.ts
└── test-data/
    └── bookingData.ts        # URLs, regexes, optional credential plumbing
```

## Selector strategy

Selectors were determined by directly inspecting the live GSC site (both
`www.gsc.com.my` and the separate booking app at
`epaymentwebapp.gsc.com.my`) rather than guessed. In order of preference:

1. `getByRole()` with the site's own accessible names/roles (links, buttons,
   headings, regions, tabs, textboxes) — used almost everywhere.
2. Text patterns matched against GSC's own rendered text (e.g. a showtime
   regex like `/^\d{1,2}:\d{2}\s?(AM|PM)$/`, a seat-code regex like
   `/^[A-Z]{1,2}\d{1,2}$/`) — used where GSC's controls are plain elements
   with no ARIA role of their own (the seat grid, the cinema/time buttons).
3. No CSS class selectors and no XPath are used anywhere in this project —
   GSC's class names are generated/unstable, and every element needed had a
   reliable role or text-based alternative.

All waiting is state-based (`expect(locator).toBeVisible()`,
`toBeEnabled()`, `waitForURL()`, `Locator.waitFor()`,
`Promise.race([...])` between two possible next screens) — there are no
`page.waitForTimeout()` fixed sleeps anywhere in this project.

## Cross-domain booking flow

GSC's "Buy Now" buttons on the marketing site (`www.gsc.com.my`) link to a
separate booking application on `epaymentwebapp.gsc.com.my`. This can open in
the same tab or a new tab depending on context, so
`GscHomePage.selectAvailableMovie()` races `context.waitForEvent('page')`
against the click and transparently returns whichever `Page` object ends up
showing the booking app.

## UI Automation Dashboard

Alongside the four Playwright specs, this repo includes a small local
dashboard for triggering them by clicking a button instead of the command
line: a Node/Express backend that spawns the real Playwright CLI, and a
React/Vite frontend that shows live status.

### Architecture

```text
Dashboard (React) --poll GET /api/tests--> Node/Express API --spawn--> npx playwright test <spec> --headed
     ^                                            |
     |                                            v
     +----------- artifacts (report/screenshots/video) served from disk
```

- **The React UI never runs Playwright itself.** Every "Run Test" click is an
  HTTP `POST` to the backend; the backend is the only thing that spawns a
  process.
- **Tests always run headed, in real Chromium**, against the live GSC site —
  the same specs described above, unchanged. There is no headless mode in the
  dashboard; you will see the browser window open and drive itself.
- **The frontend never sends a file path or shell command.** Each "Run Test"
  request carries only a fixed test id (`browse-and-select`,
  `select-showtime`, `continue-booking`, `negative-validation`); the backend
  resolves that id to a spec file **only** via the hardcoded table in
  `server/testDefinitions.ts`. There is no code path from an HTTP request to
  an arbitrary command — the backend spawns `npx playwright test <fixed path>
  --headed` with a fixed argv array, never a shell string built from request
  input.
- **No database, no persistence.** Test status lives in an in-memory `Map` in
  the backend process; restarting the backend resets every test to
  `NOT_RUN`.
- **No secrets reach the dashboard.** `GSC_TEST_MOBILE_NUMBER` /
  `GSC_TEST_PASSWORD` are read by the Playwright process itself (via
  `.env` → `test-data/bookingData.ts`, exactly as described above); the
  Express API never reads, forwards, or exposes them to the frontend.
- **No purchase is ever triggered** — the dashboard runs the exact same specs
  that already stop before "Checkout & Pay".
- **Only one test runs at a time.** Starting a test while another is
  `RUNNING` (individually or via "Run All Tests") is rejected with HTTP 409 —
  this keeps a single visible Chromium window and a single GSC session
  un-contended.

### Install and run

```bash
npm run install:all   # installs both the root project and dashboard/
npm run dev            # starts the backend (:3000) and dashboard (:5173) together
```

Then open http://localhost:5173. The dashboard's dev server proxies
`/api/*` and `/artifacts/*` to the backend on port 3000 (see
`dashboard/vite.config.ts`), so no separate configuration is needed.

To run the two halves separately:

```bash
npm run server:dev     # backend only, auto-restarts on change (tsx watch)
npm run dashboard      # frontend only
```

### Using the dashboard

- The pipeline strip at the top shows every test as a connected node,
  colored gray (not run) / blue (running) / green (passed) / red (failed) —
  click a node to highlight and scroll to it further down the page.
- Each test also has its own card with a **Run Test** button.
- **Run All Tests** runs every test back-to-back (never in parallel) and the
  pipeline updates automatically as each one finishes.
- Below the cards, **All Results** lists every test's full result together
  — status, start/end timestamps, duration, fixed `Browser: Chromium` /
  `Mode: Headed`, a link to that run's Playwright HTML report, inline
  screenshot and video previews, a collapsible raw log tail, and — on
  failure — the captured error text. All of this is always visible for
  every test at once; clicking a pipeline node or card only scrolls to and
  highlights that test's entry, it never hides the others.
- Live updates are polling-based (every 1.5s via `GET /api/tests`); there is
  no WebSocket connection.
- Each run gets its own isolated output/report folder on disk
  (`test-results/runs/<id>/`, `playwright-report/runs/<id>/`), so running a
  second test never deletes or overwrites an earlier test's screenshots,
  video, or report — every entry in **All Results** keeps working links for
  the rest of the session.

### API endpoints

| Method | Path                          | Purpose                                              |
| ------ | ----------------------------- | ----------------------------------------------------- |
| GET    | `/api/tests`                  | All tests with their latest known status              |
| POST   | `/api/tests/:testId/run`      | Start one test (404 unknown id, 409 already running)  |
| POST   | `/api/tests/run-all`          | Start all tests sequentially                          |
| GET    | `/api/tests/:testId/status`   | Current status of one test                            |
| GET    | `/api/tests/:testId/result`   | Same record as `/status` (kept as a distinct route for clarity) |

Static artifacts are served at `/artifacts/test-results/...` and
`/artifacts/playwright-report/...`, matching the `reportPath` /
`screenshotPaths` / `videoPaths` values returned in each test's record.

### Project structure (dashboard additions)

```text
gsc-playwright/
├── server/
│   ├── index.ts            # Express app + routes
│   ├── testRunner.ts        # spawns Playwright, tracks in-memory execution state
│   ├── testDefinitions.ts   # the ONLY id → spec file mapping
│   └── types.ts
└── dashboard/
    ├── index.html
    ├── vite.config.ts        # dev-server proxy for /api and /artifacts
    ├── tsconfig.json
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── App.css
        ├── components/
        │   ├── Pipeline.tsx
        │   ├── StatusBadge.tsx
        │   ├── TestCaseCard.tsx
        │   ├── TestDetails.tsx
        │   └── ResultsLog.tsx   # combined list of every test's result
        ├── services/api.ts
        └── types/test.ts
```

### Limitation carried over from the specs themselves

Because GSC is a live site, "Run Test" can occasionally fail for reasons
unrelated to the dashboard — a movie, date, or showtime that was available a
moment ago may no longer be by the time a run starts. This is the same
dynamic-availability behavior described above for the specs directly; the
dashboard surfaces it as a normal `FAILED` status with the real Playwright
error in the detail panel, rather than hiding it.
