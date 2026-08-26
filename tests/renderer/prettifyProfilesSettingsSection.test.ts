import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('Prettify profile Settings exact surface contract', () => {
  it('uses the approved primitives, dimensions, mixed list semantics, and no row selection glyph', () => {
    const source = readProjectFile('src/renderer/components/settings/PrettifyProfilesSettingsSection.tsx');
    assert.match(source, /min-h-\[72px\]/u);
    assert.match(source, /h-\[244px\]/u);
    assert.match(source, /role="list"/u);
    assert.match(source, /role="listitem"/u);
    assert.match(source, /GripVertical/u);
    assert.match(source, /MoreHorizontal/u);
    assert.match(source, /Badge variant="success"/u);
    assert.match(source, /ScrollAreaViewport/u);
    assert.match(source, /DropdownMenuContent/u);
    assert.match(source, /<ConfirmationDialog/u);
    assert.doesNotMatch(source, /AlertDialog(?:Action|Cancel|Content|Footer|Header|Title)/u);
    assert.doesNotMatch(source, /role="listbox"|role="option"/u);
    assert.doesNotMatch(source, /CheckCircle|CircleCheck|RadioGroup/u);
    assert.doesNotMatch(source, /<img|\.svg|\.png/u);
  });

  it('uses canonical search and disables every reorder route while filtering', () => {
    const source = readProjectFile('src/renderer/components/settings/PrettifyProfilesSettingsSection.tsx');
    assert.match(source, /matchesPrettifyProfileSearchQuery\(profile, query\)/u);
    assert.match(source, /normalizePrettifyProfileSearchText\(query\)\.trim\(\)\.length > 0/u);
    assert.match(source, /draggable=\{!disabled && !reorderingDisabled\}/u);
    assert.match(source, /if \(disabled \|\| reorderingDisabled \|\| !event\.altKey/u);
    assert.match(source, /aria-label=\{t\('prettify\.profiles\.actionsAria'[\s\S]{0,180}disabled=\{disabled\}/u);
    assert.match(source, /if \(isFiltering\) return/u);
    assert.match(source, /Clear search to reorder|clearSearchToReorder/u);
  });

  it('keeps profile mutations draft-only and privileged work behind typed desktop APIs', () => {
    const source = readProjectFile('src/renderer/components/settings/PrettifyProfilesSettingsSection.tsx');
    assert.match(source, /dispatch\(\{ profile, type: editorState\.mode === 'edit' \? 'update' : 'create' \}\)/u);
    assert.match(source, /allocatePrettifyCustomProfileId/u);
    assert.match(source, /exportPrettifyProfiles/u);
    assert.match(source, /importPrettifyProfiles/u);
    assert.match(source, /applyPrettifyProfileImport/u);
    assert.doesNotMatch(source, /ipcRenderer|node:fs|electron|randomUUID/u);
  });

  it('shows the persistent provider and fixed-scope disclosures in editable editors', () => {
    const source = readProjectFile('src/renderer/components/settings/PrettifyProfilesSettingsSection.tsx');
    assert.match(source, /editor\.providerDisclosure/u);
    assert.match(source, /editor\.fixedScopeLabel/u);
    assert.match(source, /editor\.fixedScope/u);
    assert.match(source, /!editorIsReadOnly/u);
    assert.match(source, /id="prettify-profile-instructions"/u);
  });

  it('places profiles first, preserves one footer, and removes the editable legacy prompt', () => {
    const app = readProjectFile('src/renderer/AppSettingsWindow.tsx');
    const prettifySection = readProjectFile('src/renderer/components/settings/PrettifySection.tsx');
    const profileIndex = app.indexOf('<PrettifyProfilesSettingsSection');
    const separatorIndex = app.indexOf('<Separator />', profileIndex);
    const providerIndex = app.indexOf('<PrettifySection', separatorIndex);
    assert.ok(profileIndex >= 0 && separatorIndex > profileIndex && providerIndex > separatorIndex);
    assert.equal((app.match(/<SettingsFooter/u) ?? []).length, 1);
    assert.doesNotMatch(prettifySection, /prettify\.prompt|onPromptChange|prettifySettings\.prompt/u);
  });
});
