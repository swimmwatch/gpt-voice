export interface TextActionResultCache {
  get(key: string): string | null;
  set(key: string, value: string): void;
  clear(): void;
  size(): number;
}

export function createTextActionCacheKey(parts: readonly string[]): string {
  return JSON.stringify(parts);
}

export function createTextActionResultCache(maxEntries: number): TextActionResultCache {
  const entries = new Map<string, string>();
  const normalizedMaxEntries = Math.max(1, Math.floor(maxEntries));

  return {
    get(key) {
      const value = entries.get(key);
      if (value === undefined) {
        return null;
      }

      entries.delete(key);
      entries.set(key, value);
      return value;
    },
    set(key, value) {
      if (!value.trim()) {
        return;
      }

      if (entries.has(key)) {
        entries.delete(key);
      }
      entries.set(key, value);

      while (entries.size > normalizedMaxEntries) {
        const oldestKey = entries.keys().next().value as string | undefined;
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
