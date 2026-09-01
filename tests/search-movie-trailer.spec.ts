import { test } from '@playwright/test';
import { GscHomePage } from '../pages/GscHomePage';
import { GscBookingPage } from '../pages/GscBookingPage';
import { GscMovieDetailPage } from '../pages/GscMovieDetailPage';

/**
 * Test - Search for a movie and play its trailer
 *
 * Searches the GSC site for "doom", taps the "Avengers: Doomsday" result,
 * opens its trailer, lets it play for ~5 seconds, pauses it, then stops
 * (closes) it.
 *
 * Note: the search control and trailer player are matched by accessible-name
 * patterns (see GscHomePage.searchMovies()/openSearchResult() and
 * GscMovieDetailPage), not yet confirmed against the live site. If a step
 * fails, run `npx playwright codegen https://www.gsc.com.my/` against the
 * real page to find the actual markup and adjust the relevant locator.
 */
test('Search for a movie and play its trailer', async ({ page }) => {
  const home = new GscHomePage(page);
  const booking = new GscBookingPage(page);
  const movie = new GscMovieDetailPage(page);

  await test.step('Open the GSC homepage', async () => {
    await home.goto();
    await home.verifyLoaded();
  });

  await test.step('Dismiss the reward-journey promo if GSC shows it', async () => {
    await booking.dismissRewardModal();
  });

  await test.step('Search for "doom"', async () => {
    await home.searchMovies('doom');
  });

  await test.step('Tap the "Avengers: Doomsday" search result', async () => {
    await home.openSearchResult(/Avengers:\s*Doomsday/i);
  });

  await test.step('Open the trailer', async () => {
    await movie.openTrailer();
  });

  await test.step('Let the trailer play for ~5 seconds, then pause it', async () => {
    await movie.playThenPause(5_000);
  });

  await test.step('Capture a screenshot of the paused trailer', async () => {
    await page.screenshot({ path: 'test-results/screenshots/05-trailer-paused.png', fullPage: true });
  });

  await test.step('Stop the trailer', async () => {
    await movie.stopTrailer();
  });
});
