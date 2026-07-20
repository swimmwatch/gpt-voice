import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isTextActionStatus, sanitizeTextActionStatus } from '@shared/textActionStatus';

describe('text-action status contract', () => {
  it('accepts only finite action and phase combinations', () => {
    assert.equal(isTextActionStatus({ action: 'translation', phase: 'working' }), true);
    assert.equal(isTextActionStatus({ action: 'prettify', phase: 'cancelled' }), true);
    assert.equal(isTextActionStatus({ action: 'translation', phase: 'skipped' }), true);
  });

  it('rejects arbitrary strings and technical payloads', () => {
    assert.equal(isTextActionStatus('Error: https://service.example/path\n at handler'), false);
    assert.equal(isTextActionStatus({ action: 'translation', phase: 'TimeoutError: call log' }), false);
    assert.equal(isTextActionStatus({ action: 'unknown', phase: 'failed' }), false);
    assert.equal(isTextActionStatus({ action: 'prettify', phase: 'failed', detail: '/tmp/private' }), false);
    assert.equal(isTextActionStatus(null), false);
  });

  it('normalizes invalid IPC payloads to null', () => {
    const valid = { action: 'translation', phase: 'completed' } as const;

    assert.deepEqual(sanitizeTextActionStatus(valid), valid);
    assert.equal(sanitizeTextActionStatus('https://provider.example HTTP 503'), null);
    assert.equal(sanitizeTextActionStatus({ action: 'prettify', phase: 'failed', output: 'raw output' }), null);
  });
});
