# 14 Artifact Capability And Residency UI

## Outcome

The Local Whisper settings screen presents the complete renderer-side runtime/model lifecycle, current-device support and compatibility, capability proof, residency, and recovery workflow. Users can invoke exact typed artifact operations, `Check compatibility`, `Load now`, and `Unload`; see process-owned progress after close/reopen; understand every disabled or failed action; and manage selected or unselected immutable revisions without automatic fallback.

The main window also understands `localRuntime` readiness. Local Whisper remains selectable in Not-ready states, never displays a login action, lazy loading remains possible through `canAttempt`, and provider-switch/cancellation conflicts are presented without falsely changing provider state.

## Prerequisites

- The Local Whisper plan is approved and Task 14 has separate execution
  authorization.
- Packet [05 Streaming Artifact Lifecycle](./05_streaming_artifact_lifecycle.md) is complete and supplies exact artifact state/progress/actions and process-owned operations.
- Packet [10 Device Capability Validation](./10_device_capability_validation.md) is complete and supplies sanitized support, setup, estimate/validation, resource, device, and recovery snapshots.
- Packet [11 Coordinator Residency And Lifecycle](./11_coordinator_residency_and_lifecycle.md) is complete and supplies serialized load/unload/cancel/provider-switch state and derived readiness.
- Packet [12 Protected IPC And Settings Service](./12_protected_ipc_and_settings_service.md) is complete and supplies exact-sender commands, monotonic snapshots/epochs, safe errors, and subscriptions.
- Packet [13 Provider Settings UI](./13_provider_settings_ui.md) is complete and supplies the Local Whisper form, controller hook, responsive sections, and accessibility/error patterns.
- Inspect only the target renderer files and directly related tests: Local Whisper components/hook from packet 13, `src/renderer/App.tsx`, `providerState.ts`, `providerSelectionCoordinator.ts`, `statusPresentation.ts`, `components/MainToolbar.tsx`, existing progress/dialog/badge/tooltip primitives, locale dictionaries, and relevant main-window/provider tests.
- Use pure presentation/reducer tests and `react-dom/server`; do not add jsdom or a UI-test dependency.

## Owned Requirements

Primary UI/presentation ownership:

- `MODEL-001`, `MODEL-007`, `MODEL-008`, `RUNTIME-003`, `RUNTIME-004`, `VRAM-002`, `VRAM-003`, `UI-005`, `CAP-008`: renderer management actions, explicit updates, deletion/removal, load/unload, and visible safe Not-ready state. Backend semantics remain packets 05 and 10.
- `CAP-001`, `CAP-011`, `CAP-012`, `LIFE-005`, `UI-006`: current-device, capability/residency separation, resource presentation, and derived local-runtime readiness.
- Selected-configuration presentation portions of `MODEL-010`, `CAP-013`, and
  `UI-007`: distinguish family guidance, matching catalog estimate, qualified
  peak, current free-memory threshold, and real-load authority.
- `LIFE-003`, `LIFE-006`, `FAIL-001`, `FAIL-002`, `FAIL-004`, `FAIL-006`: renderer action availability, conflict/cancellation presentation, and explicit retry/recovery. Main enforcement remains prerequisite packets.
- Renderer portions of Sections 8.7, 10.1-10.5, 11.1-11.6, 12.2-12.5, 13.1-13.6, 14, and 15.
- Renderer support-claim portions of `AMD-001` through `AMD-006`, `CAP-009`, and `MAC-001` through `MAC-003`.

Acceptance ownership is explicitly presentation-only where a prerequisite packet owns the operation:

- Full assembled-screen ownership of `AC-AUTO-004`, including packet 13's
  settings-form regression plus progress, actions, disabled reasons, support
  badges, minimum dimensions, keyboard reachability, and screen-reader labels.
- Support/readiness presentation: `AC-AUTO-005`, `AC-AUTO-006`, `AC-AUTO-014`, `AC-AUTO-015`, `AC-AUTO-016`, `AC-AUTO-028`, `AC-AUTO-031`, `AC-AUTO-034`, `AC-AUTO-035`, `AC-AUTO-037`, `AC-AUTO-039`, `AC-AUTO-042`, and `AC-AUTO-047`.
- Primary assembled-screen ownership of `AC-AUTO-049`, consuming packet
  01/03/09/11/12 supporting tests rather than duplicating their validators.
- Artifact/residency UI: `AC-AUTO-009`, `AC-AUTO-019`, `AC-AUTO-020`, `AC-AUTO-021`, `AC-AUTO-038`, and the renderer-responsiveness slice of `AC-AUTO-043`.
- Manual UI gates: the UI portions of `AC-MAN-007`, `AC-MAN-008`, `AC-MAN-009`, and `AC-MAN-011`.

## In Scope

- Render support tier, setup, capability, residency, activity, last-validation, resource, safe reason, and recovery-action presentation.
- Render all-family approximate guidance before selection and the narrower
  matching selected-configuration estimate plus separate qualified peak after
  selection, with exact-estimate-unavailable fallback and explicit
  non-guarantee language.
- Render runtime and model revision rows with exact metadata/state/action availability, selected/update status, accessible progress, and safe error guidance.
- Invoke download/resume/cancel/retry/remove/delete by typed artifact ID and expected epochs; reconcile ordered snapshot events and stale results.
- Implement model/runtime destructive confirmations, exact impact copy, disabled reasons, focus restoration, and safe partial-delete presentation.
- Implement `Check compatibility`, `Load now`, and `Unload` controls with correct distinctions between EstimateOnly, Validated-Unloaded, and operational Ready.
- Preserve process-owned download progress across settings-window close/reopen.
- Integrate local-runtime readiness into main-window provider state, toolbar/status, selection, conflict, and cancellation presentation without an auth guard.
- Present AMD only as untested Preview and macOS arm64 only as Planned/unavailable.
- Localize stable error codes and recovery action IDs without displaying native messages.
- Add pure state/presentation, component render, source-contract, accessibility-semantic, localization, and main-window integration tests.

## Out Of Scope

- Network download/resume implementation, streaming/hash/extraction/install, inventory reconstruction, quarantine deletion, filesystem locks, or path safety.
- GPU/CPU probing, allowlist evaluation, memory measurement, worker spawn/handshake, allocation/load/warm-up, transcription, unload/kill, or cache ordering.
- Changing packet-05/10/11 state machines or making renderer state authoritative.
- Auto-download, auto-update, auto-select, auto-fallback, hidden retry queues, or implicit compatibility checks.
- Renderer-supplied filesystem paths, URLs, executable data, hashes, native device structures, or raw errors.
- New model families/variants, settings fields, runtime packs, support tiers, or production claims.
- Actual AMD or Apple Silicon inference testing. Faster-Whisper AMD and all release-1 macOS execution stay unavailable.
- Documentation/release qualification owned by packets 16 and 17, new dependencies, commits, pushes, PRs, publication, or release work.

## Task Contract

### Snapshot reconciliation and operations

- Extend packet 13's controller; do not create a second Local Whisper subscription or independent state authority.
- Seed from packet 12's full sanitized snapshot. Accept an event only when `snapshotEpoch` is newer; preserve the latest `configurationEpoch` and `inventoryEpoch` for every command.
- Treat event snapshots and command-return snapshots as the only truth. Local optimistic state may mark the clicked action pending, but may never advance setup/capability/residency or claim deletion/install/load success.
- If a command returns `STALE_CONFIGURATION`, install its newer safe snapshot, clear only the local pending marker, retain user selections/draft, and require explicit retry. A live `OPERATION_CONFLICT` is not queued.
- Closing/unmounting removes only this renderer listener. Downloads remain process-owned. Reopening fetches current inventory/progress and must not restart or cancel them.
- Action payloads contain typed catalog artifact ID/operation ID plus expected epochs only. Never accept or display a main path, origin URL/header, hash/signature, executable/library, argv, or arbitrary device structure.

### Status and current-device section

Present these independent dimensions; do not collapse them into one boolean:

| Dimension       | Required states/presentation                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Support tier    | `Production`, `Preview`, `Planned`, or `Unsupported`, derived from the app-shipped matrix only. Probe success never promotes it. Preview remains Preview.                                   |
| Runtime setup   | `Missing`, `Downloading`, `Resumable`, `Verifying`, `Installing`, `Installed`, `Installed + Update available`, `Deleting`, `Failed`, `Corrupt`, or `Blocked`, with exact selected revision. |
| Model setup     | Same artifact states, independently from runtime, with exact engine/family/revision/variant.                                                                                                |
| Capability      | `Unchecked`, `Checking`, `EstimateOnly`, `Validated`, `NotReady`, or `Stale`; show last observed/validated time when supplied.                                                              |
| Residency       | `Unloaded`, `Loading`, `Loaded`, `Unloading`, or safe Failed-to-Unloaded presentation.                                                                                                      |
| Activity        | `Idle` or `Transcribing`.                                                                                                                                                                   |
| Provider status | `Ready`/`Busy` only for valid + verified + `Validated` + `Loaded`; `Validated · Unloaded` otherwise; exact Not ready, Planned, or Unsupported reason for all other states.                  |

Show engine, target, backend, sanitized device label/opaque safe identity, runtime/model selections, installed/download/expanded sizes, the Section 8.1.1 approximate family range, matching `Estimated for selected configuration`, separate `Qualified peak`, storage usage, license/provenance action by opaque main-resolved command ID, support limitations, last validation time, and safe recovery guidance when supplied. For CPU, show model VRAM as `Not applicable`; do not render zero bytes as a requirement. No destination URL crosses IPC.

Resource presentation must distinguish:

- approximate family capacity guidance: comparison only, never a load block or
  guarantee;
- exact matching catalog estimate versus separately qualified peak, with
  qualified peak selected for threshold calculation when present;
- missing/stale/malformed selected-configuration evidence: show the family
  range plus `Exact estimate unavailable`, never reuse the stale value;
- trustworthy memory below peak plus `max(20%, 512 MiB)`: blocking `INSUFFICIENT_RAM`/`INSUFFICIENT_VRAM`, no override;
- equal/above threshold: may continue but is not a success guarantee;
- metric unavailable: explicit `Resource availability unknown`; Check may estimate and a real load may be attempted;
- actual allocation/load/warm-up failure: authoritative Not ready even after a passing estimate.

Every stable failure code maps to packet 01's deterministic retryability and recovery action ID. Render localized reviewed copy and action label, never a raw message. At minimum cover all Section 15 settings/support, device/prerequisite, resource, artifact, worker/capability, and operation codes. Unknown safe future codes use a generic local-runtime failure plus refresh/support guidance; they never become login/not-configured.

### Compatibility, load, and unload actions

- `Check compatibility` is available only for an actionable non-Planned configuration and invokes packet 10's non-resident estimate path. During Checking show text and busy semantics. Its result is at most `EstimateOnly`; it must never display Ready, Loaded, or imply that a worker remains.
- `Load now` invokes packet 11's full proof. It is the definitive exact-device operation: verified artifacts, backend/device, resources, allocation, full load, warm-up, and no-fallback confirmation. UI enters Loading only from coordinator snapshots and shows Ready only after `Validated` + `Loaded`.
- `Unload` is available for Loaded/eligible failure cleanup when main permits it, rejects active transcription/conflict, shows Unloading, and completes only from a confirmed Unloaded snapshot. Same-fingerprint capability may remain `Validated`; display `Validated · Unloaded`, never Ready.
- Missing/corrupt/blocked artifacts, known insufficient resources, absent device, unsupported/planned paths, and conflicts show the exact reason and appropriate setup/recovery action. No compatibility/load action starts a download.
- A failed/cancelled load leaves Unloaded and preserves selections/artifacts. A confirmed inference cancellation may leave Loaded/Ready; unhealthy/uncertain cancellation becomes Unloaded. Render the returned snapshot rather than guessing.
- All disabled actions expose a persistent adjacent/referenced reason; do not rely on a disabled button's tooltip or color.

### Runtime rows and actions

List the selected revision and other installed/catalog revisions independently. Each row shows sanitized revision label, selected/recommended/update status, installed/download/expanded sizes, compatibility, license/provenance, state, progress, and safe failure where available.

Use this exact state-action mapping for each runtime revision:

| State                             | Available action                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing                           | `Download runtime` when support/catalog allows it; no Remove.                                                                                           |
| Downloading                       | `Cancel`; selection changes do not retarget the transfer.                                                                                               |
| Resumable                         | `Resume` and `Cancel` as supplied by main.                                                                                                              |
| Verifying / Installing / Deleting | No conflicting action; explain active stage. Forged commands still fail in main.                                                                        |
| Failed transport/install          | `Retry` when the stable error says retryable; preserve any prior installed revision.                                                                    |
| Installed                         | `Remove runtime`; Load availability is governed separately.                                                                                             |
| Installed + Update available      | Explicit Download for the new immutable revision and Remove for eligible installed rows; never auto-download/select/delete old.                         |
| Corrupt / Blocked / Delete failed | `Remove`/retry removal only when main marks the authenticated managed identity provable; otherwise show safe manual recovery and no destructive button. |
| Unknown/unmanaged                 | Never expose as a catalog row with a destructive action.                                                                                                |

Runtime removal confirmation names engine, runtime revision, backend/target context, selected/resident impact, and disk impact. Main may unload first. A selected removed revision remains selected as `Runtime missing`; no replacement is selected or downloaded.

### Model rows and actions

Each row names logical model, engine, immutable revision, variant, format, selected/recommended/update state, sizes, approximate family requirements, matching selected-configuration estimated memory, separate qualified peak, estimate basis/methodology label, license/provenance, setup state, progress, and safe failure. A missing exact record shows `Exact estimate unavailable`; it never derives a value from file size. Use this exact mapping:

| State                             | Available action                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Missing                           | `Download`; no Delete.                                                                                              |
| Downloading                       | `Cancel`; changing current selection does not retarget it.                                                          |
| Resumable                         | `Resume` and `Cancel` as supplied by main.                                                                          |
| Verifying / Installing / Deleting | No conflicting action; show stage and reason.                                                                       |
| Failed transport/install          | `Retry` when allowed; keep older installed revision.                                                                |
| Installed                         | `Delete`, for selected and unselected revisions.                                                                    |
| Installed + Update available      | Explicit Download for the new revision and Delete for eligible installed rows; selection remains unchanged.         |
| Corrupt / Blocked / Delete failed | Remove/retry only when main proves the exact managed identity; otherwise safe manual recovery with no broad delete. |
| Unknown/unmanaged                 | Never exposed as deletable.                                                                                         |

Before Delete, open an accessible confirmation naming model family, engine, revision, variant, disk impact, and whether it is selected/resident. Explain that selected deletion unloads first and preserves the selection as `Model missing`; it does not choose or download a fallback. Active transcription/conflicting work produces immediate `OPERATION_CONFLICT` and preserves the dialog/retry context.

Deleting an unselected, nonresident revision does not affect the active worker. Partial deletion is presented as `Delete failed`, selection is retained, revision is unusable, and inventory snapshot is refreshed. The renderer never assumes files are gone before main confirms.

### Progress, confirmations, and accessibility

- For determinate transfers render bytes and percentage with `role="progressbar"`, accessible name, `aria-valuemin/max/now`, and visible status text. For indeterminate verification/install/delete, expose a named busy/status region without invented percentage.
- Surface queued status when the packet-05 two-transfer limit is occupied. Do not create renderer queues.
- Rate-limit polite progress announcements separately from visual updates so assistive technology is not flooded; always announce stage changes, completion, failure, and cancellation.
- Progress and state must be understandable without color. Badges include text labels.
- Use AlertDialog for destructive actions. Escape/Cancel closes without invoking; completion/failure closes or retains the dialog according to existing convention, then restores focus to the initiating row action when it still exists, otherwise the row heading/list container.
- Long revision/license/error text wraps, action groups reflow, and status/action content remains scroll-reachable at 560×680 and 440×520.

### Support-matrix claims

- NVIDIA CUDA and Windows/Linux x64 CPU may be described only using the tier supplied by the release matrix; do not convert conditional qualification into an unconditional Production claim.
- Windows AMD `whisperCpp` Vulkan is Preview and explicitly untested in this task.
- Linux AMD `whisperCpp` exact-allowlisted HIP is Preview; Vulkan is a separate explicit Preview alternative. Unlisted HIP is Unsupported/`DEVICE_NOT_ALLOWLISTED`; never suggest automatic Vulkan fallback.
- Faster-Whisper AMD is Unsupported and exposes no action that could execute/download an AMD runtime.
- macOS arm64 shows `Metal (Planned)`/`PLANNED_UNAVAILABLE`, no runtime/model catalogs or download buttons, no Check/Load/Unload execution path, no Ready state, and no CPU bypass.
- Mocked/device documentation evidence must never be phrased as physical AMD/Apple success.

### Main-window local-runtime integration

- Extend `providerState`/presentation with an explicit local-runtime branch. Do not reuse authentication-oriented `isReady` to block Local Whisper.
- Selecting Local Whisper is allowed in Planned, Unsupported, missing, corrupt, blocked, unloaded, or otherwise Not-ready states. The toolbar/status shows the exact safe state and a settings/recovery affordance, never Login/Relogin/API key/session copy.
- `canAttempt` controls whether a transcription request may reach the coordinator. Eligible Unloaded may serve a cache hit or lazy-load on a miss; it is still not visually Ready. Structurally invalid/current-conflict state may disable attempt with a visible reason.
- Provider-switch UI waits for the typed packet-11 result. On `OPERATION_CONFLICT` during Loading/Unloading/Transcribing, keep the current provider selected, show refresh/retry guidance, and do not optimistically switch or queue.
- Present cancellation from returned lifecycle state: cancelled lazy load becomes Unloaded; confirmed healthy inference cancellation may remain Loaded; uncertain worker cleanup becomes Unloaded/failed. Never show partial success.
- Existing browser/API provider readiness, login, selection, recording, retry, and toolbar behavior remains unchanged.

### Required tests

- Table-test every artifact state/action row for selected/unselected runtime and model revisions, including Update available, corrupt, blocked, delete failed, unprovable, and unknown paths.
- Test confirmation copy inputs, conflict/stale results, selected/resident impact, focus target restoration, and no optimistic deletion/removal.
- Test monotonic snapshot reconciliation, close/reopen during an active fake download, queued/determinate/indeterminate progress semantics, and announcement throttling/stage announcements.
- Table-test the full support matrix and all support/setup/capability/residency combinations, including resource below/equal/above/unknown, EstimateOnly, Validated-Unloaded, Ready, Busy, Stale, Planned, and Unsupported.
- Assemble the primary `AC-AUTO-049` matrix: all six family ranges before
  selection; engine/target/backend/runtime/revision/variant/precision changes;
  matching estimate and qualified-peak precedence; CPU VRAM not applicable;
  missing/stale/malformed exact evidence; below/equal/above/unknown current
  memory; and authoritative real-load failure.
- Table-test every Section 15 safe code to localized retryability/recovery action and assert raw fields never render.
- Render representative sections with `react-dom/server` and assert headings, labels, progress semantics, disabled reasons, action names, support badges, and confirmation descriptions.
- Test main-window provider states and selection/transcription guards for loaded, unloaded, missing, unsupported, invalid, conflict, cancellation, and provider-switch outcomes. Assert no local case maps to authentication.
- Test AMD Preview/untested and macOS Planned copy/action absence. Add locale-key parity tests.
- Use fakes for packet-05/10/11 services; this packet does not need real artifacts, workers, GPUs, or network.

## Contracts And Boundaries

- Renderer state is a projection, never authority. Main validates epochs, conflicts, artifact IDs, capability eligibility, and destructive operations on every command.
- Filesystem/process/GPU/download/model/residency authority remains in main. Renderer receives no path, URL, executable, argv, hash, environment, raw native error, worker output, prompt/audio/transcript, serial, or full UUID.
- Closing the settings window unsubscribes that renderer only; process-owned downloads continue and reappear from the latest snapshot.
- `Check compatibility` never downloads, fully loads, retains allocation, or produces Ready. `Load now`/eligible lazy load are the only full proof paths.
- Ready means current exact validated fingerprint plus Loaded residency. Validated-Unloaded is explicitly operationally Not ready.
- Removal/deletion never chooses another revision or downloads a replacement. Unknown/unmanaged data is never a destructive target.
- UI may disable known conflicts, but main rejection is mandatory and hidden destructive queues are forbidden.
- The local-runtime main-window path is not an authentication path and must preserve existing remote-provider compatibility.

## Expected Files Or Components

Adapt names only to extend canonical packet-13 modules rather than duplicate them:

- Pure renderer state/presentation:
  - `src/renderer/localWhisperArtifactViewState.ts`
  - `src/renderer/localWhisperCapabilityPresentation.ts`
  - `src/renderer/localWhisperFailurePresentation.ts` if not already canonical
- Local Whisper sections:
  - `src/renderer/components/localWhisper/LocalWhisperStatusSection.tsx`
  - `src/renderer/components/localWhisper/LocalWhisperRuntimeSection.tsx`
  - `src/renderer/components/localWhisper/LocalWhisperModelSection.tsx`
  - `src/renderer/components/localWhisper/LocalWhisperResidencyActions.tsx`
  - one reusable artifact confirmation/progress component where appropriate
  - extend packet-13 `LocalWhisperSettingsForm.tsx` and `useLocalWhisperSettingsController.ts`
- Reuse an existing progress primitive; add `src/renderer/components/ui/progress.tsx` only if the repository has no accessible equivalent and do not add a dependency.
- Main-window integration:
  - `src/renderer/App.tsx`
  - `src/renderer/providerState.ts`
  - `src/renderer/providerSelectionCoordinator.ts`
  - `src/renderer/statusPresentation.ts`
  - `src/renderer/components/MainToolbar.tsx`
- Locale dictionaries and focused tests under `tests/renderer` for artifacts, capability/failure presentation, Local Whisper rendering, main-window readiness/selection, subscriptions, and accessibility contracts.
- Packet 12's IPC controller may be touched only to complete an already-specified sanitized broadcast hookup; do not add privileged semantics here.

## Acceptance Criteria

- The fully assembled screen, including packet-13 settings fields plus every
  progress row, action, disabled reason, and support badge, renders at 560×680
  and 440×520 with no horizontal clipping; all content is scroll/keyboard
  reachable and has screen-reader-perceivable names, states, and descriptions.
- Every runtime/model state renders exactly its allowed actions and disabled reason; unknown/unprovable entries cannot trigger destructive IPC.
- Download/update is always explicit. Selection changes do not retarget active transfers, and old installed revisions remain installed/selected until explicit user actions.
- Delete/remove confirmations name the exact logical artifact and impact. Selected/resident deletion unloads through main, then preserves `Model missing`/`Runtime missing`; no fallback occurs.
- Process-owned progress remains ordered and accessible, survives settings-window close/reopen, and never exposes sensitive authority data.
- Support, setup, capability, residency, and activity remain visibly separate. EstimateOnly never reads Ready; only validated full load/warm-up plus Loaded residency does.
- `Unload` ends at Unloaded and displays `Validated · Unloaded` when same-process evidence remains; it never claims operational Ready.
- Known-insufficient RAM/VRAM blocks with no override, unknown availability is explicitly uncertain, and actual load failure overrides an earlier estimate.
- All six family ranges are visible before selection. After selection, only a
  matching exact estimate and qualified peak are shown as configuration
  evidence; family guidance never gates, stale/malformed evidence never
  authorizes, CPU VRAM is not applicable, and artifact size is never presented
  as memory.
- Every disabled action has a keyboard/screen-reader-perceivable reason and every stable failure has deterministic localized recovery presentation.
- AMD is consistently Preview/untested, Faster-Whisper AMD is Unsupported, unlisted HIP fails closed, and macOS is Planned with no executable/download/CPU path.
- The main window never maps Local Whisper to login/auth. Selecting Not ready is allowed; `canAttempt` and returned typed state control transcription/lazy-load behavior.
- A provider-switch conflict keeps the original provider selected and is not queued. Cancellation/residency presentation follows the returned coordinator snapshot and never accepts partial success.
- Existing provider behavior is unchanged and all renderer-focused tests pass.

## Verification

Use final canonical filenames in equivalent targeted commands:

```bash
rtk test node --import tsx --test tests/renderer/localWhisperSettingsForm.test.ts tests/renderer/providerSettingsWindow.test.ts tests/renderer/localWhisperArtifactViewState.test.ts tests/renderer/localWhisperCapabilityPresentation.test.ts tests/renderer/localWhisperFailurePresentation.test.ts tests/renderer/localWhisperStatusSections.test.ts tests/renderer/providerState.test.ts tests/renderer/providerSelectionCoordinator.test.ts tests/renderer/mainToolbar.test.ts tests/renderer/i18nLocalWhisper.test.ts
rtk tsc
rtk lint
rtk prettier --check src/renderer/localWhisper*.ts src/renderer/components/localWhisper/*.tsx src/renderer/App.tsx src/renderer/providerState.ts src/renderer/providerSelectionCoordinator.ts src/renderer/statusPresentation.ts src/renderer/components/MainToolbar.tsx tests/renderer/*localWhisper*.test.ts
rtk git diff --check
```

Run existing focused provider-state/toolbar/selection tests even if their filenames differ. Record concise results, not raw logs.

## Failure And Rollback

- A stale, conflicting, failed, or cancelled command clears only local pending presentation and applies the returned newer safe snapshot. It never advances state, changes selection/provider, or assumes file/resource release.
- If an operation stream disconnects, fetch a fresh snapshot and show a safe refresh state; do not restart, cancel, or infer the process-owned operation.
- If a failure code lacks reviewed presentation, use a generic local-runtime failure and deterministic safe recovery; never display raw/native text or collapse to login.
- If packet 05/10/11/12 lacks a state/command needed here, stop and repair planning/prerequisite contracts. Do not implement backend authority in renderer.
- Rollback reverts only packet-owned renderer/localization/tests (and any narrow packet-12 broadcast hookup). It must not issue unload/delete/cancel/reset commands or modify persisted state.

## Manual Gates

- Execute the complete `AC-MAN-008` Local Whisper settings flow at 560×680 and 440×520 with keyboard-only navigation and the available screen reader/accessibility tree. Include long labels, all tier badges, determinate/indeterminate/queued progress, errors, disabled reasons, confirmations, focus restoration, and load/unload status.
- For the UI portion of `AC-MAN-007`, use a controlled fixture service to interrupt/resume/cancel, show an update beside an old selected revision, and delete a selected loaded model. Real-origin/network/filesystem behavior remains packet 17's gate.
- Perform the `AC-MAN-009` claims review without AMD execution: every AMD path says Preview and untested, Faster-Whisper AMD is absent/Unsupported, and no hardware-success or Production statement appears.
- Run the `AC-MAN-011` UI/build fixture when available: macOS arm64 shows Planned/unavailable and exposes no download, Ready, execution, or CPU bypass. This is not Apple Silicon support evidence.
- Real GPU load/unload, AMD qualification, Apple Silicon inference, artifact publication, and release claims remain deferred to packet 17 and are not authorized here.

## References

- Authoritative specification anchors: `../spec.md` Sections 5-6, 8.7,
  8.1.1, 9.2,
  10.1-10.5, 11.1-11.6, 12.2-12.5, 13.1-13.6, 14-15, 19.1
  (`AC-AUTO-004`, `005`, `006`, `009`, `014`-`016`, `019`-`021`,
  `028`, `031`, `034`, `035`, `037`-`039`, `042`, `043`, `047`, `049`)
  and 19.3 (`AC-MAN-007`-`009`, `011`).
- Approved decisions: `scope.model-lifecycle`, `models.version-update-policy`, `models.delete-policy`, `operations.runtime-removal`, `acceptance.capability-gate`, `vram.residency-policy`, `architecture.runtime-state-separation`, `operations.concurrency-policy`, `operations.cancel-switch-exit`, `failure.resource-estimate-policy`, `compatibility.release-tiers`, `compatibility.amd-backend`, `compatibility.macos-execution`, and `resources.model-estimate-presentation` in `../decisions.yaml`.
- Mandatory project rules: repository `AGENTS.md` and renderer/provider/privacy/accessibility sections of `docs/agent-guides/project-conventions.md`.
- Local precedents: packet-13 Local Whisper form/controller; existing `App.tsx`, `providerState.ts`, `providerSelectionCoordinator.ts`, `statusPresentation.ts`, `MainToolbar.tsx`, AlertDialog, Badge, Spinner, Tooltip, and focused renderer tests.
- Dependency packets: [05](./05_streaming_artifact_lifecycle.md), [10](./10_device_capability_validation.md), [11](./11_coordinator_residency_and_lifecycle.md), [12](./12_protected_ipc_and_settings_service.md), and [13](./13_provider_settings_ui.md).

## Completion And Handoff

- Implement and verify only packet 14.
- Mark only packet 14 complete in `tasks/todo.md` after automated checks and packet-level manual UI gates pass or are explicitly recorded as release-deferred by packet 17.
- Update `tasks/handoff.md` with exact changed files, concise checks, viewport/accessibility evidence, deferred physical/network gates, limitations, and packet 15 as the next planned packet.
- Present the packet for review and stop. Do not commit, push, open a PR, publish, or begin packet 15 without a later explicit incremental-implementation authorization.
