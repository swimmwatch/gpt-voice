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
    assert.match(indicator, /aria-label=\{accessibleName\}/u);
    assert.match(indicator, /<Spinner[\s\S]*?active=\{loading\}[\s\S]*?announce=\{false\}/u);
    assert.match(indicator, /normalizedLabel === normalizedTooltip/u);
    assert.doesNotMatch(indicator, /<button|onClick/u);
  });

  it('explains Voice readiness while preserving the disconnected action', () => {
    const toolbar = readProjectFile('src/renderer/components/MainToolbar.tsx');
    const styles = readProjectFile('src/renderer/styles/globals.css');

    assert.match(toolbar, /dataSlot="voice-provider-connection"/u);
    assert.match(toolbar, /tooltip=\{providerStatusTooltip\}/u);
    assert.match(toolbar, /providerConnectionFailureTooltip \|\|/u);
    assert.match(
      toolbar,
      /<Button[\s\S]*?aria-label=\{providerActionLabel\}[\s\S]*?data-icon-only[\s\S]*?onClick=\{\(\) => \{[\s\S]*?if \(isLoggingIn \|\| isProviderChangesLocked\) return;[\s\S]*?onProviderLogin\(\);/u,
    );
    assert.match(toolbar, /<LogIn aria-hidden="true" \/>/u);
    assert.doesNotMatch(
      toolbar,
      /<LogIn aria-hidden="true" \/>\}\s*<span>\{isLoggingIn \? t\('login\.loggingIn'\) : providerActionLabel\}<\/span>/u,
    );
    assert.match(toolbar, /<TooltipContent>\{providerStatusTooltip\}<\/TooltipContent>/u);
    assert.doesNotMatch(toolbar, /<TooltipContent>\{providerActionLabel\}<\/TooltipContent>/u);
    assert.match(
      styles,
      /\.command-dock \.command-dock-provider-action\[data-icon-only='true'\] \{[\s\S]*?width: 37px;[\s\S]*?height: 34px;[\s\S]*?min-width: 37px;[\s\S]*?min-height: 34px;[\s\S]*?max-width: 37px;[\s\S]*?max-height: 34px;[\s\S]*?padding: 0;[\s\S]*?border: 1px solid var\(--dock-control-border\);[\s\S]*?border-radius: 3\.5px;[\s\S]*?background: var\(--dock-surface\);[\s\S]*?color: var\(--dock-icon\);/u,
    );
    assert.match(
      styles,
      /\.command-dock \.command-dock-provider-action\[data-icon-only='true'\] svg,[\s\S]*?width: 22px;[\s\S]*?height: 22px;/u,
    );
  });

  it('keeps Prettify connection explanations while omitting the model-summary status icon', () => {
    const viewState = readProjectFile('src/renderer/mainPrettifyProvider.ts');
    const band = readProjectFile('src/renderer/components/MainPrettifyProviderBand.tsx');

    for (const key of [
      'provider.connectionCheckingTooltip',
      'provider.connectionReadyTooltip',
      'mainDock.prettifyUnavailable',
      'prettify.cli.statusChecking',
      'prettify.cli.statusAvailable',
      'mainDock.prettifySignInHelp',
      'prettify.cli.statusUnavailable',
    ]) {
      assert.equal(viewState.includes(key), true, key);
    }
    assert.match(band, /viewState\.connection\.tooltipKey/u);
    assert.match(band, /role=\{providerConnectionHasError \? 'alert' : 'status'\}/u);
    assert.match(band, /tone=\{providerConnectionHasError \? 'error' : viewState\.connection\.tone\}/u);
    assert.match(band, /loading=\{!providerConnectionHasError && viewState\.connection\.loading\}/u);
    assert.doesNotMatch(band, /dataSlot="prettify-provider-state"/u);
    assert.doesNotMatch(band, /command-dock-prettify-state/u);
  });

  it('keeps one fixed icon-only status slot across Voice, Prettify, and Translation', () => {
    const styles = readProjectFile('src/renderer/styles/globals.css');

    assert.match(styles, /--dock-provider-controls-width: 125px;/u);
    assert.match(
      styles,
      /--dock-provider-status-inset: calc\(var\(--dock-provider-controls-width\) - 37px \+ 11px\);/u,
    );
    assert.match(styles, /--dock-translation-target-width: 175px;/u);
    assert.match(styles, /\.command-dock-provider-controls \{[\s\S]*?width: var\(--dock-provider-controls-width\);/u);
    assert.match(styles, /\.command-dock-prettify-controls \{[\s\S]*?width: var\(--dock-provider-controls-width\);/u);
    assert.match(
      styles,
      /\.command-dock-language-band \{[\s\S]*?grid-template-columns:[\s\S]*?var\(--dock-translation-target-width\)[\s\S]*?var\(--dock-provider-controls-width\);/u,
    );
    assert.match(
      styles,
      /\.provider-status-badge \{[\s\S]*?width: 24px;[\s\S]*?height: 24px;[\s\S]*?min-width: 24px;[\s\S]*?min-height: 24px;[\s\S]*?max-width: 24px;[\s\S]*?max-height: 24px;[\s\S]*?border: 0;[\s\S]*?background: transparent;/u,
    );
    assert.match(
      styles,
      /\.provider-status-badge\.command-dock-provider-state \{[\s\S]*?width: 37px;[\s\S]*?height: 34px;[\s\S]*?min-width: 37px;[\s\S]*?min-height: 34px;[\s\S]*?max-width: 37px;[\s\S]*?max-height: 34px;/u,
    );
    assert.match(
      styles,
      /\.command-dock-provider-state svg,[\s\S]*?\[data-slot='spinner'\] \{[\s\S]*?width: 22px;[\s\S]*?height: 22px;/u,
    );
    assert.match(styles, /\.command-dock-prettify-connection \{[\s\S]*?justify-self: start;/u);
    assert.match(styles, /\.command-dock-translation-connection \{[\s\S]*?width: 37px;[\s\S]*?justify-self: start;/u);
    assert.match(
      styles,
      /\.command-dock-provider-band > \.command-dock-provider-controls > \.command-dock-provider-state,[\s\S]*?\.command-dock-prettify-layout \.command-dock-prettify-controls > \.command-dock-provider-state,[\s\S]*?\.command-dock-language-band > \.command-dock-translation-connection \{[\s\S]*?position: absolute;[\s\S]*?top: 50%;[\s\S]*?right: var\(--dock-provider-status-inset\);[\s\S]*?transform: translateY\(-50%\);/u,
    );
    assert.doesNotMatch(
      styles,
      /\.command-dock-translation-connection \{[\s\S]*?width: 100%;[\s\S]*?justify-self: stretch;/u,
    );
  });
});
