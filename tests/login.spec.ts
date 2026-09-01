import { test, expect } from '@playwright/test';
import { GscHomePage } from '../pages/GscHomePage';
import { GscBookingPage } from '../pages/GscBookingPage';

/**
 * Test - Log in to a GSC account
 *
 * Standalone login coverage: open the homepage, click its "Sign In" / "Login"
 * control, then insert credentials into the login form that appears. This is
 * separate from the other flows, which reach the same login form indirectly
 * (by trying to select a showtime while unauthenticated).
 *
 * GSC's "Sign In" link points at a different origin
 * (epaymentwebapp.gsc.com.my), which GSC opens in a new tab - the same
 * pattern its "Buy Now" links use. `GscHomePage.clickSignIn()` follows that
 * link explicitly and returns whichever Page ends up showing the login
 * form, so this test operates on that returned page rather than assuming
 * it's still the original `page`.
 *
 * Note: the homepage's Sign In control is matched by an accessible-name
 * pattern (see `GscHomePage.clickSignIn()`), not yet independently confirmed
 * beyond the one live run that surfaced this bug. If a step still fails, run
 * `npx playwright codegen https://www.gsc.com.my/` to find the control's
 * real role/name and adjust the pattern in GscHomePage.ts.
 *
 * Without GSC_TEST_MOBILE_NUMBER / GSC_TEST_PASSWORD configured, this
 * verifies - with a real assertion, not a skip - that the login form is
 * shown, and stops there. With those environment variables set to a GSC
 * account you control, it fills them in and verifies the login form closes.
 */
test('Log in to a GSC account', async ({ page }) => {
  const home = new GscHomePage(page);

  await test.step('Open the GSC homepage', async () => {
    await home.goto();
    await home.verifyLoaded();
  });

  await test.step('Dismiss the reward-journey promo if GSC shows it', async () => {
    await new GscBookingPage(page).dismissRewardModal();
  });

  const loginPage = await test.step('Click Sign In', async () => {
    return home.clickSignIn();
  });

  const booking = new GscBookingPage(loginPage);

  await test.step('Verify the login form is shown', async () => {
    await booking.verifyLoginRequired();
  });

  if (!GscBookingPage.hasTestCredentials) {
    console.log(
      'No GSC_TEST_MOBILE_NUMBER / GSC_TEST_PASSWORD were supplied, so this run stops at the login ' +
        'form - which is itself the correct, verified behaviour for an anonymous visitor. Set those ' +
        'environment variables with a QA/demo GSC account to also exercise a real login in this test.'
    );
    if (loginPage !== page) {
      await loginPage.close();
    }
    return;
  }

  await test.step('Insert credentials and log in', async () => {
    await booking.logInFromLoginForm();
  });

  await test.step('Capture a screenshot of the post-login state', async () => {
    await loginPage.screenshot({ path: 'test-results/screenshots/00-login-success.png', fullPage: true });
  });

  await test.step('Verify the login form is gone', async () => {
    await expect(loginPage.getByRole('heading', { name: 'Log In' })).not.toBeVisible();
  });

  if (loginPage !== page) {
    await loginPage.close();
  }
});
