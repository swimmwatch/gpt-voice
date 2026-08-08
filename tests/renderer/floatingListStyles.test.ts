import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('renderer floating list styles', () => {
  it('uses one opaque token-based surface across menu, Select, and searchable list implementations', () => {
    const styles = readProjectFile('src/renderer/components/ui/floating-list-styles.ts');
    const consumers = [
      readProjectFile('src/renderer/components/ui/dropdown-menu.tsx'),
      readProjectFile('src/renderer/components/ui/select.tsx'),
      readProjectFile('src/renderer/components/SearchableSelectInput.tsx'),
    ];

    assert.match(styles, /FLOATING_LIST_SURFACE_CLASS/u);
    assert.match(styles, /border-border bg-surface text-foreground shadow-lg/u);
    assert.match(styles, /FLOATING_LIST_ITEM_CLASS/u);
    assert.match(styles, /items-center gap-2/u);
    for (const consumer of consumers) {
      assert.match(consumer, /FLOATING_LIST_SURFACE_CLASS/u);
      assert.match(consumer, /FLOATING_LIST_ITEM_CLASS/u);
    }
  });

  it('keeps Local Whisper menus on the shared portal-safe surface', () => {
    const controls = readProjectFile('src/renderer/localWhisper/components/LocalWhisperArtifactControls.tsx');
    const styles = readProjectFile('src/renderer/localWhisper/LocalWhisperSettingsPage.css');

    assert.match(controls, /<DropdownMenuContent align="end">/u);
    assert.doesNotMatch(controls, /lw-menu-content/u);
    assert.doesNotMatch(styles, /\.lw-menu-content/u);
  });

  it('leaves spacing and width decisions with shared primitives and intentional consumer sizing', () => {
    const profiles = readProjectFile('src/renderer/components/settings/PrettifyProfilesSettingsSection.tsx');

    assert.match(profiles, /<DropdownMenuContent align="end" className="w-52">/u);
    assert.doesNotMatch(profiles, /className="ml-2"/u);
  });
});
