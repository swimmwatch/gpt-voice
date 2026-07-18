import {
  getNotificationErrorMessage,
  presentNotificationError,
  type NotificationErrorLogMetadata,
} from '@shared/notifications';

export const BROWSER_NAVIGATION_MAX_ATTEMPTS = 4;
export const BROWSER_NAVIGATION_INITIAL_RETRY_DELAY_MS = 500;
export const BROWSER_NAVIGATION_MAX_RETRY_DELAY_MS = 2000;
const BROWSER_NAVIGATION_JITTER_RATIO = 0.2;

export enum BrowserNavigationService {
  ChatGPT = 'ChatGPT Web',
  Claude = 'Claude Web',
  GoogleTranslate = 'Google Translate',
}

export interface BrowserNavigationRetryEvent {
  attempt: number;
  delayMs: number;
  error: NotificationErrorLogMetadata;
  maxAttempts: number;
  service: BrowserNavigationService;
}

interface BrowserNavigationRetryInput {
  navigate: () => Promise<unknown>;
  service: BrowserNavigationService;
}

interface BrowserNavigationRetryDependencies {
  onRetry?: (event: BrowserNavigationRetryEvent) => void;
  random?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function normalizeRandomValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, value));
}

export function isRetryableBrowserNavigationError(error: unknown): boolean {
  const message = getNotificationErrorMessage(error).toLowerCase();
  return (
    message.includes('err_network_changed') ||
    message.includes('err_internet_disconnected') ||
    message.includes('err_connection_aborted') ||
    message.includes('err_connection_closed') ||
    message.includes('err_connection_failed') ||
    message.includes('err_connection_refused') ||
    message.includes('err_connection_reset') ||
    message.includes('err_name_not_resolved') ||
    message.includes('err_timed_out') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('eai_again') ||
    message.includes('timeouterror') ||
    (message.includes('timeout') && message.includes('exceeded'))
  );
}

export function getBrowserNavigationRetryDelayMs(retryNumber: number, randomValue: number = Math.random()): number {
  const retryIndex = Math.max(0, Math.trunc(retryNumber) - 1);
  const baseDelayMs = Math.min(
    BROWSER_NAVIGATION_MAX_RETRY_DELAY_MS,
    BROWSER_NAVIGATION_INITIAL_RETRY_DELAY_MS * 2 ** retryIndex,
  );
  const minDelayMs = Math.floor(baseDelayMs * (1 - BROWSER_NAVIGATION_JITTER_RATIO));
  const maxDelayMs = Math.ceil(baseDelayMs * (1 + BROWSER_NAVIGATION_JITTER_RATIO));
  return Math.round(minDelayMs + (maxDelayMs - minDelayMs) * normalizeRandomValue(randomValue));
}

function createConnectionError(service: BrowserNavigationService): Error {
  return new Error(`Failed to connect to ${service}`);
}

export async function retryBrowserNavigation(
  { navigate, service }: BrowserNavigationRetryInput,
  { onRetry, random = Math.random, sleep: wait = sleep }: BrowserNavigationRetryDependencies = {},
): Promise<void> {
  for (let attempt = 1; attempt <= BROWSER_NAVIGATION_MAX_ATTEMPTS; attempt += 1) {
    try {
      await navigate();
      return;
    } catch (error: unknown) {
      if (!isRetryableBrowserNavigationError(error)) {
        throw error;
      }

      if (attempt === BROWSER_NAVIGATION_MAX_ATTEMPTS) {
        throw createConnectionError(service);
      }

      const delayMs = getBrowserNavigationRetryDelayMs(attempt, random());
      onRetry?.({
        attempt,
        delayMs,
        error: presentNotificationError(error, { context: 'generic' }).safeLogMetadata,
        maxAttempts: BROWSER_NAVIGATION_MAX_ATTEMPTS,
        service,
      });
      await wait(delayMs);
    }
  }
}
