# 09 Isolated Faster-Whisper Runtime

## Outcome

GPT-Voice owns a separate persistent Faster-Whisper worker adapter and
reproducible Windows/Linux x64 CPU and NVIDIA CUDA runtime-pack build inputs.
The pack contains its own reviewed Python, Faster-Whisper, CTranslate2, NumPy,
PyAV, and required native libraries; it never consults user Python, downloads a
model, exposes a listener, or falls back to another engine, backend, device, or
precision.

## Prerequisites

- The Local Whisper plan is approved and Task 09 has separate execution
  authorization.
- Tasks 01, 03, 04, 06, and 07 are complete and provide the same shared
  domain/catalog/path/supervisor and native-quality contracts consumed by Task
  08.
- `docs/specs/local-whisper/spec.md` remains `Status: Approved`.
- Faster-Whisper remains pinned initially to v1.2.1 with one reviewed, exact
  CTranslate2 revision and a complete dependency lock. The pack manifest—not
  a floating Python index—owns every transitive revision and wheel/archive
  hash.
- Task 09 may execute in parallel with Task 08 after shared prerequisites, but
  it must not import or route through the `whisperCpp` adapter.
- Production hosting/publication is deferred by
  `planning.artifact-publishing-target`. This packet produces deterministic
  unsigned staging trees that Task 15 later consumes/signs; no Task-15 output
  or production credential is needed here.

## Owned Requirements

- Engine-specific portions of `SCOPE-001`, `RUNTIME-002`, `MODEL-004`,
  `VRAM-001`, `ARCH-005`, `RUN-001`, `RUN-002`, `RUN-003`, `RUN-005`,
  `SEC-005`, and `PRIV-001`
- Faster-Whisper portions of `PKG-002`, `PKG-004`, `SEC-003`, `COMP-006`,
  `COMP-009`, `CPU-001`, and `AMD-005`
- Worker-side portions of `CAP-007`, `FAIL-005`, and `FAIL-007`
- `AC-AUTO-002` worker-mapping slice, `AC-AUTO-008` CTranslate2 slice,
  `AC-AUTO-010` and `AC-AUTO-013` Faster-Whisper conformance slices,
  `AC-AUTO-024` worker-peer slice, `AC-AUTO-026` isolation/offline slice, and
  `AC-AUTO-028` no-macOS-pack slice, `AC-AUTO-033` canonical-worker-audio
  slice, and `AC-AUTO-044` Faster-Whisper language-mapping slice
- Hardware and release evidence remains owned by Manual Gates; a build or
  mocked success never changes a support tier.

## In Scope

- A minimal in-repository Python worker over the pinned Faster-Whisper API.
- An isolated embedded runtime for Windows/Linux x64 CPU and NVIDIA CUDA.
- Persistent `WhisperModel` ownership with explicit load, warm-up,
  transcription, cancellation boundary, unload, and process shutdown.
- Exact shared-setting mapping, including Faster-Whisper compute precision.
- Offline/local-only model opening from an authenticated CTranslate2 artifact
  path and final-text-only output.
- Reproducible dependency locks, pack content manifests, provenance, SBOM and
  license inputs, deterministic local verification against Task-03 signed
  metadata fakes and Task-07 protocol fixtures, and unsigned staging output for
  later Task-15 consumption.

## Out Of Scope

- AMD HIP/Vulkan support. Faster-Whisper AMD is `Unsupported` in release 1 even
  if a newer CTranslate2 wheel appears.
- macOS, Metal, Apple Silicon CPU, Distil-Whisper, model-hub identifiers, or
  arbitrary CTranslate2 imports.
- User Python, Conda, `pip` on the user device, system `PATH`, user
  `site-packages`, dynamic-loader overrides, or runtime dependency resolution.
- Reusing the `whisperCpp` executable, model format, backend profile, or
  fallback behavior.
- Catalog signing, production origins, public publication, installers, UI,
  IPC, downloads, storage deletion, device-policy decisions, or coordinator
  state owned by later packets.
- Translation, VAD, timestamps, segments, diarization, partial results, or
  automatic retry/replay.

## Task Contract

### Separate persistent worker

1. Implement an engine-specific peer for the canonical Task-01/07 framed
   protocol. The worker has engine identity `fasterWhisper`; it does not share
   mutable state with the `whisperCpp` peer.
2. Launch only a manifest-owned worker entry/executable and embedded interpreter
   with a fixed, allowlisted argument vector. The model path, prompt, audio,
   language, device, precision, and thread count are framed private data, never
   argv or process-title values.
3. The worker keeps one `faster_whisper.WhisperModel` resident. Repeated
   transcriptions reuse it; a different residency key requires unload/process
   replacement through the supervisor.
4. `unload` releases engine references and requests native synchronization/free
   where supported, but confirmed child exit is the deterministic release
   boundary. Do not report RAM/VRAM released while process ownership is
   uncertain.
5. A dedicated protocol-reader/control path must remain responsive while
   inference runs. If CTranslate2 cannot confirm cancellation before the
   canonical bound, report no partial result and let Task 07 terminate the
   worker. Never replay on CPU or another precision.

### Python and native isolation

1. Build one exact Python runtime per OS/architecture and backend family. Lock
   Python, Faster-Whisper v1.2.1, reviewed CTranslate2, NumPy, PyAV, packaging
   bootstrap files, and every native transitive component by version and hash.
2. Run isolated mode with user site disabled, `PYTHONPATH`/loader overrides
   removed, a fixed pack-owned module root, bytecode/cache writes disabled or
   confined to a private ephemeral directory, and no dependency import outside
   the authenticated pack.
3. Set and enforce offline/local-only library behavior. Construct
   `WhisperModel` from the verified local CTranslate2 directory with
   `local_files_only` behavior; never pass a Hugging Face/model-hub ID or call a
   download helper.
4. The worker has no socket/listener/client feature. A network-deny test must
   show zero inference egress after artifacts are installed.
5. Stdout is protocol-only. Python warnings, tracebacks, native exception text,
   model paths, prompt/audio/transcript data, and environment values never
   cross stdout or renderer IPC. Stderr uses only bounded sanitized codes.

### Inference mapping

1. Accept only project-reviewed immutable CTranslate2 conversions for the six
   canonical multilingual model families. Conversion revision is part of model
   identity; compute precision is a residency setting, not model identity.
2. Construct the model with exactly the selected target/device and precision:
   - CUDA: `float16 | int8_float16`, default `float16`;
   - CPU: `int8 | float32`, default `int8`, with resolved thread count.
     Any unsupported value or actual-device mismatch fails before warm-up.
3. Consume canonical PCM16/16 kHz audio through bounded frames, convert it
   in-memory to the exact array representation accepted by Faster-Whisper, and
   create no temporary media file. PyAV remains pack-audited but inference must
   not open an arbitrary path or URL.
4. Map common language IDs explicitly; `auto` maps only to the reviewed
   auto-detection form. Unknown aliases fail before inference.
5. Map decoding deterministically:
   - `greedy`: temperature 0, beam size/candidate count forced to one;
   - `beamSearch`: temperature 0 and submitted beam size `1..10`;
   - `bestOfSampling`: submitted temperature `0.05..1.00` and best-of `1..10`.
     Disable upstream temperature fallback arrays and omit inactive controls.
6. Set task to transcription only and disable VAD/filtering, word timestamps,
   segment/timestamp output, translation, diarization, and interim events.
7. Drain the generator internally and return one final text frame. No segment
   metadata or partial text enters main.

### Build and runtime-pack matrix

| OS / architecture | Pack profile         | Contents/prerequisite                                                                                    | Tier evidence produced here             |
| ----------------- | -------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Windows x64       | `fasterWhisper-cpu`  | Isolated CPU Python/CTranslate2 environment with declared ISA                                            | None; candidate for Windows CPU gate    |
| Linux x64         | `fasterWhisper-cpu`  | Isolated CPU Python/CTranslate2 environment with declared ISA                                            | None; candidate for Linux CPU gate      |
| Windows x64       | `fasterWhisper-cuda` | Isolated CUDA-family environment and redistribution-approved CUDA/cuDNN components; system NVIDIA driver | None; candidate for Windows NVIDIA gate |
| Linux x64         | `fasterWhisper-cuda` | Same contract for Linux x64; system NVIDIA driver                                                        | None; candidate for Linux NVIDIA gate   |

- CPU and CUDA are different immutable packs. The CUDA pack cannot switch to
  the CPU engine on missing driver, allocation, load, or inference failure.
- The manifest declares exact Python ABI, CTranslate2 build/backend, CUDA/cuDNN
  family, compiled compute capabilities, ISA, external driver, protocol, and
  app compatibility.
- No AMD or macOS runtime descriptor, build output, or downloadable fixture is
  emitted.

### Pack output contract

Each local build emits an unsigned staging directory for Task 15 with:

- `bin/local-whisper-faster-worker` or `.exe`, or a fixed pack-owned launcher;
- isolated interpreter/runtime files under a pack-private directory;
- locked worker source/bytecode and only reviewed Python/native packages;
- `runtime-manifest.json` and `expected-files.json` with exact file metadata;
- `provenance.json` including Python, Faster-Whisper, CTranslate2, wheel/archive
  URLs and hashes, toolchain, and adapter revision;
- `sbom.spdx.json`, `THIRD_PARTY_NOTICES.txt`, and all required license texts.

The staging output contains no model weights, cache, downloaded hub metadata,
credentials, signature, or production URL. Task 15 archives/signs local
fixtures; production signing and publication remain blocked.

## Contracts And Boundaries

- Task 07 owns process execution/framing/deadlines/cleanup; this packet owns the
  Faster-Whisper protocol peer and main adapter only.
- Task 03 owns authenticated artifact identity; Task 04 supplies verified
  managed paths. The worker never resolves a renderer-provided path.
- Model conversions are produced by reviewed build/publishing automation, not
  by the desktop app or this runtime-pack installation path.
- The engine adapter maps canonical types and reports actual backend/device,
  runtime/build digest, model digest, and precision without exposing private
  path or native output.
- No Electron/Node native addon is introduced. Python/CTranslate2 crashes stay
  inside the supervised child.
- No mutable module-level environment/manager is allowed; the coordinator owns
  the injected adapter and supervisor.

## Expected Files Or Components

- `runtime/local-whisper/faster-whisper/pyproject.toml`
- `runtime/local-whisper/faster-whisper/requirements.lock` or equivalent exact
  cross-platform hash lock
- `runtime/local-whisper/faster-whisper/worker/`
- `runtime/local-whisper/faster-whisper/pins.json`
- backend-specific build definitions under
  `runtime/local-whisper/faster-whisper/build/`
- `scripts/local-whisper/build-faster-whisper-runtime.mjs`
- `scripts/local-whisper/verify-faster-whisper-runtime.mjs`
- `src/main/localWhisper/engines/FasterWhisperEngineAdapter.ts`
- `tests/main/localWhisper/engines/fasterWhisperEngineAdapter.test.ts`
- `tests/runtime/localWhisper/fasterWhisperWorker.test.ts` or equivalent
- `package.json` scripts:
  - `build:local-whisper:faster-whisper`;
  - `verify:local-whisper:faster-whisper`;
  - `test:local-whisper:faster-whisper`.

Equivalent focused filenames are acceptable only when recorded in handoff.
Generated interpreters, wheels, environments, workers, archives, model files,
signatures, caches, and staging packs must remain ignored and uncommitted.

## Acceptance Criteria

- A protocol fixture proves handshake, probe, one persistent load, warm-up,
  multiple transcriptions, cancellation boundary, unload, and shutdown without
  listener or model reload.
- Tests make user Python, user site, `PATH`, `PYTHONPATH`, loader overrides, and
  model-hub access hostile; the pack still imports only authenticated files and
  performs local inference behavior.
- CPU and CUDA descriptors expose only their exact allowed precision values and
  never route to another target/device/precision.
- AMD and macOS descriptors are absent and rejected even when injected upstream
  metadata claims support.
- Direct non-canonical worker-audio fixtures fail before inference without a
  temporary file; only the shared PCM16/16 kHz payload reaches the engine.
- Every common language and decoding strategy maps deterministically; excluded
  output/features cannot appear in the result schema.
- Model path, prompt, audio, transcript, exception, and environment values are
  absent from argv, process title, stdout diagnostics, stderr fixtures, and
  renderer-safe snapshots.
- Every pack tree matches its expected-files manifest, has complete
  dependency/license/SBOM/provenance inputs, and contains no model or secret.
- An offline/network-deny fixture observes zero worker egress and no attempt to
  resolve a remote model ID.

## Verification

Run deterministic local checks:

```text
rtk npm run test:local-whisper:faster-whisper
rtk npm run verify:local-whisper:faster-whisper -- --profile=fixture-cpu
rtk node --import tsx --test tests/main/localWhisper/engines/fasterWhisperEngineAdapter.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk lint
rtk prettier --check
```

Build CPU/CUDA packs only with their pinned matching toolchain or builder image.
Do not treat a Linux CPU build as Windows or CUDA evidence. Any unavailable
platform/backend verification is recorded explicitly in `handoff.md`.

## Failure And Rollback

- If the pinned Faster-Whisper/CTranslate2 API cannot satisfy persistent local
  load, exact device/precision confirmation, offline opening, or bounded
  cancellation cleanup, stop and return to `/plan`; do not add HTTP, model-hub,
  retry, or fallback behavior.
- An unreviewed wheel/native dependency or redistribution ambiguity blocks that
  pack profile and its catalog entry.
- Rollback removes only this adapter, worker source/build scripts, tests, and
  generated staging outputs. It does not modify `whisperCpp`, persisted
  settings, or installed artifact directories.
- Failed new immutable revisions never overwrite or auto-select an older pack.

## Manual Gates

- `MANUAL GATE — licenses/SBOM/signing`: AC-MAN-012 must approve Python,
  Faster-Whisper, CTranslate2, NumPy, PyAV, CUDA/cuDNN and all transitive native
  files, notices, provenance, SBOM, signatures, and key IDs.
- `MANUAL GATE — Linux NVIDIA`: AC-MAN-001 and AC-MAN-005 are required on the
  available Linux NVIDIA laptop before a Linux CUDA Production label.
- `MANUAL GATE — Windows NVIDIA`: AC-MAN-003 requires separate Windows x64
  NVIDIA hardware; Linux results cannot substitute.
- `MANUAL GATE — CPU`: AC-MAN-002 runs separately for Faster-Whisper on Windows
  and Linux x64.
- `MANUAL GATE — offline`: AC-MAN-006 must confirm installed-artifact inference
  succeeds with network disconnected and emits no request.
- AC-MAN-009 must confirm Faster-Whisper AMD is absent from catalog/UI claims.
- Production hosting, signing credentials, uploads, release mutation, tags, and
  publication remain deferred. This task produces only unsigned local staging
  outputs consumed by Task 15 fixtures.

## References

- Mandatory task-local sections:
  - `../spec.md` Sections 3.1, 5–7.4, 8.3–8.5, 9, 11.2/11.5, 13.4–16, 18,
    and 19;
  - `../decisions.yaml` entries `architecture.inference-engine`,
    `compatibility.engine-platform-matrix`,
    `scope.model-families`, `planning.runtime-source-toolchain`,
    `planning.openwhispr-adaptation-boundary`, and
    `planning.artifact-publishing-target`.
- Evidence baseline:
  - `../../../researches/local-whisper/main.md` Faster-Whisper/CTranslate2,
    packaging/license, device-validation, and platform sections.
- Dependency outputs: protocol/conformance vectors from Tasks 01/07,
  authenticated runtime/model/path contracts from Tasks 03/04, and native
  build/test/lint conventions from Task 06 for any native pack components.

## Completion And Handoff

- Mark Task 09 complete in `todo.md` and record changed files, dependency lock,
  generated local pack profiles, commands, unavailable platform checks, and
  blockers in `handoff.md`.
- Name the exact next unchecked task from `todo.md`; completing Task 09 does not
  authorize Task 10 or Task 15.
- Present the adapter/runtime diff and local verification evidence, then stop.
  Do not commit, publish, upload, or begin another packet in the same invocation.
