/* eslint-disable max-classes-per-file -- the Electron fakes own isolated window and web-contents event state. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  BrowserWindow,
  BrowserWindowConstructorOptions,
  Display,
  Point,
  Rectangle,
  WebContents,
  WindowOpenHandlerResponse,
} from 'electron';
import {
  PRETTIFY_PROFILE_CHOOSER_BACKGROUND_COLOR,
  PRETTIFY_PROFILE_CHOOSER_PATH,
  PRETTIFY_PROFILE_CHOOSER_TITLE,
  PrettifyProfileChooserWindowController,
  calculatePrettifyProfileChooserBounds,
} from '@main/prettifyProfileChooserWindowController';
import {
  PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS,
  type PrettifyProfileChooserOutcome,
  type PrettifyProfileChooserRequest,
} from '@shared/prettifyProfileChooser';

type Listener = (...args: unknown[]) => void;
type WindowOpenHandler = (details: { url: string }) => WindowOpenHandlerResponse;

const CUSTOM_PROFILE_ID = 'custom:00000000-0000-4000-8000-000000000001' as const;
const CHOOSER_URL = `app://gpt-voice/${PRETTIFY_PROFILE_CHOOSER_PATH}`;
const TOKEN = '00000000-0000-4000-8000-000000000009';

class RecordingChooserWindow {
  public closeCount = 0;
  public readonly contentBounds: Rectangle[] = [];
  public destroyed = false;
  public focusCount = 0;
  public loadUrls: string[] = [];
  public minimized = false;
  public restoreCount = 0;
  public showCount = 0;
  public readonly sent: Array<readonly unknown[]> = [];
  public readonly webContents: WebContents;
  private readonly listeners = new Map<string, Listener[]>();
  private readonly webContentsListeners = new Map<string, Listener[]>();
  private url = '';
  private windowOpenHandler: WindowOpenHandler | null = null;

  public constructor(
    public readonly options: BrowserWindowConstructorOptions,
    public readonly id = 41,
  ) {
    this.webContents = {
      getURL: () => this.url,
      id,
      isDestroyed: () => this.destroyed,
      on: (event: string, listener: Listener) => {
        this.addListener(this.webContentsListeners, event, listener);
        return this.webContents;
      },
      send: (...args: unknown[]) => {
        this.sent.push(args);
      },
      setWindowOpenHandler: (handler: WindowOpenHandler) => {
        this.windowOpenHandler = handler;
      },
    } as unknown as WebContents;
  }

  public close(): void {
    if (this.destroyed) return;
    this.closeCount += 1;
    this.destroyed = true;
    this.emitWindow('closed');
  }

  public focus(): void {
    this.focusCount += 1;
  }

  public isDestroyed(): boolean {
    return this.destroyed;
  }

  public isMinimized(): boolean {
    return this.minimized;
  }

  public loadURL(url: string): Promise<void> {
    this.url = url;
    this.loadUrls.push(url);
    return Promise.resolve();
  }

  public on(event: string, listener: Listener): this {
    this.addListener(this.listeners, event, listener);
    return this;
  }

  public once(event: string, listener: Listener): this {
    this.addListener(this.listeners, event, listener);
    return this;
  }

  public restore(): void {
    this.minimized = false;
    this.restoreCount += 1;
  }

  public setMenuBarVisibility(): void {}

  public setContentBounds(bounds: Rectangle): void {
    this.contentBounds.push({ ...bounds });
  }

  public show(): void {
    this.showCount += 1;
  }

  public triggerNativeReady(): void {
    this.emitWindow('ready-to-show');
  }

  public triggerTerminal(event: 'closed' | 'unresponsive' | 'render-process-gone' | 'did-fail-load'): void {
    if (event === 'closed') {
      this.destroyed = true;
      this.emitWindow(event);
      return;
    }
    if (event === 'unresponsive') {
      this.emitWindow(event);
      return;
    }
    if (event === 'did-fail-load') {
      this.emitWebContents(event, {}, -1, 'failure', CHOOSER_URL, true);
      return;
    }
    this.emitWebContents(event, {}, {});
  }

  public triggerNavigation(url: string): number {
    let preventCount = 0;
    this.emitWebContents(
      'will-navigate',
      {
        preventDefault: () => {
          preventCount += 1;
        },
      },
      url,
    );
    return preventCount;
  }

  public openWindow(url: string): WindowOpenHandlerResponse | null {
    return this.windowOpenHandler?.({ url }) ?? null;
  }

  private addListener(target: Map<string, Listener[]>, event: string, listener: Listener): void {
    target.set(event, [...(target.get(event) ?? []), listener]);
  }

  private emitWindow(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }

  private emitWebContents(event: string, ...args: unknown[]): void {
    for (const listener of this.webContentsListeners.get(event) ?? []) listener(...args);
  }
}

function createDisplay(workArea: Display['workArea']): Display {
  return { bounds: workArea, workArea } as Display;
}

function createRequest(): PrettifyProfileChooserRequest {
  return {
    initialProfileId: CUSTOM_PROFILE_ID,
    profiles: [
      { id: 'prompt-ready', isDefault: true, kind: 'built-in', name: 'Prompt-ready' },
      {
        description: 'Description',
        id: CUSTOM_PROFILE_ID,
        isDefault: false,
        kind: 'custom',
        name: 'Custom',
      },
    ],
    sourceText: 'source-canary',
  };
}

class ChooserHarness {
  public availableDisplays: Display[];
  public readonly created: RecordingChooserWindow[] = [];
  public cursorPoint: Point;
  public cursorWorkArea: Display['workArea'];
  public readonly externalUrls: string[] = [];
  public primaryCalls = 0;
  public readonly controller: PrettifyProfileChooserWindowController;

  public constructor(
    cursorWorkArea: Display['workArea'] = { height: 900, width: 1200, x: 100, y: 200 },
    primaryWorkArea: Display['workArea'] = { height: 800, width: 1000, x: 0, y: 0 },
    cursorPoint: Point = { x: 200, y: 300 },
  ) {
    this.cursorPoint = cursorPoint;
    this.cursorWorkArea = cursorWorkArea;
    this.availableDisplays = [createDisplay(cursorWorkArea), createDisplay(primaryWorkArea)];
    this.controller = new PrettifyProfileChooserWindowController({
      createBrowserWindow: (options) => {
        const window = new RecordingChooserWindow(options, this.created.length + 41);
        this.created.push(window);
        return window as unknown as BrowserWindow;
      },
      getAppIconPath: () => '/app/icon.png',
      getAppUrl: (pathname = 'index.html') => `app://gpt-voice/${pathname}`,
      logger: { warn: () => undefined },
      openExternal: async (url) => {
        this.externalUrls.push(url);
      },
      preloadPath: '/app/prettify-profile-chooser-preload.js',
      randomUUID: () => TOKEN,
      screen: {
        getAllDisplays: () => this.availableDisplays,
        getCursorScreenPoint: () => this.cursorPoint,
        getDisplayNearestPoint: () => createDisplay(this.cursorWorkArea),
        getPrimaryDisplay: () => {
          this.primaryCalls += 1;
          return createDisplay(primaryWorkArea);
        },
      },
    });
  }

  public loadPayload() {
    const payload = this.controller.loadPayload();
    assert.ok(payload);
    return payload;
  }

  public show(): void {
    const payload = this.loadPayload();
    assert.equal(this.controller.rendererReady(payload.token), true);
    this.created[0]?.triggerNativeReady();
  }
}

describe('PrettifyProfileChooserWindowController', () => {
  it('calculates chooser bounds centered and constrained within one display', () => {
    assert.deepEqual(calculatePrettifyProfileChooserBounds({ height: 672, width: 652, x: 100, y: 200 }), {
      height: 640,
      width: 620,
      x: 116,
      y: 216,
    });
    assert.deepEqual(calculatePrettifyProfileChooserBounds({ height: 536, width: 456, x: -100, y: 20 }), {
      height: 520,
      width: 440,
      x: -92,
      y: 28,
    });
    assert.deepEqual(calculatePrettifyProfileChooserBounds({ height: 5, width: 10, x: 2, y: 3 }), {
      height: 1,
      width: 1,
      x: 7,
      y: 5,
    });
    assert.deepEqual(calculatePrettifyProfileChooserBounds({ height: 900, width: 1200, x: 1920, y: 0 }), {
      height: 640,
      width: 620,
      x: 2210,
      y: 130,
    });
    assert.equal(calculatePrettifyProfileChooserBounds({ height: 0, width: 10, x: 0, y: 0 }), null);
  });

  it('uses the cursor display, falls back to primary, and cancels for an invalid primary work area', async () => {
    const cursorHarness = new ChooserHarness({ height: 672, width: 652, x: 100, y: 200 });
    void cursorHarness.controller.open(createRequest());
    assert.equal(cursorHarness.primaryCalls, 0);
    assert.deepEqual(
      {
        height: cursorHarness.created[0]?.options.height,
        width: cursorHarness.created[0]?.options.width,
        x: cursorHarness.created[0]?.options.x,
        y: cursorHarness.created[0]?.options.y,
      },
      { height: 640, width: 620, x: 116, y: 216 },
    );

    const fallbackHarness = new ChooserHarness(
      { height: 0, width: 0, x: 0, y: 0 },
      { height: 536, width: 456, x: -100, y: 20 },
    );
    void fallbackHarness.controller.open(createRequest());
    assert.equal(fallbackHarness.primaryCalls, 0);
    assert.equal(fallbackHarness.created[0]?.options.width, 440);

    const invalidHarness = new ChooserHarness(
      { height: 0, width: 0, x: 0, y: 0 },
      { height: Number.NaN, width: 0, x: 0, y: 0 },
    );
    assert.deepEqual(await invalidHarness.controller.open(createRequest()), { type: 'cancel' });
    assert.equal(invalidHarness.created.length, 0);
  });

  it('centers the chooser on the available display containing the cursor', () => {
    const harness = new ChooserHarness(
      { height: 900, width: 1200, x: 1920, y: 0 },
      { height: 1080, width: 1920, x: 0, y: 0 },
      { x: 2500, y: 450 },
    );

    void harness.controller.open(createRequest());

    const chooser = harness.created[0];
    assert.ok(chooser);
    assert.equal(chooser.options.parent, undefined);
    assert.equal(chooser.options.modal, undefined);
    assert.deepEqual({ x: chooser.options.x, y: chooser.options.y }, { x: 2210, y: 130 });
  });

  it('uses the only available display even when the cursor API points to an unavailable display', () => {
    const harness = new ChooserHarness(
      { height: 1080, width: 1920, x: 0, y: 0 },
      { height: 800, width: 1000, x: 0, y: 0 },
      { x: 500, y: 400 },
    );
    harness.availableDisplays = [createDisplay({ height: 1080, width: 1920, x: 1920, y: 0 })];

    void harness.controller.open(createRequest());

    assert.equal(harness.created[0]?.options.x, 2570);
    assert.equal(harness.created[0]?.options.y, 220);
  });

  it('creates one secure native window and stays hidden until payload, renderer, and native readiness', () => {
    const harness = new ChooserHarness();
    const request = createRequest();
    void harness.controller.open(request);
    const window = harness.created[0];
    assert.ok(window);
    assert.equal(window.loadUrls[0], CHOOSER_URL);
    assert.deepEqual(window.options.webPreferences, {
      contextIsolation: true,
      navigateOnDragDrop: false,
      nodeIntegration: false,
      preload: '/app/prettify-profile-chooser-preload.js',
      sandbox: true,
      webviewTag: false,
    });
    assert.equal(window.options.backgroundColor, PRETTIFY_PROFILE_CHOOSER_BACKGROUND_COLOR);
    assert.equal(window.options.title, PRETTIFY_PROFILE_CHOOSER_TITLE);
    assert.equal(window.options.frame, true);
    assert.equal(window.options.resizable, false);
    assert.equal(window.options.show, false);
    assert.equal(window.options.useContentSize, true);

    window.triggerNativeReady();
    assert.equal(window.showCount, 0);
    const payload = harness.loadPayload();
    assert.equal(window.showCount, 0);
    assert.equal(Object.isFrozen(payload), true);
    assert.equal(Object.isFrozen(payload.profiles), true);
    Reflect.set(request.profiles, 1, { ...request.profiles[1], name: 'mutated' });
    assert.equal(payload.profiles[1]?.name, 'Custom');
    assert.equal(harness.controller.rendererReady(payload.token), true);
    assert.equal(window.showCount, 1);
    assert.equal(window.focusCount, 1);
    assert.deepEqual(window.contentBounds, [{ height: 640, width: 620, x: 390, y: 330 }]);
    assert.equal(harness.controller.isTrustedSender(window.webContents, CHOOSER_URL), true);
    assert.equal(
      harness.controller.isTrustedSender(
        { ...window.webContents, id: window.webContents.id } as WebContents,
        CHOOSER_URL,
      ),
      false,
    );

    harness.controller.publishLocaleChanged('ru');
    assert.deepEqual(window.sent, [[PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.localeChanged, 'ru']]);
  });

  it('reuses and focuses one visible operation without replacing its payload', async () => {
    const harness = new ChooserHarness();
    const firstPromise = harness.controller.open(createRequest());
    harness.show();
    const window = harness.created[0];
    assert.ok(window);
    window.minimized = true;
    harness.cursorPoint = { x: 2500, y: 450 };
    harness.cursorWorkArea = { height: 900, width: 1200, x: 1920, y: 0 };
    harness.availableDisplays = [
      createDisplay(harness.cursorWorkArea),
      createDisplay({ height: 800, width: 1000, x: 0, y: 0 }),
    ];

    const secondPromise = harness.controller.open({
      profiles: [{ id: 'natural', isDefault: true, kind: 'built-in', name: 'Replacement' }],
      sourceText: 'replacement-source',
    });

    assert.equal(firstPromise, secondPromise);
    assert.equal(harness.created.length, 1);
    assert.equal(window.restoreCount, 1);
    assert.equal(window.showCount, 2);
    assert.equal(window.focusCount, 2);
    assert.deepEqual(window.contentBounds[window.contentBounds.length - 1], {
      height: 640,
      width: 620,
      x: 2210,
      y: 130,
    });
    harness.controller.cancel();
    assert.deepEqual(await firstPromise, { type: 'cancel' });
  });

  it('allows only exact navigation and delegates HTTPS externally without opening a child window', async () => {
    const harness = new ChooserHarness();
    void harness.controller.open(createRequest());
    const window = harness.created[0];
    assert.ok(window);

    assert.equal(window.triggerNavigation(CHOOSER_URL), 0);
    assert.equal(window.triggerNavigation('app://gpt-voice/settings.html'), 1);
    assert.deepEqual(window.openWindow('https://example.com/path'), { action: 'deny' });
    assert.deepEqual(window.openWindow('file:///private/source'), { action: 'deny' });
    await Promise.resolve();
    assert.deepEqual(harness.externalUrls, ['https://example.com/path']);
  });

  for (const terminalEvent of ['closed', 'did-fail-load', 'render-process-gone', 'unresponsive'] as const) {
    it(`cancels and clears exactly once after ${terminalEvent}`, async () => {
      const harness = new ChooserHarness();
      const outcomePromise = harness.controller.open(createRequest());
      const payload = harness.loadPayload();
      const window = harness.created[0];
      assert.ok(window);

      window.triggerTerminal(terminalEvent);
      window.triggerTerminal('unresponsive');

      assert.deepEqual(await outcomePromise, { type: 'cancel' });
      assert.equal(harness.controller.apply(payload.token, 'prompt-ready'), false);
      assert.equal(harness.controller.loadPayload(), null);
      assert.equal(harness.controller.isTrustedSender(window.webContents, CHOOSER_URL), false);
      assert.equal(window.closeCount, terminalEvent === 'closed' ? 0 : 1);
    });
  }

  it('validates Apply IDs and resolves Apply, Cancel, Manage, and dispose terminal paths', async () => {
    const runTerminal = async (
      action: (
        controller: PrettifyProfileChooserWindowController,
        token: ReturnType<ChooserHarness['loadPayload']>['token'],
      ) => boolean | void,
      expected: PrettifyProfileChooserOutcome,
    ): Promise<void> => {
      const harness = new ChooserHarness();
      const promise = harness.controller.open(createRequest());
      const payload = harness.loadPayload();
      action(harness.controller, payload.token);
      assert.deepEqual(await promise, expected);
      assert.equal(harness.created[0]?.closeCount, 1);
      assert.equal(harness.controller.cancelWithToken(payload.token), false);
    };

    const invalidHarness = new ChooserHarness();
    const validPromise = invalidHarness.controller.open(createRequest());
    const validPayload = invalidHarness.loadPayload();
    assert.equal(invalidHarness.controller.apply(validPayload.token, 'natural'), false);
    assert.equal(invalidHarness.created[0]?.closeCount, 0);
    assert.equal(invalidHarness.controller.apply(validPayload.token, CUSTOM_PROFILE_ID), true);
    assert.deepEqual(await validPromise, { profileId: CUSTOM_PROFILE_ID, type: 'apply' });

    await runTerminal((controller, token) => controller.cancelWithToken(token), { type: 'cancel' });
    await runTerminal((controller, token) => controller.manageProfiles(token), { type: 'manageProfiles' });
    await runTerminal((controller) => controller.dispose(), { type: 'cancel' });
  });
});
