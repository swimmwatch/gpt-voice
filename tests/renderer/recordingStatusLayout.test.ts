import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function getCssRule(styles: string, selector: string): string {
  const start = styles.lastIndexOf(`${selector} {`);
  const end = styles.indexOf('\n}', start);
  return start < 0 || end < 0 ? '' : styles.slice(start, end + 2);
}

describe('main recording status layout', () => {
  it('uses a flow-based three-column status row with bounded visible detail', () => {
    const styles = readProjectFile('src/renderer/styles/globals.css');
    const band = getCssRule(styles, '.command-dock-status-band');
    const detail = getCssRule(styles, '.command-dock-status-detail');

    assert.match(band, /display: grid;/u);
    assert.match(band, /grid-template-columns: max-content minmax\(0, 1fr\) max-content;/u);
    assert.match(band, /min-height: 49px;/u);
    assert.match(detail, /grid-column: 2;/u);
    assert.match(detail, /overflow: hidden;/u);
    assert.match(detail, /text-overflow: ellipsis;/u);
    assert.match(detail, /white-space: nowrap;/u);
  });

  it('prioritizes semantic status detail over the captured-audio timer without announcing every tick', () => {
    const controls = readProjectFile('src/renderer/components/RecordingControls.tsx');

    assert.match(controls, /statusDetail \? \(/u);
    assert.match(controls, /showCapturedDuration &&/u);
    assert.match(controls, /data-slot="captured-audio-duration"/u);
    assert.match(controls, /const capturedDurationLabel = t\('recording\.capturedAudioDuration'/u);
    assert.match(controls, /aria-label=\{capturedDurationLabel\}/u);
    assert.doesNotMatch(controls, /captured-audio-duration[\s\S]*aria-live/u);
  });
});
