import { spawn, type ChildProcess } from 'node:child_process';
import { get } from 'node:http';
import { createServer } from 'node:net';
import { setTimeout as wait } from 'node:timers/promises';

import { chromium, type Browser, type Page } from 'playwright-core';

const CONNECTION_TIMEOUT_MILLISECONDS = 60_000;
const CONNECTION_RETRY_MILLISECONDS = 200;
const ENDPOINT_REQUEST_TIMEOUT_MILLISECONDS = 1_000;
const PROCESS_TERMINATION_TIMEOUT_MILLISECONDS = 5_000;
const KNOWN_PREDECESSOR_PROVIDERS = Object.freeze(['chatgpt', 'claude-web', 'openai-api'] as const);

export interface LinuxPredecessorApplicationSessionInput {
  readonly cacheRoot: string;
  readonly configurationRoot: string;
  readonly dataRoot: string;
  readonly executablePath: string;
  readonly executionMarkerPath: string;
  readonly homeRoot: string;
  readonly temporaryRoot: string;
}

export interface LinuxPredecessorApplicationSessionResult {
  readonly initialProvider: 'local-whisper';
  readonly initialReady: false;
  readonly knownProviders: readonly ['chatgpt', 'claude-web', 'openai-api'];
  readonly recoveredProvider: 'openai-api';
}

export interface LinuxPredecessorApplicationSessionPort {
  readonly run: (input: LinuxPredecessorApplicationSessionInput) => Promise<LinuxPredecessorApplicationSessionResult>;
}

interface PredecessorRendererApi {
  readonly getActiveProvider: () => Promise<unknown>;
  readonly getBgBrowserStatus: () => Promise<unknown>;
  readonly getProviders: () => Promise<unknown>;
  readonly isBgReady: () => Promise<unknown>;
  readonly setActiveProvider: (providerId: string) => Promise<unknown>;
}

interface RendererProbe {
  readonly activeProvider: unknown;
  readonly backgroundStatus: unknown;
  readonly providers: unknown;
  readonly ready: unknown;
}

async function probeRenderer(): Promise<RendererProbe | null> {
  const candidate = (globalThis as { electronAPI?: unknown }).electronAPI;
  if (typeof candidate !== 'object' || candidate === null) return null;
  const record = candidate as Readonly<Record<string, unknown>>;
  if (
    typeof record.getActiveProvider !== 'function' ||
    typeof record.getBgBrowserStatus !== 'function' ||
    typeof record.getProviders !== 'function' ||
    typeof record.isBgReady !== 'function' ||
    typeof record.setActiveProvider !== 'function'
  ) {
    return null;
  }
  const api = candidate as PredecessorRendererApi;
  const [activeProvider, backgroundStatus, providers, ready] = await Promise.all([
    api.getActiveProvider(),
    api.getBgBrowserStatus(),
    api.getProviders(),
    api.isBgReady(),
  ]);
  return { activeProvider, backgroundStatus, providers, ready };
}

function providerIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) throw new Error('Predecessor provider chooser response invalid');
  const ids = value.map((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error('Predecessor provider chooser response invalid');
    }
    const id = (entry as Readonly<Record<string, unknown>>).id;
    if (typeof id !== 'string') throw new Error('Predecessor provider chooser response invalid');
    return id;
  });
  if (new Set(ids).size !== ids.length) throw new Error('Predecessor provider chooser response invalid');
  return Object.freeze(ids.sort((left, right) => left.localeCompare(right, 'en')));
}

function assertInitialBehavior(probe: RendererProbe): void {
  const status = probe.backgroundStatus;
  if (typeof status !== 'object' || status === null || Array.isArray(status)) {
    throw new Error('Predecessor background status invalid');
  }
  const background = status as Readonly<Record<string, unknown>>;
  if (
    probe.activeProvider !== 'local-whisper' ||
    probe.ready !== false ||
    background.providerId !== 'local-whisper' ||
    background.ready !== false ||
    JSON.stringify(providerIds(probe.providers)) !== JSON.stringify(KNOWN_PREDECESSOR_PROVIDERS)
  ) {
    throw new Error('Predecessor Local Whisper compatibility behavior changed');
  }
}

async function allocateLoopbackPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string' || address.address !== '127.0.0.1') {
    server.close();
    throw new Error('Predecessor debugging port allocation failed');
  }
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function discoverCdpWebSocket(port: number): Promise<string | null> {
  const bytes = await new Promise<Buffer>((resolve, reject) => {
    const request = get(
      {
        host: '127.0.0.1',
        path: '/json/version',
        port,
        timeout: ENDPOINT_REQUEST_TIMEOUT_MILLISECONDS,
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          resolve(Buffer.alloc(0));
          return;
        }
        const chunks: Buffer[] = [];
        let byteLength = 0;
        response.on('data', (chunk: Buffer) => {
          byteLength += chunk.byteLength;
          if (byteLength > 64 * 1024) {
            request.destroy(new Error('Predecessor CDP metadata exceeded its bound'));
            return;
          }
          chunks.push(Buffer.from(chunk));
        });
        response.once('end', () => resolve(Buffer.concat(chunks)));
        response.once('error', reject);
      },
    );
    request.once('timeout', () => request.destroy(new Error('Predecessor CDP metadata timed out')));
    request.once('error', reject);
  }).catch(() => Buffer.alloc(0));
  if (bytes.byteLength === 0) return null;
  try {
    const value = JSON.parse(bytes.toString('utf8')) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const endpoint = (value as Readonly<Record<string, unknown>>).webSocketDebuggerUrl;
    if (typeof endpoint !== 'string') return null;
    const url = new URL(endpoint);
    if (url.protocol !== 'ws:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || Number(url.port) !== port) {
      return null;
    }
    url.hostname = '127.0.0.1';
    return url.toString();
  } catch {
    return null;
  }
}

async function connectToOwnedApplication(port: number, child: ChildProcess): Promise<Browser> {
  const deadline = Date.now() + CONNECTION_TIMEOUT_MILLISECONDS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error('Predecessor application exited before renderer inspection');
    }
    try {
      const endpoint = await discoverCdpWebSocket(port);
      if (endpoint) return await chromium.connectOverCDP(endpoint, { timeout: ENDPOINT_REQUEST_TIMEOUT_MILLISECONDS });
      await wait(CONNECTION_RETRY_MILLISECONDS);
    } catch {
      await wait(CONNECTION_RETRY_MILLISECONDS);
    }
  }
  throw new Error('Predecessor renderer inspection timed out');
}

async function findRendererPage(browser: Browser): Promise<{ readonly page: Page; readonly probe: RendererProbe }> {
  const deadline = Date.now() + CONNECTION_TIMEOUT_MILLISECONDS;
  while (Date.now() < deadline) {
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        try {
          const probe = await page.evaluate(probeRenderer);
          if (probe) return Object.freeze({ page, probe });
        } catch {
          // The renderer may still be navigating; retry only inside this bounded session.
        }
      }
    }
    await wait(CONNECTION_RETRY_MILLISECONDS);
  }
  throw new Error('Predecessor renderer API was not available');
}

async function terminateOwnedProcessGroup(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const pid = child.pid;
  if (!pid) throw new Error('Predecessor process identity unavailable');
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  try {
    process.kill(-pid, 'SIGTERM');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    return;
  }
  const terminated = await Promise.race([
    exited.then(() => true),
    wait(PROCESS_TERMINATION_TIMEOUT_MILLISECONDS).then(() => false),
  ]);
  if (terminated) return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
  await exited;
}

/** Runs the exact predecessor AppImage in a private profile and inspects only its preload API. */
export class LinuxPredecessorElectronSession implements LinuxPredecessorApplicationSessionPort {
  public async run(input: LinuxPredecessorApplicationSessionInput): Promise<LinuxPredecessorApplicationSessionResult> {
    const debuggingPort = await allocateLoopbackPort();
    const child = spawn(
      '/usr/bin/xvfb-run',
      [
        '-a',
        '--server-args=-screen 0 1280x800x24 -nolisten tcp',
        input.executablePath,
        '--no-sandbox',
        '--disable-gpu',
        '--remote-debugging-address=127.0.0.1',
        `--remote-debugging-port=${debuggingPort}`,
      ],
      {
        cwd: input.temporaryRoot,
        detached: true,
        env: {
          HOME: input.homeRoot,
          XDG_CACHE_HOME: input.cacheRoot,
          XDG_CONFIG_HOME: input.configurationRoot,
          XDG_DATA_HOME: input.dataRoot,
          TMPDIR: input.temporaryRoot,
          LOCAL_WHISPER_EXECUTION_MARKER: input.executionMarkerPath,
          LANG: 'C.UTF-8',
          LC_ALL: 'C.UTF-8',
          PATH: '/usr/bin:/bin',
          NO_PROXY: '127.0.0.1,localhost',
          no_proxy: '127.0.0.1,localhost',
        },
        shell: false,
        stdio: 'ignore',
      },
    );
    const spawnFailure = new Promise<never>((_resolve, reject) => child.once('error', reject));
    let browser: Browser | null = null;
    try {
      browser = await Promise.race([connectToOwnedApplication(debuggingPort, child), spawnFailure]);
      const renderer = await findRendererPage(browser);
      assertInitialBehavior(renderer.probe);
      const recovered = await renderer.page.evaluate(async () => {
        const candidate = (globalThis as { electronAPI?: unknown }).electronAPI;
        if (typeof candidate !== 'object' || candidate === null) {
          throw new Error('Predecessor renderer API unavailable');
        }
        const api = candidate as PredecessorRendererApi;
        if (typeof api.setActiveProvider !== 'function' || typeof api.getActiveProvider !== 'function') {
          throw new Error('Predecessor renderer API unavailable');
        }
        await api.setActiveProvider('openai-api');
        return await api.getActiveProvider();
      });
      if (recovered !== 'openai-api') throw new Error('Predecessor provider recovery failed');
      return Object.freeze({
        initialProvider: 'local-whisper',
        initialReady: false,
        knownProviders: KNOWN_PREDECESSOR_PROVIDERS,
        recoveredProvider: 'openai-api',
      });
    } finally {
      await browser?.close().catch(() => undefined);
      await terminateOwnedProcessGroup(child);
    }
  }
}
