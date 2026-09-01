import { expect, Page } from '@playwright/test';
import { urls } from '../test-data/bookingData';

/**
 * Page object for the GSC Malaysia public marketing site homepage
 * (https://www.gsc.com.my/).
 *
 * The homepage renders a "Now Showing" carousel where every currently
 * bookable movie is paired with a real "Buy Now" link. That link points
 * straight at the separate booking application
 * (https://epaymentwebapp.gsc.com.my/showtime-by-movies/...), which is where
 * GscShowtimesPage takes over.
 */
export class GscHomePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto(urls.home);
  }

  /** Confirms the GSC homepage has actually loaded. */
  async verifyLoaded(): Promise<void> {
    await expect(this.page).toHaveTitle(/GSC|Golden Screen Cinemas/i);
    // The header logo link is present on every GSC page.
    await expect(this.page.getByRole('link', { name: 'home' }).first()).toBeVisible();
  }

  /** All "Buy Now" links currently rendered on the homepage. */
  private buyNowLinks() {
    return this.page.getByRole('link', { name: 'Buy Now' });
  }

  /**
   * The homepage's own "Sign In" / "Login" control (header nav), as opposed
   * to the login form GSC also shows mid-booking when an anonymous visitor
   * tries to select a showtime. Matched by accessible name pattern rather
   * than exact text since the live label hasn't been independently
   * confirmed - if this doesn't match on your run, use
   * `npx playwright codegen https://www.gsc.com.my/` to find the real
   * accessible name/role and adjust this pattern.
   */
  private signInControl() {
    return this.page
      .getByRole('link', { name: /sign in|log in|login/i })
      .or(this.page.getByRole('button', { name: /sign in|log in|login/i }))
      .first();
  }

  /**
   * Clicks the homepage's Sign In / Login control and returns whichever
   * `Page` ends up showing the login form.
   *
   * The real "Sign In" link observed on the live site points at
   * `https://epaymentwebapp.gsc.com.my/profile` - a different origin from
   * the marketing site, exactly like the "Buy Now" links `selectAvailableMovie()`
   * already has to handle above. GSC opens links to that separate origin in
   * a new tab, so a plain `.click()` on the original `page` can leave it
   * sitting on the homepage while the login form actually loads in a
   * different tab - which is what caused `verifyLoginRequired()` to time
   * out looking for a "Log In" heading that was never on `page` at all.
   *
   * Following the same href/target-reading approach as
   * `selectAvailableMovie()` (rather than a bare `.click()`) avoids that:
   * it reads the link's real destination and opens it explicitly, in a new
   * tab when `target="_blank"`, and returns that Page so the caller acts on
   * the right one.
   */
  async clickSignIn(): Promise<Page> {
    const signIn = this.signInControl();
    await expect(signIn, 'Expected a Sign In / Login control on the GSC homepage').toBeVisible();

    const href = await signIn.getAttribute('href');
    if (!href) {
      // No href (a JS-driven control rather than a real link) - fall back to
      // a real click, watching for a new tab it might open.
      const newPagePromise = this.page.context().waitForEvent('page', { timeout: 5_000 }).catch(() => null);
      await signIn.click();
      const newPage = await newPagePromise;
      if (newPage) {
        await newPage.waitForLoadState('domcontentloaded');
      }
      return newPage ?? this.page;
    }

    const opensNewTab = (await signIn.getAttribute('target')) === '_blank';
    const destination = new URL(href, this.page.url()).toString();

    const targetPage = opensNewTab ? await this.page.context().newPage() : this.page;
    await targetPage.goto(destination);
    await targetPage.waitForLoadState('domcontentloaded');
    return targetPage;
  }

  /**
   * The header's search trigger/input. GSC (like most cinema sites) is
   * expected to hide a text input behind a search icon button until clicked
   * - this opens it first if needed, then returns the now-visible input.
   * Not yet confirmed against the live site - see the class-level note.
   */
  private searchToggle() {
    return this.page
      .getByRole('button', { name: /search/i })
      .or(this.page.getByRole('link', { name: /search/i }))
      .first();
  }

  private searchInput() {
    return this.page
      .getByRole('searchbox')
      .or(this.page.getByRole('textbox', { name: /search/i }))
      .or(this.page.getByPlaceholder(/search/i))
      .first();
  }

  /** Opens the search box (if hidden behind a toggle) and types `query` into it. */
  async searchMovies(query: string): Promise<void> {
    const toggle = this.searchToggle();
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
    }

    const input = this.searchInput();
    await expect(input, 'Expected a movie search input on the GSC homepage').toBeVisible({ timeout: 10_000 });
    await input.fill(query);
  }

  /**
   * Clicks a search result whose accessible name matches `titlePattern`.
   *
   * The search overlay itself doesn't auto-close once a result navigates the
   * page (confirmed live: a `div.search-popup...show` was left mounted,
   * full-viewport and `position: fixed`, intercepting pointer events on the
   * destination page - e.g. blocking a "Watch Trailer" click). It exposes no
   * accessible role/name of its own to dismiss directly, so this presses
   * Escape (the conventional way to close this kind of overlay) and, if it's
   * somehow still open, falls back to a CSS-based check purely to confirm
   * it's gone before handing control back - never used for a core assertion,
   * only this cleanup.
   */
  async openSearchResult(titlePattern: RegExp): Promise<void> {
    const result = this.page.getByRole('link', { name: titlePattern }).first();
    await expect(result, `Expected a search result matching ${titlePattern}`).toBeVisible({ timeout: 10_000 });
    await result.click();
    await this.page.waitForLoadState('domcontentloaded');

    await this.page.keyboard.press('Escape');
    const overlay = this.page.locator('.search-popup.show');
    if (await overlay.isVisible().catch(() => false)) {
      await this.searchToggle().click().catch(() => {});
    }
    await overlay.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }

  /**
   * A "Buy Now" href that includes the movie's slug in the path, e.g.
   * `/showtime-by-movies/6276/chelot?id=6276`. GSC renders the *same* movie
   * with two different "Buy Now" href shapes in different homepage sections:
   * the hero carousel links to the slugged form above, while the "Top 10
   * Movies" list links to a bare `/showtime-by-movies?id=6276` (no slug
   * segment). Only the slugged form has been confirmed to load the specific
   * movie's date/showtime page reliably - the slug-less form has been
   * observed leading the booking app to bounce back to the homepage instead
   * of rendering "Select Date" / "Select Cinemas & Time" for that movie.
   */
  private static readonly slugPathPattern = /\/showtime-by-movies\/\d+\/[^/?]+/;

  /**
   * Finds the first movie on the homepage that is currently available for
   * booking (i.e. has a visible, enabled "Buy Now" link that actually points
   * at the booking application) - rather than depending on any specific
   * title, which can rotate off the site at any time. A small number of
   * "Buy Now"-labelled links on the homepage point at unrelated pages (e.g.
   * a film-festival microsite), so those are skipped even if visible/enabled.
   *
   * When both a slugged and a slug-less "Buy Now" link exist for the same
   * movie, the slugged one is preferred (see `slugPathPattern` above) since
   * it is the only form confirmed to reliably load that movie's booking
   * page. The slug-less form is kept only as a fallback, in case a future
   * homepage layout stops rendering the carousel's slugged links entirely.
   */
  async findAvailableMovie() {
    const links = this.buyNowLinks();
    const count = await links.count();
    expect(count, 'Expected at least one "Buy Now" link on the GSC homepage').toBeGreaterThan(0);

    let fallback: ReturnType<typeof links.nth> | undefined;

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      if (!(await link.isVisible()) || !(await link.isEnabled())) continue;

      const href = (await link.getAttribute('href')) ?? '';
      if (!urls.bookingAppHostPattern.test(href)) continue;

      if (GscHomePage.slugPathPattern.test(href)) {
        return link;
      }
      fallback ??= link;
    }

    if (fallback) {
      return fallback;
    }

    throw new Error(
      'No currently bookable movie was found on the GSC homepage (all "Buy Now" links were hidden or disabled).'
    );
  }

  /**
   * Selects an available movie and follows its "Buy Now" link into the
   * booking application.
   *
   * GSC renders these links inside an auto-playing hero carousel (Swiper),
   * which continuously repositions slides on a timer. That makes a physical
   * pointer click flaky by nature: Playwright's click-retry loop can land
   * exactly as the carousel slides a *different* slide over the same screen
   * coordinates ("subtree intercepts pointer events"), and because the
   * carousel never stops moving, retries never converge. Restricting the
   * search to a specific "safe" section of the page does not reliably avoid
   * this either, since GSC repeats the same movie list in multiple places
   * (including inside the very carousel we're trying to avoid).
   *
   * Rather than fight the animation, this reads the link's real `href` (and
   * `target`) - static data GSC itself rendered on a link we already
   * verified is visible and enabled - and navigates there directly. This is
   * behaviourally identical to what a real click would do (including
   * following it into a new tab when `target="_blank"`, which is how GSC
   * opens the separate booking application), without depending on the
   * element staying still long enough to be clicked.
   *
   * @returns the Page object the booking app is now showing, and the movie
   *          title as reported by the booking app itself (read from its own
   *          page heading, which is more reliable than trying to scrape the
   *          title back out of the homepage carousel markup).
   */
  async selectAvailableMovie(): Promise<{ bookingPage: Page; movieTitle: string }> {
    const buyNowLink = await this.findAvailableMovie();

    await expect(buyNowLink).toBeVisible();
    await expect(buyNowLink).toBeEnabled();

    const href = await buyNowLink.getAttribute('href');
    if (!href) {
      throw new Error('The selected "Buy Now" link has no href attribute.');
    }
    const opensNewTab = (await buyNowLink.getAttribute('target')) === '_blank';
    const destination = new URL(href, this.page.url()).toString();

    const bookingPage = opensNewTab ? await this.page.context().newPage() : this.page;
    await bookingPage.goto(destination);
    await bookingPage.waitForLoadState('domcontentloaded');
    await bookingPage.waitForURL(urls.bookingAppHostPattern, { timeout: 30_000 });

    // The booking app renders the movie title as the first heading on the
    // showtime-selection page (e.g. "CHELOT").
    const titleHeading = bookingPage.getByRole('heading').first();
    await expect(titleHeading).toBeVisible({ timeout: 20_000 });
    const movieTitle = (await titleHeading.textContent())?.trim() ?? '';
    expect(movieTitle.length, 'Expected the booking app to display a movie title').toBeGreaterThan(0);

    return { bookingPage, movieTitle };
  }
}
