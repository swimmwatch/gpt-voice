import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readRendererSource(filename: string): string {
  return readFileSync(path.join(PROJECT_ROOT, 'src/renderer/components/ui', filename), 'utf8');
}

describe('interactive cursor contracts', () => {
  it('uses pointer cursors for reusable click controls', () => {
    const button = readRendererSource('button.tsx');
    const collapsible = readRendererSource('collapsible.tsx');
    const dropdownMenu = readRendererSource('dropdown-menu.tsx');
    const select = readRendererSource('select.tsx');
    const switchControl = readRendererSource('switch.tsx');
    const tabs = readRendererSource('tabs.tsx');

    assert.match(button, /cursor-pointer/u);
    assert.match(collapsible, /cursor-pointer/u);
    assert.match(dropdownMenu, /DropdownMenuTrigger[\s\S]*?cursor-pointer/u);
    assert.match(dropdownMenu, /DropdownMenuItem[\s\S]*?cursor-pointer/u);
    assert.match(select, /SelectTrigger[\s\S]*?cursor-pointer/u);
    assert.match(select, /SelectItem[\s\S]*?cursor-pointer/u);
    assert.match(switchControl, /cursor-pointer/u);
    assert.match(tabs, /TabsTrigger[\s\S]*?cursor-pointer/u);
  });

  it('uses semantic cursors for drag and copy interactions', () => {
    const historyEntry = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/components/HistoryEntry.tsx'), 'utf8');
    const scrollArea = readRendererSource('scroll-area.tsx');
    const slider = readRendererSource('slider.tsx');

    assert.match(historyEntry, /cursor-copy/u);
    assert.match(scrollArea, /cursor-grab[\s\S]*?active:cursor-grabbing/u);
    assert.match(slider, /cursor-grab[\s\S]*?active:cursor-grabbing/u);
  });

  it('keeps disabled shared controls visibly non-actionable', () => {
    const button = readRendererSource('button.tsx');
    const dropdownMenu = readRendererSource('dropdown-menu.tsx');
    const select = readRendererSource('select.tsx');
    const slider = readRendererSource('slider.tsx');
    const tabs = readRendererSource('tabs.tsx');

    assert.match(button, /disabled:cursor-not-allowed/u);
    assert.match(dropdownMenu, /data-\[disabled\]:cursor-not-allowed/u);
    assert.match(select, /data-\[disabled\]:cursor-not-allowed/u);
    assert.match(slider, /data-\[disabled\]:cursor-not-allowed/u);
    assert.match(tabs, /data-\[disabled\]:cursor-not-allowed/u);
  });
});
