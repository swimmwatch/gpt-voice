# Spec: Transcription Retry Deduplication

## Objective

Prevent repeated transcription attempts for the same prepared audio from consuming provider/API quota after an earlier attempt has already succeeded.

When GPT-Voice receives transcription audio, the main process computes a privacy-preserving cache key from the exact audio bytes and all transcription-affecting context. A successful result is retained in a bounded, short-lived in-memory cache. A later request with the same key returns that text without calling the provider transcription endpoint.

This feature serves users who retry recognition after a delayed UI response, notification issue, clipboard issue, or accidental repeated shortcut activation. Success means retries remain behaviorally equivalent to a normal successful transcription while avoiding a duplicate provider request.

## Assumptions

- The cache is process-local, memory-only, and cleared on application restart.
- Only successful, non-empty transcription text is cached.
- Cache entries contain the result text and expiry metadata, never raw audio.
- The cache key contains an SHA-256 audio digest plus MIME type, provider identity, and provider-specific transcription settings.
- A cache hit preserves existing success behavior: copy text to the clipboard, return a successful result, and add a transcription-history entry.
- Completed-result reuse is in scope. Concurrent in-flight request coalescing is not included unless approved separately.

## User-visible Behavior

1. The first transcription request for an audio/context combination follows the existing provider flow.
2. If the provider returns success with non-empty text, the main process caches the text.
3. A repeated request with the same audio/context returns the cached text and does not call `provider.transcribe`.
4. Failed, thrown, cancelled, or empty transcription results do not populate the cache.
5. Changes to audio bytes, MIME type, active provider, model, language, prompt, temperature, or other transcription-affecting settings produce a cache miss.
6. Cache hits do not change retry controls, notifications, status text, clipboard behavior, or history behavior.
7. Cache hit/miss logging contains only safe metadata such as provider ID, byte length, MIME presence, and hit status. It never logs audio, transcript text, prompts, API keys, or the cache key/digest.

## Architecture

### Trust Boundary

Deduplication lives in `src/main/services/transcription.ts`, behind the existing trusted `transcribe-audio` IPC handler. The renderer continues to send the prepared `ArrayBuffer` and MIME type exactly as it does today.

### Cache Key

The key is derived without retaining audio:

```typescript
const audioDigest = createHash('sha256').update(new Uint8Array(buffer)).digest('hex');
const cacheKey = createTextActionCacheKey([
  'transcription',
  audioDigest,
  mimeType,
  provider.info.id,
  ...provider.getTranscriptionCacheContext(),
]);
```

`BaseVoiceProvider` supplies a default context containing no mutable settings. Providers override it when results depend on configuration:

- ChatGPT Web: fixed provider identity is sufficient unless a configurable transcription option is introduced.
- OpenAI API: model, language, prompt, and temperature are included. API keys are excluded because they are secrets and do not define the requested transcription semantics.

The digest and complete cache key are never logged or exposed to the renderer.

### Cache Lifecycle

Use a bounded LRU-style in-memory result cache following `textActionCache.ts`:

- Proposed maximum entries: `10`.
- Proposed TTL: `5 minutes` from insertion.
- Reading refreshes LRU order but does not extend TTL.
- Expired and evicted entries clear their timers.
- Application shutdown naturally discards the cache.

The cached value is only the successful transcript string. Provider error bodies and `raw` response fields are never cached.

### Request Flow

1. Validate/select the active provider using the existing transcription flow.
2. Build the cache context and hash the audio bytes.
3. Check the result cache.
4. On hit:
   - copy cached text to the clipboard;
   - add the same history entry a provider success would add;
   - return `{ success: true, text }`;
   - do not call `provider.transcribe`.
5. On miss:
   - call `provider.transcribe` once;
   - on successful non-empty text, insert it into the cache;
   - preserve existing history and error handling.

Cache failures must fail closed: hashing or cache bookkeeping errors fall back to the normal provider request rather than blocking transcription. Clipboard behavior on a cache hit follows existing provider success semantics; a clipboard exception is presented through the existing transcription error path.

## Non-goals

- Persisting audio, transcripts, or cache entries to disk.
- Sharing cache entries across application restarts or devices.
- Fuzzy audio matching, acoustic fingerprints, silence normalization, or transcoding-equivalence detection.
- Caching failures or rate-limit responses.
- Deduplicating different settings or providers even when they might return identical text.
- Replacing the renderer's existing retry-audio state.
- Coalescing simultaneous in-flight requests in the first version.

## Tech Stack

- Node.js 24 and strict TypeScript.
- Electron main/renderer IPC boundary.
- Node `crypto` SHA-256 hashing.
- Existing provider abstraction through `BaseVoiceProvider`.
- Existing bounded-cache conventions from `src/main/services/textActionCache.ts`.
- Deterministic `node:test` unit tests with injected providers, clock, clipboard, history, and cache dependencies.

## Commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:types
npm test
npm run audit:prod
npm run build:prod
git diff --check
```

During implementation, run the focused transcription/cache tests first with:

```bash
node --import tsx --test tests/main/transcriptionResultCache.test.ts tests/main/transcription.test.ts
```

## Project Structure

```text
src/main/services/transcription.ts
  Main orchestration point for cache lookup, provider invocation, clipboard behavior, and history.

src/main/services/transcriptionResultCache.ts
  Binary-aware cache-key construction and bounded successful-result cache.

src/main/providers/BaseVoiceProvider.ts
  Provider cache-context contract.

src/main/providers/OpenAIApiVoiceProvider.ts
  OpenAI transcription-setting cache context.

tests/main/transcriptionResultCache.test.ts
  Key, TTL, LRU, and successful-value cache tests.

tests/main/transcription.test.ts
  Provider-call deduplication and orchestration tests.

README.md
  Privacy note explaining short-lived memory-only successful transcription caching.
```

No preload or renderer IPC contract change is expected because the request and result shapes stay unchanged.

## Code Style

Keep cache decisions explicit and dependency-injected for deterministic tests:

```typescript
const cachedText = deps.cache.get(cacheKey);
if (cachedText) {
  deps.writeClipboardText(cachedText);
  deps.recordHistory(createHistoryEntry(provider, requestedAt, cachedText));
  return { success: true, text: cachedText };
}

const result = await provider.transcribe(buffer, mimeType);
if (result.success && result.text?.trim()) {
  deps.cache.set(cacheKey, result.text);
}
return result;
```

- Use named constants for TTL and capacity.
- Keep raw bytes, transcript text, prompts, credentials, and full cache keys out of logs.
- Do not use `any`, non-null assertions, or broad lint suppressions.
- Prefer small helpers for key construction, history recording, and cache-hit handling.

## Testing Strategy

### Cache Utility Tests

- Identical bytes in separate `ArrayBuffer` objects produce the same key.
- A one-byte difference produces a different key.
- MIME, provider, or settings-context changes produce different keys.
- Keys do not contain raw audio, prompt text, or transcript text.
- Empty results are rejected by the cache.
- TTL expiry removes entries deterministically with an injected clock.
- LRU eviction removes the oldest entry when capacity is exceeded.

### Transcription Service Tests

- The first successful request calls the provider and caches the text.
- A repeated successful request returns the same text and leaves the provider call count at one.
- A cache hit still writes the clipboard and records history.
- Provider failures, thrown errors, and empty success results are not cached.
- Changing provider context bypasses the previous entry.
- Cache/hash failures fall back to a provider call.
- Logs expose no audio, transcript, prompt, credential, or digest.
- Concurrent identical requests follow the approved in-flight policy.

### Regression Verification

- Existing provider, retry-state, history, recording, and notification tests remain green.
- Type checking confirms no IPC contract drift.
- Production build succeeds.

## Boundaries

### Always

- Validate the audio payload at the trusted main-process boundary.
- Hash exact bytes; never use object identity or byte length as the deduplication key.
- Include every result-affecting provider setting in cache context.
- Cache only successful non-empty text.
- Bound cache retention by both TTL and entry count.
- Preserve clipboard, history, notification, and retry behavior on hits.
- Keep cache contents and identifiers out of logs.

### Ask First

- Persisting cache entries or transcripts to disk.
- Increasing TTL or capacity beyond the approved defaults.
- Adding in-flight request coalescing.
- Changing history behavior for cached retries.
- Changing IPC request/result shapes or adding dependencies.

### Never

- Store raw audio in the cache.
- Cache failures, authentication errors, or rate-limit responses.
- Include API keys, session identifiers, or credentials in cache keys.
- Log transcript text, raw audio, prompts, full provider responses, audio digests, or cache keys.
- Return a cached result across different provider/settings contexts.

## Success Criteria

- Two sequential requests with byte-identical audio and identical transcription context cause exactly one provider transcription call after the first call succeeds.
- Both requests return the same successful text and preserve clipboard/history behavior.
- Failed or empty results cause a provider call on every retry.
- Different bytes, MIME types, providers, or result-affecting settings never share a cached result.
- Cache data is memory-only, limited to the approved entry count, and expired after the approved TTL.
- No raw audio, transcript, prompt, credential, digest, or key is written to logs or disk.
- Focused cache/transcription tests, the complete test suite, lint, type checks, audit, and production build pass.

## Open Questions

1. Approve the proposed TTL of 5 minutes and capacity of 10 successful results, or provide different limits.
2. Should concurrent identical requests share one in-flight provider promise, or should version one cache only completed successes?
3. Should a cache-hit retry create a duplicate transcription-history entry, as retries do today, or skip history insertion?
4. Should cached results remain usable when the active provider is temporarily not ready, provided provider identity and settings still match?
