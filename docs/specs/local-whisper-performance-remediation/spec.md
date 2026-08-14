# Local Whisper Performance Remediation Specification

- Status: Approved
- Date: 2026-08-08
- Updated: 2026-08-14
- Revision basis: repository `e49b5790c6b0b1a6fe417b920da8f45df365fe2f`; relevant native source through `2304c16e6f4251e0bbf77afa96ea83a12558ff6b`
- Approval: revision 2 was explicitly approved in the persistent `spec:local-whisper-performance-remediation` interview on 2026-08-14
- Previous approval: revision 1 is retained as superseded historical evidence
- Decision ledger: [`decisions.yaml`](decisions.yaml)

## 1. Purpose and authority

This specification defines the required remediation for the Local Whisper performance findings selected in
[`2026-08-08-local-whisper-performance-comments-to-address.md`](../../reviews/2026-08-08-local-whisper-performance-comments-to-address.md).
It covers corrected measurement, model-load and installation-path improvements, worker resource lifetime,
backend option pinning, and configurable GPU-path CPU threads.

The approved [`Local Whisper specification`](../local-whisper/spec.md) remains authoritative for provider,
artifact, process, model-authority, privacy, packaging, and release behavior. The approved
[`native review remediation specification`](../local-whisper-native-review-remediation/spec.md) remains
authoritative for native resource safety and quality gates. This specification may strengthen those contracts
but SHALL NOT weaken them to obtain a performance result.

**OUT-001** The outcome SHALL reduce the measured cost of the selected model-load, installation, hashing, and
audio-buffer components on supported Linux x64 and Windows x64 hosts while preserving correctness, security,
thread safety, resource ownership, privacy, and deterministic recovery.

**SCP-003** Approval of this specification authorizes neither planning nor implementation. `/plan` is a
separate, later workflow.

**SCP-007** This revision SHALL reconcile the performance contract with the current C++ implementation. It SHALL
remove obsolete prerequisite work, retain completed native safety foundations as inherited constraints, and keep
only performance behavior that remains unmet.

## 2. Repository-established baseline

**BASE-001** The revision basis above establishes the current implementation snapshot. The following completed
native foundations are inherited and SHALL NOT be recreated as performance work:

- C++20 RAII ownership, the 64-live-lease guard budget, OS descriptor/handle failure evidence, and deterministic
  cleanup;
- fail-stop bounded guard input, exact `LIST` behavior, and typed shared-to-platform command dispatch;
- one hardened project-owned scalar SHA-256 implementation shared by native components, with retained Windows
  CNG filesystem hashing;
- typed native launch failures, binary hardening, ordinary and sanitizer execution, static analysis, bounded
  parser fuzzing, worker TSan, focused GCC coverage, and exact source/build manifests; and
- native structured JSONL diagnostics with a closed schema-version-1 event contract, strict TypeScript
  validation, bounded retained-log/archive handling, and privacy-safe failure behavior.

Native remediation Packets 01–19 are complete at this snapshot. Packet 20's supported-host Windows manual
validation remains pending; hosted Windows Server evidence is not a substitute for that manual gate.

The current source still contains the following performance work:

- source inspection identifies eight full model hashes on a successful Linux load and seven on Windows;
- `appendStagedFile` base64url-encodes raw bytes, the generic transport encodes that text again, `parse_request`
  decodes the outer layer, and `parse_command` decodes the inner layer;
- filesystem-guard protocol version 1 accepts at most 262,144 request-payload bytes before the newline delimiter;
  the delimiter is not part of that payload budget, and a payload byte beyond the limit terminates the guard;
- a 192 KiB raw chunk still cannot fit because its single base64url field alone consumes all 262,144 payload
  bytes before request metadata;
- the typed `WriteFileCommand` already owns decoded raw bytes and both platform backends already write those bytes
  directly;
- the common SHA-256 transform remains scalar and has no runtime hardware dispatch;
- the filesystem guard remains intentionally single-threaded;
- `ExactModelReader` separately hashes the preflight byte stream and the byte stream consumed by whisper.cpp;
- settings schemas remain version 1, and GPU load still derives four CPU threads while GPU residency records no
  resolved thread count;
- native model load still runs real inference warm-up before returning `loaded`, while the later protocol-v1
  `warmup` request only returns `warmed`;
- the complete WAV byte vector remains alive while inference uses the converted float PCM vector; and
- Linux CPU/CUDA profiles pin a broad explicit option set, while Windows profiles still pin only a subset and do
  not yet express equivalent current-value intent.

These source facts are not performance acceptance evidence by themselves.

## 3. Scope

**SCP-001** This work SHALL address all of the following selected findings:

1. privacy-safe phase and resource measurement;
2. reuse of the immediately duplicated validated directory result for runtime and model launch leases;
3. an explicit decision to retain all later freshness, native-authority, preflight, and loader-consumption proofs;
4. single-layer canonical base64url installation chunks under a versioned private protocol;
5. a line-budget-derived chunk limit and a bounded, backpressure-aware write pipeline;
6. x64 runtime-dispatched SHA-256 acceleration with a hardened scalar fallback;
7. early release of the source WAV byte buffer before inference;
8. completion and cross-platform normalization of current-value backend option pinning;
9. a user-configurable GPU-path CPU-thread value; and
10. execution of real inference warm-up through the existing explicit `warmup` request.

**SCP-002** The only new desktop-facing surface SHALL be the Local Whisper GPU CPU-thread setting and its
advanced-settings presentation. Existing typed settings and renderer snapshot boundaries SHALL be updated
coherently. No new privileged IPC channel, preload authority, provider capability, or external API is authorized.

**SCP-004, SEC-003** No metadata-keyed, process-local, or persistent model-digest cache is authorized. Metadata
alone SHALL NOT become a startup content proof.

**SCP-005, PERF-003** Every item in SCP-001 is required. Baseline evidence selects safe parameter values and
proves the result; it does not turn a selected item into measurement-only work.

**SCP-006** This work SHALL NOT add or change provider network requests, browser sessions, microphone capture,
clipboard actions, transcript/history retention, or external publication behavior.

Completed native ownership, typed-command, common-crypto, hardening, diagnostics, and quality-gate work is a
preserved baseline rather than an implementation deliverable of this specification.

### 3.1 Non-goals

The following are explicitly outside scope:

- removing the second Linux native authority-server digest or either `ExactModelReader` digest;
- removing pre-spawn or pre-load freshness proofs;
- model `mmap`, a Linux buffered model reader, a threaded filesystem guard, or concurrent installs;
- a raw binary installation channel;
- replacing the typed `WriteFileCommand` or rewriting Linux/Windows raw-byte backend write methods;
- Windows tiny-read buffering, libuv pool tuning, extra worker threads, or read/hash overlap;
- flash attention, changed ggml/CUDA option values, CUDA-upload-first work, or CUDA JIT cache variables;
- CPU micro-architecture pack variants, ARM acceleration, Apple Silicon, or production macOS support;
- new runtime dependencies, build-host-native flags, packaging-target changes, release publication, or catalog
  rollout; and
- changing model artifacts, their bytes, managed-root layout, history data, or unrelated settings; and
- redesigning native structured-log retention, diagnostics archive ownership, or the closed event schema merely
  to collect performance evidence.

## 4. Entry gates and compatibility

**GAT-001** The former native remediation prerequisites are satisfied at the revision basis: Packets 02, 03, and
05 implemented resource ownership, bounded typed commands, and common SHA consolidation. Performance work SHALL
consume those current contracts and SHALL NOT reopen, duplicate, or weaken them.

**GAT-002** A corrected baseline conforming to Section 5 SHALL exist before any performance-changing result is
accepted.

**GAT-003** Before/after evidence SHALL use the same app revision lineage, authenticated runtime and model
artifacts, host, backend, device, settings, cache-state preparation, and input fixture except for the change being
measured.

**GAT-004** Before planning or implementation begins, and again before qualification, the affected source SHALL
be compared with the revision basis. A later native-remediation, Windows-validation, protocol, worker, profile,
or security change that touches an affected path invalidates stale source counts and requires a refreshed
baseline. Historical hosted evidence SHALL not replace the required representative-host performance evidence.

**CMP-001** Production applicability is Linux x64 and Windows x64. Shared behavior SHALL be equivalent across
both platforms; platform-specific filesystem, process, crypto, and compiler mechanisms MAY differ only where
the parent specification already permits them.

**CMP-002** Local Whisper remains unavailable on macOS for this work. No fallback path or partial native helper
support SHALL be presented as macOS availability.

**CMP-003** No artifact catalog identity, model byte format, managed-root layout, or provider result contract
shall migrate in this work.

**CMP-004, IPC-001** The filesystem-guard private protocol SHALL advance from version 1 to version 2 for
single-layer byte fields. The app and bundled guard SHALL be changed, tested, and shipped as one compatible set.
Every version-1/version-2 mixed pair SHALL reject the peer before interpreting or writing a chunk. There SHALL be
no silent fallback or in-place reinterpretation of `WRITE_FILE`.

**CMP-005** x64 SHA acceleration SHALL support the production GCC/Clang Linux build and MSVC Windows build. A
binary SHALL remain safe on an x64 CPU without the accelerated instruction set.

**CMP-006** The Local Whisper settings document schema and nested settings schema SHALL both advance from 1 to 2. Older builds SHALL report `SETTINGS_VERSION_UNSUPPORTED` and SHALL NOT overwrite the newer document.

## 5. Qualification and measurement contract

### 5.1 Evidence matrix

**QUAL-001** Performance qualification SHALL use exact release-1 catalog artifacts for:

- `base/full` as the ordinary flow;
- `medium/full` as the maximum release-1 file size; and
- `large-v3/q5_0` as the large-model GPU shape.

The matrix SHALL cover representative Linux x64 and Windows x64 CPU and CUDA hosts where the parent support
contract declares the combination eligible. Unsupported or unavailable combinations SHALL be reported as such,
not replaced by another platform or backend.

**OBS-001** Qualification SHALL record cold-cache and warm-cache cases separately and SHALL report units,
sample count, ordering, central value, variance, and uncertainty for:

- every directory proof and native/worker digest phase;
- guarded process creation and authority transfer;
- model preflight, whisper.cpp load, real inference warm-up, and GPU upload/allocation proof;
- installation encode, pipe wait/backpressure, native decode, and native write phases; and
- peak main-process, guard-process, and worker RSS plus GPU VRAM where applicable.

**OBS-002** Before a qualification cell runs, its manifest SHALL fix a minimum of five successful paired
before/after samples, cache preparation, run ordering, resource sampling interval, statistic, and uncertainty
calculation. Failed samples SHALL be reported and SHALL NOT be silently replaced until a desired result appears.
The before/after pair SHALL use the same manifest.

**OBS-003** New measurement instrumentation SHALL be qualification-owned. It MAY consume existing validated
native lifecycle records, but SHALL NOT repurpose the production structured-log or diagnostics archive as a
performance telemetry store. Qualification-only phase evidence SHALL remain separate and SHALL NOT emit absolute
paths, device-native identities, raw native output, or unbounded timing events.

### 5.2 Performance gates

**PERF-001, PERF-004** Each performance-changing item SHALL identify its targeted component before the
before/after run. It passes only when the conservative improvement—reported point estimate minus its uncertainty—
is at least 25 percent. Behavior-neutral instrumentation, protocol separation, and build-option pinning are
correctness-gated rather than assigned an invented speedup.

Targeted components SHALL include, where applicable, directory-proof work, installation codec work,
installation wait/write work, retained SHA-256 work, overlapping audio-buffer memory, and GPU-path CPU work
relative to the legacy four-thread behavior.

**PERF-002** The directory-result change SHALL remove exactly the immediately repeated acquisition-time `LIST`
inspection for runtime and model launch leases. The corrected baseline SHALL show eight Linux and seven Windows
full-model hashes before this change; the corresponding successful post-change flow SHALL show seven and six.
Every later proof point remains.

**PERF-005** Backend option work SHALL make current effective values explicit without changing the effective
runtime behavior. Its acceptance is zero unexplained option drift, not a claimed speedup.

**RES-002** A candidate SHALL be rejected if end-to-end time or any peak resource metric regresses by more than
3 percent after uncertainty on an applicable qualification cell. A component improvement does not waive this
guardrail.

## 6. Model acquisition and digest requirements

**SEC-001** The worker's exact model preflight digest SHALL remain mandatory and SHALL authenticate the bytes read
by preflight.

**SEC-002** The loader-consumption digest SHALL remain mandatory and SHALL authenticate the separate bytes
actually consumed by whisper.cpp.

**SEC-004** Pre-spawn revalidation, pre-load revalidation, the Linux launch proof, the Linux authority-server
proof, and both exact worker reads SHALL remain. The Windows proof sequence SHALL not gain a weaker acceptance
path for parity.

**PERF-006** A launch-lease acquisition SHALL retain the validated entry map from its first `LIST` result and
reuse the matching entry while constructing both runtime and model launch leases. The retained value SHALL be
scoped to that acquisition only and SHALL not become persistent or metadata-only authority.

**PERF-007** Tests SHALL inject a mutation at every retained later revalidation point and prove the operation
still fails closed with no worker residency or artifact publication.

### 6.1 SHA-256 acceleration

**CRY-001** The current consolidated, lifecycle-hardened scalar SHA-256 implementation SHALL be extended with x64
runtime dispatch for supported GCC/Clang and MSVC builds. The acceleration SHALL preserve the current public
`Sha256` state machine, exception contract, source-manifest ownership, and shared vectors. It SHALL:

- select the accelerated path only after a trustworthy runtime CPU-feature check;
- retain the hardened scalar implementation as the universal fallback;
- avoid build-wide `-msha`, `/arch` assumptions that exclude supported CPUs, and host-native builds;
- produce identical results for scalar, accelerated, and retained Windows CNG paths;
- preserve streaming, lifecycle, checked-length, and multi-gigabyte behavior; and
- keep dispatch initialization race-free and immutable after selection.

Windows CNG SHALL remain the existing filesystem-list provider unless separately measured and specified.
Test-only forced scalar, forced accelerated, and simulated-unsupported modes MAY be exposed only inside native
test binaries; they SHALL NOT become production environment variables or command-line controls.

## 7. Installation codec, line budget, and pipeline

### 7.1 Protocol-v2 byte field

**CODEC-001, ARC-004** For protocol version 2, the TypeScript transport SHALL accept a bounded raw-byte field and
encode each installation chunk exactly once as unpadded base64url. The shared guard parser SHALL validate and
decode that field once; `parse_command` SHALL construct the existing typed `WriteFileCommand` from those already
decoded bytes without calling base64url decode again. The existing Linux and Windows backend raw-byte write
contracts SHALL remain unchanged.

**CODEC-002** The decoder SHALL use a bounded inverse lookup and an allocation-free canonical-form check. It SHALL
reject invalid alphabet, padding, impossible unpadded length modulo four, non-zero unused tail bits, integer
overflow, and decoded output beyond the derived field bound before backend write.

**IPC-003** A malformed, non-canonical, oversized, wrong-version, duplicate, late, or mismatched request or
response SHALL never be interpreted as a successful write. Stable content-free errors SHALL not echo payloads,
paths, tokens, or native messages.

### 7.2 Request-payload budget

**INST-001** The raw chunk maximum SHALL be derived from the complete worst-case version-2 request payload,
including the maximum legal request ID, version, command, file token, separators, and encoded bytes. The
calculation SHALL use the guard's canonical 262,144-byte payload limit and an explicit non-zero safety margin
owned by the protocol contract. The terminating newline is transport framing and is not counted in that payload
limit.

No caller SHALL duplicate the limit as an unexplained larger constant. A 262,144-byte payload followed by the
newline SHALL be accepted when all fields are valid. The first non-newline byte beyond that payload limit SHALL
trigger the existing fail-stop overflow behavior before parsing, allocation, or write.

**IPC-004** Protocol version 2 SHALL preserve the current bounded-reader failure distinction: a syntactically
invalid in-budget request receives a bounded error response, while an over-limit request payload terminates the
guard so the transport rejects every pending request. The reader SHALL neither retain nor drain an
attacker-sized overflow line.

### 7.3 Bounded pipelining and backpressure

**THR-001, RES-001** The filesystem guard remains single-threaded. The TypeScript transport MAY overlap issued
requests, but it SHALL own and enforce:

- a measurement-selected maximum in-flight request count;
- a maximum total of 32 MiB across encoded stream buffers, decoded command bytes, queued chunks, and unsettled
  write payloads owned by one installation transfer;
- Node stream backpressure, including suspension after `stdin.write()` returns `false` until `drain`;
- unique request correlation and exactly-once settlement;
- source-order hashing and writing;
- cessation of new issuance after cancellation or first terminal failure; and
- settlement or safe invalidation of every issued request before staging is discarded.

**INST-002** Slow guards, early and mid-window failures, cancellation, EOF, process exit, missing `drain`, late
responses, and timeout SHALL deterministically release pending entries, buffers, staging authorities, file
descriptors/handles, and process-owned resources. No response may resurrect a failed transfer or publish a
partial artifact.

## 8. Worker load, warm-up, and audio lifetime

**FLOW-001** Provider selection, setup, load-now/lazy-load behavior, transcription, cancellation, unload, and
renderer-safe result shapes SHALL remain compatible except for the explicitly documented GPU thread setting.

**WRM-001, IPC-002** Native model load SHALL end in the existing `loaded` state without running the one-second
inference warm-up. The existing worker protocol-version-1 `warmup` request SHALL perform the real inference
warm-up and report its bounded phase evidence before the supervisor enters `warmed`. The existing
`load`/`loaded` then `warmup`/`warmed` wire sequence and message shapes are already compatible and SHALL remain
protocol version 1.

**WRM-002** Residency SHALL be committed only after load evidence, explicit warm-up, device/allocation proof, and
all existing authority checks succeed. A warm-up failure or timeout SHALL return `WARMUP_FAILED` or the existing
stage-specific timeout, terminate or unload uncertain state, and leave no reusable residency.

**LOG-001** The closed native-runtime log schema SHALL remain version 1. Existing events SHALL be repositioned so
`modelLoadStarted`/`modelLoadCompleted` bound model load only, `stateWarming` is emitted when the explicit warm-up
begins, and `stateWarmed` is emitted only after warm-up succeeds. Existing `requestAccepted`, `requestCompleted`,
`nativeFailure`, and allowed `elapsedMs` fields MAY represent the operation without adding event names, sensitive
fields, or a diagnostics schema migration.

**MEM-001** After successful WAV validation and conversion to the float PCM buffer, ownership of the complete
source WAV byte vector SHALL be destroyed or transferred out of the live inference scope before the inference
thread starts. No inference, cancellation, error, or callback path may retain a reference to released storage.
`shrink_to_fit()` alone is not acceptance evidence.

**MEM-002** Malformed audio, conversion failure, cancellation, successful transcription, and a second
transcription in the same resident worker SHALL all preserve deterministic cleanup and transcript correctness.

## 9. GPU-path CPU-thread setting

### 9.1 Public and persisted contract

**CFG-001, THR-002** GPU execution settings SHALL add a distinct `gpuCpuThreads` field. CPU execution settings
retain the existing `cpuThreads` field. The conceptual union is:

```typescript
type LocalWhisperCpuThreads = 'auto' | number;

type LocalWhisperCppExecutionSettings =
  | {
      readonly target: 'gpu';
      readonly backend: LocalWhisperGpuBackend | null;
      readonly deviceId: LocalWhisperOpaqueDeviceId | null;
      readonly gpuCpuThreads: LocalWhisperCpuThreads;
    }
  | {
      readonly target: 'cpu';
      readonly backend: 'cpu';
      readonly cpuThreads: LocalWhisperCpuThreads;
    };
```

**CFG-002, THR-003** `gpuCpuThreads` SHALL accept exactly `auto` or a safe integer from 1 through the current
detected logical processor count. Malformed, fractional, zero, negative, stale-above-host-count, or unknown
values SHALL fail shared validation and SHALL not reach worker launch.

**CFG-003, MIG-001** Migration from a valid version-1 GPU configuration SHALL set `gpuCpuThreads` to `4`,
preserving existing behavior. A new or reset GPU configuration SHALL use `auto`. Existing valid CPU
`cpuThreads` values SHALL migrate unchanged.

**CFG-004, MIG-003** Dependent-selection memory SHALL use target-specific CPU and GPU thread entries. Switching
targets SHALL restore the last valid value for that target and SHALL never copy one target's value over the
other. Legacy CPU selection memory SHALL migrate to the CPU entry; the GPU entry SHALL follow MIG-001.

**MIG-002** Migration SHALL be pure, bounded, deterministic, and side-effect-free until the ordinary atomic
settings save. Unknown safe fields SHALL retain the parent repository's preservation behavior. Invalid or
unsafe fields SHALL fail with the existing content-free settings error.

### 9.2 Resolution and runtime identity

**ARC-003, THR-004** Before worker load, `auto` SHALL resolve through the existing bounded processor-topology
contract to one concrete value from 1 through the detected logical processor count. The worker SHALL confirm or
bound the request against its own current probe. The resolved GPU-path value SHALL participate in worker
residency and every configuration/cache identity that could otherwise reuse stale execution state.

A change to `gpuCpuThreads`, its resolved value, logical processor topology, or configuration epoch SHALL make
the prior worker ineligible for reuse. Existing stale-configuration and cleanup rules apply; work already
running SHALL not be silently transferred to a differently configured worker.

### 9.3 Renderer behavior

**UI-001** The advanced settings area SHALL reuse the existing thread-control interaction. It SHALL show `CPU
threads` and CPU-specific help for the CPU target, and `GPU CPU threads` and GPU-specific help for the GPU target.
Each target displays and edits its independently remembered value.

**A11Y-001** Labels, descriptions, errors, keyboard interaction, focus order, and translated text SHALL identify
the active target and the valid `auto`/integer range. A target switch SHALL not leave a hidden error attached to
the visible target or cause a valid unsaved value to be silently lost.

## 10. Backend build-option contract

**BLD-001** The current broad Linux CPU/CUDA option declarations SHALL be preserved. Every still-implicit
applicable ggml/whisper.cpp CPU and CUDA performance option in the Windows profiles SHALL be proven to exist and
be consumed by the pinned upstream revision, then pinned to its current effective value. Shared options SHALL
express equivalent Linux/Windows intent; a platform-only option SHALL be explicitly classified rather than
silently omitted. The current flash-attention state remains off, and this work SHALL not tune or enable an
option.

Generated CMake cache evidence and exact runtime-pack manifests SHALL demonstrate Linux/Windows intent,
selected-backend exclusivity, and absence of host-default drift. Existing disconnected-build, pinned-toolchain,
runtime-closure, signature, SBOM, and package-identity requirements remain mandatory.

**DEP-001** No new codec, crypto, threading, runtime, or packaged dependency is authorized. Windows CNG and the
project-owned scalar/accelerated SHA implementations are the only relevant crypto providers.

## 11. Thread safety, ownership, and resource invariants

**ARC-001** Main retains privileged filesystem, process, settings, runtime, and provider ownership. Renderer code
uses only the existing typed desktop boundary. Native helpers retain the parent model-authority and process-tree
boundaries.

**ARC-002** Stateful transport, pipeline, settings, worker, and qualification behavior SHALL remain owned by
process-lifecycle classes with injected dependencies. No mutable module-level or native global runtime container
is authorized.

**THR-005** SHA dispatch state SHALL be race-free under concurrent hashing. Once selected for a process, its
immutable dispatch target SHALL not change. Unsupported CPUs SHALL never execute accelerated instructions.

**THR-006** The WAV buffer SHALL be released only after conversion no longer reads it and before inference can
observe the PCM buffer. Cancellation and completion arbitration SHALL retain their existing atomic and
exactly-one-terminal-result contract.

**RES-003** Native resources SHALL use RAII and deterministic non-throwing cleanup. Every success, validation
failure, timeout, cancellation, process exit, and exception path SHALL return descriptors/handles, heap buffers,
pending-map entries, pipe state, staging files, worker state, and device allocations to the parent contract's
defined owner.

## 12. Security and privacy

**PRIV-001** Qualification records MAY contain bounded durations, byte counts, sample counts, anonymized
platform/backend class, and resource aggregates. They SHALL NOT contain model paths or contents, raw or opaque
device identities, private hardware identifiers, audio, transcripts, prompts, credentials, capabilities,
environment dumps, or unrestricted native output.

**PRIV-002** Runtime logs, renderer errors, diagnostics, crash attachments, and CI artifacts SHALL remain
content-free under the parent specification. The current native structured-log decoder, bounded retention,
archive extraction, event levels, line limit, and canonical validation SHALL remain intact. Performance
instrumentation SHALL not create a production telemetry channel.

**SEC-005** Protocol-v2 decode SHALL validate version, request-payload and decoded-size bounds, canonical
base64url, request correlation, typed command shape, and staging authority before write. Validation order SHALL
prevent oversized allocation and partial authority use.

**SEC-006** Removing the immediate `LIST` duplicate SHALL not shorten any later trust-boundary freshness window.
An external same-user writer, identity change, size change, content change, or authority mismatch at a retained
proof point SHALL still fail closed.

**SEC-007** Runtime SHA dispatch SHALL be selected from local CPU feature evidence only. It SHALL not use an
environment variable, ambient library, `PATH`, network input, or user-controlled native address as authority.

**SEC-008** Settings remain private application data. `gpuCpuThreads` and its resolved numeric value are
non-secret configuration, but neither value grants process, filesystem, model, or device authority.

## 13. Failure, recovery, and rollback

**FAIL-001** All new failure paths SHALL use existing stable renderer-safe codes and stages where applicable.
Raw exception text, native output, paths, payloads, and device identities SHALL not cross IPC or enter retained
evidence.

**FAIL-002** No failed optimization path may report partial success. In particular:

| Condition                                                            | Required outcome                                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Missing or inconsistent phase evidence                               | Block performance qualification; do not infer a pass.                                               |
| Protocol-v1/v2 mismatch                                              | Reject before chunk interpretation or write; report the existing protocol/install failure.          |
| Invalid in-budget base64url or request                               | Return a bounded error before backend write; settle the transfer and discard staging.               |
| Request payload beyond 262,144 bytes                                 | Terminate the guard, reject every pending request, discard staging, and expose no partial success.  |
| Pipe failure, missing drain, timeout, cancellation, or late response | Stop issuance, deterministically settle/invalidate issued work, and publish no artifact.            |
| Unsupported SHA instructions                                         | Use the scalar path; an illegal-instruction risk is a qualification failure.                        |
| Model identity change at a retained proof                            | Fail the load and preserve no residency.                                                            |
| Warm-up failure or timeout                                           | Return the existing warm-up/stage error and remove uncertain residency.                             |
| Invalid or stale GPU thread value                                    | Return `INVALID_SETTINGS`/repair state and launch no worker until corrected.                        |
| Settings schema newer than the running app                           | Return `SETTINGS_VERSION_UNSUPPORTED` and do not save.                                              |
| Audio conversion/inference/cancellation failure                      | Release both audio representations according to ownership and preserve exactly one terminal result. |

**FAIL-003** A retry is permitted only after the failed operation's resources have reached the defined safe state.
A successful retry and the next ordinary operation SHALL prove that no stale pending request, staging token,
worker state, digest state, or audio buffer was reused.

**OPS-001** Protocol-v2 app/guard peers, worker behavior behind the retained worker protocol-v1 state sequence,
settings schema 2, renderer validation, and worker residency identity SHALL roll out as coherent compatibility
sets. Mixed filesystem-guard peers SHALL fail closed; authenticated runtime-pack identity SHALL continue to
govern worker compatibility.

**OPS-002** Automatic settings downgrade is forbidden. Rolling back to an older build requires an explicit Local
Whisper settings reset or restoration of a compatible version-1 backup. The newer settings file SHALL not be
silently rewritten by the older build. This specification does not authorize release publication or promise
that a backup is automatically created.

## 14. Acceptance criteria

### 14.1 Automated acceptance

| ID         | Procedure                                                                                                                                                                                                                                                                                                      | Required evidence                                                                                                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-AUT-001 | Validate the qualification phase schema and redaction against complete, missing, malformed, oversized, and sensitive fixtures.                                                                                                                                                                                 | Phase/resource evidence is bounded and complete; sensitive fields cannot be serialized or retained.                                                                                                                                             |
| AC-AUT-002 | Run the locked paired benchmark analysis over passing, sub-25-percent, over-3-percent-regression, and uncertainty-overlap fixtures.                                                                                                                                                                            | Only a conservative targeted-component gain of at least 25 percent with every end-to-end/resource regression at or below 3 percent passes.                                                                                                      |
| AC-AUT-003 | Count model inspections and hashes for runtime/model acquisition on Linux and Windows fixtures before and after result reuse.                                                                                                                                                                                  | The immediate inspection is removed once; baseline full-model counts are 8/7 and post-change counts are 7/6; all retained proofs still execute.                                                                                                 |
| AC-AUT-004 | Mutate identity/content at each retained revalidation point.                                                                                                                                                                                                                                                   | Every mutation fails closed; no residency or published artifact remains.                                                                                                                                                                        |
| AC-AUT-005 | Run shared canonical base64url vectors, empty/boundary inputs, invalid alphabet/padding/modulo/tail-bit cases, the current request fuzz target, and cross-platform guard integration.                                                                                                                          | TypeScript and the shared native parser agree; bytes are decoded exactly once before the existing typed command, both unchanged platform backends receive identical raw bytes, and invalid data is never written.                               |
| AC-AUT-006 | Generate request payloads at 262,144 bytes and one byte over, including maximum legal metadata fields, then exercise newline and EOF framing.                                                                                                                                                                  | The valid boundary payload is accepted; the first over-limit payload byte causes fail-stop guard exit and pending-request rejection before parse/allocation/write on both platforms; newline is excluded from the payload calculation.          |
| AC-AUT-007 | Exercise the bounded pipeline with slow input/output, `stdin.write(false)`, delayed `drain`, early/mid-window failure, timeout, cancellation, EOF, process exit, and late/duplicate responses.                                                                                                                 | Ordering, 32 MiB aggregate bound, exactly-once settlement, staging cleanup, and descriptor/handle baselines hold with no hang or resurrection.                                                                                                  |
| AC-AUT-008 | Run SHA standard, boundary, chunk-split, lifecycle, overflow, and multi-gigabyte-length vectors in scalar, accelerated, and simulated-unsupported modes.                                                                                                                                                       | Digests agree with retained providers; unsupported mode never reaches accelerated instructions; concurrent runs are race-free.                                                                                                                  |
| AC-AUT-009 | Exercise load then explicit warm-up, warm-up timeout/failure, device-proof failure, unload, retry, protocol-order violations, and native-log event ordering.                                                                                                                                                   | Worker protocol remains version 1; `loaded` and `modelLoadCompleted` precede real warm-up; `stateWarming`, `warmed`, and `stateWarmed` occur in order; residency follows total success; failure leaves no reusable state or invalid log record. |
| AC-AUT-010 | Transcribe maximum accepted, malformed, cancelled, and repeated audio fixtures while tracking WAV/PCM ownership.                                                                                                                                                                                               | WAV bytes are no longer live when inference starts; transcript and cancellation behavior remain correct; the next request succeeds.                                                                                                             |
| AC-AUT-011 | Migrate valid/invalid version-1 CPU and GPU settings, target-specific selection memory, safe unknown fields, and version-2 documents.                                                                                                                                                                          | Existing GPU becomes 4, new/reset GPU is `auto`, CPU values are preserved, target memories remain independent, invalid input fails safely, and older-version behavior is deterministic.                                                         |
| AC-AUT-012 | Validate CPU/GPU thread drafts, host-count boundaries, target switches, translated messages, keyboard/focus behavior, saves, and stale configuration epochs.                                                                                                                                                   | UI and shared validation agree; labels are contextual; invalid values launch no worker; a changed resolved value invalidates reuse.                                                                                                             |
| AC-AUT-013 | Compare residency and reusable configuration identities across every GPU thread value, `auto` resolution, topology generation, and configuration epoch.                                                                                                                                                        | Equal execution state compares equal; any effective thread/topology/configuration change compares unequal and cannot reuse stale residency.                                                                                                     |
| AC-AUT-014 | Inspect generated Linux/Windows CMake caches and runtime-pack manifests for all affected CPU/CUDA profiles against the revision basis.                                                                                                                                                                         | Existing Linux declarations remain, Windows closes applicable omissions, platform-only differences are explicit, every option is consumed and pinned to its prior effective value, and no backend/dependency/package drift appears.             |
| AC-AUT-015 | Run affected strict TypeScript checks and the current native quality matrix, including ordinary tests, formatting/lint, source manifests, analyzers, ASan/UBSan, hardened STL/binaries, bounded fuzzing, worker TSan, focused GCC, structured-log privacy, MSVC analysis/ASan, and platform resource evidence. | Every applicable current gate executes and passes without waiver; changed contracts compile with warnings as errors; no leak, race, bounds, logging, ownership, manifest, or cross-platform regression is hidden by an older narrower gate.     |

### 14.2 Manual and representative-host acceptance

| ID         | Procedure                                                                                                                                                                           | Required evidence                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-MAN-001 | On representative Linux x64 CPU and CUDA hosts, run the locked cold/warm baseline and candidate matrix for `base/full`, `medium/full`, and `large-v3/q5_0` where applicable.        | Required phases and resources are present, every targeted change passes 25 percent, and no end-to-end or peak-resource regression exceeds 3 percent outside uncertainty. |
| AC-MAN-002 | Repeat AC-MAN-001 on representative Windows x64 CPU and CUDA hosts using the exact MSVC-built helpers and workers.                                                                  | The same contract passes using Windows process, handle, CNG, stream, and packaging mechanisms; platform variance is reported rather than hidden.                         |
| AC-MAN-003 | Install the maximum release-1 artifact through the real app-to-guard path on both platforms under normal, slow-pipe, cancel, and induced mid-window failure conditions.             | The artifact either publishes exactly with authenticated identity or staging is fully discarded; the app remains usable for a retry.                                     |
| AC-MAN-004 | Change GPU CPU threads through `auto`, 1, 4, and the host maximum; switch CPU/GPU targets; restart; change topology where test hardware permits; and trigger warm-up failure/retry. | Values persist independently, validation and labels are accurate, stale workers are not reused, and recovery requires no manual process cleanup.                         |
| AC-MAN-005 | Attempt a protocol mixed-pair start and settings rollback to an older build using disposable private data, then repeat with explicit reset or a compatible backup.                  | Mixed peers and newer settings fail closed without overwrite; the documented explicit rollback recovers; no managed model/runtime artifact is deleted.                   |
| AC-MAN-006 | Inspect retained benchmark, test, CI, crash, and packaging evidence.                                                                                                                | No path, device identity, audio, transcript, prompt, model content, capability, credential, or unrestricted native/environment data is present.                          |

## 15. Documentation and operational evidence

**OPS-003** User documentation SHALL explain the contextual CPU/GPU thread controls, `auto`, valid range,
version-2 migration defaults, unsupported-newer-settings recovery, and the fact that performance depends on host,
backend, model, and cache state.

Maintainer documentation SHALL record the protocol-v2 payload-budget formula and safety margin, newline framing
semantics, fail-stop overflow behavior, pipeline bounds, phase definitions, qualification manifest,
runtime-dispatch fallback, pinned backend options, retained native-log schema, supported platform matrix, and
exact rollback procedure. It SHALL not publish private paths, device identities, or raw qualification inputs.

## 16. Completion criteria

This specification is complete only when:

- GAT-001 through GAT-004 are satisfied;
- every in-scope requirement and applicable automated criterion passes;
- AC-MAN-001 through AC-MAN-006 provide real Linux x64 and Windows x64 evidence or remain explicit blockers;
- every performance-changing component meets the 25 percent conservative improvement gate and the 3 percent
  end-to-end/resource guardrail;
- the retained digest, model-authority, protocol, cancellation, resource, privacy, and packaging contracts remain
  intact;
- settings and private peers migrate and fail closed exactly as specified;
- no non-goal, new dependency, unsupported platform claim, release action, or unrelated behavior is included; and
- this specification has received explicit approval through the persistent specification interview.
