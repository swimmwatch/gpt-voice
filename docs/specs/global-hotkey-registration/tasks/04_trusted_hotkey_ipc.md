# 04 Trusted Hotkey IPC

## Outcome

Replace the current settings-only hotkey channel with one validated, trusted
main/preload/renderer contract for authoritative state, transactional set and
clear, snapshot events, and bounded physical tests. Remove capture-suspension
IPC so renderer state can never control OS ownership or bypass the main lock.

## Prerequisites

- Packets 01..03 are complete and approved for continuation.
- Read `AGENTS.md`, `tasks/todo.md`, `tasks/handoff.md`, this packet, and the
  **Electron And Providers** and **Dependency Injection And Runtime Ownership**
  convention sections.
- Inspect the hotkey blocks in `src/main/ipc.ts`, `src/main/preloadApi.ts`,
  `src/main/preload.ts`, `src/renderer/types.d.ts`, trusted-IPC precedent, and
  the focused IPC/preload tests.

## Owned Requirements

- OUT-001
- DATA-008
- FLOW-008, FLOW-009
- IPC-001..IPC-003
- FAIL-002
- SEC-001..SEC-004
- QUAL-004, QUAL-006 / AC-AUTO-004, AC-AUTO-006

## In Scope

- Shared request/result/runtime-state discriminated unions and validators.
- Trusted main handlers and snapshot publication.
- Preload methods/events with runtime validation.
- Renderer `DesktopApi` typings and test doubles.
- Owner destruction/cancellation for physical tests.
- Removal of `set-hotkey-capture-active` and legacy settings-only hotkey event.

## Out Of Scope

- Settings/main-window visual changes, localization, portal/package metadata,
  documentation, and manual desktop tests.
- Raw IPC exposure, renderer-side registration, native error forwarding, or
  any new dependency.

## Task Contract

1. Add shared immutable contracts:
   - `HotkeyRuntimeState = { settings, snapshot }`;
   - set request `{ target, accelerator }`;
   - clear/test request `{ target }`;
   - mutation success `{ status: 'success', state }`;
   - mutation failure `{ status: 'failure', failureCode, state }`;
   - test response with one `HotkeyTestResult` and latest snapshot/state.
     Reuse Packet 01 enums and canonical target order; do not duplicate string
     literals in main/preload/renderer.
2. Provide exhaustive runtime validators for every request, response, snapshot
   entry, enum, nullable accelerator, optional failure code, and exact target
   order. Reject extra/malformed enum values and platform-native payloads.
3. Register exactly one trusted query, one snapshot event, one transactional
   set handler, one clear handler, and one test handler. Use stable channel
   constants rather than scattered literals. Remove `get-hotkey`, the old
   settings-only `hotkey-settings-changed` event, and
   `set-hotkey-capture-active` after all consumers migrate.
4. Main handlers validate argument count/shape before calling the service.
   Preserve existing trusted-sender authority for queries and mutations. No
   handler mutates `AppConfigStore` or calls `ShortcutController.register()`
   directly.
5. Set and clear return the registration service's discriminated result,
   including latest authoritative settings and runtime snapshot on success and
   failure. A failed candidate never appears as configured/registered in the
   returned state.
6. Service snapshot publication broadcasts validated snapshots/state only to
   the intended main and Settings windows through existing window ownership.
   Initial query/event reordering must be reconciled by a monotonic revision or
   equivalent latest-event rule; stale query completion cannot overwrite a
   newer event.
7. Test is bound to the invoking trusted Settings owner. If its webContents is
   destroyed, handler/controller disposal occurs, or Settings closes, cancel
   the exact session/timer and settle once as `unavailable`. Do not execute the
   product callback or persist anything.
8. Preload accepts typed inputs, invokes only canonical channels, validates
   every resolved response and main event before delivering it, and exposes no
   Electron event object or raw IPC method.
9. Remove `setHotkeyCaptureActive` from preload and renderer types. Dispatch
   suppression remains driven solely by the already-main-owned interaction
   lock from Packet 03.
10. Malformed inputs/outputs, duplicate events, disposed handlers, and adapter
    exceptions settle to bounded failure/unavailable without leaking raw error
    strings, paths, environment, or external owners.

## Contracts And Boundaries

- Renderer uses only the typed preload capability; main remains sole owner of
  Electron, persistence, timers, and registration.
- Mutation result `failureCode` is an enum, not localized text. Localization
  occurs in Packet 05.
- Event data contains only targets, normalized/configured accelerators, enums,
  revision, and bounded failure codes.
- Do not conflate main interaction lock query/events with registration state;
  dispatch status mirrors the service's authoritative suppression state.

## Expected Files Or Components

- `src/shared/hotkeys.ts` or a focused `src/shared/hotkeyIpc.ts`
- `src/main/ipc.ts`
- `src/main/preloadApi.ts`
- `src/main/preload.ts`
- `src/renderer/types.d.ts`
- Renderer DesktopApi test doubles/types directly affected
- `tests/main/hotkeyIpcContract.test.ts`
- `tests/main/preloadApi.test.ts`
- Focused trusted IPC/service test-session tests

## Acceptance Criteria

- Trusted query/event/set/clear/test work with exact canonical payloads.
- Every malformed request and forged/malformed response/event fails closed.
- Failed mutation returns prior settings and binding snapshot.
- Query/event reordering cannot regress renderer-visible revision.
- Window destruction, timeout, duplicate test, and disposal settle once with no
  callback execution or timer leak.
- No capture-suspension IPC/type/channel remains.

## Verification

- `node --import tsx --test tests/main/hotkeyIpcContract.test.ts tests/main/preloadApi.test.ts tests/main/firstLaunchStartupIpc.test.ts`
- Packet 02 physical-test/service tests.
- `npm run typecheck`
- `npm run test:types`
- Scoped ESLint and Prettier over changed source/tests.
- `git diff --check`

## Failure And Rollback

- Any trusted-sender bypass, unvalidated outbound payload, stale-state overwrite,
  unbounded test, or raw error leak blocks completion.
- If a safe API migration cannot update all in-tree consumers in this packet,
  stop with the exact consumer list; do not keep two mutation authorities.
- Rollback restores previous channels only with Packet 01 null-tolerant data;
  it must not restore renderer-controlled unregister behavior.

## Manual Gates

- None. Electron-level manual activation belongs to the exact host Packets
  07–09.

## References

- Specification anchors: **Settings, IPC, And User Interface**, **Failure,
  Security, And Privacy**.
- Required conventions: **Electron And Providers**, **Dependency Injection And
  Runtime Ownership**.

## Completion And Handoff

After checks pass, mark only Packet 04 complete, update `handoff.md` with exact
files/checks and `Exact next packet: 05`, present the increment, and stop. Do
not implement visual consumers, commit, push, or start Packet 05.
