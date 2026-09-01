# CLAUDE.md

Instructions for Claude (or any AI assistant) working in this repository.

## What this project is

A Playwright + TypeScript UI automation suite for the live, public Golden
Screen Cinemas Malaysia website (`https://www.gsc.com.my/`), plus a small
local dashboard (Node/Express + React/Vite) for triggering those tests by
clicking a button instead of the command line. See `README.md` for full
usage docs and `AI_GUIDELINES.md` for architecture/conventions detail this
file doesn't repeat.

## Hard rules — do not violate these

- **Never complete a real purchase.** Every booking-flow test/page-object
  method stops before GSC's "Checkout & Pay" button is clicked. Do not add
  code that clicks it, fills payment details, or otherwise advances past the
  review/checkout stage.
- **Never hardcode real credentials.** GSC test-account credentials
  (`GSC_TEST_MOBILE_NUMBER` / `GSC_TEST_PASSWORD`) are read only from
  environment variables via `test-data/bookingData.ts`'s `credentials`
  object. Never read `process.env` for them anywhere else, never print them,
  never write them into a file, screenshot name, or commit.
- **Never invent a selector.** This repo has no live network access from an
  AI assistant's own tool calls — `gsc.com.my` cannot be reached from a
  sandboxed session. Selectors must come from the user pasting real
  Playwright error output / ARIA snapshots, or from the user themselves
  running `npx playwright codegen https://www.gsc.com.my/`. If a locator is
  unconfirmed, say so in a code comment rather than presenting it as
  verified.
- **The dashboard backend must never accept a file path, spec name, or shell
  command from the frontend.** Every `POST /api/tests/:testId/run` request
  carries only a predefined test id; `server/testDefinitions.ts` is the only
  place an id resolves to a spec file. Do not add a code path that lets an
  HTTP request influence what gets spawned. Never add a database or persist
  secrets in the dashboard's in-memory state.

## Working style expected in this repo

- Prefer web-first, auto-retrying assertions (`expect(locator).toBeVisible()`,
  `.toBeEnabled()`, `Locator.waitFor()`) over one-shot reads (`.count()`,
  `.isVisible()` without awaiting a wait) or fixed sleeps
  (`page.waitForTimeout()`). The one deliberate exception in this repo is
  `GscMovieDetailPage.playThenPause()`, which waits out real trailer playback
  time on purpose — note any new exception like that in a comment.
- Follow the existing Page Object Model: one class per logical screen under
  `pages/`, each taking a `Page` in its constructor and exposing
  intention-revealing methods (`findAvailableX`, `selectAvailableX`,
  `verifyX`) rather than exposing raw locators to test files.
- Every spec file under `tests/` must remain independently runnable
  (`npx playwright test tests/<file> --headed`) — don't introduce
  cross-file ordering dependencies.
- Explain a root cause before shipping a fix, the way earlier fixes in this
  project were done (region-role ARIA bug, homepage-bounce on slug-less
  URLs, `.count()` race conditions, hover-reveal links, reward-modal
  overlay timing). Don't paper over a live-site failure with a broader
  timeout or a retry loop without first identifying why it failed.
- When adding a new spec or page-object method that the dashboard should be
  able to run, also add it to `server/testDefinitions.ts` (and
  `server/testRunner.ts`'s `KNOWN_SCREENSHOTS` map, if it takes its own
  checkpoint screenshots) — see `AI_GUIDELINES.md` for the full checklist.
- After any change under `pages/`, `tests/`, or `server/`, run
  `npx tsc --noEmit` (root) and, if `dashboard/` was touched,
  `npm run typecheck:dashboard` too, before considering the change done.
