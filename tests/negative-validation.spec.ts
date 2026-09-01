import { test, expect } from '@playwright/test';
import { urls } from '../test-data/bookingData';

test('Unavailable showtime cannot be selected', async ({ page }) => {
  await test.step('Navigate to the movie listing and open the "Coming Soon" tab', async () => {
    await page.goto(urls.moviesListing);
    await expect(page).toHaveTitle(/GSC/i);
    await page.getByRole('tab', { name: 'Coming Soon' }).click();
  });

  const comingSoonLink = await test.step(
    'Identify a movie that is visibly unavailable for booking (Coming Soon)',
    async () => {
      const links = page.getByRole('link', { name: 'More Info' });
      await expect(links.first()).toBeVisible({ timeout: 20_000 });
      expect(await links.count(), 'Expected at least one "Coming Soon" movie').toBeGreaterThan(0);
      return links.first();
    }
  );

  await test.step('Assert this movie has no "Buy Now" / booking action on the listing tile', async () => {
    // A "Coming Soon" tile offers only "More Info" - there is no "Buy Now"
    // (booking) action available for it anywhere on the page while this tab
    // is active, i.e. the unavailable movie's showtimes are not selectable.
    await expect(page.getByRole('link', { name: 'Buy Now' })).toHaveCount(0);
  });

  await test.step('Capture a screenshot of the unavailable (Coming Soon) listing', async () => {
    await page.screenshot({ path: 'test-results/screenshots/04-coming-soon-unavailable.png', fullPage: true });
  });

  await test.step('Follow "More Info" and verify no booking action is exposed on the movie page either', async () => {

    await comingSoonLink.hover({ force: true });
    await expect(comingSoonLink).toBeVisible({ timeout: 10_000 });
    await comingSoonLink.click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('link', { name: 'Buy Now' })).toHaveCount(0);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  await test.step('Capture a screenshot of the movie detail page confirming no booking action', async () => {
    await page.screenshot({ path: 'test-results/screenshots/04-no-booking-action.png', fullPage: true });
  });
});
