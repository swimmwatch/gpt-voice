# 02 Platform Policy And Registration Service

## Outcome

Create one platform-neutral main-process owner that truthfully maps configured
shortcuts to adapter bindings, replaces/removes them transactionally, publishes
deterministic authority-aware snapshots, verifies cleanup through adapter
queries, compensates toward one authoritative configured/bound pair, suppresses
irreconcilable callbacks, and runs bounded physical tests. Define the
platform-policy factory seam while leaving Windows, Linux X11, and Linux
Wayland branches to their host packets.

## Prerequisites

- Packet 01 is complete and approved for continuation.
- Read `AGENTS.md`, `tasks/todo.md`, `tasks/handoff.md`, this packet, and the
  **Code And Logging**, **Electron And Providers**, and **Dependency Injection
  And Runtime Ownership** convention sections.
- Inspect the new Packet 01 contracts, `src/main/shortcuts.ts`, its focused
  tests, and one stateful service with injected timers/persistence as precedent.

## Owned Requirements

- OUT-001, OUT-002
- SCOPE-005, SCOPE-006
- DATA-006..DATA-008
- ARCH-001..ARCH-003, ARCH-005
- FLOW-001..FLOW-006, FLOW-008..FLOW-010
- FAIL-001..FAIL-004
- SEC-002, SEC-004
- QUAL-003, QUAL-006 / AC-AUTO-003, AC-AUTO-006

## In Scope

- Abstract global-shortcut adapter and Electron implementation.
- Abstract platform policy, fail-closed unsupported policy,
  paused-macOS-compatible policy, and a factory seam selected from enum inputs.
- `HotkeyRegistrationService` state, startup, set, clear, snapshots,
  callback generations, subscription, suppression, test sessions, verified
  cleanup, compensation, and reconciliation failure.
- Pure platform/session detection at the composition boundary.
- Deterministic unit tests using fakes, injected clock/timers, and injected
  atomic persistence.

## Out Of Scope

- Windows/Linux policy implementations and supported-host qualification.
- Wiring real action callbacks into `ShortcutController` or the production
  composition root; trusted IPC/preload; renderer changes; portal feature
  switches; package metadata; docs; real OS/manual tests.
- Shelling out, direct Win32/X11/D-Bus APIs, automatic fallback, or identifying
  an external shortcut owner.

## Task Contract

1. Add `abstract class GlobalShortcutAdapter` with `register(accelerator,
callback): boolean`, bounded `unregister(accelerator): boolean`,
   `isRegistered(accelerator): boolean`, and `unregisterAll(): void`.
   `ElectronGlobalShortcutAdapter` is the only production implementation and
   maps a completed void Electron unregister call to `true`, maps an exception
   to `false`, and never exposes a native payload. The registration query, not
   the unregister return alone, is authoritative proof of cleanup.
2. Add `abstract class HotkeyPlatformPolicy` that validates a normalized
   accelerator and returns either acceptance or one bounded failure code. Add
   fail-closed unsupported and paused-macOS-compatible policies.
   `HotkeyPlatformPolicyFactory` receives `DesktopPlatform` and
   `LinuxSessionType` plus explicit constructor-injected supported-host policy
   creators. Missing Windows/X11/Wayland creators return unsupported; the
   factory contains no Electron global state or hidden defaults.
3. Keep supported-host policy modules absent from this packet. Unit tests prove
   the factory selects only an explicitly supplied creator and otherwise fails
   closed. Packets 07–09 add and qualify the X11, Wayland, and Windows creators
   in that order.
4. Add concrete `HotkeyRegistrationService` with complete constructor-injected
   adapter, policy, atomic settings reader/writer, target callbacks, logger,
   clock, timer scheduler/canceller, and fixed `5_000` ms test timeout. It is
   the sole owner of registrations, callback generations, statuses,
   reconciliation/compensation, test session, subscriber publication, and
   final `unregisterAll`.
5. `start()` attempts each non-null target independently in canonical order.
   Invalid, internally conflicting, reserved, unsupported, or rejected targets
   become `failed` with their bounded code; successful siblings remain
   registered. Configuration is never cleared by startup failure.
6. Snapshot entries always appear in canonical order and distinguish the
   configured preference from nullable effective accelerator and binding
   authority. Successful Windows/X11 policies expose the normalized effective
   accelerator with `application` authority. Successful Wayland policy exposes
   null effective accelerator with `desktop-environment` authority. Unassigned
   state uses null/null/`none`; failed state has null effective accelerator,
   `none` authority, and one bounded failure. All entries carry `enabled` or
   `suppressed` independently.
7. Every registered callback closes over a service-owned generation token.
   Invalidate a generation before attempting to remove its binding. A callback
   whose generation is not current can never dispatch a product action or
   settle a later test, even if native cleanup fails.
8. Replacement is serialized and candidate-first:
   - validate input type/non-empty syntax, conflicts, and policy;
   - a semantic no-op returns current authoritative success without duplicate
     registration;
   - register candidate beside old binding and require both `register === true`
     and `isRegistered === true`;
   - atomically persist the configured candidate;
   - invalidate the old generation, issue bounded unregister, and require the
     old registration query to report absent before publishing success.
     On candidate registration failure, invalidate/remove/query any partial
     candidate and retain old config/binding. On persistence failure,
     invalidate/remove/query the candidate and retain the old authoritative
     pair with `persistence-failed`. Any unverified candidate cleanup enters
     the reconciliation flow in Task Contract 10.
9. Clear is persistence-first: atomically persist null, invalidate the old
   callback, issue bounded unregister, and require the query to report absent
   before publishing unassigned. Persistence failure leaves the old pair
   untouched. Verified removal failure restores the prior persisted value and
   callback generation only after querying or re-registering the old binding.
   Clearing an already unassigned target is idempotent.
10. Reconciliation is query-driven and never interprets exception text. If
    old-binding removal fails after candidate persistence, invalidate and
    remove/query the candidate, restore the prior persisted value, then
    reactivate or re-register a previous generation only after its query proves
    the binding. If candidate cleanup or prior-state restoration cannot prove
    exactly one configured/bound pair, invalidate all generations for that
    target, keep it dispatch-suppressed, and publish only
    `failed`/`reconciliation-failed` with null effective accelerator and `none`
    authority. Restart or a later explicit set/clear may attempt repair.
11. Internal conflicts are checked against configured non-null targets after
    platform normalization. One failed target never unregisters another target.
    No operation silently chooses a fallback accelerator.
12. Suppression toggles dispatch state and publishes it without releasing OS
    bindings. While suppressed, ordinary callbacks do nothing. Registered Retry
    remains bound even when its runtime action is unavailable; action callbacks
    decide eligibility later.
13. One test session may exist at a time for one registered target. While
    suppression is active, its next matching OS callback resolves `detected`
    without product dispatch. Fixed timeout resolves `timed-out`; unassigned or
    failed targets resolve `unavailable`. Duplicate starts, dispose, and owner
    cancellation settle exactly once, clear timers, never persist, and never
    extend the deadline.
14. `dispose()` is idempotent: invalidate all generations, cancel test/timers,
    prevent later mutations and
    callbacks, call adapter `unregisterAll()` once, clear subscribers/state,
    and publish no stale success.
15. Logs contain only target, normalized accelerator, binding authority, enum
    status/failure, and bounded platform/session. Do not log native error
    payloads, environment, paths, external-process identity, selected text,
    audio, transcripts, credentials, sessions, or clipboard data.

## Contracts And Boundaries

- Main is the future owner, but unit tests instantiate the service without
  importing Electron. No module-level constructed instance or mutable global.
- The service consumes Packet 01's direct config-store capability through a
  narrow constructor interface; do not add a pass-through repository.
- Platform policy is validation, not registration. The adapter never owns
  persistence or product availability.
- Subscriber delivery and mutation settlement must be contained: one throwing
  subscriber/logger cannot corrupt registration ownership.
- No controller, IPC handler, or composition helper may become a second
  cleanup/compensation authority. They call the service and consume its bounded
  result only.

## Expected Files Or Components

- New focused modules under `src/main/hotkeys/` (or an equally cohesive main
  directory) for adapter, policies/factory, and service.
- `src/shared/hotkeys.ts` only for validators/types genuinely missing from
  Packet 01.
- New focused tests under `tests/main/hotkeys/` or existing main hotkey suites.
- Do not change `src/main/ipc.ts`, preload, renderer, `package.json`, or runtime
  composition in this packet.

## Acceptance Criteria

- Unit tests prove unsupported/paused policy results and that the factory never
  invents a supported host creator.
- Independent startup, candidate success/rejection, partial registration,
  persistence rollback, verified candidate cleanup, verified old-binding
  cleanup, clear compensation, irreconcilable cleanup, generation invalidation,
  duplicates, conflicts, publication, suppression, permanent Retry binding,
  test outcomes, cancellation, and dispose all preserve exact ownership.
- All snapshots use exact enum values, authority/effective-trigger invariants,
  and canonical target order with no raw native error data.
- No test or product callback fires during suppression except test detection.

## Verification

- Focused new platform-policy/registration-service tests plus
  `tests/main/hotkeys.test.ts`.
- `npm run typecheck`
- `npm run test:types`
- Scoped ESLint and Prettier over changed source/tests.
- `git diff --check`

## Failure And Rollback

- If Electron cannot support candidate-first registration for two distinct
  accelerators, stop with a focused adapter regression and exact evidence; do
  not unregister the working shortcut first.
- Any uncertain candidate cleanup, executable stale generation, false effective
  trigger, duplicate callback, timer leak, or unbounded ownership state blocks
  completion.
- Rollback removes the unused service modules without touching persisted data;
  Packet 01 null compatibility remains.

## Manual Gates

- None. Real Windows/X11/Wayland behavior belongs to Packets 07–09.

## References

- Specification anchors: **Architecture And Ownership**, **Registration And
  Mutation Flows**, **Platform Contracts**, **Failure, Security, And Privacy**.
- Required conventions: **Code And Logging**, **Electron And Providers**,
  **Dependency Injection And Runtime Ownership**.

## Completion And Handoff

After checks pass, mark only Packet 02 complete, update `handoff.md` with exact
files/checks and `Exact next packet: 03`, present the increment, and stop. Do
not wire production composition, commit, push, or start Packet 03.
