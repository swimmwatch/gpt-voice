import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readRendererSource(filename: string): string {
  return readFileSync(path.join(PROJECT_ROOT, 'src/renderer', filename), 'utf8');
}

describe('main window iconography', () => {
  it('uses a microphone for the voice provider and a brain circuit for the LLM model', () => {
    const toolbar = readRendererSource('components/MainToolbar.tsx');
    const modelMemory = readRendererSource('components/PrettifyModelMemoryRow.tsx');

    assert.match(toolbar, /\bMic\b/u);
    assert.match(toolbar, /<Mic\b/u);
    assert.doesNotMatch(toolbar, /\bGlobe\b/u);
    assert.match(modelMemory, /\bBrainCircuit\b/u);
    assert.match(modelMemory, /<BrainCircuit\b/u);
    assert.doesNotMatch(modelMemory, /\bBox\b/u);
  });

  it('keeps settings closing in native window controls instead of the footer', () => {
    const appSettings = readRendererSource('AppSettingsWindow.tsx');
    const footer = readRendererSource('components/settings/SettingsFooter.tsx');

    assert.doesNotMatch(appSettings, /<SettingsFooter(?:(?!\/>).)*onClose=/su);
    assert.doesNotMatch(footer, /\bonClose\b/u);
    assert.doesNotMatch(footer, /common\.close/u);
  });

  it('loads the About logo from the app asset protocol instead of a renderer import', () => {
    const aboutWindow = readRendererSource('AboutWindow.tsx');

    assert.match(aboutWindow, /APP_ICON_ASSET_PATH/u);
    assert.doesNotMatch(aboutWindow, /\.\.\/\.\.\/assets\/icon\.png/u);
  });
});
