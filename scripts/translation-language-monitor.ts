import { access, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { BrowserContext, Page } from 'playwright-core';
import { createPlaywrightProbeSession } from './translation-language-monitor-adapters';
import {
  PROBE_PROVIDER_IDS,
  getTranslationLanguageMonitorExitCode,
  runTranslationLanguageMonitor,
  serializeTranslationLanguageMonitorReport,
  type ProbeProviderId,
  type ProbeSession,
} from './translation-language-monitor-core';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BASELINE_DIRECTORY = path.join(PROJECT_ROOT, 'docs', 'researches', 'translation-providers', 'baselines');
const DEFAULT_REPORT_PATH = path.join(os.tmpdir(), 'gpt-voice-translation-language-monitor-report.json');
const FIXED_FINGERPRINT = 246_813_579;

function getBundledExecutablePath(): string {
  const bundledDirectory = path.join(PROJECT_ROOT, '.cache', 'cloakbrowser');
  if (process.platform === 'win32') return path.join(bundledDirectory, 'chrome.exe');
  if (process.platform === 'darwin') {
    return path.join(bundledDirectory, 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
  }
  return path.join(bundledDirectory, 'chrome');
}

async function configureCloakBrowser(): Promise<void> {
  const executablePath = getBundledExecutablePath();
  await access(executablePath);
  process.env.CLOAKBROWSER_BINARY_PATH = executablePath;
  process.env.CLOAKBROWSER_AUTO_UPDATE = 'false';
}

async function createSession(providerId: ProbeProviderId): Promise<ProbeSession> {
  await configureCloakBrowser();
  const { launchContext } = await import('cloakbrowser');
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  try {
    context = await launchContext({
      args: [`--fingerprint=${FIXED_FINGERPRINT}`],
      headless: true,
      humanize: true,
      humanPreset: 'careful',
      locale: 'en-US',
      timezone: 'UTC',
    });
    page = await context.newPage();
    const ownedContext = context;
    const ownedPage = page;
    return createPlaywrightProbeSession({
      closeContext: () => ownedContext.close(),
      closePage: async () => {
        if (!ownedPage.isClosed()) await ownedPage.close();
      },
      page: ownedPage,
      providerId,
    });
  } catch {
    await Promise.allSettled([
      page && !page.isClosed() ? page.close() : Promise.resolve(),
      context ? context.close() : Promise.resolve(),
    ]);
    throw new Error('browser-launch-failure');
  }
}

function baselinePath(providerId: ProbeProviderId): string {
  return path.join(BASELINE_DIRECTORY, `${providerId}-2026-07-25.yaml`);
}

function parseReportPath(args: readonly string[]): string {
  if (args.length === 0) return DEFAULT_REPORT_PATH;
  if (args.length === 2 && args[0] === '--report' && args[1].trim()) {
    return path.resolve(args[1]);
  }
  throw new Error('invalid-monitor-arguments');
}

async function main(): Promise<void> {
  let reportPath: string;
  try {
    reportPath = parseReportPath(process.argv.slice(2));
  } catch {
    process.stderr.write('translation-language-monitor: configuration-failure\n');
    process.exitCode = 1;
    return;
  }

  const report = await runTranslationLanguageMonitor({
    createSession,
    loadBaseline: (providerId) => readFile(baselinePath(providerId), 'utf8'),
  });

  try {
    await writeFile(reportPath, serializeTranslationLanguageMonitorReport(report), {
      encoding: 'utf8',
      mode: 0o600,
    });
  } catch {
    process.stderr.write('translation-language-monitor: report-write-failure\n');
    process.exitCode = 1;
    return;
  }

  for (const providerId of PROBE_PROVIDER_IDS) {
    const result = report.results.find((candidate) => candidate.providerId === providerId);
    process.stdout.write(`${providerId}: ${result?.status ?? 'probe-failure'}\n`);
  }
  process.exitCode = getTranslationLanguageMonitorExitCode(report);
}

void main().catch(() => {
  process.stderr.write('translation-language-monitor: internal-failure\n');
  process.exitCode = 1;
});
