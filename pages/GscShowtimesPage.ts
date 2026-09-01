import { expect, Locator, Page } from '@playwright/test';
import { dateLabelPattern, showtimeLabelPattern } from '../test-data/bookingData';

export type PostShowtimeState = 'login-required' | 'seat-selection';

/**
 * Page object for the movie showtime-selection screen inside the booking
 * application (https://epaymentwebapp.gsc.com.my/showtime-by-movies/...).
 *
 * This single screen lets a user, in order:
 *   1. Pick a date (a row of day/date buttons under "Select Date"),
 *   2. Optionally filter by experience/format ("Select Experiences"),
 *   3. Pick a cinema + showtime from a long list grouped by cinema, under
 *      "Select Cinemas & Time".
 *
 * All controls are plain buttons with no stable `id`/`data-testid` hooks, so
 * this page object leans on ARIA roles plus the accessible text GSC itself
 * renders (day names, dates, time labels) rather than any generated CSS
 * class name.
 */
export class GscShowtimesPage {
  constructor(private readonly page: Page) {}

  async verifyLoaded(movieTitle?: string): Promise<void> {
    await expect(this.page).toHaveURL(/epaymentwebapp\.gsc\.com\.my/);
    await expect(this.page.getByRole('heading', { name: 'Select Date' })).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Select Cinemas & Time' })).toBeVisible();
    if (movieTitle) {
      await expect(this.page.getByRole('heading').first()).toHaveText(movieTitle);
    }
  }

  /**
   * All date-selector buttons currently rendered (e.g. "TUE 01 Sep"), found
   * by their own distinctive accessible text rather than by scoping to a
   * "Select Date" region landmark.
   *
   * GSC renders "Select Date" and "Select Cinemas & Time" inside plain,
   * unlabelled `<section>` elements. Per the ARIA spec, a `<section>` only
   * gets an implicit `role="region"` when it has an accessible name
   * (`aria-label`/`aria-labelledby`) - GSC's sections don't, so
   * `page.getByRole('region')` matches nothing on this page even though the
   * headings inside those sections are fully visible. Matching buttons by
   * their own text pattern across the whole page sidesteps that missing
   * landmark entirely - the same technique `showtimeButtonCandidates()`
   * already uses below for showtime buttons.
   */
  private dateButtons(): Locator {
    return this.page.getByRole('button', { name: dateLabelPattern });
  }

  /**
   * Finds the first enabled/selectable date button, without assuming today's
   * date is bookable.
   *
   * Waits for the first matching button with a web-first, auto-retrying
   * assertion (`toBeVisible()`) before counting/scanning, rather than
   * calling `.count()` immediately. `.count()` reads whatever is in the DOM
   * at that exact instant with no retry - on a page that still has content
   * loading in (as this one does, see `findAvailableShowtime()` below for
   * the same issue observed with showtime buttons), that read can legitimately
   * return 0 a moment before the real buttons render.
   */
  async findAvailableDate(): Promise<Locator> {
    const buttons = this.dateButtons();
    await expect(
      buttons.first(),
      'Expected at least one date option to appear under "Select Date"'
    ).toBeVisible({ timeout: 15_000 });

    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      if ((await button.isVisible()) && (await button.isEnabled())) {
        return button;
      }
    }

    throw new Error('No available (enabled) date could be found for this movie.');
  }

  /**
   * Selects the first available date and returns its visible label text.
   *
   * Verifies the page is still on the movie's showtime screen immediately
   * after the click, rather than letting a bad state surface later as a
   * confusing "no showtime button found" failure. This page has been
   * observed bouncing back to the GSC homepage after a date click when it
   * was reached via a slug-less "Buy Now" URL (see `GscHomePage`'s
   * `slugPathPattern`) - failing here instead gives a direct, actionable
   * error pointing at the real cause.
   */
  async selectAvailableDate(): Promise<string> {
    const date = await this.findAvailableDate();
    const label = ((await date.textContent()) ?? '').replace(/\s+/g, ' ').trim();

    await expect(date).toBeEnabled();
    await date.click();

    await expect(
      this.page.getByRole('heading', { name: 'Select Cinemas & Time' }),
      'Expected to still be on the showtime-selection page after choosing a date - the booking app appears to have navigated away (e.g. back to the GSC homepage).'
    ).toBeVisible({ timeout: 15_000 });

    return label;
  }

  /**
   * All buttons on the page whose accessible name matches a showtime label
   * (e.g. "2:30PM GETHA"), as opposed to the cinema-name toggle buttons or
   * date buttons that sit alongside them. Matching by name directly, rather
   * than a "Select Cinemas & Time" region (which - like "Select Date" above
   * - doesn't actually expose an ARIA `region` role), is what makes this
   * reliable.
   */
  private showtimeButtons(): Locator {
    return this.page.getByRole('button', { name: showtimeLabelPattern });
  }

  /**
   * Finds the first enabled/bookable showtime across all listed cinemas.
   *
   * GSC renders each cinema as its own collapsible section, and the
   * showtime buttons inside them are populated by a follow-up request after
   * "Select Cinemas & Time" itself is already visible - so this page can
   * briefly show that heading with zero showtime buttons rendered yet.
   * Waiting on a web-first, auto-retrying assertion (`toBeVisible()`) for
   * the first matching button - instead of immediately calling `.count()`,
   * which reads the DOM once with no retry - avoids racing that load.
   */
  async findAvailableShowtime(): Promise<Locator> {
    const buttons = this.showtimeButtons();
    await expect(
      buttons.first(),
      'Expected at least one showtime button to appear under "Select Cinemas & Time" once the cinema listings finish loading'
    ).toBeVisible({ timeout: 20_000 });

    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const candidate = buttons.nth(i);
      if ((await candidate.isVisible()) && (await candidate.isEnabled())) {
        return candidate;
      }
    }

    throw new Error('No available (enabled) showtime could be found for this movie on the selected date.');
  }

  /**
   * Selects the first available showtime and waits for the booking app to
   * move to the next step. GSC requires an authenticated member before it
   * will show the seat map, so the very next screen is either:
   *   - a "Log In" screen (anonymous session), or
   *   - the seat-selection screen (already-authenticated session).
   * Both are legitimate outcomes of "the flow can continue to the next
   * booking step" and are surfaced to the caller to act on.
   */
  async selectAvailableShowtime(): Promise<{ label: string; nextState: PostShowtimeState }> {
    const showtime = await this.findAvailableShowtime();
    const label = ((await showtime.textContent()) ?? '').replace(/\s+/g, ' ').trim();

    await expect(showtime).toBeEnabled();
    await showtime.click();

    const loginHeading = this.page.getByRole('heading', { name: 'Log In' });
    const seatSelectionMarker = this.page.getByText('Seat(s) Selection', { exact: false });

    const nextState = await Promise.race([
      loginHeading
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then((): PostShowtimeState => 'login-required'),
      seatSelectionMarker
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then((): PostShowtimeState => 'seat-selection'),
    ]);

    return { label, nextState };
  }
}
