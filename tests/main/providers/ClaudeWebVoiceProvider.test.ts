/* eslint-disable max-classes-per-file -- Focused provider fakes stay beside the lifecycle matrix they support. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { BrowserContext, Page, Route } from 'playwright-core';
import {
  ClaudeWebVoiceProvider,
  ClaudeWebVoiceProviderErrorCode,
  inspectClaudeWebReadiness,
  type ClaudeWebPageTransportLike,
  type ClaudeWebReadinessSnapshot,
  type ClaudeWebVoiceProviderDependencies,
} from '@main/providers/ClaudeWebVoiceProvider';
import {
  ClaudeWebPageTransportError,
  ClaudeWebPageTransportErrorCode,
  type ClaudeWebPageTransportDiagnostics,
  type ClaudeWebPageTransportInput,
} from '@main/providers/claudeWebPageTransport';
import {
  CLAUDE_WEB_ORIGIN,
  CLAUDE_WEB_SESSION_SCHEMA_VERSION,
  DEFAULT_CLAUDE_WEB_ACCOUNT_SCOPE,
  resolveClaudeWebOrganization,
  type ClaudeWebAccountScope,
  type ClaudeWebOrganizationContext,
  type ClaudeWebSessionReadResult,
} from '@main/providers/claudeWebSession';
import { CLAUDE_WEB_SPEECH_PROTOCOL_VERSION } from '@main/providers/claudeWebProtocol';
import { CLAUDE_WEB_PCM_CHUNK_BYTES, CLAUDE_WEB_PCM_SAMPLE_RATE_HZ } from '@main/providers/claudeWebAudio';
import { CLAUDE_WEB_PROVIDER_ID, type ClaudeWebSettings } from '@shared/claudeWebSettings';
import { WAV_TRANSCRIPTION_MIME_TYPE, WEBM_OPUS_TRANSCRIPTION_MIME_TYPE } from '@shared/transcriptionConstants';
import { t } from '@main/i18n';

const SYNTHETIC_ORGANIZATION_UUID = '11111111-2222-4333-8444-555555555555';
const SYNTHETIC_ORIGIN_STORAGE = [{ name: 'synthetic-state', value: 'synthetic-value' }];

const USABLE_SESSION: Extract<ClaudeWebSessionReadResult, { status: 'usable' }> = {
  status: 'usable',
  state: {
    schemaVersion: CLAUDE_WEB_SESSION_SCHEMA_VERSION,
    cookies: [
      {
        name: 'synthetic-session',
        value: 'synthetic-value',
        domain: 'claude.ai',
        path: '/',
        expires: 4_000_000_000,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ],
    origins: [{ origin: CLAUDE_WEB_ORIGIN, localStorage: SYNTHETIC_ORIGIN_STORAGE }],
  },
};

const READY_SNAPSHOT: ClaudeWebReadinessSnapshot = {
  authenticated: true,
  featureAvailable: true,
  organizationEvidence: {
    activeOrganizationCandidates: [SYNTHETIC_ORGANIZATION_UUID],
    eligibleOrganizations: [{ uuid: SYNTHETIC_ORGANIZATION_UUID }],
  },
};

interface FakeRouteResult {
  aborted: number;
  continued: number;
}

class FakePageTransport implements ClaudeWebPageTransportLike {
  readonly inputs: ClaudeWebPageTransportInput[] = [];
  cancelCalls = 0;
  shutdownCalls = 0;
  result = 'synthetic final';
  error: Error | null = null;
  onShutdown: (() => void) | null = null;

  async transcribe(input: ClaudeWebPageTransportInput): Promise<string> {
    this.inputs.push(input);
    if (this.error) throw this.error;
    return this.result;
  }

  async cancel(): Promise<void> {
    this.cancelCalls += 1;
  }

  async shutdown(): Promise<void> {
    this.shutdownCalls += 1;
    this.onShutdown?.();
  }
}

class FakePage {
  closed = false;
  routeHandler: ((route: Route) => unknown) | null = null;

  async route(_pattern: string, handler: (route: Route) => unknown): Promise<void> {
    this.routeHandler = handler;
  }

  isClosed(): boolean {
    return this.closed;
  }

  runRoute(resourceType: string): FakeRouteResult {
    if (!this.routeHandler) throw new Error('Route handler was not configured');
    const result: FakeRouteResult = { aborted: 0, continued: 0 };
    const route = {
      abort: async () => {
        result.aborted += 1;
      },
      continue: async () => {
        result.continued += 1;
      },
      request: () => ({ resourceType: () => resourceType }),
    } as unknown as Route;
    void this.routeHandler(route);
    return result;
  }
}

class FakeBrowserContext {
  readonly addedCookies: unknown[][] = [];
  readonly initScripts: Array<{ argument: unknown; script: unknown }> = [];
  storage = { cookies: USABLE_SESSION.state.cookies, origins: USABLE_SESSION.state.origins };

  constructor(readonly page: FakePage) {}

  async newPage(): Promise<Page> {
    return this.page as unknown as Page;
  }

  async addCookies(cookies: unknown[]): Promise<void> {
    this.addedCookies.push(cookies);
  }

  async addInitScript(script: unknown, argument?: unknown): Promise<void> {
    this.initScripts.push({ script, argument });
  }

  async storageState() {
    return this.storage;
  }
}

interface ProviderHarness {
  provider: ClaudeWebVoiceProvider;
  page: FakePage;
  context: FakeBrowserContext;
  transport: FakePageTransport;
  state: {
    session: ClaudeWebSessionReadResult;
    snapshot: ClaudeWebReadinessSnapshot;
    settings: ClaudeWebSettings;
    clearCalls: number;
    clipboardWrites: string[];
    navigationCalls: number;
    readinessRetryDelays: number[];
    savedStates: unknown[];
    transportCreations: number;
  };
}

function createHarness(overrides: Partial<ClaudeWebVoiceProviderDependencies> = {}): ProviderHarness {
  const page = new FakePage();
  const context = new FakeBrowserContext(page);
  const transport = new FakePageTransport();
  const state = {
    session: USABLE_SESSION as ClaudeWebSessionReadResult,
    snapshot: READY_SNAPSHOT,
    settings: { language: 'en-US' },
    clearCalls: 0,
    clipboardWrites: [] as string[],
    navigationCalls: 0,
    readinessRetryDelays: [] as number[],
    savedStates: [] as unknown[],
    transportCreations: 0,
  };
  const dependencies: ClaudeWebVoiceProviderDependencies = {
    getSettings: () => state.settings,
    readSession: () => state.session,
    saveSession: (storageState) => {
      state.savedStates.push(storageState);
      state.session = USABLE_SESSION;
      return USABLE_SESSION.state;
    },
    clearSession: () => {
      state.clearCalls += 1;
      state.session = { status: 'missing' };
      return true;
    },
    getStorageState: (session) => ({ cookies: session.cookies, origins: session.origins }),
    resolveOrganization: resolveClaudeWebOrganization,
    inspectReadiness: async () => state.snapshot,
    createTransport: () => {
      state.transportCreations += 1;
      return transport;
    },
    writeClipboardText: (text) => state.clipboardWrites.push(text),
    navigatePage: async () => {
      state.navigationCalls += 1;
    },
    waitForReadinessRetry: async (delayMs) => {
      state.readinessRetryDelays.push(delayMs);
    },
    ...overrides,
  };
  return {
    provider: new ClaudeWebVoiceProvider(dependencies),
    page,
    context,
    transport,
    state,
  };
}

function createPcm16Wav(samples: readonly number[] = [0, 1, -1, 2]): ArrayBuffer {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, CLAUDE_WEB_PCM_SAMPLE_RATE_HZ, true);
  view.setUint32(28, CLAUDE_WEB_PCM_SAMPLE_RATE_HZ * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, sample, true));
  return buffer;
}

async function initialize(harness: ProviderHarness): Promise<void> {
  await harness.provider.initPage(harness.context as unknown as BrowserContext);
}

function transportError(code: ClaudeWebPageTransportErrorCode): ClaudeWebPageTransportError {
  const diagnostics: ClaudeWebPageTransportDiagnostics = {
    phase: 'replaying',
    eventType: null,
    bytesSent: 2,
    eventCount: 0,
    durationMs: 1,
    closeCode: null,
  };
  return new ClaudeWebPageTransportError(code, diagnostics);
}

describe('ClaudeWebVoiceProvider', () => {
  it('derives active routing from current-access traffic and eligible organizations from bootstrap memberships', async () => {
    const originalDescriptors = new Map(
      ['window', 'document', 'performance', 'fetch'].map((name) => [
        name,
        Object.getOwnPropertyDescriptor(globalThis, name),
      ]),
    );
    const requestedPaths: string[] = [];
    Object.defineProperties(globalThis, {
      window: {
        configurable: true,
        value: { location: { href: `${CLAUDE_WEB_ORIGIN}/new` } },
      },
      document: {
        configurable: true,
        value: {
          querySelectorAll: () => [
            {
              getAttribute: (name: string) => (name === 'aria-label' ? 'Press and hold to record' : null),
            },
          ],
        },
      },
      performance: {
        configurable: true,
        value: {
          getEntriesByType: () => [
            {
              name: `${CLAUDE_WEB_ORIGIN}/api/bootstrap/${SYNTHETIC_ORGANIZATION_UUID}/current_user_access`,
            },
          ],
        },
      },
      fetch: {
        configurable: true,
        value: async (input: string | URL | Request) => {
          requestedPaths.push(String(input));
          return {
            ok: true,
            json: async () => ({
              account: {
                memberships: [
                  { organization: { uuid: SYNTHETIC_ORGANIZATION_UUID, privateLabel: 'not returned' } },
                  { organization: { uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' } },
                ],
              },
            }),
          } as Response;
        },
      },
    });

    try {
      const page = {
        evaluate: async <T, A>(operation: (argument: A) => Promise<T>, argument: A): Promise<T> => operation(argument),
      } as unknown as Page;
      assert.deepEqual(await inspectClaudeWebReadiness(page), {
        authenticated: true,
        featureAvailable: true,
        organizationEvidence: {
          activeOrganizationCandidates: [SYNTHETIC_ORGANIZATION_UUID],
          eligibleOrganizations: [
            { uuid: SYNTHETIC_ORGANIZATION_UUID },
            { uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' },
          ],
        },
      });
      assert.equal(requestedPaths.length, 1);
      assert.equal(requestedPaths[0]?.startsWith('/edge-api/bootstrap?'), true);
      assert.equal(requestedPaths[0]?.includes('/api/organizations'), false);
    } finally {
      for (const [name, descriptor] of originalDescriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    }
  });

  it('initializes a browser-session provider with safe blocking, navigation, and no access token', async () => {
    const harness = createHarness();
    await initialize(harness);

    assert.deepEqual(harness.provider.info, {
      id: CLAUDE_WEB_PROVIDER_ID,
      name: 'Claude Web',
      authType: 'browserSession',
      category: 'web',
      hasSettings: true,
      loginUrl: CLAUDE_WEB_ORIGIN,
    });
    assert.equal(harness.provider.isReady(), true);
    assert.equal(harness.provider.getAccessToken(), '');
    assert.equal(harness.state.navigationCalls, 1);
    assert.equal(harness.state.transportCreations, 1);
    assert.deepEqual(harness.page.runRoute('image'), { aborted: 1, continued: 0 });
    assert.deepEqual(harness.page.runRoute('script'), { aborted: 0, continued: 1 });
    assert.deepEqual(harness.page.runRoute('websocket'), { aborted: 0, continued: 1 });
  });

  it('waits for delayed Claude SPA feature and organization readiness during startup', async () => {
    const snapshots: ClaudeWebReadinessSnapshot[] = [
      {
        authenticated: true,
        featureAvailable: false,
        organizationEvidence: {
          activeOrganizationCandidates: [],
          eligibleOrganizations: [
            { uuid: SYNTHETIC_ORGANIZATION_UUID },
            { uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' },
          ],
        },
      },
      {
        authenticated: true,
        featureAvailable: true,
        organizationEvidence: {
          activeOrganizationCandidates: [],
          eligibleOrganizations: [
            { uuid: SYNTHETIC_ORGANIZATION_UUID },
            { uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' },
          ],
        },
      },
      READY_SNAPSHOT,
    ];
    let inspectionIndex = 0;
    const harness = createHarness({
      inspectReadiness: async () => snapshots[Math.min(inspectionIndex++, snapshots.length - 1)] ?? READY_SNAPSHOT,
    });

    await initialize(harness);

    assert.equal(harness.provider.isReady(), true);
    assert.equal(harness.provider.getReadinessError(), null);
    assert.equal(inspectionIndex, 3);
    assert.deepEqual(harness.state.readinessRetryDelays, [500, 500]);
    assert.equal(JSON.stringify(harness.provider.getReadinessError()).includes(SYNTHETIC_ORGANIZATION_UUID), false);
  });

  it('stops readiness polling at the startup bound and preserves the final Claude error', async () => {
    const harness = createHarness();
    harness.state.snapshot = { ...READY_SNAPSHOT, featureAvailable: false };

    await initialize(harness);

    assert.equal(harness.provider.isReady(), false);
    assert.equal(harness.provider.getReadinessError(), t('error.claudeWeb.feature-unavailable'));
    assert.equal(harness.state.readinessRetryDelays.length, 20);
    assert.equal(
      harness.state.readinessRetryDelays.reduce((total, delayMs) => total + delayMs, 0),
      10_000,
    );
    assert.equal(harness.provider.getReadinessError()?.includes(SYNTHETIC_ORGANIZATION_UUID), false);
  });

  it('handles fresh, restored, missing, expired, malformed, and cleared sessions', async () => {
    const harness = createHarness();
    harness.state.session = { status: 'missing' };
    assert.equal(harness.provider.hasSession(), false);
    assert.equal(harness.state.clearCalls, 0);

    await harness.provider.saveSession(harness.context as unknown as BrowserContext);
    assert.deepEqual(harness.state.savedStates, [harness.context.storage]);
    assert.equal(harness.provider.hasSession(), true);

    assert.equal(await harness.provider.loadSession(harness.context as unknown as BrowserContext), true);
    assert.deepEqual(harness.context.addedCookies, [USABLE_SESSION.state.cookies]);
    assert.equal(harness.context.initScripts.length, 1);
    assert.deepEqual(harness.context.initScripts[0]?.argument, {
      entries: SYNTHETIC_ORIGIN_STORAGE,
      expectedOrigin: CLAUDE_WEB_ORIGIN,
    });

    harness.state.session = { status: 'expired' };
    assert.equal(await harness.provider.loadSession(harness.context as unknown as BrowserContext), false);
    assert.equal(harness.state.clearCalls, 1);

    harness.state.session = { status: 'malformed' };
    assert.equal(harness.provider.hasSession(), false);
    assert.equal(harness.state.clearCalls, 2);

    harness.state.session = USABLE_SESSION;
    harness.provider.clearSession();
    assert.equal(harness.state.clearCalls, 3);
    assert.equal(harness.provider.hasSession(), false);
  });

  it('keeps missing and malformed sessions unready without inventing a token', async () => {
    for (const session of [{ status: 'missing' }, { status: 'malformed' }] as const) {
      const harness = createHarness();
      harness.state.session = session;
      await initialize(harness);
      assert.equal(harness.provider.isReady(), false);
      assert.equal(harness.provider.getAccessToken(), '');
    }
  });

  it('revalidates expiry before transcription and never opens a socket for it', async () => {
    const harness = createHarness();
    await initialize(harness);
    harness.state.session = { status: 'expired' };

    assert.deepEqual(await harness.provider.transcribe(createPcm16Wav(), WAV_TRANSCRIPTION_MIME_TYPE), {
      success: false,
      error: ClaudeWebVoiceProviderErrorCode.SessionExpired,
    });
    assert.equal(harness.provider.isReady(), false);
    assert.equal(harness.transport.inputs.length, 0);
  });

  it('maps invalid settings and unreadable session state without opening a socket', async () => {
    const invalidSettings = createHarness({
      getSettings: () => {
        throw new Error('synthetic settings failure');
      },
    });
    await initialize(invalidSettings);
    assert.deepEqual(await invalidSettings.provider.transcribe(createPcm16Wav(), WAV_TRANSCRIPTION_MIME_TYPE), {
      success: false,
      error: ClaudeWebVoiceProviderErrorCode.InvalidSettings,
    });
    assert.equal(invalidSettings.transport.inputs.length, 0);

    const unreadableSession = createHarness({
      readSession: () => {
        throw new Error('synthetic session failure');
      },
    });
    await initialize(unreadableSession);
    assert.deepEqual(await unreadableSession.provider.transcribe(createPcm16Wav(), WAV_TRANSCRIPTION_MIME_TYPE), {
      success: false,
      error: ClaudeWebVoiceProviderErrorCode.SessionInvalid,
    });
    assert.equal(unreadableSession.transport.inputs.length, 0);
  });

  it('keeps unauthenticated and feature-unavailable pages unready without socket work', async () => {
    const cases = [
      {
        snapshot: { ...READY_SNAPSHOT, authenticated: false },
        code: ClaudeWebVoiceProviderErrorCode.SessionExpired,
      },
      {
        snapshot: { ...READY_SNAPSHOT, featureAvailable: false },
        code: ClaudeWebVoiceProviderErrorCode.FeatureUnavailable,
      },
    ] as const;

    for (const testCase of cases) {
      const harness = createHarness();
      harness.state.snapshot = testCase.snapshot;
      await initialize(harness);
      assert.equal(harness.provider.isReady(), false);
      assert.deepEqual(await harness.provider.transcribe(createPcm16Wav(), WAV_TRANSCRIPTION_MIME_TYPE), {
        success: false,
        error: testCase.code,
      });
      assert.equal(harness.transport.inputs.length, 0);
    }
  });

  it('routes exactly one active organization with unknown, personal, and organization scope identically', async () => {
    for (const accountScope of [
      'unknown',
      'personal',
      'organization',
    ] as const satisfies readonly ClaudeWebAccountScope[]) {
      const harness = createHarness({
        resolveOrganization: (evidence): ClaudeWebOrganizationContext => ({
          ...resolveClaudeWebOrganization(evidence),
          accountScope,
        }),
      });
      await initialize(harness);

      const result = await harness.provider.transcribe(createPcm16Wav(), WAV_TRANSCRIPTION_MIME_TYPE);
      assert.deepEqual(result, { success: true, text: 'synthetic final' });
      assert.equal(harness.transport.inputs.length, 1);
      assert.equal(harness.transport.inputs[0]?.organizationUuid, SYNTHETIC_ORGANIZATION_UUID);
    }
    assert.equal(DEFAULT_CLAUDE_WEB_ACCOUNT_SCOPE, 'unknown');
  });

  it('fails missing and ambiguous routing before opening a socket or exposing metadata', async () => {
    const cases: ReadonlyArray<{
      candidates: readonly string[];
      organizations: readonly { uuid: string }[];
      code: ClaudeWebVoiceProviderErrorCode;
    }> = [
      { candidates: [], organizations: [], code: ClaudeWebVoiceProviderErrorCode.OrganizationMissing },
      {
        candidates: [SYNTHETIC_ORGANIZATION_UUID, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'],
        organizations: [{ uuid: SYNTHETIC_ORGANIZATION_UUID }, { uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }],
        code: ClaudeWebVoiceProviderErrorCode.OrganizationAmbiguous,
      },
    ];

    for (const testCase of cases) {
      const harness = createHarness();
      harness.state.snapshot = {
        ...READY_SNAPSHOT,
        organizationEvidence: {
          activeOrganizationCandidates: testCase.candidates,
          eligibleOrganizations: testCase.organizations,
        },
      };
      await initialize(harness);
      const result = await harness.provider.transcribe(createPcm16Wav(), WAV_TRANSCRIPTION_MIME_TYPE);
      assert.deepEqual(result, { success: false, error: testCase.code });
      assert.equal(JSON.stringify(result).includes(SYNTHETIC_ORGANIZATION_UUID), false);
      assert.equal(harness.transport.inputs.length, 0);
    }
  });

  it('extracts valid WAV PCM, uses the current language, and writes final text exactly once', async () => {
    const harness = createHarness();
    harness.state.settings = { language: 'fr-FR' };
    await initialize(harness);

    const result = await harness.provider.transcribe(createPcm16Wav([3, -4, 5]), WAV_TRANSCRIPTION_MIME_TYPE);
    assert.deepEqual(result, { success: true, text: 'synthetic final' });
    assert.equal(harness.transport.inputs.length, 1);
    assert.deepEqual(Array.from(harness.transport.inputs[0]?.pcm ?? []), [3, 0, 252, 255, 5, 0]);
    assert.equal(harness.transport.inputs[0]?.language, 'fr-FR');
    assert.deepEqual(harness.state.clipboardWrites, ['synthetic final']);
  });

  it('rejects compressed and malformed audio without conversion or transport work', async () => {
    const harness = createHarness();
    await initialize(harness);

    assert.deepEqual(await harness.provider.transcribe(new ArrayBuffer(8), WEBM_OPUS_TRANSCRIPTION_MIME_TYPE), {
      success: false,
      error: ClaudeWebVoiceProviderErrorCode.InvalidAudio,
    });
    assert.deepEqual(await harness.provider.transcribe(new ArrayBuffer(8), WAV_TRANSCRIPTION_MIME_TYPE), {
      success: false,
      error: ClaudeWebVoiceProviderErrorCode.InvalidAudio,
    });
    assert.equal(harness.transport.inputs.length, 0);
  });

  it('keeps cache context result-specific and free of account, URL, and session state', () => {
    const harness = createHarness();
    const first = harness.provider.getTranscriptionCacheContext();
    harness.state.settings = { language: 'de-DE' };
    harness.state.snapshot = {
      ...READY_SNAPSHOT,
      organizationEvidence: {
        activeOrganizationCandidates: ['aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'],
        eligibleOrganizations: [{ uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }],
      },
    };
    const second = harness.provider.getTranscriptionCacheContext();

    assert.notDeepEqual(first, second);
    assert.equal(second.includes(String(CLAUDE_WEB_SPEECH_PROTOCOL_VERSION)), true);
    assert.equal(second.includes(String(CLAUDE_WEB_PCM_CHUNK_BYTES)), true);
    const serialized = JSON.stringify(second);
    for (const forbidden of ['organization', 'session', 'account', 'uuid', 'https://', SYNTHETIC_ORGANIZATION_UUID]) {
      assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false);
    }
  });

  it('maps every transport failure through the provider error enum without replay', async () => {
    const expectedProviderCodes: Readonly<Record<ClaudeWebPageTransportErrorCode, ClaudeWebVoiceProviderErrorCode>> = {
      [ClaudeWebPageTransportErrorCode.UpgradeOrAuth]: ClaudeWebVoiceProviderErrorCode.UpgradeOrAuth,
      [ClaudeWebPageTransportErrorCode.ConnectTimeout]: ClaudeWebVoiceProviderErrorCode.ConnectTimeout,
      [ClaudeWebPageTransportErrorCode.ConnectionLoss]: ClaudeWebVoiceProviderErrorCode.ConnectionLoss,
      [ClaudeWebPageTransportErrorCode.MalformedEvent]: ClaudeWebVoiceProviderErrorCode.MalformedEvent,
      [ClaudeWebPageTransportErrorCode.RateLimit]: ClaudeWebVoiceProviderErrorCode.RateLimit,
      [ClaudeWebPageTransportErrorCode.FirstEventTimeout]: ClaudeWebVoiceProviderErrorCode.FirstEventTimeout,
      [ClaudeWebPageTransportErrorCode.OverallTimeout]: ClaudeWebVoiceProviderErrorCode.OverallTimeout,
      [ClaudeWebPageTransportErrorCode.DrainTimeout]: ClaudeWebVoiceProviderErrorCode.DrainTimeout,
      [ClaudeWebPageTransportErrorCode.EmptyResult]: ClaudeWebVoiceProviderErrorCode.EmptyResult,
      [ClaudeWebPageTransportErrorCode.Cancelled]: ClaudeWebVoiceProviderErrorCode.Cancelled,
      [ClaudeWebPageTransportErrorCode.PageShutdown]: ClaudeWebVoiceProviderErrorCode.PageShutdown,
    };
    const cases = Object.values(ClaudeWebPageTransportErrorCode).map((transportCode) => ({
      transportCode,
      providerCode: expectedProviderCodes[transportCode],
    }));

    for (const testCase of cases) {
      const harness = createHarness();
      await initialize(harness);
      harness.transport.error = transportError(testCase.transportCode);
      assert.deepEqual(await harness.provider.transcribe(createPcm16Wav(), WAV_TRANSCRIPTION_MIME_TYPE), {
        success: false,
        error: testCase.providerCode,
      });
      assert.equal(harness.transport.inputs.length, 1);
      assert.deepEqual(harness.state.clipboardWrites, []);
    }
  });

  it('delegates cancellation and drains transport before clearing base page references on shutdown', async () => {
    const harness = createHarness();
    await initialize(harness);
    await harness.provider.cancelTranscription();
    assert.equal(harness.transport.cancelCalls, 1);

    let pagePresentDuringTransportShutdown = false;
    harness.transport.onShutdown = () => {
      pagePresentDuringTransportShutdown = harness.provider.getPage() !== null;
    };
    await harness.provider.shutdown();

    assert.equal(pagePresentDuringTransportShutdown, true);
    assert.equal(harness.transport.shutdownCalls, 1);
    assert.equal(harness.provider.getPage(), null);
    assert.equal(harness.provider.isReady(), false);
  });
});
