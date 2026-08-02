# 16 Local Whisper Settings And Status UI

## Outcome

The provider settings window presents one complete, accessible Local Whisper
configuration and management experience. It exposes every supported option and
validation rule, approximate RAM/VRAM guidance for all six model families,
exact selected estimates, immutable runtime/model revision management,
compatibility checks, explicit load/unload controls, and honest support,
capability, residency, activity, and failure state. The main window exposes only
a compact read-only Local Whisper status and never maps a local failure to
login, API-key, or remote-provider authentication.

## Prerequisites

- Tasks 01, 03, 05, 14, and 15 are complete.
- The approved specification and the plan revision containing this packet are
  authoritative.
- Task 16 has separate execution authorization.
- Task 15 exposes the three typed renderer-facing ports and sanitized snapshot
  contract consumed here. Renderer code receives no coordinator, repository,
  filesystem, catalog, URL, executable, native authority, or raw error object.

## Owned Requirements

- Primary settings and presentation: `UI-001`, `UI-002`, `UI-003`, `UI-004`,
  `UI-005`, `UI-006`, `UI-007`, `MODEL-001`, `MODEL-007`, `MODEL-008`,
  `MODEL-009`, `MODEL-010`, `RUNTIME-003`, `RUNTIME-004`, `SET-002`,
  `SET-003`, `SET-005`, `SET-008`, and `VAL-002`.
- Consumed coordinator/IPC action slices: `UI-008`, `VRAM-002`, `VRAM-003`,
  `SET-004`, `SET-006`, `SET-007`, `SET-009`, `VAL-001`, and `VAL-003`.
- State and support presentation: `CAP-001`, `CAP-008`, `CAP-009`, `CAP-010`,
  `CAP-011`, `CAP-012`, `CAP-013`, `LIFE-003`, `LIFE-005`, `LIFE-006`,
  `FAIL-001`, `FAIL-002`, `FAIL-004`, `FAIL-006`, `AMD-001`, `AMD-002`,
  `AMD-003`, `AMD-004`, `AMD-006`, `MAC-001`, `MAC-002`, and
  `MAC-003`.
- Primary acceptance: `AC-AUTO-004`, `AC-AUTO-038`, and `AC-AUTO-049`.
- Supporting acceptance: `AC-AUTO-001`, `AC-AUTO-003`, `AC-AUTO-005`,
  `AC-AUTO-006`, `AC-AUTO-009`, `AC-AUTO-014`, `AC-AUTO-015`,
  `AC-AUTO-016`, `AC-AUTO-019`, `AC-AUTO-020`, `AC-AUTO-021`,
  `AC-AUTO-028`, `AC-AUTO-031`, `AC-AUTO-034`, `AC-AUTO-035`,
  `AC-AUTO-036`, `AC-AUTO-037`, `AC-AUTO-039`, `AC-AUTO-042`,
  `AC-AUTO-043`, `AC-AUTO-044`, `AC-AUTO-045`, `AC-AUTO-047`,
  `AC-AUTO-059`, `AC-MAN-008`, `AC-MAN-009`, and `AC-MAN-011`.

## In Scope

- A dedicated scrollable Local Whisper provider-settings form.
- Complete field visibility, defaults, remembered dependent selections,
  renderer feedback, main-authoritative validation, and atomic save/reset.
- Runtime/model revision rows, transfer/resume/cancel/retry/remove actions, and
  safe license/provenance actions.
- Approximate family guidance, exact selected estimates, qualified peaks, and
  current-resource status.
- Compatibility, `Load now`, lazy-load explanation, `Unload`, progress,
  confirmations, failures, and recovery actions.
- Support, setup, capability, residency, activity, operational readiness, and
  last-validation presentation.
- Read-only main-window status and commit-on-main-success provider selection.
- Deterministic component, state-matrix, contract, accessibility, and compact
  viewport tests.

## Out Of Scope

- Main/coordinator state ownership, filesystem, network, download, native,
  worker, model, or GPU operations.
- Renderer-side path, URL, executable, catalog, or validation authority.
- Streaming transcription UI, timestamps, VAD, translation, diarization,
  model import, custom storage paths, production publication, representative
  Windows execution, physical AMD qualification, or macOS execution.

## Task Contract

### Page structure and snapshot reconciliation

Create six reachable sections in this order:

1. status and current-device assessment;
2. runtime setup;
3. model and revision management;
4. basic inference settings;
5. collapsed `Advanced` inference settings;
6. managed storage and licenses.

Render from one latest authoritative snapshot plus one local draft. Reconcile
events only when `snapshotRevision` strictly increases. Progress/state events
must not erase an active draft. On successful save, replace both the committed
view and draft with the returned authoritative snapshot. On stale revision,
conflict, or validation failure, retain the draft, show the exact safe reason
and recovery action, and keep committed provider state visible. A selected
missing, incompatible, blocked, or disappeared option remains visible and is
never silently replaced.

Every disabled action has a perceivable text reason. Associate field errors
with their labels/descriptions, announce them, summarize them near the action
area, and move focus predictably after a rejected save or destructive-action
confirmation. Progress and status use text and ARIA semantics, never color
alone. All controls remain reachable at 560 x 680 and 440 x 520 CSS-pixel
viewports without horizontal content loss.

### Renderer trust boundary for storage, licenses, and provenance

The renderer receives only stable catalog-issued notice/link IDs for license
and provenance entries, their sanitized display labels, and state-valid action
IDs. It never receives the backing URL, absolute or relative filesystem path,
catalog entry, artifact manifest, executable location, or arbitrary link text.

Viewing a notice, opening an approved external reference, or opening the
managed storage folder is a typed main-owned action. Main must revalidate the
notice/link ID against the current authenticated catalog, current inventory,
expected action kind, trusted sender, and current snapshot revision before it
resolves or opens anything. Unknown, forged, stale, cross-artifact, or
wrong-purpose IDs fail without navigation or filesystem disclosure. Renderer
tests use sanitized fake IDs only.

### Field contract

Implement these exact controls and rules:

- **Engine**: required fixed literal `whisperCpp`, persisted and displayed as a
  read-only compatibility field with no selector. Any other value is invalid.
- **Execution target**: required explicit `gpu | cpu`, default `gpu`; there is
  no `auto` and no fallback.
- **Backend**: GPU selector `cuda | hip | vulkan`; CPU is read-only `CPU`;
  macOS is read-only disabled `Metal (Planned)`. Reject incompatible pairs.
- **Device**: required GPU selector using a main-issued opaque ID and sanitized
  label; CPU shows a read-only sanitized host summary. A disappeared device
  remains selected/unavailable, with no automatic replacement.
- **Runtime revision**: immutable compatible catalog rows. Use the app-pinned
  recommendation only for a never-seen stable key. A missing, incompatible, or
  old selected revision remains visible and never auto-updates.
- **Model family**: required `tiny | base | small | medium | large-v3 |
large-v3-turbo`, default `base`.
- **Model revision**: immutable selected engine/family catalog row. Use the
  recommendation only for a never-seen key; a missing selected revision stays
  selected and visible.
- **Model variant**: visible only when multiple reviewed variants exist;
  default `full` where available. `whisperCpp` `q5_0` may appear only for a
  catalog-qualified `large-v3` or `large-v3-turbo` entry.
- **Language**: required `auto` or an app-shipped common canonical language ID,
  default `auto`; persist no free text or engine-specific alias.
- **Initial prompt**: optional Unicode, at most 1,000 code points, with a live
  counter. Reject NUL, invalid scalar sequences, and longer values without
  truncation, trimming, or normalization. The snapshot exposes only presence;
  submit exactly `unchanged | clear | replace` plus private replacement text
  only for the replacement mutation.
- **Temperature**: locale-aware UI decimal `0.00..1.00`, normalized before IPC
  to the safe integer `temperatureHundredths` in `0..100`, divisible by `5`;
  default `0`.
- **Decoding strategy**: Advanced `greedy | beamSearch | bestOfSampling`,
  default `greedy`.
- **Beam size**: safe integer `1..10`, default `5`, visible and required only
  for `beamSearch`.
- **Best of**: safe integer `1..10`, default `5`, visible and required only for
  `bestOfSampling`.
- **CPU threads**: Advanced CPU-only `auto | 1..detectedLogicalProcessors`,
  default `auto`; main supplies the bound and the value never enters a GPU
  request.
- **Model storage**: read-only sanitized platform/app-relative label with
  aggregate and per-artifact usage plus main-owned `Open storage folder`; no
  custom directory, import, path, or symlink input.

The cross-field rules are exact. `greedy` and `beamSearch` require temperature
`0`. `beamSearch` requires only beam size. `bestOfSampling` requires only best
of and temperature `0.05..1.00` on the `0.05` grid. Show an error instead of
silently changing another field. Hidden draft values may be remembered but
must be absent from normalized save and worker request data.

### Dependent selections and defaults

Restore the last explicitly saved child value for every specification stable
selection key, including a now-missing or unavailable value. Initialize only a
never-seen key:

- new target -> its CPU-thread default where applicable;
- new engine/target/backend -> app-pinned runtime recommendation;
- new family -> recommended revision and `full` where available;
- zero eligible GPU combinations -> backend/device unset;
- exactly one eligible GPU combination -> initial selection;
- more than one eligible GPU combination -> unset until explicit choice.

Eligible defaults are NVIDIA CUDA, Windows AMD Vulkan, and exact-allowlisted
Linux AMD HIP first plus the separately listed Vulkan path. Software Vulkan,
Intel, unknown, unsupported, and Planned devices are never defaults. The
initialization does not rerun after catalog, driver, device, or failure changes;
returning to a prior stable key restores its saved choice.

### Approximate and exact system requirements

Show `Approximate requirements` beside every family option before selection or
download. These are rounded capacity estimates, not allocation limits,
qualified peaks, or guarantees:

| Family           | Approximate GPU VRAM  | Approximate total system RAM |
| ---------------- | --------------------- | ---------------------------- |
| `tiny`           | approximately 1-2 GiB | approximately 2-4 GiB        |
| `base`           | approximately 1-2 GiB | approximately 2-4 GiB        |
| `small`          | approximately 2-3 GiB | approximately 4-6 GiB        |
| `medium`         | approximately 3-6 GiB | approximately 6-10 GiB       |
| `large-v3`       | approximately 6-8 GiB | approximately 10-16 GiB      |
| `large-v3-turbo` | approximately 3-6 GiB | approximately 6-10 GiB       |

For CPU, state that model VRAM is not allocated and RAM is total system
capacity guidance. Once engine, target, backend, model revision, and variant
are known, also show exactly one matching `Estimated for selected
configuration` and, when catalog-qualified evidence exists, a separate
`Qualified peak`; include variant/backend identity and unit. Reject
malformed, stale, or nonmatching records. Family guidance never blocks
selection, download, or installation; the exact current threshold and real
load are authoritative.

Current-resource status shows the exact peak plus required headroom,
trustworthy free RAM/VRAM when available, and `Resource availability unknown`
otherwise. Known below-threshold state disables `Load now` with exact
`INSUFFICIENT_RAM` or `INSUFFICIENT_VRAM`; there is no override.

### Runtime and model revision management

Render selected and installed immutable revisions independently. Runtime/model
rows cover Missing, Downloading, Resumable, Verifying, Installing, Installed,
Update available, Corrupt, Blocked, Delete failed, incompatible, and
unknown-directory states. Display sanitized version, exact download/installed/
expanded sizes where available, selected/recommended/update markers,
catalog-issued notice/link IDs, support limitations, and safe recovery text.

Expose only state-valid actions:

- runtime: Download, Resume, Cancel, Retry, and per-installed-revision Remove;
- model: Download, Resume, Cancel, Retry, and per-revision Delete;
- never background-update, auto-select, auto-delete, or combine an artifact
  action with compatibility/load.

Confirm destructive removal with exact logical artifact/revision/size and the
consequences. Selected loaded removal explains unload and the resulting
Missing selection. Active transcription and conflicting operations disable it.
Corrupt, Blocked, or Delete-failed managed identities may expose proven
quarantine removal; unknown or unprovable data never receives a broad delete.

### Compatibility, residency, lifecycle, and support state

Present support tier, setup, capability, residency, activity, operational
status, last validation, exact safe reason, and recovery action as separate
concepts. `Check compatibility` is available only when its estimate-only
prerequisites permit; it never downloads, fully loads, retains a worker, or
reports Ready. `Load now` is available only for the exact eligible installed
configuration and invokes the full validation path. `Unload` is visible for
Loading, Loaded, and task-owned failed residency when allowed by main.

Display Ready only for Validated plus Loaded. `Validated · Unloaded` is visibly
Not ready but lazy-load eligible. Missing, corrupt, blocked, unsupported,
resource, load, and warm-up failures keep their exact safe state. Nothing calls
these failures login, API key, authentication, or remote-provider errors.

AMD labels are exactly `Preview · Untested on representative AMD hardware`.
Show Windows Vulkan and exact Linux HIP/Vulkan prerequisites; never expose an
unlisted AMD path or claim that upstream/build/mock evidence is physical
hardware validation. macOS arm64 is exactly `Planned · Unavailable in this
release`, shows disabled Metal, and exposes no download, compatibility probe,
load, Ready, or transcription action.

### Main-window status

Add a compact read-only Local Whisper state to the existing main window,
provider chooser, or toolbar through the Task 15 status port. It may show the
committed provider, Ready, Busy, Validated-Unloaded, Not-ready, Planned, or
Unsupported, a sanitized reason, and a settings shortcut. It cannot mutate
settings or artifacts, invoke compatibility/load/unload, display prompt/path/
URL/native data, or consume a settings-window capability.

Provider selection remains pending until main returns success. On failure,
restore the prior committed provider and display the safe reason without an
authentication prompt. Subscriptions must be removed on reload, replacement,
and close.

### Validation and accessibility tests

Renderer validation provides immediate draft feedback; the returned main
result remains authoritative. Table-test unknown IDs/enums, unsafe/fractional/
off-grid values, Unicode and prompt limits, decoding cross-fields, stale
revisions, forged notice/link IDs, selected-unavailable values, hidden fields,
all load-affecting changes, progress races, provider-switch conflicts, and
every state/action combination. Test semantic labels, descriptions, groups,
status/live regions, focus recovery, keyboard-only operation, and text plus
icon/color state.

## Contracts And Boundaries

- Renderer uses only `window.electronAPI` and Task 15 DTOs/actions.
- Main remains the sole validation, catalog, path, URL, filesystem, artifact,
  capability, lifecycle, and provider-selection authority.
- The settings status port, settings mutation port, and read-only main-window
  status port remain non-overlapping and sender-scoped.
- Snapshot and action IDs are closed, versioned, sanitized, and stale-safe.
- No test fixture contains private prompts, audio, transcripts, user paths,
  real device identifiers, credentials, or live external links.

## Expected Files Or Components

- Local Whisper settings route/page and focused React sections/components.
- Snapshot-backed draft/reconciliation hook and provider-selection adapter.
- Runtime/model/memory/status/action/progress/confirmation components.
- Main-window read-only Local Whisper status component.
- Renderer-safe catalog notice/link action DTOs and typed preload declarations
  only where Task 15's contract requires their UI-facing completion.
- Component/unit/accessibility/state-matrix tests and sanitized fixture data.
- `package.json` scripts `test:local-whisper:ui`,
  `test:local-whisper:ui:contracts`,
  `test:local-whisper:ui:accessibility`, and
  `verify:local-whisper:ui`.

## Acceptance Criteria

- Every field, visibility/default/range/cross-field rule, dependent key, and
  main rejection is represented and tested; no hidden value enters active
  data.
- All six approximate RAM/VRAM ranges are visible before selection and labeled
  approximate; exact estimate, qualified peak, and current-resource records
  remain distinct.
- Every artifact/status/progress/action/confirmation state has exact enabled or
  disabled behavior and a perceivable reason.
- Download, delete/remove, compatibility, load, and unload remain distinct and
  cannot trigger an adjacent operation implicitly.
- The renderer receives catalog-issued notice/link IDs only. Main rejects
  forged, stale, or cross-artifact IDs and never discloses URL or path data.
- AMD, macOS, CPU, and NVIDIA labels match the approved support boundary; no
  physical AMD success or production-ready Apple claim appears.
- Required compact viewports remain keyboard and screen-reader operable, with
  errors/progress/status perceivable without color.
- Main-window status is read-only and provider selection commits only after
  main success.

## Verification

Task 16 must add the named `package.json` scripts and make each command below
directly executable from the repository root:

```bash
rtk npm run test:local-whisper:ui
rtk npm run test:local-whisper:ui:contracts
rtk npm run test:local-whisper:ui:accessibility
rtk npm run verify:local-whisper:ui
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
```

`verify:local-whisper:ui` must deterministically cover both required viewports,
keyboard-only operation, focus/live-region assertions, no-horizontal-loss,
snapshot races, provider-switch failure, forged notice/link actions, all six
model-family estimates, and the full sanitized state/action matrix. A visual
review may supplement these commands but never replace them.

## Failure And Rollback

- If a state cannot be rendered honestly, keep the action disabled with a safe
  reason; never infer a fallback or bypass main validation.
- Roll back only Task 16 renderer components and Task 16-owned UI contract
  additions. Preserve main settings, artifacts, provider selection, and
  process-owned operations.
- Do not expose privileged data or loosen sender, catalog, path, URL, or
  validation rules to make UI tests pass.

## Manual Gates

- `AC-MAN-008` is the final human accessibility and compact-layout review after
  deterministic tests pass.
- `AC-MAN-009` is an AMD claims review, not hardware execution evidence.
- `AC-MAN-011` remains a future physical Apple-host unavailable-state review;
  this packet promises no macOS execution.
- Representative Windows execution belongs exclusively to Task 19.
- No commit, push, pull request, packaging publication, tag, upload, or release
  is authorized by this packet.

## References

- `../spec.md`: Sections 6, 7.1, 8, 9, 10, 11, 13, 14, 15, 20, 21, and 22;
  acceptance rows `AC-AUTO-001`, `AC-AUTO-003`, `AC-AUTO-004`,
  `AC-AUTO-005`, `AC-AUTO-006`, `AC-AUTO-009`, `AC-AUTO-014`,
  `AC-AUTO-015`, `AC-AUTO-016`, `AC-AUTO-019`, `AC-AUTO-020`,
  `AC-AUTO-021`, `AC-AUTO-028`, `AC-AUTO-031`, `AC-AUTO-034`,
  `AC-AUTO-035`, `AC-AUTO-036`, `AC-AUTO-037`, `AC-AUTO-038`,
  `AC-AUTO-039`, `AC-AUTO-042`, `AC-AUTO-043`, `AC-AUTO-044`,
  `AC-AUTO-045`, `AC-AUTO-047`, `AC-AUTO-049`, `AC-AUTO-059`,
  `AC-MAN-008`, `AC-MAN-009`, and `AC-MAN-011`.
- Task 15 protected IPC, composition, settings mutation, and provider-selection
  contract.
- Existing provider settings-window and main-window React precedents.

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with changed UI files,
the tested state/viewport matrices, command results, remaining manual/platform
gates, and next eligible packet Task 17 or another dependency-approved packet.
Stop before Task 17 execution, commit, push, pull request, publication, or
release.
