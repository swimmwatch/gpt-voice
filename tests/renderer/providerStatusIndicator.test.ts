import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('provider status indicators', () => {
  it('uses one functional, keyboard-focusable tooltip indicator for non-action statuses', () => {
    const indicator = readProjectFile('src/renderer/components/ProviderStatusIndicator.tsx');

    assert.match(indicator, /export function ProviderStatusIndicator/u);
    assert.match(indicator, /<Tooltip>/u);
    assert.match(indicator, /<TooltipTrigger asChild>/u);
    assert.match(indicator, /tabIndex=\{0\}/u);
    assert.match(indicator, /role=\{role\}/u);
    assert.match(indicator, /aria-label=\{`\$\{label\}\. \$\{tooltip\}`\}/u);
    assert.doesNotMatch(indicator, /<button|onClick/u);
  });

  it('explains Voice readiness while preserving the disconnected action', () => {
    const toolbar = readProjectFile('src/renderer/components/MainToolbar.tsx');

    assert.match(toolbar, /dataSlot="voice-provider-connection"/u);
    assert.match(toolbar, /tooltip=\{providerStatusTooltip\}/u);
    assert.match(toolbar, /providerConnectionFailureTooltip \|\|/u);
    assert.match(toolbar, /<Button[\s\S]*?onClick=\{onProviderLogin\}/u);
    assert.match(toolbar, /<TooltipContent>\{providerStatusTooltip\}<\/TooltipContent>/u);
    assert.doesNotMatch(toolbar, /<TooltipContent>\{providerActionLabel\}<\/TooltipContent>/u);
  });

  it('gives every Prettify summary and CLI state an explicit tooltip key', () => {
    const viewState = readProjectFile('src/renderer/mainPrettifyProvider.ts');
    const band = readProjectFile('src/renderer/components/MainPrettifyProviderBand.tsx');

    for (const key of [
      'mainDock.prettifyOllamaNotConfiguredTooltip',
      'mainDock.prettifyOllamaLoadedTooltip',
      'mainDock.prettifyOllamaNotLoadedTooltip',
      'mainDock.prettifyVllmConfiguredTooltip',
      'mainDock.prettifyVllmNotConfiguredTooltip',
    ]) {
      assert.equal(viewState.includes(key), true, key);
    }
    assert.match(band, /providerStatus\.tooltipKey/u);
    assert.match(band, /viewState\.connection\.tooltipKey/u);
  });
});
