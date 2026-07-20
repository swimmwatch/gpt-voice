import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function getCssRule(styles: string, selector: string): string {
  const start = styles.lastIndexOf(`${selector} {`);
  const end = styles.indexOf('\n}', start);
  return start < 0 || end < 0 ? '' : styles.slice(start, end + 2);
}

describe('main recording status layout', () => {
  it('uses a flow-based three-column status row that allows concise messages to wrap', () => {
    const styles = readProjectFile('src/renderer/styles/globals.css');
    const band = getCssRule(styles, '.command-dock-status-band');
    const detail = getCssRule(styles, '.command-dock-status-detail');

    assert.match(band, /display: grid;/u);
    assert.match(band, /grid-template-columns: max-content minmax\(0, 1fr\) max-content;/u);
    assert.match(band, /min-height: 49px;/u);
    assert.match(detail, /grid-column: 2;/u);
    assert.match(detail, /overflow-wrap: anywhere;/u);
    assert.match(detail, /text-wrap: balance;/u);
    assert.match(detail, /white-space: normal;/u);
    assert.doesNotMatch(detail, /position:/u);
    assert.doesNotMatch(detail, /text-overflow:/u);
    assert.doesNotMatch(detail, /overflow: hidden;/u);
  });

  it('renders semantic status in the central live region and not as raw text', () => {
    const app = readProjectFile('src/renderer/App.tsx');
    const controls = readProjectFile('src/renderer/components/RecordingControls.tsx');
    const presentation = readProjectFile('src/renderer/statusPresentation.ts');

    assert.match(app, /setStatus\(textActionStatusToRendererStatus\(nextStatus\)\)/u);
    assert.match(controls, /status: RendererStatus \| null;/u);
    assert.match(controls, /getRendererStatusDetail\(status, state\)/u);
    assert.match(controls, /aria-live="polite" className="command-dock-status-detail"/u);
    assert.doesNotMatch(presentation, /kind: 'text'/u);
    assert.doesNotMatch(presentation, /literalStatus/u);
  });
});
