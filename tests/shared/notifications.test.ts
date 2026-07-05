import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatNotificationBody, getNotificationErrorMessage, getNotificationSoundKind } from '@shared/notifications';

describe('notifications', () => {
  it('normalizes notification body text from strings and errors', () => {
    assert.equal(formatNotificationBody('  provider\n unavailable  ', 'fallback'), 'provider unavailable');
    assert.equal(formatNotificationBody(new Error('  failed\tbadly  '), 'fallback'), 'failed badly');
  });

  it('falls back when no error message is available', () => {
    assert.equal(getNotificationErrorMessage({ message: 'ignored' }), '');
    assert.equal(formatNotificationBody({ message: 'ignored' }, 'Fallback body'), 'Fallback body');
  });

  it('truncates long notification bodies', () => {
    const body = 'a'.repeat(130);

    assert.equal(formatNotificationBody(body, 'fallback'), `${'a'.repeat(117)}...`);
  });

  it('returns only supported notification sound kinds', () => {
    assert.equal(getNotificationSoundKind({ sound: 'success' }), 'success');
    assert.equal(getNotificationSoundKind({ sound: 'error' }), 'error');
    assert.equal(getNotificationSoundKind(), null);
    assert.equal(getNotificationSoundKind({}), null);
  });
});
