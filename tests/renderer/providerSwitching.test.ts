import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createProviderSelectionCoordinator,
  type ProviderSelectionEvent,
  type ProviderSelectionRuntimeState,
} from '@renderer/providerSelectionCoordinator';
import type { ProviderInfo } from '@renderer/types';

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolveValue!: (value: T) => void;
  let rejectValue!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolveValue = resolve;
    rejectValue = reject;
  });
  return { promise, resolve: resolveValue, reject: rejectValue };
}

const PROVIDERS: ProviderInfo[] = [
  {
    authType: 'browserSession',
    category: 'web',
    hasSettings: true,
    id: 'chatgpt',
    name: 'ChatGPT Web',
    transcriptionMode: 'batch',
  },
  {
    authType: 'browserSession',
    category: 'web',
    hasSettings: true,
    id: 'claude-web',
    name: 'Claude Web',
    transcriptionMode: 'streaming',
  },
  {
    authType: 'apiKey',
    category: 'api',
    hasSettings: true,
    id: 'openai-api',
    name: 'OpenAI API',
    transcriptionMode: 'batch',
  },
];

const READY_RUNTIME: ProviderSelectionRuntimeState = {
  backgroundStatus: { ready: true },
  hasSession: true,
};

describe('provider switching', () => {
  it('reports a bootstrap failure once without applying a partial provider snapshot', async () => {
    const events: ProviderSelectionEvent[] = [];
    const coordinator = createProviderSelectionCoordinator({
      emit: (event) => events.push(event),
      getActiveProvider: async () => {
        throw new Error('synthetic bootstrap failure');
      },
      getProviders: async () => PROVIDERS,
      getRuntimeState: async () => READY_RUNTIME,
      setActiveProvider: async () => ({ success: true }),
    });

    await coordinator.bootstrap();
    await coordinator.bootstrap();

    assert.deepEqual(
      events.map((event) => event.type),
      ['bootstrap-failed'],
    );
  });

  it('discards a late bootstrap snapshot after switching starts', async () => {
    const activeProvider = deferred<string>();
    const setProvider = deferred<{ success: boolean }>();
    const events: ProviderSelectionEvent[] = [];
    let runtimeCalls = 0;
    const coordinator = createProviderSelectionCoordinator({
      emit: (event) => events.push(event),
      getActiveProvider: () => activeProvider.promise,
      getProviders: async () => PROVIDERS,
      getRuntimeState: async () => {
        runtimeCalls += 1;
        return READY_RUNTIME;
      },
      setActiveProvider: () => setProvider.promise,
    });

    const bootstrap = coordinator.bootstrap();
    const switching = coordinator.switchProvider('claude-web', 'browserSession');
    activeProvider.resolve('chatgpt');
    setProvider.resolve({ success: true });
    await Promise.all([bootstrap, switching]);

    assert.equal(
      events.some((event) => event.type === 'bootstrap-completed'),
      false,
    );
    assert.deepEqual(
      events.map((event) => event.type),
      ['switch-started', 'switch-completed', 'switch-settled'],
    );
    assert.equal(runtimeCalls, 2);
  });

  it('keeps only the latest rapid-switch result and final provider', async () => {
    const first = deferred<{ success: boolean }>();
    const second = deferred<{ success: boolean }>();
    const events: ProviderSelectionEvent[] = [];
    const persisted: string[] = [];
    const coordinator = createProviderSelectionCoordinator({
      emit: (event) => events.push(event),
      getActiveProvider: async () => 'chatgpt',
      getProviders: async () => PROVIDERS,
      getRuntimeState: async () => READY_RUNTIME,
      setActiveProvider: (providerId) => {
        persisted.push(providerId);
        return providerId === 'claude-web' ? first.promise : second.promise;
      },
    });

    const firstSwitch = coordinator.switchProvider('claude-web', 'browserSession');
    const secondSwitch = coordinator.switchProvider('openai-api', 'apiKey');
    first.resolve({ success: true });
    second.resolve({ success: true });
    await Promise.all([firstSwitch, secondSwitch]);

    assert.deepEqual(persisted, ['claude-web', 'openai-api']);
    assert.deepEqual(
      events.filter((event) => event.type === 'switch-completed').map((event) => event.providerId),
      ['openai-api'],
    );
    const finalEvent = events[events.length - 1];
    assert.equal(finalEvent?.type, 'switch-settled');
    assert.equal(finalEvent?.type === 'switch-settled' ? finalEvent.providerId : undefined, 'openai-api');
  });

  it('announces a switch so active media is cancelled before persistence starts', async () => {
    const order: string[] = [];
    const coordinator = createProviderSelectionCoordinator({
      emit: (event) => {
        if (event.type === 'switch-started') order.push(`cancel:${event.providerId}`);
      },
      getActiveProvider: async () => 'chatgpt',
      getProviders: async () => PROVIDERS,
      getRuntimeState: async () => READY_RUNTIME,
      setActiveProvider: async (providerId) => {
        order.push(`persist:${providerId}`);
        return { success: true };
      },
    });

    await coordinator.switchProvider('claude-web', 'browserSession');

    assert.deepEqual(order, ['cancel:claude-web', 'persist:claude-web']);
  });

  it('ignores stale runtime state and late results after disposal', async () => {
    const runtime = deferred<ProviderSelectionRuntimeState>();
    const events: ProviderSelectionEvent[] = [];
    const coordinator = createProviderSelectionCoordinator({
      emit: (event) => events.push(event),
      getActiveProvider: async () => 'chatgpt',
      getProviders: async () => PROVIDERS,
      getRuntimeState: () => runtime.promise,
      setActiveProvider: async () => ({ success: true }),
    });

    const switching = coordinator.switchProvider('claude-web', 'browserSession');
    coordinator.dispose();
    runtime.resolve(READY_RUNTIME);
    await switching;

    assert.deepEqual(
      events.map((event) => event.type),
      ['switch-started'],
    );
  });

  it('reports only the current failed lifecycle transition and settles once', async () => {
    const events: ProviderSelectionEvent[] = [];
    const coordinator = createProviderSelectionCoordinator({
      emit: (event) => events.push(event),
      getActiveProvider: async () => 'chatgpt',
      getProviders: async () => PROVIDERS,
      getRuntimeState: async () => READY_RUNTIME,
      setActiveProvider: async () => {
        throw new Error('synthetic switch failure');
      },
    });

    await coordinator.switchProvider('claude-web', 'browserSession');

    assert.deepEqual(
      events.map((event) => event.type),
      ['switch-started', 'switch-failed', 'switch-settled'],
    );
    assert.equal(events[1].type === 'switch-failed' ? events[1].providerId : undefined, 'claude-web');
  });
});
