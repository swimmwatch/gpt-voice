import { expect, test } from '@playwright/test';

const landingUrl = 'http://127.0.0.1:4173/gpt-voice/';

test('keeps the English demo and navigation usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { height: 844, width: 390 },
  });
  const page = await context.newPage();

  try {
    await page.goto(landingUrl);

    const video = page.locator('[data-demo-video]');
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/gpt-voice/generated/icons/gpt-voice.svg');
    await expect(video).toHaveAttribute('preload', 'none');
    await expect(video).toHaveAttribute('controls');
    await expect(video).toHaveAttribute('poster', '/gpt-voice/generated/media/demo-poster.webp');
    await expect(video.locator('track[kind="captions"]')).toHaveAttribute(
      'src',
      '/gpt-voice/generated/captions/en.vtt',
    );
    await expect(page.locator('.mobile-navigation-no-js')).toBeVisible();
    await expect(page.locator('[data-demo-visual-note]')).toHaveCount(9);
    await expect(page.locator('.demo-transcript [data-slot="accordion-content"]')).toBeVisible();
  } finally {
    await context.close();
  }
});

test.describe('English mobile enhancement', () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test('hydrates the mobile sheet and returns focus after Escape', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-landing-enhanced', 'true');

    const trigger = page.getByRole('button', { name: 'Open navigation' });
    await expect(trigger).toBeVisible();
    await expect(page.locator('.mobile-navigation-no-js')).toBeHidden();

    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('FAQ');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('keeps mobile navigation usable when hydration cannot load', async ({ page }) => {
    let hydrationBlocked = false;
    await page.route('**/assets/hydrate-*.js', async (route) => {
      hydrationBlocked = true;
      await route.abort();
    });

    await page.goto('/');
    await expect.poll(() => hydrationBlocked).toBe(true);

    const fallback = page.locator('.mobile-navigation-no-js');
    await expect(fallback).toBeVisible();
    await fallback.locator('summary').click();
    await expect(fallback.getByRole('link', { name: 'FAQ' })).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-landing-enhanced', 'true');
  });

  test('loads the enhanced player without remote assets', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-landing-enhanced', 'true');
    await page.locator('[data-demo-video]').scrollIntoViewIfNeeded();
    await expect(page.locator('.plyr')).toBeVisible();
    await page.waitForTimeout(100);

    const landingOrigin = new URL(landingUrl).origin;
    expect(requests.filter((url) => new URL(url).origin !== landingOrigin)).toEqual([]);
  });

  test('keeps native video controls when the player enhancement cannot load', async ({ page }) => {
    let playerChunkBlocked = false;
    await page.route('**/assets/plyr-*.js', async (route) => {
      playerChunkBlocked = true;
      await route.abort();
    });

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-landing-enhanced', 'true');
    await page.locator('[data-demo-video]').scrollIntoViewIfNeeded();
    await expect.poll(() => playerChunkBlocked).toBe(true);
    await expect(page.locator('[data-demo-video]')).toHaveAttribute('controls');
    await expect(page.locator('.plyr')).toHaveCount(0);
  });
});
