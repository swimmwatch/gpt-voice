# 23 Main-Window Local Whisper Residency Control

## Outcome

Add one Local Whisper-only `Load model`/`Free model` control to the main
toolbar through a separate, closed, stale-checked main-window residency IPC
surface. The command delegates exactly once to the existing process-owned
coordinator, preserves the read-only status subscription, exposes only
sanitized status/failure data, blocks provider switching while its operation is
pending, and implements the complete accessible state matrix without
optimistic residency.

This packet completes the product surface required before Linux or Windows
qualification freezes candidate identity. It creates no new worker, model,
download, settings, provider, storage, or qualification authority.

## Prerequisites

- Local Whisper specification revision 15 and plan revision 19 are Approved.
- Tasks 15 and 16 are complete and committed; they provide the exact-sender
  IPC/status subscription, renderer service, main toolbar, and accessible
  status foundations that this packet extends without reopening them.
- Task 19 is reviewed and committed before Task 23 production edits begin. Its
  implementation-readiness gate, ordinary development activation, saved
  provider/runtime/model reconstruction, six installed model artifacts, and
  bounded CPU/CUDA application smoke remain passing.
- No Task 20 candidate input, Linux/Windows platform branch, result, evidence
  index, predecessor result, or aggregate root has been frozen.
- Task 23 has separate execution authorization. Plan approval alone does not
  authorize implementation, application launch, hardware use, commit, or push.

## Owned Requirements

- Primary: `ARCH-011`, `IPC-004`, `UI-009`, `LIFE-007`, and `SEC-016`.
- Superseding/consumed slices: the revision-15 main-window amendments to
  `ARCH-010`, `IPC-003`, `UI-008`, and the existing `FAIL-004` lifecycle
  failure contract.
- Primary automated acceptance: `AC-AUTO-059`, `AC-AUTO-076`, and
  `AC-AUTO-077`.
- Manual acceptance: `AC-MAN-016`.
- Supporting regression acceptance: `AC-AUTO-003`, `AC-AUTO-025`,
  `AC-AUTO-034`, `AC-AUTO-035`, `AC-AUTO-047`, and Task 19
  `AC-AUTO-073`–`AC-AUTO-075`.

## In Scope

- Closed shared main-residency command/result types plus exact runtime
  validators.
- One dedicated main-window IPC invoke channel registered beside, not inside,
  the existing status query/subscription channels.
- Exact live main-window sender authorization, committed active-provider
  validation, snapshot-revision validation, action-state validation,
  coordinator delegation, sanitized result projection, and one lifecycle
  audit.
- Narrow preload and renderer declarations/service methods using only
  `window.electronAPI`.
- Revision-aware renderer pending/result/subscription reconciliation and
  reload/replacement recovery.
- One Local Whisper-only icon control adjacent to the existing Local Whisper
  main status, following the Ollama Prettify Load/Free visual precedent without
  sharing its provider state.
- Localized accessible labels, tooltip/status/alert behavior, disabled reasons,
  focus/keyboard behavior, and reduced-motion pending presentation.
- Provider-switch conflict coverage while main `load` or `unload` is pending.
- Deterministic shared/main/preload/renderer/composition/accessibility tests and
  plan-revision-19 implementation-readiness validator alignment.

## Out Of Scope

- Changing coordinator load, unload, transcription, cancellation, worker,
  resource, failure, or snapshot semantics.
- A main-window settings snapshot, compatibility command, artifact command,
  download, model/runtime selection, managed-folder action, provider-selection
  command, path, URL, executable, native authority, or raw error surface.
- Making Free cancel Loading or Transcribing; cancellation remains separate.
- Optimistic renderer residency, a second lifecycle owner, queued lifecycle
  actions, automatic retries, automatic provider switching, or fallback.
- Changes to Local Whisper settings UI behavior or to remote provider and
  Ollama Prettify contracts beyond regression protection.
- Native code, runtime/model bytes, managed storage, package targets,
  qualification evidence, support promotion, signing, upload, publication,
  release, or dependency additions.

## Task Contract

### Closed shared DTO and channels

Add one main-residency command shaped exactly as:

```ts
{
  kind: 'load' | 'unload';
  expectedSnapshotRevision: number;
}
```

`expectedSnapshotRevision` must be a positive safe integer. Reject missing,
unknown, extra, inherited, non-number, fractional, unsafe, zero, or negative
values. Do not reuse a permissive epoch validator that accepts zero.

The closed result contains only success, the accepted `load`/`unload` command
(or the existing `invalid` failure discriminator for an undecodable request),
the current `LocalWhisperMainStatusSnapshot`, and a sanitized failure or
`null`. Validate both request and result as exact-key plain records. The result
must never include the full settings snapshot, settings or inventory epochs,
prompt presence/text, artifact rows/progress, storage, catalog, paths, URLs,
executable data, native handles/authorities, raw worker data, stderr, audio,
transcript, stack, or raw exception.

Add one dedicated invoke channel under the canonical Local Whisper channel
owner. Keep `mainStatusQuery`, `mainStatusSubscribe`,
`mainStatusUnsubscribe`, and `mainStatusChanged` read-only and unchanged in
meaning. Do not route the new command through the settings-window channel or
grant the main window a settings capability.

### Main authorization and action gating

For every invoke, main performs this order before coordinator effects:

1. authorize the exact live main-window top-level frame through the existing
   main capability;
2. decode the exact command DTO from `unknown`;
3. require the authoritative committed provider to equal `local-whisper`;
4. require `expectedSnapshotRevision` to equal the current main status
   revision;
5. require the requested action to satisfy the current main-status predicate;
6. delegate exactly once to `LocalWhisperCoordinator.loadNow()` or
   `LocalWhisperCoordinator.unload()`;
7. project the coordinator result and latest main status into the closed
   sanitized result and record one lifecycle audit.

Wrong sender or malformed/extra input fails before provider, revision, or
coordinator effects. An inactive provider or lifecycle/action conflict returns
sanitized `OPERATION_CONFLICT`; a stale revision returns sanitized
`STALE_CONFIGURATION`. No rejected request may load, unload, cancel, switch
providers, start compatibility checking, download, mutate settings, or audit a
successful operation.

The main action predicates are exact:

- `load`: Local Whisper is committed, residency is `Unloaded`, runtime and
  model setup are both `Installed`, `canAttempt` is true, `blockingCode` is
  null, and `selectedButUnavailable` is false. A retryable prior sanitized
  failure does not independently disable an otherwise eligible retry.
- `unload`: Local Whisper is committed, residency is `Loaded`, and activity is
  `Idle`.
- `Loading`, `Unloading`, transient `Failed`, `Transcribing`, renderer-local
  pending, a second command, and every other ineligible state remain
  non-invokable and fail closed if forged.

The controller must call the existing coordinator directly through its
injected port. Do not add a pass-through service, second operation mutex,
module-level runtime instance, or lifecycle state parallel to the coordinator.
Use the existing Local Whisper lifecycle audit category and settle it exactly
once; subscription delivery creates no duplicate audit.

### Provider switching and concurrency

The existing Local Whisper provider-switch preparation continues to arbitrate
through the same coordinator operation owner. While a main `load` or `unload`
is active, a switch request must return `OPERATION_CONFLICT`, preserve the
committed Local Whisper provider in main and renderer, leave the residency
operation running, and neither queue nor cancel the switch. The user must retry
switching after settlement; the later successful switch follows the existing
provider-change unload behavior.

Table-test simultaneous settings save, transcription, second click,
settings-window lifecycle action, provider switch, renderer reload, window
replacement, and application shutdown. Exactly one lifecycle operation owns
effects. A failed or stale command leaves the authoritative status intact and
never causes fallback, partial persistence, or late success.

### Preload and renderer service

Expose one narrow preload invoke method accepting the closed command and
returning the closed result. Update preload/main/renderer type parity together;
renderer code continues to receive no Electron or Node primitive and may call
only `window.electronAPI`.

Extend the existing main-status renderer service/hook rather than constructing
a parallel status owner. It must:

- invoke with the latest accepted main `snapshotRevision`;
- permit at most one renderer-local main-residency invoke at a time;
- never optimistically change capability, residency, activity, or failure;
- accept command-result status only when its revision is newer than the current
  accepted main snapshot;
- let an equal revision settle the matching local request without duplicating
  notification, and ignore a lower revision;
- always clear renderer-local pending after fulfilled or rejected invoke;
- convert a thrown preload transport error into one generic localized
  operation-failed presentation without exposing its message/stack; and
- reconstruct pending/Loading/Loaded/Unloading/Unloaded presentation from the
  process-owned subscription after reload or replacement without cancelling or
  repeating the operation.

### Main-toolbar state matrix

Render one stable control only while the authoritative committed voice provider
is Local Whisper. Keep the existing compact status and settings shortcut. Do
not alter remote-provider login/status or Ollama Prettify Load/Free behavior.

| Latest authoritative state          | Required control                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Main status absent                  | Disabled pending indicator; reason `Loading Local Whisper status`.                                                         |
| Eligible `Unloaded` predicate above | Enabled `Load model`, including eligible Unchecked, EstimateOnly/available-on-demand, ValidatedUnloaded, and retry states. |
| Other `Unloaded`                    | Disabled `Load model` with current sanitized reason and settings recovery path; no implicit compatibility/download.        |
| `Loading`                           | Disabled pending indicator announced as `Loading model`; never cancellation.                                               |
| `Loaded` + `Idle`                   | Enabled `Free model`, invoking contract action `unload`.                                                                   |
| `Loaded` + `Transcribing`           | Disabled `Free model` with a perceivable model-in-use reason.                                                              |
| `Unloading`                         | Disabled pending indicator announced as `Freeing model`.                                                                   |
| Transient `Failed`                  | Disabled control with current sanitized failure until the next authoritative status is derived.                            |

Use the established icon-button, tooltip, and spinner primitives and the
Ollama Prettify `HardDriveDownload`/`PowerOff`/reduced-motion
`LoaderCircle` visual precedent. Local Whisper state and callbacks remain
separate. Provide localized accessible name, title/tooltip, keyboard
activation, visible focus, text/icon/color redundancy, a focusable/perceivable
disabled reason, `role=status` for ongoing state, and one `role=alert`
announcement for a newly accepted command failure. Preserve the current main
window layout at compact dimensions and prevent control/status/settings
collision with long localized labels.

### Plan and implementation-readiness alignment

Update the production task-plan validator and implementation-readiness
verifier/tests from plan revision 18 to 19. They must require exactly Tasks
01–23, exactly 76 primary automated owners in canonical order
`AC-AUTO-001`–`054` plus `056`–`077`, the Task 23 filename, the three registered
Task 23 verification commands, and Task 23 ownership of amended
`AC-AUTO-059`, `AC-AUTO-076`, and `AC-AUTO-077`.

Do not weaken schema exactness, skip plan checks, treat a missing Task 23 test
as passing, or change qualification Pending into a Production claim. Task 20
may freeze candidate identity only after the revised validators and the Task 23
product checks pass from the final committed source.

## Contracts And Boundaries

- The approved status subscription remains read-only; the new command is a
  separate least-authority main-window surface.
- Exact sender validation remains owned by the existing Electron authority.
  Renderer visibility is never authorization.
- The coordinator remains the sole mutable residency/activity owner and the
  only source of lifecycle conflicts and snapshots.
- Provider selection remains commit-on-main-success. A rejected pending switch
  preserves Local Whisper in config, main, and renderer.
- Shared IPC validators decode `unknown` and exact keys before use. Preload and
  renderer never import privileged runtime objects.
- No command or UI error may disclose prompt, path, URL, artifact internals,
  device authority, audio, transcript, stderr, raw error, or stack.
- No artifact/network operation is authorized. Installed Task 19 artifacts are
  consumed read-only by the manual smoke.
- No new dependency, settings migration, data migration, platform target, or
  release compatibility behavior is introduced.

## Expected Files Or Components

- Shared Local Whisper IPC channels, main command/result DTOs, validators, and
  exports under `src/shared/localWhisper/`.
- `src/main/localWhisper/ipc/LocalWhisperIpcController.ts` and its coordinator,
  sender-capability, active-provider, snapshot, and audit dependencies.
- Existing exact main sender authority and main-process composition wiring;
  `VoiceProviderSelectionService`/provider-switch wiring only where required to
  assert the existing conflict contract, not to add a second lock.
- `src/main/preload.ts`, `src/main/ipc.ts` if channel registration requires it,
  and `src/renderer/types.d.ts` kept in exact parity.
- `src/renderer/localWhisper/LocalWhisperRendererService.ts`,
  `useLocalWhisperMainStatus.ts`, and a focused pure presentation/state helper
  or Local Whisper main-model control component with no privileged ownership.
- `src/renderer/App.tsx`, `src/renderer/components/MainToolbar.tsx`, and
  `src/renderer/styles/globals.css` for callback/pending/UI composition and
  compact layout.
- Canonical i18n keys and all locale maps under `src/main/i18n/`; no raw
  user-facing English literals in the control.
- Focused tests in `tests/shared/localWhisper/ipc.test.ts`,
  `tests/main/localWhisper/ipc/`, `tests/main/preloadApi.test.ts`,
  `tests/main/mainProcessCompositionRoot.test.ts`, provider switching/
  composition tests, `tests/renderer/localWhisper/`, and any focused pure
  main-control test added under `tests/renderer/`.
- `scripts/local-whisper/validate-task-plan.mjs`, the implementation-readiness
  verifier and its tests, plus the revision-19 registry/schema already owned by
  this plan.
- `todo.md` and `handoff.md` completion state only after verification.

## Acceptance Criteria

- `AC-AUTO-059`: exact settings/main sender substitution, subscription order,
  stale state, lifecycle command, save conflict, and provider selection tests
  prove separate capabilities; main status remains read-only and only the
  dedicated stale-checked command can load/unload.
- `AC-AUTO-076`: the full Section 8.8 Cartesian state table proves exact
  visibility, label, enabled state, safe reason, pending/failure semantics,
  keyboard/focus/accessibility, revision ordering, and remote/Ollama
  non-regression.
- `AC-AUTO-077`: wrong sender, inactive provider, stale/current revision,
  malformed/extra input, duplicate/conflict, coordinator failure, preload
  rejection, switch-during-pending, reload/replacement, and out-of-order result
  tests prove exactly-one delegation, no cancellation/queueing, highest-revision
  recovery, sanitized results, and no forbidden data.
- Shared, preload, main, and renderer validators reject every unknown field and
  forged result without a privileged effect.
- Existing settings-window load/unload, lazy loading, provider dispatch,
  coordinator lifecycle, remote providers, and Ollama Prettify behavior remain
  passing without duplicated state or listeners.
- The plan/implementation-readiness validators report 23 packets and 76 unique
  automated owners while Linux/Windows qualification and aggregate readiness
  remain Pending.
- `AC-MAN-016` is recorded Pass only after the bounded authorized CPU/CUDA and
  accessibility smoke below; otherwise Task 23 remains incomplete or blocked
  with the exact missing gate.

## Verification

Run focused contracts first:

```text
rtk npm run test:local-whisper:ipc
rtk npm run test:local-whisper:composition
rtk npm run verify:local-whisper:ui
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run verify:local-whisper:implementation-readiness
```

Then run applicable project quality gates:

```text
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
```

The three registry-owned commands are exactly:

rtk npm run test:local-whisper:ipc

rtk npm run test:local-whisper:composition

rtk npm run verify:local-whisper:ui

Do not run Task 20/21 qualification, freeze candidate evidence, download or
remove artifacts, build/sign/upload release assets, publish, or push as part of
these automated checks.

## Failure And Rollback

- On any shared/preload/main/renderer contract failure, leave Task 23 unchecked
  and qualification blocked. Do not weaken exact-key, sender, provider,
  revision, failure-sanitization, or accessibility assertions to obtain a pass.
- Roll back the new command/channel/control and its isolated tests together;
  retain the prior read-only main status and settings-window lifecycle controls.
- Do not revert, reset, delete, or redownload Task 19 managed artifacts or
  settings. This packet has no data migration and rollback requires no storage
  mutation.
- If provider switching can commit or queue during a pending command, if a
  stale result can overwrite a newer snapshot, if the command leaks a forbidden
  field, or if cleanup ownership becomes uncertain, stop before manual hardware
  use and return the defect to this packet.
- A runtime/provider defect found during manual smoke is not qualification
  evidence. Keep platform qualification Pending and repair/reverify Task 23
  before any candidate freeze.

## Manual Gates

`MANUAL GATE — AC-MAN-016 main-window CPU/CUDA residency and accessibility smoke`

- Requires separate Task 23 execution authorization that explicitly permits
  launching the ordinary non-packaged application and bounded use of the
  already installed `base/full` model, CPU, and available NVIDIA CUDA device.
- Use the authenticated Task 19 development activation and fixed managed root.
  Do not request credentials, use private audio/transcripts, access arbitrary
  origins, download/remove artifacts, publish evidence, or claim Production.
- With Local Whisper selected, verify keyboard-only and screen-reader access,
  status-loading/disabled reasons, localized Load/Free labels, focus, tooltip,
  pending status, failure alert, reduced motion, and compact-window layout.
- Run `Load model` then `Free model` once on CPU and once on eligible CUDA.
  CPU initializes no GPU; CUDA proves the persisted physical NVIDIA selection;
  both fully validate/load/warm, reach Ready, free the worker allocation, and
  leave no worker/launcher/model-guard orphan.
- During a bounded pending Load or Free, attempt a provider switch and verify
  `OPERATION_CONFLICT`, retained Local Whisper selection, no cancellation or
  queued switch, and a successful separately retried switch only after
  settlement. Exercise renderer reload/replay without duplicating the operation.
- Use only the existing non-private deterministic WAV if Transcribing-state UI
  observation is required; retain no audio or transcript content.
- Record only sanitized pass/fail facts in `handoff.md`. Hardware/process logs,
  raw audio, transcript text, private paths, and device serials remain private.

No other external, destructive, network, commit, push, PR, signing, upload,
publication, support-promotion, tag, or release action belongs to Task 23.

## References

Mandatory task-local references:

- `spec.md` Section 5 item 22, Section 7 four-surface/IPC contract, Section 8.8
  state matrix, and `AC-AUTO-059`, `AC-AUTO-076`, `AC-AUTO-077`,
  `AC-MAN-016` only when resolving a discovered conflict.
- `docs/agent-guides/project-conventions.md`: Project And Commands, Code And
  Logging, Electron And Providers, Dependency Injection And Runtime Ownership,
  Tests And Documentation, and Git And Releases.
- Existing Ollama Prettify main-model control is a visual/accessibility
  precedent only; it is not a Local Whisper state or IPC dependency.

Implementation starts from this packet, current `todo.md`, and `handoff.md`.
Do not load the full specification, full plan, or completed Tasks 15/16/19 by
default; this packet contains their required extension boundaries.

## Completion And Handoff

1. Complete automated verification and the authorized `AC-MAN-016` gate.
2. Update the Task 23 checkbox in `todo.md`; do not alter completed task hashes.
3. Replace `handoff.md` with the completed Task 23 files, concise checks,
   sanitized manual result, exact next packet (`20_linux_qualification.md`),
   and blockers only.
4. Present Task 23 for review and stop before commit, push, Task 20 candidate
   freeze, qualification, PR, signing, upload, publication, tag, or release.
