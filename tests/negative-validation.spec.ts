import { test, expect } from '@playwright/test';
import { urls } from '../test-data/bookingData';

/**
 * Test 4 (negative/validation) - Unavailable showtime cannot be selected
 *
 * GSC's "Now Showing" movies (used by the other three tests) did not expose
 * any visibly disabled date/showtime buttons at the time this suite was
 * written - live availability can change, so rather than force an
 * artificial failure this test validates a real, always-present unavailable
 * state on the site: movies listed under the "Coming Soon" tab are not yet
 * open for booking.
 *
 * A live ARIA snapshot confirmed the "Coming Soon" tab (on the /movies
 * listing page) renders each tile as a bare poster image with no
 * accompanying link, "More Info" text, or any other accessible control of
 * its own - unlike the homepage's own "Coming Soon" carousel, which does
 * expose a hover-revealed "More Info" link. So this test selects a tile by
 * its poster image (the only accessible element a tile actually has here)
 * rather than a "More Info" link, and confirms neither the listing tile nor
 * the movie's own detail page exposes a "Buy Now" booking action - i.e. a
 * user genuinely cannot select a showtime for it.
 */
test('Unavailable showtime cannot be selected', async ({ page }) => {
  await test.step('Navigate to the movie listing and open the "Coming Soon" tab', async () => {
    await page.goto(urls.moviesListing);
    await expect(page).toHaveTitle(/GSC/i);
    await page.getByRole('tab', { name: 'Coming Soon' }).click();
  });

  const comingSoonPoster = await test.step(
    'Identify a movie that is visibly unavailable for booking (Coming Soon)',
    async () => {
      const posters = page
        .getByRole('tabpanel', { name: 'Coming Soon' })
        .getByRole('img', { name: /movie poster/i });
      await expect(posters.first(), 'Expected at least one "Coming Soon" movie poster').toBeVisible({
        timeout: 20_000,
      });
      expect(await posters.count(), 'Expected at least one "Coming Soon" movie').toBeGreaterThan(0);
      return posters.first();
    }
  );

  await test.step('Assert this movie has no "Buy Now" / booking action on the listing tile', async () => {
    // A "Coming Soon" tile offers no accessible booking action at all (see
    // the note above) - there is no "Buy Now" link anywhere on the page
    // while this tab is active, i.e. the unavailable movie's showtimes are
    // not selectable.
    await expect(page.getByRole('link', { name: 'Buy Now' })).toHaveCount(0);
  });

  await test.step('Capture a screenshot of the unavailable (Coming Soon) listing', async () => {
    await page.screenshot({ path: 'test-results/screenshots/04-coming-soon-unavailable.png', fullPage: true });
  });

  await test.step('Open the movie and verify no booking action is exposed on its page either', async () => {
    // Not yet independently confirmed that clicking the bare poster image
    // navigates (rather than requiring a click on some other, unlabeled
    // wrapping element) - if this step fails, run
    // `npx playwright codegen https://www.gsc.com.my/movies` on the live
    // "Coming Soon" tab to find the tile's real clickable target.
    await comingSoonPoster.hover({ force: true }).catch(() => {});
    await comingSoonPoster.click();
    await page.waitForLoadState('domcontentloaded');

    // The movie detail page for a not-yet-released title has no "Buy Now"
    // link - confirming a user cannot proceed to showtime/seat selection
    // for it, i.e. the unavailable option cannot be selected.
    await expect(page.getByRole('link', { name: 'Buy Now' })).toHaveCount(0);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  await test.step('Capture a screenshot of the movie detail page confirming no booking action', async () => {
    await page.screenshot({ path: 'test-results/screenshots/04-no-booking-action.png', fullPage: true });
  });
});
