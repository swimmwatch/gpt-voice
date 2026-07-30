import type { BrowserWindow, BrowserWindowConstructorOptions, Point, Rectangle, Screen, WebContents } from 'electron';
import type { AppLocaleId } from '@shared/appLocale';
import {
  PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS,
  type PrettifyProfileChooserOperationToken,
  type PrettifyProfileChooserOutcome,
  type PrettifyProfileChooserPayload,
  type PrettifyProfileChooserProfileSummary,
  type PrettifyProfileChooserRequest,
} from '@shared/prettifyProfileChooser';
import { isPrettifyBuiltInProfileId, isPrettifyProfileId, type PrettifyProfileId } from '@shared/prettifyProfiles';
import type { PrettifyProfileChooserPort } from './services/selectedTextPrettify';

export const PRETTIFY_PROFILE_CHOOSER_PATH = 'prettify-profile-chooser.html';
export const PRETTIFY_PROFILE_CHOOSER_TITLE = 'Choose a Prettify profile';
export const PRETTIFY_PROFILE_CHOOSER_BACKGROUND_COLOR = '#181a1b';
export const PRETTIFY_PROFILE_CHOOSER_PREFERRED_WIDTH = 620;
export const PRETTIFY_PROFILE_CHOOSER_PREFERRED_HEIGHT = 640;
export const PRETTIFY_PROFILE_CHOOSER_PREFERRED_INSET = 16;
export const PRETTIFY_PROFILE_CHOOSER_CONSTRAINED_INSET = 8;

const CHOOSER_REQUEST_REJECTED_LOG = 'Prettify profile chooser request rejected';
const CHOOSER_EXTERNAL_OPEN_FAILURE_LOG = 'Prettify profile chooser external navigation failed';

export interface PrettifyProfileChooserBounds {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface PrettifyProfileChooserWindowControllerDependencies {
  readonly createBrowserWindow: (options: BrowserWindowConstructorOptions) => BrowserWindow;
  readonly getAppIconPath: () => string;
  readonly getAppUrl: (pathname?: string) => string;
  readonly logger: {
    warn(...args: unknown[]): void;
  };
  readonly openExternal: (url: string) => Promise<void>;
  readonly preloadPath: string;
  readonly randomUUID: () => string;
  readonly screen: Pick<Screen, 'getCursorScreenPoint' | 'getDisplayNearestPoint' | 'getPrimaryDisplay'>;
}

interface PrettifyProfileChooserOperation {
  readonly promise: Promise<PrettifyProfileChooserOutcome>;
  readonly resolve: (outcome: PrettifyProfileChooserOutcome) => void;
  readonly profileIds: Set<PrettifyProfileId>;
  nativeReady: boolean;
  payload: PrettifyProfileChooserPayload | null;
  payloadLoaded: boolean;
  rendererReady: boolean;
  shown: boolean;
  token: PrettifyProfileChooserOperationToken | null;
}

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function isValidWorkArea(workArea: Rectangle): boolean {
  return (
    Number.isFinite(workArea.x) &&
    Number.isFinite(workArea.y) &&
    Number.isFinite(workArea.width) &&
    Number.isFinite(workArea.height) &&
    workArea.width > 0 &&
    workArea.height > 0
  );
}

function calculateAnchoredCoordinate(
  areaStart: number,
  areaSize: number,
  chooserSize: number,
  inset: number,
  anchorCoordinate: number | undefined,
): number {
  const centeredCoordinate = areaStart + (areaSize - chooserSize) / 2;
  if (anchorCoordinate === undefined || !Number.isFinite(anchorCoordinate)) return Math.round(centeredCoordinate);

  const availableSpace = Math.max(0, areaSize - chooserSize);
  const effectiveInset = Math.min(inset, availableSpace / 2);
  const minimum = areaStart + effectiveInset;
  const maximum = areaStart + areaSize - chooserSize - effectiveInset;
  return Math.round(Math.min(maximum, Math.max(minimum, anchorCoordinate - chooserSize / 2)));
}

export function calculatePrettifyProfileChooserBounds(
  workArea: Rectangle,
  anchorPoint?: Point,
): PrettifyProfileChooserBounds | null {
  if (!isValidWorkArea(workArea)) return null;

  const preferredFits =
    workArea.width >= PRETTIFY_PROFILE_CHOOSER_PREFERRED_WIDTH + PRETTIFY_PROFILE_CHOOSER_PREFERRED_INSET * 2 &&
    workArea.height >= PRETTIFY_PROFILE_CHOOSER_PREFERRED_HEIGHT + PRETTIFY_PROFILE_CHOOSER_PREFERRED_INSET * 2;
  const inset = preferredFits ? PRETTIFY_PROFILE_CHOOSER_PREFERRED_INSET : PRETTIFY_PROFILE_CHOOSER_CONSTRAINED_INSET;
  const width = preferredFits
    ? PRETTIFY_PROFILE_CHOOSER_PREFERRED_WIDTH
    : Math.max(1, Math.min(PRETTIFY_PROFILE_CHOOSER_PREFERRED_WIDTH, Math.floor(workArea.width - inset * 2)));
  const height = preferredFits
    ? PRETTIFY_PROFILE_CHOOSER_PREFERRED_HEIGHT
    : Math.max(1, Math.min(PRETTIFY_PROFILE_CHOOSER_PREFERRED_HEIGHT, Math.floor(workArea.height - inset * 2)));

  return Object.freeze({
    height,
    width,
    x: calculateAnchoredCoordinate(workArea.x, workArea.width, width, inset, anchorPoint?.x),
    y: calculateAnchoredCoordinate(workArea.y, workArea.height, height, inset, anchorPoint?.y),
  });
}

function cloneProfileSummary(value: PrettifyProfileChooserProfileSummary): PrettifyProfileChooserProfileSummary {
  if (
    !isPrettifyProfileId(value.id) ||
    (value.kind !== 'built-in' && value.kind !== 'custom') ||
    (isPrettifyBuiltInProfileId(value.id) ? value.kind !== 'built-in' : value.kind !== 'custom') ||
    typeof value.name !== 'string' ||
    value.name.trim().length === 0 ||
    typeof value.isDefault !== 'boolean' ||
    (value.description !== undefined && typeof value.description !== 'string')
  ) {
    throw new Error('Invalid Prettify profile chooser summary');
  }

  return Object.freeze({
    ...(value.description === undefined ? {} : { description: value.description }),
    id: value.id,
    isDefault: value.isDefault,
    kind: value.kind,
    name: value.name,
  });
}

function createOperationPayload(
  request: PrettifyProfileChooserRequest,
  token: PrettifyProfileChooserOperationToken,
): { readonly payload: PrettifyProfileChooserPayload; readonly profileIds: Set<PrettifyProfileId> } {
  if (
    typeof request.sourceText !== 'string' ||
    request.sourceText.trim().length === 0 ||
    !Array.isArray(request.profiles)
  ) {
    throw new Error('Invalid Prettify profile chooser request');
  }

  const profiles = Object.freeze(request.profiles.map(cloneProfileSummary));
  const profileIds = new Set<PrettifyProfileId>();
  let defaultCount = 0;
  for (const profile of profiles) {
    if (profileIds.has(profile.id)) throw new Error('Invalid Prettify profile chooser request');
    profileIds.add(profile.id);
    if (profile.isDefault) defaultCount += 1;
  }
  if (
    profiles.length === 0 ||
    defaultCount !== 1 ||
    (request.initialProfileId !== undefined && !profileIds.has(request.initialProfileId))
  ) {
    throw new Error('Invalid Prettify profile chooser request');
  }

  const payload = Object.freeze({
    ...(request.initialProfileId === undefined ? {} : { initialProfileId: request.initialProfileId }),
    profiles,
    sourceText: request.sourceText,
    token,
  });
  return { payload, profileIds };
}

/** Owns one operation-scoped chooser BrowserWindow outside generic app-window trust. */
export class PrettifyProfileChooserWindowController implements PrettifyProfileChooserPort {
  private disposed = false;
  private operation: PrettifyProfileChooserOperation | null = null;
  private window: BrowserWindow | null = null;

  /** Constructs one process-owned chooser controller from injected Electron adapters. */
  public constructor(private readonly dependencies: PrettifyProfileChooserWindowControllerDependencies) {}

  /** Opens one immutable chooser operation or focuses the current one. */
  public open(request: PrettifyProfileChooserRequest): Promise<PrettifyProfileChooserOutcome> {
    if (this.operation) {
      this.focus();
      return this.operation.promise;
    }
    if (this.disposed) return Promise.resolve(Object.freeze({ type: 'cancel' }));

    let payload: PrettifyProfileChooserPayload;
    let profileIds: Set<PrettifyProfileId>;
    let bounds: PrettifyProfileChooserBounds | null;
    try {
      const tokenValue = this.dependencies.randomUUID();
      if (!tokenValue.trim()) throw new Error('Invalid Prettify profile chooser token');
      const created = createOperationPayload(request, tokenValue as PrettifyProfileChooserOperationToken);
      payload = created.payload;
      profileIds = created.profileIds;
      bounds = this.resolveBounds();
    } catch {
      this.dependencies.logger.warn(CHOOSER_REQUEST_REJECTED_LOG);
      return Promise.resolve(Object.freeze({ type: 'cancel' }));
    }
    if (!bounds) {
      this.dependencies.logger.warn(CHOOSER_REQUEST_REJECTED_LOG);
      return Promise.resolve(Object.freeze({ type: 'cancel' }));
    }

    let resolveOperation: (outcome: PrettifyProfileChooserOutcome) => void = () => undefined;
    const promise = new Promise<PrettifyProfileChooserOutcome>((resolve) => {
      resolveOperation = resolve;
    });
    this.operation = {
      nativeReady: false,
      payload,
      payloadLoaded: false,
      profileIds,
      promise,
      rendererReady: false,
      resolve: resolveOperation,
      shown: false,
      token: payload.token,
    };

    try {
      const chooserUrl = this.getChooserUrl();
      const window = this.dependencies.createBrowserWindow({
        autoHideMenuBar: true,
        backgroundColor: PRETTIFY_PROFILE_CHOOSER_BACKGROUND_COLOR,
        frame: true,
        fullscreenable: false,
        height: bounds.height,
        icon: this.dependencies.getAppIconPath(),
        maximizable: false,
        resizable: false,
        show: false,
        title: PRETTIFY_PROFILE_CHOOSER_TITLE,
        useContentSize: true,
        webPreferences: {
          contextIsolation: true,
          navigateOnDragDrop: false,
          nodeIntegration: false,
          preload: this.dependencies.preloadPath,
          sandbox: true,
          webviewTag: false,
        },
        width: bounds.width,
        x: bounds.x,
        y: bounds.y,
      });
      this.window = window;
      window.setMenuBarVisibility(false);
      this.registerWindowLifecycle(window);
      this.applyNavigationGuards(window, chooserUrl);
      void window.loadURL(chooserUrl).catch(() => {
        this.terminateFromWindow(window);
      });
    } catch {
      this.terminate(Object.freeze({ type: 'cancel' }));
    }

    return promise;
  }

  public focus(): boolean {
    const window = this.window;
    const operation = this.operation;
    if (!window || !operation || window.isDestroyed()) return false;
    if (!operation.shown) return true;
    if (window.isMinimized()) window.restore();
    this.positionAtCursor(window);
    window.show();
    window.focus();
    return true;
  }

  public cancel(): void {
    this.terminate(Object.freeze({ type: 'cancel' }));
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel();
  }

  public isTrustedSender(sender: WebContents, senderFrameUrl: string | undefined): boolean {
    const window = this.window;
    if (
      !this.operation ||
      !window ||
      window.isDestroyed() ||
      sender.isDestroyed() ||
      window.webContents.isDestroyed() ||
      senderFrameUrl === undefined
    ) {
      return false;
    }
    const chooserUrl = this.getChooserUrl();
    return (
      sender === window.webContents &&
      sender.id === window.webContents.id &&
      senderFrameUrl === chooserUrl &&
      window.webContents.getURL() === chooserUrl
    );
  }

  public loadPayload(): PrettifyProfileChooserPayload | null {
    const operation = this.operation;
    if (!operation || operation.payloadLoaded || !operation.payload) return null;
    operation.payloadLoaded = true;
    this.showWhenReady();
    return operation.payload;
  }

  public rendererReady(token: unknown): boolean {
    const operation = this.operation;
    if (
      !operation ||
      operation.rendererReady ||
      !operation.payloadLoaded ||
      typeof token !== 'string' ||
      token !== operation.token
    ) {
      return false;
    }
    operation.rendererReady = true;
    this.showWhenReady();
    return true;
  }

  public apply(token: unknown, profileId: unknown): boolean {
    const operation = this.operation;
    if (
      !operation ||
      typeof token !== 'string' ||
      token !== operation.token ||
      !isPrettifyProfileId(profileId) ||
      !operation.profileIds.has(profileId)
    ) {
      return false;
    }
    return this.terminate(Object.freeze({ profileId, type: 'apply' }));
  }

  public cancelWithToken(token: unknown): boolean {
    if (!this.hasToken(token)) return false;
    return this.terminate(Object.freeze({ type: 'cancel' }));
  }

  public manageProfiles(token: unknown): boolean {
    if (!this.hasToken(token)) return false;
    return this.terminate(Object.freeze({ type: 'manageProfiles' }));
  }

  public publishLocaleChanged(locale: AppLocaleId): void {
    const window = this.window;
    if (!this.operation || !window || window.isDestroyed() || window.webContents.isDestroyed()) return;
    window.webContents.send(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.localeChanged, locale);
  }

  private resolveBounds(): PrettifyProfileChooserBounds | null {
    let workArea: Rectangle | null = null;
    let anchorPoint: Point | undefined;
    try {
      const cursorPoint = this.dependencies.screen.getCursorScreenPoint();
      if (isFinitePoint(cursorPoint)) {
        const cursorDisplay = this.dependencies.screen.getDisplayNearestPoint(cursorPoint);
        if (isValidWorkArea(cursorDisplay.workArea)) {
          workArea = cursorDisplay.workArea;
          anchorPoint = cursorPoint;
        }
      }
    } catch {
      workArea = null;
      anchorPoint = undefined;
    }
    if (!workArea) {
      try {
        const primaryDisplay = this.dependencies.screen.getPrimaryDisplay();
        if (isValidWorkArea(primaryDisplay.workArea)) workArea = primaryDisplay.workArea;
      } catch {
        workArea = null;
      }
    }
    return workArea ? calculatePrettifyProfileChooserBounds(workArea, anchorPoint) : null;
  }

  private positionAtCursor(window: BrowserWindow): void {
    try {
      const bounds = this.resolveBounds();
      if (bounds) window.setContentBounds(bounds);
    } catch {
      // Keep the last valid bounds if the native window or display topology changes during focus.
    }
  }

  private registerWindowLifecycle(window: BrowserWindow): void {
    window.once('ready-to-show', () => {
      if (this.window !== window || !this.operation) return;
      this.operation.nativeReady = true;
      this.showWhenReady();
    });
    window.on('closed', () => this.terminateFromWindow(window));
    window.on('unresponsive', () => this.terminateFromWindow(window));
    window.webContents.on('did-fail-load', (_event, _errorCode, _errorDescription, _validatedUrl, isMainFrame) => {
      if (isMainFrame) this.terminateFromWindow(window);
    });
    window.webContents.on('render-process-gone', () => this.terminateFromWindow(window));
  }

  private applyNavigationGuards(window: BrowserWindow, chooserUrl: string): void {
    window.webContents.on('will-navigate', (event, url) => {
      if (url === chooserUrl) return;
      event.preventDefault();
      this.dependencies.logger.warn(CHOOSER_REQUEST_REJECTED_LOG);
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:') {
          void this.dependencies.openExternal(parsed.toString()).catch(() => {
            this.dependencies.logger.warn(CHOOSER_EXTERNAL_OPEN_FAILURE_LOG);
          });
        }
      } catch {
        this.dependencies.logger.warn(CHOOSER_REQUEST_REJECTED_LOG);
      }
      return { action: 'deny' };
    });
  }

  private showWhenReady(): void {
    const operation = this.operation;
    const window = this.window;
    if (
      !operation ||
      !window ||
      operation.shown ||
      !operation.nativeReady ||
      !operation.payloadLoaded ||
      !operation.rendererReady ||
      window.isDestroyed()
    ) {
      return;
    }
    operation.shown = true;
    this.positionAtCursor(window);
    window.show();
    window.focus();
  }

  private hasToken(token: unknown): boolean {
    return typeof token === 'string' && Boolean(this.operation) && token === this.operation?.token;
  }

  private terminateFromWindow(window: BrowserWindow): void {
    if (this.window !== window) return;
    this.terminate(Object.freeze({ type: 'cancel' }));
  }

  private terminate(outcome: PrettifyProfileChooserOutcome): boolean {
    const operation = this.operation;
    if (!operation) return false;

    const resolve = operation.resolve;
    const window = this.window;
    operation.profileIds.clear();
    operation.payload = null;
    operation.token = null;
    this.operation = null;
    this.window = null;

    if (window && !window.isDestroyed()) window.close();
    resolve(outcome);
    return true;
  }

  private getChooserUrl(): string {
    return this.dependencies.getAppUrl(PRETTIFY_PROFILE_CHOOSER_PATH);
  }
}
