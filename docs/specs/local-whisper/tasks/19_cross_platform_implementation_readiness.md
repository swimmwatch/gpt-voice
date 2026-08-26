# Task 19: Cross-Platform Implementation Readiness

## Outcome

Finish Task 19 as a genuinely testable Local Whisper desktop feature, not only
as a static implementation-readiness report. Preserve and complete the existing
Windows/Linux CPU/CUDA production implementation, then make the ordinary
non-packaged Linux application usable through an explicit authenticated
development activation.

The completed packet must let the user perform all of the following through the
normal settings and provider flow:

- download every exact release-1 model anonymously from its pinned public
  Hugging Face object;
- observe progress and use resume, cancel, retry, verification, installation,
  selection, and removal actions;
- keep all six models installed and independently selectable for CPU and the
  available NVIDIA CUDA device;
- run one bounded end-to-end `base/full` transcription on CPU and one on CUDA,
  including compatibility check, full load, warm-up, normal completion, and
  unload.

Linux and Windows platform qualification must remain `Pending`. Task 19 freezes
no candidate, platform graph, result, evidence index, predecessor result, or
aggregate root and produces no Production verdict.

## Prerequisites

- Specification revision 14 and plan revision 18 are approved.
- Tasks 01–18 remain complete and committed; they are not reopened.
- The current uncommitted Task 19 static-readiness changes are preserved as the
  implementation baseline. Their previous completion claim is invalid until
  this revised packet passes.
- Task 17 fixture bytes remain unchanged with SHA-256
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- The Linux x64 test host has its available NVIDIA GPU/driver, CPU, public HTTPS
  access to the six exact Hugging Face objects, and sufficient managed storage
  for 3,902,189,602 model bytes plus staging, runtime packs, and safety margin.
- Exact CPU/CUDA runtime packs and native helper resources can be built from
  the already pinned network-denied source/toolchain inputs. Runtime bytes are
  served only from the task-owned loopback HTTPS development origin.
- Task 19 has separate execution authorization. That authorization covers only
  the exact anonymous public model GETs, task-local loopback runtime transfers,
  managed installation/removal, and bounded Linux CPU/CUDA smoke defined here.

## Owned Requirements

- Primary revised implementation ownership: `DEV-001`, `SEC-015`,
  `IMPL-001`–`IMPL-002`, `DL-004`–`DL-005`, `MODEL-001`–`MODEL-002`,
  `MODEL-005`, `ARCH-010`, `COMP-012`, `DIST-001`–`DIST-002`, `MODEL-011`,
  `PKG-011`, `SEC-014`, `REL-001`, `QUAL-001`–`QUAL-004`, `PRIV-005`, and
  `OPS-002`–`OPS-003`.
- Complete Windows/Linux production-path integration for all applicable
  architecture, catalog, transfer, filesystem, capability, worker, lifecycle,
  IPC, settings, UI, privacy, diagnostics, and packaging requirements already
  implemented by Tasks 01–18.
- Primary automated acceptance: `AC-AUTO-064`, `AC-AUTO-065`,
  `AC-AUTO-066`, `AC-AUTO-067`, `AC-AUTO-068`, `AC-AUTO-069`,
  `AC-AUTO-070`, `AC-AUTO-072`, `AC-AUTO-073`, `AC-AUTO-074`, and
  `AC-AUTO-075`.
- Primary manual functional acceptance: `AC-MAN-015`.
- `AC-MAN-001`–`AC-MAN-014` and every Linux/Windows platform qualification
  result remain owned by Tasks 20–22.

## In Scope

- Preserve and finish the existing deterministic implementation-readiness
  verifier, revision-aware plan validator, Windows/Linux platform mappings,
  native ownership contracts, strict transfer profiles, qualification-v2 DAG
  tooling, semantic Windows profile IDs, dependency repair, and scoped docs.
- Add strict main-owned parsing for exactly one
  `--local-whisper-development-activation=<absolute-path>` argument.
- Add a versioned canonical development activation descriptor and generator
  that bind the qualification catalog envelope, public keyring, allowlisted
  origins, loopback CA certificates, app revision, worker protocol, and one
  authenticated staged resources root without persisting private state.
- Add one development orchestration command that stages exact helpers and
  CPU/CUDA runtime packs, starts the loopback HTTPS runtime origin, writes the
  descriptor under a private ignored temporary root, launches the ordinary
  Electron application with the dedicated flag, and removes task-owned
  ephemeral trust/server state after application exit.
- Route the authenticated `qualification` inputs into the same
  `ProductionLocalWhisperEnvironmentFactory`, coordinator, artifact service,
  IPC, settings renderer, provider dispatch, and worker lifecycle used by the
  ordinary application. Do not build a second feature implementation.
- Add the `CATALOG_UNAVAILABLE` failure/state mapping and replace the inaccurate
  `Unsupported platform` message when platform support exists but no trusted
  catalog is active. Display `Development qualification artifacts` while the
  development channel is active.
- Generate a complete strict catalog for Linux CPU/CUDA runtimes and the six
  exact release-1 model objects. Exercise real normal-app Download/Resume/
  Cancel/Retry, streaming verification, atomic promotion, inventory refresh,
  selection, and removal behavior.
- Install all six models through the normal application and confirm that each
  installed artifact can be selected and saved for CPU and the eligible CUDA
  device without fallback.
- Perform a bounded ordinary-app `base/full` CPU smoke and CUDA smoke with one
  non-private deterministic public WAV, then unload and prove worker/process
  cleanup. No all-model measurement or repetition suite is required.
- Update Task 19 automated tests, package scripts, acceptance ownership, task
  validation, scoped documentation, `todo.md`, and `handoff.md` for revision 18.

## Out Of Scope

- The all-six-model accuracy, RTF, RAM/VRAM measurement, repetition, crash,
  suspend/resume, predecessor, and evidence-freeze matrix owned by Task 20.
- Representative Windows commands or execution. Exact Windows compilation,
  installer, Job Object, CPU/CUDA hardware, and package validation remain Task
  21 even though Windows production code and deterministic contracts remain in
  Task 19.
- Production catalog/key generation, private production keys, runtime upload,
  final GitHub runtime-origin parity, legal approval, publication, support-tier
  promotion, tag, release, push, or pull request.
- Fixture catalogs, unsigned catalogs, private signing keys in the repository,
  renderer-selected trust/path/URL authority, persisted activation, ambient
  descriptor discovery, arbitrary model import, moving Hugging Face branches,
  mirrors, tokens, cookies, or project-rehosted model bytes.
- Physical AMD qualification or executable macOS inference. AMD remains
  `Preview · Untested`; macOS remains `Planned · Unavailable`.
- New dependencies unless an unavoidable repository-reviewed need is found and
  returned to planning. Existing Node/Electron, native, and test facilities are
  the expected implementation surface.

## Task Contract

### Development activation input

Main owns activation before Local Whisper composition. It accepts only the
single exact equals-form argument:

```text
--local-whisper-development-activation=<absolute-descriptor-path>
```

Unknown Local Whisper activation spellings, duplicate flags, an empty value, a
relative/root/NUL-containing path, a non-regular file, a symlink, an oversized
document, invalid UTF-8, duplicate JSON keys, noncanonical JSON, or extra fields
fail closed. When `app.isPackaged === true`, main must reject the flag before
reading the supplied path. No flag means the existing production-purpose
packaged catalog path; it does not trigger discovery.

The canonical descriptor has schema version 1 and exact top-level fields:

```text
schemaVersion = 1
mode = "local-whisper-development-activation"
purpose = "qualification"
appRevision = exact app.getVersion() value (currently 1.4.0; candidate qualification SemVer remains 2.4.0)
workerProtocolVersion = 1
resourcesPath = absolute non-root staged helper-resource root
catalogEnvelope = strict Ed25519 envelope object
publicKeys = non-empty qualification-only public key records
origins = exact qualification runtime and public model origin records
trustedCertificateAuthorities = public PEM certificates for the loopback origin
displayLabel = "Development qualification artifacts"
```

The descriptor is public verification/configuration data only. It contains no
private key, credential, token, cookie, audio, prompt, transcript, user/device
identifier, or arbitrary executable argument. Main checks exact app/protocol/
purpose/key/origin compatibility, authenticates the catalog, and validates the
resource root through the existing packaged-resource resolver before creating
any privileged adapter. Invalid input maps to `CATALOG_UNAVAILABLE`, never
`UNSUPPORTED_PLATFORM`, and starts no download, helper, or worker.

### Development orchestration and trust

A class-based script service under `scripts/local-whisper/development/` owns the
temporary development session lifecycle. It must:

1. validate the Linux x64 host and explicit task-owned temporary root;
2. consume only verified pinned source/toolchain/runtime inputs;
3. stage the exact helper manifest and CPU/CUDA runtime packs;
4. generate an ephemeral qualification signing key outside the repository,
   sign the strict catalog, and write only public verification material into
   the descriptor;
5. start one `127.0.0.1` HTTPS server exposing only the exact runtime archives
   with bounded range/ETag behavior;
6. launch the normal non-packaged Electron entrypoint with the dedicated CLI
   flag;
7. keep the loopback server alive only for explicit runtime actions; and
8. on exit or failure, stop the server, revoke/destroy task-owned private key
   material, remove only validated task-owned ephemeral files, and leave
   installed managed models/runtimes intact.

Production, fixture, and qualification trust remain pairwise disjoint.
Packaged collection must prove that no development descriptor, qualification
key, origin, CA, script argument, or staged private root can enter an installer.

### Ordinary application composition and UI

The development activation supplies catalog/trust/resources inputs to the
existing process-owned production environment factory. Renderer and preload
continue exposing only typed artifact IDs, settings, actions, status, and
progress. Raw paths, URLs, certificates, keys, native handles, and process
arguments never cross IPC.

The settings page must show the fixed `whisperCpp` engine, complete model and
runtime controls, `Development qualification artifacts`, and accurate catalog
state. When no trusted catalog is active on supported Linux/Windows, it shows
`Catalog unavailable` with development/publication guidance and no bordered
`unsupported` badge. Unsupported platform/architecture and macOS Planned states
remain separate typed conditions.

### Exact public model downloads

The ordinary application catalog must expose exactly these qualification-
eligible model entries from repository `ggerganov/whisper.cpp`, immutable
commit `5359861c739e955e79d9a303bcbc70fb988958b1`:

| Family / variant      | File                           |   Exact bytes | SHA-256                                                            |
| --------------------- | ------------------------------ | ------------: | ------------------------------------------------------------------ |
| `tiny/full`           | `ggml-tiny.bin`                |    77,691,713 | `be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21` |
| `base/full`           | `ggml-base.bin`                |   147,951,465 | `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe` |
| `small/full`          | `ggml-small.bin`               |   487,601,967 | `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b` |
| `medium/full`         | `ggml-medium.bin`              | 1,533,763,059 | `6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208` |
| `large-v3/q5_0`       | `ggml-large-v3-q5_0.bin`       | 1,081,140,203 | `d75795ecff3f83b5faa89d1900604ad8c780abd5739fae406de19f23ecd98ad1` |
| `large-v3-turbo/q5_0` | `ggml-large-v3-turbo-q5_0.bin` |   574,041,195 | `394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2` |

Each Download action resolves in main to
`https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/<file>`
and the authenticated redirect policy. Transfers are anonymous, identity-
encoded, bounded, streaming, journaled, resumable only under exact validator/
range rules, and materialized as one regular file through
`pinned-raw-model-v1`. Progress is renderer-safe and rate-limited. Exact length
and SHA-256 must pass before atomic promotion and inventory refresh.

At least one transfer must exercise bounded cancel plus resume or explicit
retry. A partial, changed ETag/object, unsafe redirect, short/long body, hash
mismatch, outage, rate limit, or disk failure preserves installed revisions and
produces the exact typed retry/recovery state. It never selects a mirror,
moving revision, different model, target, backend, or CPU fallback.

### All-model readiness and bounded smoke

Task 19 completion requires all six exact artifacts simultaneously installed,
integrity-valid, independently removable, visible in inventory, and selectable
for both CPU and the eligible NVIDIA CUDA device. Selection tests must traverse
the real renderer/preload/main settings path and preserve epochs; they must not
load every model or create a qualification result.

Use `base/full` for bounded execution because it is the product default. Use one
public deterministic WAV selected from the pinned FLEURS manifest; retain no
private audio or raw transcript evidence. Through the ordinary application:

1. select CPU, save, run compatibility, `Load now`, warm up, transcribe through
   the normal provider completion flow, and `Unload`;
2. prove no GPU backend/process/allocation initialized during the CPU run;
3. select the exact opaque NVIDIA CUDA device, save, run compatibility,
   `Load now`, warm up, transcribe the same fixture, and `Unload`;
4. prove the CUDA worker bound the selected physical device with no CPU/device/
   backend fallback; and
5. after each unload, confirm worker exit, authority closure, zero owned GPU
   allocation where applicable, and no orphan helper/listener.

One successful non-empty expected transcription per target is sufficient. Do
not run all six models, performance fixtures, ten load/unload cycles, twenty
transcriptions, resource peak publication, crash/suspend/offline suites, or
hour-long qualification in this packet.

### Static cross-platform readiness

The existing implementation-readiness verifier remains fail-closed. It must
now require the descriptor loader/generator, packaged rejection, catalog UI
state, six-model ordinary action coverage, and Task 19 smoke handoff contract in
addition to complete Windows/Linux production code and deterministic artifact/
native/schema checks. Its successful output remains exactly:

```text
implementationReady: true
linuxQualification: Pending
windowsQualification: Pending
productionReady: false
```

The verifier must not reinterpret functional Linux smoke as platform
qualification or allow absent/failed platform evidence to produce Production.

## Contracts And Boundaries

- Main owns app identity, CLI parsing, descriptor/catalog/key/origin/CA trust,
  network, filesystem, helpers, runtime/model authority, devices, workers, and
  lifecycle. Renderer owns only normal UI state and typed actions.
- The CLI flag and descriptor are development-only inputs; they are neither
  persisted settings nor catalog-discoverable behavior.
- CPU initializes no GPU. CUDA preserves the exact selected opaque device and
  has no target/backend/device/model fallback.
- The Task 17 fixture, production-disabled sentinel, qualification purpose, and
  production purpose remain non-substitutable.
- Routine logs, repository artifacts, task evidence, and chat contain no raw
  paths, hardware IDs, audio, transcript, prompt, environment, certificate
  private data, private key, or native error text.
- Real anonymous model download is permitted; credential use, upload,
  publication, and contacting any non-allowlisted origin are prohibited.
- No Windows execution is represented as run. No Linux functional smoke is
  represented as all-model or Production qualification.

## Expected Files Or Components

- `src/main/main.ts` and focused startup parsing/composition tests.
- `src/main/localWhisper/development/` for the strict activation descriptor
  decoder/loader and immutable activation result.
- `src/main/localWhisper/composition/`, `catalog/`, `artifacts/`, `packaging/`,
  `ipc/`, and directly related tests for development trust, normal downloads,
  snapshots, and production isolation.
- `src/shared/localWhisper/` and renderer-safe type tests for
  `CATALOG_UNAVAILABLE` and development-channel status.
- `src/renderer/localWhisper/` and focused UI/accessibility tests for accurate
  catalog state, channel label, all-model actions, and removal of the incorrect
  unsupported badge/message.
- `scripts/local-whisper/development/` with class-based descriptor generation,
  loopback runtime server ownership, normal-app launcher, CLI, and tests.
- Existing `scripts/local-whisper/implementation-readiness/`, task-plan
  validator, qualification catalog/runtime/model producers, and focused tests.
- `package.json`/`package-lock.json` scripts only; no new dependency is expected.
- `docs/specs/local-whisper/qualification/task19-evidence-template.md`, scoped
  runtime/developer README content, `acceptance-owners.json`/schema, `todo.md`,
  and `handoff.md`.

## Acceptance Criteria

- `AC-AUTO-074` proves only the selected non-packaged CLI flag plus one valid
  canonical qualification descriptor activates the ordinary graph. Packaged,
  absent, implicit, duplicate, malformed, fixture, production-purpose,
  unsigned, forged, incompatible, renderer-selected, or persisted activation
  fails with `CATALOG_UNAVAILABLE` before privileged work.
- `AC-AUTO-075` proves all six exact model entries expose normal Download/
  Resume/Cancel/Retry/install/remove actions through renderer/preload/main and
  the real managed `pinned-raw-model-v1` pipeline, and every valid installed
  model is selectable for CPU and eligible CUDA without fallback.
- `AC-AUTO-064`–`AC-AUTO-070` and `AC-AUTO-072`–`AC-AUTO-073` retain strict
  transport, trust, production composition, DAG, model/corpus/runtime,
  implementation-readiness, and evidence-contract behavior.
- `AC-MAN-015` passes: the ordinary Linux app downloads and installs all six
  exact public Hugging Face model objects, exercises progress/recovery, exposes
  every model for CPU/CUDA selection, and completes bounded `base/full` CPU and
  CUDA load/transcribe/unload without mocks or the isolated qualification
  runner.
- Packaged production remains fail-closed, AMD/macOS claims are unchanged, and
  Linux/Windows/aggregate qualification remains `Pending`.
- The ownership registry validates Tasks 01–22 and exactly 74 canonical
  automated acceptance IDs (`AC-AUTO-001`–`054`, `056`–`075`).

## Verification

Run focused automated checks first:

```bash
rtk npm run test:local-whisper:development
rtk npm run test:local-whisper:artifacts
rtk npm run test:local-whisper:catalog
rtk npm run test:local-whisper:composition
rtk npm run test:local-whisper:ipc
rtk npm run test:local-whisper:ui
rtk npm run test:local-whisper:ui:accessibility
rtk npm run test:local-whisper:packaging
rtk npm run test:local-whisper:qualification
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run verify:local-whisper:implementation-readiness
```

Then run the applicable project checks after code changes:

```bash
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk npm run smoke:fedora
```

The registered Task 19 command remains:

```bash
rtk npm run verify:local-whisper:implementation-readiness
```

Run the manual functional gate only after the automated checks and development
runtime inputs are ready:

```bash
rtk npm run start:local-whisper:development -- --platform=linux
```

Use the ordinary application UI to perform the exact `AC-MAN-015` download,
selection, CPU smoke, CUDA smoke, and unload procedure. Record only sanitized
artifact identities/states, command result, and pass/fail assertions in the
Task 19 evidence template; do not record raw paths, device IDs, audio, or
transcripts.

Do not run `run:local-whisper:qualification:linux`,
`verify:local-whisper:qualification:linux`, any Windows-only command, or
`verify:local-whisper:all` in this packet.

## Failure And Rollback

- Preserve Tasks 01–18 and all narrow existing Task 19 work. Roll back only the
  revised activation/download/UI/smoke delta if its contract cannot pass.
- Do not restore the false Task 19 completion verdict or weaken a validator,
  signature, purpose, origin, redirect, path, process, resource, privacy, or
  fallback check to make the packet pass.
- A partial public download remains resumable only under its exact journal and
  validator rules. Do not delete a valid installed model during code rollback;
  removal requires the normal exact managed action.
- A Hugging Face outage, insufficient disk, unavailable pinned runtime input,
  missing NVIDIA device, failed real CPU/CUDA smoke, or inability to prove
  cleanup keeps Task 19 incomplete. Do not substitute a mirror, private model,
  mock, qualification runner, or Production claim.
- A Windows implementation defect found by deterministic contracts must be
  fixed here. Missing Windows execution is expected and remains Task 21.

## Manual Gates

- `MANUAL GATE — public model downloads`: the Task 19 execution authorization
  permits anonymous GET/range requests only to the six exact pinned Hugging
  Face model objects and their authenticated redirect targets. It authorizes no
  credentials, cookies, arbitrary browsing, mirror, upload, or publication.
- `MANUAL GATE — local runtime origin`: the task may generate an ephemeral
  qualification key/certificate and bind a loopback HTTPS server to
  `127.0.0.1` for exact local CPU/CUDA runtime archives. Private material stays
  outside the repository and is destroyed after the session.
- `MANUAL GATE — Linux CPU/CUDA functional smoke`: execute only the bounded
  `AC-MAN-015` flow on the available Linux NVIDIA laptop. This is mandatory for
  Task 19 completion but is not platform qualification.
- Representative Windows commands, all-model Linux qualification, production
  signing, legal approval, runtime upload, publication, commit, push, PR, tag,
  support promotion, and release remain outside this packet.

## References

- Approved specification revision 14 Sections 3.1, 5, 7.1, 8.7, 9.2, 12.1,
  12.3, 18.3, 19.1–19.3, and 22.
- Durable decisions `acceptance.task-19-normal-app-linux-smoke` revision 2,
  `security.task-19-development-artifact-activation`,
  `distribution.task-19-huggingface-model-download`, and
  `planning.development-activation-input`.
- Task 17 fixture bundle, completed Tasks 01–18 contracts, and current Task 19
  static-readiness worktree changes.
- `docs/agent-guides/project-conventions.md` sections Electron And Providers,
  Dependency Injection And Runtime Ownership, Desktop/Packaging, Tests, and Git.

## Completion And Handoff

Mark Task 19 complete only when all automated checks pass, all six real models
have been downloaded and installed through the normal app, every model is
selectable for CPU and eligible CUDA, and the bounded `base/full` CPU/CUDA
ordinary-app smoke passes with confirmed unload/cleanup. The implementation-
readiness command must still report both platform qualifications `Pending` and
`productionReady: false`.

Update `todo.md` and `handoff.md` with changed files, exact checks, sanitized
`AC-MAN-015` result, remaining local managed artifacts, and the exact final Task
19 commit/source identity only after a later authorized commit. State that no
candidate, platform branch, result, evidence index, aggregate root, or
Production verdict exists. Stop before Task 20, commit, push, PR, signing,
upload, publication, or release unless separately authorized.
