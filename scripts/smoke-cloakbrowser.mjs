import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundledDir = path.join(rootDir, '.cache', 'cloakbrowser');
const executablePath =
  process.platform === 'win32'
    ? path.join(bundledDir, 'chrome.exe')
    : process.platform === 'darwin'
      ? path.join(bundledDir, 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
      : path.join(bundledDir, 'chrome');

try {
  await access(executablePath);
  process.env.CLOAKBROWSER_BINARY_PATH = executablePath;
} catch {
  throw new Error(
    `Bundled CloakBrowser executable not found. Run npm run prepare:cloakbrowser first: ${executablePath}`,
  );
}

process.env.CLOAKBROWSER_AUTO_UPDATE = 'false';

const { launch } = await import('cloakbrowser');

const browser = await launch({
  headless: true,
  locale: 'en-US',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  humanize: true,
  humanPreset: 'careful',
  args: ['--fingerprint=12345'],
});

try {
  const page = await browser.newPage();
  await page.goto('data:text/html,<title>CloakBrowser smoke</title><h1>ok</h1>');
  const title = await page.title();
  const webdriver = await page.evaluate(() => navigator.webdriver);

  if (title !== 'CloakBrowser smoke') {
    throw new Error(`Unexpected smoke page title: ${title}`);
  }
  if (webdriver !== false) {
    throw new Error(`Expected navigator.webdriver=false, got ${String(webdriver)}`);
  }

  console.log('CloakBrowser smoke passed');
} finally {
  await browser.close();
}
