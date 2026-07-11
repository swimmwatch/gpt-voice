import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getAboutWindowInfoState } from '@renderer/aboutWindowViewState';

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
          name: 'GPT-Voice',
          version: '1.4.0',
        },
        false,
      ),
      'loaded',
    );
  });
});
