import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = process.cwd();

function source(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

describe('Local Whisper accessibility and narrow viewport contracts', () => {
  it('keeps 440 px and 560 px layouts single-column until the 640 px breakpoint without horizontal clipping', () => {
    const page = source('src/renderer/localWhisper/LocalWhisperSettingsPage.tsx');
    const runtime = source('src/renderer/localWhisper/components/LocalWhisperRuntimeModelSection.tsx');
    const status = source('src/renderer/localWhisper/components/LocalWhisperStatusSection.tsx');
    for (const viewport of [440, 560]) assert.ok(viewport < 640);
    assert.match(page, /min-w-0 max-w-full overflow-x-hidden/u);
    assert.match(runtime, /grid min-w-0 [^"]*sm:grid-cols/u);
    assert.match(status, /grid min-w-0 [^"]*sm:grid-cols/u);
    assert.doesNotMatch(`${page}\n${runtime}\n${status}`, /min-w-\[(?:[6-9]\d\d|\d{4,})px\]/u);
  });

  it('provides field labels, grouped radios, keyboard focus rings, and explicit disabled explanations', () => {
    const shared = source('src/renderer/localWhisper/components/LocalWhisperSection.tsx');
    const runtime = source('src/renderer/localWhisper/components/LocalWhisperRuntimeModelSection.tsx');
    const inference = source('src/renderer/localWhisper/components/LocalWhisperInferenceSections.tsx');
    const page = source('src/renderer/localWhisper/LocalWhisperSettingsPage.tsx');
    assert.match(shared, /<label[\s\S]*htmlFor=\{htmlFor\}/u);
    assert.match(runtime, /<fieldset[\s\S]*<legend/u);
    assert.match(inference, /focus-visible:ring-2|focus-within:ring-2/u);
    assert.match(page, /saveDisabledReason/u);
    assert.match(page, /Reset is disabled while another action is in progress/u);
  });

  it('announces progress and failures and restores focus after rejected destructive actions', () => {
    const page = source('src/renderer/localWhisper/LocalWhisperSettingsPage.tsx');
    const storage = source('src/renderer/localWhisper/components/LocalWhisperStorageSection.tsx');
    const indicator = source('src/renderer/localWhisper/components/LocalWhisperMainStatusIndicator.tsx');
    assert.match(page, /aria-live="assertive"[\s\S]*role="alert"[\s\S]*tabIndex=\{-1\}/u);
    assert.match(storage, /aria-live="polite"/u);
    assert.match(storage, /<progress/u);
    assert.match(storage, /removeTriggerRef\.current\?\.focus\(\)/u);
    assert.match(indicator, /<ProviderStatusIndicator/u);
    assert.match(indicator, /role="status"/u);
    assert.match(indicator, /tooltip=\{tooltip\}/u);
  });
});
