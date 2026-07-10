const NOTIFICATION_BODY_MAX_CHARS = 120;

export type SystemNotificationSound = 'success' | 'error';

export type NotificationErrorCode =
  | 'audioPreparationFailed'
  | 'clipboardUnavailable'
  | 'connectionFailed'
  | 'humanReadable'
  | 'notConfigured'
  | 'operationTimedOut'
  | 'providerRequestFailed'
  | 'rateLimited'
  | 'unexpectedProviderResponse'
  | 'unknown';

export type NotificationErrorContext = 'generic' | 'prettify' | 'transcription' | 'translation';

export interface SystemNotificationOptions {
  sound?: SystemNotificationSound;
}

export interface NotificationErrorLogMetadata {
  code: NotificationErrorCode;
  context: NotificationErrorContext;
  errorName?: string;
  hasFilePath: boolean;
  hasMessage: boolean;
  hasStackTrace: boolean;
  hasUrl: boolean;
  messageLength: number;
  service?: string;
  status?: number;
  wasSanitized: boolean;
}

export interface PresentedNotificationError {
  code: NotificationErrorCode;
  safeLogMetadata: NotificationErrorLogMetadata;
  userMessage: string;
}

export type NotificationErrorTranslationKey =
  | 'error.notificationAudioPreparationFailed'
  | 'error.notificationClipboardUnavailable'
  | 'error.notificationConnectionFailed'
  | 'error.notificationOperationTimedOut'
  | 'error.notificationProviderRequestFailed'
  | 'error.notificationUnexpectedProviderResponse'
  | 'error.notificationUnknown';

export type NotificationErrorTranslator = (
  key: NotificationErrorTranslationKey,
  params?: Record<string, string>,
) => string;

export interface NotificationErrorPresentationOptions {
  context?: NotificationErrorContext;
  fallback?: string;
  t?: NotificationErrorTranslator;
}

export function getNotificationErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error.trim();
  }
  if (error instanceof Error) {
    return error.message.trim();
  }
  return '';
}

function normalizeNotificationMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim();
}

function isAsciiDigitString(value: string): boolean {
  if (!value) return false;
  for (const character of value) {
    const codePoint = character.charCodeAt(0);
    if (codePoint < 48 || codePoint > 57) {
      return false;
    }
  }
  return true;
}

function stripTrailingNonDigits(value: string): string {
  let endIndex = value.length;
  while (endIndex > 0) {
    const codePoint = value.charCodeAt(endIndex - 1);
    if (codePoint >= 48 && codePoint <= 57) {
      break;
    }
    endIndex -= 1;
  }
  return value.slice(0, endIndex);
}

function isAsciiLetterOrDigit(codePoint: number): boolean {
  return (
    (codePoint >= 48 && codePoint <= 57) ||
    (codePoint >= 65 && codePoint <= 90) ||
    (codePoint >= 97 && codePoint <= 122)
  );
}

function hasWindowsDrivePath(message: string): boolean {
  for (let index = 0; index <= message.length - 3; index += 1) {
    const driveLetter = message.charCodeAt(index);
    const isPathBoundary = index === 0 || !isAsciiLetterOrDigit(message.charCodeAt(index - 1));
    const hasDriveLetter = (driveLetter >= 65 && driveLetter <= 90) || (driveLetter >= 97 && driveLetter <= 122);
    if (
      isPathBoundary &&
      hasDriveLetter &&
      message[index + 1] === ':' &&
      (message[index + 2] === '\\' || message[index + 2] === '/')
    ) {
      return true;
    }
  }
  return false;
}

function hasLineColumnReference(message: string): boolean {
  const parts = message.split(':');
  if (parts.length < 3) return false;
  const column = stripTrailingNonDigits(parts[parts.length - 1] || '');
  const line = parts[parts.length - 2] || '';
  return isAsciiDigitString(line) && isAsciiDigitString(column);
}

function hasStackTrace(message: string): boolean {
  return message.split('\n').some((line) => line.trimStart().startsWith('at ')) || hasLineColumnReference(message);
}

function hasFilePath(message: string): boolean {
  return (
    message.includes('/home/') ||
    message.includes('/Users/') ||
    message.includes('/var/') ||
    message.includes('/tmp/') ||
    message.includes('/private/') ||
    message.includes('/usr/') ||
    message.includes('/opt/') ||
    message.includes('/workspace/') ||
    message.includes('/mnt/') ||
    hasWindowsDrivePath(message) ||
    message.includes('../') ||
    message.includes('./')
  );
}

function hasUrl(message: string): boolean {
  return message.includes('http://') || message.includes('https://');
}

function getErrorName(error: unknown): string | undefined {
  if (error instanceof Error && error.name && error.name !== 'Error') {
    return error.name;
  }
  return undefined;
}

function parseConnectionFailure(message: string): string | null {
  const prefix = 'Failed to connect to ';
  if (!message.startsWith(prefix)) return null;

  const rest = message.slice(prefix.length);
  const atIndex = rest.indexOf(' at ');
  const colonIndex = rest.indexOf(':');
  const endIndex = atIndex >= 0 ? atIndex : colonIndex >= 0 ? colonIndex : rest.length;
  const service = rest.slice(0, endIndex).trim();
  return service || null;
}

function parseProviderRequestFailure(message: string): { service: string; status: number } | null {
  const requestFailure = /^(.+?) request failed \((\d{3})\)/i.exec(message);
  if (requestFailure?.[1] && requestFailure[2]) {
    return {
      service: requestFailure[1].trim(),
      status: Number(requestFailure[2]),
    };
  }

  const openAiFailure = /^OpenAI API transcription failed with status (\d{3})/i.exec(message);
  if (openAiFailure?.[1]) {
    return {
      service: 'OpenAI API',
      status: Number(openAiFailure[1]),
    };
  }

  return null;
}

function isUnexpectedProviderResponse(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes('non-json') ||
    lowerMessage.includes('unexpected token') ||
    lowerMessage.includes('invalid json') ||
    lowerMessage.includes('response body') ||
    lowerMessage.includes('raw response') ||
    lowerMessage.includes('returned an unexpected response')
  );
}

function isOperationTimeout(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes('timeouterror') ||
    lowerMessage.includes('timed out') ||
    (lowerMessage.includes('timeout ') && lowerMessage.includes('ms exceeded')) ||
    (lowerMessage.includes('waiting for') && lowerMessage.includes('failed'))
  );
}

function isClipboardUnavailable(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes('clipboard') ||
    lowerMessage.includes('copy unavailable') ||
    lowerMessage.includes('xdotool') ||
    lowerMessage.includes('wtype') ||
    lowerMessage.includes('selected-text')
  );
}

function isAudioPreparationFailure(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes('web audio transcoding failed') ||
    lowerMessage.includes('decodeaudiodata') ||
    (lowerMessage.includes('could not prepare') && lowerMessage.includes('recording')) ||
    (lowerMessage.includes('audio') && lowerMessage.includes('transcod')) ||
    (lowerMessage.includes('audio') && lowerMessage.includes('prepar'))
  );
}

function isRateLimited(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes('too many requests') ||
    lowerMessage.includes('rate-limited') ||
    lowerMessage.includes('rate limited') ||
    (lowerMessage.includes('try again in') && lowerMessage.includes('s'))
  );
}

function isNotConfigured(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes('not logged in') ||
    lowerMessage.includes('no access token') ||
    lowerMessage.includes('api key') ||
    lowerMessage.includes('select a prettify model') ||
    lowerMessage.includes('configure the provider')
  );
}

function isTechnicalMessage(message: string, normalizedMessage: string): boolean {
  const lowerMessage = normalizedMessage.toLowerCase();
  return (
    hasStackTrace(message) ||
    hasFilePath(message) ||
    lowerMessage.startsWith('error: ') ||
    lowerMessage.includes('typeerror:') ||
    lowerMessage.includes('referenceerror:') ||
    lowerMessage.includes('syntaxerror:') ||
    lowerMessage.includes('domexception:') ||
    lowerMessage.includes('fetch failed') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('enotfound') ||
    lowerMessage.includes('eai_again') ||
    lowerMessage.includes('err_')
  );
}

function translateErrorMessage(
  t: NotificationErrorTranslator | undefined,
  key: NotificationErrorTranslationKey,
  fallback: string,
  params?: Record<string, string>,
): string {
  const translated = t?.(key, params);
  return translated && translated !== key ? translated : fallback;
}

function getPresentedMessage(
  code: NotificationErrorCode,
  normalizedMessage: string,
  fallback: string,
  t: NotificationErrorTranslator | undefined,
  service?: string,
  status?: number,
): string {
  switch (code) {
    case 'connectionFailed':
      return translateErrorMessage(
        t,
        'error.notificationConnectionFailed',
        `Could not connect to ${service || 'the service'}. Make sure it is running and the URL is correct.`,
        { service: service || 'the service' },
      );
    case 'providerRequestFailed':
      return translateErrorMessage(
        t,
        'error.notificationProviderRequestFailed',
        `${service || 'The service'} returned an error (${status || 'unknown'}). Try again or check provider settings.`,
        { service: service || 'The service', status: String(status || 'unknown') },
      );
    case 'unexpectedProviderResponse':
      return translateErrorMessage(
        t,
        'error.notificationUnexpectedProviderResponse',
        'The service returned an unexpected response. Try again.',
      );
    case 'operationTimedOut':
      return translateErrorMessage(t, 'error.notificationOperationTimedOut', 'The operation timed out. Try again.');
    case 'clipboardUnavailable':
      return translateErrorMessage(
        t,
        'error.notificationClipboardUnavailable',
        'Could not read the selected text. Check the selection and try again.',
      );
    case 'audioPreparationFailed':
      return translateErrorMessage(
        t,
        'error.notificationAudioPreparationFailed',
        'Could not prepare the recording. Try recording again.',
      );
    case 'unknown':
      return translateErrorMessage(t, 'error.notificationUnknown', 'Something went wrong. Try again.');
    case 'humanReadable':
    case 'notConfigured':
    case 'rateLimited':
      return normalizedMessage || fallback;
  }
}

export function presentNotificationError(
  error: unknown,
  options: NotificationErrorPresentationOptions = {},
): PresentedNotificationError {
  const context = options.context || 'generic';
  const rawMessage = getNotificationErrorMessage(error);
  const normalizedMessage = normalizeNotificationMessage(rawMessage);
  const fallback = normalizeNotificationMessage(options.fallback || '');
  const message = normalizedMessage || fallback;
  const errorName = getErrorName(error);
  const metadataBase = {
    context,
    hasFilePath: hasFilePath(rawMessage),
    hasMessage: Boolean(normalizedMessage),
    hasStackTrace: hasStackTrace(rawMessage),
    hasUrl: hasUrl(rawMessage),
    messageLength: rawMessage.length,
    ...(errorName ? { errorName } : {}),
  };

  let code: NotificationErrorCode = 'humanReadable';
  let service: string | undefined;
  let status: number | undefined;

  const connectionService = parseConnectionFailure(message);
  const providerFailure = parseProviderRequestFailure(message);
  if (!message) {
    code = fallback ? 'humanReadable' : 'unknown';
  } else if (connectionService) {
    code = 'connectionFailed';
    service = connectionService;
  } else if (providerFailure) {
    code = 'providerRequestFailed';
    service = providerFailure.service;
    status = providerFailure.status;
  } else if (isOperationTimeout(message)) {
    code = 'operationTimedOut';
  } else if (isUnexpectedProviderResponse(message)) {
    code = 'unexpectedProviderResponse';
  } else if (isAudioPreparationFailure(message)) {
    code = 'audioPreparationFailed';
  } else if (isClipboardUnavailable(message)) {
    code = 'clipboardUnavailable';
  } else if (isRateLimited(message)) {
    code = 'rateLimited';
  } else if (isTechnicalMessage(rawMessage, message)) {
    code = 'unknown';
  } else if (isNotConfigured(message)) {
    code = 'notConfigured';
  }

  const wasSanitized = code !== 'humanReadable' && code !== 'notConfigured' && code !== 'rateLimited';
  const userMessage = getPresentedMessage(code, message, fallback, options.t, service, status);
  return {
    code,
    safeLogMetadata: {
      code,
      ...metadataBase,
      ...(service ? { service } : {}),
      ...(status === undefined ? {} : { status }),
      wasSanitized,
    },
    userMessage,
  };
}

export function formatNotificationBody(
  error: unknown,
  fallback: string,
  options?: Omit<NotificationErrorPresentationOptions, 'fallback'>,
): string {
  const message = options
    ? presentNotificationError(error, { ...options, fallback }).userMessage
    : getNotificationErrorMessage(error) || fallback;
  const singleLine = message.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= NOTIFICATION_BODY_MAX_CHARS) {
    return singleLine;
  }
  return `${singleLine.slice(0, NOTIFICATION_BODY_MAX_CHARS - 3)}...`;
}

export function getNotificationSoundKind(options?: SystemNotificationOptions): SystemNotificationSound | null {
  return options?.sound === 'success' || options?.sound === 'error' ? options.sound : null;
}
