# 03 Shortcut Controller And Composition

## Outcome

Integrate the registration service into the production main-process graph.
`ShortcutController` continues to own the seven product callbacks and all
recording/selected-text eligibility, while the service alone owns Electron
bindings, callback generations, suppression state, tests, snapshots,
compensation, and cleanup. Until Packets
07–09 supply an exact supported-host policy, production fails closed as
unsupported rather than silently registering through a generic policy.

## Prerequisites

- Packets 01 and 02 are complete and approved for continuation.
- Read `AGENTS.md`, `tasks/todo.md`, `tasks/handoff.md`, this packet, and the
  **Electron And Providers** and **Dependency Injection And Runtime Ownership**
  convention sections.
- Inspect `src/main/shortcuts.ts`, `src/shared/mainInteractionLock.ts`,
  `src/main/di/mainProcessCompositionRoot.ts`, `src/main/mainProcessApplication.ts`,
  `src/main/main.ts`, and focused controller/composition tests.

## Owned Requirements

- SCOPE-004
- ARCH-004, ARCH-006, ARCH-007
- FLOW-001, FLOW-007, FLOW-009
- SEC-001, SEC-003
- COMP-003, COMP-004

## In Scope

- `ShortcutController` delegation and preservation of action gates.
- `MainInteractionLock` to registration-service suppression.
- Composition-root construction of policy, adapter, service, callbacks, and
  lifecycle ownership.
- Startup/dispose integration and focused controller/composition regression
  tests.
- Bounded platform/session classification injected from the process root.
- Replacement of Packet 01's legacy null-registration compatibility guard with
  service-owned registration delegation.

## Out Of Scope

- Hotkey mutation/query IPC, preload, renderer behavior, localization, portal
  feature switches, package metadata, documentation, and manual OS testing.
- Provider, recording, selected-text, clipboard, notification, history, or
  retry behavior changes beyond adapting nullable configured accelerators.

## Task Contract

1. Remove the raw Electron-like `globalShortcut` dependency and all direct
   register/unregister bookkeeping from `ShortcutController`. Inject the
   `HotkeyRegistrationService` (or its narrow command interface) instead.
2. Keep all seven product callbacks in `ShortcutController`: Record, Stop,
   Cancel, Translation, normal Prettify, Quick Prettify, and Retry. Preserve
   every existing recording lifecycle, selected-text ownership, chooser focus,
   enablement, cancellation, notification, history, and retry-availability
   gate.
3. Supply a callback for every configured target to the service regardless of
   current product availability. In particular, Retry remains OS-registered
   while unavailable; its callback performs the existing eligibility check and
   no-ops safely.
4. Use a composition-root-owned initialized reference/closure if necessary to
   break the service/controller construction cycle. The reference must be
   assigned before registration starts, stay process-local, and never become a
   module-level mutable singleton or optional production dependency.
5. Existing application startup calls through the controller to `service.start()`
   once after Electron is ready. Repeated startup is idempotent. Existing
   application shutdown calls service disposal exactly once through its
   process-lifecycle owner. `ShortcutController`, adapters, and composition
   helpers never run independent unregister, compensation, or cleanup logic.
6. Subscribe once to `MainInteractionLock`. Locked means
   `service.setSuppressed(true)` before any renderer feedback; unlocked means
   false. Opening Settings must not call unregister or rebuild registrations.
   Dispose removes the subscription.
7. Stop treating `hotkey-capture` as a main-process suppression or registration
   authority. The only runtime suppression source is main interaction
   ownership. Packet 04 removes the legacy renderer/preload/IPC API after every
   in-tree consumer has migrated in that same increment; do not remove half of
   the channel here.
8. Packet 01's legacy controller guard already skips nullable values. Replace
   that compatibility behavior with the service's authoritative mapping:
   nullable configured values produce no callback/action registration, but
   in-app action methods remain intact for later pointer/keyboard invocation.
   Do not retain a parallel controller-owned registration path.
9. Convert raw `NodeJS.Platform` and Linux session evidence at the composition
   boundary into Packet 01 enums. Use only bounded environment classification;
   do not log or expose environment contents. Linux session detection accepts
   X11/Wayland and otherwise uses `unknown`.
10. Construct `ElectronGlobalShortcutAdapter`, policy factory output, and
    `HotkeyRegistrationService` only in the main composition root. Electron
    stays outside shared/service unit tests.
11. Supply no permissive Windows/Linux placeholder. The factory returns the
    unsupported policy until the corresponding host packet adds its explicit
    creator. Preserve paused macOS publishing; this packet adds no macOS
    release claim.

## Contracts And Boundaries

- Renderer still cannot import Electron or invoke product callbacks directly.
- `ShortcutController` owns action intent and eligibility; the registration
  service owns when/which OS binding invokes it. Neither owns the other's
  state.
- The process lifecycle owns one service instance and calls its public
  lifecycle. No second constructed owner, cleanup callback, or `unregisterAll`
  path is introduced.
- Logs remain metadata-only and do not contain selected text, transcripts,
  audio, clipboard contents, settings paths, or environment values.

## Expected Files Or Components

- `src/main/shortcuts.ts`
- `src/main/di/mainProcessCompositionRoot.ts`
- `src/main/mainProcessApplication.ts`
- `src/main/main.ts` only if a bounded platform/session input cannot use an
  existing environment contract
- Packet 02 main hotkey modules
- `tests/main/shortcutController.test.ts`
- `tests/main/mainProcessCompositionRoot.test.ts`
- `tests/main/mainProcessApplication.test.ts`

## Acceptance Criteria

- Controller tests prove every existing action callback/gate with nullable
  configuration and permanent assigned bindings.
- Settings/main lock suppresses all product dispatch without a single adapter
  unregister; unlock restores dispatch only after the final lease releases.
- Startup independently retains successful bindings when one target fails.
- Retry stays registered across availability changes; unavailable invocation
  performs no action.
- Composition constructs one adapter/policy/service/controller graph and
  shutdown disposes it idempotently.
- Only hotkey/composition behavior changes; unrelated worktree content is
  preserved.

## Verification

- `node --import tsx --test tests/main/shortcutController.test.ts tests/main/mainProcessCompositionRoot.test.ts tests/main/mainProcessApplication.test.ts tests/main/mainInteractionLock.test.ts tests/main/mainInteractionLockActionGate.test.ts`
- Packet 02 focused service/policy tests.
- `npm run typecheck`
- `npm run test:types`
- Scoped ESLint and Prettier over changed source/tests.
- `git diff --check`

## Failure And Rollback

- Any regression in an existing action gate, duplicate action, unlock race,
  premature unregister, or incomplete dispose blocks completion.
- If the circular composition cannot be resolved with a root-owned initialized
  reference and complete constructors, stop and revise the packet; do not add
  a service locator, default dependency, or module singleton.
- Rollback restores controller wiring while leaving Packet 01 nullable config
  readable and Packet 02 modules unused.

## Manual Gates

- None. Real shortcut activation is deferred to Packets 07–09.

## References

- Specification anchors: **Architecture And Ownership**, **Registration And
  Mutation Flows**, **Failure, Security, And Privacy**.
- Required conventions: **Electron And Providers**, **Dependency Injection And
  Runtime Ownership**.

## Completion And Handoff

After checks pass, mark only Packet 03 complete, update `handoff.md` with exact
files/checks and `Exact next packet: 04`, present the increment, and stop. Do
not change IPC/renderers, commit, push, or start Packet 04.
