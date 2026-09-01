# GSC Malaysia Playwright UI Automation (Demo)

A small, self-contained Playwright + TypeScript UI automation project for the
official Golden Screen Cinemas Malaysia website (https://www.gsc.com.my/),
plus a local dashboard for running the tests by clicking a button instead of
the command line.

This is a demonstration project, not a purchasing tool: **no test ever
completes a purchase**. Every booking-flow test stops at the review/checkout
screen, before the "Checkout & Pay" button is clicked.

**Working on this repo with an AI assistant?** Read [`CLAUDE.md`](./CLAUDE.md)
first (hard rules — no real purchases, no hardcoded credentials, no
unverified selectors presented as confirmed) and
[`AI_GUIDELINES.md`](./AI_GUIDELINES.md) for architecture notes and
conventions.

## Contents

- [Quick start](#quick-start)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuring GSC test credentials (optional)](#configuring-gsc-test-credentials-optional)
- [Running the test suite from the command line](#running-the-test-suite-from-the-command-line)
- [Viewing test results](#viewing-test-results)
- [Test coverage](#test-coverage)
- [Important live-site behaviour](#important-live-site-behaviour)
- [The UI Automation Dashboard](#the-ui-automation-dashboard)
  - [Dashboard setup, step by step](#dashboard-setup-step-by-step)
  - [Using the dashboard](#using-the-dashboard)
  - [Dashboard architecture](#dashboard-architecture)
  - [API endpoints](#api-endpoints)
- [Project structure](#project-structure)
- [Selector strategy](#selector-strategy)
- [Troubleshooting](#troubleshooting)

## Quick start

For someone setting this up for the first time and just wants it running:

```bash
# 1. Install dependencies (test suite + dashboard) and Playwright's browsers
npm run install:all
npx playwright install chromium

# 2a. Run the whole test suite from the command line, headed (visible browser)
npx playwright test --headed

# 2b. ...or start the dashboard instead, and run tests by clicking a button
npm run dev
# then open http://localhost:5173 in your browser
```

That's it for a first run. The sections below go into each step, plus GSC
account credentials (optional), what each test does, and how to troubleshoot
common problems.

## Prerequisites

- Node.js 18 or newer (Node 20+ recommended) — check with `node -v`
- npm (comes with Node.js) — check with `npm -v`
- A GSC account is **not** required. Booking-flow tests work without one (see
  [Configuring GSC test credentials](#configuring-gsc-test-credentials-optional));
  they just stop earlier, at GSC's own login gate, instead of continuing to
  seat selection.

## Installation

Install the test suite's dependencies, the dashboard's dependencies, and
Playwright's browser binaries:

```bash
npm install                    # root project: Playwright, TypeScript, the dashboard backend
npm install --prefix dashboard # dashboard frontend (React/Vite)
npx playwright install chromium
```

Or, equivalently, in one step:

```bash
npm run install:all
npx playwright install chromium
```

`npx playwright install chromium` only needs to be run once per machine (or
again after a Playwright version bump) — it downloads the actual browser
binary Playwright drives, which is separate from the `@playwright/test` npm
package.

Confirm everything is wired up correctly:

```bash
npx tsc --noEmit
```

This should complete with no output and no errors, with no source changes
required.

## Configuring GSC test credentials (optional)

GSC requires a signed-in account before it will show the seat map. Tests are
written to handle both cases, so this step is **optional**:

- **Without credentials** (nothing to configure — the default), tests that
  would reach seat selection instead verify that GSC correctly enforces its
  login gate, and stop there. This is a genuine passing test, not a skipped one.
- **With credentials**, set below, those same tests log in and continue all
  the way through seat selection and the booking review screen.

To configure credentials:

1. Copy the template file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in a GSC account you control (a personal or QA/demo
   account — **never** a real customer's account, and never commit real
   credentials):
   ```
   GSC_TEST_MOBILE_NUMBER=6011XXXXXXXX
   GSC_TEST_PASSWORD=your-account-password
   ```
3. That's it — `playwright.config.ts` loads `.env` automatically (via
   `dotenv`) before any test runs, and the dashboard's backend passes it
   through to the Playwright process it spawns. `.env` is git-ignored, so it
   never gets committed.

You can also set these as real environment variables instead of using
`.env` (useful in CI):

```bash
# macOS/Linux
export GSC_TEST_MOBILE_NUMBER="6011XXXXXXXX"
export GSC_TEST_PASSWORD="your-account-password"

# Windows PowerShell
$env:GSC_TEST_MOBILE_NUMBER = "6011XXXXXXXX"
$env:GSC_TEST_PASSWORD = "your-account-password"
```

Credentials are read only from environment variables, only in one place
(`test-data/bookingData.ts`) — never hardcoded, never logged, never written
into a screenshot filename.

## Running the test suite from the command line

Run everything, visibly (headed — a real Chromium window opens so you can
watch it):

```bash
npx playwright test --headed
```

Omit `--headed` to run the exact same tests headlessly (e.g. in CI):

```bash
npx playwright test
```

Every spec file is fully independent — each one starts its own fresh browser
session from the GSC homepage, so any of them can be run alone, in any order:

```bash
npx playwright test tests/login.spec.ts --headed
npx playwright test tests/browse-and-select.spec.ts --headed
npx playwright test tests/select-showtime.spec.ts --headed
npx playwright test tests/continue-booking.spec.ts --headed
npx playwright test tests/negative-validation.spec.ts --headed
npx playwright test tests/search-movie-trailer.spec.ts --headed
```

Equivalent npm scripts are provided:

```bash
npm run test:login
npm run test:browse
npm run test:showtime
npm run test:booking
npm run test:negative
npm run test:trailer
npm run test:headed   # all tests, headed
npm run test          # all tests, headless
```

## Viewing test results

```bash
npx playwright show-report
```

This opens the standard Playwright HTML report for the most recent
command-line run — test names, pass/fail status, duration, and (per this
project's configuration) screenshots and video for every test, not just
failures, plus trace files retained on failure/retry for deep debugging.

Screenshots are also written directly to `test-results/screenshots/*.png` at
each checkpoint the tests describe below, independent of the report.

(If you're using the dashboard instead of the command line, see
[Using the dashboard](#using-the-dashboard) — it shows results in the
browser and doesn't need this command.)

## Test coverage

| Spec | What it does |
| --- | --- |
| `login.spec.ts` | Standalone login coverage. Clicks the homepage's "Sign In" control to reach GSC's login form directly (rather than via a booking flow). Without credentials, verifies the login form is genuinely shown and stops; with credentials, logs in and verifies the form closes. |
| `browse-and-select.spec.ts` | Loads the homepage, **discovers** a movie that currently has a working "Buy Now" link (never a hardcoded title), selects it, and verifies the showtime-selection screen shows the movie title, at least one cinema, and an enabled showtime. |
| `select-showtime.spec.ts` | Independently repeats movie selection, then picks the first **enabled** date and the first **enabled** showtime (never assumes today, never hardcodes a time), and verifies the selection is reflected in the booking journey. |
| `continue-booking.spec.ts` | The full journey: movie → cinema → date → showtime → seat selection → booking summary → review/checkout stage — stopping before payment. See [Important live-site behaviour](#important-live-site-behaviour) for how it handles the login gate. |
| `negative-validation.spec.ts` | A genuine negative/validation scenario: confirms a "Coming Soon" movie is rendered with only a "More Info" link (never "Buy Now") on both the listing tile and its detail page — i.e. it genuinely cannot be booked. Nothing is mocked. |
| `search-movie-trailer.spec.ts` | Searches the site for a movie, opens the result, opens its trailer, lets it play for a few seconds, pauses it, then stops it. |

## Important live-site behaviour

GSC is a live, constantly changing cinema booking site — movie titles,
cinemas, dates, showtimes and seat maps can and do change at any time. Every
test discovers currently-available options at run time via reusable helper
methods in `pages/*.ts` (`findAvailableMovie`, `findAvailableDate`,
`findAvailableShowtime`, `findAvailableSeat`, and their `selectAvailable*`
counterparts) instead of depending on fixed values.

**Seat selection requires a signed-in GSC account.** Clicking a showtime
while *not* logged in redirects an anonymous visitor to a "Log In" screen —
the live booking app will not show the seat map to a guest. This is real,
current GSC behaviour, not a bug in this automation.

`continue-booking.spec.ts` (and `login.spec.ts`) handle this correctly
rather than papering over it:

- **Without credentials** (the default), the test verifies, with a real
  assertion, that GSC correctly requires authentication before seat
  selection, logs a clear explanation, and stops there. The test **passes**
  — it has validated genuine site behaviour, not skipped anything silently.
- **With credentials** configured (see
  [Configuring GSC test credentials](#configuring-gsc-test-credentials-optional)),
  the test logs in and continues all the way through seat selection, the
  booking summary, and the review/checkout screen.

If the specific showtime selected turns out to have no available seats (sold
out) once the seat map loads, `continue-booking.spec.ts` automatically falls
back to another available showtime rather than failing outright.

**No purchase is ever made.** `verifyReachedCheckoutStage()` in
`pages/GscBookingPage.ts` asserts the "Checkout & Pay" button is visible and
enabled — and deliberately never clicks it.

## The UI Automation Dashboard

Alongside the command-line tests, this repo includes a small local dashboard
for triggering them by clicking a button: a Node/Express backend that spawns
the real Playwright CLI, and a React/Vite frontend that shows live,
GitLab-CI-pipeline-style status.

### Dashboard setup, step by step

1. **Install dependencies** (skip if you already ran
   [Installation](#installation) above):
   ```bash
   npm run install:all
   ```
   This installs both the root project (which includes the dashboard's
   backend) and `dashboard/` (the frontend) in one step.

2. **(Optional) configure GSC credentials** — see
   [Configuring GSC test credentials](#configuring-gsc-test-credentials-optional).
   Not required; without it, booking-flow tests just stop at GSC's login
   gate, same as on the command line.

3. **Start both halves together:**
   ```bash
   npm run dev
   ```
   This uses `concurrently` to start the backend on port `3000` and the
   dashboard's dev server on port `5173` in one terminal, with color-coded
   output (`server` in blue, `dashboard` in magenta).

4. **Open the dashboard:** go to **http://localhost:5173** in your browser.
   You should see a pipeline strip with every test as a gray "not run" node,
   a card per test, and an empty "All Results" section below.

5. **Run a test:** click **Run Test** on any card, or **Run All Tests** at
   the top. A real, visible Chromium window will open and drive itself
   through the GSC site — this is not a simulation. Watch the pipeline node
   for that test turn blue (running), then green (passed) or red (failed).

6. **Review the result:** scroll down to **All Results** — every test's
   status, timestamps, screenshots, video, and a link to its full Playwright
   HTML report are all listed there, updating live as runs complete.

If you'd rather run the two halves in separate terminals (useful for reading
each one's logs on its own, or restarting just one):

```bash
npm run server:dev     # backend only, on :3000, auto-restarts on file change
npm run dashboard      # frontend only, on :5173
```

Either way, the dashboard's dev server proxies `/api/*` and `/artifacts/*`
requests through to the backend on port 3000 (see `dashboard/vite.config.ts`)
— you never need to point your browser at port 3000 directly.

### Using the dashboard

- The **pipeline strip** at the top shows every test as a connected node,
  colored gray (not run) / blue (running) / green (passed) / red (failed) —
  click a node to highlight and scroll to its entry further down the page.
- Each test also has its own **card** with a **Run Test** button.
- **Run All Tests** runs every test back-to-back (never in parallel, since
  they share one visible browser window and one GSC session) and the
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
- No purchase is ever triggered by the dashboard — it runs the exact same
  specs described in [Test coverage](#test-coverage), unchanged.

### Dashboard architecture

```text
Dashboard (React) --poll GET /api/tests--> Node/Express API --spawn--> npx playwright test <spec> --headed
     ^                                            |
     |                                            v
     +----------- artifacts (report/screenshots/video) served from disk
```

- **The React UI never runs Playwright itself.** Every "Run Test" click is
  an HTTP `POST` to the backend; the backend is the only thing that spawns a
  process.
- **Tests always run headed, in real Chromium**, against the live GSC site —
  the same specs described above, unchanged. There is no headless mode in
  the dashboard; you will see the browser window open and drive itself.
- **The frontend never sends a file path or shell command.** Each "Run Test"
  request carries only a fixed test id (e.g. `browse-and-select`); the
  backend resolves that id to a spec file **only** via the hardcoded table
  in `server/testDefinitions.ts`. There is no code path from an HTTP
  request to an arbitrary command — the backend spawns
  `npx playwright test <fixed path> --headed` with a fixed argv array,
  never a shell string built from request input.
- **No database, no persistence.** Test status lives in an in-memory `Map`
  in the backend process; restarting the backend resets every test to
  `NOT_RUN`.
- **No secrets reach the dashboard.** `GSC_TEST_MOBILE_NUMBER` /
  `GSC_TEST_PASSWORD` are read by the Playwright process itself (via
  `.env` → `test-data/bookingData.ts`, exactly as described above); the
  Express API never reads, forwards, or exposes them to the frontend.
- **Only one test runs at a time.** Starting a test while another is
  `RUNNING` (individually or via "Run All Tests") is rejected with HTTP 409
  — this keeps a single visible Chromium window and a single GSC session
  un-contended.

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

Useful for scripting or debugging without opening the UI, e.g.:

```bash
curl http://localhost:3000/api/tests
curl -X POST http://localhost:3000/api/tests/browse-and-select/run
```

## Project structure

```text
gsc-playwright/
├── CLAUDE.md                  # Hard rules for AI assistants working in this repo
├── AI_GUIDELINES.md           # Architecture notes, conventions, "how to add a spec"
├── README.md
├── package.json                # Root scripts: tests, typecheck, dashboard dev/build
├── playwright.config.ts
├── tsconfig.json
├── .env.example                 # Template — copy to .env and fill in your own account
├── pages/                       # Page Object Model - one class per GSC screen
│   ├── GscHomePage.ts             # homepage: movie discovery, search, sign-in
│   ├── GscShowtimesPage.ts        # date + cinema/showtime selection
│   ├── GscBookingPage.ts          # login form, seats, upsells, review/checkout
│   └── GscMovieDetailPage.ts      # movie detail page: trailer open/play/pause/stop
├── tests/                       # One spec file per flow, each independently runnable
│   ├── login.spec.ts
│   ├── browse-and-select.spec.ts
│   ├── select-showtime.spec.ts
│   ├── continue-booking.spec.ts
│   ├── negative-validation.spec.ts
│   └── search-movie-trailer.spec.ts
├── test-data/
│   └── bookingData.ts           # URLs, label regexes, env-backed credentials
├── server/                      # Dashboard backend (Node.js + Express + TypeScript)
│   ├── index.ts                    # Express app + routes + static artifact serving
│   ├── testRunner.ts               # spawns Playwright, tracks in-memory execution state
│   ├── testDefinitions.ts          # the ONLY id → spec file mapping
│   └── types.ts
└── dashboard/                   # Dashboard frontend (React + TypeScript + Vite)
    ├── index.html
    ├── vite.config.ts               # dev-server proxy for /api and /artifacts
    ├── tsconfig.json
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── App.css
        ├── components/
        │   ├── Pipeline.tsx           # GitLab-CI-style status nodes
        │   ├── StatusBadge.tsx        # colored NOT_RUN/RUNNING/PASSED/FAILED pill
        │   ├── TestCaseCard.tsx       # per-test "Run Test" card
        │   ├── TestDetails.tsx        # timestamps, links, previews, logs for one test
        │   └── ResultsLog.tsx         # every test's full result, listed together
        ├── services/api.ts          # fetch wrapper around the REST API
        └── types/test.ts
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

A small number of selectors (the homepage's search box and Sign In control,
the movie-detail trailer player) are still marked in code comments as
**not yet independently confirmed** — see
[Troubleshooting](#troubleshooting) if a test fails on one of those steps.

All waiting is state-based (`expect(locator).toBeVisible()`,
`toBeEnabled()`, `waitForURL()`, `Locator.waitFor()`,
`Promise.race([...])` between two possible next screens) — there are no
`page.waitForTimeout()` fixed sleeps anywhere in this project, with one
deliberate, documented exception in `GscMovieDetailPage.playThenPause()`
(the trailer test's whole point is to observe a few real seconds of
playback).

GSC's "Buy Now" and "Sign In" links on the marketing site (`www.gsc.com.my`)
point at a separate application on `epaymentwebapp.gsc.com.my`, which GSC
opens in a new tab. Rather than click-and-hope, `GscHomePage.selectAvailableMovie()`
and `GscHomePage.clickSignIn()` read the link's real `href`/`target` and
navigate to it directly, returning whichever `Page` object ends up showing
the destination — this avoids depending on a moving carousel element staying
still long enough to be clicked, and on assuming the click stayed in the
same tab.

## Troubleshooting

**`npx playwright test` fails immediately with a browser-not-found error.**
Run `npx playwright install chromium` (see [Installation](#installation)) —
this only needs to be done once per machine, but is easy to miss.

**A test times out on a step that clicks something (Sign In, search, the
trailer button) with a "locator not found" or "toBeVisible() failed" error.**
A handful of selectors in this project are marked in code comments as not
yet independently confirmed against the live site. Paste the failure's
error text and ARIA snapshot back for a fix, or run
`npx playwright codegen https://www.gsc.com.my/` yourself to find the
control's real accessible role/name and update the relevant locator in
`pages/*.ts`.

**A booking-flow test "fails" at seat selection / stays stuck at a login
screen.** This is very likely not a failure at all — see
[Important live-site behaviour](#important-live-site-behaviour). Without
`GSC_TEST_MOBILE_NUMBER` / `GSC_TEST_PASSWORD` configured, stopping at the
login gate with a passing assertion is the *expected* result.

**`npm run dev` fails with "port 3000 (or 5173) already in use."** Something
else on your machine is already using that port. Either stop it, or run the
two halves separately with a different port: `PORT=3001 npm run server:dev`
for the backend (the dashboard's Vite proxy would then also need updating in
`dashboard/vite.config.ts` to match), or pass `--port` to Vite for the
frontend: `npm run dashboard -- --port 5174`.

**Dashboard: "Cannot start ... already running" (HTTP 409) when clicking Run
Test.** Only one Playwright process runs at a time by design (see
[Dashboard architecture](#dashboard-architecture)) — wait for the current
run to finish (its pipeline node turns green or red), then try again.

**Dashboard: a screenshot or video won't load / 404s.** Every run writes its
artifacts to its own isolated folder, so this shouldn't happen for any test
run after this project's artifact-isolation fix — but if it does, confirm
the backend (`npm run server:dev`) is actually running and reachable at
`http://localhost:3000/api/tests`, and that the test in question has
actually finished (`status` is `PASSED` or `FAILED`, not `RUNNING`).

**`npm run build --prefix dashboard` fails with `Cannot find module
'@rollup/rollup-linux-x64-gnu'`.** This is a known upstream npm bug with
optional dependencies (npm/cli#4828), unrelated to this project — it
surfaces occasionally after installing `node_modules` on one machine/OS and
copying or syncing it to another. Fix: delete `dashboard/node_modules` and
`dashboard/package-lock.json`, then `npm install --prefix dashboard` again.
It does not affect `npm run dev` (Vite's dev server), only a production
`build`.

**TypeScript errors after pulling changes.** Run `npx tsc --noEmit` at the
repo root, and `npm run typecheck:dashboard` if you also changed anything
under `dashboard/`. If dependencies changed, re-run
[Installation](#installation) first.
