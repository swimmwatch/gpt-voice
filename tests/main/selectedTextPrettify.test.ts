import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { I18nService } from '@main/i18n';
import {
  MAX_PRETTIFY_SELECTED_TEXT_LENGTH,
  SelectedTextPrettifyService,
  type SelectedTextPrettifyDependencies,
} from '@main/services/selectedTextPrettify';
import { SelectedTextActionGate } from '@main/services/selectedTextActionState';
import { createTextActionResultCache, type TextActionResultCache } from '@main/services/textActionCache';
import type { PrettifyExecutionInstruction } from '@main/services/prettifyProfileInstruction';
import type { ClipboardType } from '@main/electronRuntime';
import type { SystemNotificationOptions } from '@shared/notifications';
import type { PrettifyProfileChooserOutcome, PrettifyProfileChooserRequest } from '@shared/prettifyProfileChooser';
import { DEFAULT_PRETTIFY_SETTINGS, type PrettifyProviderId, type PrettifySettings } from '@shared/prettifySettings';
import {
  normalizePrettifyProfileCatalog,
  normalizePrettifyProfileInstruction,
  PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
  type PrettifyCustomProfileId,
  type PrettifyProfileCatalog,
  type PrettifyProfileId,
  type ValidatedPrettifyProfileInstruction,
} from '@shared/prettifyProfiles';
import { RecordingPrettifyProviderAudit } from './prettifyAuditTestUtils';
import { PrettifyRuntimeFixture, TestPrettifySettingsStorage } from './prettifyRuntimeTestUtils';
import { RecordingDiagnosticCapture } from './diagnosticCaptureTestUtils';

const localization = new I18nService();
const TEST_PROFILE_ID = 'custom:00000000-0000-4000-8000-000000000001' as const;
const SECOND_TEST_PROFILE_ID = 'custom:00000000-0000-4000-8000-000000000002' as const;

function createTestProfileCatalog(options: {
  description?: string;
  id: PrettifyCustomProfileId;
  instruction: string;
  name: string;
  reverseOrder?: boolean;
}): PrettifyProfileCatalog {
  const order = ['prompt-ready', 'polish', 'professional', 'natural', options.id] as const;
  return normalizePrettifyProfileCatalog({
    chooserOrder: options.reverseOrder ? [...order].reverse() : order,
    customProfiles: [
      {
        ...(options.description === undefined ? {} : { description: options.description }),
        id: options.id,
        instruction: normalizePrettifyProfileInstruction(options.instruction),
        name: options.name,
      },
    ],
    defaultProfileId: options.id,
    schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
  });
}

function createDeferredChooser() {
  let resolveOutcome!: (outcome: PrettifyProfileChooserOutcome) => void;
  const outcome = new Promise<PrettifyProfileChooserOutcome>((resolve) => {
    resolveOutcome = resolve;
  });
  let cancelCount = 0;
  let focusCount = 0;
  return {
    chooser: {
      cancel: () => {
        cancelCount += 1;
        resolveOutcome({ type: 'cancel' });
      },
      focus: () => {
        focusCount += 1;
        return true;
      },
      open: () => outcome,
    },
    getCancelCount: () => cancelCount,
    getFocusCount: () => focusCount,
    resolve: resolveOutcome,
  };
}

async function waitForCondition(predicate: () => boolean, message: string): Promise<void> {
  for (let attempts = 0; attempts < 50; attempts += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail(message);
}

interface TestServiceOptions {
  actionGate?: SelectedTextActionGate;
  cache?: TextActionResultCache;
  cacheContext?: readonly string[];
  chooser?: SelectedTextPrettifyDependencies['chooser'];
  copiedText?: string;
  copyError?: Error;
  diagnosticCapture?: RecordingDiagnosticCapture;
  legacyPrompt?: string;
  platform?: NodeJS.Platform;
  profileCatalog?: SelectedTextPrettifyDependencies['profileCatalog'];
  runtime?: SelectedTextPrettifyDependencies['runtime'];
  prompt?: string;
  providerId?: PrettifyProviderId;
  baseUrl?: string;
  maxOutputTokens?: number;
  minP?: number;
  model?: string;
  repeatPenalty?: number;
  seed?: number | null;
  temperature?: number;
  topK?: number;
  topP?: number;
  selectionText?: string;
  prepareResult?: { success: false; error: string };
  prepareWait?: Promise<void>;
  providerCacheContext?: readonly string[];
  prettifyResult?: { success: boolean; text?: string; error?: string };
  prettifyWait?: Promise<void>;
}

function createPrettifySettings(options: TestServiceOptions = {}): PrettifySettings {
  const providerId = options.providerId || 'ollama';
  const ollama = {
    ...DEFAULT_PRETTIFY_SETTINGS.ollama,
    baseUrl: providerId === 'ollama' ? options.baseUrl || 'http://127.0.0.1:11434' : 'http://127.0.0.1:11434',
    model: providerId === 'ollama' ? options.model || 'llama3.2' : 'llama3.2',
  };
  const vllm = {
    ...DEFAULT_PRETTIFY_SETTINGS.vllm,
    baseUrl: providerId === 'vllm' ? options.baseUrl || 'http://127.0.0.1:8000/v1' : 'http://127.0.0.1:8000/v1',
    model: providerId === 'vllm' ? options.model || 'qwen2.5' : 'qwen2.5',
  };

  return {
    ...DEFAULT_PRETTIFY_SETTINGS,
    maxOutputTokens: options.maxOutputTokens ?? DEFAULT_PRETTIFY_SETTINGS.maxOutputTokens,
    minP: options.minP ?? DEFAULT_PRETTIFY_SETTINGS.minP,
    prompt: options.legacyPrompt || 'legacy prompt projection',
    providerId,
    repeatPenalty: options.repeatPenalty ?? DEFAULT_PRETTIFY_SETTINGS.repeatPenalty,
    seed: options.seed ?? DEFAULT_PRETTIFY_SETTINGS.seed,
    temperature: options.temperature ?? DEFAULT_PRETTIFY_SETTINGS.temperature,
    topK: options.topK ?? DEFAULT_PRETTIFY_SETTINGS.topK,
    topP: options.topP ?? DEFAULT_PRETTIFY_SETTINGS.topP,
    ollama,
    vllm,
  };
}

function createTestService(options: TestServiceOptions = {}) {
  const diagnosticCapture = options.diagnosticCapture ?? new RecordingDiagnosticCapture();
  const clipboard = {
    clipboard: 'previous clipboard',
    selection: options.selectionText || '',
  };
  const notifications: Array<{ title: string; body: string; options?: SystemNotificationOptions }> = [];
  const automationCalls: string[] = [];
  const waitCalls: number[] = [];
  const chooserRequests: PrettifyProfileChooserRequest[] = [];
  const prepareCalls: PrettifyExecutionInstruction[] = [];
  const warnings: unknown[][] = [];
  const prettifyCalls: Array<{
    text: string;
    providerId: PrettifyProviderId;
    effectiveInstruction: string;
    model: string;
    baseUrl: string;
    maxOutputTokens: number;
    minP: number;
    repeatPenalty: number;
    seed: number | null;
    temperature: number;
    topK: number;
    topP: number;
    signal?: AbortSignal;
  }> = [];
  const prettifySettings = createPrettifySettings(options);
  let profileManagementOpens = 0;
  let profileCatalogReads = 0;
  const profileCatalog = createTestProfileCatalog({
    id: TEST_PROFILE_ID,
    instruction: options.prompt || 'prompt',
    name: 'Test profile',
  });

  const deps: SelectedTextPrettifyDependencies = {
    actionGate: options.actionGate || new SelectedTextActionGate(),
    chooser: {
      cancel: () => options.chooser?.cancel(),
      focus: () => options.chooser?.focus() ?? false,
      open: (request) => {
        chooserRequests.push(request);
        return options.chooser?.open(request) ?? Promise.resolve<PrettifyProfileChooserOutcome>({ type: 'close' });
      },
    },
    clipboard: {
      readText: (type?: ClipboardType) => clipboard[type || 'clipboard'],
      writeText: (text: string, type?: ClipboardType) => {
        clipboard[type || 'clipboard'] = text;
      },
    },
    cache: options.cache || createTextActionResultCache(20),
    diagnosticCapture,
    getCacheContext: () => options.cacheContext || [],
    logger: {
      info: () => {},
      warn: (...args) => warnings.push(args),
    },
    localization,
    notify: (title, body, options) => {
      notifications.push({ title, body, options });
    },
    openProfileManagement: () => {
      profileManagementOpens += 1;
    },
    platform: options.platform || 'linux',
    profileCatalog: {
      getPrettifyProfileCatalog: () => {
        profileCatalogReads += 1;
        return options.profileCatalog?.getPrettifyProfileCatalog() ?? profileCatalog;
      },
    },
    runtime: options.runtime ?? {
      prepare: async (instruction, _draftSettings, signal) => {
        prepareCalls.push(instruction);
        await options.prepareWait;
        if (options.prepareResult) return options.prepareResult;
        const providerSettings =
          prettifySettings.providerId === 'vllm' ? prettifySettings.vllm : prettifySettings.ollama;
        return {
          success: true as const,
          prepared: {
            providerId: prettifySettings.providerId,
            cacheContext: [
              ...(options.providerCacheContext ?? [
                prettifySettings.providerId,
                providerSettings.baseUrl,
                providerSettings.model,
                String(prettifySettings.temperature),
                String(prettifySettings.topP),
                String(prettifySettings.topK),
                String(prettifySettings.minP),
                String(prettifySettings.repeatPenalty),
                String(prettifySettings.maxOutputTokens),
                prettifySettings.seed === null ? '' : String(prettifySettings.seed),
              ]),
              'instruction-contract-version',
              String(instruction.instructionContractVersion),
              'effective-instruction',
              instruction.effectiveInstruction,
            ],
            execute: async (text: string) => {
              prettifyCalls.push({
                text,
                providerId: prettifySettings.providerId,
                effectiveInstruction: instruction.effectiveInstruction,
                model: providerSettings.model,
                baseUrl: providerSettings.baseUrl,
                maxOutputTokens: prettifySettings.maxOutputTokens,
                minP: prettifySettings.minP,
                repeatPenalty: prettifySettings.repeatPenalty,
                seed: prettifySettings.seed,
                temperature: prettifySettings.temperature,
                topK: prettifySettings.topK,
                topP: prettifySettings.topP,
                signal,
              });
              await options.prettifyWait;
              return options.prettifyResult || { success: true, text: 'prettified text' };
            },
          },
        };
      },
    },
    textAutomation: {
      run: async (action) => {
        automationCalls.push(action);
        if (options.copyError) {
          throw options.copyError;
        }
        if (options.copiedText !== undefined) {
          clipboard.clipboard = options.copiedText;
        }
        return { args: [], command: 'test', requiredExecutable: 'test', strategy: 'linux-x11' };
      },
    },
    wait: async (delayMs) => {
      waitCalls.push(delayMs);
    },
  };

  return {
    automationCalls,
    chooserRequests,
    clipboard,
    diagnosticCapture,
    notifications,
    prepareCalls,
    prettifyCalls,
    getProfileCatalogReads: () => profileCatalogReads,
    getProfileManagementOpens: () => profileManagementOpens,
    service: new SelectedTextPrettifyService(deps),
    waitCalls,
    warnings,
  };
}

describe('selectedTextPrettify', () => {
  afterEach(() => {
    localization.setLocale('en');
  });

  it('keeps the clipboard and fails clearly when no text is selected', async () => {
    const { clipboard, getProfileCatalogReads, notifications, service } = createTestService();

    const result = await service.applyDefaultProfileToSelectedText();

    assert.equal(result.success, false);
    assert.equal(result.error, 'No text selected to prettify');
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.equal(getProfileCatalogReads(), 0);
    assert.deepEqual(notifications, [
      { title: 'Prettify failed', body: 'No text selected to prettify', options: { sound: 'error' } },
    ]);
  });

  it('rejects selected text over the inference limit before calling the provider', async () => {
    const { clipboard, getProfileCatalogReads, notifications, prettifyCalls, service } = createTestService({
      selectionText: 'x'.repeat(MAX_PRETTIFY_SELECTED_TEXT_LENGTH + 1),
    });

    const result = await service.applyDefaultProfileToSelectedText();

    assert.equal(result.success, false);
    assert.equal(
      result.error,
      `Selected text is too long to prettify (maximum ${MAX_PRETTIFY_SELECTED_TEXT_LENGTH} characters)`,
    );
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.equal(getProfileCatalogReads(), 0);
    assert.deepEqual(prettifyCalls, []);
    assert.deepEqual(notifications, [
      {
        title: 'Prettify failed',
        body: `Selected text is too long to prettify (maximum ${MAX_PRETTIFY_SELECTED_TEXT_LENGTH} characters)`,
        options: { sound: 'error' },
      },
    ]);
  });

  it('notifies generation start exactly once before quick provider preparation', async () => {
    const events: string[] = [];
    const runtime: SelectedTextPrettifyDependencies['runtime'] = {
      prepare: async () => {
        events.push('prepare');
        return { success: false, error: 'synthetic preparation failure' };
      },
    };
    const { service } = createTestService({ runtime, selectionText: 'selected source' });

    const result = await service.applyDefaultProfileToSelectedText({
      onGenerationStarted: () => events.push('generation-started'),
    });

    assert.equal(result.success, false);
    assert.deepEqual(events, ['generation-started', 'prepare']);
  });

  it('does not present chooser generation until Apply resolves a snapshotted profile', async () => {
    const deferredChooser = createDeferredChooser();
    const events: string[] = [];
    const runtime: SelectedTextPrettifyDependencies['runtime'] = {
      prepare: async () => {
        events.push('prepare');
        return { success: false, error: 'synthetic preparation failure' };
      },
    };
    const { chooserRequests, service } = createTestService({
      chooser: deferredChooser.chooser,
      runtime,
      selectionText: 'selected source',
    });

    const run = service.chooseProfileForSelectedText({
      onGenerationStarted: () => events.push('generation-started'),
    });
    await waitForCondition(() => chooserRequests.length === 1, 'chooser did not open');
    assert.deepEqual(events, []);

    deferredChooser.resolve({ type: 'apply', profileId: TEST_PROFILE_ID });
    const result = await run;

    assert.equal(result.success, false);
    assert.deepEqual(events, ['generation-started', 'prepare']);
  });

  it('keeps observer failures content-free and does not interrupt generation', async () => {
    const privateObserverError = 'private-observer-message';
    const { service, warnings } = createTestService({ selectionText: 'selected source' });

    const result = await service.applyDefaultProfileToSelectedText({
      onGenerationStarted: () => {
        throw new Error(privateObserverError);
      },
    });

    assert.equal(result.success, true);
    assert.equal(warnings.length, 1);
    assert.doesNotMatch(JSON.stringify(warnings), new RegExp(privateObserverError));
  });

  it('reads the authoritative catalog once and executes its default profile without the legacy prompt', async () => {
    const { getProfileCatalogReads, prepareCalls, service } = createTestService({
      legacyPrompt: 'private-legacy-prompt-canary',
      prompt: 'private-default-profile-instruction-canary',
      selectionText: 'selected text',
    });

    assert.equal((await service.applyDefaultProfileToSelectedText()).success, true);
    assert.equal(getProfileCatalogReads(), 1);
    assert.equal(prepareCalls.length, 1);
    assert.equal(prepareCalls[0]?.effectiveInstruction.includes('private-default-profile-instruction-canary'), true);
    assert.equal(prepareCalls[0]?.effectiveInstruction.includes('private-legacy-prompt-canary'), false);
    assert.equal(prepareCalls[0]?.instructionContractVersion, 1);
  });

  it('uses the Linux selection clipboard', async () => {
    const { automationCalls, clipboard, prettifyCalls, service, waitCalls } = createTestService({
      copyError: new Error('copy unavailable'),
      selectionText: 'primary selection',
    });

    const result = await service.applyDefaultProfileToSelectedText();

    assert.equal(result.success, true);
    assert.equal(clipboard.clipboard, 'prettified text');
    assert.deepEqual(automationCalls, ['copy']);
    assert.deepEqual(waitCalls, []);
    assert.equal(prettifyCalls.length, 1);
    assert.equal(prettifyCalls[0]?.text, 'primary selection');
    assert.equal(prettifyCalls[0]?.effectiveInstruction.endsWith('prompt'), true);
    assert.equal(prettifyCalls[0]?.providerId, 'ollama');
    assert.equal(prettifyCalls[0]?.model, 'llama3.2');
    assert.equal(prettifyCalls[0]?.signal instanceof AbortSignal, true);
    assert.equal(prettifyCalls[0]?.signal?.aborted, false);
  });

  it('uses copy automation on non-Linux platforms', async () => {
    const { automationCalls, clipboard, prettifyCalls, service, waitCalls } = createTestService({
      copiedText: 'copied selection',
      platform: 'darwin',
    });

    const result = await service.applyDefaultProfileToSelectedText();

    assert.equal(result.success, true);
    assert.equal(clipboard.clipboard, 'prettified text');
    assert.deepEqual(automationCalls, ['copy']);
    assert.deepEqual(waitCalls, [120]);
    assert.equal(prettifyCalls[0]?.text, 'copied selection');
  });

  it('passes the configured prettify provider settings to the prettify service', async () => {
    const { prettifyCalls, service } = createTestService({
      providerId: 'vllm',
      baseUrl: 'http://127.0.0.1:9000/v1',
      model: 'qwen3',
      maxOutputTokens: 512,
      minP: 0.05,
      repeatPenalty: 1.1,
      seed: 7,
      temperature: 0.4,
      topK: 32,
      topP: 0.8,
      selectionText: 'selected text',
    });

    const result = await service.applyDefaultProfileToSelectedText();

    assert.equal(result.success, true);
    assert.equal(prettifyCalls.length, 1);
    assert.equal(prettifyCalls[0]?.providerId, 'vllm');
    assert.equal(prettifyCalls[0]?.baseUrl, 'http://127.0.0.1:9000/v1');
    assert.equal(prettifyCalls[0]?.model, 'qwen3');
    assert.equal(prettifyCalls[0]?.maxOutputTokens, 512);
    assert.equal(prettifyCalls[0]?.minP, 0.05);
    assert.equal(prettifyCalls[0]?.repeatPenalty, 1.1);
    assert.equal(prettifyCalls[0]?.seed, 7);
    assert.equal(prettifyCalls[0]?.temperature, 0.4);
    assert.equal(prettifyCalls[0]?.topK, 32);
    assert.equal(prettifyCalls[0]?.topP, 0.8);
  });

  it('keeps the previous clipboard when prettify fails', async () => {
    const { clipboard, notifications, service } = createTestService({
      selectionText: 'selected text',
      prettifyResult: { success: false, error: 'provider unavailable' },
    });

    const result = await service.applyDefaultProfileToSelectedText();

    assert.equal(result.success, false);
    assert.equal(result.error, 'provider unavailable');
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(notifications, [
      { title: 'Prettify failed', body: 'provider unavailable', options: { sound: 'error' } },
    ]);
  });

  it('restores the clipboard when provider preparation fails before execution', async () => {
    const { clipboard, notifications, prepareCalls, prettifyCalls, service } = createTestService({
      selectionText: 'selected text',
      prepareResult: { success: false, error: 'CLI unavailable' },
    });

    const result = await service.applyDefaultProfileToSelectedText();

    assert.equal(result.success, false);
    assert.equal(result.error, 'CLI unavailable');
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.equal(prepareCalls.length, 1);
    assert.equal(prettifyCalls.length, 0);
    assert.deepEqual(notifications, [
      { title: 'Prettify failed', body: 'CLI unavailable', options: { sound: 'error' } },
    ]);
  });

  it('restores the clipboard and shows provider errors', async () => {
    const cooldownError = 'Failed to connect to Ollama';
    const { clipboard, notifications, service } = createTestService({
      selectionText: 'selected text',
      prettifyResult: { success: false, error: cooldownError },
    });

    const result = await service.applyDefaultProfileToSelectedText();

    assert.equal(result.success, false);
    assert.equal(result.error, 'Could not connect to Ollama. Make sure it is running and the URL is correct.');
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(notifications, [
      {
        title: 'Prettify failed',
        body: 'Could not connect to Ollama. Make sure it is running and the URL is correct.',
        options: { sound: 'error' },
      },
    ]);
  });

  it('copies prettified text to the clipboard on success', async () => {
    const { clipboard, notifications, service } = createTestService({ selectionText: 'selected text' });

    const result = await service.applyDefaultProfileToSelectedText();

    assert.equal(result.success, true);
    assert.equal(result.status, 'Selection prettified');
    assert.equal(clipboard.clipboard, 'prettified text');
    assert.deepEqual(notifications, [
      { title: 'Text prettified', body: 'Selection prettified', options: { sound: 'success' } },
    ]);
  });

  it('copies cached prettified text for repeated selected text and settings', async () => {
    const { clipboard, notifications, prepareCalls, prettifyCalls, service } = createTestService({
      selectionText: 'selected text',
      prettifyResult: { success: true, text: 'cached prettified text' },
    });

    const first = await service.applyDefaultProfileToSelectedText();
    const second = await service.applyDefaultProfileToSelectedText();

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.equal(clipboard.clipboard, 'cached prettified text');
    assert.equal(prepareCalls.length, 2);
    assert.equal(prettifyCalls.length, 1);
    assert.deepEqual(notifications, [
      { title: 'Text prettified', body: 'Selection prettified', options: { sound: 'success' } },
      { title: 'Text prettified', body: 'Selection prettified', options: { sound: 'success' } },
    ]);
  });

  it('keeps profile presentation, ID, default marker, and chooser order out of cache identity', async () => {
    const cache = createTextActionResultCache(20);
    const instruction = 'Use the same exact transformation semantics.';
    const firstCatalog = createTestProfileCatalog({
      description: 'First description',
      id: 'custom:00000000-0000-4000-8000-000000000010',
      instruction,
      name: 'First name',
    });
    const secondCatalog = createTestProfileCatalog({
      description: 'Second description',
      id: 'custom:00000000-0000-4000-8000-000000000011',
      instruction,
      name: 'Second name',
      reverseOrder: true,
    });
    const first = createTestService({
      cache,
      profileCatalog: { getPrettifyProfileCatalog: () => firstCatalog },
      selectionText: 'selected text',
      prettifyResult: { success: true, text: 'cached result' },
    });
    const second = createTestService({
      cache,
      profileCatalog: { getPrettifyProfileCatalog: () => secondCatalog },
      selectionText: 'selected text',
    });

    await first.service.applyDefaultProfileToSelectedText();
    await second.service.applyDefaultProfileToSelectedText();

    assert.equal(first.prettifyCalls.length, 1);
    assert.equal(second.prettifyCalls.length, 0);
    assert.equal(second.clipboard.clipboard, 'cached result');
  });

  it('misses cache when the exact effective instruction changes', async () => {
    const cache = createTextActionResultCache(20);
    const first = createTestService({
      cache,
      prompt: 'Use concise prose.',
      selectionText: 'selected text',
      prettifyResult: { success: true, text: 'first result' },
    });
    const second = createTestService({
      cache,
      prompt: 'Use detailed prose.',
      selectionText: 'selected text',
      prettifyResult: { success: true, text: 'second result' },
    });

    await first.service.applyDefaultProfileToSelectedText();
    await second.service.applyDefaultProfileToSelectedText();

    assert.equal(first.prettifyCalls.length, 1);
    assert.equal(second.prettifyCalls.length, 1);
    assert.equal(second.clipboard.clipboard, 'second result');
  });

  it('retains only digest cache keys without raw source or instruction', async () => {
    const retained = new Map<string, string>();
    const cache: TextActionResultCache = {
      clear: () => retained.clear(),
      get: (key) => retained.get(key) ?? null,
      set: (key, value) => {
        retained.set(key, value);
      },
      size: () => retained.size,
    };
    const source = 'private-source-cache-canary';
    const instruction = 'private-instruction-cache-canary';
    const service = createTestService({
      cache,
      prompt: instruction,
      selectionText: source,
      prettifyResult: { success: true, text: 'safe cached result' },
    }).service;

    await service.applyDefaultProfileToSelectedText();

    assert.equal(retained.size, 1);
    const serializedEntries = JSON.stringify([...retained.entries()]);
    const [key] = retained.keys();
    assert.match(key ?? '', /^[a-f0-9]{64}$/u);
    assert.equal(serializedEntries.includes(source), false);
    assert.equal(serializedEntries.includes(instruction), false);
  });

  it('keeps cache hits free of prettify provider operations', async () => {
    const audit = new RecordingPrettifyProviderAudit();
    const { diagnosticCapture, service } = createTestService({
      selectionText: 'selected text',
      runtime: new PrettifyRuntimeFixture({
        audit,
        fetch: async () => ({
          status: 200,
          text: async () => JSON.stringify({ message: { content: 'cached prettified text' } }),
        }),
        settings: new TestPrettifySettingsStorage({
          ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2' },
          providerId: 'ollama',
        }),
      }).runtime,
    });

    assert.equal((await service.applyDefaultProfileToSelectedText()).success, true);
    assert.equal((await service.applyDefaultProfileToSelectedText()).success, true);
    assert.equal(audit.operations.filter((operation) => operation.input.operation === 'prepare').length, 2);
    assert.equal(audit.operations.filter((operation) => operation.input.operation === 'prettify').length, 1);
    assert.deepEqual(diagnosticCapture.prettifyCacheInputs, [
      {
        providerId: 'ollama',
        resultText: 'cached prettified text',
        sourceText: 'selected text',
      },
    ]);
  });

  it('keeps a Prettify cache hit successful when capture throws', async () => {
    const cache = createTextActionResultCache(20);
    const first = createTestService({
      cache,
      selectionText: 'selected text',
      prettifyResult: { success: true, text: 'cached result' },
    });
    await first.service.applyDefaultProfileToSelectedText();
    const diagnosticCapture = new RecordingDiagnosticCapture();
    diagnosticCapture.throwOnCacheCapture = true;
    const cached = createTestService({
      cache,
      diagnosticCapture,
      selectionText: 'selected text',
    });

    const result = await cached.service.applyDefaultProfileToSelectedText();

    assert.equal(result.success, true);
    assert.equal(cached.prettifyCalls.length, 0);
    assert.equal(cached.clipboard.clipboard, 'cached result');
    assert.equal(cached.notifications.length, 1);
  });

  it('keeps CLI cache hits free of duplicate prettify operations', async () => {
    const audit = new RecordingPrettifyProviderAudit();
    const { service } = createTestService({
      providerId: 'claude-cli',
      selectionText: 'selected text',
      runtime: new PrettifyRuntimeFixture({
        audit,
        claudeCliAdapter: {
          checkAvailability: async () => ({
            capabilityVersion: '2.1.71',
            success: true as const,
          }),
          prepare: async () => ({
            prepared: {
              cacheContext: ['claude-cli', '2.1.71', 'safe-capability-context'],
              execute: async () => ({
                capabilityVersion: '2.1.71',
                success: true as const,
                text: 'cached prettified text',
              }),
              providerCapabilityVersion: '2.1.71',
            },
            success: true as const,
          }),
        },
        fetch: async () => {
          throw new Error('HTTP must not run for CLI providers');
        },
        settings: new TestPrettifySettingsStorage({ providerId: 'claude-cli' }),
      }).runtime,
    });

    assert.equal((await service.applyDefaultProfileToSelectedText()).success, true);
    assert.equal((await service.applyDefaultProfileToSelectedText()).success, true);
    assert.equal(audit.operations.filter((operation) => operation.input.operation === 'prepare').length, 2);
    assert.equal(audit.operations.filter((operation) => operation.input.operation === 'settings-readiness').length, 2);
    assert.equal(audit.operations.filter((operation) => operation.input.operation === 'prettify').length, 1);
  });

  it('misses the cache when the prepared provider capability version changes', async () => {
    const cache = createTextActionResultCache(20);
    const first = createTestService({
      cache,
      providerCacheContext: ['claude-cli', '2.1.71', '', '', 'default', 'prompt'],
      selectionText: 'selected text',
      prettifyResult: { success: true, text: 'first result' },
    });
    const second = createTestService({
      cache,
      providerCacheContext: ['claude-cli', '2.1.72', '', '', 'default', 'prompt'],
      selectionText: 'selected text',
      prettifyResult: { success: true, text: 'second result' },
    });

    await first.service.applyDefaultProfileToSelectedText();
    await second.service.applyDefaultProfileToSelectedText();

    assert.equal(first.prepareCalls.length, 1);
    assert.equal(second.prepareCalls.length, 1);
    assert.equal(first.prettifyCalls.length, 1);
    assert.equal(second.prettifyCalls.length, 1);
    assert.equal(second.clipboard.clipboard, 'second result');
  });

  it('misses the prettify cache when settings change', async () => {
    const cache = createTextActionResultCache(20);
    const first = createTestService({
      cache,
      selectionText: 'selected text',
      prompt: 'same prompt',
      model: 'llama3.2',
      prettifyResult: { success: true, text: 'first result' },
    });
    const second = createTestService({
      cache,
      selectionText: 'selected text',
      prompt: 'same prompt',
      model: 'llama3.3',
      prettifyResult: { success: true, text: 'second result' },
    });

    await first.service.applyDefaultProfileToSelectedText();
    await second.service.applyDefaultProfileToSelectedText();

    assert.equal(first.prettifyCalls.length, 1);
    assert.equal(second.prettifyCalls.length, 1);
    assert.equal(second.clipboard.clipboard, 'second result');
  });

  it('misses the prettify cache when provider/base URL/model/temperature changes', async () => {
    const cache = createTextActionResultCache(20);
    const first = createTestService({
      cache,
      selectionText: 'selected text',
      providerId: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llama3.2',
      temperature: 0,
      prettifyResult: { success: true, text: 'ollama result' },
    });
    const second = createTestService({
      cache,
      selectionText: 'selected text',
      providerId: 'vllm',
      baseUrl: 'http://127.0.0.1:8000/v1',
      model: 'qwen2.5',
      temperature: 0,
      prettifyResult: { success: true, text: 'vllm result' },
    });
    const third = createTestService({
      cache,
      selectionText: 'selected text',
      providerId: 'vllm',
      baseUrl: 'http://127.0.0.1:8001/v1',
      model: 'qwen2.5',
      temperature: 0.2,
      prettifyResult: { success: true, text: 'new vllm result' },
    });

    await first.service.applyDefaultProfileToSelectedText();
    await second.service.applyDefaultProfileToSelectedText();
    await third.service.applyDefaultProfileToSelectedText();

    assert.equal(first.prettifyCalls.length, 1);
    assert.equal(second.prettifyCalls.length, 1);
    assert.equal(third.prettifyCalls.length, 1);
    assert.equal(third.clipboard.clipboard, 'new vllm result');
  });

  it('misses the prettify cache when generation settings change', async () => {
    const cache = createTextActionResultCache(20);
    const first = createTestService({
      cache,
      selectionText: 'selected text',
      maxOutputTokens: 0,
      minP: 0,
      repeatPenalty: 1,
      seed: null,
      topK: 40,
      topP: 0.9,
      prettifyResult: { success: true, text: 'default generation result' },
    });
    const second = createTestService({
      cache,
      selectionText: 'selected text',
      maxOutputTokens: 512,
      minP: 0.05,
      repeatPenalty: 1.1,
      seed: 7,
      topK: 32,
      topP: 0.8,
      prettifyResult: { success: true, text: 'custom generation result' },
    });

    await first.service.applyDefaultProfileToSelectedText();
    await second.service.applyDefaultProfileToSelectedText();

    assert.equal(first.prettifyCalls.length, 1);
    assert.equal(second.prettifyCalls.length, 1);
    assert.equal(second.clipboard.clipboard, 'custom generation result');
  });

  it('does not cache failed prettify results', async () => {
    const cache = createTextActionResultCache(20);
    const first = createTestService({
      cache,
      selectionText: 'selected text',
      prettifyResult: { success: false, error: 'provider unavailable' },
    });
    const second = createTestService({
      cache,
      selectionText: 'selected text',
      prettifyResult: { success: true, text: 'prettified after failure' },
    });

    await first.service.applyDefaultProfileToSelectedText();
    const secondResult = await second.service.applyDefaultProfileToSelectedText();

    assert.equal(secondResult.success, true);
    assert.equal(first.prettifyCalls.length, 1);
    assert.equal(second.prettifyCalls.length, 1);
    assert.equal(second.clipboard.clipboard, 'prettified after failure');
  });

  it('restores the clipboard before opening a safe chooser payload and prepares only after Apply', async () => {
    const deferredChooser = createDeferredChooser();
    const { chooserRequests, clipboard, getProfileCatalogReads, prepareCalls, prettifyCalls, service } =
      createTestService({
        chooser: deferredChooser.chooser,
        prompt: 'chooser-only instruction',
        selectionText: 'selected source',
      });

    const active = service.chooseProfileForSelectedText();
    await waitForCondition(() => chooserRequests.length === 1, 'chooser did not open');

    const request = chooserRequests[0];
    assert.ok(request);
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.equal(getProfileCatalogReads(), 1);
    assert.equal(prepareCalls.length, 0);
    assert.equal(request.sourceText, 'selected source');
    assert.deepEqual(
      request.profiles.map(({ id }) => id),
      ['prompt-ready', 'polish', 'professional', 'natural', TEST_PROFILE_ID],
    );
    assert.equal(
      request.profiles.every((profile) => !Object.prototype.hasOwnProperty.call(profile, 'instruction')),
      true,
    );
    assert.equal(Object.isFrozen(request.profiles), true);
    assert.equal(Object.isFrozen(request.profiles[0]), true);

    clipboard.clipboard = 'changed while choosing';
    deferredChooser.resolve({ profileId: TEST_PROFILE_ID, type: 'apply' });
    const result = await active;

    assert.equal(result.success, true);
    assert.equal(prepareCalls.length, 1);
    assert.equal(prettifyCalls.length, 1);
    assert.equal(prettifyCalls[0]?.text, 'selected source');
    assert.match(prettifyCalls[0]?.effectiveInstruction ?? '', /chooser-only instruction/u);
    assert.equal(clipboard.clipboard, 'prettified text');

    assert.equal((await service.applyDefaultProfileToSelectedText()).success, true);
    assert.equal(prepareCalls.length, 2);
    assert.equal(prettifyCalls.length, 1);
  });

  it('keeps clipboard changes on chooser Close, Manage profiles, and cancellation', async () => {
    const closeChooser = createDeferredChooser();
    const closeRun = createTestService({
      chooser: closeChooser.chooser,
      selectionText: 'selected source',
    });
    const closing = closeRun.service.chooseProfileForSelectedText();
    await waitForCondition(() => closeRun.chooserRequests.length === 1, 'close chooser did not open');
    closeRun.clipboard.clipboard = 'changed before close';
    closeChooser.resolve({ type: 'close' });

    assert.equal((await closing).cancelled, true);
    assert.equal(closeRun.clipboard.clipboard, 'changed before close');
    assert.equal(closeRun.prepareCalls.length, 0);

    const manageChooser = createDeferredChooser();
    const manageRun = createTestService({
      chooser: manageChooser.chooser,
      selectionText: 'selected source',
    });
    const managing = manageRun.service.chooseProfileForSelectedText();
    await waitForCondition(() => manageRun.chooserRequests.length === 1, 'manage chooser did not open');
    manageRun.clipboard.clipboard = 'changed before manage';
    manageChooser.resolve({ type: 'manageProfiles' });

    assert.equal((await managing).cancelled, true);
    assert.equal(manageRun.clipboard.clipboard, 'changed before manage');
    assert.equal(manageRun.getProfileManagementOpens(), 1);
    assert.equal(manageRun.prepareCalls.length, 0);

    const cancelChooser = createDeferredChooser();
    const cancelRun = createTestService({
      chooser: cancelChooser.chooser,
      selectionText: 'selected source',
    });
    const cancelling = cancelRun.service.chooseProfileForSelectedText();
    await waitForCondition(() => cancelRun.chooserRequests.length === 1, 'cancel chooser did not open');
    cancelRun.clipboard.clipboard = 'changed before cancel';
    assert.equal(cancelRun.service.cancel()?.cancelled, true);
    cancelRun.service.dispose();
    cancelRun.service.dispose();

    assert.equal((await cancelling).cancelled, true);
    assert.equal(cancelChooser.getCancelCount(), 1);
    assert.equal(cancelRun.clipboard.clipboard, 'changed before cancel');
    assert.equal(cancelRun.prepareCalls.length, 0);
  });

  it('focuses one existing chooser without recapturing source or starting provider work', async () => {
    const deferredChooser = createDeferredChooser();
    const { automationCalls, chooserRequests, prepareCalls, service } = createTestService({
      chooser: deferredChooser.chooser,
      selectionText: 'original source',
    });

    const first = service.chooseProfileForSelectedText();
    await waitForCondition(() => chooserRequests.length === 1, 'chooser did not open');
    const repeated = await service.chooseProfileForSelectedText();

    assert.equal(repeated.skipped, true);
    assert.equal(deferredChooser.getFocusCount(), 1);
    assert.equal(service.focusExistingChooser(), true);
    assert.equal(deferredChooser.getFocusCount(), 2);
    assert.deepEqual(automationCalls, ['copy']);
    assert.equal(chooserRequests.length, 1);
    assert.equal(chooserRequests[0]?.sourceText, 'original source');
    assert.equal(prepareCalls.length, 0);

    deferredChooser.resolve({ type: 'close' });
    assert.equal((await first).cancelled, true);
  });

  it('applies the immutable opening snapshot while later operations observe the replaced catalog', async () => {
    let resolveFirst!: (outcome: PrettifyProfileChooserOutcome) => void;
    const firstOutcome = new Promise<PrettifyProfileChooserOutcome>((resolve) => {
      resolveFirst = resolve;
    });
    let chooserOpenCount = 0;
    const chooser: SelectedTextPrettifyDependencies['chooser'] = {
      cancel: () => resolveFirst({ type: 'cancel' }),
      focus: () => true,
      open: () => {
        chooserOpenCount += 1;
        return chooserOpenCount === 1 ? firstOutcome : Promise.resolve({ type: 'close' });
      },
    };
    const mutableCatalog: {
      chooserOrder: PrettifyProfileId[];
      customProfiles: Array<{
        id: PrettifyCustomProfileId;
        instruction: ValidatedPrettifyProfileInstruction;
        name: string;
      }>;
      defaultProfileId: PrettifyProfileId;
      schemaVersion: typeof PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION;
    } = {
      chooserOrder: ['prompt-ready', 'polish', 'professional', 'natural', TEST_PROFILE_ID],
      customProfiles: [
        {
          id: TEST_PROFILE_ID,
          instruction: normalizePrettifyProfileInstruction('opening snapshot instruction'),
          name: 'Opening profile',
        },
      ],
      defaultProfileId: TEST_PROFILE_ID,
      schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
    };
    let currentCatalog = mutableCatalog as unknown as PrettifyProfileCatalog;
    const run = createTestService({
      chooser,
      profileCatalog: {
        getPrettifyProfileCatalog: () => currentCatalog,
      },
      selectionText: 'selected source',
    });

    const choosing = run.service.chooseProfileForSelectedText();
    await waitForCondition(() => run.chooserRequests.length === 1, 'snapshot chooser did not open');

    const mutableProfile = mutableCatalog.customProfiles[0];
    assert.ok(mutableProfile);
    mutableProfile.instruction = normalizePrettifyProfileInstruction('mutated live instruction');
    mutableProfile.name = 'Mutated live profile';
    mutableCatalog.chooserOrder.reverse();
    mutableCatalog.defaultProfileId = 'prompt-ready';
    currentCatalog = normalizePrettifyProfileCatalog({
      chooserOrder: [SECOND_TEST_PROFILE_ID, 'natural', 'professional', 'polish', 'prompt-ready'],
      customProfiles: [
        {
          id: SECOND_TEST_PROFILE_ID,
          instruction: normalizePrettifyProfileInstruction('replacement catalog instruction'),
          name: 'Replacement profile',
        },
      ],
      defaultProfileId: SECOND_TEST_PROFILE_ID,
      schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
    });
    resolveFirst({ profileId: TEST_PROFILE_ID, type: 'apply' });

    assert.equal((await choosing).success, true);
    assert.match(run.prettifyCalls[0]?.effectiveInstruction ?? '', /opening snapshot instruction/u);
    assert.doesNotMatch(run.prettifyCalls[0]?.effectiveInstruction ?? '', /mutated live instruction/u);

    assert.equal((await run.service.applyDefaultProfileToSelectedText()).success, true);
    assert.match(run.prettifyCalls[1]?.effectiveInstruction ?? '', /replacement catalog instruction/u);

    assert.equal((await run.service.chooseProfileForSelectedText()).cancelled, true);
    assert.deepEqual(
      run.chooserRequests[1]?.profiles.map(({ id }) => id),
      [SECOND_TEST_PROFILE_ID, 'natural', 'professional', 'polish', 'prompt-ready'],
    );
    assert.equal(run.getProfileCatalogReads(), 3);
  });

  it('rejects a profile added after chooser open without provider work', async () => {
    const deferredChooser = createDeferredChooser();
    let currentCatalog = createTestProfileCatalog({
      id: TEST_PROFILE_ID,
      instruction: 'opening instruction',
      name: 'Opening profile',
    });
    const run = createTestService({
      chooser: deferredChooser.chooser,
      profileCatalog: {
        getPrettifyProfileCatalog: () => currentCatalog,
      },
      selectionText: 'selected source',
    });

    const active = run.service.chooseProfileForSelectedText();
    await waitForCondition(() => run.chooserRequests.length === 1, 'chooser did not open');
    currentCatalog = createTestProfileCatalog({
      id: SECOND_TEST_PROFILE_ID,
      instruction: 'new instruction',
      name: 'New profile',
    });
    deferredChooser.resolve({ profileId: SECOND_TEST_PROFILE_ID, type: 'apply' });
    const result = await active;

    assert.equal(result.success, false);
    assert.equal(run.prepareCalls.length, 0);
    assert.equal(run.getProfileCatalogReads(), 1);
    assert.equal(run.notifications.length, 1);
    assert.equal(run.notifications[0]?.body.includes(SECOND_TEST_PROFILE_ID), false);
  });

  it('remembers an applied chooser profile only while it exists in a later session snapshot', async () => {
    const outcomes: PrettifyProfileChooserOutcome[] = [
      { profileId: TEST_PROFILE_ID, type: 'apply' },
      { type: 'close' },
      { type: 'close' },
    ];
    let currentCatalog = createTestProfileCatalog({
      id: TEST_PROFILE_ID,
      instruction: 'remembered instruction',
      name: 'Remembered profile',
    });
    const run = createTestService({
      chooser: {
        cancel: () => undefined,
        focus: () => true,
        open: () => {
          const outcome = outcomes.shift();
          if (!outcome) throw new Error('Unexpected chooser open');
          return Promise.resolve(outcome);
        },
      },
      profileCatalog: {
        getPrettifyProfileCatalog: () => currentCatalog,
      },
      selectionText: 'selected source',
    });

    assert.equal((await run.service.chooseProfileForSelectedText()).success, true);
    assert.equal((await run.service.chooseProfileForSelectedText()).cancelled, true);
    assert.equal(run.chooserRequests[1]?.initialProfileId, TEST_PROFILE_ID);

    currentCatalog = normalizePrettifyProfileCatalog({
      chooserOrder: ['prompt-ready', 'polish', 'professional', 'natural'],
      customProfiles: [],
      defaultProfileId: 'prompt-ready',
      schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
    });
    assert.equal((await run.service.chooseProfileForSelectedText()).cancelled, true);
    assert.equal(Object.prototype.hasOwnProperty.call(run.chooserRequests[2] ?? {}, 'initialProfileId'), false);
  });

  it('silently skips duplicate concurrent hotkey presses', async () => {
    let finishPrettify!: () => void;
    const prettifyWait = new Promise<void>((resolve) => {
      finishPrettify = resolve;
    });
    const { notifications, prettifyCalls, service } = createTestService({
      selectionText: 'selected text',
      prettifyWait,
    });

    const first = service.applyDefaultProfileToSelectedText();
    const second = await service.applyDefaultProfileToSelectedText();
    finishPrettify();
    const firstResult = await first;

    assert.equal(second.success, false);
    assert.equal(second.skipped, true);
    assert.equal(second.status, '');
    assert.equal(firstResult.success, true);
    assert.equal(prettifyCalls.length, 1);
    assert.deepEqual(notifications, [
      { title: 'Text prettified', body: 'Selection prettified', options: { sound: 'success' } },
    ]);
  });

  it('silently skips prettify while translation is active', async () => {
    const actionGate = new SelectedTextActionGate();
    assert.equal(actionGate.tryBegin('translate'), true);
    const { automationCalls, notifications, prettifyCalls, service } = createTestService({
      actionGate,
      selectionText: 'selected text',
    });

    const result = await service.applyDefaultProfileToSelectedText();

    assert.equal(result.success, false);
    assert.equal(result.skipped, true);
    assert.deepEqual(automationCalls, []);
    assert.deepEqual(prettifyCalls, []);
    assert.deepEqual(notifications, []);
  });

  it('cancels an active prettify request, restores the clipboard, and suppresses late results', async () => {
    let finishPrettify!: () => void;
    const prettifyWait = new Promise<void>((resolve) => {
      finishPrettify = resolve;
    });
    const { clipboard, notifications, prettifyCalls, service } = createTestService({
      selectionText: 'selected text',
      prettifyWait,
    });

    const first = service.applyDefaultProfileToSelectedText();
    for (let attempts = 0; attempts < 20 && prettifyCalls.length === 0; attempts += 1) {
      await Promise.resolve();
    }
    clipboard.clipboard = 'changed while generating';
    const cancelResult = service.cancel();

    assert.equal(prettifyCalls.length, 1);
    assert.deepEqual(cancelResult, {
      cancelled: true,
      success: false,
      status: 'Prettify cancelled',
      error: 'Prettify cancelled',
    });
    assert.equal(prettifyCalls[0]?.signal?.aborted, true);
    assert.equal(clipboard.clipboard, 'changed while generating');
    assert.deepEqual(notifications, []);

    finishPrettify();
    const firstResult = await first;

    assert.deepEqual(firstResult, {
      cancelled: true,
      success: false,
      status: 'Prettify cancelled',
      error: 'Prettify cancelled',
    });
    assert.equal(clipboard.clipboard, 'changed while generating');
    assert.deepEqual(notifications, []);
  });

  it('cancels during provider preparation without executing generation', async () => {
    let finishPreparation!: () => void;
    const prepareWait = new Promise<void>((resolve) => {
      finishPreparation = resolve;
    });
    const { clipboard, notifications, prepareCalls, prettifyCalls, service } = createTestService({
      selectionText: 'selected text',
      prepareWait,
    });

    const active = service.applyDefaultProfileToSelectedText();
    for (let attempts = 0; attempts < 5 && prepareCalls.length === 0; attempts += 1) {
      await Promise.resolve();
    }
    const cancelled = service.cancel();
    finishPreparation();
    const result = await active;

    assert.equal(cancelled?.status, 'Prettify cancelled');
    assert.equal(cancelled?.cancelled, true);
    assert.equal(result.status, 'Prettify cancelled');
    assert.equal(result.cancelled, true);
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.equal(prettifyCalls.length, 0);
    assert.deepEqual(notifications, []);
  });

  it('returns null when cancelling with no active prettify request', () => {
    const { service } = createTestService({ selectionText: 'selected text' });

    assert.equal(service.cancel(), null);
  });

  it('allows a new prettify request after a cancelled run settles', async () => {
    let finishPrettify!: () => void;
    const prettifyWait = new Promise<void>((resolve) => {
      finishPrettify = resolve;
    });
    const { clipboard, prettifyCalls, service } = createTestService({ selectionText: 'selected text', prettifyWait });

    const first = service.applyDefaultProfileToSelectedText();
    for (let attempts = 0; attempts < 20 && prettifyCalls.length === 0; attempts += 1) {
      await Promise.resolve();
    }
    assert.equal(prettifyCalls.length, 1);
    assert.equal(service.cancel()?.status, 'Prettify cancelled');
    finishPrettify();
    await first;

    const second = await service.applyDefaultProfileToSelectedText();

    assert.equal(second.success, true);
    assert.equal(clipboard.clipboard, 'prettified text');
    assert.equal(prettifyCalls.length, 2);
  });
});
