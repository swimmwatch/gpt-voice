# 13 Provider Settings UI

## Outcome

The provider-settings window renders a dedicated Local Whisper editor rather than an authentication form. It exposes every basic and advanced setting with deterministic dependent selections, immediate accessible validation, safe storage information, and an explicit reset flow. Main remains authoritative, and a successful Local Whisper save updates the canonical snapshot while keeping the settings window open.

## Prerequisites

- The Local Whisper plan is approved and Task 13 has separate execution
  authorization.
- Packet [01 Shared Domain Contracts](./01_shared_domain_contracts.md) is complete and supplies canonical setting enums/catalog-facing types.
- Packet [12 Protected IPC And Settings Service](./12_protected_ipc_and_settings_service.md) is complete and supplies the typed IPC/preload bridge, coordinator-owned sanitized settings snapshot, safe save/reset/open-folder API, expected epochs, and subscription cleanup. The `localRuntime` metadata branch remains owned by packet 02 and is only forwarded through this shared contract.
- Read the renderer, localization, accessibility, and provider-settings sections of [project conventions](../../../agent-guides/project-conventions.md).
- Inspect only the target files and local UI precedents: `src/renderer/ProviderSettingsWindow.tsx`, `src/renderer/components/ProviderSettingsForm.tsx`, `src/renderer/providerSettingsViewState.ts`, `src/renderer/providerSettingsWindowState.ts`, `Field`, `Select`, `SearchableSelectInput`, `Slider`, `Textarea`, `Collapsible`, `AlertDialog`, `Badge`, `Spinner`, locale dictionaries, and their focused tests.
- Use existing React functional-component, hook, and pure-reducer patterns. Tests use `node:test`, pure state tests, source-contract tests, and `react-dom/server`; do not add jsdom or a new UI-test dependency.

## Owned Requirements

Primary requirement ownership:

- `UI-001`, `UI-002`, `UI-003`, `UI-004`: dedicated, detailed, responsive Local Whisper form with explicit engine and collapsed Advanced controls.
- `SET-002`, `SET-003`: explicit GPU/CPU selection, no auto target/fallback, and Basic/Advanced organization.
- Pre-selection presentation ownership for `MODEL-010` and `UI-007`: all six
  model families expose the approved approximate VRAM and total-system-RAM
  guidance before selection.
- Renderer/presentation portions of `SET-004`, `SET-005`, `SET-006`, `SET-007`, `SET-008`, `VAL-001`, `VAL-002`, and `VAL-003`.
- Form/presentation portions of `MAC-001`, `MAC-002`, and `MAC-003`; macOS remains a disabled Planned skeleton.
- Safe managed-storage presentation from `MODEL-006` and `SEC-004`; packet 12 owns the command boundary and packet 04 owns filesystem behavior.
- Section 17.1 reset confirmation and renderer behavior.

Acceptance ownership:

- Settings-form slice of `AC-AUTO-004`; packet 14 owns the complete assembled
  screen assertion covering progress, actions, disabled reasons, and support
  badges together with this form.
- Renderer-settings slices: `AC-AUTO-001`, `AC-AUTO-003`, `AC-AUTO-006`, `AC-AUTO-028`, `AC-AUTO-036`, `AC-AUTO-044`, and `AC-AUTO-045`.
- Family-guidance/form slice of `AC-AUTO-049`; packet 14 owns the assembled
  primary acceptance test.
- Manual UI ownership: the settings-field/reset/storage subset of `AC-MAN-008`; the form-only Planned-state subset of `AC-MAN-011`.

## In Scope

- Route `localRuntime` provider settings to a dedicated Local Whisper renderer branch before the generic auth settings flow.
- Add a pure draft reducer/view-state model and a focused hook/controller around packet 12's snapshot, save, reset, and open-storage APIs.
- Render the required scrollable sections and every settings field with exact options, defaults, conditional visibility, validation, dirty/saving/success/error state, and accessible explanations.
- Render the exact six-family `Approximate requirements` VRAM/RAM guidance
  before model selection without using it as a Save/load block threshold.
- Keep unavailable persisted devices/revisions visible without auto-selecting replacements.
- Preserve deterministic dependent selections while editing and accept main's canonical snapshot after save.
- Keep the Local Whisper settings window open after successful Save and Reset.
- Add a collapsed Advanced section, prompt code-point counter, canonical temperature control, error summary, field associations, and keyboard-safe reset confirmation with focus restoration.
- Show only packet-12 sanitized storage labels/app-relative location and byte counts; invoke folder opening without receiving a path.
- Add all required localized strings and focused renderer tests.

## Out Of Scope

- Runtime/model download, resume, cancel, retry, remove/delete action rows, progress, update badges, capability controls, residency controls, and main-window provider status; packet 14 owns those.
- Downloader, artifact repository, device probing, worker lifecycle, model load/unload, transcription, or provider-switch orchestration.
- Any renderer access to filesystem paths, URLs, hashes, executables, GPU APIs, native errors, or untrusted free-form catalog/device IDs.
- Custom model storage, import, arbitrary directories, translation, timestamps, VAD, diarization, partial text, or other excluded inference features.
- macOS runtime/model catalogs or executable behavior; do not add a hidden CPU escape path.
- Changes to existing browser-session/API-key settings semantics, including their current close-after-save behavior. The stay-open rule is Local Whisper-specific.
- New dependencies, implementation of packet 14 placeholders, commits, pushes, PRs, releases, or publication.

## Task Contract

### Renderer routing and state ownership

- Branch on the canonical provider metadata discriminator `authType: 'localRuntime'` (or the exact packet-12 canonical discriminator) before requesting or rendering generic `ProviderSettings` authentication data.
- The generic `ProviderSettingsForm` continues to own only `browserSession` and `apiKey`. A Local Whisper state must never fall through to login, relogin, clear key, or clear session.
- Load one sanitized snapshot from packet 12, then subscribe to ordered updates. The hook must ignore events at or below the latest `snapshotEpoch` and dispose only its subscription on unmount/window close.
- Maintain a local draft and dirty state separate from the last canonical snapshot. Background status/inventory events may refresh non-draft status/options, but must not silently overwrite dirty user-entered fields. If a selected option disappears, retain it as unavailable.
- Treat the persisted initial prompt as write-only renderer data. The snapshot provides only whether one exists; the local draft holds only text entered during this window session plus an `unchanged` / `replace` / `clear` intent.
- Every Save sends canonical IDs/integers plus the latest expected configuration/inventory epochs. On stale result, retain the draft, install the refreshed snapshot, explain that the user must review/retry, and perform no optimistic success transition.
- On successful Save, replace draft/canonical baselines with the returned snapshot, clear dirty state, announce success, and keep the window open. Do not call `closeProviderSettings`.
- Renderer validation is immediate guidance only. A main validation failure must be mapped back to relevant fields and the action summary without raw exception text.

### Required section order

The existing provider-settings window remains one vertically scrollable document at 560×680 with a 440×520 minimum. Render sections in this order:

1. status and current-device assessment slot (packet 14 supplies the detailed body);
2. runtime setup, including engine/target/backend/device/runtime revision settings;
3. model and revision management, including family/revision/variant settings;
4. basic inference settings;
5. initially collapsed `Advanced` inference settings;
6. managed storage, licenses/provenance slot, Save/Reset actions, and error summary.

Packet 13 may render neutral typed summaries in the status/action slots needed for a coherent form, but must not invent packet-14 capability, artifact-operation, or residency behavior.

### Field contract

| Field             | Control, options, default, and visibility                                                                                                                                                                                                                                               | Renderer behavior and validation                                                                                                                                                                                                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Engine            | Required select: `Whisper.cpp` (`whisperCpp`) or `Faster-Whisper` (`fasterWhisper`); default `whisperCpp`; always visible.                                                                                                                                                              | Changing it updates dependent option sets from the sanitized snapshot/draft profiles. Never infer a fallback after a failure. Mark as load-affecting.                                                                                                                                                                                      |
| Execution target  | Required select: `GPU` (`gpu`) or `CPU` (`cpu`); default `gpu`; always visible; no `auto`.                                                                                                                                                                                              | Never switch target because a device/backend fails. Mark as load-affecting.                                                                                                                                                                                                                                                                |
| Backend           | GPU selector containing only context-valid `cuda`, `hip`, or `vulkan`; read-only `CPU` for CPU; read-only disabled `Metal (Planned)` for the macOS skeleton.                                                                                                                            | `cpu` with GPU and GPU backends with CPU are invalid. A recognized unset GPU value displays an explicit choose/setup requirement rather than selecting one silently. Mark as load-affecting.                                                                                                                                               |
| Device            | GPU selector using packet-12 opaque IDs and sanitized labels; CPU shows a read-only sanitized host summary.                                                                                                                                                                             | Required for operational GPU use. Retain an unavailable selected ID as a labeled unavailable choice; never pick another device. Reject/display unknown draft values. Mark as load-affecting.                                                                                                                                               |
| Runtime revision  | Exact compatible immutable revision options for the current engine/target/backend; default comes from the remembered profile or pinned recommendation for a never-seen key.                                                                                                             | Show recommended/installed/missing metadata from safe options without auto-updating an existing selection. Mark as load-affecting. Download actions arrive in packet 14.                                                                                                                                                                   |
| Model family      | Required select: `tiny`, `base`, `small`, `medium`, `large-v3`, `large-v3-turbo`; default `base`; always visible. Every option or an immediately adjacent accessible comparison lists Section 8.1.1 approximate VRAM and total-system-RAM ranges for all six families before selection. | Use localized labels but persist IDs. Label values `Approximate requirements`; explain that VRAM is GPU-only, CPU uses no model VRAM, and ranges are guidance rather than guarantees. Never derive values from artifact size or use the family range to disable Save/selection. Mark family as load-affecting.                             |
| Model revision    | Exact immutable catalog revisions for `(engine, family)`; remembered selection or recommendation for a never-seen key.                                                                                                                                                                  | Retain a missing selected revision and label its state. Never advance to Update available automatically. Mark as load-affecting.                                                                                                                                                                                                           |
| Model variant     | Reviewed variants only; default `full` when available, otherwise sole variant; show only when more than one variant exists.                                                                                                                                                             | Do not expose Faster-Whisper compute precision as a model variant. `q5_0` may appear only when supplied by the reviewed catalog for qualified `large-v3`/`large-v3-turbo`. Mark as load-affecting.                                                                                                                                         |
| Language          | Searchable/select control over `auto` plus the pinned common language catalog; default `auto`; always visible.                                                                                                                                                                          | Persist canonical ID only. No free text, engine alias, or locally invented locale variant. This is request-affecting.                                                                                                                                                                                                                      |
| Initial prompt    | Write-only replacement textarea; empty by default; always visible; live `0 / 1000` Unicode-code-point counter. If main reports a stored prompt, show a separate `Stored privately` status plus explicit Keep/Clear behavior, never the value.                                           | Empty untouched input means `unchanged`; entered text means `replace`; explicit Clear means `clear`. Preserve exact newly entered whitespace/text. Reject NUL, invalid Unicode scalar sequences, and more than 1,000 code points; no trimming, normalization, truncation, prefill, logging, or diagnostic echo. This is request-affecting. |
| Temperature       | Accessible decimal/slider representation from `0.00` to `1.00` in `0.05` steps; default `0.00`; always visible.                                                                                                                                                                         | Keep locale parsing in renderer and submit only safe integer `temperatureHundredths` `0..100`, divisible by `5`. Non-finite/off-grid/out-of-range input is invalid. No fallback-temperature list. This is request-affecting.                                                                                                               |
| Compute precision | Advanced; Faster-Whisper only. CUDA options `float16`, `int8_float16` (default `float16`); CPU options `int8`, `float32` (default `int8`).                                                                                                                                              | Show only values allowed by the selected context and narrowed manifest. Never expose it for `whisperCpp`, AMD, or an unsupported combination. Mark as load-affecting.                                                                                                                                                                      |
| Decoding strategy | Advanced select: `greedy`, `beamSearch`, `bestOfSampling`; default `greedy`.                                                                                                                                                                                                            | Do not modify temperature/beam/best-of automatically. This is request-affecting.                                                                                                                                                                                                                                                           |
| Beam size         | Advanced integer input, only for `beamSearch`; required safe integer `1..10`; default `5`.                                                                                                                                                                                              | Retain a hidden draft value for convenience if desired, but omit it from the active submitted settings in all other strategies.                                                                                                                                                                                                            |
| Best of           | Advanced integer input, only for `bestOfSampling`; required safe integer `1..10`; default `5`.                                                                                                                                                                                          | Retain a hidden draft value for convenience if desired, but omit it from the active submitted settings in all other strategies.                                                                                                                                                                                                            |
| CPU threads       | Advanced, CPU target only: `auto` or integer `1..detectedLogicalProcessors`; default `auto`.                                                                                                                                                                                            | Display the current sanitized authoritative upper bound. Reject fractional, unsafe, zero, and above-bound values. Never submit it to a GPU worker. Mark as load-affecting.                                                                                                                                                                 |

Use the exact decoding matrix:

- `greedy` requires temperature `0.00`; beam/best-of are hidden and omitted.
- `beamSearch` requires temperature `0.00` and beam size `1..10`; best-of is hidden and omitted.
- `bestOfSampling` requires temperature `0.05..1.00` on the 0.05 grid and best-of `1..10`; beam is hidden and omitted.
- Display a cross-field error and block an invalid Save. Never silently rewrite strategy, temperature, beam size, or best-of.

### Dependent-selection behavior

- Seed the reducer from packet 12's canonical active settings, remembered selection profiles, sanitized option sets, and pinned defaults. Do not derive recommendations from display order.
- When a parent changes, restore a draft-local value already entered for that key when safe; otherwise restore the last explicitly saved value supplied by main; for a genuinely unseen key use only the pinned default supplied by main.
- A catalog update must not cause the renderer to recompute defaults for an existing key.
- Initial GPU state follows main's 0/1/N decision: exactly one eligible combination may arrive selected; zero or multiple remain visibly unset until user choice.
- NVIDIA exposes CUDA; Windows AMD exposes Vulkan; exact-allowlisted Linux AMD exposes HIP first and Vulkan as a separate alternative. Never present Vulkan as an automatic HIP recovery.
- Faster-Whisper AMD combinations remain Unsupported; Intel/software/unknown adapters never appear as eligible defaults.
- Failed Save, probe, artifact, or device operations never mutate the draft selection.

### Validation and accessibility

- Use pure validation/presentation functions so every branch can be table-tested without a DOM environment. Main remains authoritative.
- Distinguish recognized incomplete/setup-required values from malformed values. A syntactically valid incomplete or unsupported selection may be saved and remains visibly Not ready; a malformed enum/number/catalog/device value cannot be submitted.
- Associate every error/description with its field using the existing `Field` contract and stable IDs. Mark invalid controls, announce action errors, and render a concise error summary next to Save/Reset with links/focus targets where the component system supports them.
- Every disabled control/action has a persistent perceivable explanation adjacent to it or referenced with `aria-describedby`; a tooltip alone is insufficient.
- Advanced is keyboard-operable, has correct expanded state/name, and remains reachable at minimum dimensions.
- Do not convey required, invalid, dirty, support, or success state through color alone.
- Wrap long localized labels and action rows, maintain touch/click targets, prevent horizontal overflow, and keep every control reachable in the existing scroll container at both required sizes.

### Save, reset, and storage behavior

- Save is busy only for its own active request. Disable duplicate submission and expose text plus spinner semantics. Do not close the window on success.
- If the form is malformed, keep Save unavailable and show the reason. If it is valid but incomplete/unsupported, allow Save and show that it will remain Not ready.
- Reset requires an AlertDialog confirmation explaining that it clears Local Whisper choices and the private initial prompt but does not delete installed runtimes/models or resumable downloads.
- Reset carries expected epochs. On success, replace the draft with returned defaults, clear the prompt-presence indicator and local replacement text, clear dirty state, announce success, restore focus predictably, and keep the window open. On conflict/stale/failure, preserve draft and show safe recovery.
- Storage shows only main-provided platform label/app-relative location and aggregate/per-artifact byte counts. `Open storage folder` invokes the packet-12 command without a path and receives no path.
- License/provenance entries use only reviewed opaque command/link identifiers. Main resolves and opens an allowlisted destination; no URL enters the settings draft, snapshot, or command payload.

### Required tests

- Table-test initial state and every engine/target/backend/device/family/revision/variant/strategy parent switch, including unseen and previously saved keys.
- Test exact visibility for all engine, target, backend, strategy, precision, and CPU-thread combinations.
- Test absent/stored prompt presence, unchanged/replace/clear intent, no stored-value prefill, replacement code points (including surrogate pairs), NUL, 1,000/1,001 limits, temperature locale conversion/grid, beam/best-of/thread safe integer bounds, inactive omission, and cross-field errors.
- Test unavailable selected devices/revisions and catalog updates without selection rewrite.
- Table-test all six exact family guidance ranges, accessible names/copy, GPU
  versus CPU VRAM explanation, and the fact that a family below/inside/above
  guidance remains selectable and Save-able when its settings are otherwise
  valid.
- Test valid-incomplete Save, malformed blocked Save, stale result, main validation result, successful save staying open, and reset semantics.
- Render representative forms with `react-dom/server` and assert labels, descriptions, Advanced semantics, error summary, disabled reasons, prompt counter, sanitized storage copy, and absence of auth controls.
- Add locale-key parity tests and source/contract tests for subscription cleanup and no `onClose` after Local Whisper Save.
- Keep existing API-key/browser-session tests passing unchanged.

## Contracts And Boundaries

- Renderer receives only packet-12 sanitized DTOs and invokes `window.electronAPI`; it never imports main/Electron/filesystem/process code.
- Main remains the sole settings validator. Renderer feedback is advisory and cannot authorize a device, revision, or operation.
- The form persists canonical IDs and `temperatureHundredths`, never localized labels/decimal strings.
- No absolute path, username, device serial/UUID, origin/header, hash, executable, argv, native error, prompt echo, audio, or transcript may appear in renderer snapshots/errors/logging.
- Existing remote provider forms retain their current behavior. Only Local Whisper Save/Reset is required to keep the window open.
- Packet 14 owns setup progress, action availability, compatibility/residency controls, and main-window readiness. Leave explicit composition slots rather than provisional duplicated logic.
- macOS arm64 is Planned/unavailable in this release: Metal is display-only, no download/load action is introduced, CPU does not bypass the gate, and the form never says Ready.

## Expected Files Or Components

Adapt names only to reuse an already canonical equivalent:

- New renderer state/controller:
  - `src/renderer/localWhisperSettingsViewState.ts`
  - `src/renderer/hooks/useLocalWhisperSettingsController.ts`
- New Local Whisper components:
  - `src/renderer/components/localWhisper/LocalWhisperSettingsForm.tsx`
  - focused basic/runtime/model/advanced/storage field subcomponents where they keep the form readable
- Existing integration points:
  - `src/renderer/ProviderSettingsWindow.tsx`
  - `src/renderer/components/ProviderSettingsForm.tsx`
  - `src/renderer/providerSettingsViewState.ts`
  - locale dictionaries and locale-key contract tests
- Reuse existing UI primitives. Add no dependency and do not fork equivalent `Field`, `Select`, `SearchableSelectInput`, `Slider`, `Textarea`, `Collapsible`, `AlertDialog`, `Badge`, or `Spinner` components.
- Focused tests under `tests/renderer`, plus shared renderer-contract tests only where required.

## Acceptance Criteria

- Local Whisper always opens the dedicated settings editor and never shows login, API-key, session, or clear-auth UI.
- Every field, exact option set, default, visibility rule, decoding combination, and input boundary in this packet is implemented and table-tested.
- Before selection, all six model families expose their exact approved
  approximate VRAM and total-system-RAM ranges with non-guarantee copy; CPU
  VRAM is explained as not applicable and the family guidance never acts as a
  validation or resource gate.
- Parent changes restore deterministic saved/unseen child values; a missing device/revision stays selected and unavailable; no failure or catalog update silently rewrites selection.
- Valid incomplete/unsupported settings can be saved and visibly remain Not ready. Malformed input is blocked in renderer and still rejected by main when forged.
- A successful Save updates canonical state and leaves the window open. A stale/failed Save retains the draft and shows a safe actionable error.
- Prompt replacement length uses Unicode code points, displays a live accessible counter, preserves exact newly entered text, and never truncates, logs, returns, or pre-fills a persisted value. An existing prompt can be kept or explicitly cleared without revealing it.
- Advanced starts collapsed and exposes only context-relevant precision/strategy/beam/best-of/thread controls with correct keyboard/screen-reader semantics.
- Reset confirms scope, clears settings/prompt only after main success, preserves artifacts/downloads, restores focus, and keeps the window open.
- Storage copy is sanitized and folder opening never returns or accepts a path.
- At 560×680 and 440×520, all controls, errors, descriptions, disabled reasons, and actions remain scroll-reachable with no horizontal clipping; long localized labels wrap.
- macOS arm64 renders only the Planned Metal skeleton with no executable/download path or CPU bypass.
- Existing provider settings flows remain behaviorally unchanged.

## Verification

Use the final canonical test filenames in equivalent targeted commands:

```bash
rtk test node --import tsx --test tests/renderer/localWhisperSettingsViewState.test.ts tests/renderer/localWhisperSettingsForm.test.ts tests/renderer/providerSettingsViewState.test.ts tests/renderer/providerSettingsWindow.test.ts tests/renderer/i18nLocalWhisper.test.ts
rtk tsc
rtk lint
rtk prettier --check src/renderer/ProviderSettingsWindow.tsx src/renderer/components/ProviderSettingsForm.tsx src/renderer/localWhisperSettingsViewState.ts src/renderer/hooks/useLocalWhisperSettingsController.ts src/renderer/components/localWhisper/*.tsx tests/renderer/*localWhisper*.test.ts
rtk git diff --check
```

Do not weaken assertions or install a DOM test dependency to make the checks pass. Record only concise results in `tasks/handoff.md`.

## Failure And Rollback

- Save/reset failure preserves the user's draft and last canonical snapshot; stale results install only the refreshed non-authoritative snapshot metadata and require explicit retry.
- A malformed renderer event or unknown status is ignored/rejected safely and must not reset selections or enter an auth branch.
- If localization or minimum-size layout cannot express a disabled reason accessibly, stop and fix the component contract; do not hide the reason in tooltip-only copy.
- If packet 12 lacks a required sanitized option/default/validation field, mark this packet blocked and repair the contract through planning/packet 12 rather than fetching privileged data in renderer.
- Rollback reverts only renderer/localization/tests introduced here. It must not reset settings or delete artifacts.

## Manual Gates

- Run the settings-field subset of `AC-MAN-008` in the real provider-settings window at exactly 560×680 and 440×520 with long localized labels. Verify keyboard-only traversal, Advanced, prompt counter, validation summary, disabled reasons, Save, Reset confirmation, focus restoration, and sanitized folder action.
- Inspect the platform accessibility tree or use the available screen reader to verify names, descriptions, error association/announcement, expanded state, and non-color status. Record the environment and result in `tasks/handoff.md`.
- Run a fixture-only macOS arm64 form check when such a build fixture is available: it must show Planned Metal, no runtime/model action, no Ready, and no CPU bypass. Physical Apple Silicon evidence is not required and must not be claimed.
- No AMD/NVIDIA hardware inference, model download, credentials, or external network is authorized by this packet.

## References

- Authoritative specification anchors: `../spec.md` Sections 4-6, 8.1-8.6,
  including 8.1.1,
  10.5, 11.6, 17.1, 19.1 (`AC-AUTO-001`, `003`, `004`, `006`,
  `028`, `036`, `044`, `045`, `049`) and 19.3 (`AC-MAN-008`,
  `AC-MAN-011`).
- Approved decisions: `scope.provider-settings-detail`, `architecture.inference-engine`, `architecture.engine-exposure`, `ui.settings-depth`, `architecture.device-backend-selection`, `settings.normalized-defaults`, `settings.dependent-selection-keys`, `settings.initial-prompt-persistence`, `compatibility.common-language-catalog`, `models.initial-catalog`, `compatibility.macos-execution`, and `resources.model-estimate-presentation` in `../decisions.yaml`.
- Mandatory project rules: repository `AGENTS.md` and renderer/localization/accessibility/provider sections of `docs/agent-guides/project-conventions.md`.
- Local precedents: existing provider settings window/form, `providerSettingsViewState.ts`, `Field`, `SearchableSelectInput`, Radix-backed controls, locale dictionaries, and their focused tests.
- Dependency packets: [01](./01_shared_domain_contracts.md) and [12](./12_protected_ipc_and_settings_service.md).

## Completion And Handoff

- Implement and verify only packet 13.
- Mark only packet 13 complete in `tasks/todo.md` after automated checks and the packet-level manual UI gate pass.
- Update `tasks/handoff.md` with exact changed files, concise checks, the manual viewport/accessibility evidence, limitations, and packet 14 as the next packet.
- Present the packet for review and stop. Do not commit, push, open a PR, publish, or begin packet 14 without a later explicit incremental-implementation authorization.
