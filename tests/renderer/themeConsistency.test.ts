import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as path from 'node:path';

const GLOBAL_STYLES_PATH = path.resolve(__dirname, '../../src/renderer/styles/globals.css');

function getRuleBody(styles: string, selector: string): string {
  // Selectors are fixed test constants, never user input.
  // eslint-disable-next-line security/detect-non-literal-regexp -- Build the CSS rule matcher from that fixed selector.
  const match = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'u').exec(styles);
  assert.ok(match?.[1], `Missing ${selector} rule`);
  return match[1];
}

describe('renderer theme consistency', () => {
  it('uses the Command Dock graphite palette as the shared renderer theme', () => {
    const styles = readFileSync(GLOBAL_STYLES_PATH, 'utf8');
    const root = getRuleBody(styles, ':root');
    const commandDock = getRuleBody(styles, '\\.command-dock');

    assert.match(root, /--background: #181a1b;/u);
    assert.match(root, /--surface: #202223;/u);
    assert.match(root, /--foreground: #f4f4f5;/u);
    assert.match(root, /--border: #444748;/u);
    assert.match(commandDock, /--dock-background: var\(--background\);/u);
    assert.match(commandDock, /--dock-surface: var\(--surface\);/u);
    assert.doesNotMatch(commandDock, /--background:/u);
  });

  it('makes the actionable model-memory command visibly interactive', () => {
    const styles = readFileSync(GLOBAL_STYLES_PATH, 'utf8');
    const memoryAction = getRuleBody(styles, '\\.command-dock \\.command-dock-memory-action');
    const memoryActionHover = getRuleBody(
      styles,
      '\\.command-dock \\.command-dock-memory-action:not\\(:disabled\\):hover',
    );

    assert.match(memoryAction, /cursor: pointer;/u);
    assert.match(memoryActionHover, /background: var\(--surface-raised\);/u);
    assert.match(memoryActionHover, /border-color: var\(--dock-divider\);/u);
  });
});
