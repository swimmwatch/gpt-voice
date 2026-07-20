import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createMainPrettifyCliConnectionCoordinator,
  getActivePrettifyCliProviderId,
  type MainPrettifyCliConnectionState,
} from '@renderer/mainPrettifyCliConnection';
import { DEFAULT_PRETTIFY_SETTINGS, type PrettifyCliConnectionResult } from '@shared/prettifySettings';

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void } {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, reject: rejectPromise, resolve: resolvePromise };
}

describe('main Prettify CLI connection coordinator', () => {
  it('checks only a persisted active CLI provider', () => {
    assert.equal(getActivePrettifyCliProviderId(DEFAULT_PRETTIFY_SETTINGS.providerId, false), null);
    assert.equal(getActivePrettifyCliProviderId('claude-cli', false), 'claude-cli');
    assert.equal(getActivePrettifyCliProviderId('codex-cli', true), null);
  });

  it('publishes checking immediately and ignores stale provider results', async () => {
    const claude = deferred<PrettifyCliConnectionResult>();
    const codex = deferred<PrettifyCliConnectionResult>();
    const states: (MainPrettifyCliConnectionState | null)[] = [];
    const coordinator = createMainPrettifyCliConnectionCoordinator({
      check: (providerId) => (providerId === 'claude-cli' ? claude.promise : codex.promise),
      update: (state) => states.push(state),
    });

    coordinator.refresh('claude-cli');
    coordinator.refresh('codex-cli');
    claude.resolve({ providerId: 'claude-cli', status: 'connected' });
    await Promise.resolve();
    assert.deepEqual(states, [
      { providerId: 'claude-cli', status: 'checking' },
      { providerId: 'codex-cli', status: 'checking' },
    ]);

    codex.resolve({ providerId: 'codex-cli', status: 'login-required' });
    await Promise.resolve();
    assert.deepEqual(states[states.length - 1], { providerId: 'codex-cli', status: 'login-required' });

    coordinator.refresh(null);
    assert.equal(states[states.length - 1], null);
  });

  it('maps rejected checks safely and ignores completion after disposal', async () => {
    const failed = deferred<PrettifyCliConnectionResult>();
    const late = deferred<PrettifyCliConnectionResult>();
    const states: (MainPrettifyCliConnectionState | null)[] = [];
    const coordinator = createMainPrettifyCliConnectionCoordinator({
      check: (providerId) => (providerId === 'claude-cli' ? failed.promise : late.promise),
      update: (state) => states.push(state),
    });

    coordinator.refresh('claude-cli');
    failed.reject(new Error('private process detail'));
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(states[states.length - 1], {
      errorCode: 'process-failed',
      providerId: 'claude-cli',
      status: 'unavailable',
    });

    coordinator.refresh('codex-cli');
    coordinator.dispose();
    late.resolve({ providerId: 'codex-cli', status: 'connected' });
    await Promise.resolve();
    assert.deepEqual(states[states.length - 1], { providerId: 'codex-cli', status: 'checking' });
  });
});
