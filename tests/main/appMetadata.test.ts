import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APP_COPYRIGHT, APP_LICENSE, APP_NAME, createAppInfo } from '@main/appMetadata';

describe('appMetadata', () => {
  it('creates renderer-safe application information from the running version', () => {
    assert.deepEqual(createAppInfo('1.4.0'), {
      copyright: APP_COPYRIGHT,
      license: APP_LICENSE,
      name: APP_NAME,
      version: '1.4.0',
    });
  });
});
