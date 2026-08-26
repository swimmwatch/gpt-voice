# 03 Exact-URL Capability Lifecycle

## Outcome

Main-window and Local Whisper settings capabilities remain bound to one exact canonical top-level document. Every same-document, cross-document, or nested-frame navigation attempt revokes the old capability and subscriber exactly once, all Electron listeners are removed under races, stale sends and commands fail closed, and recovery requires a fresh canonical document subscription.

## Prerequisites

- Packets 1 and 2 are complete, reviewed, and recorded in [todo.md](todo.md) and [handoff.md](handoff.md).
- This packet has a fresh explicit `incremental-implementation` invocation.
- Read the `Code And Logging`, `Electron And Providers`, `Dependency Injection And Runtime Ownership`, and `Tests And Documentation` sections of `docs/agent-guides/project-conventions.md`.
- Preserve unrelated main-window, settings-window, and Local Whisper IPC worktree changes.

## Owned Requirements

- Requirements: OUT-001, SCP-002, CMP-002, CMP-003, ARC-001, NAV-001, NAV-002, NAV-003, SEC-002, SEC-003, PRV-001, OPS-001, OPS-002, TST-001, TST-004.
- Acceptance: AC-AUT-007, AC-AUT-008, AC-AUT-009.
- Review selection: F4 listener/subscriber lifetime and F6 explicit exact-URL/no-client-routing behavior.

## In Scope

- Make capability invalidation stateful, idempotent, and observable through `isCurrent()`.
- Remove all `did-start-navigation`, `destroyed`, and `render-process-gone` listeners before notifying invalidation observers.
- Close the synchronous invalidation-during-subscription registration race in `LocalWhisperIpcController`.
- Add deterministic authority, controller, and window trust tests for navigation and lifecycle races.
- Preserve exact canonical URLs for the main and Local Whisper provider-settings surfaces with no client-side routing.

## Out Of Scope

- An approved route set, hash routing, History API routing, same-origin routing, renderer automatic resubscription, or silent reauthorization.
- New IPC channels, preload methods, renderer DTOs, settings, provider behavior, persistence, dependencies, navigation origins, or window types.
- Changes to ordinary non-Local-Whisper provider settings authority beyond shared window-manager test fixtures needed for exact canonical assertions.

## Task Contract

1. In `ElectronLocalWhisperSenderAuthority`, give each returned capability a private terminal invalidated state. `isCurrent()` requires both that state to be live and the existing exact `WebContents`, main-frame identity, window ownership, canonical frame URL, and `webContents.getURL()` checks.
2. Replace independent one-shot listeners with one state-owning invalidation registration that listens to `did-start-navigation`, `destroyed`, and `render-process-gone`. The first event marks the capability stale, removes all three listeners, and notifies each registered observer once. Later events, explicit listener removal, or repeated cleanup are no-ops.
3. Treat every `did-start-navigation` as invalidating for these privileged surfaces, including hash changes, `history.pushState`, `history.replaceState`, same-document history navigation, cross-document navigation, and nested-frame navigation. Do not infer safety from same origin, `isInPlace`, or `isMainFrame` event flags.
4. Ensure `send()` rechecks the terminal and exact trust state immediately before delivery. A stale capability sends nothing and authorizes no subsequent operation even while its old `WebContents.id` remains allocated.
5. In `LocalWhisperIpcController.addSubscriber`, handle invalidation that fires synchronously while `onInvalidated` is registering. Never insert or retain a subscriber after that invalidation. Replacement subscriptions, explicit unsubscribe, publication failure, controller disposal, and invalidation must all converge through `removeSubscriber` without double cleanup.
6. Keep accepted main-process commands under their existing lifetime contract. Revocation blocks stale future authorization/sends; it does not retroactively cancel a command already accepted before navigation.
7. Retain `WindowManager.isTrustedMainFrame` and `isTrustedLocalWhisperSettingsFrame` as exact canonical checks. Add explicit tests rejecting fragments, query/path changes outside the exact expected settings URL, replacement frames, nested frames, stale `getURL()` values, and destroyed windows/web contents. Change runtime code only if those tests reveal a contract gap.
8. Prove that returning to the canonical URL in the old document does not reanimate its capability. Only a fresh top-level frame identity and a new atomic subscribe call may receive snapshots.

## Contracts And Boundaries

- Renderer and navigation input remains untrusted. Authorization requires exact live `WebContents`, top-level frame identity, owned window, canonical URL, and a current non-revoked capability.
- Same-origin-only, process-ID-only, `WebContents.id`-only, or once-trusted checks are forbidden.
- The main process remains the sole owner of privileged window identity and Local Whisper subscription authority.
- Invalidation produces no renderer payload or new log detail. Never log renderer-provided objects, URLs, paths, command data, audio, transcripts, prompts, credentials, or device identifiers.
- Public IPC, preload, DTO, provider, settings, persistence, and migration contracts remain byte-for-byte compatible.

## Expected Files Or Components

- Modify `src/main/localWhisper/ipc/ElectronLocalWhisperSenderAuthority.ts`.
- Modify `src/main/localWhisper/ipc/LocalWhisperIpcController.ts`.
- Modify `tests/main/localWhisper/ipc/ElectronLocalWhisperSenderAuthority.test.ts`.
- Modify `tests/main/localWhisper/ipc/LocalWhisperIpcController.test.ts`.
- Modify `tests/main/localWhisper/ipc/localWhisperIpcTestUtils.ts`.
- Modify `tests/main/windowManager.test.ts` for explicit canonical-URL/no-routing assertions and any required event-capable fake behavior.
- Verify `src/main/window.ts`; change it only if a failing exact-URL assertion exposes a real gap.

## Acceptance Criteria

- A table covers same-document hash/history navigation, cross-document navigation, nested-frame navigation, destruction, renderer-process failure, explicit unsubscribe, send failure, and controller disposal in relevant orderings.
- The first invalidating event permanently makes the capability's `isCurrent()` false, removes all lifecycle listeners, notifies once, and prevents all later sends.
- Synchronous invalidation inside `onInvalidated` registration leaves no subscriber in the controller; later publications make zero send attempts.
- Explicit unsubscribe, invalidation, send failure, and disposal each remove the subscriber and listener cleanup exactly once even when raced or repeated.
- A fresh canonical top-level frame receives a distinct capability and may subscribe; the old capability remains stale even if its URL text becomes canonical again.
- Exact main and Local Whisper settings URL checks reject hash, History API state, path/query drift, nested/replacement frames, stale `getURL()`, and destroyed owners.
- No public/persisted contract, dependency, setting, migration, diagnostic payload, or client-side route is added.

## Verification

Run from the repository root:

```bash
node --import tsx --test tests/main/localWhisper/ipc/ElectronLocalWhisperSenderAuthority.test.ts tests/main/localWhisper/ipc/LocalWhisperIpcController.test.ts tests/main/windowManager.test.ts
npm run test:local-whisper:ipc
npm run test:local-whisper:composition
npm run typecheck
npm run test:types
npx eslint src/main/localWhisper/ipc/ElectronLocalWhisperSenderAuthority.ts src/main/localWhisper/ipc/LocalWhisperIpcController.ts tests/main/localWhisper/ipc/ElectronLocalWhisperSenderAuthority.test.ts tests/main/localWhisper/ipc/LocalWhisperIpcController.test.ts tests/main/localWhisper/ipc/localWhisperIpcTestUtils.ts tests/main/windowManager.test.ts
npx prettier --check src/main/localWhisper/ipc/ElectronLocalWhisperSenderAuthority.ts src/main/localWhisper/ipc/LocalWhisperIpcController.ts tests/main/localWhisper/ipc/ElectronLocalWhisperSenderAuthority.test.ts tests/main/localWhisper/ipc/LocalWhisperIpcController.test.ts tests/main/localWhisper/ipc/localWhisperIpcTestUtils.ts tests/main/windowManager.test.ts
```

Use synchronous event fakes and explicit listener counters. Do not use Electron wall-clock sleeps, real user sessions, credentials, private renderer data, or source-pattern assertions as the only security evidence.

## Failure And Rollback

- If exact capability invalidation cannot coexist with current IPC behavior without adding routing or a public contract change, stop and return the conflict to specification.
- Treat any uncertain or partially invalidated capability as stale. Do not keep a subscriber to preserve availability.
- Cleanup exceptions must not restore a subscriber or capability. Subscriber deletion remains authoritative and safe failure remains silent to the renderer.
- Roll back authority, controller, window trust tests, and fakes coherently. No user data, settings, journals, artifacts, or browser/session data is deleted or migrated.

## Manual Gates

- None for packet-local completion. Linux and Windows navigation-invalidation smoke is mandatory in packet 4.
- Do not commit, push, open a pull request, package, publish, or release without separate authorization.

## References

- Mandatory contract anchors: `spec.md` sections 4, 8, 9, 10, and AC-AUT-007 through AC-AUT-009.
- Mandatory implementation context: the listed authority/controller/window files and the named project-conventions sections.
- Optional background: `docs/reviews/2026-08-08-local-whisper-desktop-app-comments-to-address.md` findings F4 and F6.

## Completion And Handoff

- Mark packet 3 complete in [todo.md](todo.md) only after all packet-local checks pass.
- Update [handoff.md](handoff.md) with changed files, concise check results, residual platform-only evidence, and packet 4 as the exact next packet.
- Present packet 3 for review and stop. Do not commit it or begin packet 4 in the same invocation.
