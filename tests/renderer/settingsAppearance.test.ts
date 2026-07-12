import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const GLOBAL_STYLES_PATH = path.join(PROJECT_ROOT, 'src/renderer/styles/globals.css');
const SCROLL_AREA_PATH = path.join(PROJECT_ROOT, 'src/renderer/components/ui/scroll-area.tsx');
const TABS_PATH = path.join(PROJECT_ROOT, 'src/renderer/components/ui/tabs.tsx');

describe('Settings appearance', () => {
  it('makes navigation states distinct and keeps scrollbar tracks unobtrusive', () => {
    const globalStyles = readFileSync(GLOBAL_STYLES_PATH, 'utf8');
    const scrollArea = readFileSync(SCROLL_AREA_PATH, 'utf8');
    const tabs = readFileSync(TABS_PATH, 'utf8');

    assert.match(tabs, /rounded-md bg-surface p-1 ring-1 ring-border/u);
    assert.match(tabs, /hover:bg-surface-raised/u);
    assert.match(tabs, /aria-selected:bg-surface-raised/u);
    assert.match(tabs, /aria-selected:ring-primary/u);
    assert.match(globalStyles, /scrollbar-color: var\(--muted-foreground\) transparent;/u);
    assert.match(globalStyles, /::-webkit-scrollbar-track,[\s\S]*?background: transparent;/u);
    assert.match(globalStyles, /scroll-behavior: smooth;/u);
    assert.match(scrollArea, /bg-transparent/u);
  });
});
