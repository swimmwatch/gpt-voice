import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { AppConfigStore, resolveAppConfigPaths } from '@main/config';
import { DEFAULT_PRETTIFY_SETTINGS } from '@shared/prettifySettings';

const config = new AppConfigStore({
  fileSystem: fs,
  generateFingerprintSeed: () => '12345',
  logger: { error: () => undefined, info: () => undefined, warn: () => undefined },
  paths: resolveAppConfigPaths({
    environment: { XDG_CONFIG_HOME: '/unused' },
    homeDirectory: () => '/unused-home',
    platform: 'linux',
  }),
  writeFileAtomically: () => undefined,
});
const initialPrettifySettings = structuredClone(config.getSnapshot().prettifySettings);

afterEach(() => {
  config.setPrettifySettings(initialPrettifySettings);
});

describe('config prettify settings', () => {
  it('preserves each CLI settings object through independent configuration updates', () => {
    config.setPrettifySettings({
      ...DEFAULT_PRETTIFY_SETTINGS,
      providerId: 'claude-cli',
      claudeCli: {
        ...DEFAULT_PRETTIFY_SETTINGS.claudeCli,
        executablePath: '/opt/Claude CLI/claude',
        model: 'claude-sonnet',
      },
    });
    config.setPrettifySettings({
      codexCli: {
        executablePath: '/opt/Codex CLI/codex',
        model: 'gpt-5.6',
        reasoningEffort: 'high',
        timeoutSeconds: 240,
        verbosity: 'medium',
      },
    });

    const currentPrettifySettings = config.getSnapshot().prettifySettings;
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
