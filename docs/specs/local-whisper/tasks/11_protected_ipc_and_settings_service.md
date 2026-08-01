# 11 Protected IPC And Settings Service

## Outcome

Local Whisper's existing provider, catalog, artifact, capability, and
coordinator contracts are connected to one protected renderer surface. A
main-owned IPC controller validates every renderer command authoritatively,
delegates settings save/reset and state ownership to the packet-10
coordinator, bridges its sanitized ordered snapshots, and rejects every
privileged command whose sender is not the exact Local Whisper
provider-settings window.

Packet 02 already owns the provider ID and real `localRuntime` metadata/readiness discriminator. Packet 03 already owns the private versioned repository, schema migration, defaults, and atomic persistence. This packet consumes both contracts; it must not register a second provider/metadata union or create a second settings repository.

## Prerequisites

- The Local Whisper plan is approved and Task 11 has separate execution
  authorization.
- Packet [01 Shared Domain Contracts](./01_shared_domain_contracts.md) is complete. Reuse its canonical Local Whisper enums, state machines, failure union, artifact identities, and renderer-safe snapshot shapes; do not define parallel domain unions.
- Packet [02 Provider Dispatch And Cache](./02_provider_dispatch_and_cache.md) is complete. Consume its canonical provider ID, `localRuntime` metadata/readiness branch, `canAttempt` semantics, and dispatch port without redefining them.
- Packet [03 Trusted Catalog, Settings, And Inventory](./03_trusted_catalog_settings_and_inventory.md) is complete. Consume its canonical types and coordinator-facing behavior through packet 10; do not inject or call its `LocalWhisperSettingsRepository` from this IPC packet.
- Packet [05 Streaming Artifact Lifecycle](./05_streaming_artifact_lifecycle.md) is complete. IPC commands delegate download/install/remove work to that process-owned service.
- Packet [09 Device Capability Validation](./09_device_capability_validation.md) is complete. IPC reads and commands delegate probing to that service and expose only its sanitized result.
- Packet [10 Coordinator Residency And Lifecycle](./10_coordinator_residency_and_lifecycle.md) is complete. Consume its authoritative settings command/query/event port, coherent sanitized snapshots, and monotonic epochs. The coordinator alone owns save/reset orchestration, active normalized settings, `configurationEpoch`, and snapshot publication.
- Read the Electron, provider, privacy, and state-management sections of [project conventions](../../../agent-guides/project-conventions.md) before implementation.
- Inspect only the current contracts directly involved in this packet: `src/shared/voiceProvider.ts`, `src/main/ipc.ts`, `src/main/preloadApi.ts`, `src/main/preload.ts`, `src/renderer/types.d.ts`, `src/main/providerSettingsWindowController.ts`, `src/main/window.ts`, the composition root, and their focused tests.
- The specification is approved as `APPROVAL-001`; this packet does not reopen product choices.

## Owned Requirements

Primary requirement ownership:

- `IPC-001`, `SEC-001`, `ARCH-004`, `IPC-002`: main retains all privileged authority; preload and renderer receive a typed, sanitized API; every call is sender- and payload-validated.
- IPC validation/delegation portions of `SET-004`, `SET-006`, `SET-007`,
  `VAL-001`, and `VAL-003`: validate external commands, preserve private prompt
  mutation semantics, and delegate one canonical command to packet 10. Packet
  10 owns activation/epochs; packet 03 owns persistence/default/migration.
- IPC portions of `LIFE-004`: forward expected epochs, preserve exact stale or
  conflict results, and never queue or partially apply a command. Packet 10
  owns classification, unload/commit/activation, immutable request epochs, and
  worker lifecycle behavior.
- IPC/snapshot integration portions of `CAP-001`, `CAP-011`, `LIFE-005`, and `UI-006`. Packet 02 owns provider metadata/readiness/dispatch; packets 09 and 10 own probe and residency behavior.
- Snapshot-bridge portions of `MODEL-010`, `CAP-013`, and `UI-007`; packet 01
  owns family guidance, packet 03 owns catalog validation, and packets 09/10
  own exact resource selection and state.
- Prompt projection and IPC privacy portions of `PRIV-002`, `SEC-002`, `DIAG-001`, and Sections 15-17. Packet 03 owns prompt persistence.
- Section 14's expected configuration/inventory epoch fields and exact result
  forwarding at the IPC boundary.

Acceptance ownership:

- Full packet ownership: `AC-AUTO-003`, `AC-AUTO-025`.
- Transaction/IPC integration slices: `AC-AUTO-002`, `AC-AUTO-007`, `AC-AUTO-036`, `AC-AUTO-037`, `AC-AUTO-044`, and `AC-AUTO-045`.
- Renderer-safe DTO bridge slice of `AC-AUTO-049`.

## In Scope

- Consume packet 02's `localRuntime` provider/readiness contract and packet 01's canonical Local Whisper settings/state types; add only the renderer-safe command, result, event, and subscription DTOs not already supplied by those packets.
- Implement one main-owned Local Whisper IPC controller over packet 10's
  command/query/event port. It owns sender/payload validation and subscription
  lifecycle only; it does not own settings state or transaction serialization.
- Implement authoritative external-command validation and private prompt
  write-only mutation forwarding. Pass the complete candidate and expected
  epochs once to packet 10; return its exact save/reset result and snapshot
  without recomputing sequencing, epochs, defaults, or readiness.
- Implement exact Local Whisper provider-settings sender ownership in `ProviderSettingsWindowController` and require it for every privileged Local Whisper settings/artifact/capability/residency command.
- Preserve the six-family approximate guidance plus matching
  selected-configuration estimate, qualified peak, basis/methodology label,
  and exact-estimate-unavailable state in sanitized snapshots without
  recomputing or accepting them from renderer input.
- Register additive IPC handlers, preload methods, renderer declarations, safe snapshot subscription/unsubscription, and composition-root lifecycle cleanup.
- Route commands to the catalog, inventory, artifact, capability, and coordinator services supplied by prerequisite packets; do not reimplement them.
- Remove any successful no-op path for an unknown or unhandled editable provider. Local Whisper and malformed provider IDs must be handled explicitly and exhaustively.
- Add focused command-validation, IPC authorization, preload parity,
  privacy-projection, event-bridging, and epoch-pass-through tests using an
  injected fake packet-10 coordinator port.

## Out Of Scope

- React fields, layout, validation presentation, artifact rows, progress UI, confirmation dialogs, or main-window toolbar changes; packets 12 and 13 own those.
- Provider registration, provider ID, `localRuntime` metadata/readiness union, dispatch/cache ordering, or provider construction; packet 02 owns those.
- Settings repository implementation, schema/defaults, migration/downgrade handling, owner-private file creation, atomic replacement, unknown-field preservation, or repository unit tests; packet 03 owns those.
- Settings transaction ordering, repository commit/reset, lifecycle
  classification, configuration/snapshot epoch increments, readiness
  derivation, or coherent snapshot composition; packet 10 owns those.
- Download transport, hashing, extraction, promotion, quarantine deletion, catalog signing, or filesystem-containment implementation; packets 03-05 own those.
- GPU/CPU enumeration, capability probes, worker spawn, model load/warm-up, transcription, or resource release; packets 06-10 own those.
- New dependencies, renderer filesystem access, arbitrary storage selection, raw native diagnostics, or any renderer-supplied URL/path/hash/executable/argv.
- Migration of unrelated provider settings or authentication data.
- macOS executable catalogs, downloads, spawn, load, or inference. Only typed `metal`/Planned results pass through this surface.
- Plan, todo, handoff, commit, push, PR, release, or publication changes during implementation except the completion updates explicitly required below.

## Task Contract

### Consumed settings contract and command validation

Use packet 01's canonical enums/normalizer and packet 10's sanitized settings
snapshot without copying either schema. The IPC controller receives untrusted
renderer command payloads, validates them from `unknown`, and passes only one
canonical candidate plus expected epochs to the coordinator command port.
Recognized incomplete selections may remain persisted and Not ready after the
coordinator accepts them, but no incomplete value may reach a worker request.

Authoritative IPC validation covers these values and constraints; defaults and remembered-profile initialization remain packet-03 repository behavior:

| Value                  | Canonical rule                                                                                                                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine                 | `whisperCpp` or `fasterWhisper`; default `whisperCpp`.                                                                                                                                                                                       |
| Target                 | `gpu` or `cpu`; default `gpu`; never `auto` and never implicit fallback.                                                                                                                                                                     |
| Backend                | `cuda`, `hip`, `vulkan`, `metal`, or `cpu`. `cpu` is valid only for CPU; `metal` is typed but Planned/unavailable. A recognized unset GPU backend is an incomplete selection, not an arbitrary enum.                                         |
| Device                 | A main-issued opaque ID or recognized unset value. Never persist a serial/UUID. An already selected, disappeared device remains selected and unavailable; arbitrary renderer IDs are invalid.                                                |
| Runtime revision       | Exact immutable catalog revision for `(engine, target, backend)`; initialize a never-seen key from the app-pinned `recommendedRevision`; never auto-advance an existing key.                                                                 |
| Model family           | `tiny`, `base`, `small`, `medium`, `large-v3`, or `large-v3-turbo`; initial family `base`. Family guidance and exact memory evidence are read-only snapshot data, never renderer-settable settings.                                          |
| Model revision/variant | Exact catalog revision for `(engine, family)` and a reviewed variant; initialize a never-seen family to its recommendation and `full` when present. Missing selected revisions remain selected.                                              |
| Language               | `auto` or one canonical ID in the pinned common language catalog; engine aliases/free text are invalid.                                                                                                                                      |
| Initial prompt         | Private persisted Unicode text, at most 1,000 Unicode code points; NUL, invalid scalar sequences, truncation, trimming, and normalization are forbidden. The renderer snapshot exposes presence only, never the stored value.                |
| Temperature            | Safe integer `temperatureHundredths` from `0` through `100`, divisible by `5`; default `0`. Main never parses locale decimal text.                                                                                                           |
| Precision              | Faster-Whisper CUDA: `float16` or `int8_float16`, default `float16`; Faster-Whisper CPU: `int8` or `float32`, default `int8`; absent for `whisperCpp` and unsupported combinations. A runtime manifest may narrow but not expand these sets. |
| Strategy               | `greedy`, `beamSearch`, or `bestOfSampling`; default `greedy`.                                                                                                                                                                               |
| Beam/best-of           | Safe integer `1..10`. Only `beamSize` is active for `beamSearch`; only `bestOf` is active for `bestOfSampling`; inactive controls are absent from normalized settings/worker requests.                                                       |
| CPU threads            | `auto` or a safe integer `1..detectedLogicalProcessors`; CPU target only; default `auto`. Main's current detected upper bound is authoritative.                                                                                              |

Enforce the decoding combinations exactly:

- `greedy`: temperature `0`; no beam size or best-of.
- `beamSearch`: temperature `0`; beam size `1..10`; no best-of.
- `bestOfSampling`: temperature `5..100` divisible by `5`; best-of `1..10`; no beam size.
- Return one cross-field validation result; never repair one field by silently changing another.

The coordinator snapshot exposes choices remembered by packet 03 under these
packet-01 stable semantic keys, never display labels or array positions:

- runtime/backend/device/precision preferences by `(engine, target, backend)` where applicable;
- selected device by `(engine, backend)`;
- model family by engine;
- model revision and variant by `(engine, model family)`;
- CPU threads by engine;
- shared request controls independently of engine.

The IPC controller must not recalculate those keys or defaults. It consumes the
current coordinator snapshot, validates that renderer values are
canonical/main-issued for the captured catalog and inventory epochs, and
delegates the complete candidate back to the coordinator. Parent switching,
0/1/N initialization, future-schema handling, and missing-selection
preservation are consumed results, not reimplemented here.

### Coordinator command boundary

- Constructor-inject packet 10's narrow Local Whisper command/query/event port;
  do not inject packet 03's repository or add another persistence adapter,
  schema module, lifecycle lock, state store, or migration.
- Reading settings or a snapshot calls the coordinator query port only and
  remains side-effect-free: no deep probe, network, download, spawn, load, or
  allocation.
- Treat the coordinator snapshot as the authority for defaults, remembered
  profiles, repair reasons, unknown supported-version fields, newer-version
  read-only state, prompt presence, epochs, and readiness.
- A stored prompt appears only as `hasInitialPrompt`-style presence. Saving uses
  `unchanged` / `replace` / `clear`; only `replace` carries new prompt text from
  the exact settings renderer to the coordinator command. Main never returns
  or echoes that text.
- Validate inbound prompt mutation before the coordinator call. Never log,
  audit, diagnose, export, filename, argv, or URL the prompt, and never include
  it in a result detail.
- Forward `SETTINGS_VERSION_UNSUPPORTED`, validation, stale, conflict, commit,
  cleanup, and reset results from the coordinator unchanged. Do not apply
  defaults, retry, migrate, unload, commit, increment an epoch, or synthesize a
  second snapshot.
- After exact-sender/payload/epoch validation, reset invokes the coordinator's
  single `resetSettings` command. The coordinator—not this controller—clears
  settings/prompt and leaves artifacts/downloads untouched.

### Command validation and epoch forwarding

- Own only the IPC controller and exact-sender subscription registrations in
  the process composition root. Do not construct a second mutable settings or
  lifecycle service at module scope or elsewhere.
- Validate renderer payloads as `unknown`; check exact shape, enum/catalog
  membership, safe integers, Unicode/code-point limits, main-issued
  device/artifact IDs, current detected CPU bound from the snapshot, and
  cross-field rules before any coordinator command.
- Reject the complete command on validation failure with zero coordinator,
  repository, filesystem, process, or epoch effect. A recognized incomplete or
  unsupported candidate is forwarded once and remains subject to coordinator
  validation.
- Forward a save candidate, prompt mutation, and expected configuration/
  inventory epochs exactly once to coordinator `saveSettings`. Do not classify
  fields, acquire a lifecycle lock, unload, commit, activate, or increment
  `configurationEpoch`; packet 10 owns that complete transaction.
- An app-shipped adapter may make a field load-affecting only through packet
  10's canonical classification and result. This IPC layer does not maintain a
  second classification list.
- Return the coordinator's safe result and attached snapshot unchanged. Every
  mutating command carries expected epochs; stale/conflict results perform no
  retry or hidden refresh-and-resubmit.

### Consumed local-runtime readiness and snapshot projection

- Consume packet 02's existing `localRuntime` readiness discriminator and `canAttempt` semantics. Do not edit provider registration or introduce another metadata/readiness union.
- Forward packet 10's already coherent sanitized snapshot and monotonic revision
  without composing repository/capability/residency fragments or minting a new
  snapshot epoch. Preserve canonical discriminants and the safe reason/recovery
  tuple byte-for-byte at the typed DTO boundary.
- Preserve packet 01's exact six-family approximate RAM/VRAM guidance and the
  packet-10 selected-configuration projection: matching catalog estimate,
  separate qualified peak, evidence/methodology label, CPU VRAM
  `notApplicable`, and `Exact estimate unavailable`. Do not infer a value from
  artifact size, reuse a stale record, calculate headroom, or accept any of
  these read-only values from an inbound renderer command.
- `Ready`, `Busy`, `Validated · Unloaded`, Not ready, Planned, Unsupported, and
  `canAttempt` remain derived by their owner packets and assembled by packet 10. This controller only bridges current snapshots/events.
- No projected Local Whisper state may enter login, API-key, or browser-session behavior, and no authentication material is read, written, cleared, or requested.

### IPC and preload surface

Expose additive, explicitly named operations for:

- read Local Whisper snapshot;
- save and reset settings;
- subscribe/unsubscribe to sanitized Local Whisper snapshot/progress changes;
- refresh device inventory and check compatibility;
- download/resume/cancel/retry/remove a typed runtime artifact;
- download/resume/cancel/retry/delete a typed model artifact;
- load now and unload;
- ask main to open the managed storage folder by command ID.

For every operation:

- Accept only canonical setting values, the explicit prompt mutation, opaque main-issued device IDs, typed catalog artifact IDs, operation IDs, and expected epochs. Never accept a path, URL, origin, executable, argv, environment value, hash, native device structure, or arbitrary revision string. Prompt text is permitted only inside the validated inbound `replace` mutation and is never returned in a snapshot/result/event.
- Resolve every privileged value in main from authenticated catalogs/repositories.
- Return the packet-01 typed result: stable code, stage, retryability, recovery action ID, safe identity when relevant, and current sanitized snapshot. Never serialize raw exceptions.
- Register one exact sender guard that proves the event's live `webContents` belongs to the window currently registered for provider ID `local-whisper`. A generic trusted app window, a settings window for another provider, a stale/replaced window ID, the main window, and destroyed contents must all fail before payload resolution or privileged effect.
- Keep the existing general trusted-sender/origin validation as an additional check, not a replacement for exact provider-window ownership.
- Bind subscriptions to the exact sender and remove only that listener when the window closes, reloads, or unsubscribes. Closing the window must not cancel process-owned downloads or lifecycle work.
- Rate-limit/coalesce progress before IPC as supplied by packet 05, maintain monotonic snapshot ordering, and send no sensitive values.
- Expose the same method/result types from shared contract to preload implementation and `Window.electronAPI`; avoid duplicated handwritten shapes that can drift.
- Keep privileged services out of preload/renderer. Preload is a narrow invoke/subscription bridge only.

### Required tests

- Table-test every field boundary and malformed direct-IPC value, including non-safe/fractional/off-grid numbers, unknown union members, forged devices/artifacts, prompt lengths 0/1,000/1,001 code points, NUL, cross-field errors, and inactive control omission.
- With an injected fake packet-10 coordinator port, test that defaults, 0/1/N
  initialization, remembered keys, missing selections, future-schema states,
  epochs, and readiness are forwarded unchanged rather than recalculated.
- Assert the renderer DTO preserves every non-private canonical value and only
  prompt presence. Test `unchanged`, `replace`, and `clear` command forwarding,
  including no prompt in snapshots/results/events/errors.
- Assert all six family guidance records and exact estimate/qualified-peak
  discriminants cross preload unchanged, including CPU VRAM not applicable and
  exact-estimate unavailable. Forged inbound estimate fields are rejected or
  ignored as outside the command schema.
- For load-affecting, request-affecting, reset, stale, unload failure/conflict,
  and post-unload commit-failure results, assert exactly one coordinator call,
  exact expected epochs, unchanged returned snapshot, and zero repository or
  local epoch-owner construction in this packet.
- Test exact sender ownership with main window, another provider's settings window, stale window IDs, forged catalog/device IDs, and a valid current Local Whisper window. Spy before repository/filesystem/process services to prove rejected calls have zero privileged effects.
- Test event order, unsubscribe/window close, and reopening against a process-owned continuing fake download.
- Regression-test that packet 02's supplied local-runtime readiness is forwarded unchanged and no projected state enters an auth/login branch.

## Contracts And Boundaries

- Electron main is the only owner of filesystem, process, GPU/CPU, catalog, download, inventory, capability, and residency authority.
- Renderer-safe data must exclude absolute paths, usernames, URLs, request headers, executable/library names, argv/environment, hashes/signatures, raw native errors, stdout/stderr, prompts, audio, transcripts, serials, and full device UUIDs.
- A sanitized storage label/app-relative description and aggregate/per-artifact byte counts are allowed. Folder opening is a main-only action with no returned path.
- Configuration, inventory, and snapshot epochs are monotonic process-local
  concurrency tokens owned by packet 10, not persisted truth. This IPC layer
  validates/forwards expected values and never increments or republishes them.
- Settings validation is authoritative in main even when renderer validation already passed.
- No localRuntime branch may read, write, clear, or request authentication material.
- Download/probe/coordinator services remain process-owned after the settings window closes.
- Preserve strict TypeScript, existing provider behavior, trusted sender validation, and the existing renderer-only `window.electronAPI` boundary.

## Expected Files Or Components

Exact names may be adapted only to the canonical modules established by packets 01-10. Do not create duplicate provider, settings, readiness, or repository contracts.

- Consume without redefining:
  - packet 01's canonical Local Whisper settings/state/failure modules;
  - packet 02's provider ID and `localRuntime` metadata/readiness types;
  - packet 10's coordinator command/query/event port and sanitized snapshot;
  - packet 03 repository types only through packet 10, never as an injected
    IPC dependency.
- Add main IPC/controller components:
  - `src/main/localWhisperIpcController.ts`
  - a pure Local Whisper IPC command validator if packet-01 guards do not
    already provide the exact boundary
  - `src/main/providerSettingsWindowController.ts`
  - `src/main/ipc.ts`
  - `src/main/window.ts`
  - the packet-10 coordinator and process composition-root wiring
- Preload/renderer contract:
  - `src/main/preloadApi.ts`
  - `src/main/preload.ts`
  - `src/renderer/types.d.ts`
  - renderer API contract declarations only; packet 02's localRuntime discriminator is consumed unchanged
- Focused tests under `tests/main/localWhisper/ipc` and renderer API contract
  tests, covering command forwarding with a fake packet-10 coordinator,
  external payload validation, exact sender ownership, preload parity,
  prompt/privacy projection, epoch pass-through, and subscription disposal. Do
  not add transaction/repository/state-machine tests owned by packets 03/10.

## Acceptance Criteria

- A snapshot read consumes packet 10's current coherent safe snapshot without
  creating a second repository/state store or invoking probe/download/worker/
  allocation work.
- Every invalid direct IPC payload is rejected before coordinator/repository
  effects, including a 1,001-code-point replacement prompt and unsafe/off-grid
  numerics. A valid candidate is sent exactly once only to packet 10.
- Defaults, remembered/missing selections, repair state,
  `SETTINGS_VERSION_UNSUPPORTED`, transaction failures, epochs, and readiness
  pass through unchanged; this controller performs no migration, repair,
  lifecycle sequencing, epoch increment, or snapshot composition.
- Load- and request-affecting saves plus reset return exactly the coordinator
  result. Focused tests prove no parallel transaction/epoch/snapshot owner is
  constructed by this packet.
- All privileged Local Whisper calls from any sender other than the exact current Local Whisper settings window fail before catalog resolution or side effects.
- Snapshot/event/command DTOs contain only the allowed renderer-safe data and preserve stable typed failures without raw exception text.
- Snapshot DTOs carry the exact six-family guidance and only the matching
  selected-configuration estimate/qualified peak; no stale record, ambiguous
  unit, or renderer-supplied estimate can become IPC authority.
- Closing the settings window disposes its listener but does not cancel a process-owned download; reopening obtains the current monotonic snapshot.
- Packet 02's Local Whisper metadata/readiness is forwarded coherently without asking for login/API key/session or defining another readiness union.
- Reset is forwarded once after exact validation; the coordinator's returned
  snapshot proves only provider settings/prompt changed and no artifact or
  download command was invoked.
- Existing providers and their settings/auth flows remain unchanged and all focused tests pass.

## Verification

Create focused test files with the final canonical names, then run the equivalent commands with those exact paths:

```bash
rtk node --import tsx --test tests/main/localWhisper/ipc/LocalWhisperIpcController.test.ts tests/main/providerSettingsWindowController.test.ts tests/main/preloadApi.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk lint
rtk prettier --check src/main/localWhisperIpcController.ts src/main/providerSettingsWindowController.ts src/main/ipc.ts src/main/preloadApi.ts src/renderer/types.d.ts tests/main/localWhisper/ipc/LocalWhisperIpcController.test.ts
rtk git diff --check
```

If implementation uses different packet-01 canonical filenames, replace only the path arguments; do not omit the corresponding tests. Record concise pass/fail summaries in `tasks/handoff.md`, not raw logs.

## Failure And Rollback

- On parse/payload validation failure, do not call the coordinator. On any
  coordinator validation, commit, unload, epoch, or conflict failure, return
  its specific safe result and attached truthful snapshot unchanged; do not
  retry or present rollback-loaded state.
- On listener failure or window close, detach only that renderer subscription. Do not stop a shared operation.
- If packet 10 reports packet-03 repository/schema/containment failure,
  propagate its read-only/Not-ready typed state; do not call the repository,
  relocate, migrate, or weaken the boundary.
- If preload/main/renderer type parity cannot be maintained, stop and repair the shared contract; do not cast through `unknown` or expose the service object.
- Roll back implementation by reverting only IPC/preload integration and
  focused tests owned here. Do not alter packet-02 provider metadata, packet-10
  coordinator state, remove packet-03 repository, delete user settings/
  artifacts, or run a migration as rollback.
- If a prerequisite packet lacks a required canonical type/service, mark packet 11 blocked in `todo.md`/`handoff.md` and return to planning. Do not reconstruct that prerequisite here.

## Manual Gates

- No GPU, AMD, Apple Silicon, real model, credential, or network access is required for this packet; use fakes and temporary private directories only.
- Before completion, manually inspect the registered IPC channel list and one serialized success and failure snapshot to confirm that no path, URL, executable, argv, hash, native error, prompt, audio/transcript, serial, or UUID crosses IPC.
- In an Electron development smoke check, prove that the Local Whisper settings window can call the safe snapshot API while the main window and another provider's settings window cannot invoke privileged Local Whisper commands. Do not perform downloads or load a model.
- Release/hardware gates remain in packet 16 and must not be claimed by this packet.

## References

- Authoritative specification anchors: `../spec.md` Sections 4, 7.1,
  8.1-8.6 including 8.1.1, 9.2, 10.5, 14-17.1, and acceptance criteria `AC-AUTO-002`, `003`,
  `007`, `025`, `036`, `037`, `044`, and `045`. Packet-02-owned
  `AC-AUTO-035` and packet-03-owned `AC-AUTO-001`/`AC-AUTO-029` are
  consumed regression assertions only, not packet-11 ownership. This packet
  owns the DTO-bridge slice of `AC-AUTO-049`.
- Approved decisions: `architecture.runtime-ownership`, `current.electron-boundaries`, `current.provider-metadata`, `current.provider-settings-contract`, `acceptance.device-capability-validation`, `settings.normalized-defaults`, `settings.dependent-selection-keys`, `settings.initial-prompt-persistence`, `compatibility.common-language-catalog`, `architecture.runtime-state-separation`, `operations.cancel-switch-exit`, and `resources.model-estimate-presentation` in `../decisions.yaml`.
- Mandatory project rules: repository `AGENTS.md` and the Electron/provider/privacy/state sections of `docs/agent-guides/project-conventions.md`.
- Local precedents: packet 10's coordinator command/query/event port,
  `src/main/providerSettingsWindowController.ts`, `src/main/preloadApi.ts`,
  `src/renderer/types.d.ts`, and focused tests.
- Dependency packets: [01](./01_shared_domain_contracts.md), [02](./02_provider_dispatch_and_cache.md), [03](./03_trusted_catalog_settings_and_inventory.md), [05](./05_streaming_artifact_lifecycle.md), [09](./09_device_capability_validation.md), and [10](./10_coordinator_residency_and_lifecycle.md).

## Completion And Handoff

- Implement and verify only packet 11.
- Mark only packet 11 complete in `tasks/todo.md` after every automated check and manual packet gate passes.
- Update `tasks/handoff.md` with the exact changed files, concise verification results, known limitations, and packet 12 as the next packet.
- Present the packet for review and stop. Do not commit, push, open a PR, publish, or begin packet 12 without a later explicit incremental-implementation authorization.
