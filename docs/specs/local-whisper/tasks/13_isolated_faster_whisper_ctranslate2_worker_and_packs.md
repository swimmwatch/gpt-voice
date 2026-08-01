# 13 Isolated Faster-Whisper/CTranslate2 Worker And Packs

## Outcome

GPT-Voice owns a separate isolated Faster-Whisper v1.2.1/CTranslate2 v4.8.1
worker for Windows/Linux x64 CPU and NVIDIA CUDA. It loads one authenticated
model directory through a bounded native streaming reader, consumes canonical
PCM without PyAV, proves the actual CPU/CUDA backend and effective compute type,
and treats confirmed worker termination as the authoritative unload,
cancellation, and VRAM-release boundary. It never receives a model path, uses a
model hub or user Python, eagerly copies `model.bin`, or exposes AMD support.

## Prerequisites

- Local Whisper specification revision 6 and plan revision 9 are approved.
- Tasks 08 and 09 are complete. Task 08 owns the exact Faster-Whisper/
  CTranslate2/Python/NumPy source, patch, wheel, native, compiler, and
  disconnected toolchain locks. Task 09 owns worker protocol, one-use model
  authority, logical slot `3`, launcher, and process bounds.
- Task 13 has separate execution authorization. Tasks 10 and 12 are independent
  engine/backend packets and are not imported into this worker.
- All source and dependency objects are already present locally. No command in
  this packet may contact GitHub, PyPI, Hugging Face, a model hub, or another
  package index.
- Decision `planning.faster-windows-directory-authority` revision 1 is answered
  as `ntcreatefile-root-directory` and is normative here.
- Representative Windows execution is prohibited until Task 19.

## Owned Requirements

- Primary: `RUNTIME-002`, `RUN-008`, `RUN-010`, `PKG-007`.
- Faster engine slices: `SCOPE-001`, `MODEL-004`, `ARCH-005`, `RUN-001`,
  `RUN-002`, `RUN-003`, `RUN-004`, `RUN-005`, `RUN-006`, `RUN-007`, `RUN-009`,
  `SEC-005`, `SEC-010`, `SEC-013`, `CAP-007`, `CAP-017`, `PKG-002`, `PKG-004`,
  `PKG-010`, `CPU-001`, `AMD-005`, `FAIL-005`, `FAIL-007`, `FAIL-008`.
- Primary acceptance: `AC-AUTO-055`.
- Supporting acceptance: `AC-AUTO-002`, `AC-AUTO-008`, `AC-AUTO-010`,
  `AC-AUTO-013`, `AC-AUTO-024`, `AC-AUTO-026`, `AC-AUTO-028`, `AC-AUTO-033`,
  `AC-AUTO-044`, `AC-AUTO-050`, `AC-AUTO-051`, `AC-AUTO-052`, `AC-AUTO-053`,
  `AC-AUTO-054`, `AC-AUTO-056`, `AC-AUTO-061`.

## In Scope

- One isolated embedded-Python worker and project-owned native CTranslate2
  binding/adapter.
- Linux descriptor-relative and Windows `NtCreateFile` RootDirectory-relative
  model-directory readers with identical manifest semantics.
- Complete offline model tree, PCM16-to-float32/NumPy mapping, strict typed
  failures, and real probe-only/full-load worker separation.
- CPU/CUDA device, compute-type, model-weight, and primary-backend proof.
- Fresh-worker load, process-exit unload, hard cancellation/timeout, and reload.
- Separate Windows/Linux CPU and NVIDIA CUDA pack definitions, expected files,
  dependency closure, licenses, SBOM, provenance, and deterministic fixtures.
- Linux execution available in this packet and nonexecuting Windows definitions
  for Task 19.

## Out Of Scope

- AMD HIP/Vulkan, Windows HIP, Metal/macOS, DirectML, or another accelerator.
- `whisperCpp` code reuse beyond shared Task-08 protocol/authority contracts.
- Stock path constructors, stock eager `files` loading for model weights, model
  hubs, tokenizer download, user Python/Conda/site-packages, ambient caches,
  PyAV/FFmpeg inference, VAD, compressed-media decoding, or temporary audio.
- Coordinator/state, IPC/UI, catalog signing, publishing, upload, release, or
  representative Windows execution.

## Task Contract

### Isolated runtime and pack profiles

Package one exact embedded Python ABI/build and only Task 08-locked
Faster-Whisper, CTranslate2, NumPy, bootstrap, native libraries, notices, and
licenses. Run isolated with user site, ambient `PYTHONPATH`, package cache,
dynamic-loader overrides, online resolver, and model cache disabled. The worker
imports only manifest-owned modules from the private pack.

Produce exactly four profiles:

- Windows x64 CPU;
- Linux x64 CPU;
- Windows x64 NVIDIA CUDA;
- Linux x64 NVIDIA CUDA.

CUDA success depends on the system NVIDIA driver being compatible with the
pack-pinned CUDA runtime family. It never requires or searches for a system CUDA
toolkit. Every AMD vendor, HIP/Vulkan backend, or AMD-labeled-as-`cuda` result is
rejected before spawn with `BACKEND_UNSUPPORTED`; release 1 has no Faster AMD
runtime/catalog row.

PyAV and FFmpeg are absent unless a separately approved non-inference pack use
requires them. Even then this worker cannot import or call them.

### Model-directory authority and common reader rules

The full-load worker receives exactly one authenticated read-only model-directory
authority in Task 09's logical slot `3`; probe-only workers receive none. The
worker never receives or reconstructs an absolute, relative, current-working-
directory, drive, UNC, or display path.

The signed model manifest enumerates every direct child required for offline
inference: weight, tokenizer, preprocessor, vocabulary, configuration, and
metadata files. For each child it records one canonical name, regular-file type,
byte size, SHA-256, and role. After safe installation, Tasks 03–04 bind that
signed artifact identity to a private authenticated install record containing
the held root and each child's local mount/volume, file identity, and link-count
evidence. The active lease supplies those local identities; they are not claimed
to be portable signed-catalog values. Reject unknown, missing, duplicate,
case-fold-colliding, nonregular, multiply linked, substituted, or changed
children. Reads use checked positional offsets/lengths, exact-read semantics,
same-open-object size/hash validation, bounded metadata, and no second complete
weight-file copy. Sparse synthetic multi-GiB fixtures must prove bounded
streaming.

The project-owned native CTranslate2 `ModelReader` is the only model access path.
The stock Python `files` bridge is forbidden for `model.bin` because it calls
`.read()` eagerly. Stock path/model-hub/tokenizer/cache fallbacks are removed or
made terminal.

### Linux directory mechanism

Open only a single manifest-declared child relative to the held directory fd.
Reject empty names, `.`, `..`, slash/backslash, NUL, absolute names, and multiple
components before the syscall. Use a no-follow, beneath, no-cross-mount regular-
file open strategy supported by the locked Linux floor; revalidate held-directory
mount/inode and child mount/inode/size/link-count against the active lease and
manifest. Hash and read the same open child descriptor. A kernel/API path that
cannot prove these invariants fails `MODEL_AUTHORITY_INVALID`; it never falls
back to path resolution.

### Windows `NtCreateFile` RootDirectory mechanism

The Windows Faster model-directory reader is supported only on Windows 10 x64
or later (`NT` major version at least `10`); the signed runtime row may require a
higher exact build. Windows 7, 8, 8.1, unknown versions, non-x64, or a row whose
minimum build is not met returns `UNSUPPORTED_PLATFORM` before worker spawn.

Resolve the documented `NtCreateFile` entry only from the system-owned
`ntdll.dll` and bind it behind one narrow injected native interface. For every
child open:

1. Revalidate the held root directory's volume serial/file ID against the active
   Task-08 lease.
2. Accept exactly one signed direct-child UTF-16 name. Reject empty, `.`, `..`,
   NUL, `/`, `\\`, `:`, drive/UNC/device prefixes, alternate data streams,
   trailing dot/space, multiple components, and any name absent from the signed
   manifest. Install-time validation already rejects case-fold collisions.
3. Initialize `OBJECT_ATTRIBUTES` with `RootDirectory` set to the authenticated
   directory `HANDLE` and `ObjectName` set to that relative `UNICODE_STRING`.
   Use `OBJ_DONT_REPARSE`; never pass a full path or ambient root.
4. Call `NtCreateFile` with read-data/read-attributes/synchronize access,
   `FILE_OPEN`, `FILE_SHARE_READ`, and
   `FILE_NON_DIRECTORY_FILE | FILE_SYNCHRONOUS_IO_NONALERT |
FILE_OPEN_REPARSE_POINT`. Request no write, append, delete, ownership, ACL, or
   execute access.
5. Reject any reparse-point result and every directory/special object. Verify
   direct child `FILE_ID_INFO` volume serial/file ID, `FILE_STANDARD_INFO` size
   and single-link state, and immutable attributes against the signed manifest.
6. Hash and serve positional reads from that same child `HANDLE`; close it under
   nonthrowing RAII on every result. Identity/size/hash is checked again before
   accepting load completion.

No Win32 path-open fallback is allowed. `NTSTATUS` and native structures remain
inside the adapter and map to stable failures without raw values. Unit/source
contract fixtures are implemented now; actual Windows compilation, handle,
reparse, identity, race, and multi-GiB streaming execution occurs only in
Task 19.

### Pinned adaptation and PCM mapping

Apply only Task 08's ordered, checksummed patch series to the exact pinned source
objects. Preserve equivalent CTranslate2 loader-length hardening represented by
commit `d9b991e0700933a0c05373df8b52ed89cdcab96d` and Whisper zero-frame handling
represented by commit `f0265420caf1ad654befd94ea99124cdf440e829`.

Consume Task 09's canonical WAV/PCM16 envelope, validate it independently,
convert through checked float32/NumPy sizing, and create no media file or third
complete input copy. Map only canonical multilingual family artifacts,
language/auto detection, initial prompt, integer temperature grid, decoding
strategy, beam/best-of, resolved CPU threads, and reviewed CTranslate2 compute
precision. Emit exactly one final text or one failure; disable timestamps,
segments, partials, translation, diarization, VAD, English-only/Distil models,
condition-on-previous-text, and every unrepresented upstream option.

### Real probe-only contract

`Check compatibility` starts one fresh probe-only worker with no model authority,
model ID, model metadata, or load command. The worker:

- validates exact runtime/protocol and isolated dependency closure;
- activates only the requested CPU or CUDA backend/device/compute type;
- for CPU, proves no CUDA runtime/device initialized and performs one bounded
  synthetic compute dispatch;
- for CUDA, resolves the private runtime-local ordinal through CTranslate2's
  native registry, verifies canonical durable NVIDIA identity, compatible driver
  and manifest-owned runtime libraries, performs bounded allocation/dispatch,
  and returns an authority-challenge-bound native proof;
- allocates no model weights, reports no Loaded/Ready state, closes every
  allocation, terminates, and is observed reaped within Task 09's bound.

A probe process can never receive authority later or become a full-load worker.
Probe success is nonresident evidence only; it does not prove model load, warm-up,
memory sufficiency, transcription, or support-tier qualification.

### Full load, device proof, and lifecycle

Every `Load now` or lazy load starts a different fresh worker with fresh model and
device authorities. CPU load proves exact CPU pack/ISA/effective compute type,
model load/warm-up, and absence of CUDA initialization. CUDA load resolves the
same private native registry contract, proves actual activated NVIDIA device,
effective compute type, positive model-weight bytes on that device, and CUDA as
primary execution backend after load/warm-up. Python strings or echoed ordinals
are not proof.

Successful load retains one serialized-inference process. `Unload` requests a
bounded drain/abort, then always terminates the worker and waits for process,
authority, handle/descriptor, and GPU-allocation closure. CTranslate2 unload or
allocator-cache APIs are optional measurements, never correctness boundaries.
Cancellation and every timeout terminate the worker; late success is discarded.
Reload uses another fresh worker and authorities.

### Complete typed failure matrix

| Condition/stage                                                                                                         | Exact code                                                                                                         | Retry/action                                                                                                                                                   | Resulting state and cleanup                           |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Unsupported OS/architecture                                                                                             | `UNSUPPORTED_PLATFORM` or `UNSUPPORTED_ARCHITECTURE`                                                               | no; `select-supported-configuration`                                                                                                                           | no spawn; Unloaded                                    |
| AMD/HIP/Vulkan or excluded target/backend                                                                               | `TARGET_UNSUPPORTED` or `BACKEND_UNSUPPORTED`                                                                      | no; `select-supported-configuration`                                                                                                                           | no spawn; Unloaded                                    |
| Invalid model/language/decoding/thread/compute-type pairing                                                             | `INVALID_SETTINGS`                                                                                                 | after edit; `edit-settings`                                                                                                                                    | no spawn; prior state unchanged                       |
| Missing/blocked/corrupt/incompatible runtime or dependency                                                              | `RUNTIME_MISSING`, `RUNTIME_BLOCKED`, `RUNTIME_CORRUPT`, `RUNTIME_INCOMPATIBLE`, or `RUNTIME_PREREQUISITE_MISSING` | respectively `download-selected-artifact`, `update-or-remove-artifact`, `redownload-or-remove-artifact`, `select-compatible-artifact`, or `show-prerequisites` | no spawn or terminated; NotReady/Unloaded             |
| Missing/blocked/incompatible selected model before lease                                                                | `MODEL_MISSING`, `MODEL_BLOCKED`, or `MODEL_INCOMPATIBLE`                                                          | respectively `download-selected-artifact`, `update-or-remove-artifact`, or `select-compatible-artifact`                                                        | no spawn; NotReady/Unloaded                           |
| Known RAM/VRAM below the exact selected threshold                                                                       | `INSUFFICIENT_RAM` or `INSUFFICIENT_VRAM`                                                                          | after resources/settings change; `free-resources`                                                                                                              | no spawn; NotReady/Unloaded                           |
| Driver incompatible with pack CUDA runtime                                                                              | `DRIVER_INCOMPATIBLE`                                                                                              | after driver/pack change; `show-prerequisites`                                                                                                                 | terminated; NotReady/Unloaded                         |
| CPU ISA absent                                                                                                          | `CPU_FEATURE_MISSING`                                                                                              | no for profile; `select-supported-configuration`                                                                                                               | terminated; NotReady/Unloaded                         |
| Manifest-owned executable/interpreter cannot start                                                                      | `WORKER_START_FAILED`                                                                                              | after runtime repair; `retry-load-or-change-settings`                                                                                                          | no accepted peer; Unloaded                            |
| CUDA backend activation fails                                                                                           | `BACKEND_INIT_FAILED`                                                                                              | fresh worker after repair; `retry-load-or-change-settings`                                                                                                     | terminated; NotReady/Unloaded                         |
| Durable native identity unavailable                                                                                     | `DEVICE_FEATURE_MISSING`                                                                                           | after topology/runtime change; `refresh-or-select-device`                                                                                                      | terminated; NotReady/Unloaded                         |
| Registry/device/compute/weight/backend proof mismatch                                                                   | `DEVICE_PROOF_FAILED`                                                                                              | fresh enumeration; `refresh-and-retry`                                                                                                                         | evidence Stale; terminated; Failed→Unloaded           |
| Valid bounded allocation fails                                                                                          | `ALLOCATION_FAILED`                                                                                                | after resources/settings change; `free-resources`                                                                                                              | terminated; NotReady/Unloaded                         |
| Missing, writable, replayed, wrong-slot/peer/root authority or unsafe relative-open mechanism                           | `MODEL_AUTHORITY_INVALID`                                                                                          | fresh lease; `retry-load-or-change-settings`                                                                                                                   | close all copies before parsing; NotReady/Unloaded    |
| Declared child missing/changed, reparse/hard-link/cross-volume/identity/size/hash mismatch, or partial same-object read | `MODEL_CORRUPT`                                                                                                    | after redownload/removal; `redownload-or-remove-artifact`                                                                                                      | model Corrupt; terminated; Unloaded                   |
| Hash-matching bounded model structure/loader-length/zero-frame rejection                                                | `MODEL_LOAD_FAILED`                                                                                                | only after runtime/model change; `update-or-change-model`                                                                                                      | bytes preserved; pair NotReady; terminated            |
| Warm-up fails                                                                                                           | `WARMUP_FAILED`                                                                                                    | after settings/runtime/model change; `retry-load-or-change-settings`                                                                                           | terminated; NotReady/Unloaded                         |
| Invalid WAV/container/size/sequence before inference                                                                    | `AUDIO_FORMAT_UNSUPPORTED`                                                                                         | `record-again`                                                                                                                                                 | healthy resident may remain; no inference/result      |
| Inference engine failure or empty final text                                                                            | `TRANSCRIPTION_FAILED` or `EMPTY_TRANSCRIPTION`                                                                    | `retry-operation` only after exact cleanup policy                                                                                                              | no partial/cache/history; uncertain worker terminated |
| Canonical cancellation wins                                                                                             | `CANCELLED`                                                                                                        | `retry-operation`                                                                                                                                              | worker terminated; no late success; Unloaded          |
| Deadline expires                                                                                                        | `OPERATION_TIMEOUT`                                                                                                | `retry-load-or-change-settings`                                                                                                                                | worker terminated; Unloaded                           |
| Worker exits/crashes unexpectedly                                                                                       | `WORKER_CRASHED`                                                                                                   | fresh worker; `retry-load-or-change-settings`                                                                                                                  | discard partial; Unloaded                             |
| Framing/schema/resource/duplicate-response violation                                                                    | `WORKER_PROTOCOL_VIOLATION` or `WORKER_PROTOCOL_MISMATCH`                                                          | only fresh compatible worker; `retry-load-or-change-settings`                                                                                                  | close authorities; terminate; NotReady/Unloaded       |
| Process/authority/allocation release cannot be proved                                                                   | `CLEANUP_FAILED`                                                                                                   | `restart-application`                                                                                                                                          | never report released/Ready; blocking fault           |

Specific model-authority, corruption, protocol, device-proof, allocation, and
cleanup codes take precedence over generic load/crash failures. No matrix row
triggers transparent replay, another engine/backend/device/model/precision, CPU
fallback, clipboard/history/cache success, or raw stderr/native error exposure.

## Contracts And Boundaries

- Task 09 owns all framing, logical slot and one-use authority transfer,
  supervisor deadlines, parent-death/process-tree handling, and renderer-safe
  worker result envelope. Task 13 implements only the Faster peer and reader.
- Task 08 owns source/tree/patch/wheel/toolchain identities and disconnected
  build/staging mechanisms. Task 13 cannot update locks from observed upstream.
- Task 12 owns AMD Preview packs. Faster AMD is unconditionally Unsupported and
  cannot consume those packs or rows.
- Task 14 owns support policy, stable opaque product device IDs, capability
  fingerprints, settings, residency, and coordinator state. Task 13 returns
  private engine proof; it never persists or projects device identity.
- Task 17 may package/sign only Task-13 expected-file-closed packs after licenses
  and provenance pass. Task 13 creates unsigned local staging trees only.
- Task 19 exclusively owns representative Windows compilation/execution,
  `NtCreateFile` RootDirectory/reparse/identity/race proof, CUDA/CPU hardware,
  package, unload, and cleanup evidence.
- No renderer/preload/IPC DTO, argv, routine log, audit, diagnostic, or error
  contains paths, child names, prompt/audio/transcript, Python environment,
  native identities, ordinals, handles, NTSTATUS, or raw dependency data.

## Expected Files Or Components

- `runtime/local-whisper/faster-whisper/` worker, native binding, platform
  directory readers, strict codec, lifecycle modules, tests, and concise README.
- Task 08 Faster/CTranslate2/Python/NumPy source, patch, wheel, and toolchain
  locks plus CPU/CUDA profiles.
- Linux descriptor-relative and Windows `NtCreateFile` RootDirectory adapters
  behind one narrow model-reader interface.
- `scripts/local-whisper/faster-whisper/` disconnected build/stage/closure/
  relocation/clean-start verifier.
- Python/native/cross-language/supervisor fixtures, including sparse model tree,
  probe-only, full-load, failure-matrix, cancellation, and privacy cases.
- Package scripts:
  `format:check:local-whisper:faster-whisper`,
  `lint:local-whisper:faster-whisper`,
  `test:local-whisper:faster-whisper`, and
  `verify:local-whisper:faster-whisper`.
- Linux CI execution and nonexecuting Task-19 Windows workflow definitions.

## Acceptance Criteria

- Runtime starts offline without ambient Python/cache/path/model hub/PyAV and
  loads only manifest-owned dependencies.
- Probe-only workers receive no model authority, perform exact CPU/CUDA bounded
  proof, release everything, terminate, and can never become load workers.
- Linux and Windows readers accept only manifest-declared direct regular
  children under the held root and reject every traversal/reparse/link/
  cross-volume/identity/size/hash race before unsafe parsing.
- Windows source contract uses only `NtCreateFile` with
  `OBJECT_ATTRIBUTES.RootDirectory`; no Win32 path fallback exists, and its
  representative execution remains Task 19-only.
- Sparse multi-GiB weights stream through bounded buffers without a second
  complete model copy; loader-length/zero-frame regressions fail safely.
- CPU/CUDA success proves actual backend/effective precision and, for CUDA,
  positive selected-device weights and primary CUDA execution. Echo, fallback,
  AMD, zero/wrong-device, and changed-registry fixtures fail.
- Every failure-matrix row asserts exact code, stage, retryability, recovery
  action, state transition, and cleanup; no partial transcript or private value
  escapes.
- Unload/cancel/timeout always terminate; reload uses a new process and fresh
  authorities; no success claims release before confirmed exit.

## Verification

Run exactly on Linux with only locked local inputs and synthetic/nonpersonal
fixtures:

```text
rtk npm run format:check:local-whisper:faster-whisper
rtk npm run lint:local-whisper:faster-whisper
rtk npm run test:local-whisper:faster-whisper
rtk npm run verify:local-whisper:faster-whisper -- --profile=fixture-linux-cpu
rtk npm run verify:local-whisper:faster-whisper -- --profile=probe-linux-cpu
rtk npm run verify:local-whisper:faster-whisper -- --profile=reader-linux
rtk npm run typecheck
rtk npm run test:types
rtk git diff --check
```

If an authorized exact model/runtime is locally available, additionally run:

```text
rtk npm run verify:local-whisper:faster-whisper -- --profile=real-linux-cpu
rtk npm run verify:local-whisper:faster-whisper -- --profile=real-linux-cuda
```

An unavailable real profile remains a recorded manual dependency; it cannot be
replaced by a synthetic pass. Define, but do not execute before Task 19:

```text
rtk npm run verify:local-whisper:faster-whisper -- --profile=windows-cpu
rtk npm run verify:local-whisper:faster-whisper -- --profile=windows-cuda
rtk npm run verify:local-whisper:faster-whisper -- --profile=windows-nt-root-directory
```

## Failure And Rollback

- If the authority-relative streaming reader, complete offline dependency tree,
  native device proof, or termination release boundary cannot be proved, keep
  the corresponding pack unavailable; never restore a path/eager/online loader.
- Do not weaken identity, reparse, direct-child, parser, allocation, cancellation,
  privacy, or closure checks for upstream compatibility.
- Roll back only Task-13 worker/binding/scripts/tests and exact task-owned local
  staging roots. Preserve Task 08/09 authority/source locks, installed artifacts,
  settings, and every user or managed data root.

## Manual Gates

- Authorized exact model/runtime inputs for real Linux inference.
- License/redistribution approval for Python, CTranslate2, Faster-Whisper, NumPy,
  CUDA libraries, and models.
- Every representative Windows build/`NtCreateFile`/CPU/CUDA/package/lifecycle
  execution is exclusively Task 19.
- No AMD, Apple Silicon, signing, upload, publication, commit, push, PR, tag, or
  release authority.

## References

- Mandatory task-local contract: `../spec.md` Sections 6, 7.2–7.4, 11.1–11.2,
  15, 18.1, 19, and 20; acceptance `AC-AUTO-008`, `AC-AUTO-010`,
  `AC-AUTO-013`, `AC-AUTO-024`, `AC-AUTO-026`, `AC-AUTO-033`, `AC-AUTO-044`,
  `AC-AUTO-051`, `AC-AUTO-052`, `AC-AUTO-053`, `AC-AUTO-054`, `AC-AUTO-055`,
  `AC-AUTO-056`, `AC-AUTO-061`.
- Task dependencies: `08_deterministic_native_source_and_toolchain_locks.md` and
  `09_shared_worker_protocol_model_authority_and_lifecycle.md`.
- Planning decision `planning.faster-windows-directory-authority` revision 1.
- Commit-pinned Faster-Whisper/CTranslate2 evidence recorded in
  `../decisions.yaml`; implementation must use the locked objects, not live
  GitHub source.

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with exact source/patch/
pack identities, failure/probe/reader coverage, executed Linux checks, deferred
Windows commands, and next eligible Task 14. Present Task 13 for review and
stop. Do not implement Task 14, commit, push, sign, publish, or execute Windows.
