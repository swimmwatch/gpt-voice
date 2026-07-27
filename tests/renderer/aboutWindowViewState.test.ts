import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { getAboutWindowInfoState } from '@renderer/aboutWindowViewState';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('aboutWindowViewState', () => {
  it('shows an error state instead of leaving loading copy visible after metadata fails', () => {
    assert.equal(getAboutWindowInfoState(null, true), 'failed');
  });

  it('shows loading until metadata is available', () => {
    assert.equal(getAboutWindowInfoState(null, false), 'loading');
  });

  it('shows metadata when it is loaded', () => {
    assert.equal(
      getAboutWindowInfoState(
        {
          copyright: 'Copyright',
          license: 'License',
          licenseUrl: 'https://example.com/license',
          name: 'GPT-Voice',
          projectUrl: 'https://example.com/project',
          version: '1.4.0',
        },
        false,
      ),
      'loaded',
    );
  });

  it('keeps the compact functional About UI renderer-path-free with the full logo layout', () => {
    const source = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/AboutWindow.tsx'), 'utf8');

    assert.match(source, /<img alt="" className="size-20 shrink-0"/u);
    assert.match(source, /items-center justify-center gap-4 p-5 text-center/u);
    assert.doesNotMatch(source, /overflow-y-auto/u);
    assert.doesNotMatch(source, /exportDiagnostics|diagnosticsSensitivityWarning|Download/u);
    assert.doesNotMatch(source, /filePath|defaultPath|showSaveDialog|node:fs|electron/u);
  });
});
