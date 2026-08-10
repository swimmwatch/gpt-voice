/* eslint-disable max-classes-per-file -- focused browser-resource fakes share one deterministic trace. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BrowserContext, Page } from 'playwright-core';

import {
  TRANSLATION_PROVIDER_SESSION_ORIGINS,
  TranslationBrowserResourceCoordinator,
} from '@main/translateProviders/TranslationBrowserResourceCoordinator';
import { TestCloakBrowserSettingsRepository } from '../appConfigTestUtils';

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
}

function createDeferred<Value>(): Deferred<Value> {
  let resolvePromise: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: (value) => {
      assert.ok(resolvePromise);
      resolvePromise(value);
    },
  };
}

class FakePage {
  public closed = false;
  public closeCalls = 0;
  public closeDeferred: Deferred<void> | null = null;
  public closeFails = false;

  public constructor(
    private readonly events: string[],
    private readonly label: string,
  ) {}

  public async close(): Promise<void> {
    this.closeCalls += 1;
    this.events.push(`close-page:${this.label}`);
    if (this.closeFails) throw new Error('synthetic page close failure');
    if (this.closeDeferred !== null) await this.closeDeferred.promise;
    this.closed = true;
  }

  public isClosed(): boolean {
    return this.closed;
  }
}

class FakeCdpSession {
  public detachCalls = 0;
  public readonly commands: Array<{ readonly method: string; readonly params: unknown }> = [];

  public constructor(private readonly events: string[]) {}

  public async detach(): Promise<void> {
    this.detachCalls += 1;
    this.events.push('detach-cdp');
  }

  public async send(method: string, params?: unknown): Promise<object> {
    this.commands.push({ method, params });
    this.events.push(`cdp:${method}`);
    return {};
  }
}

class FakeContext {
  public clearCookiesCalls = 0;
  public clearPermissionsCalls = 0;
  public closeCalls = 0;
  public closeFails = false;
  public failCookieClear = false;
  public newPageDeferred: Deferred<Page> | null = null;
  public newPageStarted: Deferred<void> | null = null;
  public readonly pages: FakePage[] = [];
  public readonly session: FakeCdpSession;

  public constructor(
    public readonly events: string[],
    private readonly id: number,
  ) {
    this.session = new FakeCdpSession(events);
  }

  public async clearCookies(): Promise<void> {
    this.clearCookiesCalls += 1;
    this.events.push('clear-cookies');
    if (this.failCookieClear) throw new Error('synthetic cookie clear failure');
  }

  public async clearPermissions(): Promise<void> {
    this.clearPermissionsCalls += 1;
    this.events.push('clear-permissions');
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
    this.events.push(`close-context:${this.id}`);
    if (this.closeFails) throw new Error('synthetic context close failure');
    for (const page of this.pages) page.closed = true;
  }

  public async newCDPSession(_page: Page): Promise<FakeCdpSession> {
    this.events.push('new-cdp');
    return this.session;
  }

  public async newPage(): Promise<Page> {
    if (this.newPageDeferred !== null) {
      const deferred = this.newPageDeferred;
      this.newPageDeferred = null;
      this.newPageStarted?.resolve();
      return deferred.promise;
    }
    const page = new FakePage(this.events, `${this.id}:${this.pages.length}`);
    this.pages.push(page);
    this.events.push(`new-page:${this.id}:${this.pages.length - 1}`);
    return page as unknown as Page;
  }
}

function createHarness(): {
  readonly contexts: FakeContext[];
  readonly coordinator: TranslationBrowserResourceCoordinator;
  readonly events: string[];
} {
  const contexts: FakeContext[] = [];
  const events: string[] = [];
  const coordinator = new TranslationBrowserResourceCoordinator({
    cloakBrowserSettings: new TestCloakBrowserSettingsRepository(),
    createContext: async () => {
      const context = new FakeContext(events, contexts.length);
      contexts.push(context);
      events.push(`new-context:${contexts.length - 1}`);
      return context as unknown as BrowserContext;
    },
    createContextOptions: () => ({ headless: true }),
  });
  return { contexts, coordinator, events };
}

function request(providerId: 'google' | 'bing' | 'yandex', operationKey: string, active = () => true) {
  return { isOperationActive: active, operationKey, providerId } as const;
}

describe('TranslationBrowserResourceCoordinator', () => {
  it('retains one context, reuses a same-provider page, and resets session state before provider replacement', async () => {
    const harness = createHarness();
    const google = await harness.coordinator.enqueue(() => harness.coordinator.ensurePage(request('google', 'g:1')));
    const googleWarm = await harness.coordinator.enqueue(() =>
      harness.coordinator.ensurePage(request('google', 'g:2')),
    );
    const bing = await harness.coordinator.enqueue(() => harness.coordinator.ensurePage(request('bing', 'b:1')));
    const yandex = await harness.coordinator.enqueue(() => harness.coordinator.ensurePage(request('yandex', 'y:1')));

    assert.equal(google.status, 'ready');
    assert.equal(googleWarm.status, 'ready');
    assert.equal(bing.status, 'ready');
    assert.equal(yandex.status, 'ready');
    assert.equal(harness.contexts.length, 1);
    assert.equal(harness.contexts[0]?.pages.filter((page) => !page.closed).length, 1);
    assert.equal(harness.contexts[0]?.clearCookiesCalls, 2);
    assert.equal(harness.contexts[0]?.clearPermissionsCalls, 2);
    assert.equal(
      harness.contexts[0]?.session.commands.filter((command) => command.method === 'Network.clearBrowserCache').length,
      2,
    );
    assert.deepEqual(
      harness.contexts[0]?.session.commands
        .filter((command) => command.method === 'Storage.clearDataForOrigin')
        .map((command) => command.params),
      [...TRANSLATION_PROVIDER_SESSION_ORIGINS, ...TRANSLATION_PROVIDER_SESSION_ORIGINS].map((origin) => ({
        origin,
        storageTypes: 'all',
      })),
    );
    assert.ok(harness.events.indexOf('close-page:0:0') < harness.events.indexOf('clear-cookies'));
    assert.ok(harness.events.indexOf('clear-cookies') < harness.events.indexOf('new-page:0:1'));
    assert.ok(harness.events.indexOf('close-page:0:1') < harness.events.indexOf('new-page:0:2'));
  });

  it('serializes cross-provider work behind one coordinator queue', async () => {
    const harness = createHarness();
    const deferred = createDeferred<void>();
    const events: string[] = [];
    const first = harness.coordinator.enqueue(async () => {
      events.push('first-start');
      await deferred.promise;
      events.push('first-end');
    });
    const second = harness.coordinator.enqueue(async () => {
      events.push('second-start');
    });

    await Promise.resolve();
    assert.deepEqual(events, ['first-start']);
    deferred.resolve();
    await Promise.all([first, second]);
    assert.deepEqual(events, ['first-start', 'first-end', 'second-start']);
  });

  it('keeps a replacement page blocked while an interrupted page is still closing', async () => {
    const harness = createHarness();
    await harness.coordinator.ensurePage(request('google', 'g:1'));
    const page = harness.contexts[0]?.pages[0];
    assert.ok(page);
    const close = createDeferred<void>();
    page.closeDeferred = close;

    harness.coordinator.interruptOperation('google', 'g:1');
    const replacement = harness.coordinator.ensurePage(request('google', 'g:2'));
    await Promise.resolve();
    assert.equal(page.closeCalls, 1);
    assert.equal(harness.contexts[0]?.pages.length, 1);

    close.resolve();
    assert.equal((await replacement).status, 'ready');
    assert.equal(harness.contexts[0]?.pages.length, 2);
  });

  it('closes the context after a failed session reset and creates no replacement until cleanup settles', async () => {
    const harness = createHarness();
    await harness.coordinator.ensurePage(request('google', 'g:1'));
    const context = harness.contexts[0];
    assert.ok(context);
    context.failCookieClear = true;

    const failed = await harness.coordinator.ensurePage(request('bing', 'b:1'));
    assert.deepEqual(failed, { status: 'cleanup-failure' });
    assert.equal(context.closeCalls, 1);
    const recovered = await harness.coordinator.ensurePage(request('yandex', 'y:1'));
    assert.equal(recovered.status, 'ready');
    assert.equal(harness.contexts.length, 2);
  });

  it('detaches a stale page created after cancellation before a later context is created', async () => {
    const events: string[] = [];
    const context = new FakeContext(events, 0);
    const deferredPage = createDeferred<Page>();
    const pageStarted = createDeferred<void>();
    context.newPageDeferred = deferredPage;
    context.newPageStarted = pageStarted;
    const coordinator = new TranslationBrowserResourceCoordinator({
      cloakBrowserSettings: new TestCloakBrowserSettingsRepository(),
      createContext: async () => context as unknown as BrowserContext,
      createContextOptions: () => ({ headless: true }),
    });
    let active = true;
    const pending = coordinator.ensurePage(request('google', 'g:1', () => active));

    await pageStarted.promise;
    active = false;
    const stalePage = new FakePage(events, '0:stale');
    context.pages.push(stalePage);
    deferredPage.resolve(stalePage as unknown as Page);
    const stale = await pending;

    assert.deepEqual(stale, { status: 'stale' });
    assert.equal(stalePage.closed, true);
  });

  it('blocks a replacement context until a cancelled context launch has settled and closed', async () => {
    const events: string[] = [];
    const firstContext = new FakeContext(events, 0);
    const firstContextCreation = createDeferred<BrowserContext>();
    const firstContextStarted = createDeferred<void>();
    const replacementContext = new FakeContext(events, 1);
    let contextLaunches = 0;
    const coordinator = new TranslationBrowserResourceCoordinator({
      cloakBrowserSettings: new TestCloakBrowserSettingsRepository(),
      createContext: async () => {
        contextLaunches += 1;
        if (contextLaunches === 1) {
          firstContextStarted.resolve();
          return firstContextCreation.promise;
        }
        return replacementContext as unknown as BrowserContext;
      },
      createContextOptions: () => ({ headless: true }),
    });
    let firstActive = true;
    const first = coordinator.ensurePage(request('google', 'g:1', () => firstActive));

    await firstContextStarted.promise;
    firstActive = false;
    coordinator.interruptOperation('google', 'g:1');
    const replacement = coordinator.ensurePage(request('bing', 'b:1'));
    await Promise.resolve();
    assert.equal(contextLaunches, 1);

    firstContextCreation.resolve(firstContext as unknown as BrowserContext);
    assert.deepEqual(await first, { status: 'stale' });
    assert.equal((await replacement).status, 'ready');
    assert.equal(firstContext.closeCalls, 1);
    assert.equal(contextLaunches, 2);
  });

  it('quarantines a cancelled context launch when its detached context cannot close', async () => {
    const events: string[] = [];
    const firstContext = new FakeContext(events, 0);
    firstContext.closeFails = true;
    const firstContextCreation = createDeferred<BrowserContext>();
    const firstContextStarted = createDeferred<void>();
    const replacementContext = new FakeContext(events, 1);
    let contextLaunches = 0;
    const coordinator = new TranslationBrowserResourceCoordinator({
      cloakBrowserSettings: new TestCloakBrowserSettingsRepository(),
      createContext: async () => {
        contextLaunches += 1;
        if (contextLaunches === 1) {
          firstContextStarted.resolve();
          return firstContextCreation.promise;
        }
        return replacementContext as unknown as BrowserContext;
      },
      createContextOptions: () => ({ headless: true }),
    });
    let firstActive = true;
    const first = coordinator.ensurePage(request('google', 'g:1', () => firstActive));

    await firstContextStarted.promise;
    firstActive = false;
    coordinator.interruptOperation('google', 'g:1');
    const replacement = coordinator.ensurePage(request('bing', 'b:1'));
    firstContextCreation.resolve(firstContext as unknown as BrowserContext);

    assert.deepEqual(await first, { status: 'cleanup-failure' });
    assert.deepEqual(await replacement, { status: 'cleanup-failure' });
    assert.equal(contextLaunches, 1);

    firstContext.closeFails = false;
    assert.equal(await coordinator.shutdown(), true);
    assert.equal((await coordinator.ensurePage(request('bing', 'b:2'))).status, 'ready');
    assert.equal(contextLaunches, 2);
  });

  it('coalesces shutdown and preserves one context close', async () => {
    const harness = createHarness();
    await harness.coordinator.ensurePage(request('google', 'g:1'));
    const context = harness.contexts[0];
    assert.ok(context);

    const [first, second] = await Promise.all([harness.coordinator.shutdown(), harness.coordinator.shutdown()]);

    assert.equal(first, true);
    assert.equal(second, true);
    assert.equal(context.closeCalls, 1);
  });

  it('quarantines a failed page/context close and recovers only after a later confirmed close', async () => {
    const harness = createHarness();
    await harness.coordinator.ensurePage(request('google', 'g:1'));
    const context = harness.contexts[0];
    const page = context?.pages[0];
    assert.ok(context);
    assert.ok(page);
    page.closeFails = true;
    context.closeFails = true;

    assert.equal(await harness.coordinator.closePage('google', 'g:1'), false);
    assert.deepEqual(await harness.coordinator.ensurePage(request('bing', 'b:1')), {
      status: 'cleanup-failure',
    });
    assert.equal(harness.contexts.length, 1);

    context.closeFails = false;
    assert.equal(await harness.coordinator.shutdown(), true);
    assert.equal((await harness.coordinator.ensurePage(request('bing', 'b:2'))).status, 'ready');
    assert.equal(harness.contexts.length, 2);
  });
});
