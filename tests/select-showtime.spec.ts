import { test, expect } from '@playwright/test';
import { GscHomePage } from '../pages/GscHomePage';
import { GscShowtimesPage } from '../pages/GscShowtimesPage';
import { GscBookingPage } from '../pages/GscBookingPage';

/**
 * Test 2 - Select available date and showtime
 *
 * Starts independently from the GSC homepage, selects a currently available
 * movie, then inspects the real "Select Date" and showtime controls to pick
 * an enabled date and an enabled showtime - never assuming today's date or
 * any specific time (e.g. "7:30 PM") is bookable.
 *
 * GSC requires a signed-in member account before it will show the seat map,
 * so choosing a showtime lands on one of two screens: the seat map directly
 * (already-authenticated session) or a "Log In" screen (anonymous session).
 * This test logs in when a QA/demo account is configured via
 * GSC_TEST_MOBILE_NUMBER / GSC_TEST_PASSWORD (see test-data/bookingData.ts
 * and .env.example), so the flow reaches the seat map either way. Without
 * credentials configured, it verifies - with a real assertion, not a skip -
 * that GSC correctly requires authentication, which is itself genuine,
 * current site behaviour worth confirming.
 */
test('Select available date and showtime', async ({ page }) => {
  const home = new GscHomePage(page);

  await test.step('Start from the GSC homepage and select an available movie', async () => {
    await home.goto();
    await home.verifyLoaded();
  });

  const { bookingPage, movieTitle } = await home.selectAvailableMovie();
  const showtimes = new GscShowtimesPage(bookingPage);
  await showtimes.verifyLoaded(movieTitle);

  const selectedDateLabel = await test.step('Inspect available dates and select an enabled one', async () => {
    const label = await showtimes.selectAvailableDate();
    expect(label.length, 'Expected the selected date button to have a visible label').toBeGreaterThan(0);
    return label;
  });

  const { label: selectedShowtimeLabel, nextState } = await test.step(
    'Inspect available showtimes and select an enabled one',
    async () => {
      return showtimes.selectAvailableShowtime();
    }
  );

  await test.step('Capture a screenshot after selecting the showtime', async () => {
    await bookingPage.screenshot({
      path: 'test-results/screenshots/02-showtime-selected.png',
      fullPage: true,
    });
  });

  await test.step('Verify the selected date/showtime is reflected in the booking journey', async () => {
    expect(selectedShowtimeLabel, 'Expected a showtime label to have been captured').toMatch(
      /\d{1,2}:\d{2}\s?(AM|PM)/i
    );
    console.log(
      `Selected date "${selectedDateLabel}" and showtime "${selectedShowtimeLabel}" for "${movieTitle}".`
    );
  });

  const booking = new GscBookingPage(bookingPage);

  await test.step('Assert that the flow can continue to the next booking step', async () => {
    // GSC requires a signed-in member before showing seats, so the "next
    // step" is genuinely one of two screens - both confirm the showtime
    // selection was accepted and the booking journey advanced.
    if (nextState === 'seat-selection') {
      await expect(bookingPage.getByText('Seat(s) Selection', { exact: false })).toBeVisible();
    } else {
      await booking.verifyLoginRequired();
    }
  });

  if (nextState === 'login-required' && GscBookingPage.hasTestCredentials) {
    await test.step('Log in with the configured QA/demo GSC account', async () => {
      await booking.logIn();
      await booking.verifySeatMapLoaded();
    });
  } else if (nextState === 'login-required') {
    console.log(
      'GSC requires a signed-in member account before showing the seat map. ' +
        'No GSC_TEST_MOBILE_NUMBER / GSC_TEST_PASSWORD were supplied, so this run stops at the ' +
        'login gate - which is itself the correct, verified behaviour for an anonymous visitor.'
    );
  }

  if (bookingPage !== page) {
    await bookingPage.close();
  }
});
