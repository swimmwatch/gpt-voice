const NOTIFICATION_BODY_MAX_CHARS = 120;

export type SystemNotificationSound = 'success' | 'error';

export interface SystemNotificationOptions {
  sound?: SystemNotificationSound;
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

export function formatNotificationBody(error: unknown, fallback: string): string {
  const message = getNotificationErrorMessage(error) || fallback;
  const singleLine = message.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= NOTIFICATION_BODY_MAX_CHARS) {
    return singleLine;
  }
  return `${singleLine.slice(0, NOTIFICATION_BODY_MAX_CHARS - 3)}...`;
}

export function getNotificationSoundKind(options?: SystemNotificationOptions): SystemNotificationSound | null {
  return options?.sound === 'success' || options?.sound === 'error' ? options.sound : null;
}
