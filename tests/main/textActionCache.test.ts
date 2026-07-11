import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTextActionCacheKey, createTextActionResultCache } from '@main/services/textActionCache';

describe('textActionCache', () => {
  it('hashes cache keys instead of retaining source text', () => {
    const key = createTextActionCacheKey(['prettify', 'sensitive selected text']);

    assert.match(key, /^[a-f0-9]{64}$/);
    assert.equal(key.includes('sensitive selected text'), false);
    assert.equal(key, createTextActionCacheKey(['prettify', 'sensitive selected text']));
  });

  it('returns null for cache misses and stores non-empty results', () => {
    const cache = createTextActionResultCache(2);
    const key = createTextActionCacheKey(['translate', 'text', 'uk']);

    assert.equal(cache.get(key), null);
    cache.set(key, 'translated text');

    assert.equal(cache.get(key), 'translated text');
    assert.equal(cache.size(), 1);
  });

  it('ignores empty results', () => {
    const cache = createTextActionResultCache(2);
    const key = createTextActionCacheKey(['prettify', 'text']);

    cache.set(key, '   ');

    assert.equal(cache.get(key), null);
    assert.equal(cache.size(), 0);
  });

  it('overwrites existing entries and keeps the latest value', () => {
    const cache = createTextActionResultCache(2);
    const key = createTextActionCacheKey(['translate', 'text', 'uk']);

    cache.set(key, 'first');
    cache.set(key, 'second');

    assert.equal(cache.get(key), 'second');
    assert.equal(cache.size(), 1);
  });

  it('evicts the least recently used entry', () => {
    const cache = createTextActionResultCache(2);
    const first = createTextActionCacheKey(['first']);
    const second = createTextActionCacheKey(['second']);
    const third = createTextActionCacheKey(['third']);

    cache.set(first, 'one');
    cache.set(second, 'two');
    assert.equal(cache.get(first), 'one');
    cache.set(third, 'three');

    assert.equal(cache.get(second), null);
    assert.equal(cache.get(first), 'one');
    assert.equal(cache.get(third), 'three');
  });

  it('expires entries when a maximum age is configured', () => {
    let now = 1_000;
    const cache = createTextActionResultCache(2, { maxAgeMs: 100, now: () => now });
    const key = createTextActionCacheKey(['prettify', 'text']);

    cache.set(key, 'prettified text');
    now += 100;

    assert.equal(cache.get(key), null);
    assert.equal(cache.size(), 0);
  });
});
