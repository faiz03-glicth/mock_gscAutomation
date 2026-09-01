import { test, expect } from '@playwright/test';
import { GscHomePage } from '../pages/GscHomePage';
import { GscShowtimesPage } from '../pages/GscShowtimesPage';

/**
 * Test 1 - Browse and select an available movie/cinema
 *
 * Verifies a visitor can land on the GSC homepage, discover a movie that is
 * currently available for booking (rather than a hard-coded title), select
 * it, and land on a showtime-selection screen that is ready for the next
 * booking step (date/cinema/time selection).
 */
test('Browse and select an available movie/cinema', async ({ page }) => {
  const home = new GscHomePage(page);

  await test.step('Navigate to the GSC homepage and verify it has loaded', async () => {
    await home.goto();
    await home.verifyLoaded();
  });

  const { bookingPage, movieTitle } = await test.step(
    'Select a movie that is currently available for booking',
    async () => {
      return home.selectAvailableMovie();
    }
  );

  const showtimes = new GscShowtimesPage(bookingPage);

  await test.step('Verify the selected movie information is displayed', async () => {
    await showtimes.verifyLoaded(movieTitle);
    await expect(bookingPage.getByRole('heading').first()).toHaveText(movieTitle);
  });

  await test.step('Capture a screenshot at this checkpoint', async () => {
    await bookingPage.screenshot({
      path: 'test-results/screenshots/01-movie-selected.png',
      fullPage: true,
    });
  });

  await test.step('Assert that the next booking step (cinema/date/showtime selection) is available', async () => {
    await expect(bookingPage.getByRole('heading', { name: 'Select Date' })).toBeVisible();
    await expect(bookingPage.getByRole('heading', { name: 'Select Cinemas & Time' })).toBeVisible();

    // Each cinema listed under "Select Cinemas & Time" renders its name as
    // its own <h3> heading (e.g. "Kuala Lumpur - Aurum, The Exchange TRX") -
    // GSC does not wrap the list in an ARIA "region" landmark, so this
    // checks for that heading directly rather than scoping to one, the same
    // approach GscShowtimesPage now uses. The cinema list populates a
    // moment after the heading itself appears, so this waits for the first
    // heading rather than counting immediately.
    const cinemaHeadings = bookingPage.getByRole('heading', { level: 3 });
    await expect(cinemaHeadings.first()).toBeVisible({ timeout: 20_000 });
    expect(await cinemaHeadings.count()).toBeGreaterThan(0);

    const firstShowtime = await showtimes.findAvailableShowtime();
    await expect(firstShowtime).toBeEnabled();
  });

  if (bookingPage !== page) {
    await bookingPage.close();
  }
});
