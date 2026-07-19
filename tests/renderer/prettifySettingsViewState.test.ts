import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrettifySettingsDraft } from '@renderer/appSettingsUtils';
import {
  getOllamaModelAction,
  getPrettifyAdvancedSettingsSummary,
  getPrettifyProviderSettingsViewState,
} from '@renderer/prettifySettingsViewState';
import { DEFAULT_PRETTIFY_SETTINGS, type KnownPrettifyProviderId } from '@shared/prettifySettings';

function prettifyDraft(
  providerId: KnownPrettifyProviderId,
  overrides: Partial<Omit<PrettifySettingsDraft, 'providerId'>> = {},
): PrettifySettingsDraft {
  return {
    ...DEFAULT_PRETTIFY_SETTINGS,
    ...overrides,
    providerId,
  };
}

describe('getPrettifyAdvancedSettingsSummary', () => {
  it('reports provider defaults when every advanced value matches the defaults', () => {
    assert.deepEqual(getPrettifyAdvancedSettingsSummary(DEFAULT_PRETTIFY_SETTINGS), {
      customValueCount: 0,
      usesDefaults: true,
    });
  });

  it('counts every changed advanced generation value', () => {
    assert.deepEqual(
      getPrettifyAdvancedSettingsSummary({
        ...DEFAULT_PRETTIFY_SETTINGS,
        maxOutputTokens: 256,
        seed: 42,
        topP: 0.8,
      }),
      {
        customValueCount: 3,
        usesDefaults: false,
      },
    );
  });

  it('counts only Claude CLI advanced controls', () => {
    assert.deepEqual(
      getPrettifyAdvancedSettingsSummary(
        prettifyDraft('claude-cli', {
          maxOutputTokens: 256,
          topP: 0.8,
          claudeCli: {
            executablePath: '/Applications/Claude CLI/claude',
            model: 'sonnet',
            fallbackModel: 'haiku',
            effort: 'high',
            timeoutSeconds: 300,
          },
        }),
      ),
      {
        customValueCount: 3,
        usesDefaults: false,
      },
    );
  });

  it('counts only Codex CLI advanced controls and keeps unavailable state fail-closed', () => {
    const settings = prettifyDraft('codex-cli', {
      seed: 42,
      codexCli: {
        executablePath: '/Applications/Codex CLI/codex',
        model: 'gpt-5.6-codex',
        reasoningEffort: 'xhigh',
        timeoutSeconds: 240,
        verbosity: 'high',
      },
    });
    const state = getPrettifyProviderSettingsViewState(settings, {
      status: 'unavailable',
      errorCode: 'no-tools-unavailable',
    });

    assert.deepEqual(state.advancedSettings, {
      customValueCount: 3,
      usesDefaults: false,
    });
    assert.equal(state.providerId, 'codex-cli');
    assert.equal(state.capabilities.experimental, true);
    assert.equal(state.capabilities.httpGenerationControls, false);
    assert.deepEqual(state.availability, {
      status: 'unavailable',
      errorCode: 'no-tools-unavailable',
    });
    assert.equal(state.canExecute, false);
  });
});

describe('getOllamaModelAction', () => {
  it('offers Load VRAM only when the selected model is not loaded', () => {
    assert.equal(getOllamaModelAction(false), 'load');
  });

  it('offers Free VRAM only when the selected model is loaded', () => {
    assert.equal(getOllamaModelAction(true), 'unload');
  });
});
