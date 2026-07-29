import { createHash } from 'node:crypto';
import { parse } from 'yaml';

export const PROBE_PROVIDER_IDS = ['google', 'bing', 'yandex'] as const;
export type ProbeProviderId = (typeof PROBE_PROVIDER_IDS)[number];

export const PROBE_FAILURE_CODES = [
  'baseline-invalid',
  'browser-launch-failure',
  'navigation-failure',
  'unexpected-origin',
  'consent-or-challenge',
  'page-contract-failure',
  'metadata-limit',
  'hydration-timeout',
  'unstable-inventory',
  'provider-timeout',
  'cleanup-failure',
  'internal-failure',
] as const;
export type ProbeFailureCode = (typeof PROBE_FAILURE_CODES)[number];

export interface PublicLanguage {
  readonly code: string;
  readonly label: string;
}

export interface PublicLanguageCandidate extends PublicLanguage {
  readonly active?: boolean;
  readonly enabled?: boolean;
  readonly visible?: boolean;
}

export interface TranslationLanguageBaseline {
  readonly evidenceDate: string;
  readonly extraction: Readonly<Record<string, unknown>>;
  readonly languages: readonly PublicLanguage[];
  readonly providerId: ProbeProviderId;
  readonly sourceOnly: readonly PublicLanguage[];
  readonly targetCount: number;
}

interface SnapshotBase {
  readonly busy: boolean;
  readonly challenge: boolean;
  readonly originAllowed: boolean;
  readonly providerId: ProbeProviderId;
}

export interface GoogleProbeSnapshot extends SnapshotBase {
  readonly documentReadyState: string;
  readonly groupCount: number;
  readonly listboxCount: number;
  readonly mutationVersion: number;
  readonly openerCount: number;
  readonly options: readonly PublicLanguageCandidate[];
  readonly searchInputCount: number;
  readonly terminalTraversalComplete: boolean;
  readonly providerId: 'google';
}

export interface BingProbeSnapshot extends SnapshotBase {
  readonly canonicalGroupCount: number;
  readonly canonicalOptions: readonly PublicLanguageCandidate[];
  readonly recentOptions?: readonly PublicLanguageCandidate[];
  readonly targetSelectCount: number;
  readonly targetSelectEnabled: boolean;
  readonly targetSelectVisible: boolean;
  readonly providerId: 'bing';
}

export interface YandexProbeSnapshot extends SnapshotBase {
  readonly openerCount: number;
  readonly options: readonly PublicLanguageCandidate[];
  readonly searchInputCount: number;
  readonly providerId: 'yandex';
}

export type ProviderProbeSnapshot = GoogleProbeSnapshot | BingProbeSnapshot | YandexProbeSnapshot;

export interface AddedLanguage {
  readonly code: string;
  readonly label: string;
}

export interface RemovedLanguage {
  readonly code: string;
  readonly label: string;
}

export interface RelabeledLanguage {
  readonly baselineLabel: string;
  readonly code: string;
  readonly liveLabel: string;
}

export interface TranslationLanguageDiff {
  readonly added: readonly AddedLanguage[];
  readonly relabeled: readonly RelabeledLanguage[];
  readonly removed: readonly RemovedLanguage[];
}

export type ProviderProbeReport =
  | {
      readonly baselineDate: string;
      readonly providerId: ProbeProviderId;
      readonly status: 'no-drift';
    }
  | {
      readonly baselineDate: string;
      readonly diff: TranslationLanguageDiff;
      readonly fingerprint: string;
      readonly providerId: ProbeProviderId;
      readonly status: 'drift';
    }
  | {
      readonly baselineDate: string;
      readonly failureCode: ProbeFailureCode;
      readonly providerId: ProbeProviderId;
      readonly status: 'probe-failure';
    };

export interface TranslationLanguageMonitorReport {
  readonly results: readonly ProviderProbeReport[];
  readonly schemaVersion: 1;
}

export interface ProbeSession {
  closeContext(): Promise<void>;
  closePage(): Promise<void>;
  prepare(): Promise<void>;
  readSnapshot(): Promise<ProviderProbeSnapshot>;
}

export interface MonitorDependencies {
  readonly createSession: (providerId: ProbeProviderId) => Promise<ProbeSession>;
  readonly loadBaseline: (providerId: ProbeProviderId) => Promise<string>;
  readonly now?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

export interface MonitorTiming {
  readonly hydrationTimeoutMs?: number;
  readonly pollIntervalMs?: number;
  readonly providerTimeoutMs?: number;
  readonly stabilityIntervalMs?: number;
}

interface ReadySnapshot {
  readonly languages: readonly PublicLanguage[];
  readonly signature: string;
}

type ClassifiedSnapshot =
  | { readonly kind: 'pending' }
  | { readonly code: ProbeFailureCode; readonly kind: 'failure' }
  | ({ readonly kind: 'ready' } & ReadySnapshot);

const MAX_ACTIVE_OPTIONS = 2_000;
const MAX_CODE_POINTS = 128;
const MAX_LABEL_POINTS = 256;
const BASELINE_FIELDS = new Set([
  'evidence_date',
  'extraction',
  'languages',
  'provider_id',
  'schema_version',
  'source_only',
  'target_count',
]);

const REVIEWED_EXTRACTION = {
  google: {
    code_attribute: 'data-language-code',
    label_source: 'accessible name',
    opener: 'button[aria-label="More target languages"]',
    option_selector: '[role="option"][data-language-code]:visible',
  },
  bing: {
    code_attribute: 'value',
    label_source: 'trimmed textContent',
    opener: 'select#tta_tgtsl',
    option_selector: '#tta_tgtsl option',
  },
  yandex: {
    code_attribute: 'data-value',
    label_source: 'aria-label',
    opener: 'button[aria-label^="Choose target language"]',
    option_selector: '[data-lang-element="true"][data-value][role="checkbox"][aria-label]:visible',
  },
} as const satisfies Readonly<Record<ProbeProviderId, Readonly<Record<string, string>>>>;

/** Carries one allowlisted failure category without retaining raw provider data. */
export class ProbeFailure extends Error {
  readonly code: ProbeFailureCode;

  constructor(code: ProbeFailureCode) {
    super(code);
    this.name = 'ProbeFailure';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProbeProviderId(value: unknown): value is ProbeProviderId {
  return typeof value === 'string' && PROBE_PROVIDER_IDS.includes(value as ProbeProviderId);
}

function compareExact(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f) || codePoint === 0x2028 || codePoint === 0x2029) {
      return true;
    }
  }
  return false;
}

function validatePublicField(value: string, maximumCodePoints: number, failureCode: ProbeFailureCode): void {
  if (!value.trim() || [...value].length > maximumCodePoints || hasControlCharacters(value)) {
    throw new ProbeFailure(failureCode);
  }
}

function parseLanguage(value: unknown): PublicLanguage {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => key !== 'code' && key !== 'label') ||
    typeof value.code !== 'string' ||
    typeof value.label !== 'string'
  ) {
    throw new ProbeFailure('baseline-invalid');
  }
  validatePublicField(value.code, MAX_CODE_POINTS, 'baseline-invalid');
  validatePublicField(value.label, MAX_LABEL_POINTS, 'baseline-invalid');
  return { code: value.code, label: value.label };
}

function parseLanguageArray(value: unknown): readonly PublicLanguage[] {
  if (!Array.isArray(value) || value.length > MAX_ACTIVE_OPTIONS) throw new ProbeFailure('baseline-invalid');
  const parsed = value.map(parseLanguage);
  const seen = new Map<string, string>();
  for (const language of parsed) {
    const previous = seen.get(language.code);
    if (previous !== undefined) throw new ProbeFailure('baseline-invalid');
    seen.set(language.code, language.label);
  }
  return parsed;
}

function validateExtraction(providerId: ProbeProviderId, value: unknown): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) throw new ProbeFailure('baseline-invalid');
  for (const [key, expected] of Object.entries(REVIEWED_EXTRACTION[providerId])) {
    if (value[key] !== expected) throw new ProbeFailure('baseline-invalid');
  }
  return Object.freeze({ ...REVIEWED_EXTRACTION[providerId] });
}

function isValidEvidenceDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validateBaselineFields(value: Record<string, unknown>, providerId: ProbeProviderId): void {
  const allowed = providerId === 'yandex' ? new Set([...BASELINE_FIELDS, 'source_behavior']) : BASELINE_FIELDS;
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new ProbeFailure('baseline-invalid');
  if (value.source_behavior !== undefined && !isRecord(value.source_behavior)) {
    throw new ProbeFailure('baseline-invalid');
  }
}

/** Parses one reviewed YAML baseline without using any selector supplied by the file at runtime. */
export function parseTranslationLanguageBaseline(
  source: string,
  expectedProviderId: ProbeProviderId,
): TranslationLanguageBaseline {
  let value: unknown;
  try {
    value = parse(source);
  } catch {
    throw new ProbeFailure('baseline-invalid');
  }
  if (!isRecord(value) || value.schema_version !== 1 || value.provider_id !== expectedProviderId) {
    throw new ProbeFailure('baseline-invalid');
  }
  if (!isProbeProviderId(value.provider_id)) throw new ProbeFailure('baseline-invalid');
  validateBaselineFields(value, value.provider_id);
  if (!isValidEvidenceDate(value.evidence_date)) throw new ProbeFailure('baseline-invalid');
  if (
    !Number.isInteger(value.target_count) ||
    (value.target_count as number) < 1 ||
    (value.target_count as number) > MAX_ACTIVE_OPTIONS
  ) {
    throw new ProbeFailure('baseline-invalid');
  }

  const languages = parseLanguageArray(value.languages);
  const sourceOnly = parseLanguageArray(value.source_only);
  if (languages.length !== value.target_count) throw new ProbeFailure('baseline-invalid');
  const targetCodes = new Set(languages.map(({ code }) => code));
  if (sourceOnly.some(({ code }) => targetCodes.has(code))) throw new ProbeFailure('baseline-invalid');

  return {
    evidenceDate: value.evidence_date,
    extraction: validateExtraction(expectedProviderId, value.extraction),
    languages,
    providerId: expectedProviderId,
    sourceOnly,
    targetCount: value.target_count,
  };
}

function normalizeCandidates(
  candidates: readonly PublicLanguageCandidate[],
  excludedCodes: ReadonlySet<string>,
  sort: boolean,
): readonly PublicLanguage[] {
  const active = candidates.filter(({ active = true, enabled = true, visible = true }) => active && enabled && visible);
  if (active.length > MAX_ACTIVE_OPTIONS) throw new ProbeFailure('metadata-limit');

  const normalized: PublicLanguage[] = [];
  const labels = new Map<string, string>();
  for (const candidate of active) {
    if (excludedCodes.has(candidate.code)) continue;
    validatePublicField(candidate.code, MAX_CODE_POINTS, 'metadata-limit');
    validatePublicField(candidate.label, MAX_LABEL_POINTS, 'metadata-limit');
    const previous = labels.get(candidate.code);
    if (previous !== undefined) {
      if (previous !== candidate.label) throw new ProbeFailure('page-contract-failure');
      continue;
    }
    labels.set(candidate.code, candidate.label);
    normalized.push({ code: candidate.code, label: candidate.label });
  }
  if (sort) normalized.sort((left, right) => compareExact(left.code, right.code));
  return normalized;
}

export function normalizePublicLanguages(
  candidates: readonly PublicLanguageCandidate[],
  excludedCodes: ReadonlySet<string> = new Set(),
): readonly PublicLanguage[] {
  return normalizeCandidates(candidates, excludedCodes, true);
}

function languageSignature(languages: readonly PublicLanguage[]): string {
  return JSON.stringify(languages.map(({ code, label }) => [code, label]));
}

function failIfBlocked(snapshot: SnapshotBase): ClassifiedSnapshot | null {
  if (!snapshot.originAllowed) return { code: 'unexpected-origin', kind: 'failure' };
  if (snapshot.challenge) return { code: 'consent-or-challenge', kind: 'failure' };
  if (snapshot.busy) return { kind: 'pending' };
  return null;
}

/** Converts one sanitized public-control snapshot into a fail-closed hydration state. */
export function classifyProviderSnapshot(
  snapshot: ProviderProbeSnapshot,
  sourceOnlyCodes: ReadonlySet<string> = new Set(),
): ClassifiedSnapshot {
  const blocked = failIfBlocked(snapshot);
  if (blocked) return blocked;

  try {
    switch (snapshot.providerId) {
      case 'google': {
        if (
          snapshot.openerCount > 1 ||
          snapshot.searchInputCount > 1 ||
          snapshot.listboxCount > 1 ||
          snapshot.groupCount > 1
        ) {
          return { code: 'page-contract-failure', kind: 'failure' };
        }
        if (
          snapshot.openerCount !== 1 ||
          snapshot.searchInputCount !== 1 ||
          snapshot.listboxCount !== 1 ||
          snapshot.groupCount !== 1 ||
          snapshot.documentReadyState !== 'complete' ||
          !snapshot.terminalTraversalComplete
        ) {
          return { kind: 'pending' };
        }
        const languages = normalizeCandidates(snapshot.options, sourceOnlyCodes, true);
        if (languages.length === 0) return { kind: 'pending' };
        return {
          kind: 'ready',
          languages,
          signature: `${languageSignature(languages)}:${snapshot.mutationVersion}`,
        };
      }
      case 'bing': {
        if (snapshot.targetSelectCount > 1 || snapshot.canonicalGroupCount > 1) {
          return { code: 'page-contract-failure', kind: 'failure' };
        }
        if (
          snapshot.targetSelectCount !== 1 ||
          snapshot.canonicalGroupCount !== 1 ||
          !snapshot.targetSelectVisible ||
          !snapshot.targetSelectEnabled
        ) {
          return { kind: 'pending' };
        }
        const ordered = normalizeCandidates(snapshot.canonicalOptions, sourceOnlyCodes, false);
        if (ordered.length === 0) return { kind: 'pending' };
        return {
          kind: 'ready',
          languages: [...ordered].sort((left, right) => compareExact(left.code, right.code)),
          signature: languageSignature(ordered),
        };
      }
      case 'yandex': {
        if (snapshot.openerCount > 1 || snapshot.searchInputCount > 1) {
          return { code: 'page-contract-failure', kind: 'failure' };
        }
        if (snapshot.openerCount !== 1 || snapshot.searchInputCount !== 1) {
          return { kind: 'pending' };
        }
        const languages = normalizeCandidates(snapshot.options, sourceOnlyCodes, true);
        if (languages.length === 0) return { kind: 'pending' };
        return { kind: 'ready', languages, signature: languageSignature(languages) };
      }
    }
  } catch (error: unknown) {
    if (error instanceof ProbeFailure) return { code: error.code, kind: 'failure' };
    return { code: 'internal-failure', kind: 'failure' };
  }
}

export async function waitForStableInventory(
  session: Pick<ProbeSession, 'readSnapshot'>,
  sourceOnlyCodes: ReadonlySet<string>,
  options: {
    readonly now: () => number;
    readonly sleep: (milliseconds: number) => Promise<void>;
    readonly timeoutMs: number;
    readonly pollIntervalMs: number;
    readonly stabilityIntervalMs: number;
  },
): Promise<readonly PublicLanguage[]> {
  const deadline = options.now() + options.timeoutMs;
  let previous: ReadySnapshot | null = null;
  let sawMismatch = false;

  while (options.now() <= deadline) {
    const classified = classifyProviderSnapshot(await session.readSnapshot(), sourceOnlyCodes);
    if (classified.kind === 'failure') throw new ProbeFailure(classified.code);
    if (classified.kind === 'ready') {
      if (previous?.signature === classified.signature) return classified.languages;
      if (previous) sawMismatch = true;
      previous = classified;
      await options.sleep(options.stabilityIntervalMs);
      continue;
    }
    previous = null;
    await options.sleep(options.pollIntervalMs);
  }

  throw new ProbeFailure(sawMismatch ? 'unstable-inventory' : 'hydration-timeout');
}

export function diffTranslationLanguages(
  baseline: readonly PublicLanguage[],
  live: readonly PublicLanguage[],
): TranslationLanguageDiff {
  const baselineByCode = new Map(baseline.map((language) => [language.code, language.label]));
  const liveByCode = new Map(live.map((language) => [language.code, language.label]));
  const added: AddedLanguage[] = [];
  const removed: RemovedLanguage[] = [];
  const relabeled: RelabeledLanguage[] = [];

  for (const [code, label] of liveByCode) {
    const baselineLabel = baselineByCode.get(code);
    if (baselineLabel === undefined) added.push({ code, label });
    else if (baselineLabel !== label) relabeled.push({ baselineLabel, code, liveLabel: label });
  }
  for (const [code, label] of baselineByCode) {
    if (!liveByCode.has(code)) removed.push({ code, label });
  }

  added.sort((left, right) => compareExact(left.code, right.code));
  removed.sort((left, right) => compareExact(left.code, right.code));
  relabeled.sort((left, right) => compareExact(left.code, right.code));
  return { added, relabeled, removed };
}

function canonicalizeTranslationLanguageDiff(diff: TranslationLanguageDiff): TranslationLanguageDiff {
  const added = [...diff.added].map(({ code, label }) => ({ code, label }));
  const removed = [...diff.removed].map(({ code, label }) => ({ code, label }));
  const relabeled = [...diff.relabeled].map(({ baselineLabel, code, liveLabel }) => ({
    baselineLabel,
    code,
    liveLabel,
  }));
  added.sort((left, right) => compareExact(left.code, right.code) || compareExact(left.label, right.label));
  removed.sort((left, right) => compareExact(left.code, right.code) || compareExact(left.label, right.label));
  relabeled.sort(
    (left, right) =>
      compareExact(left.code, right.code) ||
      compareExact(left.baselineLabel, right.baselineLabel) ||
      compareExact(left.liveLabel, right.liveLabel),
  );
  return { added, relabeled, removed };
}

export function fingerprintTranslationLanguageDiff(providerId: ProbeProviderId, diff: TranslationLanguageDiff): string {
  const canonicalDiff = canonicalizeTranslationLanguageDiff(diff);
  const canonical = JSON.stringify({
    providerId,
    added: canonicalDiff.added,
    removed: canonicalDiff.removed,
    relabeled: canonicalDiff.relabeled,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function reportFromLanguages(
  baseline: TranslationLanguageBaseline,
  live: readonly PublicLanguage[],
): ProviderProbeReport {
  const diff = diffTranslationLanguages(baseline.languages, live);
  if (diff.added.length === 0 && diff.removed.length === 0 && diff.relabeled.length === 0) {
    return {
      baselineDate: baseline.evidenceDate,
      providerId: baseline.providerId,
      status: 'no-drift',
    };
  }
  return {
    baselineDate: baseline.evidenceDate,
    diff,
    fingerprint: fingerprintTranslationLanguageDiff(baseline.providerId, diff),
    providerId: baseline.providerId,
    status: 'drift',
  };
}

function failureReport(
  providerId: ProbeProviderId,
  baselineDate: string,
  failureCode: ProbeFailureCode,
): ProviderProbeReport {
  return { baselineDate, failureCode, providerId, status: 'probe-failure' };
}

function safeFailureCode(error: unknown): ProbeFailureCode {
  return error instanceof ProbeFailure ? error.code : 'internal-failure';
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new ProbeFailure('provider-timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function executeProviderProbe(
  baseline: TranslationLanguageBaseline,
  dependencies: MonitorDependencies,
  timing: Required<MonitorTiming>,
): Promise<ProviderProbeReport> {
  const ownership: { session: ProbeSession | null } = { session: null };
  let result: ProviderProbeReport;
  const now = dependencies.now ?? Date.now;
  const sleep =
    dependencies.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  try {
    result = await withTimeout(
      (async () => {
        try {
          ownership.session = await dependencies.createSession(baseline.providerId);
        } catch {
          throw new ProbeFailure('browser-launch-failure');
        }
        const session = ownership.session;
        await session.prepare();
        const live = await waitForStableInventory(session, new Set(baseline.sourceOnly.map(({ code }) => code)), {
          now,
          pollIntervalMs: timing.pollIntervalMs,
          sleep,
          stabilityIntervalMs: timing.stabilityIntervalMs,
          timeoutMs: timing.hydrationTimeoutMs,
        });
        return reportFromLanguages(baseline, live);
      })(),
      timing.providerTimeoutMs,
    );
  } catch (error: unknown) {
    result = failureReport(baseline.providerId, baseline.evidenceDate, safeFailureCode(error));
  } finally {
    const session = ownership.session;
    if (session) {
      const cleanup = await Promise.allSettled([session.closePage(), session.closeContext()]);
      if (cleanup.some(({ status }) => status === 'rejected')) {
        result = failureReport(baseline.providerId, baseline.evidenceDate, 'cleanup-failure');
      }
    }
  }
  return result;
}

export async function runTranslationLanguageMonitor(
  dependencies: MonitorDependencies,
  timing: MonitorTiming = {},
): Promise<TranslationLanguageMonitorReport> {
  const completeTiming: Required<MonitorTiming> = {
    hydrationTimeoutMs: timing.hydrationTimeoutMs ?? 30_000,
    pollIntervalMs: timing.pollIntervalMs ?? 250,
    providerTimeoutMs: timing.providerTimeoutMs ?? 60_000,
    stabilityIntervalMs: timing.stabilityIntervalMs ?? 1_000,
  };
  const results: ProviderProbeReport[] = [];

  for (const providerId of PROBE_PROVIDER_IDS) {
    let baseline: TranslationLanguageBaseline;
    try {
      baseline = parseTranslationLanguageBaseline(await dependencies.loadBaseline(providerId), providerId);
    } catch {
      results.push(failureReport(providerId, 'unknown', 'baseline-invalid'));
      continue;
    }
    results.push(await executeProviderProbe(baseline, dependencies, completeTiming));
  }

  return { results, schemaVersion: 1 };
}

export function serializeTranslationLanguageMonitorReport(report: TranslationLanguageMonitorReport): string {
  const results = report.results.map((result): ProviderProbeReport => {
    switch (result.status) {
      case 'no-drift':
        return {
          baselineDate: result.baselineDate,
          providerId: result.providerId,
          status: result.status,
        };
      case 'drift': {
        const diff = canonicalizeTranslationLanguageDiff(result.diff);
        return {
          baselineDate: result.baselineDate,
          diff,
          fingerprint: fingerprintTranslationLanguageDiff(result.providerId, diff),
          providerId: result.providerId,
          status: result.status,
        };
      }
      case 'probe-failure':
        return {
          baselineDate: result.baselineDate,
          failureCode: result.failureCode,
          providerId: result.providerId,
          status: result.status,
        };
    }
  });
  return `${JSON.stringify({ results, schemaVersion: 1 }, null, 2)}\n`;
}

export function getTranslationLanguageMonitorExitCode(report: TranslationLanguageMonitorReport): 0 | 1 {
  return report.results.some(({ status }) => status === 'probe-failure') ? 1 : 0;
}
