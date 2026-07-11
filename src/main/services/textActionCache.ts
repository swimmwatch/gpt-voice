import { createHash } from 'node:crypto';

export interface TextActionResultCache {
  get(key: string): string | null;
  set(key: string, value: string): void;
  clear(): void;
  size(): number;
}

export interface TextActionResultCacheOptions {
  maxAgeMs?: number;
  now?: () => number;
}

interface TextActionCacheEntry {
  expiresAt: number | null;
  expiryTimer: NodeJS.Timeout | null;
  value: string;
}

export function createTextActionCacheKey(parts: readonly string[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

export function createTextActionResultCache(
  maxEntries: number,
  options: TextActionResultCacheOptions = {},
): TextActionResultCache {
  const entries = new Map<string, TextActionCacheEntry>();
  const normalizedMaxEntries = Math.max(1, Math.floor(maxEntries));
  const maxAgeMs =
    typeof options.maxAgeMs === 'number' && Number.isFinite(options.maxAgeMs) && options.maxAgeMs > 0
      ? Math.floor(options.maxAgeMs)
      : null;
  const now = options.now || Date.now;

  function deleteEntry(key: string): void {
    const entry = entries.get(key);
    if (!entry) return;
    if (entry.expiryTimer) clearTimeout(entry.expiryTimer);
    entries.delete(key);
  }

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) {
        return null;
      }

      if (entry.expiresAt !== null && entry.expiresAt <= now()) {
        deleteEntry(key);
        return null;
      }

      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      if (!value.trim()) {
        return;
      }

      if (entries.has(key)) {
        deleteEntry(key);
      }
      const entry: TextActionCacheEntry = {
        expiresAt: maxAgeMs === null ? null : now() + maxAgeMs,
        expiryTimer: null,
        value,
      };
      if (maxAgeMs !== null) {
        entry.expiryTimer = setTimeout(() => {
          if (entries.get(key) === entry) {
            entries.delete(key);
          }
        }, maxAgeMs);
        entry.expiryTimer.unref();
      }
      entries.set(key, entry);

      while (entries.size > normalizedMaxEntries) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey === undefined) {
          break;
        }
        deleteEntry(oldestKey);
      }
    },
    clear() {
      for (const key of entries.keys()) {
        deleteEntry(key);
      }
    },
    size() {
      return entries.size;
    },
  };
}
