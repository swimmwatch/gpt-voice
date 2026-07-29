# 10 Migrate Voice And Browser DI

## Outcome

Move Voice provider, background-browser, session, cache, audit, and streaming
ownership into the main composition graph.

## Prerequisites

- Tasks 08–09 are complete.

## Owned Requirements

- Existing Voice/audit requirements and project-wide DI decisions.

## In Scope

- Background browser service and operation queue/hooks.
- Voice audit, factory/registry, providers, batch/streaming services, caches,
  and session/credential adapters.

## Out Of Scope

- Translation, Prettify, preload, renderer, or public contract changes.

## Task Contract

1. Add class-owned `BackgroundBrowserService`, `VoiceProviderFactory`, and
   `VoiceProviderRegistry`.
2. Construct one `VoiceProviderAudit` and inject it into every Voice owner.
3. Inject filesystem, browser launcher, fetch, settings, time, UUID, logger,
   cache, and session adapters.
4. Remove global provider registry objects, browser state, queues, hooks, audit
   instances, transcription caches, and service instances.
5. Preserve provider enumeration, lazy instantiation, switching, retries,
   ownership tokens, audit operation IDs, cache behavior, and shutdown order.
6. Keep provider factories as explicit creation boundaries; no global defaults
   or service locator.

## Contracts And Boundaries

- Audio, transcripts, sessions, credentials, and browser objects remain main
  only.
- Audit schema and renderer-facing results remain unchanged.

## Expected Files Or Components

- Browser lifecycle, Voice providers/registry/audit, transcription services,
  composition root, and Voice tests.

## Acceptance Criteria

- Two Voice graphs share no provider, browser, cache, audit, or streaming state.
- All existing Voice/browser/audit tests pass with injected instances.
- No migrated singleton export or mutable module state remains.

## Verification

- Run all Voice/provider/browser/transcription/streaming/audit tests plus the
  full quality set and unit suite.

## Failure And Rollback

- Do not change selectors, navigation, retries, timeouts, session formats,
  provider results, or privacy behavior.

## Manual Gates

- Live browsers/providers and credentials remain prohibited.

## References

- Tasks 03–04 contracts and Task 09 handoff.

## Completion And Handoff

- Mark only Task 10 complete and hand off to Task 11.
