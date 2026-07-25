import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parse, stringify } from 'yaml';
import { isAllowedTranslationProbeLocation } from '../../scripts/translation-language-monitor-adapters';
import {
  PROBE_PROVIDER_IDS,
  ProbeFailure,
  classifyProviderSnapshot,
  diffTranslationLanguages,
  fingerprintTranslationLanguageDiff,
  getTranslationLanguageMonitorExitCode,
  normalizePublicLanguages,
  parseTranslationLanguageBaseline,
  runTranslationLanguageMonitor,
  serializeTranslationLanguageMonitorReport,
  waitForStableInventory,
  type BingProbeSnapshot,
  type GoogleProbeSnapshot,
  type ProbeProviderId,
  type ProbeSession,
  type ProviderProbeSnapshot,
  type PublicLanguage,
  type PublicLanguageCandidate,
  type TranslationLanguageBaseline,
  type YandexProbeSnapshot,
} from '../../scripts/translation-language-monitor-core';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const BASELINE_DIRECTORY = path.join(PROJECT_ROOT, 'docs', 'researches', 'translation-providers', 'baselines');
const EXPECTED_COUNTS: Readonly<Record<ProbeProviderId, number>> = {
  google: 249,
  bing: 179,
  yandex: 118,
};

function baselinePath(providerId: ProbeProviderId): string {
  return path.join(BASELINE_DIRECTORY, `${providerId}-2026-07-25.yaml`);
}

function baselineSource(providerId: ProbeProviderId): string {
  return fs.readFileSync(baselinePath(providerId), 'utf8');
}

function baseline(providerId: ProbeProviderId): TranslationLanguageBaseline {
  return parseTranslationLanguageBaseline(baselineSource(providerId), providerId);
}

function googleSnapshot(
  languages: readonly PublicLanguageCandidate[],
  overrides: Partial<GoogleProbeSnapshot> = {},
): GoogleProbeSnapshot {
  return {
    busy: false,
    challenge: false,
    documentReadyState: 'complete',
    groupCount: 1,
    listboxCount: 1,
    mutationVersion: 0,
    openerCount: 1,
    options: languages,
    originAllowed: true,
    providerId: 'google',
    searchInputCount: 1,
    terminalTraversalComplete: true,
    ...overrides,
  };
}

function bingSnapshot(
  languages: readonly PublicLanguageCandidate[],
  overrides: Partial<BingProbeSnapshot> = {},
): BingProbeSnapshot {
  return {
    busy: false,
    canonicalGroupCount: 1,
    canonicalOptions: languages,
    challenge: false,
    originAllowed: true,
    providerId: 'bing',
    targetSelectCount: 1,
    targetSelectEnabled: true,
    targetSelectVisible: true,
    ...overrides,
  };
}

function yandexSnapshot(
  languages: readonly PublicLanguageCandidate[],
  overrides: Partial<YandexProbeSnapshot> = {},
): YandexProbeSnapshot {
  return {
    busy: false,
    challenge: false,
    openerCount: 1,
    options: languages,
    originAllowed: true,
    providerId: 'yandex',
    searchInputCount: 1,
    ...overrides,
  };
}

function readySnapshot(providerId: ProbeProviderId, languages: readonly PublicLanguage[]): ProviderProbeSnapshot {
  switch (providerId) {
    case 'google':
      return googleSnapshot(languages);
    case 'bing':
      return bingSnapshot(languages);
    case 'yandex':
      return yandexSnapshot(languages);
  }
}

class FakeSession implements ProbeSession {
  closeContextCalls = 0;
  closePageCalls = 0;
  prepareCalls = 0;
  readCalls = 0;

  constructor(
    private readonly snapshots: readonly ProviderProbeSnapshot[],
    private readonly options: {
      readonly closeContextError?: Error;
      readonly closePageError?: Error;
      readonly prepareError?: Error;
      readonly prepareOperation?: () => Promise<void>;
      readonly snapshotFactory?: (readCount: number) => ProviderProbeSnapshot;
    } = {},
  ) {}

  async closeContext(): Promise<void> {
    this.closeContextCalls += 1;
    if (this.options.closeContextError) throw this.options.closeContextError;
  }

  async closePage(): Promise<void> {
    this.closePageCalls += 1;
    if (this.options.closePageError) throw this.options.closePageError;
  }

  async prepare(): Promise<void> {
    this.prepareCalls += 1;
    if (this.options.prepareError) throw this.options.prepareError;
    await this.options.prepareOperation?.();
  }

  async readSnapshot(): Promise<ProviderProbeSnapshot> {
    this.readCalls += 1;
    if (this.options.snapshotFactory) return this.options.snapshotFactory(this.readCalls);
    return this.snapshots[Math.min(this.readCalls - 1, this.snapshots.length - 1)];
  }
}

function fakeClock(): {
  readonly now: () => number;
  readonly sleep: (milliseconds: number) => Promise<void>;
} {
  let current = 0;
  return {
    now: () => current,
    sleep: async (milliseconds) => {
      current += milliseconds;
    },
  };
}

async function runWithSessions(
  sessions: Readonly<Partial<Record<ProbeProviderId, FakeSession>>> = {},
  createSessionOverride?: (providerId: ProbeProviderId) => Promise<ProbeSession>,
) {
  const created = new Map<ProbeProviderId, FakeSession>();
  const clock = fakeClock();
  const report = await runTranslationLanguageMonitor(
    {
      createSession: async (providerId) => {
        if (createSessionOverride) return createSessionOverride(providerId);
        const session =
          sessions[providerId] ??
          new FakeSession([
            readySnapshot(providerId, baseline(providerId).languages),
            readySnapshot(providerId, baseline(providerId).languages),
          ]);
        created.set(providerId, session);
        return session;
      },
      loadBaseline: async (providerId) => baselineSource(providerId),
      ...clock,
    },
    {
      hydrationTimeoutMs: 8,
      pollIntervalMs: 1,
      providerTimeoutMs: 1_000,
      stabilityIntervalMs: 1,
    },
  );
  return { created, report };
}

describe('translation language monitor baselines', () => {
  it('parses the three reviewed schema-version-1 baselines at exact reviewed counts', () => {
    assert.deepEqual(PROBE_PROVIDER_IDS, ['google', 'bing', 'yandex']);
    for (const providerId of PROBE_PROVIDER_IDS) {
      const parsed = baseline(providerId);
      assert.equal(parsed.providerId, providerId);
      assert.equal(parsed.evidenceDate, '2026-07-25');
      assert.equal(parsed.targetCount, EXPECTED_COUNTS[providerId]);
      assert.equal(parsed.languages.length, EXPECTED_COUNTS[providerId]);
      assert.equal(new Set(parsed.languages.map(({ code }) => code)).size, parsed.languages.length);
    }
  });

  it('fails closed on provider, count, duplicate, overlap, and reviewed extraction changes', () => {
    const valid = parse(baselineSource('google')) as Record<string, unknown>;
    const invalidValues = [
      { ...valid, provider_id: 'deepl' },
      { ...valid, evidence_date: '2026-02-30' },
      { ...valid, target_count: 1 },
      { ...valid, unreviewed_field: 'not schema version 1' },
      {
        ...valid,
        languages: [
          { code: 'en', label: 'English' },
          { code: 'en', label: 'English' },
        ],
        target_count: 2,
      },
      {
        ...valid,
        languages: [{ code: 'auto', label: 'Automatic' }],
        target_count: 1,
      },
      {
        ...valid,
        extraction: {
          ...(valid.extraction as Record<string, unknown>),
          opener: 'unreviewed selector',
        },
      },
    ];

    for (const value of invalidValues) {
      assert.throws(
        () => parseTranslationLanguageBaseline(stringify(value), 'google'),
        (error: unknown) => error instanceof ProbeFailure && error.code === 'baseline-invalid',
      );
    }

    const validYandex = parse(baselineSource('yandex')) as Record<string, unknown>;
    assert.doesNotThrow(() => parseTranslationLanguageBaseline(stringify(validYandex), 'yandex'));
    assert.throws(
      () =>
        parseTranslationLanguageBaseline(
          stringify({ ...validYandex, source_behavior: 'unstructured metadata' }),
          'yandex',
        ),
      (error: unknown) => error instanceof ProbeFailure && error.code === 'baseline-invalid',
    );
  });
});

describe('translation language monitor normalization and provider contracts', () => {
  it('preserves exact code case, ignores hidden identical copies, and rejects conflicting visible duplicates', () => {
    assert.deepEqual(
      normalizePublicLanguages([
        { code: 'pt-BR', label: 'Portuguese (Brazil)' },
        { code: 'pt-br', label: 'Different exact code' },
        { code: 'pt-BR', label: 'hidden conflict', visible: false },
        { code: 'pt-BR', label: 'Portuguese (Brazil)' },
      ]),
      [
        { code: 'pt-BR', label: 'Portuguese (Brazil)' },
        { code: 'pt-br', label: 'Different exact code' },
      ],
    );
    assert.throws(
      () =>
        normalizePublicLanguages([
          { code: 'en', label: 'English' },
          { code: 'en', label: 'Anglais' },
        ]),
      (error: unknown) => error instanceof ProbeFailure && error.code === 'page-contract-failure',
    );
  });

  it('enforces public metadata ceilings and rejects control-bearing fields', () => {
    assert.throws(
      () =>
        normalizePublicLanguages(
          Array.from({ length: 2_001 }, (_value, index) => ({
            code: `code-${index}`,
            label: `Language ${index}`,
          })),
        ),
      (error: unknown) => error instanceof ProbeFailure && error.code === 'metadata-limit',
    );
    for (const candidate of [
      { code: 'bad\ncode', label: 'Language' },
      { code: 'ok', label: 'bad\u0000label' },
      { code: 'x'.repeat(129), label: 'Language' },
      { code: 'ok', label: 'x'.repeat(257) },
    ]) {
      assert.throws(
        () => normalizePublicLanguages([candidate]),
        (error: unknown) => error instanceof ProbeFailure && error.code === 'metadata-limit',
      );
    }
  });

  it('ignores source-only targets and Bing Recently-used siblings', () => {
    const google = classifyProviderSnapshot(
      googleSnapshot([
        { code: 'auto', label: 'Detect language' },
        { code: 'en', label: 'English' },
      ]),
      new Set(['auto']),
    );
    assert.equal(google.kind, 'ready');
    if (google.kind === 'ready') assert.deepEqual(google.languages, [{ code: 'en', label: 'English' }]);

    const first = classifyProviderSnapshot(
      bingSnapshot([{ code: 'en', label: 'English' }], {
        recentOptions: [{ code: 'fr', label: 'French' }],
      }),
    );
    const second = classifyProviderSnapshot(
      bingSnapshot([{ code: 'en', label: 'English' }], {
        recentOptions: [{ code: 'de', label: 'German' }],
      }),
    );
    assert.equal(first.kind, 'ready');
    assert.equal(second.kind, 'ready');
    if (first.kind === 'ready' && second.kind === 'ready') {
      assert.equal(first.signature, second.signature);
    }
  });

  it('fails ambiguous controls, unexpected origins, and challenges without fabricating drift', () => {
    assert.deepEqual(classifyProviderSnapshot(googleSnapshot([], { openerCount: 2 })), {
      code: 'page-contract-failure',
      kind: 'failure',
    });
    assert.deepEqual(classifyProviderSnapshot(yandexSnapshot([], { originAllowed: false })), {
      code: 'unexpected-origin',
      kind: 'failure',
    });
    assert.deepEqual(classifyProviderSnapshot(bingSnapshot([], { challenge: true })), {
      code: 'consent-or-challenge',
      kind: 'failure',
    });
  });

  it('requires provider-specific active chooser structure without using hidden copies', () => {
    assert.equal(
      classifyProviderSnapshot(
        googleSnapshot([{ code: 'en', label: 'English' }], {
          terminalTraversalComplete: false,
        }),
      ).kind,
      'pending',
    );
    assert.equal(
      classifyProviderSnapshot(
        bingSnapshot([{ code: 'en', label: 'English' }], {
          canonicalGroupCount: 0,
          targetSelectEnabled: false,
        }),
      ).kind,
      'pending',
    );
    assert.deepEqual(
      classifyProviderSnapshot(
        yandexSnapshot(
          [
            { code: 'en', label: 'English' },
            { code: 'fr', label: 'French', visible: false },
          ],
          { searchInputCount: 2 },
        ),
      ),
      { code: 'page-contract-failure', kind: 'failure' },
    );

    const yandex = classifyProviderSnapshot(
      yandexSnapshot([
        { code: 'en', label: 'English' },
        { active: false, code: 'fr', label: 'French' },
      ]),
    );
    assert.equal(yandex.kind, 'ready');
    if (yandex.kind === 'ready') assert.deepEqual(yandex.languages, [{ code: 'en', label: 'English' }]);
  });

  it('permits only researched translator routes including Yandex English normalization', () => {
    assert.equal(isAllowedTranslationProbeLocation('google', 'https://translate.google.ru/'), true);
    assert.equal(isAllowedTranslationProbeLocation('bing', 'https://www.bing.com/translator'), true);
    assert.equal(isAllowedTranslationProbeLocation('yandex', 'https://translate.yandex.com/en/translator'), true);
    assert.equal(isAllowedTranslationProbeLocation('yandex', 'https://translate.yandex.com/en/'), true);

    for (const [providerId, location] of [
      ['google', 'http://translate.google.com/'],
      ['bing', 'https://www.bing.com/translator-preview'],
      ['yandex', 'https://translate.yandex.com/fr/'],
      ['yandex', 'https://translate.yandex.com/en/login'],
    ] as const) {
      assert.equal(isAllowedTranslationProbeLocation(providerId, location), false);
    }
  });
});

describe('translation language monitor stable hydration', () => {
  it('accepts delayed structurally complete inventories after two equal reads', async () => {
    const languages = [{ code: 'en', label: 'English' }];
    const session = new FakeSession([
      googleSnapshot([], { busy: true }),
      googleSnapshot(languages),
      googleSnapshot(languages),
    ]);
    const clock = fakeClock();
    const result = await waitForStableInventory(session, new Set(), {
      ...clock,
      pollIntervalMs: 1,
      stabilityIntervalMs: 1,
      timeoutMs: 10,
    });
    assert.deepEqual(result, languages);
    assert.equal(session.readCalls, 3);
  });

  it('distinguishes empty/loading timeout from an unstable canonical signature', async () => {
    const clock = fakeClock();
    await assert.rejects(
      waitForStableInventory(new FakeSession([yandexSnapshot([], { busy: true })]), new Set(), {
        ...clock,
        pollIntervalMs: 1,
        stabilityIntervalMs: 1,
        timeoutMs: 3,
      }),
      (error: unknown) => error instanceof ProbeFailure && error.code === 'hydration-timeout',
    );

    const unstableClock = fakeClock();
    const unstable = new FakeSession([], {
      snapshotFactory: (readCount) =>
        googleSnapshot([{ code: 'en', label: readCount % 2 === 0 ? 'English' : 'English changed' }], {
          mutationVersion: readCount,
        }),
    });
    await assert.rejects(
      waitForStableInventory(unstable, new Set(), {
        ...unstableClock,
        pollIntervalMs: 1,
        stabilityIntervalMs: 1,
        timeoutMs: 4,
      }),
      (error: unknown) => error instanceof ProbeFailure && error.code === 'unstable-inventory',
    );
  });

  it('requires Google mutation quietness and Bing canonical order stability', async () => {
    const googleClock = fakeClock();
    const google = new FakeSession([
      googleSnapshot([{ code: 'en', label: 'English' }], { mutationVersion: 1 }),
      googleSnapshot([{ code: 'en', label: 'English' }], { mutationVersion: 2 }),
      googleSnapshot([{ code: 'en', label: 'English' }], { mutationVersion: 2 }),
    ]);
    assert.deepEqual(
      await waitForStableInventory(google, new Set(), {
        ...googleClock,
        pollIntervalMs: 1,
        stabilityIntervalMs: 1,
        timeoutMs: 4,
      }),
      [{ code: 'en', label: 'English' }],
    );
    assert.equal(google.readCalls, 3);

    const bingClock = fakeClock();
    const bing = new FakeSession([
      bingSnapshot([
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'French' },
      ]),
      bingSnapshot([
        { code: 'fr', label: 'French' },
        { code: 'en', label: 'English' },
      ]),
      bingSnapshot([
        { code: 'fr', label: 'French' },
        { code: 'en', label: 'English' },
      ]),
    ]);
    assert.deepEqual(
      await waitForStableInventory(bing, new Set(), {
        ...bingClock,
        pollIntervalMs: 1,
        stabilityIntervalMs: 1,
        timeoutMs: 4,
      }),
      [
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'French' },
      ],
    );
    assert.equal(bing.readCalls, 3);
  });

  it('does not use baseline counts, minimum counts, or named anchors as hydration gates', async () => {
    const live = [{ code: 'new-code', label: 'Only structurally complete target' }];
    const session = new FakeSession([yandexSnapshot(live), yandexSnapshot(live)]);
    const clock = fakeClock();
    assert.deepEqual(
      await waitForStableInventory(session, new Set(), {
        ...clock,
        pollIntervalMs: 1,
        stabilityIntervalMs: 1,
        timeoutMs: 4,
      }),
      live,
    );
  });
});

describe('translation language monitor diffs and reports', () => {
  it('sorts combined drift and fingerprints only canonical public diff data', () => {
    const first = diffTranslationLanguages(
      [
        { code: 'c', label: 'Old C' },
        { code: 'a', label: 'A' },
        { code: 'b', label: 'B' },
      ],
      [
        { code: 'd', label: 'D' },
        { code: 'c', label: 'New C' },
        { code: 'a', label: 'A' },
      ],
    );
    assert.deepEqual(first, {
      added: [{ code: 'd', label: 'D' }],
      relabeled: [{ baselineLabel: 'Old C', code: 'c', liveLabel: 'New C' }],
      removed: [{ code: 'b', label: 'B' }],
    });
    const reordered = diffTranslationLanguages(
      [
        { code: 'b', label: 'B' },
        { code: 'a', label: 'A' },
        { code: 'c', label: 'Old C' },
      ],
      [
        { code: 'a', label: 'A' },
        { code: 'c', label: 'New C' },
        { code: 'd', label: 'D' },
      ],
    );
    assert.equal(
      fingerprintTranslationLanguageDiff('google', first),
      fingerprintTranslationLanguageDiff('google', reordered),
    );
    assert.notEqual(
      fingerprintTranslationLanguageDiff('google', first),
      fingerprintTranslationLanguageDiff('bing', first),
    );
    assert.equal(
      fingerprintTranslationLanguageDiff('google', first),
      fingerprintTranslationLanguageDiff('google', {
        added: [...first.added].reverse(),
        relabeled: [...first.relabeled].reverse(),
        removed: [...first.removed].reverse(),
      }),
    );
  });

  it('lets stable removals reach drift and keeps drift as a successful command outcome', async () => {
    const yandexBaseline = baseline('yandex');
    const live = yandexBaseline.languages.slice(1);
    const yandex = new FakeSession([yandexSnapshot(live), yandexSnapshot(live)]);
    const { report } = await runWithSessions({ yandex });
    const result = report.results.find(({ providerId }) => providerId === 'yandex');
    assert.equal(result?.status, 'drift');
    if (result?.status === 'drift') {
      assert.deepEqual(result.diff.removed, [yandexBaseline.languages[0]]);
      assert.match(result.fingerprint, /^[\da-f]{64}$/u);
    }
    assert.equal(getTranslationLanguageMonitorExitCode(report), 0);
  });

  it('sanitizes injected raw failures, continues providers, and exits nonzero', async () => {
    const sessions = new Map<ProbeProviderId, FakeSession>();
    const { report } = await runWithSessions({}, async (providerId) => {
      if (providerId === 'google') {
        throw new Error('https://private.example DOM <secret> raw browser failure');
      }
      const session = new FakeSession([
        readySnapshot(providerId, baseline(providerId).languages),
        readySnapshot(providerId, baseline(providerId).languages),
      ]);
      sessions.set(providerId, session);
      return session;
    });
    const serialized = serializeTranslationLanguageMonitorReport(report);
    assert.equal(report.results.length, 3);
    assert.equal(report.results[0]?.status, 'probe-failure');
    assert.equal(report.results[1]?.status, 'no-drift');
    assert.equal(report.results[2]?.status, 'no-drift');
    assert.equal(getTranslationLanguageMonitorExitCode(report), 1);
    assert.doesNotMatch(serialized, /private|secret|DOM|browser failure|https?:/iu);
    assert.equal(sessions.get('bing')?.closeContextCalls, 1);
    assert.equal(sessions.get('yandex')?.closeContextCalls, 1);
  });

  it('serializes only allowlisted report fields and recomputes drift fingerprints', async () => {
    const yandexBaseline = baseline('yandex');
    const live = yandexBaseline.languages.slice(1);
    const { report } = await runWithSessions({
      yandex: new FakeSession([yandexSnapshot(live), yandexSnapshot(live)]),
    });
    const drift = report.results.find(({ providerId }) => providerId === 'yandex');
    assert.equal(drift?.status, 'drift');
    if (drift?.status !== 'drift') return;

    const taintedDrift = {
      ...drift,
      fingerprint: 'https://private.example/raw-fingerprint',
      rawDom: '<secret>',
    };
    const serialized = serializeTranslationLanguageMonitorReport({
      results: [taintedDrift],
      schemaVersion: 1,
    });
    assert.doesNotMatch(serialized, /private|secret|https?:/iu);
    assert.match(serialized, /"fingerprint": "[\da-f]{64}"/u);
  });

  it('attempts page and context cleanup and withholds results when cleanup fails', async () => {
    const googleLanguages = baseline('google').languages;
    const google = new FakeSession([googleSnapshot(googleLanguages), googleSnapshot(googleLanguages)], {
      closePageError: new Error('raw close failure'),
    });
    const { report } = await runWithSessions({ google });
    assert.deepEqual(report.results[0], {
      baselineDate: '2026-07-25',
      failureCode: 'cleanup-failure',
      providerId: 'google',
      status: 'probe-failure',
    });
    assert.equal(google.closePageCalls, 1);
    assert.equal(google.closeContextCalls, 1);
  });

  it('closes an owned session after a provider timeout and isolates all provider sessions', async () => {
    const never = new Promise<void>(() => undefined);
    const google = new FakeSession([], {
      prepareOperation: () => never,
    });
    const created = new Map<ProbeProviderId, FakeSession>();
    const report = await runTranslationLanguageMonitor(
      {
        createSession: async (providerId) => {
          const session =
            providerId === 'google'
              ? google
              : new FakeSession([
                  readySnapshot(providerId, baseline(providerId).languages),
                  readySnapshot(providerId, baseline(providerId).languages),
                ]);
          created.set(providerId, session);
          return session;
        },
        loadBaseline: async (providerId) => baselineSource(providerId),
      },
      {
        hydrationTimeoutMs: 10,
        pollIntervalMs: 1,
        providerTimeoutMs: 5,
        stabilityIntervalMs: 1,
      },
    );

    assert.deepEqual(
      report.results.map(({ providerId, status }) => ({ providerId, status })),
      [
        { providerId: 'google', status: 'probe-failure' },
        { providerId: 'bing', status: 'no-drift' },
        { providerId: 'yandex', status: 'no-drift' },
      ],
    );
    assert.equal(created.size, 3);
    assert.equal(new Set(created.values()).size, 3);
    for (const session of created.values()) {
      assert.equal(session.closePageCalls, 1);
      assert.equal(session.closeContextCalls, 1);
    }
  });

  it('never mutates reviewed baseline bytes', async () => {
    const before = new Map(
      PROBE_PROVIDER_IDS.map((providerId) => [providerId, fs.readFileSync(baselinePath(providerId))]),
    );
    await runWithSessions();
    for (const providerId of PROBE_PROVIDER_IDS) {
      assert.deepEqual(fs.readFileSync(baselinePath(providerId)), before.get(providerId));
    }
  });
});

describe('translation language monitor live-boundary source contract', () => {
  it('uses fixed target-only selectors and a nonpersistent no-text launch', () => {
    const adapters = fs.readFileSync(
      path.join(PROJECT_ROOT, 'scripts', 'translation-language-monitor-adapters.ts'),
      'utf8',
    );
    const core = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts', 'translation-language-monitor-core.ts'), 'utf8');
    const cli = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts', 'translation-language-monitor.ts'), 'utf8');
    const packageSource = fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8');

    for (const selector of [
      'button[aria-label="More target languages"]',
      'input[aria-label="Search languages"]',
      '#tta_tgtsl optgroup#t_tgtAllLang > option',
      'button[aria-label^="Choose target language"]',
      'input[placeholder="Search languages"]',
      '[data-lang-element="true"][data-value][role="checkbox"][aria-label]',
    ]) {
      assert.equal(adapters.includes(selector), true, selector);
    }
    assert.match(adapters, /aria-label="Reject all"/u);
    assert.match(adapters, /Allow essential cookies/u);
    assert.match(adapters, /keyboard\.press\('End'\)/u);
    assert.match(adapters, /keyboard\.press\('Home'\)/u);
    assert.match(adapters, /MutationObserver/u);
    assert.match(adapters, /https:\/\/translate\.google\.com\/\?sl=auto&tl=en&op=translate&hl=en/u);
    assert.doesNotMatch(adapters, /[?&]text=/u);
    assert.doesNotMatch(
      adapters,
      /textarea#textarea|#tta_input_ta|clipboard|storageState|\.fill\(|\.type\(|request\.|response\.|aria-expanded|deepl/iu,
    );
    assert.match(cli, /launchContext\(\{/u);
    assert.match(cli, /headless: true/u);
    assert.match(cli, /locale: 'en-US'/u);
    assert.match(cli, /timezone: 'UTC'/u);
    assert.match(cli, /humanPreset: 'careful'/u);
    assert.match(cli, /CLOAKBROWSER_AUTO_UPDATE = 'false'/u);
    assert.doesNotMatch(cli, /userDataDir|launchPersistentContext/u);
    assert.match(core, /hydrationTimeoutMs: timing\.hydrationTimeoutMs \?\? 30_000/u);
    assert.match(core, /providerTimeoutMs: timing\.providerTimeoutMs \?\? 60_000/u);
    assert.match(core, /stabilityIntervalMs: timing\.stabilityIntervalMs \?\? 1_000/u);
    assert.match(packageSource, /"monitor:translation-languages": "tsx scripts\/translation-language-monitor\.ts"/u);
  });
});
