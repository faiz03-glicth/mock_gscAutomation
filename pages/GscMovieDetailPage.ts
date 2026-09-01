import { expect, Page } from '@playwright/test';

/**
 * Page object for a GSC movie detail page (reached after selecting a search
 * result or a "More Info" / listing tile), covering its trailer player.
 *
 * The trailer button/player markup has not been independently confirmed
 * against the live site - if a method here fails, run
 * `npx playwright codegen https://www.gsc.com.my/` against a real movie page
 * to find the actual accessible names/roles and adjust the locators below.
 */
export class GscMovieDetailPage {
  constructor(private readonly page: Page) {}

  private trailerTrigger() {
    return this.page
      .getByRole('button', { name: /trailer/i })
      .or(this.page.getByRole('link', { name: /trailer/i }))
      .first();
  }

  /** Opens the trailer (button/link labelled e.g. "Watch Trailer" or "Trailer"). */
  async openTrailer(): Promise<void> {
    const trigger = this.trailerTrigger();
    await expect(trigger, 'Expected a "Trailer" button/link on the movie detail page').toBeVisible({
      timeout: 15_000,
    });
    await trigger.click();
  }

  private nativeVideo() {
    return this.page.locator('video').first();
  }

  /**
   * Lets the trailer play for `playMs`, then pauses it.
   *
   * Supports two common embed shapes:
   *  - A native `<video>` element: controlled directly via `play()` /
   *    `pause()`, with assertions that playback genuinely started and then
   *    genuinely paused (not just "we called pause and hoped").
   *  - An iframe-based embed (e.g. a YouTube/Vimeo player): these typically
   *    autoplay as soon as the trailer overlay opens, and a cross-origin
   *    iframe's own controls aren't reliably scriptable from outside it, so
   *    this simply waits out the requested duration and leaves it playing
   *    for `stopTrailer()` to close.
   *
   * The fixed wait here is a deliberate exception to this project's usual
   * "no page.waitForTimeout()" rule: the test's purpose is literally to
   * observe ~5 seconds of playback, not to wait out flakiness.
   */
  async playThenPause(playMs = 5_000): Promise<void> {
    const video = this.nativeVideo();
    const hasNativeVideo = (await video.count()) > 0 && (await video.isVisible().catch(() => false));

    if (hasNativeVideo) {
      await video.evaluate((el: HTMLVideoElement) => el.play());
      await expect
        .poll(() => video.evaluate((el: HTMLVideoElement) => el.paused), {
          message: 'Expected the trailer to start playing',
          timeout: 10_000,
        })
        .toBe(false);

      await this.page.waitForTimeout(playMs);

      await video.evaluate((el: HTMLVideoElement) => el.pause());
      await expect
        .poll(() => video.evaluate((el: HTMLVideoElement) => el.paused), {
          message: 'Expected the trailer to be paused',
          timeout: 5_000,
        })
        .toBe(true);
      return;
    }

    // Iframe-based embed (e.g. YouTube) - assumed to autoplay on open.
    await this.page.waitForTimeout(playMs);
  }

  private closeControl() {
    return this.page.getByRole('button', { name: /close|×|✕/i }).first();
  }

  /** Stops the trailer: closes its modal/overlay if one exists, else presses Escape. */
  async stopTrailer(): Promise<void> {
    const close = this.closeControl();
    if (await close.isVisible().catch(() => false)) {
      await close.click();
    } else {
      await this.page.keyboard.press('Escape');
    }
  }
}
