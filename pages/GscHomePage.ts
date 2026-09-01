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
