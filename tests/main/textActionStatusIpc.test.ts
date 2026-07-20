import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderRendererStatus, textActionStatusToRendererStatus } from '@renderer/statusPresentation';
import {
  sanitizeTextActionStatus,
  TEXT_ACTION_STATUS_ACTIONS,
  TEXT_ACTION_STATUS_PHASES,
} from '@shared/textActionStatus';

describe('text-action status IPC contract', () => {
  it('preserves every typed outcome through the preload-safe renderer path', () => {
    const t = (key: string) => key;

    for (const action of TEXT_ACTION_STATUS_ACTIONS) {
      for (const phase of TEXT_ACTION_STATUS_PHASES) {
        const incoming = { action, phase };
        assert.deepEqual(sanitizeTextActionStatus(incoming), incoming);
        assert.notEqual(
          renderRendererStatus(textActionStatusToRendererStatus(sanitizeTextActionStatus(incoming)), t),
          'error.notificationUnknown',
          `${action}:${phase}`,
        );
      }
    }
  });

  it('renders technical-looking payloads only as the generic safe failure', () => {
    const genericMessage = 'Something went wrong. Try again.';
    const t = (key: string) => (key === 'error.notificationUnknown' ? genericMessage : key);
    const technicalPayloads = [
      'Traceback (most recent call last): /tmp/private.py',
      'https://provider.example/v1 HTTP 500',
      { action: 'translation', phase: 'failed', output: 'provider output' },
      { action: 'prettify', phase: 'failed', path: '/home/user/secret' },
      { action: 'translation', phase: 'HTTP 503' },
    ];

    for (const payload of technicalPayloads) {
      const safeStatus = textActionStatusToRendererStatus(sanitizeTextActionStatus(payload));
      assert.equal(renderRendererStatus(safeStatus, t), genericMessage);
    }
  });
});
