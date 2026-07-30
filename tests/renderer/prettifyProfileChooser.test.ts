import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  filterPrettifyProfileChooserProfiles,
  movePrettifyProfileChooserSelection,
  normalizePrettifyProfileChooserPayload,
  resolveInitialPrettifyProfileChooserSelection,
  resolveVisiblePrettifyProfileChooserSelection,
} from '@renderer/prettifyProfileChooserState';
import type { PrettifyProfileChooserProfileSummary } from '@shared/prettifyProfileChooser';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const COMPONENT_PATH = path.join(
  PROJECT_ROOT,
  'src',
  'renderer',
  'components',
  'prettify',
  'PrettifyProfileChooser.tsx',
);
const WINDOW_PATH = path.join(PROJECT_ROOT, 'src', 'renderer', 'PrettifyProfileChooserWindow.tsx');
const ENTRY_PATH = path.join(PROJECT_ROOT, 'src', 'renderer', 'entries', 'prettifyProfileChooser.tsx');
const I18N_PATH = path.join(PROJECT_ROOT, 'src', 'renderer', 'hooks', 'usePrettifyProfileChooserI18n.tsx');

const PROFILES: readonly PrettifyProfileChooserProfileSummary[] = Object.freeze([
  Object.freeze({
    description: 'Turn rough input into a clear, structured AI prompt.',
    id: 'prompt-ready',
    isDefault: true,
    kind: 'built-in',
    name: 'Prompt-ready',
  }),
  Object.freeze({
    description: 'Résumé-focused product discovery.',
    id: 'custom:12345678-1234-1234-1234-123456789abc',
    isDefault: false,
    kind: 'custom',
    name: 'Product discovery',
  }),
  Object.freeze({
    description: 'Correct grammar without changing meaning.',
    id: 'polish',
    isDefault: false,
    kind: 'built-in',
    name: 'Polish',
  }),
]);

describe('Prettify profile chooser state', () => {
  it('normalizes and freezes only the renderer-safe operation payload', () => {
    const payload = normalizePrettifyProfileChooserPayload({
      initialProfileId: 'prompt-ready',
      profiles: PROFILES,
      sourceText: 'Selected source',
      token: 'operation-token',
    });

    assert.equal(payload.initialProfileId, 'prompt-ready');
    assert.equal(payload.sourceText, 'Selected source');
    assert.deepEqual(
      payload.profiles.map((profile) => profile.id),
      ['prompt-ready', 'custom:12345678-1234-1234-1234-123456789abc', 'polish'],
    );
    assert.equal(Object.isFrozen(payload), true);
    assert.equal(Object.isFrozen(payload.profiles), true);
    assert.equal(Object.isFrozen(payload.profiles[0]), true);
  });

  it('rejects malformed or instruction-bearing payloads with one content-free error', () => {
    const invalidPayloads = [
      null,
      { profiles: [], sourceText: 'source', token: '' },
      {
        profiles: [{ ...PROFILES[0], instruction: 'private instruction' }],
        sourceText: 'source',
        token: 'token',
      },
      { profiles: [PROFILES[0], PROFILES[0]], sourceText: 'source', token: 'token' },
    ];

    for (const payload of invalidPayloads) {
      assert.throws(
        () => normalizePrettifyProfileChooserPayload(payload),
        new Error('invalid-prettify-profile-chooser-payload'),
      );
    }
  });

  it('preserves mixed order and applies normalized multi-term name-and-description search', () => {
    assert.deepEqual(
      filterPrettifyProfileChooserProfiles(PROFILES, '').map((profile) => profile.id),
      ['prompt-ready', 'custom:12345678-1234-1234-1234-123456789abc', 'polish'],
    );
    assert.deepEqual(
      filterPrettifyProfileChooserProfiles(PROFILES, 'resume discovery').map((profile) => profile.id),
      ['custom:12345678-1234-1234-1234-123456789abc'],
    );
    assert.deepEqual(
      filterPrettifyProfileChooserProfiles(PROFILES, 'grammar meaning').map((profile) => profile.id),
      ['polish'],
    );
  });

  it('keeps a 200-custom-profile catalog ordered and filterable', () => {
    const customProfiles: PrettifyProfileChooserProfileSummary[] = Array.from({ length: 200 }, (_, index) => ({
      description: `Description for profile ${index}`,
      id: `custom:12345678-1234-1234-1234-${index.toString(16).padStart(12, '0')}`,
      isDefault: false,
      kind: 'custom',
      name: `Custom profile ${index}`,
    }));
    const catalog = [...PROFILES, ...customProfiles];

    assert.equal(filterPrettifyProfileChooserProfiles(catalog, '').length, 203);
    assert.deepEqual(
      filterPrettifyProfileChooserProfiles(catalog, 'profile 199').map((profile) => profile.id),
      ['custom:12345678-1234-1234-1234-0000000000c7'],
    );
    assert.deepEqual(
      filterPrettifyProfileChooserProfiles(catalog, '')
        .slice(-2)
        .map((profile) => profile.name),
      ['Custom profile 198', 'Custom profile 199'],
    );
  });

  it('keeps only valid visible selection and moves deterministically', () => {
    assert.equal(resolveInitialPrettifyProfileChooserSelection(PROFILES, 'prompt-ready'), 'prompt-ready');
    assert.equal(resolveInitialPrettifyProfileChooserSelection(PROFILES, 'natural'), undefined);

    const filtered = filterPrettifyProfileChooserProfiles(PROFILES, 'product');
    assert.equal(resolveVisiblePrettifyProfileChooserSelection(filtered, 'prompt-ready'), undefined);
    assert.equal(
      resolveVisiblePrettifyProfileChooserSelection(filtered, 'custom:12345678-1234-1234-1234-123456789abc'),
      'custom:12345678-1234-1234-1234-123456789abc',
    );

    assert.equal(
      movePrettifyProfileChooserSelection(PROFILES, 'prompt-ready', 'next'),
      'custom:12345678-1234-1234-1234-123456789abc',
    );
    assert.equal(
      movePrettifyProfileChooserSelection(PROFILES, 'polish', 'previous'),
      'custom:12345678-1234-1234-1234-123456789abc',
    );
    assert.equal(movePrettifyProfileChooserSelection(PROFILES, 'polish', 'first'), 'prompt-ready');
    assert.equal(movePrettifyProfileChooserSelection(PROFILES, 'prompt-ready', 'last'), 'polish');
  });
});

describe('Prettify profile chooser renderer contract', () => {
  it('reproduces the approved primitives, layout, responsive footer, and selection treatment', async () => {
    const source = await readFile(COMPONENT_PATH, 'utf8');

    for (const primitive of [
      'Badge',
      'Button',
      'Empty',
      'Input',
      'Kbd',
      'ScrollArea',
      'Separator',
      'Sparkles',
      'Search',
      'Settings2',
    ]) {
      assert.equal(source.includes(primitive), true, primitive);
    }
    assert.match(source, /grid-rows-\[auto_auto_minmax\(0,1fr\)_auto\]/u);
    assert.match(source, /h-28 rounded-lg border border-border bg-surface-muted/u);
    assert.match(source, /max-\[379px\]:grid-cols-1/u);
    assert.match(source, /max-\[479px\]:hidden/u);
    assert.match(source, /border-primary bg-\[var\(--primary-subtle\)\]/u);
    assert.match(source, /<strong className="font-medium text-foreground">\{selectedProfile\.name\}<\/strong>/u);
    assert.doesNotMatch(source, /\b(?:Check|CheckCircle|CircleDot|Radio)\b|type="radio"|aria-checked/u);
  });

  it('keeps exact listbox, keyboard, search, and explicit-apply behavior', async () => {
    const source = await readFile(COMPONENT_PATH, 'utf8');

    assert.match(source, /role="listbox"/u);
    assert.match(source, /role="option"/u);
    assert.match(source, /aria-selected=\{selected\}/u);
    assert.match(source, /aria-live="polite"/u);
    assert.match(source, /autoFocus/u);
    assert.match(source, /event\.key === 'ArrowDown'/u);
    assert.match(source, /event\.key === 'ArrowUp'/u);
    assert.match(source, /event\.key === 'Home'/u);
    assert.match(source, /event\.key === 'End'/u);
    assert.match(source, /event\.key === 'Enter'/u);
    assert.match(source, /event\.key === 'Escape'/u);
    assert.match(source, /const firstVisibleProfileId = visibleProfiles\[0\]\?\.id/u);
    assert.match(source, /onClick=\{onSelect\}/u);
    assert.doesNotMatch(source, /onClick=\{onApply\}/u);
  });

  it('uses only the isolated chooser API and clears payload before terminal IPC', async () => {
    const [entry, windowSource, i18nSource] = await Promise.all([
      readFile(ENTRY_PATH, 'utf8'),
      readFile(WINDOW_PATH, 'utf8'),
      readFile(I18N_PATH, 'utf8'),
    ]);

    assert.match(entry, /PrettifyProfileChooserRendererWindow/u);
    assert.match(entry, /PrettifyProfileChooserI18nProvider/u);
    assert.doesNotMatch(entry, /\bElectronAPI\b|bootstrapWindow|DesktopApiProvider|RendererLoggerProvider/u);
    assert.match(windowSource, /\.loadPayload\(\)/u);
    assert.match(windowSource, /clearPayload\(\);\s+void finishTerminalAction\(action, token, true\)/u);
    assert.match(windowSource, /\.ready\(token\)/u);
    assert.match(windowSource, /\.apply\(token, profileId\)/u);
    assert.doesNotMatch(windowSource, /console\.|electron-log|instruction/u);
    assert.match(i18nSource, /'getLocale' \| 'getTranslations' \| 'onLocaleChanged'/u);
    assert.doesNotMatch(i18nSource, /\.setLocale|getSupportedLocales|DesktopApiProvider/u);
  });
});
