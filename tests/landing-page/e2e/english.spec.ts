import { expect, test, type Locator } from '@playwright/test';

const landingUrl = 'http://127.0.0.1:4173/gpt-voice/';
const localizedLandingRoutes = [
  ['en', ''],
  ['ru', 'ru'],
  ['be', 'be'],
  ['uk', 'uk'],
  ['es', 'es'],
  ['pt-BR', 'pt-br'],
  ['zh-CN', 'zh-cn'],
  ['ja', 'ja'],
  ['de', 'de'],
  ['fr', 'fr'],
  ['hi', 'hi'],
] as const;

async function visualState(locator: Locator): Promise<string> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return [
      style.backgroundColor,
      style.borderColor,
      style.boxShadow,
      style.color,
      style.textDecorationColor,
      style.textDecorationThickness,
      style.transform,
    ].join('|');
  });
}

async function animationState(locator: Locator): Promise<string> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return [
      style.animationName,
      style.animationDuration,
      style.animationDelay,
      style.animationTimingFunction,
      style.animationDirection,
      style.animationIterationCount,
    ].join('|');
  });
}

async function expectVisibleHoverChange(control: Locator, visual = control): Promise<void> {
  await control.scrollIntoViewIfNeeded();
  const before = await visualState(visual);
  await control.hover();
  await expect.poll(() => visualState(visual)).not.toBe(before);
}

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
    await expect(page.locator('[data-landing-loader]')).toBeHidden();
    await expect(page.locator('html')).not.toHaveAttribute('data-landing-loading', 'true');
    await expect(page.locator('[data-demo-transcript]')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test.describe('Localized landing routes', () => {
  test('switches from the English landing to the selected Russian landing page', async ({ page }) => {
    await page.goto('/');
    const selector = page.getByRole('button', { name: 'Website language: English' });
    await selector.click();
    await page.getByRole('menuitem', { name: 'Русский' }).click();

    await expect(page).toHaveURL(/\/gpt-voice\/ru\/$/u);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Пишите лучшие AI-запросы быстрее.');
    await expect(page.locator('[data-demo-video] track[kind="captions"]')).toHaveAttribute(
      'src',
      '/gpt-voice/generated/captions/ru.vtt',
    );
    await expect(page.getByRole('link', { name: 'Документация' }).first()).toHaveAttribute(
      'href',
      '/gpt-voice/docs/ru/',
    );
  });

  for (const [tag, routeSlug] of localizedLandingRoutes) {
    test(`serves the ${tag} landing route with its localized subtitle track`, async ({ page }) => {
      const route = routeSlug ? `/gpt-voice/${routeSlug}/` : '/gpt-voice/';
      const documentationRoute = routeSlug ? `/gpt-voice/docs/${routeSlug}/` : '/gpt-voice/docs/';
      const captionSlug = routeSlug || 'en';

      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', tag);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('[data-demo-video] source')).toHaveAttribute('src', /generated\/media\/demo\.mp4/u);
      await expect(page.locator('[data-demo-video] track[kind="captions"]')).toHaveAttribute(
        'src',
        `/gpt-voice/generated/captions/${captionSlug}.vtt`,
      );
      await expect(page.locator('.desktop-navigation').getByRole('link').last()).toHaveAttribute(
        'href',
        documentationRoute,
      );
    });
  }
});

test('keeps the pre-rendered shell covered until hydration and critical assets settle', async ({ page }) => {
  let releaseHydration!: () => void;
  let markHydrationRequested!: () => void;
  const hydrationGate = new Promise<void>((resolve) => {
    releaseHydration = resolve;
  });
  const hydrationRequested = new Promise<void>((resolve) => {
    markHydrationRequested = resolve;
  });

  await page.route('**/assets/hydrate-*.js', async (route) => {
    markHydrationRequested();
    await hydrationGate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const loader = page.locator('[data-landing-loader]');
  const root = page.locator('#root');
  await expect(page.locator('html')).toHaveAttribute('data-landing-loading', 'true');
  await expect(root).toHaveAttribute('aria-busy', 'true');
  await expect(loader).toBeVisible();

  await hydrationRequested;
  releaseHydration();

  await expect(page.locator('html')).toHaveAttribute('data-landing-enhanced', 'true');
  await expect(page.locator('html')).not.toHaveAttribute('data-landing-loading', 'true');
  await expect(root).not.toHaveAttribute('aria-busy', 'true');
  await expect(loader).toBeHidden();
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

  test('uses the provider recording animation for the footer waveform', async ({ page }) => {
    await page.goto('/');

    const providerBars = page.locator('[data-provider-waveform-bar="true"]');
    const footerBars = page.locator('[data-footer-waveform-bar="true"]');
    await expect(providerBars).toHaveCount(31);
    await expect(footerBars).toHaveCount(61);

    const providerAnimation = await animationState(providerBars.nth(15));
    const footerAnimation = await animationState(footerBars.nth(15));
    expect(footerAnimation).toBe(providerAnimation);
    expect(footerAnimation).toContain('provider-waveform-recording');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect
      .poll(() => footerBars.nth(15).evaluate((element) => getComputedStyle(element).animationName))
      .toBe('none');
    await expect.poll(() => footerBars.nth(15).evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  });

  test('routes frequent signal pulses from the microphone to each provider', async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/#providers');

    const routeMap = page.locator('.provider-route-map');
    const pulses = page.locator('.provider-route-pulse');
    await expect(pulses).toHaveCount(6);

    const routeStyles = await routeMap.evaluate((map) => {
      const input = map.querySelector('.provider-route-input') as HTMLElement;
      const provider = map.querySelector('[data-provider-route-path="chatgpt"]') as SVGPathElement;
      return {
        arrow: getComputedStyle(input, '::after').content,
        inputColor: getComputedStyle(input).backgroundColor,
        providerColor: getComputedStyle(provider).stroke,
      };
    });
    expect(routeStyles.arrow).toBe('none');
    expect(routeStyles.inputColor).toBe(routeStyles.providerColor);

    await page.waitForFunction(() => {
      const signalMap = document.querySelector('.provider-signal-map');
      const svg = signalMap?.querySelector('.provider-route-pulses') as SVGSVGElement | null;
      if (!signalMap || !svg || svg.viewBox.baseVal.height === 0) return false;

      const svgRect = svg.getBoundingClientRect();
      const endpointCenter = (pathName: string) => {
        const path = svg.querySelector<SVGPathElement>(`[data-provider-route-path="${pathName}"]`);
        if (!path) return null;
        const point = path.getPointAtLength(path.getTotalLength());
        return svgRect.top + (point.y / svg.viewBox.baseVal.height) * svgRect.height;
      };
      const targetCenter = (targetName: string) => {
        const target = signalMap.querySelector(`[data-provider-route-target="${targetName}"]`);
        if (!target) return null;
        const targetRect = target.getBoundingClientRect();
        return targetRect.top + targetRect.height / 2;
      };

      return ['chatgpt', 'api', 'future'].every((targetName) => {
        const endpoint = endpointCenter(targetName);
        const center = targetCenter(targetName);
        return endpoint !== null && center !== null && Math.abs(endpoint - center) < 1;
      });
    });

    const before = await pulses.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return `${rect.left}|${rect.top}`;
      }),
    );
    await page.waitForTimeout(160);
    const after = await pulses.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return `${rect.left}|${rect.top}`;
      }),
    );

    expect(before.filter((position, index) => position !== after[index])).not.toHaveLength(0);
  });

  test('keeps future provider names whole at narrow widths', async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 320 });
    await page.goto('/#providers');

    const futureProviderNames = page.locator('.provider-future-horizon li strong');
    await expect(futureProviderNames).toHaveText(['Claude Web', 'Gemini Web']);

    const wordLineFragments = await futureProviderNames.evaluateAll((names) =>
      names.map((name) => {
        const text = name.firstChild as Text;
        const firstWordLength = name.textContent?.indexOf(' ') ?? 0;
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, firstWordLength);
        return range.getClientRects().length;
      }),
    );
    expect(wordLineFragments).toEqual([1, 1]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(
      false,
    );
  });

  test('keeps deep links below the sticky header on mobile', async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });

    for (const anchor of ['#providers', '#how-it-works', '#faq']) {
      await page.goto(`/${anchor}`);
      await expect
        .poll(() =>
          page.evaluate((targetSelector) => {
            const target = document.querySelector(targetSelector);
            const header = document.querySelector('header');
            if (!target || !header) {
              return null;
            }

            return target.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
          }, anchor),
        )
        .toBeGreaterThanOrEqual(0);
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

  test('keeps mobile navigation operable with WCAG text spacing', async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-landing-enhanced', 'true');
    await page.addStyleTag({
      content:
        '* { letter-spacing: 0.12em !important; line-height: 1.5 !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
    });

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

  test('exposes a keyboard-focusable demo frame in the native fallback', async ({ page }) => {
    await page.route('**/assets/plyr-*.js', (route) => route.abort());
    await page.goto('/#demo');
    await expect(page.locator('html')).toHaveAttribute('data-landing-enhanced', 'true');

    const frame = page.locator('.demo-video-frame');
    const video = page.locator('[data-demo-video]');
    await expect(page.locator('.plyr')).toHaveCount(0);
    await expect(frame).toHaveAttribute('tabindex', '0');
    await expect(video).toHaveAttribute('tabindex', '0');
  });
});

test.describe('English desktop hover affordances', () => {
  test.use({ viewport: { height: 1000, width: 1440 } });

  test('gives every audited control a distinct hover state and pointer cursor', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const brand = page.locator('.site-brand');
    const language = page.getByRole('button', { name: 'Website language: English' });
    const faq = page.getByRole('button', { name: 'How do I record and transcribe speech?' });
    const faqSurface = page.locator('[data-slot="accordion-item"]').filter({ has: faq });
    const finalCta = page.getByRole('region', { name: 'Write better prompts faster, with less effort.' });
    const footerDocumentation = page.locator('.site-footer-links').getByRole('link', { name: 'Documentation' });

    await expectVisibleHoverChange(brand);
    await expectVisibleHoverChange(language);
    await expectVisibleHoverChange(faq, faqSurface);
    await expectVisibleHoverChange(finalCta.getByRole('link', { name: 'Download latest release' }));
    await expectVisibleHoverChange(finalCta.getByRole('link', { name: 'View source on GitHub' }));
    await expectVisibleHoverChange(footerDocumentation);

    expect(await language.evaluate((element) => getComputedStyle(element).cursor)).toBe('pointer');
    expect(await faq.evaluate((element) => getComputedStyle(element).cursor)).toBe('pointer');
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

  test('dismisses the mobile sheet with its close button and backdrop', async ({ page }) => {
    await page.goto('/');

    const trigger = page.getByRole('button', { name: 'Open navigation' });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Close navigation' }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.locator('[data-slot="sheet-overlay"]').click({ position: { x: 20, y: 400 } });
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
