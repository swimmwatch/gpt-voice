import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function handlerSource(source: string, channel: string, nextChannel: string): string {
  const start = source.indexOf(`'${channel}'`);
  const end = source.indexOf(`'${nextChannel}'`, start + 1);
  assert.ok(start >= 0, `Missing ${channel} IPC handler`);
  assert.ok(end > start, `Missing boundary after ${channel} IPC handler`);
  return source.slice(start, end);
}

describe('main interaction lock action gate', () => {
  it('blocks main-window work while allowing the lock owner to save settings', () => {
    const source = readFileSync(path.join(PROJECT_ROOT, 'src/main/ipc.ts'), 'utf8');

    assert.match(source, /private isMainInteractionActionBlocked\(event: Pick<IpcMainInvokeEvent, 'sender'>\)/u);
    assert.match(source, /!this\.dependencies\.windowManager\.isMainInteractionLockOwner\(event\.sender\)/u);
    const translationSettingsRegistration = source.indexOf('private registerTranslationSettingsSaveIpc');
    const nextPrivateMethod = source.indexOf(
      'private enqueuePrettifySettingsMutation',
      translationSettingsRegistration,
    );
    assert.ok(translationSettingsRegistration >= 0);
    assert.ok(nextPrivateMethod > translationSettingsRegistration);
    assert.match(
      source.slice(translationSettingsRegistration, nextPrivateMethod),
      /isMainInteractionActionBlocked\(event\)/u,
    );

    for (const [channel, nextChannel] of [
      ['provider-login', 'check-session'],
      ['set-text-action-settings', 'set-translate-settings'],
      ['set-prettify-settings', 'list-prettify-models'],
      ['load-prettify-model', 'unload-prettify-model'],
    ] as const) {
      assert.match(handlerSource(source, channel, nextChannel), /isMainInteractionActionBlocked\(event\)/u);
    }

    const translationHandler = handlerSource(source, 'translate-text', 'get-transcription-history');
    assert.match(translationHandler, /dependencies\.mainInteractionLock\.locked/u);
    assert.doesNotMatch(translationHandler, /operationActive/u);
  });
});
