# 04 Selected-Text Profile Orchestration

## Outcome

Refactor selected-text Prettify into one process-owned, cancellable coordinator
with two entry paths: F12 captures and waits for an explicit chooser outcome;
quick apply captures and runs the explicit default. Both paths must restore the
previous clipboard immediately after capture, share one provider/cache/result
path, preserve selected-text gates, and prevent late or duplicate writes. Each
open chooser owns an immutable main-process snapshot of the validated full
profiles and instructions from that moment, so concurrent Settings edits cannot
change the meaning of an in-flight Apply.

## Prerequisites

- Packets 01..03 are complete and approved.
- Read `AGENTS.md`, `todo.md`, `handoff.md`, and the **Electron And Providers**,
  **Dependency Injection And Runtime Ownership**, and **Code And Logging**
  convention sections.
- Inspect `SelectedTextPrettifyService`, `SelectedTextActionGate`,
  selected-text Translation, `ShortcutController`, text automation/cache,
  composition-root wiring, and their direct tests.
- Use planning decision `workflow.chooser-selection-memory:v1`: remember the
  last applied one-off profile only in main-process memory for the current app
  session.
- Use planning decision `workflow.chooser-concurrent-catalog:v1`: an open
  chooser applies its immutable opening snapshot.
- Use planning decision `planning.packet-03-default-resolution-bridge:v1`:
  packet 03 already resolves the authoritative default for the current
  immediate action; this packet extends that seam to the full chooser/quick
  coordinator.

## Owned Requirements

- SCOPE-001, SCOPE-002, SCOPE-003
- PROF-004, PROF-006
- FLOW-001, FLOW-003, FLOW-004, FLOW-005, FLOW-006
- ARCH-001, ARCH-003
- PRIV-002
- FAIL-002, FAIL-003, FAIL-004, FAIL-005, FAIL-006
- QUAL-002 / AC-AUTO-007

## In Scope

- One phase-aware selected-text Prettify coordinator/service.
- Capture/validate/early-restore behavior.
- Extension of packet 03's explicit-default resolver to chooser selection and
  the final quick-apply coordinator.
- Immutable operation-scoped full-profile snapshots for chooser execution.
- Shared provider/cache/result delivery, cancellation, shutdown, reentry, and
  session-only one-off memory.
- Fakes/interfaces for the concrete chooser controller implemented in packet 05.

## Out Of Scope

- BrowserWindow creation, screen placement, preload/IPC, or chooser renderer.
- Global hotkey/config/UI wiring (packet 07).
- Settings profile management or import/export.
- Result review/diff/retry UI, automatic paste/selection replacement, or
  provider fallback.

## Task Contract

1. Keep stateful orchestration in one process-owned class. It may retain the
   existing `SelectedTextPrettifyService` name or introduce a clearly named
   coordinator, but do not create module-global mutable state or free
   pass-through wrappers.
2. Model explicit phases sufficient to distinguish at least:
   `idle`, `capturing`, `choosing`, and `generating`. One active run owns its
   abort controller, source, immutable validated full-profile snapshot,
   renderer-safe summaries derived from that snapshot, and completion promise.
   The snapshot must be a defensive operation-local value, not a live reference
   to repository, config, or Settings draft objects.
3. Expose explicit main-only entry methods for:
   - chooser flow using current selected text;
   - quick apply using the current explicit default;
   - cancellation/shutdown;
   - focus-existing-chooser/reentry detection needed by packets 05 and 07.
     Use typed results with current `success`, `cancelled`, `skipped`, and generic
     status semantics.
4. Define a narrow injected chooser port. It receives only operation-scoped
   source plus ordered localized profile summaries derived from the immutable
   snapshot and returns exactly one of: `apply(profileId)`, `cancel`, `close`,
   or `manageProfiles`. It never receives profile instructions or mutable
   profile records. Concrete window and IPC behavior belongs to packet 05.
5. When the chooser is about to open, after source validation and before
   emitting its payload, main must:
   1. read the authoritative normalized catalog exactly once;
   2. validate and defensively materialize an ordered immutable operation
      snapshot containing the complete built-in and custom profiles, including
      the exact instructions and built-in instruction/version data required by
      the packet 01 composer;
   3. derive renderer-safe ordered summaries and the initial-selection
      eligibility from that snapshot only;
   4. retain the full snapshot in main-process active-run state while sending
      only summaries to the renderer.
      On `apply(profileId)`, validate the ID and resolve/compose the selected full
      profile exclusively from this snapshot. Do not reread the catalog, default,
      legacy projection, or Settings draft. A concurrent Settings Save may edit,
      delete, reorder, add, or change the default profile, but it cannot mutate or
      invalidate the already open chooser's snapshot. Those changes affect only a
      later chooser open or quick action. A profile ID absent from the snapshot is
      rejected generically even if it was added in Settings after the chooser
      opened. Clear the full snapshot and summaries on every terminal path.
6. The capture algorithm is exact:
   1. acquire `SelectedTextActionGate` for Prettify;
   2. remember current clipboard text;
   3. clear clipboard, run current copy automation, wait the existing settle
      delay, and retain Linux selection fallback;
   4. copy selected source into main-process memory;
   5. restore the remembered clipboard immediately after the capture attempt,
      before chooser display, provider readiness, or generation;
   6. validate non-whitespace and the existing 16,000-character source bound;
   7. only then enter chooser or quick execution.
7. After step 5 of the capture algorithm, cancellation, close, Manage profiles,
   invalid source, provider failure, timeout, malformed/empty output, or
   shutdown must not write the remembered clipboard again. This preserves
   clipboard changes the user makes while chooser/generation is pending.
8. Only the first successful non-empty result for the current non-cancelled run
   overwrites the clipboard. An abort/session token must prevent late provider
   completion from writing after cancel, close, shutdown, or replacement.
9. F12 behavior:
   - no provider preparation/readiness/generation before `apply`;
   - chooser payload uses the immutable snapshot's authoritative normalized
     mixed order;
   - apply validates the selected ID against the immutable full-profile
     snapshot, closes chooser immediately, composes that snapshotted
     instruction, and runs the common provider path without rereading Settings;
   - close/Escape/cancel releases the run without provider work;
   - Manage profiles releases the run, clears source, and asks the main window
     owner to open App Settings directly at Prettify profile management.
10. Quick behavior resolves the current explicit default at execution time and
    never opens a chooser. If the default cannot be resolved, recover/notify
    generically and do not run any profile until packet 02 repair is
    authoritative. It never reuses a prior chooser snapshot. Reuse packet 03's
    resolver/composer/runtime contract rather than adding a second default
    resolution path.
11. Remember only the last profile that was explicitly applied from the chooser
    in a private in-memory field. On a later chooser open, preselect it only if
    still valid in that new operation's snapshot; otherwise send no initial
    selection. Never persist it, use it for quick apply, change the explicit
    default, or include it in cache identity.
12. Reentry and single flight:
    - if F12 or Ctrl+F12 arrives while the chooser is open, focus the existing
      chooser, retain its original source, and perform no new copy/provider
      operation;
    - while generating, repeated Prettify entry is skipped and cannot issue a
      duplicate request;
    - Translation/Prettify remain mutually exclusive through the existing gate;
    - every recording lifecycle prohibition remains in force.
13. Keep existing source-length/no-selection/provider failure notifications and
    generic Prettify success status. OS notifications may not include profile
    name/instruction.
14. The chooser apply path and quick path call the same instruction composer,
    provider `prepare/execute`, cache, audit, cancellation, result validation,
    clipboard success write, and status resolver after a profile is resolved.
    The chooser path supplies the selected full profile from its immutable
    operation snapshot; quick apply supplies the current default resolved for
    that invocation.
15. `dispose` is idempotent, aborts generation, closes/cancels chooser through
    the injected port, clears source/profile/snapshot state, and releases the
    action gate exactly once.

## Contracts And Boundaries

- Main owns source text, clipboard, profile resolution, provider work, and
  lifecycle.
- Main owns the immutable full-profile snapshot. Renderer receives summaries
  only and cannot supply, alter, or refresh an instruction for the active run.
- A Settings save during `choosing` cannot mutate the active snapshot. The
  chooser operation is resolved against the catalog state captured when it
  opened; later operations use later authoritative state.
- Source exists only in the active run and chooser payload, never persistence,
  logs, default diagnostics, or normal audit.
- Renderer never receives custom instructions in the chooser payload.
- Translation, recording, history, transcription completion/retry, main-window
  layout, and automatic post-transcription behavior remain unchanged.
- Preserve the current one-minute result cache and generic notification
  mechanism.

## Expected Files Or Components

- Refactor `src/main/services/selectedTextPrettify.ts`.
- Add one chooser-port/shared outcome type in a narrow main/shared file if
  needed for packet 05.
- Update `src/main/di/mainProcessCompositionRoot.ts`,
  `src/main/di/mainProcessRuntimeFactory.ts`, and runtime graph types only for
  constructor dependencies.
- Adapt `src/main/shortcuts.ts` only enough to compile against the new service;
  actual two-hotkey behavior belongs to packet 07.
- Extend `tests/main/selectedTextPrettify.test.ts` substantially.
- Add deferred-chooser concurrency tests that mutate the authoritative catalog
  after open but before Apply and prove defensive snapshot behavior for edit,
  delete, reorder/default change, newly added IDs, and the following operation.
- Extend `tests/main/shortcutController.test.ts` only for changed interface
  compilation; packet 07 owns hotkey behavior assertions.

## Acceptance Criteria

- Source is restored out of the clipboard before chooser/provider wait.
- No provider preparation occurs before chooser Apply.
- The chooser renderer receives ordered summaries with no profile instruction,
  while main retains a defensively copied, validated full-profile snapshot.
- If Settings edits or deletes the selected profile, reorders profiles, or
  changes the default after the chooser opens, Apply still executes the exact
  snapshotted instruction/version and order semantics from open time. It does
  not reread current Settings.
- A profile added after the chooser opens cannot be applied through that
  chooser, while the next chooser and a later quick action observe the newly
  committed catalog/default.
- Concurrency tests use a deferred chooser outcome and mutate repository/config
  objects between open and Apply, proving that neither live object mutation nor
  a committed Settings replacement changes the active operation snapshot.
- Chooser cancel/close/Manage, invalid source, failure, cancellation, and
  shutdown preserve restored/subsequently modified clipboard content.
- Quick and chooser apply use the same execution/cache/result path.
- Reentry focuses the existing chooser and retains its source; generation
  reentry does not duplicate a request.
- A late result after cancellation/shutdown cannot overwrite clipboard.
- Last applied chooser profile is remembered only in process memory and never
  changes default/quick behavior.
- All prohibited voice/Translation/main-window behavior remains unchanged.

## Verification

```text
rtk test node --import tsx --test tests/main/selectedTextPrettify.test.ts
rtk test node --import tsx --test tests/main/shortcutController.test.ts
rtk test node --import tsx --test tests/main/selectedTextTranslation.test.ts
rtk npm run typecheck
rtk npm run test:types
```

Run directly affected composition-root tests and task-local lint/format checks.

## Failure And Rollback

- Every terminal path releases gate/session exactly once and clears source.
- Any exception before source capture restoration must still attempt one
  immediate restoration; exceptions after restoration must never restore
  again.
- Rollback restores the previous one-step service; packet 02's projection and
  packet 03 runtime remain compatible.
- If current shortcut ownership cannot represent post-Apply working status
  without starting provider work early, stop and repair the main-only status
  contract in planning; do not show provider work before Apply.

## Manual Gates

- MANUAL GATE: platform clipboard/selection behavior must later be exercised in
  packaged Windows and Linux builds in packet 10.
- Do not use real private selected text in tests or logs.
- No commit, push, PR, installer, provider call, or release action is
  authorized.

## References

Mandatory:

- Specification sections **F12 Chooser Flow**, **Quick-Apply Flow**,
  **Failure And Recovery**, **Safety And Privacy**.
- Planning decisions `workflow.clipboard-lifecycle:v1`,
  `workflow.chooser-selection-memory:v1`,
  `workflow.chooser-concurrent-catalog:v1`, and
  `failure.chooser-reentry:v1`, plus
  `planning.packet-03-default-resolution-bridge:v1`.
- Current `src/main/services/selectedTextPrettify.ts` and
  `src/main/services/selectedTextTranslation.ts` precedents.

## Completion And Handoff

After verification:

1. Mark packet 04 complete in `todo.md`.
2. Update `handoff.md` with phase/API decisions, changed files, checks, and
   packet 05 as next.
3. Present for review and stop. Do not commit or start packet 05.
