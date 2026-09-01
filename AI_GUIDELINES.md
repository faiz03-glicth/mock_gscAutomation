# AI Guidelines

Deeper architecture notes and conventions for AI assistants working in this
repository. Read `CLAUDE.md` first for the hard rules; this file is context
to help you work effectively once those are understood.

## Repository layout

```text
gsc-playwright/
├── pages/                 # Page Object Model - one class per GSC screen
│   ├── GscHomePage.ts        # homepage: movie discovery, search, sign-in
│   ├── GscShowtimesPage.ts   # date + cinema/showtime selection
│   ├── GscBookingPage.ts     # login form, seats, upsells, review/checkout
│   └── GscMovieDetailPage.ts # movie detail page: trailer playback
├── tests/                 # One spec file per user-facing flow, independent
│   ├── login.spec.ts
│   ├── browse-and-select.spec.ts
│   ├── select-showtime.spec.ts
│   ├── continue-booking.spec.ts
│   ├── negative-validation.spec.ts
│   └── search-movie-trailer.spec.ts
├── test-data/
│   └── bookingData.ts     # URLs, label regexes, env-backed credentials
├── server/                # Dashboard backend (Express)
│   ├── index.ts               # routes + static artifact serving
│   ├── testRunner.ts          # spawns Playwright, tracks execution state
│   ├── testDefinitions.ts     # THE ONLY id -> spec file mapping
│   └── types.ts
├── dashboard/              # Dashboard frontend (React + Vite)
│   └── src/
│       ├── App.tsx
│       ├── components/        # Pipeline, TestCaseCard, TestDetails, ResultsLog, StatusBadge
│       ├── services/api.ts
│       └── types/test.ts
├── playwright.config.ts
├── CLAUDE.md
└── README.md
```

## Why this project is written the way it is

GSC is a real, constantly changing production site — not a fixture or a
mock. Movie titles, cinemas, dates, showtimes, and seat maps change at any
time. This shapes almost every design decision here:

- Page objects **discover** an available option at runtime
  (`findAvailableMovie`, `findAvailableDate`, `findAvailableShowtime`,
  `findAvailableSeat`) instead of depending on a fixed title/date/time. Do
  not "fix" a flaky test by hardcoding a value that happened to work once.
- GSC gates seat selection behind a login wall. Booking-flow tests support
  two modes: with `GSC_TEST_MOBILE_NUMBER`/`GSC_TEST_PASSWORD` configured
  they log in and continue; without them, they assert the login gate is
  correctly enforced and stop there. **Both are passing outcomes** — an
  unauthenticated run isn't a skipped test, it's validating real GSC
  behavior.
- No AI session working in this repo has network access to `gsc.com.my`.
  Every locator here was written from a live error message, screenshot, or
  ARIA snapshot the user pasted in, or from the user's own
  `npx playwright codegen` output — never guessed from the site's likely
  markup. When you cannot verify a selector, write the most reasonable
  role/text-based locator, and say plainly in a code comment (and in your
  reply to the user) that it's unconfirmed, with the codegen command as the
  way to verify it.

## Selector strategy (in order of preference)

1. `getByRole()` with accessible name/role — used almost everywhere.
2. Text pattern matching GSC's own rendered text (regexes in
   `test-data/bookingData.ts`) — used only where GSC's controls have no
   ARIA role of their own (seat grid, cinema/time buttons).
3. No CSS class selectors, no XPath — GSC's class names are
   generated/unstable.

All waiting is state-based. No `page.waitForTimeout()` fixed sleeps, except
the one documented exception in `GscMovieDetailPage.playThenPause()` (the
test's whole purpose is to observe ~5 seconds of real playback).

## Adding a new spec file

1. Create `tests/<name>.spec.ts` using `test.step()` to narrate each phase,
   following the style of existing specs (see `tests/select-showtime.spec.ts`
   for a compact example).
2. Reuse or extend a page object in `pages/` rather than putting locators
   directly in the spec file.
3. Add an `npm run test:<name>` script in `package.json` for direct CLI use.
4. To expose it in the dashboard: add an entry to `testDefinitions` in
   `server/testDefinitions.ts` (`id`, `name`, `description`, `specFile`).
   If the spec takes its own checkpoint screenshots via
   `page.screenshot({ path: 'test-results/screenshots/...' })`, list those
   paths in the `KNOWN_SCREENSHOTS` map in `server/testRunner.ts` so the
   dashboard can find and preview them.
5. Run `npx tsc --noEmit` at the repo root before considering it done.

## Dashboard architecture notes

- The React frontend never spawns Playwright itself — every "Run Test"
  click is a `POST /api/tests/:testId/run`, and only `server/testRunner.ts`
  calls `child_process.spawn`, always with a fixed argv array built from the
  predefined `testDefinitions` table, never from request input.
- State is in-memory only (a `Map` in `testRunner.ts`) — restarting the
  backend resets every test to `NOT_RUN`. There is no database by design.
- Only one Playwright process runs at a time (`runningTestId` single-flight
  lock), because these are real headed Chromium sessions sharing one visible
  window and one GSC browsing session — never remove this lock to "support
  parallel runs" without re-checking that assumption with the user first.
- **Each run gets its own isolated output directory**
  (`test-results/runs/<testId>-<timestamp>/`, via Playwright's `--output`
  flag) **and its own HTML report folder**
  (`playwright-report/runs/<testId>-<timestamp>/`, via the
  `PLAYWRIGHT_HTML_REPORT` env var). This exists because Playwright wipes
  its configured output directory at the start of every run — without this
  isolation, a second dashboard run deletes the first run's
  video/screenshots/report, breaking the "View Details" links for anything
  run earlier in the session. If you touch `runTest()` in
  `server/testRunner.ts`, preserve this per-run isolation.
- Artifact paths returned to the frontend must always use forward slashes
  (see `toUrlPath()` in `testRunner.ts`) even though the dashboard commonly
  runs on Windows, where `path.relative()` returns backslashes — a raw
  Windows path segment breaks the `/artifacts/...` URL.
- `ResultsLog` in the dashboard renders every test's full result (status,
  timestamps, inline screenshot/video previews, collapsible logs) stacked
  together in one list — this is intentional: the dashboard is meant to be
  read as a combined run log, not a single-test-at-a-time detail view.
  Don't reintroduce a "click to reveal, otherwise hidden" pattern for this
  panel; a pipeline-node/card click should only highlight and scroll to a
  test's entry, never hide the rest.

## Verifying a change before calling it done

- `npx tsc --noEmit` at the repo root (covers `pages/`, `tests/`,
  `test-data/`, `server/`).
- `npm run typecheck:dashboard` (or `typecheck:all`) if `dashboard/` changed.
- `npm run build --prefix dashboard` if you touched frontend code, to catch
  bundler-level issues `tsc --noEmit` alone won't.
- This is a live-site project: an AI assistant cannot run the specs
  end-to-end itself (no network access to `gsc.com.my`). A change is only
  fully verified once the user runs it and reports back — say this plainly
  rather than implying a fix is confirmed working against the live site.
