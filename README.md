# GSC Malaysia Playwright UI Automation (Demo)

A small, self-contained Playwright + TypeScript UI automation project for the
official Golden Screen Cinemas Malaysia website (https://www.gsc.com.my/).

This is a demonstration project, not a purchasing tool: **no test ever
completes a purchase**. Every booking-flow test stops at the review/checkout
screen, before the "Checkout & Pay" button is clicked.

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
npx playwright test tests/browse-and-select.spec.ts --headed
npx playwright test tests/select-showtime.spec.ts --headed
npx playwright test tests/continue-booking.spec.ts --headed
npx playwright test tests/negative-validation.spec.ts --headed
```

Equivalent npm scripts are provided:

```bash
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
