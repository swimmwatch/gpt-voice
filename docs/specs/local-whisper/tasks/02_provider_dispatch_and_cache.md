# 02 Provider Dispatch And Cache Seam

## Outcome

`Local Whisper` is registered as a real local-runtime batch Voice provider.
Provider selection and transcription route it around browser/API authentication,
apply the required eligibility gate before cache lookup, and delegate all
stateful work to a composition-root-owned coordinator port without changing
remote-provider behavior.

## Prerequisites

- The Local Whisper plan is approved.
- Task 01 is complete, reviewed, and committed through the normal packet
  boundary.
- Task 02 has separate execution authorization.
- A fake/in-memory `LocalWhisperCoordinatorPort` can be used until Task 10
  supplies the process-owned implementation.

## Owned Requirements

- `SCOPE-002`, `ARCH-001`, `ARCH-002`, `ARCH-008`, `SEC-006`
- Provider-integration portions of `ARCH-003`, `ARCH-006`, `LIFE-001`
- `COMP-001`, `COMP-002`, `COMP-003`
- `ARCH-009`, `CACHE-001`, `CACHE-002`
- `CAP-011`, `LIFE-005`, `UI-006`
- Dispatch portions of `CAP-008`, `SEC-002`, `DIAG-001`
- `AC-AUTO-016`, `AC-AUTO-027`, `AC-AUTO-035`, `AC-AUTO-039`
- Main-input validation ownership for `AC-AUTO-033`; Tasks 07 and 08 retain
  worker-side defense-in-depth validation

## In Scope

- Exhaustive provider ID/audit metadata/factory/registry registration.
- A genuine `localRuntime` readiness discriminator with `canAttempt`, status,
  and safe reason; no fake auth/session state.
- Fresh provider instances delegating to one injected coordinator port.
- Shared transcription orchestration dispatch by readiness kind.
- Local eligibility-before-cache ordering, complete private cache context,
  eligible unloaded cache hits, and lazy load only on eligible misses.
- Remote provider, provider-switch, completion, and cache regression tests.

## Out Of Scope

- Real storage, downloads, workers, probes, coordinator state machine, IPC, UI,
  packaging, or hardware checks.
- Changing the existing recording/audio path, streaming transcription, cache
  retention policy, clipboard/history policy, or remote error behavior.
- Treating local setup failure as authentication or showing raw native errors.

## Task Contract

1. Add provider ID `local-whisper`, name `Local Whisper`, category `local`,
   transcription mode `batch`, settings enabled, and auth/readiness kind
   `localRuntime`. Extend exhaustive audit provider mappings before factory and
   registry switches so unknown providers continue failing closed.
2. Refactor the base/provider runtime contract so `localRuntime` never invokes
   `hasSession`, `loadSession`, `saveSession`, `clearSession`, login navigation,
   API-key checks, or `isReady` as an authentication gate. Do not satisfy an
   old abstract method with a dummy cookie, key, token, or boolean session.
3. Add a side-effect-free `LocalWhisperVoiceProvider` derived from the buffered
   batch provider. Its constructor receives a coordinator interface; metadata
   and settings snapshot reads do not probe, download, spawn, or allocate.
   `transcribe`, cache-context capture, readiness snapshot, cancellation, and
   shutdown delegate directly to that interface.
4. Keep the mutable coordinator out of module scope and provider instances.
   `VoiceProviderFactory` may create fresh Local Whisper providers, but all of
   them receive the same process-owned port from
   `mainProcessCompositionRoot.ts`.
5. Introduce or refactor one main-owned Voice dispatch router so browser/API
   providers retain their current `BackgroundBrowserService` initialization
   and Local Whisper becomes active without a browser context. Its local
   snapshot exposes:
   - structural validity/conflict-derived `canAttempt`;
   - operational `Ready | Busy | ValidatedUnloaded | NotReady | Planned | Unsupported`;
   - a stable safe failure/recovery tuple when not operational.
6. Implement this exact Local Whisper transcription order:
   - capture provider/configuration/inventory epochs and validate canonical
     audio plus structural settings;
   - call the coordinator's non-mutating local eligibility gate for support,
     exact device/prerequisites/resources, setup, compatibility, integrity,
     and denylist state;
   - return its exact typed failure before cache lookup when ineligible;
   - build the full private cache context from the same epochs;
   - on an eligible hit, complete through the existing success flow exactly
     once without worker load and without changing residency;
   - on a miss, delegate one request to the coordinator, which Task 10 will
     recheck under its lifecycle lock and lazy-load if needed.
7. Validate Local Whisper audio before its eligibility gate and before any
   cache lookup. Accept only a structurally complete mono PCM16, 16 kHz WAV
   with bounded RIFF chunks and lengths. Malformed, truncated, compressed,
   wrong-rate, wrong-channel, wrong-sample-format, trailing-overflow, and
   inconsistent-length inputs return `AUDIO_FORMAT_UNSUPPORTED`; they create
   no temporary file and invoke no cache-success, browser, coordinator,
   worker, history, clipboard, or notification effect. This main validator is
   Local Whisper-specific and does not change remote-provider input behavior.
8. Do not let `canAttempt` claim readiness. `Validated · Unloaded` is eligible
   and may serve a cache hit or lazy-load on a miss. Structurally invalid or
   conflicting state blocks dispatch; missing, unsupported, corrupt, blocked,
   incompatible, absent-device, and known-insufficient states return their
   exact local code, never `notLoggedIn`.
9. A successful noncached result enters `completeBatchTranscription` once with
   the captured snapshot. A successful cache hit uses
   `completeCachedTranscription` once. Empty, partial, cancelled, failed,
   conflict, or stale outcomes perform no successful cache, clipboard,
   history, notification, or completion mutation.
10. Preserve the current remote-provider cache-before-reinitialization behavior
    unless a focused regression proves an existing bug. The local branch alone
    owns its stricter eligibility-before-cache rule.
11. Provider switching uses a coordinator hook. Until Task 10 implements the
    lifecycle, tests use a fake that can accept an idle switch or return
    `OPERATION_CONFLICT`; no test or temporary adapter silently cancels active
    work or selects a fallback provider.
12. Keep audit and routine logs metadata-only. Local typed failures may include
    stable engine/backend/model IDs and durations, but never prompt/audio/text,
    raw errors, full paths, URLs, argv, environment, or worker output.

## Contracts And Boundaries

- Main owns the provider, router, coordinator port, and all completion effects.
  Renderer code is untouched in this packet.
- The Local Whisper coordinator interface is a dependency-injected domain
  port, not a pass-through free function or constructed module singleton.
- Cache context must be captured from the same immutable epochs used for the
  eligibility result. An epoch change makes the operation stale rather than
  reading a cache under mixed state.
- Provider metadata/snapshot calls remain side-effect free.
- Existing browser and OpenAI API contracts retain their current semantics and
  test coverage.

## Expected Files Or Components

- Add `src/main/providers/LocalWhisperVoiceProvider.ts`.
- Add a focused router/dispatch service under `src/main/services/`, expected as
  `localWhisperTranscriptionDispatch.ts` or a cohesive extension of
  `TranscriptionService`.
- Add a pure main-owned Local Whisper canonical WAV validator under the same
  service boundary; it must not write files or invoke native code.
- Modify as required:
  - `src/shared/voiceProvider.ts`;
  - `src/main/providerAudit/mappings.ts` and related contracts;
  - `src/main/providers/BaseVoiceProvider.ts`;
  - `src/main/providers/voiceProviderFactory.ts`;
  - `src/main/providers/voiceProviderRegistry.ts`;
  - `src/main/providers/voiceProviderGuards.ts`;
  - `src/main/browser.ts` or its replacement dispatch boundary;
  - `src/main/services/transcription.ts`;
  - `src/main/di/mainProcessCompositionRoot.ts` and runtime factory wiring.
- Add/extend focused tests in:
  - `tests/main/providers/`;
  - `tests/main/transcription.test.ts`;
  - `tests/main/backgroundBrowserLifecycle.test.ts`;
  - provider audit/cache/completion suites.

## Acceptance Criteria

- Registry/factory/provider audits are exhaustive and expose one renderer-safe
  local provider with no secret/auth fields.
- Selecting Local Whisper never creates a browser context or asks for login/API
  configuration.
- Missing, corrupt, blocked, incompatible, unsupported, absent-device, and
  known-insufficient fakes fail before a seeded cache can be read.
- Valid canonical mono PCM16/16 kHz WAV reaches the eligibility/cache path;
  every malformed/truncated/compressed/wrong-format fixture fails
  `AUDIO_FORMAT_UNSUPPORTED` before cache lookup with no temporary file or
  success-side effect.
- Eligible Loaded and `Validated · Unloaded` cache hits complete without a
  worker call; an eligible unloaded miss reaches the lazy-load coordinator
  port.
- Structural invalidity and active conflicts make `canAttempt=false` while
  setup/capability failures retain their exact typed local reason.
- Local success completes exactly once; all non-success fixtures leave success
  side effects unchanged.
- Existing ChatGPT, Claude, and OpenAI API provider tests remain unchanged in
  observed behavior.

## Verification

Run:

```text
rtk node --import tsx --test tests/main/transcription.test.ts tests/main/providers/*.test.ts tests/main/backgroundBrowserLifecycle.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run test:unit
rtk lint
rtk prettier --check
```

Use the focused fixtures to assert whether the cache reader, browser creation,
coordinator port, and completion effects were called and in what order.

## Failure And Rollback

- If the local path cannot bypass authentication without changing a public
  behavior outside the approved contract, stop and repair this packet through
  planning; do not add a dummy auth implementation.
- Rollback removes Local Whisper registration and router code and restores the
  old remote-only dispatch. Task 01 shared types may remain because they have
  no activation side effect.
- A discovered cache-policy change for remote providers requires a separate
  specification decision.

## Manual Gates

- None. All behavior in this packet uses injected coordinator/cache/completion
  fakes.
- No native runtime, download, process, dependency, commit, push, or next task
  is authorized.

## References

- Mandatory task-local sections:
  - `../spec.md` Sections 4, 7.1, 9.5, 10.5, 13.4, 15, and 19.1
    (`AC-AUTO-033`);
  - decision `architecture.local-dispatch-cache-order`.
- Local precedents:
  - `src/main/services/transcription.ts` for current cache/completion ordering;
  - `src/main/browser.ts` for browser/API initialization that local dispatch
    must bypass;
  - `src/main/di/mainProcessCompositionRoot.ts` for process ownership;
  - `src/main/providers/voiceProviderFactory.ts` and
    `voiceProviderRegistry.ts` for exhaustive fresh instances.

## Completion And Handoff

- Mark Task 02 complete in `todo.md` and record changed files/checks in
  `handoff.md`.
- Name Task 03 as the exact next packet.
- Present local/remote dispatch and cache-order evidence, then stop without
  committing or starting Task 03.
