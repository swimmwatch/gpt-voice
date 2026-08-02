# 15 Protected IPC, Composition, And Provider Selection

## Outcome

The process-owned Task-14 coordinator is constructed once in Electron main and
exposed through three nonoverlapping typed surfaces: provider dispatch,
settings-window commands/queries, and read-only main-window status. Exact live
window/frame capabilities protect every IPC route. Renderer DTOs contain no
path, prompt text, native authority, or raw error. Save and reset each invoke
exactly one atomic coordinator command, and provider selection commits in the
renderer only after main returns success.

## Prerequisites

- Local Whisper specification revision 7 and plan revision 12 are approved.
- Tasks 01, 02, 03, 04, 05, and 14 are complete. Task 14 supplies the only
  mutable coordinator and its atomic command/query/event port.
- Task 15 has separate execution authorization.
- Existing trusted IPC sender validation and preload/main/renderer type parity
  remain mandatory. Renderer code uses only `window.electronAPI`.
- This packet is platform-independent deterministic integration. It must not
  execute representative Windows behavior before Task 19.

## Owned Requirements

- Primary: `ARCH-004`, `ARCH-010`, `IPC-001`, `IPC-002`, `IPC-003`, `SET-009`,
  `UI-008`.
- Supporting boundaries: `SEC-001`, `SEC-002`, `SET-004`, `SET-006`, `SET-007`,
  `VAL-001`, `VAL-003`, `LIFE-004`, `LIFE-005`, `PRIV-002`, `DIAG-001`.
- Primary acceptance: `AC-AUTO-003`, `AC-AUTO-025`, `AC-AUTO-059`.
- Supporting acceptance: `AC-AUTO-002`, `AC-AUTO-007`, `AC-AUTO-036`,
  `AC-AUTO-037`, `AC-AUTO-044`, `AC-AUTO-045`, `AC-AUTO-049`.

## In Scope

- Coordinator construction/registration in the main-process composition root.
- Strict shared request/result/snapshot DTOs and runtime validators.
- Independently authorized settings-window and read-only main-window routes.
- Atomic snapshot replay/subscription/order/unsubscribe behavior.
- Exactly-one-call save/reset forwarding, including write-only prompt mutation.
- Delegated artifact, compatibility, load, unload, and managed-folder actions.
- Catalog-bound license-notice and provenance-reference viewing actions.
- Provider-dispatch/cache pre-gate and commit-on-main-success provider selection.
- Focused main/preload/renderer/composition/security/race/privacy tests.

## Out Of Scope

- React settings/status layout, field widgets, progress presentation, or
  accessibility implementation.
- Settings/catalog/inventory repositories, coordinator state machines, engine
  workers, device probing, artifact filesystem/network work, packaging/signing,
  or publishing.
- Renderer filesystem/process/network authority, raw coordinator exposure,
  custom paths/URLs/executables/hashes, or a second settings/state owner.
- macOS execution or any representative Windows execution before Task 19.

## Task Contract

### Three typed surfaces

Register only these surfaces:

1. **Provider dispatch**: main-owned transcription dispatch consumes the
   committed `local-whisper` provider selection, runs Task 14's eligibility
   pre-gate before any cache lookup, and delegates one canonical request.
2. **Settings window**: query/subscription plus explicit save, reset, download,
   resume, cancel, retry, remove/delete, check compatibility, load, unload, open
   managed folder, view license notice, open provenance reference, and
   provider-selection commands.
3. **Main window**: read-only sanitized provider/status subscription and settings
   shortcut. It cannot mutate settings, prompt, artifacts, capability, residency,
   or provider selection.

Do not register a second Local Whisper provider ID, metadata/readiness union,
settings schema, repository, coordinator, or event bus. Shared contracts remain
closed exact-key unions and are decoded from `unknown` before use.

### Exact sender capability

Main authenticates every call and subscription independently against the exact
currently owned `WebContents`, expected top-level frame, live
`ProviderSettingsWindowController` capability, and approved URL/origin. The main
window receives a distinct read-only capability. A process ID, once-trusted
window, URL string alone, or main-window ownership never authorizes settings
commands.

Reject before any effect: stale/reloaded/replaced/closed/nested/foreign senders,
substituted frames, prototypes, unknown/duplicate keys, unsafe numbers, malformed
epochs/revisions, forged IDs, paths, URLs, hashes, executables, argv, runtime
bindings, device data, or unsupported actions. Window reload/replacement/close
revokes the old capability and removes every old subscriber.

### Renderer-safe snapshot DTO

Project one immutable DTO containing only:

- strictly increasing `snapshotRevision`, configuration/inventory epochs, and
  stable logical catalog/selection IDs;
- sanitized bounded labels, availability/tier/reason, selected-but-unavailable,
  default/recommended/saved markers, remembered dependent selections, and field
  validation issues;
- approximate six-family RAM/VRAM ranges, exact matching selected estimate,
  qualified peak when present, and exact-estimate-unavailable state;
- sanitized storage label/count/size and artifact action/progress states;
- sanitized catalog-issued license-notice/provenance-reference IDs and bounded
  labels associated with their exact artifact kind, ID, and revision;
- support/setup/capability/residency/activity/readiness, stable failure code,
  retryability, recovery action ID, and reviewed bounded prerequisite/version
  labels.

Expose only `hasInitialPrompt`, never prompt text. Never include model/runtime
paths, managed roots, URLs, download headers, executable/library/dependency data,
raw errors/stderr, environment, native ordinal/HANDLE/fd, salt/HMAC input,
PCI/UUID/LUID, registry fingerprint, authority/proof, allocation address, child
model names, NTSTATUS, or raw device-node data.

Subscription registration is atomic: main installs the subscriber and returns
the current snapshot as one operation so no revision can be lost between replay
and events. Later revisions are strictly increasing. The renderer adapter ignores
duplicate/stale/out-of-order events. Unsubscribe/reload/replacement/close removes
only that subscription; process-owned downloads and workers remain owned by the
coordinator.

### Exactly one atomic save/reset call

The settings IPC request contains a complete public candidate for save or the
reset discriminator, expected configuration/inventory epochs, and for save
exactly one prompt mutation: `unchanged`, `clear`, or `replace(candidate)`.
Prompt replacement is bounded by the canonical shared prompt validator; prompt
text is never returned by query/snapshot/result.

After sender and outer closed-shape decoding, the handler constructs exactly one
Task-14 `SaveSettings` or `ResetSettings` command and calls
`coordinator.applySettingsTransaction(command)` exactly once. It then returns
that exact typed result/snapshot. The IPC layer must not:

- read or write the settings/prompt repository directly;
- call unload/load before or after the transaction;
- merge prompt state independently;
- normalize defaults or resolve catalog/device/artifact IDs independently;
- increment epochs, invalidate capability/cache, publish snapshots, retry, or
  split reset into multiple calls.

Task 14 remains authoritative for field/cross-field validation, current catalog/
inventory resolution, conflict/epoch checks, unload/persistence/activation, and
resulting state. `INVALID_SETTINGS`, `STALE_CONFIGURATION`,
`OPERATION_CONFLICT`, persistence failure, or unload-related failure leaves the
prior committed settings/provider visible; the renderer keeps its draft. IPC
never converts failure into a successful no-op.

### Other privileged commands

Each download/resume/cancel/retry/remove/delete/check/load/unload command accepts
only catalog-issued logical IDs, expected epochs/revision, and a closed action
discriminator. Main delegates one command to the Task-14 coordinator port; it
does not resolve renderer-controlled paths or perform an adjacent operation.

Download never loads. Check never downloads or loads. Load never downloads.
Removal obeys exact confirmation, conflict, lease, unload, and managed deletion
rules. `Open managed folder` accepts no path: main resolves the fixed managed
root through Task 04, revalidates it, invokes the existing privileged folder
adapter, and returns only a safe result/storage label.

License and provenance actions use one closed union:

```text
ViewArtifactReference {
  kind: viewLicenseNotice | openProvenanceReference,
  artifactKind,
  artifactId,
  artifactRevision,
  referenceId,
  expectedCatalogRevision
}
```

The renderer receives only stable IDs and sanitized labels issued by the
current snapshot. It submits the IDs, not labels; labels are presentation data
and never authority. After the same exact trusted-sender validation used for
every settings command, main resolves the IDs against the current authenticated
catalog row and rejects a stale catalog/artifact revision, forged or unknown
ID, and an ID belonging to a different artifact. Main then invokes only the
app-owned notice viewer or the privileged allowlisted reference adapter selected
by the authenticated row.
The result contains only a typed success/failure and refreshed sanitized
snapshot facts. It never returns a URL, filesystem path, notice file, redirect,
shell command, or raw provenance payload. Task 16 consumes this DTO/action and
must not invent another IPC route or privileged resolution path.

### Provider selection and dispatch

Keep renderer pending choice separate from authoritative committed provider.
Selecting `local-whisper` or another known provider sends one typed main request.
Main validates the provider ID, delegates provider-switch constraints and
required idle unload to the coordinator/registry transaction, commits through
the existing provider settings owner, and returns the committed provider ID plus
sanitized readiness revision. Renderer changes its committed selection only to
the returned success value.

On stale sender, `OPERATION_CONFLICT`, persistence failure, unload failure, or
any other error, the previous provider remains selected and visible. Never map
Local Whisper readiness to login, API key, authentication, or remote-provider
not-configured UI.

Provider dispatch calls the Local Whisper eligibility gate before cache lookup.
Known unsupported/missing/corrupt/blocked/incompatible/resource failures cannot
use cache or another provider. The dispatch boundary receives no renderer path,
native device proof, or worker primitive.

### Composition and lifecycle

The process composition root constructs one coordinator and injects it into the
provider adapter and IPC controller. Startup loads normalized settings/catalog/
inventory and publishes an initial snapshot without probing, downloading,
spawning, allocating, or loading. No module-level mutable singleton/container is
introduced.

Settings/main window creation grants only its exact capability. Application
shutdown revokes new IPC/subscriptions, unregisters handlers, and delegates one
bounded coordinator shutdown exactly once. Sanitize unexpected exceptions at
main. IPC/audit/log failure cannot alter provider behavior or leak raw values.

## Contracts And Boundaries

- Task 01 owns canonical shared Local Whisper IDs/settings/state/failure types.
  Task 15 adds only transport DTOs and validators needed at the process boundary.
- Task 02 owns provider registration, `localRuntime` metadata/readiness,
  dispatch/cache ordering, and provider construction interface.
- Tasks 03–05 own settings/catalog/inventory/artifact storage and privileged
  filesystem/network behavior. Task 15 never calls their repositories/adapters
  except the narrowly authorized managed-folder action and authenticated
  catalog-reference resolution needed to invoke the app-owned notice viewer or
  privileged allowlisted reference adapter.
- Task 14 is the sole mutable state and command authority. Save/reset invoke
  exactly one `applySettingsTransaction`; other stateful actions invoke one
  coordinator command. IPC never orchestrates lifecycle itself.
- Later UI code consumes only `window.electronAPI`, sanitized DTOs, and local
  draft state. Main-window status is read-only.
- Task 19 alone executes representative Windows application/IPC/package/hardware
  flows. Task-15 deterministic sender/DTO/composition tests make no platform or
  hardware claim.
- Renderer/preload never receives Node/Electron objects, repositories, services,
  paths, URLs, credentials, native authorities, or private diagnostics.

## Expected Files Or Components

- Shared strict Local Whisper IPC command/result/snapshot types and runtime
  validators.
- Main IPC controller, exact sender-capability adapters, subscription registry,
  and safe error projector.
- Catalog-bound artifact-reference action validator, authenticated resolver,
  app-owned notice-viewer adapter, and privileged allowlisted reference adapter.
- Narrow preload API methods/events and matching renderer declarations.
- Renderer service adapter for snapshot revision reconciliation and provider
  commit-on-main-success behavior.
- Main-process composition-root/provider-registry/window lifecycle wiring.
- Focused shared/main/preload/renderer/composition/security/privacy/race tests.
- Package scripts: `test:local-whisper:ipc`,
  `test:local-whisper:composition`, and `verify:local-whisper:ipc`.

## Acceptance Criteria

- Only the exact live settings-window capability can invoke settings routes; the
  exact main-window capability receives only read-only status. Every stale,
  substituted, nested, or foreign sender fails before effect.
- `AC-AUTO-003`: strict external decoding and exact main delegation reject all
  malformed commands without privileged side effects.
- `AC-AUTO-025`: snapshot subscription/replay is atomic, revisions are strictly
  ordered, and unsubscribe/reload/replacement/close removes the exact listener.
- `AC-AUTO-059`: save/reset/provider-switch/stale/conflict fixtures preserve
  path/prompt-free DTOs and commit only main-authoritative success.
- Each save and reset request calls `applySettingsTransaction` exactly once;
  tests fail on zero, duplicate, repository, unload, prompt, epoch, or snapshot
  side calls.
- Snapshots/results contain the complete sanitized UI facts and none of the
  prohibited path/prompt/native/private fields.
- Artifact/check/load/unload/open-folder commands accept only closed logical
  actions and cannot trigger adjacent operations or renderer-controlled
  filesystem/network behavior.
- License/provenance actions accept only snapshot-issued logical IDs, resolve
  them against the current authenticated catalog row, and reject stale, forged,
  unknown, or cross-artifact references before an effect. Their results expose
  no URL, path, notice file, redirect, shell command, or raw provenance payload.
- Startup snapshot/query creates no probe, worker, download, model load, or
  allocation. Shutdown delegates coordinator cleanup exactly once.
- Provider selection remains prior committed value on every failure and never
  displays an authentication prompt for Local Whisper.
- No representative Windows command is executed before Task 19.

## Verification

Run exactly with deterministic injected coordinator/window/repository fakes:

```text
rtk npm run test:local-whisper:ipc
rtk npm run test:local-whisper:composition
rtk npm run verify:local-whisper:ipc -- --profile=deterministic
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check
```

The verification commands must cover sender substitution, frame/origin changes,
prototype/unknown/unsafe payloads, atomic replay/order/unsubscribe, exact
save/reset call count, prompt mutations, stale epochs, load-affecting conflicts,
artifact action isolation, provider-switch failure, startup/shutdown, preload
parity, license/provenance sender and catalog-binding rejection, safe privileged
adapter invocation, explicit stale/forged/unknown/cross-artifact fixtures,
prohibited return-field absence, and DTO privacy. Define any Windows packaged-
app IPC smoke for Task 19; do not invoke it here.

## Failure And Rollback

- If sender authorization, exactly-once coordinator delegation, DTO privacy,
  subscription order, or composition cleanup cannot be proved, keep Local
  Whisper unreachable from renderers; never broaden the preload or expose a raw
  service as a workaround.
- Roll back only Task-15 routes/DTOs/preload/renderer adapters/composition wiring.
  Preserve coordinator state, persisted settings/prompt, catalogs, inventory,
  artifacts, workers, and all user/managed data.
- Do not weaken trusted IPC, validation, epoch, or transaction semantics to make
  UI/integration fixtures pass.

## Manual Gates

- None for deterministic packet completion.
- Representative Windows packaged-app IPC/provider/lifecycle execution is
  exclusively Task 19.
- No source import, real artifact acquisition, signing, upload, publication,
  commit, push, PR, tag, release, or external communication authority.

## References

- Mandatory task-local contract: `../spec.md` Sections 7.1, 8.6–8.8, 10.5,
  15–17; acceptance `AC-AUTO-003`, `AC-AUTO-025`, `AC-AUTO-059` and supporting
  `AC-AUTO-002`, `AC-AUTO-007`, `AC-AUTO-036`, `AC-AUTO-037`, `AC-AUTO-044`,
  `AC-AUTO-045`, `AC-AUTO-049`.
- Task dependency: `14_capability_coordinator_residency_and_lifecycle.md`.
- Existing project trusted IPC, provider-selection, preload-parity, and window
  ownership precedents named in `docs/agent-guides/project-conventions.md`.

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with routes/DTOs/
composition changes, exact tests, privacy/sender evidence, deferred Windows
smoke, and next eligible UI packet. Present Task 15 for review and stop. Do not
start UI work, commit, push, package, publish, or execute Windows.
