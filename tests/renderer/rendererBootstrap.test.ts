import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const rootDirectory = path.resolve(__dirname, '..', '..');
const rendererDirectory = path.join(rootDirectory, 'src', 'renderer');
const entryDirectory = path.join(rendererDirectory, 'entries');

const entries = [
  ['main.tsx', 'App'],
  ['settings.tsx', 'AppSettingsWindow'],
  ['history.tsx', 'HistoryWindow'],
  ['about.tsx', 'AboutWindow'],
] as const;

test('uses a shared renderer bootstrap for every window entry', async () => {
  const bootstrap = await readFile(path.join(rendererDirectory, 'bootstrapWindow.tsx'), 'utf8');

  assert.match(bootstrap, /function bootstrapWindow\(/);
  assert.match(bootstrap, /<I18nProvider>/);
  assert.match(bootstrap, /<TooltipProvider>/);
  assert.match(bootstrap, /<WindowStartupGate>/);
  assert.match(bootstrap, /<Toaster\s*\/>/);

  for (const [fileName, componentName] of entries) {
    const source = await readFile(path.join(entryDirectory, fileName), 'utf8');

    assert.match(source, /bootstrapWindow\(/);
    assert.ok(source.includes(`bootstrapWindow(${componentName})`));
    assert.doesNotMatch(source, /pathname|window\.location/);
    assert.doesNotMatch(source, /I18nProvider|TooltipProvider|WindowStartupGate|Toaster/);
  }
});

test('keeps a main-window compatibility entry without window pathname routing', async () => {
  const indexSource = await readFile(path.join(rendererDirectory, 'index.tsx'), 'utf8');

  assert.match(indexSource, /import '\.\/entries\/main';/);
  assert.doesNotMatch(indexSource, /pathname|window\.location/);
});
