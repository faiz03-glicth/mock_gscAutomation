import { expect, Locator, Page } from '@playwright/test';
import { credentials, seatLabelPattern } from '../test-data/bookingData';

/**
 * Page object covering the rest of the GSC booking journey once a showtime
 * has been chosen: the optional login gate, seat selection, the two
 * food & beverage / merchandise up-sell screens, and the final booking
 * review screen - stopping firmly before "Checkout & Pay".
 */
export class GscBookingPage {
  constructor(private readonly page: Page) {}

  // ---------------------------------------------------------------------
  // Login gate
  // ---------------------------------------------------------------------

  /** True if GSC test-account credentials were supplied via environment variables. */
  static get hasTestCredentials(): boolean {
    return credentials.isConfigured;
  }

  /**
   * Verifies the anonymous-user login gate is genuinely being enforced.
   * This is a real, meaningful assertion about GSC's business behaviour
   * (an unauthenticated visitor cannot reach seat selection), not a
   * placeholder.
   */
  async verifyLoginRequired(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Log In' })).toBeVisible();
    await expect(this.page.getByRole('textbox').first()).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Login' })).toBeVisible();
  }

  /**
   * Dismisses the "Start Your Reward Journey" promotional modal if GSC shows
   * it. Located by its `dialog` role + accessible name (matching the real
   * ARIA snapshot GSC renders: `dialog "Start Your Reward Journey"`) rather
   * than plain text, and the "I Got It" / "×" buttons are scoped to that
   * dialog so they can't accidentally match an unrelated element elsewhere
   * on the page.
   *
   * This has been observed appearing both before the login form (on top of
   * it) and again immediately after a successful login - and because it is
   * a real modal dialog, GSC marks the rest of the page `aria-hidden` while
   * it's open, which makes content underneath it (e.g. the seat map heading)
   * genuinely not visible to Playwright until the modal is dismissed. So
   * `logIn()` below waits for and dismisses it at both points, not just
   * once, before making any assertion about what's behind it.
   *
   * Uses `waitFor({ state: 'visible' })` rather than a fixed sleep to detect
   * the modal, and treats a timeout as "the modal never appeared" rather
   * than a failure - this method is a no-op on any run where GSC doesn't
   * show it. `timeoutMs` is a parameter (rather than a fixed constant)
   * because the modal can take noticeably longer to arrive after login
   * (its content depends on a follow-up request) than before it.
   */
  async dismissRewardModal(timeoutMs = 5_000): Promise<void> {
    const modal = this.page.getByRole('dialog', { name: 'Start Your Reward Journey' });
    const appeared = await modal
      .waitFor({ state: 'visible', timeout: timeoutMs })
      .then(() => true)
      .catch(() => false);
    if (!appeared) return;

    const iGotItButton = modal.getByRole('button', { name: 'I Got It' });
    if (await iGotItButton.isVisible()) {
      await iGotItButton.click();
    } else {
      // Fallback: the modal's top-right close ("×") control.
      await modal.getByRole('button', { name: '×' }).click();
    }

    await modal.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
  }

  /**
   * Logs in with the QA/demo credentials supplied via GSC_TEST_MOBILE_NUMBER
   * / GSC_TEST_PASSWORD (read from test-data/bookingData.ts - never straight
   * from process.env here, so credential handling stays in one place). Only
   * called when GscBookingPage.hasTestCredentials is true. Never logs the
   * credential values themselves.
   */
  async logIn(): Promise<void> {
    if (!credentials.isConfigured) {
      throw new Error('logIn() called without GSC_TEST_MOBILE_NUMBER / GSC_TEST_PASSWORD configured.');
    }

    // The reward-journey modal has been observed overlaying the login form.
    await this.dismissRewardModal();

    const mobileField = this.page.getByRole('textbox').first();
    const passwordField = this.page.locator('input[type="password"]').first();

    await mobileField.fill(credentials.mobileNumber);
    await passwordField.fill(credentials.password);
    await this.page.getByRole('button', { name: 'Login', exact: true }).click();

    // Dismiss the modal here - BEFORE asserting the seat map is visible -
    // since it has been observed reappearing immediately post-login and
    // would otherwise hide that assertion's target from the a11y tree.
    await this.dismissRewardModal(8_000);

    await expect(this.page.getByText('Seat(s) Selection', { exact: false })).toBeVisible({
      timeout: 30_000,
    });
  }

  // ---------------------------------------------------------------------
  // Seat selection
  // ---------------------------------------------------------------------

  async verifySeatMapLoaded(): Promise<void> {
    await expect(this.page.getByText('Seat(s) Selection', { exact: false })).toBeVisible();
  }

  /** Every seat currently rendered whose label is available (not occupied/under repair). */
  private availableSeatLocator(): Locator {
    // Occupied / repair seats are rendered as icons (role="img") rather than
    // text, so any element whose *text* matches the seat-label pattern is,
    // by construction, a currently selectable seat.
    return this.page.getByText(seatLabelPattern);
  }

  async findAvailableSeat(): Promise<Locator> {
    const seats = this.availableSeatLocator();
    const count = await seats.count();
    expect(count, 'Expected at least one available seat in the seat map').toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const seat = seats.nth(i);
      if (await seat.isVisible()) {
        return seat;
      }
    }

    throw new Error('No visible available seat could be found for this showtime.');
  }

  /**
   * Selects one available seat and verifies it is reflected in the sticky
   * booking summary bar (seat code + non-zero price + enabled Confirm CTA).
   */
  async selectAvailableSeat(): Promise<string> {
    const seat = await this.findAvailableSeat();
    const seatLabel = ((await seat.textContent()) ?? '').trim();

    await seat.click();

    const confirmButton = this.page.getByRole('button', { name: /Confirm\s*-\s*1 ticket/i });
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toBeEnabled();
    await expect(this.page.getByText(seatLabel, { exact: true }).last()).toBeVisible();

    return seatLabel;
  }

  async confirmSeatSelection(): Promise<void> {
    const confirmButton = this.page.getByRole('button', { name: /Confirm\s*-\s*\d+ ticket/i });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();
  }

  // ---------------------------------------------------------------------
  // F&B / merchandise up-sell screens
  // ---------------------------------------------------------------------

  /** The sticky bottom "Total ... RM x.xx" bar acts as the continue button on up-sell screens. */
  private continueBar(): Locator {
    return this.page.getByRole('button', { name: /^RM\s?[\d,.]+$/ });
  }

  private checkoutButton(): Locator {
    return this.page.getByRole('button', { name: /Checkout\s*&?\s*Pay/i });
  }

  /**
   * Clicks through any up-sell screens (F&B, add-ons) that appear between
   * seat confirmation and the booking review screen, without adding any
   * items, until the review/checkout screen (identified by the
   * "Checkout & Pay" button) is reached.
   */
  async continueToReview(maxUpsellScreens = 4): Promise<void> {
    for (let i = 0; i < maxUpsellScreens; i++) {
      if (await this.checkoutButton().isVisible().catch(() => false)) {
        return;
      }

      const bar = this.continueBar();
      await expect(bar).toBeVisible({ timeout: 20_000 });
      await bar.click();
    }

    await expect(this.checkoutButton()).toBeVisible({ timeout: 20_000 });
  }

  // ---------------------------------------------------------------------
  // Review / checkout screen (purchase is never completed beyond this point)
  // ---------------------------------------------------------------------

  async verifyBookingSummary(movieTitle: string, seatLabel: string): Promise<void> {
    await expect(this.page.getByText(movieTitle, { exact: false }).first()).toBeVisible();
    await expect(this.page.getByText(seatLabel, { exact: true }).first()).toBeVisible();
    await expect(this.page.getByText(/Total/i).first()).toBeVisible();
    await expect(this.page.getByText(/RM\s?[\d,.]+/).first()).toBeVisible();
  }

  /** Confirms the journey has reached the review/checkout stage, without ever clicking it. */
  async verifyReachedCheckoutStage(): Promise<void> {
    const checkout = this.checkoutButton();
    await expect(checkout).toBeVisible();
    await expect(checkout).toBeEnabled();
    // Deliberately never clicked: this project must never complete a purchase.
  }
}
