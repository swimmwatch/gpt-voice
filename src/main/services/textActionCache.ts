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

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) {
        return null;
      }

      if (entry.expiresAt !== null && entry.expiresAt <= now()) {
        entries.delete(key);
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
        entries.delete(key);
      }
      entries.set(key, {
        expiresAt: maxAgeMs === null ? null : now() + maxAgeMs,
        value,
      });

      while (entries.size > normalizedMaxEntries) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey === undefined) {
          break;
        }
        entries.delete(oldestKey);
      }
    },
    clear() {
      entries.clear();
    },
    size() {
      return entries.size;
    },
  };
}
