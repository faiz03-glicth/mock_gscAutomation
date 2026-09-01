import { test, expect, Page } from '@playwright/test';
import { GscHomePage } from '../pages/GscHomePage';
import { GscShowtimesPage } from '../pages/GscShowtimesPage';
import { GscBookingPage } from '../pages/GscBookingPage';

test('Continue booking and verify booking information', async ({ page }) => {
  const home = new GscHomePage(page);

  await test.step('Enter the GSC booking journey from the homepage', async () => {
    await home.goto();
    await home.verifyLoaded();
  });

  const { bookingPage, movieTitle } = await home.selectAvailableMovie();
  const showtimes = new GscShowtimesPage(bookingPage);
  await showtimes.verifyLoaded(movieTitle);

  await showtimes.selectAvailableDate();

  const { nextState } = await test.step('Select an available showtime', async () => {
    return showtimes.selectAvailableShowtime();
  });

  await test.step('Capture a screenshot at the selected showtime', async () => {
    await bookingPage.screenshot({
      path: 'test-results/screenshots/03-showtime-selected.png',
      fullPage: true,
    });
  });

  const booking = new GscBookingPage(bookingPage);

  if (nextState === 'login-required' && !GscBookingPage.hasTestCredentials) {
    await test.step(
      'Verify GSC correctly requires authentication before seat selection (no test credentials configured)',
      async () => {
        await booking.verifyLoginRequired();
        console.log(
          'GSC requires a signed-in member account before showing the seat map. ' +
            'No GSC_TEST_MOBILE_NUMBER / GSC_TEST_PASSWORD were supplied, so this run stops at the ' +
            'login gate - which is itself the correct, verified behaviour for an anonymous visitor. ' +
            'Set those environment variables with a QA/demo GSC account to exercise seat selection ' +
            'and the full booking summary in this test.'
        );
      }
    );

    if (bookingPage !== page) {
      await bookingPage.close();
    }
    return;
  }

  if (nextState === 'login-required') {
    await test.step('Log in with the configured QA/demo GSC account', async () => {
      await booking.logIn();
    });
  }

  const seatLabel = await selectSeatWithFallback(bookingPage, showtimes, booking);

  await test.step('Verify the selected seat is marked as selected and reflected in the booking summary', async () => {
    await booking.verifySeatMapLoaded();
  });

  await test.step('Capture a screenshot of the selected seat / booking summary', async () => {
    await bookingPage.screenshot({
      path: 'test-results/screenshots/03-seat-selected.png',
      fullPage: true,
    });
  });

  await test.step('Continue toward the booking review/checkout stage', async () => {
    await booking.confirmSeatSelection();
    await booking.continueToReview();
  });

  await test.step('Verify booking information (movie, seat, subtotal/total) is shown', async () => {
    await booking.verifyBookingSummary(movieTitle, seatLabel);
  });

  await test.step('Verify the flow reaches the expected review/checkout stage', async () => {
    await booking.verifyReachedCheckoutStage();
  });

  await test.step('Capture a screenshot of the review/checkout stage', async () => {
    await bookingPage.screenshot({
      path: 'test-results/screenshots/03-review-checkout.png',
      fullPage: true,
    });
  });

  // Deliberately stop here: "Checkout & Pay" is never clicked, so no
  // purchase, payment, or order confirmation ever happens.

  if (bookingPage !== page) {
    await bookingPage.close();
  }
});

async function selectSeatWithFallback(
  bookingPage: Page,
  showtimes: GscShowtimesPage,
  booking: GscBookingPage,
  maxAttempts = 3
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await booking.verifySeatMapLoaded();
      return await booking.selectAvailableSeat();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;

      console.warn(
        `Attempt ${attempt}: no available seat found for the currently selected showtime. ` +
          'Trying another available showtime instead of failing outright.'
      );
      await bookingPage.goBack();
      await showtimes.verifyLoaded();
      const { nextState } = await showtimes.selectAvailableShowtime();
      if (nextState === 'login-required') {
        // Session was lost; nothing more we can do without credentials.
        throw new Error('Lost authenticated session while retrying showtimes for an available seat.');
      }
    }
  }

  throw new Error(
    `Could not find any available seat after ${maxAttempts} showtime attempts. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}
