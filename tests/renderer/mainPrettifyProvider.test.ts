import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getMainPrettifyProviderViewState, reduceMainPrettifyProviderSelection } from '@renderer/mainPrettifyProvider';
import { DEFAULT_PRETTIFY_SETTINGS, type PrettifySettings } from '@shared/prettifySettings';

function createSettings(overrides: Partial<PrettifySettings> = {}): PrettifySettings {
  return {
    ...DEFAULT_PRETTIFY_SETTINGS,
    ...overrides,
    claudeCli: { ...DEFAULT_PRETTIFY_SETTINGS.claudeCli, ...overrides.claudeCli },
    codexCli: { ...DEFAULT_PRETTIFY_SETTINGS.codexCli, ...overrides.codexCli },
    ollama: { ...DEFAULT_PRETTIFY_SETTINGS.ollama, ...overrides.ollama },
    vllm: { ...DEFAULT_PRETTIFY_SETTINGS.vllm, ...overrides.vllm },
  };
}

describe('main Prettify provider view state', () => {
  it('shows Ollama model memory without hiding an unconfigured provider', () => {
    assert.deepEqual(getMainPrettifyProviderViewState(createSettings(), []), {
      connection: null,
      model: '',
      modelFallbackKey: 'prettify.noModels',
      ollamaControl: null,
      providerId: 'ollama',
      providerLabelKey: 'prettify.provider.ollama',
      status: { labelKey: 'mainDock.prettifyNotConfigured', tone: 'neutral' },
    });

    const configured = createSettings({ ollama: { ...DEFAULT_PRETTIFY_SETTINGS.ollama, model: 'gemma3:1b' } });
    assert.equal(
      getMainPrettifyProviderViewState(configured, [{ id: 'gemma3:1b', isLoaded: true, name: 'Gemma' }]).status
        ?.labelKey,
      'modelMemory.loaded',
    );
  });

  it('adapts safe summaries for vLLM, Claude CLI, and Codex CLI', () => {
    const vllm = getMainPrettifyProviderViewState(
      createSettings({ providerId: 'vllm', vllm: { ...DEFAULT_PRETTIFY_SETTINGS.vllm, model: 'qwen' } }),
      [],
    );
    assert.equal(vllm.model, 'qwen');
    assert.deepEqual(vllm.status, { labelKey: 'mainDock.prettifyConfigured', tone: 'success' });

    const claudeSettings = createSettings({
      providerId: 'claude-cli',
      claudeCli: { ...DEFAULT_PRETTIFY_SETTINGS.claudeCli, effort: 'high' },
    });
    const claude = getMainPrettifyProviderViewState(claudeSettings, [], {
      providerId: 'claude-cli',
      status: 'connected',
    });
    assert.equal(claude.modelFallbackKey, 'prettify.providerDefault');
    assert.equal(claude.status, null);
    assert.deepEqual(claude.connection, {
      labelKey: 'provider.connected',
      tone: 'success',
      valueKey: 'prettify.cli.statusAvailable',
    });

    const codex = getMainPrettifyProviderViewState(createSettings({ providerId: 'codex-cli' }), [], {
      providerId: 'codex-cli',
      status: 'login-required',
    });
    assert.equal(codex.status, null);
    assert.deepEqual(codex.connection, {
      labelKey: 'mainDock.prettifySignIn',
      tone: 'warning',
      valueKey: 'mainDock.prettifySignInHelp',
    });
  });

  it('shows checking for a missing or stale CLI result and unavailable for safe failures', () => {
    const settings = createSettings({ providerId: 'claude-cli' });
    assert.deepEqual(getMainPrettifyProviderViewState(settings, []).connection, {
      labelKey: 'mainDock.prettifyChecking',
      tone: 'neutral',
      valueKey: 'prettify.cli.statusChecking',
    });
    assert.deepEqual(
      getMainPrettifyProviderViewState(settings, [], {
        errorCode: 'not-installed',
        providerId: 'claude-cli',
        status: 'unavailable',
      }).connection,
      {
        labelKey: 'mainDock.prettifyUnavailable',
        tone: 'error',
        valueKey: 'prettify.cli.statusUnavailable',
      },
    );
  });
});

describe('main Prettify provider selection state', () => {
  it('optimistically selects, accepts the current result, and ignores stale results', () => {
    const initial = { error: '', pendingRequestId: null, settings: createSettings() };
    const pending = reduceMainPrettifyProviderSelection(initial, {
      providerId: 'claude-cli',
      requestId: 4,
      type: 'begin',
    });
    assert.equal(pending.settings.providerId, 'claude-cli');
    assert.equal(pending.pendingRequestId, 4);

    assert.equal(
      reduceMainPrettifyProviderSelection(pending, {
        requestId: 3,
        settings: createSettings({ providerId: 'vllm' }),
        type: 'resolved',
      }),
      pending,
    );

    const resolved = reduceMainPrettifyProviderSelection(pending, {
      requestId: 4,
      settings: createSettings({ providerId: 'claude-cli' }),
      type: 'resolved',
    });
    assert.equal(resolved.pendingRequestId, null);
    assert.equal(resolved.settings.providerId, 'claude-cli');
  });

  it('rolls back to the authoritative snapshot on failure', () => {
    const pending = reduceMainPrettifyProviderSelection(
      { error: '', pendingRequestId: null, settings: createSettings() },
      { providerId: 'codex-cli', requestId: 8, type: 'begin' },
    );
    const rejected = reduceMainPrettifyProviderSelection(pending, {
      error: 'Could not change provider',
      requestId: 8,
      settings: createSettings({ providerId: 'ollama' }),
      type: 'rejected',
    });
    assert.equal(rejected.settings.providerId, 'ollama');
    assert.equal(rejected.error, 'Could not change provider');

    const synchronized = reduceMainPrettifyProviderSelection(rejected, {
      settings: createSettings({ providerId: 'vllm' }),
      type: 'snapshot',
    });
    assert.equal(synchronized.settings.providerId, 'vllm');
    assert.equal(synchronized.error, '');
  });
});
