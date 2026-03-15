import * as fs from 'fs';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { BrowserContext, Page } from 'playwright';
import { BROWSER_CACHE_DIR, currentProvider, setProvider } from './config';
import { createProvider, type BaseVoiceProvider } from './providers';
import { createLogger } from './logger';

const log = createLogger('browser');

chromium.use(StealthPlugin());

let bgContext: BrowserContext | null = null;
let translatePage: Page | null = null;
let activeProvider: BaseVoiceProvider | null = null;
let bgReady = false;

export function isBgReady(): boolean {
  return bgReady;
}

export function getTranslatePage(): Page | null {
  return translatePage;
}

export function getActiveProvider(): BaseVoiceProvider | null {
  return activeProvider;
}

export function findChrome(): string {
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return '';
}

export function getLaunchOptions() {
  const executablePath = findChrome();
  const opts: Record<string, unknown> = {
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--no-sandbox',
      '--disable-hang-monitor',
      '--disable-client-side-phishing-detection',
      '--disable-component-update',
      '--disable-domain-reliability',
      '--disable-features=TranslateUI,AudioServiceOutOfProcess',
    ],
  };
  if (executablePath) {
    opts.executablePath = executablePath;
  } else {
    opts.channel = 'chrome';
  }
  return opts;
}

async function initTranslatePage(context: BrowserContext): Promise<void> {
  translatePage = await context.newPage();
  log.info('Navigating to Google Translate...');
  await translatePage.goto('https://translate.google.ru/?sl=auto&tl=en&op=translate', {
    waitUntil: 'networkidle',
  });

  // Handle Google cookie consent if redirected
  if (translatePage.url().includes('consent.google')) {
    log.info('Cookie consent detected, accepting...');
    const acceptBtn = translatePage.locator(
      'button:has-text("Accept all"), button:has-text("Принять все"), button:has-text("Alle akzeptieren")',
    );
    try {
      await acceptBtn.first().click({ timeout: 5000 });
      await translatePage.waitForURL('**/translate.google.*', { timeout: 10000 });
      await translatePage.waitForLoadState('networkidle');
    } catch {
      log.warn('Could not auto-accept consent, retrying navigation...');
      await translatePage.goto('https://translate.google.ru/?sl=auto&tl=en&op=translate', {
        waitUntil: 'networkidle',
      });
    }
  }
  log.info('Google Translate page loaded');
}

export async function initBackgroundBrowser(): Promise<void> {
  // Create provider from config
  activeProvider = createProvider(currentProvider);

  if (!activeProvider.hasSession()) {
    log.info('No session file, skipping background browser init');
    return;
  }

  try {
    log.info('Launching persistent background browser...');
    const launchOpts = getLaunchOptions();
    bgContext = await chromium.launchPersistentContext(BROWSER_CACHE_DIR, {
      ...launchOpts,
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    // Load session cookies and initialize provider page
    await activeProvider.loadSession(bgContext);
    await activeProvider.initPage(bgContext);

    // Google Translate page
    await initTranslatePage(bgContext);

    bgReady = true;
    log.info('Background browser ready');
  } catch (err: unknown) {
    log.error('Init error:', err instanceof Error ? err.message : err);
    await shutdownBackgroundBrowser();
  }
}

export async function shutdownBackgroundBrowser(): Promise<void> {
  bgReady = false;
  if (activeProvider) {
    await activeProvider.shutdown();
  }
  translatePage = null;
  if (bgContext) {
    try {
      log.info('Shutting down background browser...');
      await bgContext.close();
      log.info('Background browser closed');
    } catch {
      /* ignore */
    }
    bgContext = null;
  }
}

export async function ensureBackgroundBrowser(): Promise<void> {
  if (bgReady && bgContext && activeProvider?.getPage()) return;
  await initBackgroundBrowser();
}

export async function switchProvider(providerId: string): Promise<void> {
  setProvider(providerId);
  await shutdownBackgroundBrowser();
  await initBackgroundBrowser();
}

export { chromium };
