# 02 Platform Policy And Registration Service

## Outcome

Create one platform-neutral main-process owner that truthfully maps configured
shortcuts to adapter bindings, replaces/removes them transactionally, publishes
deterministic snapshots, suppresses product dispatch without unregistering, and
runs bounded physical tests. Define the platform-policy factory seam while
leaving Windows, Linux X11, and Linux Wayland branches to their host packets.

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
- FLOW-001..FLOW-006, FLOW-008, FLOW-009
- FAIL-001..FAIL-004
- SEC-002, SEC-004
- QUAL-003, QUAL-006 / AC-AUTO-003, AC-AUTO-006

## In Scope

- Abstract global-shortcut adapter and Electron implementation.
- Abstract platform policy, fail-closed unsupported policy,
  paused-macOS-compatible policy, and a factory seam selected from enum inputs.
- `HotkeyRegistrationService` state, startup, set, clear, snapshots,
  subscription, suppression, test sessions, and cleanup.
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
callback): boolean`, `unregister(accelerator): void`,
   `isRegistered(accelerator): boolean`, and `unregisterAll(): void`.
   `ElectronGlobalShortcutAdapter` is the only production implementation and
   catches Electron exceptions into the service's bounded failure path.
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
   the sole owner of registrations, registered callbacks, statuses, test
   session, subscriber publication, and final `unregisterAll`.
5. `start()` attempts each non-null target independently in canonical order.
   Invalid, internally conflicting, reserved, unsupported, or rejected targets
   become `failed` with their bounded code; successful siblings remain
   registered. Configuration is never cleared by startup failure.
6. Snapshot entries always appear in canonical order and distinguish the
   configured string from the platform-normalized registered accelerator.
   `unassigned` has both registered accelerator and failure null. All entries
   carry `enabled` or `suppressed` independently.
7. Replacement is serialized and candidate-first:
   - validate input type/non-empty syntax, conflicts, and policy;
   - a semantic no-op returns current authoritative success without duplicate
     registration;
   - register candidate beside old binding and require both `register === true`
     and `isRegistered === true`;
   - atomically persist the configured candidate;
   - only after persistence succeeds, unregister the previous accelerator and
     publish one authoritative snapshot.
     On registration failure remove any partial candidate and retain old config/
     binding. On persistence failure remove candidate and retain old config/
     binding with `persistence-failed` in the mutation result.
8. Clear is persistence-first: atomically persist null, then unregister the old
   binding and publish unassigned. If persistence fails, leave old config and
   binding untouched. Clearing an already unassigned target is idempotent.
9. Internal conflicts are checked against configured non-null targets after
   platform normalization. One failed target never unregisters another target.
   No operation silently chooses a fallback accelerator.
10. Suppression toggles dispatch state and publishes it without releasing OS
    bindings. While suppressed, ordinary callbacks do nothing. Registered Retry
    remains bound even when its runtime action is unavailable; action callbacks
    decide eligibility later.
11. One test session may exist at a time for one registered target. While
    suppression is active, its next matching OS callback resolves `detected`
    without product dispatch. Fixed timeout resolves `timed-out`; unassigned or
    failed targets resolve `unavailable`. Duplicate starts, dispose, and owner
    cancellation settle exactly once, clear timers, never persist, and never
    extend the deadline.
12. `dispose()` is idempotent: cancel test/timers, prevent later mutations and
    callbacks, call adapter `unregisterAll()` once, clear subscribers/state,
    and publish no stale success.
13. Logs contain only target, normalized accelerator, enum status/failure, and
    bounded platform/session. Do not log native error payloads, environment,
    paths, external-process identity, selected text, audio, transcripts,
    credentials, sessions, or clipboard data.

## Contracts And Boundaries

- Main is the future owner, but unit tests instantiate the service without
  importing Electron. No module-level constructed instance or mutable global.
- The service consumes Packet 01's direct config-store capability through a
  narrow constructor interface; do not add a pass-through repository.
- Platform policy is validation, not registration. The adapter never owns
  persistence or product availability.
- Subscriber delivery and mutation settlement must be contained: one throwing
  subscriber/logger cannot corrupt registration ownership.

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
  persistence rollback, clear rollback, duplicates, conflicts, publication,
  suppression, permanent Retry binding, test outcomes, cancellation, and
  dispose all preserve exact ownership.
- All snapshots use enum values and canonical target order with no raw native
  error data.
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
- Any uncertain candidate cleanup, duplicate callback, timer leak, or loss of
  previous state blocks completion.
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
