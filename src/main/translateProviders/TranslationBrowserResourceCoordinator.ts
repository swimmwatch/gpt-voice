import type { LaunchContextOptions } from 'cloakbrowser';
import type { BrowserContext, Page } from 'playwright-core';
import type { CloakBrowserSettingsRepository, CloakBrowserSettingsWithSecret } from '@main/cloakBrowserSettings';
import type { TranslationProviderId } from '@shared/translationProvider';

export const TRANSLATION_PROVIDER_SESSION_ORIGINS = Object.freeze([
  'https://translate.google.ru',
  'https://www.bing.com',
  'https://translate.yandex.com',
] as const);

const TRANSLATION_SESSION_STORAGE_TYPES = 'all';

export interface TranslationBrowserResourceCoordinatorDependencies {
  readonly cloakBrowserSettings: Pick<CloakBrowserSettingsRepository, 'getWithSecret'>;
  readonly createContext: (options: LaunchContextOptions) => Promise<BrowserContext>;
  readonly createContextOptions: (settings: CloakBrowserSettingsWithSecret) => LaunchContextOptions;
  readonly retainContextAfterPageClose?: boolean;
}

export interface TranslationBrowserPageRequest {
  readonly isOperationActive: () => boolean;
  readonly operationKey: string;
  readonly providerId: TranslationProviderId;
}

export type TranslationBrowserPageResult =
  | {
      readonly page: Page;
      readonly status: 'ready';
    }
  | {
      readonly status: 'cleanup-failure' | 'navigation-failure' | 'stale';
    };

interface PendingPageCreation {
  readonly context: BrowserContext;
  readonly operationKey: string;
  readonly providerId: TranslationProviderId;
  readonly settled: Promise<void>;
}

interface PendingContextCreation {
  readonly operationKey: string;
  readonly providerId: TranslationProviderId;
  readonly settled: Promise<void>;
}

/**
 * Owns the only in-memory browser context used by all Translation providers.
 * Its queue and identity checks prevent a late provider from touching a newer page.
 */
export class TranslationBrowserResourceCoordinator {
  private activeContext: BrowserContext | null = null;
  private activeOperationKey: string | null = null;
  private activePage: Page | null = null;
  private activeProviderId: TranslationProviderId | null = null;
  private contextClosePromise: Promise<boolean> | null = null;
  private contextCloseInFlight = false;
  private operationQueue: Promise<void> = Promise.resolve();
  private pageClosePromise: Promise<boolean> | null = null;
  private pendingContextCreation: PendingContextCreation | null = null;
  private pendingPageCreation: PendingPageCreation | null = null;
  private quarantinedContext: BrowserContext | null = null;

  public constructor(private readonly dependencies: TranslationBrowserResourceCoordinatorDependencies) {}

  public enqueue<Output>(operation: () => Promise<Output>): Promise<Output> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  public async ensurePage(request: TranslationBrowserPageRequest): Promise<TranslationBrowserPageResult> {
    if (!request.isOperationActive()) return { status: 'stale' };
    if (
      !(await this.awaitPendingContextCreation()) ||
      !(await this.awaitPendingPageCreation()) ||
      !(await this.awaitPendingPageClose()) ||
      !(await this.awaitQuarantine())
    ) {
      return { status: 'cleanup-failure' };
    }
    if (!request.isOperationActive()) return { status: 'stale' };

    const providerChanged = this.activeProviderId !== null && this.activeProviderId !== request.providerId;
    if (providerChanged) {
      if (!(await this.closeActivePage())) return { status: 'cleanup-failure' };
      if (!request.isOperationActive()) return { status: 'stale' };
      if (!(await this.clearSessionState())) {
        await this.closeActiveContext();
        return { status: 'cleanup-failure' };
      }
      this.activeOperationKey = null;
      this.activeProviderId = null;
    }

    if (this.activePage !== null && !this.activePage.isClosed() && this.activeProviderId === request.providerId) {
      this.activeOperationKey = request.operationKey;
      return { page: this.activePage, status: 'ready' };
    }

    if (this.activePage !== null && !(await this.closeActivePage())) {
      return { status: 'cleanup-failure' };
    }
    if (!request.isOperationActive()) return { status: 'stale' };

    const contextResult = await this.ensureContext(request);
    if (contextResult.kind !== 'ready') return { status: contextResult.status };
    const context = contextResult.context;
    const createdContext = contextResult.created;
    const pending = this.createPendingPageCreation(context, request);
    this.pendingPageCreation = pending;

    try {
      const page = await context.newPage();
      if (!request.isOperationActive() || this.pendingPageCreation !== pending || this.activeContext !== context) {
        await this.releaseDetachedPage(page);
        if (createdContext) await this.closeActiveContext(context);
        return { status: 'stale' };
      }
      this.activePage = page;
      this.activeProviderId = request.providerId;
      this.activeOperationKey = request.operationKey;
      return { page, status: 'ready' };
    } catch {
      if (createdContext) await this.closeActiveContext(context);
      return request.isOperationActive() ? { status: 'navigation-failure' } : { status: 'stale' };
    } finally {
      if (this.pendingPageCreation === pending) this.pendingPageCreation = null;
      pending.resolve();
    }
  }

  public hasReusablePage(providerId: TranslationProviderId, operationKey: string): boolean {
    return (
      this.activeProviderId === providerId &&
      this.activeOperationKey === operationKey &&
      this.activePage !== null &&
      !this.activePage.isClosed() &&
      this.pageClosePromise === null
    );
  }

  public getActivePage(providerId: TranslationProviderId, operationKey: string): Page | null {
    return this.hasReusablePage(providerId, operationKey) ? this.activePage : null;
  }

  public closePage(providerId?: TranslationProviderId, operationKey?: string): Promise<boolean> {
    if (
      (providerId !== undefined && this.activeProviderId !== providerId) ||
      (operationKey !== undefined && this.activeOperationKey !== operationKey)
    ) {
      return Promise.resolve(true);
    }
    return this.closeActivePage();
  }

  /** Releases a cancelled queue head only after marking its exact page lease unavailable. */
  public interruptOperation(providerId: TranslationProviderId, operationKey: string): void {
    void this.closePage(providerId, operationKey);
    this.operationQueue = Promise.resolve();
  }

  public shutdown(): Promise<boolean> {
    return this.closeActiveContext();
  }

  private async ensureContext(
    request: TranslationBrowserPageRequest,
  ): Promise<
    | { readonly context: BrowserContext; readonly created: boolean; readonly kind: 'ready' }
    | { readonly kind: 'failure'; readonly status: 'cleanup-failure' | 'navigation-failure' | 'stale' }
  > {
    if (this.activeContext !== null) {
      return { context: this.activeContext, created: false, kind: 'ready' };
    }
    const pending = this.createPendingContextCreation(request);
    this.pendingContextCreation = pending;
    try {
      const options = this.dependencies.createContextOptions(this.dependencies.cloakBrowserSettings.getWithSecret());
      // eslint-disable-next-line @eslint-react/naming-convention-context-name -- this is a Playwright browser context.
      const context = await this.dependencies.createContext(options);
      if (!request.isOperationActive() || this.activeContext !== null || this.quarantinedContext !== null) {
        const released = await this.releaseDetachedContext(context);
        return { kind: 'failure', status: released ? 'stale' : 'cleanup-failure' };
      }
      this.activeContext = context;
      return { context, created: true, kind: 'ready' };
    } catch {
      return request.isOperationActive()
        ? { kind: 'failure', status: 'navigation-failure' }
        : { kind: 'failure', status: 'stale' };
    } finally {
      if (this.pendingContextCreation === pending) this.pendingContextCreation = null;
      pending.resolve();
    }
  }

  private createPendingContextCreation(
    request: TranslationBrowserPageRequest,
  ): PendingContextCreation & { readonly resolve: () => void } {
    let settle: () => void = () => undefined;
    const settled = new Promise<void>((resolve) => {
      settle = resolve;
    });
    return {
      operationKey: request.operationKey,
      providerId: request.providerId,
      resolve: settle,
      settled,
    };
  }

  private createPendingPageCreation(
    context: BrowserContext,
    request: TranslationBrowserPageRequest,
  ): PendingPageCreation & {
    resolve: () => void;
  } {
    let settle: () => void = () => undefined;
    const settled = new Promise<void>((resolve) => {
      settle = resolve;
    });
    return {
      context,
      operationKey: request.operationKey,
      providerId: request.providerId,
      resolve: settle,
      settled,
    };
  }

  private async awaitPendingPageCreation(): Promise<boolean> {
    const pending = this.pendingPageCreation;
    if (pending === null) return true;
    try {
      await pending.settled;
    } catch {
      return false;
    }
    return this.pendingPageCreation === null;
  }

  private async awaitPendingContextCreation(): Promise<boolean> {
    const pending = this.pendingContextCreation;
    if (pending === null) return true;
    try {
      await pending.settled;
    } catch {
      return false;
    }
    return this.pendingContextCreation === null;
  }

  private async awaitPendingPageClose(): Promise<boolean> {
    const closing = this.pageClosePromise;
    if (closing === null) return true;
    try {
      return await closing;
    } catch {
      return false;
    }
  }

  private async awaitQuarantine(): Promise<boolean> {
    const quarantined = this.quarantinedContext;
    if (quarantined === null) return true;
    const closing = this.contextClosePromise;
    if (closing === null) return false;
    try {
      await closing;
    } catch {
      return false;
    }
    return this.quarantinedContext === null;
  }

  private async closeActivePage(): Promise<boolean> {
    const page = this.activePage;
    if (page === null || page.isClosed()) {
      if (page !== null && this.activePage === page) this.activePage = null;
      this.activeOperationKey = null;
      return this.dependencies.retainContextAfterPageClose !== false ? true : this.closeActiveContext();
    }
    if (this.pageClosePromise !== null) return this.pageClosePromise;

    const closePromise = this.closePageNow(page);
    this.pageClosePromise = closePromise;
    try {
      return await closePromise;
    } finally {
      if (this.pageClosePromise === closePromise) this.pageClosePromise = null;
    }
  }

  private async closePageNow(page: Page): Promise<boolean> {
    try {
      await page.close();
    } catch {
      return this.closeActiveContext();
    }
    if (this.activePage === page) {
      this.activePage = null;
      this.activeOperationKey = null;
    }
    return this.dependencies.retainContextAfterPageClose !== false ? true : this.closeActiveContext();
  }

  private async clearSessionState(): Promise<boolean> {
    const context = this.activeContext;
    if (context === null) return true;
    let controlPage: Page | null = null;
    let session: Awaited<ReturnType<BrowserContext['newCDPSession']>> | null = null;
    try {
      await context.clearCookies();
      await context.clearPermissions();
      controlPage = await context.newPage();
      session = await context.newCDPSession(controlPage);
      await session.send('Network.clearBrowserCache');
      for (const origin of TRANSLATION_PROVIDER_SESSION_ORIGINS) {
        await session.send('Storage.clearDataForOrigin', {
          origin,
          storageTypes: TRANSLATION_SESSION_STORAGE_TYPES,
        });
      }
      await session.detach();
      session = null;
      await controlPage.close();
      return true;
    } catch {
      return false;
    } finally {
      if (session !== null) {
        try {
          await session.detach();
        } catch {
          // The context close fallback remains authoritative.
        }
      }
      if (controlPage !== null && !controlPage.isClosed()) {
        try {
          await controlPage.close();
        } catch {
          // The context close fallback remains authoritative.
        }
      }
    }
  }

  private closeActiveContext(expectedContext?: BrowserContext): Promise<boolean> {
    const context = expectedContext ?? this.activeContext ?? this.quarantinedContext;
    if (context === null) return Promise.resolve(true);
    if (this.quarantinedContext === context && this.contextClosePromise !== null && this.contextCloseInFlight) {
      return this.contextClosePromise;
    }
    if (expectedContext !== undefined && this.activeContext !== expectedContext) return Promise.resolve(true);

    const page = this.activeContext === context ? this.activePage : null;
    if (this.activeContext === context) {
      this.activeContext = null;
      this.activePage = null;
      this.activeOperationKey = null;
      this.activeProviderId = null;
    }
    this.quarantinedContext = context;
    this.contextCloseInFlight = true;
    const closePromise = this.closeContextNow(context, page).finally(() => {
      this.contextCloseInFlight = false;
    });
    this.contextClosePromise = closePromise;
    return closePromise;
  }

  private async closeContextNow(context: BrowserContext, page: Page | null): Promise<boolean> {
    if (page !== null && !page.isClosed()) {
      try {
        await page.close();
      } catch {
        // Context closure remains the bounded fallback after a failed page close.
      }
    }
    try {
      await context.close();
      if (this.quarantinedContext === context) {
        this.quarantinedContext = null;
        this.contextClosePromise = null;
      }
      return true;
    } catch {
      return false;
    }
  }

  private async releaseDetachedPage(page: Page): Promise<void> {
    try {
      if (!page.isClosed()) await page.close();
    } catch {
      // The detached page never becomes reusable.
    }
  }

  private async releaseDetachedContext(context: BrowserContext): Promise<boolean> {
    try {
      await context.close();
      return true;
    } catch {
      if (this.activeContext === null && this.quarantinedContext === null) {
        this.quarantinedContext = context;
        this.contextClosePromise = Promise.resolve(false);
      }
      return false;
    }
  }
}
