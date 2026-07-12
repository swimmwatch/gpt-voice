import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const APP_SETTINGS_WINDOW_PATH = path.join(PROJECT_ROOT, 'src/renderer/AppSettingsWindow.tsx');

describe('App Settings prettify models', () => {
  it('loads model metadata when Settings initializes', () => {
    const appSettingsWindow = readFileSync(APP_SETTINGS_WINDOW_PATH, 'utf8');

    assert.match(
      appSettingsWindow,
      /listPrettifyModels\(\s*nextPrettifySettings\.providerId,\s*nextPrettifySettings,\s*\)/u,
    );
    assert.match(appSettingsWindow, /\[result\.providerId\]: result\.models/u);
  });
});
