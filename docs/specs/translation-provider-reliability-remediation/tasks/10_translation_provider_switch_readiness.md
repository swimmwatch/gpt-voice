# 10 Translation Provider Switch Readiness

## Outcome

Changing the Translation provider keeps the optimistic provider selection, inline
checking state, existing provider/configuration lock, and recording lock active until
the selected provider has terminal readiness and the renderer has read the authoritative
connection snapshot.

## Prerequisites

- Packets 01–05 and 07–09 are complete.
- The approved 2026-08-10 switching decision supersedes the prior no-prewarm-on-selection decision.

## Owned Requirements

- `ARCH-010`, `CONC-009`, `FAIL-011`, `ACC-025`

## In Scope

- Serialize `set-translate-settings` persistence and selected-provider initialization in main.
- Retain a successfully persisted provider after terminal readiness failure.
- Keep existing result, connection-state, preload, and IPC shapes unchanged.
- Query the existing authoritative connection state before renderer switch settlement.
- Guard renderer connection events by provider and target identity.

## Out Of Scope

- Full-window switching UI, global shortcut suspension, settings migration, new IPC,
  provider selector/navigation changes, dependencies, browser automation changes,
  packaging, commits, and live provider use.

## Task Contract

1. A successful settings result returns only after `initializeSelectedProvider()` has
   settled. An unexpected thrown initialization publishes the existing safe
   `not-connected`/`unexpected-failure` state and still returns the persisted settings.
2. Validation or persistence failure returns the existing safe failed save result and
   must not initialize a provider.
3. The main controller serializes settings mutations and awaits outstanding work during
   disposal; later mutations cannot overlap readiness work from an earlier mutation.
4. For a provider-ID change, the renderer keeps `isTranslationProviderSwitching` true
   until its existing connection query completes. Old-provider connection events are
   ignored. Target-language-only changes retain their scoped Translation save lock.
5. Existing `TranslateSection`, `MainToolbar`, Prettify controls, recording controls,
   About, and History retain the current lock boundary. No raw provider error crosses
   the renderer boundary.

## Contracts And Boundaries

- Electron main owns persistence, readiness, serialization, and safe terminal state.
- Renderer accesses the existing APIs only through `window.electronAPI`.
- No source text, result text, URLs, sessions, credentials, or raw exception detail is
  added to IPC, settings, logs, or tests.

## Expected Files Or Components

- `src/main/ipc.ts`, `src/main/services/translation.ts`
- `src/renderer/App.tsx`, Translation settings state and connection presentation
- Focused deterministic IPC, renderer state, and status-presentation tests

## Acceptance Criteria

- A deferred provider initialization leaves the inline Translation spinner and every
  existing provider/configuration lock active until terminal settlement.
- Persistence rejection rolls back optimistic renderer settings and never initializes.
- Initialization failure retains the selected provider and presents its typed connection
  failure after unlock.
- Repeated changes serialize, stale connection state cannot overwrite the current
  selection, and a later valid switch succeeds.

## Verification

- Run focused Translation settings IPC, runtime, renderer state, section, and provider-status tests.
- Run `npm run typecheck`, `npm run test:types`, scoped ESLint/Prettier, and `git diff --check`.

## Failure And Rollback

- Revert only the serialized settings/readiness and renderer-settlement changes if they
  delay or misrepresent a switch. Preserve existing provider lifecycle and connection
  status contracts.

## Manual Gates

- Linux and Windows packaged provider-switch confirmation belongs to Packet 06 and
  requires separate authorization. Do not use credentials or live provider text here.

## References

- Specification: `ARCH-010`, `CONC-009`, `FAIL-011`, `ACC-025`.
- Existing provider switching: `src/renderer/App.tsx`, `src/main/ipc.ts`.

## Completion And Handoff

- Mark this packet complete only after its focused and type/format checks pass.
- Update this workstream's `todo.md` and `handoff.md`; leave the completed change
  uncommitted for review.
