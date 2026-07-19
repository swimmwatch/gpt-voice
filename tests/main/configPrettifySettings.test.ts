import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { currentPrettifySettings, setPrettifySettings } from '@main/config';
import { DEFAULT_PRETTIFY_SETTINGS } from '@shared/prettifySettings';

const initialPrettifySettings = structuredClone(currentPrettifySettings);

afterEach(() => {
  setPrettifySettings(initialPrettifySettings);
});

describe('config prettify settings', () => {
  it('preserves each CLI settings object through independent configuration updates', () => {
    setPrettifySettings({
      ...DEFAULT_PRETTIFY_SETTINGS,
      providerId: 'claude-cli',
      claudeCli: {
        ...DEFAULT_PRETTIFY_SETTINGS.claudeCli,
        executablePath: '/opt/Claude CLI/claude',
        model: 'claude-sonnet',
      },
    });
    setPrettifySettings({
      codexCli: {
        executablePath: '/opt/Codex CLI/codex',
        model: 'gpt-5.6',
        reasoningEffort: 'high',
        timeoutSeconds: 240,
        verbosity: 'medium',
      },
    });

    assert.deepEqual(currentPrettifySettings.claudeCli, {
      executablePath: '/opt/Claude CLI/claude',
      model: 'claude-sonnet',
      fallbackModel: '',
      effort: 'default',
      timeoutSeconds: 120,
    });
    assert.deepEqual(currentPrettifySettings.codexCli, {
      executablePath: '/opt/Codex CLI/codex',
      model: 'gpt-5.6',
      reasoningEffort: 'high',
      timeoutSeconds: 240,
      verbosity: 'medium',
    });
    assert.equal(currentPrettifySettings.providerId, 'claude-cli');
  });
});
