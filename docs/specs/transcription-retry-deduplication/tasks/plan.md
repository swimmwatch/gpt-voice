# Implementation Plan: Transcription Retry Deduplication

## Overview

Add a bounded, memory-only cache at the main transcription-service boundary so a completed successful transcription can satisfy a byte-identical retry without a second provider/API call. The implementation preserves the current IPC request/result shapes, clipboard behavior, notifications, retry state, and transcription history.

## Planning Defaults

These defaults carry forward from the specification and require approval before implementation:

- TTL: 5 minutes.
- Capacity: 10 successful results.
- Cache completed successful results only; do not coalesce in-flight requests.
- Preserve duplicate history insertion on a cache-hit retry.
- Allow a matching cache hit before provider readiness is required, while still requiring the same active provider and settings context.

## Architecture Decisions

- Place deduplication in `src/main/services/transcription.ts`, behind trusted IPC and before `provider.transcribe`.
- Hash exact audio bytes with Node SHA-256; combine the digest with MIME type, provider ID, and provider-supplied semantic settings context.
- Store only successful non-empty transcript text in a process-local bounded LRU/TTL cache. Never store audio, errors, raw responses, credentials, or cache identifiers in logs.
- Add a default `BaseVoiceProvider` cache-context contract and override it only for providers with mutable transcription settings. OpenAI includes model, language, prompt, and temperature; API keys remain excluded.
- Keep clipboard and history side effects in the transcription service for cache hits. Existing provider success behavior remains unchanged on misses.
- Dependency-inject cache, clock, provider access, clipboard, history, and hashing boundaries where needed so tests remain deterministic and credential-free.
- Cache/key failures fall back to a normal provider call. They must not block transcription or return an unverified cached value.

## Dependency Graph

```text
Approved cache policy
        │
        ▼
Task 1: binary-aware bounded cache
        │
        ▼
Task 2: provider semantic cache context
        │
        ▼
Task 3: transcription-service cache hit/miss flow
        │
        ├──────────────► Task 4: privacy/user documentation
        │
        ▼
Task 5: complete integration verification and handoff
```

## Task List

### Phase 1: Foundation

- [x] Task 1: Build the binary-aware successful-result cache.
- [ ] Task 2: Add provider-specific transcription cache context.

### Checkpoint: Foundation

- [ ] Key differentiation, TTL, capacity, and LRU tests pass.
- [ ] Provider cache contexts exclude credentials and distinguish result-affecting settings.
- [ ] Typecheck and lint remain clean.

### Phase 2: Core Feature

- [ ] Task 3: Integrate completed-result reuse into the transcription service.

### Checkpoint: Core Feature

- [ ] Two sequential identical requests produce one provider call.
- [ ] Failures and empty results remain uncached.
- [ ] Cache hits preserve clipboard and history behavior.
- [ ] Existing retry UI and IPC contracts remain unchanged.

### Phase 3: Documentation and Completion

- [ ] Task 4: Document memory-only retention and approved cache policy.
- [ ] Task 5: Run the complete Definition of Done and record the handoff.

### Checkpoint: Complete

- [ ] Every specification success criterion is covered by deterministic tests.
- [ ] Full tests, lint, formatting, type checks, audit, and production build pass.
- [ ] Manual retry smoke check confirms the second request avoids the provider endpoint.
- [ ] Human review completed before merge.

## Verification Strategy

Run focused checks after every task:

```bash
node --import tsx --test tests/main/transcriptionResultCache.test.ts
node --import tsx --test tests/main/providers/BaseVoiceProvider.test.ts tests/main/providers/OpenAIApiVoiceProvider.test.ts
node --import tsx --test tests/main/transcriptionResultCache.test.ts tests/main/transcription.test.ts
npm run typecheck
npm run lint
```

Run the project-wide gate after Task 5:

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

## Risks and Mitigations

| Risk                                                                  | Impact | Mitigation                                                                                                    |
| --------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| Incorrect key context returns stale text after a settings change      | High   | Provider-owned semantic context plus tests for every OpenAI result-affecting field                            |
| Cache hit omits clipboard or history side effects                     | High   | Keep hit handling in the transcription service and assert both effects in service tests                       |
| Sensitive audio/transcript material leaks through logs or persistence | High   | Store only text in memory, hash audio immediately, avoid key/digest logging, and add sanitized-log assertions |
| Hash/cache failure blocks transcription                               | Medium | Catch cache-boundary errors and continue through the existing provider path                                   |
| Cache retention grows or outlives its purpose                         | Medium | Enforce both fixed capacity and TTL with deterministic eviction tests and unref timers                        |
| Duplicate history rows surprise users                                 | Low    | Preserve current retry behavior by default and document the decision before implementation                    |
| Concurrent identical retries still produce multiple calls             | Medium | Keep explicitly out of version one; add a test documenting completed-result-only behavior                     |

## Parallelization Opportunities

- After Task 1 defines the cache API, provider-context tests and transcription-service test scaffolding can be prepared independently, but shared source edits remain sequential.
- Task 4 documentation can proceed in parallel with Task 3 only after the four policy decisions are approved.
- Final integration verification and handoff must remain sequential after all implementation tasks.

## Open Questions

1. Confirm TTL 5 minutes and capacity 10.
2. Confirm completed-result-only caching without in-flight coalescing.
3. Confirm cached retries add the same duplicate history entry as provider-backed retries.
4. Confirm a valid cache hit may succeed while the provider is temporarily not ready.

Implementation must not begin until these defaults and this plan are approved.
