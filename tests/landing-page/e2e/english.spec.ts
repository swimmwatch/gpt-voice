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

test.describe('English responsive accessibility', () => {
  test('avoids horizontal overflow from 320 to 1440 pixels', async ({ page }) => {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ height: 900, width });
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-landing-enhanced', 'true');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
      ).toBe(false);
    }
  });

  test('keeps reveal content visible when reduced motion is requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-landing-enhanced', 'true');
    await expect(page.locator('html')).not.toHaveAttribute('data-landing-reveal', 'true');

    const revealTargets = page.locator('[data-landing-reveal]');
    expect(await revealTargets.count()).toBeGreaterThan(0);
    for (let index = 0; index < (await revealTargets.count()); index += 1) {
      await expect(revealTargets.nth(index)).toBeVisible();
    }
  });

  test('keeps deep links below the sticky header on mobile', async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });

    for (const anchor of ['#providers', '#how-it-works', '#faq']) {
      await page.goto(`/${anchor}`);
      const offset = await page.evaluate((targetSelector) => {
        const target = document.querySelector(targetSelector);
        const header = document.querySelector('header');
        if (!target || !header) {
          return null;
        }

        return target.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
      }, anchor);

      expect(offset).not.toBeNull();
      expect(offset).toBeGreaterThanOrEqual(0);
    }
  });

  test('keeps mobile navigation operable in forced colors', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-landing-enhanced', 'true');

    const trigger = page.getByRole('button', { name: 'Open navigation' });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(
      false,
    );
  });
});

test.describe('English keyboard interactions', () => {
  test('opens an FAQ disclosure with Enter', async ({ page }) => {
    await page.goto('/#faq');
    await expect(page.locator('html')).toHaveAttribute('data-landing-enhanced', 'true');

    const trigger = page.getByRole('button', { name: 'How do I record and transcribe speech?' });
    const answer = page.getByText('Press F9 to start recording.');
    await expect(answer).not.toBeVisible();
    await trigger.focus();
    await expect(trigger).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(answer).toBeVisible();
  });
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
