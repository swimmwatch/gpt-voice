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
    const styles = source('src/renderer/localWhisper/LocalWhisperSettingsPage.css');
    for (const viewport of [440, 560]) assert.ok(viewport < 640);
    assert.match(page, /min-w-0 max-w-full overflow-x-hidden/u);
    assert.match(runtime, /lw-engine-layout/u);
    assert.match(status, /lw-readiness-rail/u);
    assert.match(styles, /@media \(max-width: 560px\)[\s\S]*\.lw-model-row/u);
    assert.match(styles, /\.lw-engine-layout,[\s\S]*grid-template-columns: 1fr/u);
    assert.doesNotMatch(`${page}\n${runtime}\n${status}`, /min-w-\[(?:[6-9]\d\d|\d{4,})px\]/u);
  });

  it('keeps the readiness status icons on one horizontal baseline at narrow widths', () => {
    const styles = source('src/renderer/localWhisper/LocalWhisperSettingsPage.css');
    const tabletStyles = styles.slice(
      styles.indexOf('@media (max-width: 760px)'),
      styles.indexOf('@media (max-width: 560px)'),
    );
    assert.match(styles, /\.lw-readiness-rail\s*\{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/u);
    assert.doesNotMatch(tabletStyles, /\.lw-readiness-rail/u);
  });

  it('keeps settings actions fixed while reserving space for the action bar', () => {
    const styles = source('src/renderer/localWhisper/LocalWhisperSettingsPage.css');
    assert.match(styles, /--lw-page-actions-height: 88px;/u);
    assert.match(styles, /padding-bottom: calc\(16px \+ var\(--lw-page-actions-height\)\);/u);
    assert.match(styles, /\.lw-page-actions\s*\{[\s\S]*?position: fixed;/u);
    assert.match(styles, /\.lw-page-actions\s*\{[\s\S]*?z-index: 10;/u);
    assert.match(styles, /\.lw-page-actions\s*\{[\s\S]*?bottom: 0;/u);
  });

  it('aligns the Model requirement and resource safety status icons', () => {
    const styles = source('src/renderer/localWhisper/LocalWhisperSettingsPage.css');
    assert.match(styles, /\.lw-requirement-row\s*\{[\s\S]*?grid-template-columns: 20px minmax\(0, 1fr\) auto;/u);
    assert.match(styles, /\.lw-requirement-row > svg,[\s\S]*?\.lw-safety-note svg\s*\{[\s\S]*?width: 20px;/u);
    assert.match(styles, /\.lw-requirement-row > svg,[\s\S]*?\.lw-safety-note svg\s*\{[\s\S]*?height: 20px;/u);
  });

  it('centers the loading state within the full provider-settings viewport', () => {
    const page = source('src/renderer/localWhisper/LocalWhisperSettingsPage.tsx');
    const styles = source('src/renderer/localWhisper/LocalWhisperSettingsPage.css');
    assert.match(page, /className="lw-loading"/u);
    assert.match(styles, /\.lw-loading\s*\{[\s\S]*?min-height: 100dvh;/u);
    assert.match(styles, /\.lw-loading\s*\{[\s\S]*?align-items: center;/u);
    assert.match(styles, /\.lw-loading\s*\{[\s\S]*?justify-content: center;/u);
  });

  it('keeps the settings canvas continuous with the scrollbar gutter', () => {
    const window = source('src/renderer/ProviderSettingsWindow.tsx');
    const styles = source('src/renderer/localWhisper/LocalWhisperSettingsPage.css');
    assert.match(window, /bg-background/u);
    assert.match(window, /scrollbar-gutter:stable/u);
    assert.match(styles, /--lw-canvas: var\(--background\);/u);
    assert.match(styles, /\.local-whisper-settings\s*\{[\s\S]*?background: var\(--lw-canvas\);/u);
    assert.doesNotMatch(styles, /\.local-whisper-settings\s*\{[\s\S]*?border-inline:/u);
  });

  it('uses the canonical settings palette without Local Whisper color literals', () => {
    const styles = source('src/renderer/localWhisper/LocalWhisperSettingsPage.css');
    assert.match(styles, /--lw-surface: var\(--surface\);/u);
    assert.match(styles, /--lw-line: var\(--border\);/u);
    assert.match(styles, /--lw-text: var\(--foreground\);/u);
    assert.match(styles, /--lw-blue: var\(--primary\);/u);
    assert.match(styles, /--lw-green: var\(--success\);/u);
    assert.match(styles, /--lw-amber: var\(--warning\);/u);
    assert.match(styles, /--lw-red: var\(--destructive\);/u);
    assert.doesNotMatch(styles, /#[\da-f]{3,8}/iu);
    assert.doesNotMatch(styles, /rgba?\(/iu);
  });

  it('reuses the same shared Select component as the main settings window', () => {
    const shared = source('src/renderer/localWhisper/components/LocalWhisperSection.tsx');
    const runtime = source('src/renderer/localWhisper/components/LocalWhisperRuntimeModelSection.tsx');
    const select = source('src/renderer/components/ui/select.tsx');
    assert.match(shared, /@renderer\/components\/ui\/select/u);
    assert.match(shared, /<Select[\s\S]*<SelectTrigger[\s\S]*<SelectContent[\s\S]*<SelectItem/u);
    assert.doesNotMatch(`${shared}\n${runtime}`, /<select/u);
    assert.match(select, /min-w-0 flex-1 truncate text-left/u);
    assert.match(select, /className="min-w-0 flex-1 truncate" data-slot="select-item-text"/u);
  });

  it('uses shared tooltips instead of native browser titles', () => {
    const nativeTitleSources = [
      source('src/renderer/localWhisper/LocalWhisperSettingsPage.tsx'),
      source('src/renderer/localWhisper/components/LocalWhisperStorageSection.tsx'),
      source('src/renderer/localWhisper/components/LocalWhisperArtifactControls.tsx'),
      source('src/renderer/localWhisper/components/LocalWhisperMainResidencyControl.tsx'),
    ].join('\n');
    const tooltipSources = [
      source('src/renderer/localWhisper/LocalWhisperSettingsPage.tsx'),
      source('src/renderer/localWhisper/components/LocalWhisperStatusSection.tsx'),
      source('src/renderer/localWhisper/components/LocalWhisperRuntimeModelSection.tsx'),
      source('src/renderer/localWhisper/components/LocalWhisperStorageSection.tsx'),
      source('src/renderer/localWhisper/components/LocalWhisperArtifactControls.tsx'),
      source('src/renderer/localWhisper/components/LocalWhisperMainResidencyControl.tsx'),
    ].join('\n');
    assert.doesNotMatch(nativeTitleSources, /<(?:button|div|span|svg|PiInfo|Button)\b[^>]*\stitle=/u);
    assert.match(tooltipSources, /@renderer\/components\/ui\/tooltip/u);
    assert.match(tooltipSources, /<TooltipTrigger asChild>/u);
    assert.match(tooltipSources, /<TooltipContent>/u);
  });

  it('provides field labels, grouped radios, keyboard focus rings, and explicit disabled explanations', () => {
    const shared = source('src/renderer/localWhisper/components/LocalWhisperSection.tsx');
    const runtime = source('src/renderer/localWhisper/components/LocalWhisperRuntimeModelSection.tsx');
    const inference = source('src/renderer/localWhisper/components/LocalWhisperInferenceSections.tsx');
    const page = source('src/renderer/localWhisper/LocalWhisperSettingsPage.tsx');
    assert.match(shared, /<label[\s\S]*htmlFor=\{htmlFor\}/u);
    assert.match(runtime, /aria-pressed=\{selected\}/u);
    assert.match(inference, /focus-visible:ring-2|focus-within:ring-2/u);
    assert.match(page, /saveDisabledReason/u);
    assert.match(page, /t\('localWhisper\.settings\.disabledBusy'\)/u);
  });

  it('announces progress and failures while keeping failed confirmations contained', () => {
    const page = source('src/renderer/localWhisper/LocalWhisperSettingsPage.tsx');
    const storage = [
      source('src/renderer/localWhisper/components/LocalWhisperStorageSection.tsx'),
      source('src/renderer/localWhisper/components/LocalWhisperArtifactControls.tsx'),
    ].join('\n');
    const indicator = source('src/renderer/localWhisper/components/LocalWhisperMainStatusIndicator.tsx');
    assert.match(page, /aria-live="assertive"[\s\S]*role="alert"[\s\S]*tabIndex=\{-1\}/u);
    assert.match(storage, /aria-live="polite"/u);
    assert.match(storage, /<progress/u);
    assert.match(storage, /triggerRef\.current\?\.focus\(\)/u);
    assert.match(
      page,
      /if \(controller\.actionError && interruption\.request === null\) errorSummaryRef\.current\?\.focus\(\);/u,
    );
    assert.match(storage, /if \(!open\) requestAnimationFrame\(\(\) => triggerRef\.current\?\.focus\(\)\);/u);
    assert.match(indicator, /<ProviderStatusIndicator/u);
    assert.match(indicator, /role="status"/u);
    assert.match(indicator, /tooltip=\{tooltip\}/u);
  });

  it('keeps the main Load/Free control focusable with localized reasons, status, alerts, and reduced motion', () => {
    const control = source('src/renderer/localWhisper/components/LocalWhisperMainResidencyControl.tsx');
    const spinner = source('src/renderer/components/ui/spinner.tsx');
    const styles = source('src/renderer/styles/globals.css');
    assert.match(control, /aria-label=\{label\}/u);
    assert.match(control, /aria-disabled=\{!presentation\.enabled\}/u);
    assert.match(control, /aria-describedby=/u);
    assert.match(control, /<TooltipContent>\{reason\}<\/TooltipContent>/u);
    assert.match(control, /role="alert"/u);
    assert.match(control, /<Spinner[\s\S]*?active=\{presentation\.pending\}[\s\S]*?label=\{label\}/u);
    assert.match(spinner, /role=\{announce \? 'status' : undefined\}/u);
    assert.match(spinner, /motion-reduce:animate-none/u);
    assert.match(styles, /data-local-whisper='true'[\s\S]*repeat\(3, 37px\)/u);
  });
});
