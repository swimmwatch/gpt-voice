# Local Whisper Performance Remediation Specification

- Status: Approved
- Date: 2026-08-08
- Updated: 2026-08-18
- Revision: 8
- Revision basis: current working-tree standard-loader implementation and the explicit user decision to end
  representative qualification work and retain only Windows functional parity
- Draft basis: explicit user decision to remove the remaining Linux qualification packet and reduce Windows
  acceptance to one direct CPU/CUDA application run without benchmarks, CI gates, or additional qualification
- Approval: revision 8 explicitly approved by the user on 2026-08-18
- Previous approvals: revisions 1, 2, 4, 5, 6, and 7 are retained as historical evidence; revision 3 records the
  target-policy correction
- Decision ledger: [`decisions.yaml`](decisions.yaml)

## 1. Purpose and authority

This specification defines the Local Whisper performance remediation selected from
[`2026-08-08-local-whisper-performance-comments-to-address.md`](../../reviews/2026-08-08-local-whisper-performance-comments-to-address.md).
It covers corrected measurement, model loading, installation transport, worker resource lifetime, backend
option pinning, and configurable GPU-path CPU threads on supported Linux x64 and Windows x64 hosts.

The approved [`Local Whisper specification`](../local-whisper/spec.md) and
[`native review remediation specification`](../local-whisper-native-review-remediation/spec.md) remain
authoritative except for the narrow model-file authentication and loader-interface amendment in this revision.
For ordinary model installation and loading only, this later user-directed contract supersedes inherited
requirements that mandate model-content SHA-256, immutable model-content identity, a custom model loader,
same-open-object content authentication, or descriptor/handle-based model consumption. Runtime-pack
authentication, process hardening, managed-root ownership, privacy, packaging, and all unrelated parent
requirements remain authoritative. Per `scope.spec-bundle-boundary`, no file outside
`docs/specs/local-whisper-performance-remediation/` is revised by this specification workflow.

**OUT-001** The only remaining work SHALL implement and run the Windows x64 Local Whisper path so its observable
CPU and CUDA provider behavior matches the completed Linux implementation while preserving the retained
correctness, thread-safety, resource-ownership, privacy, process-safety, and filesystem-safety requirements.

**OUT-002** Remaining acceptance SHALL be functional, not performance-based: start the application on Windows,
run the Local Whisper CPU and CUDA paths, load model weights, and confirm transcription works. No cold/warm
matrix, repeated samples, timing target, benchmark, resource measurement, CI gate, package qualification, or
additional evidence suite is required.

**OUT-003** An ordinary successful model installation, readiness check, startup, load-now flow, lazy-load flow,
or transcription SHALL perform zero project-owned model-content SHA-256 operations, zero model-content
signature checks, zero authenticated-snapshot passes, and zero custom-loader consumption proofs. The standard
path-based `whisper.cpp` API SHALL be the only production model reader after bounded metadata/path validation.

**SCP-003** Approval of this specification authorizes neither planning nor implementation. `/plan` remains a
separate workflow.

**SCP-007** Revision 6 replaced revision 5's one-authenticated-snapshot design. Completed Packets 01–16 remain
inherited behavior. Revision 8 preserves the standard-loader transition and removal of ordinary model-content
proofs, removes the unfinished Linux qualification packet, and leaves only Windows functional parity.

**SCP-009** This revision SHALL change only the `local-whisper-performance-remediation` specification bundle.
It SHALL express its narrow amendment explicitly rather than editing the parent Local Whisper specification.

## 2. Repository-established baseline

**BASE-001** The revision basis establishes these relevant facts:

- C++20 RAII ownership, bounded native protocol parsing, process-tree cleanup, runtime-pack authentication,
  structured privacy-safe diagnostics, sanitizers, static analysis, and worker TSan are implemented foundations;
- acquisition-result reuse is implemented, leaving seven successful-load full-model content hashes on Linux
  and six on Windows;
- `ExactModelReader` hashes the held model during project-owned format preflight and again while the custom
  loader supplies bytes to `whisper.cpp`;
- the main/guard/launcher path transfers model-specific native authority instead of giving the worker a model
  path for the standard `whisper.cpp` file API;
- worker protocol v1 reports `loaded` before the separate real-inference `warmup` request;
- protocol-v2 installation decoding, bounded candidate-window plumbing, runtime SHA-256 dispatch, early WAV
  release, settings schema 2, GPU CPU-thread identity, and Linux/Windows backend-option parity are implemented;
- Linux implementation and local execution are complete; the Windows implementation and direct Windows
  CPU/CUDA application run remain incomplete.

Source inspection is not performance or supported-host acceptance evidence.

## 3. Scope

**SCP-001** This work SHALL preserve or complete:

1. the completed privacy-safe phase and resource measurement foundations without additional collection;
2. the implemented acquisition-result reuse;
3. removal of every ordinary project-owned model-content proof;
4. direct path-based loading through the pinned standard `whisper.cpp` API;
5. canonical managed-root path and basic regular-file validation;
6. retained runtime-pack authentication and process isolation;
7. the implemented single-layer installation protocol and bounded write pipeline;
8. the implemented x64 runtime-dispatched SHA-256 for retained non-model uses;
9. the implemented early source-WAV release;
10. the implemented backend-option and GPU CPU-thread behavior;
11. explicit real-inference warm-up through the existing `warmup` lifecycle; and
12. Windows functional parity and one direct CPU/CUDA application verification against OUT-002.

**SCP-002** No new renderer setting, privileged public IPC channel, preload authority, provider capability, or
external API is authorized by revision 8. Existing GPU CPU-thread UI and schema-2 behavior remain unchanged.

**SCP-004, SEC-003** Model-digest caching is not applicable because ordinary installation and loading no longer
calculate or compare a model-content digest. Metadata SHALL be used only for bounded file/path validation and
catalog selection, not as a claim that model bytes have an approved cryptographic identity.

**SCP-005, PERF-003** Every active item in SCP-001 is required. Measurement selects and proves an implementation;
it does not turn a required behavior into measurement-only work.

**SCP-006** The work SHALL NOT add or change provider network requests outside the existing approved model
download, browser sessions, microphone capture, clipboard actions, transcript/history retention, or external
publication behavior.

**SCP-008** Model download SHALL retain approved-source HTTPS, bounded temporary-file writing, completion and
expected-size validation, disk-space checks, cancellation, bounded retry, stale-temporary cleanup, and atomic
promotion. It SHALL NOT hash, sign, or otherwise authenticate model payload contents before promotion. Runtime
packs remain separately authenticated immutable artifacts and are not covered by this relaxation.

### 3.1 Non-goals

Revision 8 does not authorize:

- weakening runtime-worker provenance, archive digest, executable identity, dependency-manifest, or process
  lifecycle checks;
- arbitrary user model paths, custom model import, paths outside the application-managed model root, directory,
  device, FIFO, socket, symlink, junction, or reparse-point model inputs;
- putting a model path in process argv, environment variables, renderer/preload IPC, retained logs, diagnostics,
  crash attachments, or qualification evidence;
- a model-content digest cache, background integrity scan, user-triggered cryptographic repair scan, or hidden
  fallback to `ExactModelReader`;
- model `mmap` policy changes, read/hash overlap, extra worker threads, concurrent inference, or concurrent installs;
- flash attention, changed ggml/CUDA option values, CUDA-upload-first work, or CUDA JIT-cache tuning;
- additional GPU architectures or runtime-pack families, ARM acceleration, Apple Silicon, or production macOS;
- new runtime dependencies, package-target changes, catalog rollout, release publication, or model-byte changes;
- redesigning diagnostics or native structured-log retention merely to collect performance evidence;
- any remaining Linux qualification work, model-load benchmark, cold/warm matrix, repeated sample collection,
  timing/statistical/resource report, baseline comparison, representative-host matrix, CI gate, package
  qualification, or additional evidence suite;
- suspend/resume, unavailable-device, CPU-thread-count, topology/model-switch, delete/redownload, cancellation,
  retry, installation-window, or privacy-inspection matrices as part of the remaining Windows task.

## 4. Compatibility and entry gates

**GAT-001** Completed native-remediation and performance Packets 01–15 are inherited and SHALL not be recreated.

**GAT-002** No baseline package, qualification manifest, benchmark input, or representative evidence collection
is required by revision 8.

**GAT-003** The Windows functional run SHALL use the application-managed model selected through the ordinary
provider workflow. It SHALL not introduce a qualification-only model or data path.

**GAT-004** Before Windows implementation, source ownership SHALL be checked only far enough to preserve the
existing Linux/Windows adapter boundary. No additional qualification identity or artifact evidence is required.

**CMP-001** Production applicability is Linux x64 and Windows x64. Shared behavior and failure semantics SHALL be
equivalent; platform-only path APIs remain behind narrow adapters.

**CMP-002** Local Whisper remains unavailable on macOS in this work.

**CMP-003** Model IDs, model bytes, catalog selection, managed-root layout, provider result shapes, settings, and
history data SHALL not migrate.

**CMP-004, IPC-001** The implemented filesystem-guard installation protocol v2 and its version-1 mismatch
rejection remain unchanged.

**CMP-005** The implemented scalar/accelerated SHA-256 dispatch remains safe on unsupported x64 CPUs for retained
runtime, installation, fixture, and qualification uses; it SHALL not be invoked for ordinary model contents.

**CMP-006** Settings schema 2 and its existing rollback behavior remain unchanged.

**CMP-007** Linux and Windows workers SHALL use the same standard path-based `whisper.cpp` initialization
contract, the same private path-message schema, the same pre-call metadata/path checks, and the same sanitized
failure behavior. No platform may retain a model-content proof or custom production loader as a hidden fallback.

**CMP-008, RES-004** Revision 6 removed the project-owned model-size authenticated snapshot and its temporary
memory exception. Model-loading memory is owned only by the standard `whisper.cpp`/ggml/backend path and remains
subject to the ordinary measured-resource guardrail.

**CMP-009** A successful load SHALL contain zero project-owned model payload reads before the standard
`whisper.cpp` API call on both platforms. Metadata and path checks MAY use bounded fixed-size records and
filesystem metadata but SHALL not read model payload bytes.

**IPC-005** The canonical model path SHALL travel only in a bounded, versioned, private main-to-worker control
message. Main and worker SHALL roll out as one compatibility set and reject mixed versions before opening the
model. The field SHALL be absent from argv, environment, renderer/preload IPC, retained logs, diagnostics,
errors, and evidence. It SHALL be accepted only for a catalog-selected canonical child beneath the configured
managed model root.

## 5. Remaining Windows functional contract

Revision 8 supersedes the remaining revision-7 qualification matrix. Historical qualification tooling and prior
evidence may remain in the repository, but no unfinished Linux qualification, new benchmark, or new aggregate
evidence is required for completion.

**WIN-001** Windows SHALL implement the same standard path-based `whisper.cpp` loading contract as Linux behind
the existing platform adapter. The Windows adapter SHALL preserve managed-root confinement, regular-file and
reparse-point rejection, expected-size validation, RAII cleanup, private path transport, one upstream loader
call, sanitized failures, and no legacy fallback.

**WIN-002** The Windows code SHALL compile and the ordinary development application SHALL start with Local
Whisper resources for the CPU and CUDA backends on a supported Windows x64 host.

**WIN-003** Functional verification SHALL consist of one ordinary application flow per available required
backend: select Local Whisper, load the configured application-managed model weights, start recording, and
obtain a successful transcription. CUDA verification SHALL use the CUDA backend rather than silently falling
back to CPU.

**WIN-004** The remaining task SHALL NOT require cold-cache or warm-cache preparation, repeated runs, a fixed
model family, durations, medians, percentiles, five-second comparison, RAM/VRAM sampling, baseline comparison,
qualification schemas, CI execution or inspection, package installation, evidence digests, or an expanded
lifecycle/privacy matrix.

**WIN-005** Linux behavior is the functional reference. Windows-only implementation corrections are permitted;
shared behavior SHALL change only when necessary to preserve the already implemented cross-platform contract.

## 6. Model-file safety and standard loader

**SEC-001** Before calling `whisper.cpp`, main and worker SHALL validate only bounded non-content properties:

- the model selection is a known catalog entry;
- the path is canonical and confined to the application-managed model root;
- the final child is a regular file and not a symlink, junction, reparse point, directory, device, FIFO, or socket;
- the file is opened for reading only and its metadata size equals the catalog's expected byte count;
- the private request belongs to the current app instance, worker generation, configuration epoch, and request;
- cancellation and timeout have not already become terminal.

These checks SHALL not read model payload bytes and SHALL not claim cryptographic model identity.

**SEC-002** The worker SHALL call the pinned standard path-based `whisper.cpp` initialization API directly. The
production call path SHALL not construct `ExactModelReader`, run the project-owned `ModelFormatPreflight`, supply
a custom model-loader callback, allocate an authenticated snapshot, or calculate/compare a model digest.
`whisper.cpp` owns structural parsing, model construction, backend allocations, and its own bounded failure result.

**SEC-004** No same-open-object content guarantee remains between the final metadata/path check and the upstream
file open. A same-user process may replace a file during or after validation; this is the explicit accepted risk
established by revision 6 and retained by revision 8. Path confinement and link/type checks remain mandatory,
but a bounded regular parseable replacement is not rejected merely because its bytes differ from the catalog's
historical digest.

**PERF-006** Existing acquisition-result reuse remains for runtime and directory work. Model loading SHALL add no
second project-owned metadata scan solely to imitate the removed content-proof chain.

**PERF-007** Tests SHALL inject malformed paths, path traversal, links/reparse points, non-regular files, size
mismatch, stale request/generation, cancellation, and protocol mismatch. Each SHALL fail before the standard API
call with no residency. Tests SHALL also prove that a same-size structurally valid local replacement reaches the
standard API without a content-digest rejection, documenting the accepted reduced guarantee.

**ARC-005, ARC-006** One worker-owned loader adapter SHALL validate the private request and call the standard
`whisper.cpp` file API exactly once. It SHALL own no model-size buffer, hash state, descriptor/handle broker, or
pass-through abstraction. Engine/context/backend ownership remains RAII and is released deterministically.

### 6.1 Retained runtime and process authentication

**SEC-010** Runtime packs, worker executables, dependency manifests, backend/device authority, app-instance nonce,
PID/start identity, configuration epoch, process-tree ownership, parent-death behavior, and termination
confirmation remain authenticated and fail closed under the parent contracts. Removing model-content proofs
SHALL not weaken executable provenance or permit an ambient worker/library from `PATH` or the working directory.

**SEC-011** Model-specific descriptor/handle handoff and custom-loader authority are removed from the ordinary
load path. Process launch and control channels remain private, bounded, versioned, one-parent-owned, and excluded
from renderer authority. The worker receives only the catalog-selected canonical path via IPC-005.

**SEC-012** The revision-6 accepted risk remains: a locally replaced same-size regular model may load when
`whisper.cpp` can parse it. This is not presented as authenticated or repaired content. Documentation SHALL
state this reduced integrity guarantee plainly.

### 6.2 Retained SHA-256 implementation

**CRY-001** The implemented project-owned scalar/accelerated SHA-256 state machine remains available for
runtime-pack, installation-artifact, fixture, and retained tooling uses. Dispatch remains race-free and CPU-feature
selected. It SHALL not be called on ordinary model contents after revision 6.

## 7. Installation protocol and pipeline

**CODEC-001, CODEC-002, IPC-003, IPC-004, INST-001** The implemented filesystem-guard protocol v2 single-layer
canonical base64url codec, exact 262,144-byte payload budget, newline framing, malformed-input rejection, and
derived raw chunk limit remain authoritative.

**THR-001, RES-001, INST-002** The implemented bounded ordered candidate-window pipeline retains serial production
selection, deterministic backpressure, exactly-once settlement, cancellation/failure cleanup, and no partial
publication. Model download promotion additionally follows SCP-008 without content hashing.

## 8. Worker lifecycle, warm-up, and audio

**FLOW-001** Provider selection, setup, load-now/lazy-load, transcription, cancellation, unload, renderer-safe
results, and retry behavior remain compatible except for the private model-path transport and reduced model
integrity guarantee.

**WRM-001, IPC-002** `load` ends in `loaded` without real inference warm-up. The existing explicit `warmup`
request performs real inference and returns `warmed`; message ordering remains load/loaded then warmup/warmed.

**WRM-002** Reusable residency is committed only after standard model load, backend/device allocation proof,
explicit warm-up, and retained process/runtime checks succeed. Warm-up failure or timeout removes uncertain
residency and requires a fresh worker.

**FLOW-002** `loaded` proves that the standard engine reports model construction complete and that applicable
RAM/VRAM/device ownership evidence passed. It does not prove catalog cryptographic model identity.

**LOG-001** Existing native log schema remains version 1. Paths, model contents, raw loader errors, audio, and
transcripts remain excluded.

**MEM-001, MEM-002, THR-006** The implemented WAV/PCM lifetime, conversion, cancellation, inference, and cleanup
requirements remain unchanged.

## 9. GPU-path CPU threads and renderer behavior

**CFG-001, CFG-002, CFG-003, CFG-004, THR-002, THR-003, THR-004, MIG-001, MIG-002, MIG-003** Settings schema 2,
target-specific CPU/GPU thread memory, `auto` or integer validation, migration defaults, topology resolution,
configuration epoch, and residency identity remain unchanged.

**UI-001, A11Y-001** The implemented target-specific advanced thread control, labels, help, validation, keyboard
behavior, focus, and localized accessibility remain unchanged.

## 10. Backend build-option contract

**BLD-001** Current effective CPU/CUDA option values and Linux/Windows intent remain pinned. Revision 8 changes
only the remaining acceptance scope; it SHALL not enable flash attention, change ggml/CUDA tuning, or introduce
host-default drift.

**DEP-001** No new codec, crypto, threading, runtime, or packaged dependency is authorized.

## 11. Thread safety, ownership, and resources

**ARC-001** Main retains privileged filesystem, process, settings, runtime, and provider ownership. Renderer code
uses only the existing typed desktop boundary.

**ARC-002** Stateful transport, worker, and retained qualification behavior remains process-lifecycle owned with injected
dependencies; no mutable module-level or native global runtime container is authorized.

**THR-005** Retained SHA dispatch remains immutable and race-free. Standard model loading remains owned by one
worker inference owner; revision 8 does not authorize concurrent model loads or inference.

**RES-003** Native resources use RAII and deterministic non-throwing cleanup. Success, failure, cancellation,
timeout, protocol mismatch, parser failure, backend failure, and process exit SHALL release all worker-owned
resources and confirm termination before uncertain allocations are considered gone.

## 12. Security and privacy

**PRIV-001** Existing qualification artifacts remain subject to their aggregate-only privacy contract. Revision
8 requires no new qualification evidence and does not delete retained private evidence.

**PRIV-002** Runtime logs, errors, diagnostics, crash attachments, CI artifacts, and documentation SHALL not
contain absolute model paths, audio, transcripts, model bytes, hashes tied to private local files, raw native
output, or device-native identity.

**SEC-005** All private protocol decoders retain exact bounds, canonical parsing, duplicate-key rejection,
request correlation, version checks, and fail-stop behavior.

**SEC-006** Path and process validation occurs immediately before the standard API call where practical, but it
is not represented as freshness or content authentication. Content-only mutation no longer fails closed.

**SEC-007** SHA dispatch uses local CPU feature evidence only and never environment, network, `PATH`, or user
address input as authority.

**SEC-008** Settings validation, unsupported-newer behavior, and content-free renderer errors remain unchanged.

## 13. Failure, recovery, and rollback

**FAIL-001** All failures use existing stable content-free stages/codes where applicable. Raw exception text,
paths, model bytes, native output, memory addresses, and device identities SHALL not cross renderer IPC or enter
retained evidence.

**FAIL-002** No failed path may report partial success:

| Condition                                                     | Required outcome                                                                              |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Invalid/private-protocol mismatch                             | Reject before opening the model; terminate uncertain worker state.                            |
| Path escape, link/reparse, non-regular file, or size mismatch | Reject before the standard API call; preserve no residency.                                   |
| Standard `whisper.cpp` parse/load failure                     | Return the existing sanitized model-load failure and destroy partial engine/backend state.    |
| Backend/device proof failure                                  | Destroy partial state and emit no `loaded` result.                                            |
| Timeout or cancellation                                       | Make the request terminal, stop the worker when state is uncertain, and emit no late success. |
| Warm-up failure                                               | Return the existing warm-up failure and remove uncertain residency.                           |
| Installation failure                                          | Remove staging/temporary state and publish no partial model.                                  |
| Runtime-pack or executable identity failure                   | Fail closed before worker use; do not weaken runtime authentication.                          |

**FAIL-003** Retry is permitted only after resources reach a defined safe state. No stale request, path record,
worker generation, engine context, backend allocation, staging token, or audio buffer may be reused.

**FAIL-004** Snapshot allocation/protection failure is removed. Standard loader allocation failure follows the
ordinary sanitized model-load boundary and requires complete cleanup; no authenticated or two-pass fallback runs.

**FAIL-005** A structurally invalid model may remain visible as installed until standard `whisper.cpp` rejects it.
The application SHALL offer the existing explicit delete/redownload or repair guidance, SHALL not automatically
delete or overwrite it, and SHALL not claim a digest mismatch. A parseable local replacement is accepted per SEC-012.

**OPS-001** Main, worker, and private path-message schema SHALL roll out as one compatibility set. Mixed peers
fail closed before model open. Runtime-pack compatibility remains authenticated separately.

**OPS-002** Automatic settings downgrade remains forbidden.

**OPS-004** Completion requires the Windows functional run in Section 5, not additional Linux qualification,
CI, benchmark, package, or evidence gates. Rollback remains a whole compatible app/worker set, not a per-load
fallback. This specification authorizes neither rollout nor release publication.

## 14. Acceptance criteria

### 14.1 Inherited acceptance

**AC-INH-001** Packets 01–16 and their recorded checks remain accepted historical implementation evidence. The
remaining Windows task SHALL not rerun those suites merely to reconfirm unchanged Linux/shared behavior.

### 14.2 Remaining Windows acceptance

**AC-WIN-001** The Windows implementation compiles and the ordinary development application starts with the
Local Whisper CPU and CUDA runtime resources on a supported Windows x64 host.

**AC-WIN-002** One CPU flow and one CUDA flow load application-managed model weights and produce a successful
transcription through the same user-visible provider workflow used on Linux. The CUDA flow uses CUDA without
silent CPU fallback.

**AC-WIN-003** Both functional flows complete without a provider crash or user-visible provider error. No
benchmark result, repeated sample, CI conclusion, package result, or additional qualification evidence is part
of acceptance.

## 15. Documentation and operational evidence

**OPS-003** User/maintainer documentation SHALL explain:

- models are no longer cryptographically authenticated during ordinary download or loading;
- a same-user local replacement may load if it remains a bounded regular parseable model;
- runtime workers remain authenticated and process/file path safeguards remain active;
- corruption may appear only as a sanitized standard-loader failure with explicit delete/redownload guidance;
- the remaining delivery was accepted by direct Windows functional execution rather than performance
  qualification;
- the private path field is excluded from public/retained surfaces; and
- rollback replaces the whole compatible app/worker set.

Existing private hardware/model/run evidence remains outside the repository and SHALL not be deleted by routine
work. Revision 8 requires no new benchmark or qualification evidence.

## 16. Completion criteria

Revision 8 is complete only when:

1. every active requirement maps to an automated or manual acceptance criterion;
2. every superseded snapshot/content-proof requirement is removed from active plan packets;
3. the Windows metadata-only validator and standard path loader behavior match Linux;
4. the Windows development application completes one successful Local Whisper CPU flow and one successful CUDA
   flow as defined by AC-WIN-001–AC-WIN-003;
5. no model-content authentication remains in ordinary installation or loading; and
6. Task 17, benchmark matrices, CI/package qualification, repeated samples, timing/resource evidence, and
   additional acceptance suites are absent from the remaining plan.

Specification approval still authorizes no implementation, commit, push, CI execution, publication, or release.
