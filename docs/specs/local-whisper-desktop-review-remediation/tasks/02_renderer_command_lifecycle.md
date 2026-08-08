# 02 Renderer Command Lifecycle

## Outcome

The Local Whisper settings hook uses one extracted state-owning lifecycle for command admission, snapshot publication, cancellation waiters, and disposal. Commands may settle after unmount, but no late continuation publishes React state or accepts a snapshot, while ref-owned cleanup completes exactly once and process-owned transfers continue under the existing main-process contract.

## Prerequisites

- Packet 1 is complete, reviewed, and recorded in [todo.md](todo.md) and [handoff.md](handoff.md).
- This packet has a fresh explicit `incremental-implementation` invocation; commit authorization, if any, applies only according to the repository packet boundary.
- Read the `Code And Logging`, `Electron And Providers`, `Dependency Injection And Runtime Ownership`, and `Tests And Documentation` sections of `docs/agent-guides/project-conventions.md`.
- Preserve the existing hook return type, visible strings, settings behavior, and unrelated renderer changes.

## Owned Requirements

- Requirements: OUT-001, SCP-001, SCP-002, CMP-002, CMP-003, ARC-001, REN-001, REN-002, CON-002, SEC-002, SEC-003, PRV-001, OPS-001, OPS-002, TST-001, TST-003.
- Acceptance: AC-AUT-006, AC-AUT-008, AC-AUT-009.
- Review selection: F3 post-unmount command and cancellation settlement. F2 callback-only performance work remains explicitly excluded.

## In Scope

- Extract command-pending, disposed, snapshot-publication, cancellation-waiter, and timeout ownership from `useLocalWhisperSettings` into a class used by the hook.
- Exercise that class directly under `node:test` with deferred promises and an injected deterministic scheduler; do not add a React test dependency.
- Apply the same post-disposal policy to ordinary commands and multi-operation artifact cancellation.
- Keep listener removal and renderer-service disposal unconditional.

## Out Of Scope

- Memoization, callback-only performance claims, prop/snapshot restructuring, a new hook result, visible notification, command result, dependency, or renderer route.
- Cancelling a process-owned artifact transfer because the window or subscription disappears.
- Public IPC, preload, DTO, settings, persistence, coordinator, artifact-service, provider, or main-process command contract changes.
- Electron capability and navigation changes, which belong to packet 3.

## Task Contract

1. Add `src/renderer/localWhisper/LocalWhisperSettingsLifecycle.ts` with a `LocalWhisperSettingsLifecycle` class. The class must own the mutable disposed flag, one-command-at-a-time admission, latest accepted snapshot, cancellation-operation waiters, timeout handles, and the guards around snapshot/state publication. Inject its service/callback/scheduler dependencies explicitly; do not create a module-level instance or a free pass-through wrapper.
2. Move the ordinary-command and artifact-cancellation settlement arbitration from hook refs into the class. Keep the existing command names, safe error strings, maximum of two close-cancellation operations, and 30,000 ms cancellation-settlement timeout.
3. Once `dispose()` begins, every asynchronous success, typed failure, thrown failure, timeout, and `finally` path must skip snapshot acceptance and React-state publication. Disposal is idempotent.
4. Suppressing publication must not suppress cleanup. Command-pending ownership releases in `finally`; all operation waiters resolve exactly once with the disposed/unsuccessful result; every waiter timeout clears; the subscription listener is removed; and `LocalWhisperRendererService.dispose()` is invoked unconditionally.
5. A command accepted by main before unmount remains process-owned and may finish. Renderer disposal must not send a new artifact-cancel command, abort main work, or retain a late result merely because the UI disappeared.
6. The hook constructs one lifecycle instance for its mounted service, routes subscription snapshots and all command paths through it, and disposes it from effect cleanup. Reopening the page still creates a fresh service/lifecycle and obtains the existing atomic authoritative subscription replay.
7. Keep draft rebasing semantics unchanged: progress snapshots do not erase a dirty draft, and successful save/reset may reset it. Keep cancellation filtering to active operations and the existing cancellable progress states.
8. Tests must directly observe publication callbacks, pending ownership, waiter/timer cleanup, command invocation count, and disposal count. Source-pattern assertions alone are not sufficient evidence for the lifecycle races.

## Contracts And Boundaries

- The renderer owns UI-local lifecycle only and invokes desktop behavior through the already typed `ElectronAPI` surface. It receives no new privilege or raw IPC access.
- Main continues to own artifact transfer lifetime. An unmounted renderer neither prolongs nor cancels a process-owned transfer.
- Renderer-visible failures remain the existing safe localized messages derived from renderer-safe failure DTOs. Thrown transport details are not surfaced or logged.
- No hook return field, command DTO, IPC channel, preload method, provider setting, or persisted value changes.
- The new class owns meaningful mutable state and invariants; React remains functional and uses hooks for composition and publication.

## Expected Files Or Components

- Add `src/renderer/localWhisper/LocalWhisperSettingsLifecycle.ts`.
- Modify `src/renderer/localWhisper/useLocalWhisperSettings.ts`.
- Add `tests/renderer/localWhisper/LocalWhisperSettingsLifecycle.test.ts`.
- Modify `tests/renderer/localWhisper/LocalWhisperUiContracts.test.ts` only to replace brittle source assertions with the extracted lifecycle contract or to retain existing integration assertions.
- Verify `src/renderer/localWhisper/LocalWhisperRendererService.ts` and `tests/renderer/localWhisper/LocalWhisperRendererService.test.ts`; change them only if unconditional idempotent service disposal needs a focused correction.

## Acceptance Criteria

- Deferred ordinary commands that settle successfully, with a typed failure, or by throwing after disposal return their existing boolean result but do not call snapshot acceptance or any state publisher.
- Deferred artifact-cancellation commands cover the same three settlement modes after disposal and publish no snapshot, error, or pending-state update.
- Disposal releases command-pending ownership, settles each retained waiter once, clears every deterministic timer, removes the subscription once, and disposes the renderer service once.
- A command accepted before unmount is invoked exactly once and is not cancelled merely by disposal; a fresh lifecycle can subscribe and accept the later authoritative process-owned snapshot.
- Simultaneous snapshot, timeout, command settlement, and disposal orderings remain deterministic and cause no uncaught rejection or double settlement.
- The public hook/controller shape, UI strings, draft semantics, settings contracts, dependencies, and persisted data remain unchanged.

## Verification

Run from the repository root:

```bash
node --import tsx --test tests/renderer/localWhisper/LocalWhisperSettingsLifecycle.test.ts tests/renderer/localWhisper/LocalWhisperRendererService.test.ts
npm run verify:local-whisper:ui
npm run test:local-whisper:ipc
npm run typecheck
npm run test:types
npx eslint src/renderer/localWhisper/useLocalWhisperSettings.ts src/renderer/localWhisper/LocalWhisperSettingsLifecycle.ts tests/renderer/localWhisper/LocalWhisperSettingsLifecycle.test.ts tests/renderer/localWhisper/LocalWhisperUiContracts.test.ts
npx prettier --check src/renderer/localWhisper/useLocalWhisperSettings.ts src/renderer/localWhisper/LocalWhisperSettingsLifecycle.ts tests/renderer/localWhisper/LocalWhisperSettingsLifecycle.test.ts tests/renderer/localWhisper/LocalWhisperUiContracts.test.ts
```

Use deferred promises and an injected manual scheduler. Do not use sleeps, wall-clock timing, private snapshots, credentials, audio, transcripts, or a new React mounting library.

## Failure And Rollback

- If the extracted class requires a public hook/IPC/DTO change or would cancel process-owned work on unmount, stop and return the conflict to specification.
- If cleanup throws, state suppression remains authoritative and other cleanup actions still run; do not expose the raw exception to the renderer.
- Roll back the class, hook integration, and lifecycle tests together. No user data, settings, journals, artifacts, or process-owned operations are deleted or migrated.

## Manual Gates

- None for packet-local completion. Close-during-command behavior on Linux and Windows is mandatory in packet 4.
- Do not commit, push, open a pull request, package, publish, or release without separate authorization.

## References

- Mandatory contract anchors: `spec.md` sections 4, 6, 9, 10, and AC-AUT-006, AC-AUT-008, AC-AUT-009.
- Mandatory implementation context: `useLocalWhisperSettings.ts`, `LocalWhisperRendererService.ts`, their focused tests, and the named project-conventions sections.
- Optional background: `docs/reviews/2026-08-08-local-whisper-desktop-app-comments-to-address.md` finding F3.

## Completion And Handoff

- Mark packet 2 complete in [todo.md](todo.md) only after all packet-local checks pass.
- Update [handoff.md](handoff.md) with changed files, concise check results, any deferred platform-only evidence, and packet 3 as the exact next packet.
- Present packet 2 for review and stop. Do not commit it or begin packet 3 in the same invocation.
