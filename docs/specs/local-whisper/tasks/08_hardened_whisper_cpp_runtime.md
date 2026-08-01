# 08 Hardened Whisper.cpp Runtime

## Outcome

GPT-Voice owns a minimal persistent `whisper.cpp` worker adapter and reproducible,
backend-specific runtime-pack build inputs for Windows and Linux x64. The design
adopts only the useful OpenWhispr pattern—pinned backend packs plus a persistent
main-owned manager—and replaces its HTTP server, shared mutable binary directory,
private argv values, unsigned mutable assets, and automatic CPU fallback with the
approved framed-stdio, immutable-revision, no-fallback contract.

## Prerequisites

- The Local Whisper plan is approved and Task 08 has separate execution
  authorization.
- Tasks 01, 03, 04, 06, and 07 are complete:
  - Task 01 supplies the canonical engine/settings/protocol/error vocabulary;
  - Task 03 supplies authenticated catalog and runtime/model manifest contracts;
  - Task 04 supplies anchored managed-file identities and safe runtime paths;
  - Task 06 supplies the native C++ modularity, build, test, lint, and CI
    conventions this worker must follow;
  - Task 07 supplies the process-owned supervisor, framed transport, ownership
    nonce/process identity, deadlines, cancellation, and graceful/forced cleanup.
- `docs/specs/local-whisper/spec.md` remains `Status: Approved`.
- Initial build inputs remain pinned to `whisper.cpp` v1.9.1. A different
  upstream or fork revision requires a catalog/specification revision and fresh
  qualification; no script may resolve `latest`.
- Planning decisions `planning.openwhispr-adaptation-boundary` and
  `planning.artifact-publishing-target` remain active. Production hosting and
  publication are not prerequisites. This packet produces deterministic
  unsigned staging trees that Task 15 will later consume and sign; no Task-15
  output is a prerequisite here.

## Owned Requirements

- Engine-specific portions of `SCOPE-001`, `RUNTIME-001`, `MODEL-004`,
  `VRAM-001`, `ARCH-005`, `RUN-001`, `RUN-002`, `RUN-003`, `RUN-005`,
  `SEC-005`, and `PRIV-001`
- `PKG-003`, the `whisperCpp` portions of `PKG-002`, `PKG-004`, `SEC-003`,
  `COMP-006`, `COMP-009`, `AMD-003`, `AMD-004`, and `AMD-006`
- Worker-side portions of `CAP-007`, `CAP-009`, `FAIL-005`, and `FAIL-007`
- `AC-AUTO-002` worker-mapping slice, `AC-AUTO-008` `ggml` slice,
  `AC-AUTO-010` through `AC-AUTO-013` worker/backend conformance slices,
  `AC-AUTO-024` worker-peer slice, `AC-AUTO-026` worker privacy/offline slice,
  `AC-AUTO-028` no-macOS-pack slice, `AC-AUTO-033` canonical-worker-audio
  slice, and `AC-AUTO-044` `whisperCpp` language-mapping slice
- Hardware and release evidence remains owned by the Manual Gates below; this
  packet cannot promote any support tier.

## In Scope

- A thin in-repository C/C++ adapter over the pinned `whisper.cpp` public API.
- One persistent model context per supervised worker process, with explicit
  probe, load, warm-up, transcribe, cancel, unload, and shutdown handling.
- CPU, CUDA, Vulkan, and Linux HIP build profiles emitted as separate immutable
  runtime-pack content trees.
- Exact mapping from the shared Local Whisper request contract to reviewed
  `whisper.cpp` parameters and final-text-only results.
- Reproducible build-input locks, expected-file manifests, provenance inputs,
  license inventory inputs, deterministic pack verification, and focused tests.
- Deterministic unsigned staging trees and manifest inputs for later Task-15
  signing/package tests; no signed fixture consumption or public upload here.

## Out Of Scope

- Reusing `whisper-server`, opening any loopback/network listener, or sending
  audio/prompt data over HTTP.
- Invoking `whisper-cli` once per transcription; that cannot satisfy persistent
  model residency.
- Importing OpenWhispr's manager, ports, GitHub API downloader, shared `bin`
  directory, mutable release assets, or GPU-to-CPU recovery behavior.
- Faster-Whisper, Python/CTranslate2/PyAV, or any engine routing; Task 09 owns
  that separate runtime.
- Catalog signing, fixture key generation, installer integration, production
  hosting, publication, or release promotion; Task 15 owns the fixture/package
  pipeline and production publication remains a `MANUAL GATE`.
- Capability-policy decisions, support-tier computation, UI, IPC, settings,
  downloads, managed deletion, or coordinator lifecycle owned by Tasks 10–14.
- macOS Metal runtime execution. No macOS worker or runtime pack is produced.

## Task Contract

### Hardened OpenWhispr boundary

1. Preserve the high-level pattern of a persistent main-owned manager selecting
   an immutable backend-specific pack and keeping one model resident.
2. Implement a minimal worker over the pinned `whisper.cpp` API. Do not launch
   an upstream HTTP server or place a listener behind another wrapper.
3. The supervisor starts only the manifest-owned absolute executable with
   `shell: false`, a fixed app-owned working directory, sanitized environment,
   and at most a fixed non-private protocol-mode argument. Model paths, prompts,
   audio, device selections, and settings enter only through framed stdin.
4. A pack is immutable and isolated by exact identity. CPU/CUDA/Vulkan/HIP
   files never share a mutable runtime directory, and a new revision installs
   alongside the old one.
5. The worker never selects another backend, device, model, variant, or CPU
   path after any failure. It reports the exact typed failure and lets the
   supervisor clean up.

### Worker lifecycle and protocol

1. Consume the canonical length-framed protocol and conformance vectors from
   Tasks 01 and 06. Do not create an engine-specific framing dialect.
2. On startup, emit no unsolicited stdout. Complete the canonical handshake
   with protocol version, engine `whisperCpp`, runtime/build digest, compiled
   backend capabilities, frame limits, and process ownership echo.
3. Support the canonical operations:
   - non-resident backend probe;
   - `load` with managed model identity/path, exact target/backend/device,
     model variant, and resolved CPU threads;
   - bounded warm-up using the approved non-personal synthetic input;
   - one request-ID-scoped transcription with bounded audio chunks and request
     settings;
   - cancellation observed through the `whisper.cpp` abort callback;
   - explicit model free/unload and orderly shutdown.
4. Maintain at most one `whisper_context` and one active inference. A second
   load/inference is a protocol violation or conflict, never a hidden queue.
5. `unload` frees the context with the upstream release API. Worker exit remains
   the hard release boundary; if free, cancel, or shutdown does not complete
   within Task 07's bound, the supervisor terminates the process tree.
6. Stdout is protocol-only. Stderr contains bounded generic stage/build codes
   only—never prompt, audio, transcript, full model path, environment, argv,
   device UUID, or raw native exception text.
7. The worker has no network code or dynamic model acquisition and succeeds
   offline with already verified artifacts.

### Inference mapping

1. Accept only the six canonical multilingual model families through a
   verified engine-native `ggml` artifact path. Quantization is represented by
   the selected catalog variant, not an inference precision fallback.
2. Accept only canonical mono PCM16, 16 kHz samples already validated by main.
   Do not create a temporary audio file or decode arbitrary media.
3. Map language through the shared pinned language table; `auto` uses
   `whisper.cpp` language detection. Unknown aliases fail before inference.
4. Map decoding exactly:
   - `greedy`: temperature 0 and one candidate;
   - `beamSearch`: temperature 0 and submitted beam size `1..10`;
   - `bestOfSampling`: submitted non-zero temperature and best-of `1..10`.
     Inactive parameters are omitted/default-disabled, not retained from a prior
     request.
5. Use explicit CPU thread count for CPU residency and the selected compiled
   GPU backend/device for GPU residency. Require the worker result to confirm
   the actual backend/device; a mismatch fails rather than being accepted.
6. Return final transcription text only. Disable translation, VAD, timestamps,
   segments, diarization, interim output, and temperature fallback lists.
7. Discard any partial text on cancellation, timeout, crash, or engine error.

### Build and runtime-pack matrix

Build outputs are separate content trees, never base-installer payloads:

| OS / architecture | Pack profile                      | Compiled backend                                       | Tier evidence produced here             |
| ----------------- | --------------------------------- | ------------------------------------------------------ | --------------------------------------- |
| Windows x64       | `whisperCpp-cpu`                  | CPU with declared ISA baseline                         | None; candidate for CPU gate            |
| Linux x64         | `whisperCpp-cpu`                  | CPU with declared ISA baseline                         | None; candidate for CPU gate            |
| Windows x64       | `whisperCpp-cuda`                 | CUDA with pinned dependency family and compute targets | None; candidate for Windows NVIDIA gate |
| Linux x64         | `whisperCpp-cuda`                 | CUDA with pinned dependency family and compute targets | None; candidate for Linux NVIDIA gate   |
| Windows x64       | `whisperCpp-vulkan`               | Vulkan, no bundled vendor driver                       | Preview fixture only                    |
| Linux x64         | `whisperCpp-vulkan`               | Vulkan, no bundled vendor driver                       | Preview fixture only                    |
| Linux x64         | `whisperCpp-hip-<os-rocm-family>` | Reviewed multi-`gfx` HIP family                        | Preview fixture only                    |

- CPU packs declare required ISA features and may not risk an illegal
  instruction on an unqualified host.
- CUDA packs include only redistribution-approved user-space components and
  declare the system NVIDIA driver prerequisite. They do not install a driver
  or full CUDA toolkit.
- Vulkan packs use the installed hardware ICD and contain no vendor driver.
- HIP packs are split by reviewed OS/ROCm family and enumerate exact AMD
  device IDs and compiled `gfx` targets. There is no generic “try any HIP
  device” build.
- No pack may compile multiple selectable backends and then choose/fallback at
  runtime. The manifest and executable build must agree on exactly one profile.

### Pack output contract

Each local build emits an unsigned staging directory for Task 15, containing:

- `bin/local-whisper-whisper-cpp-worker` or `.exe`;
- only the reviewed backend libraries required by that profile under `lib/` or
  the platform-equivalent private directory;
- `runtime-manifest.json` with every Section 9.1 identity and prerequisite;
- `expected-files.json` with type, mode, exact size, and SHA-256 per file;
- `provenance.json` with upstream archive URL/revision/hash, compiler,
  toolchain/container, flags, and adapter revision;
- `sbom.spdx.json` and `THIRD_PARTY_NOTICES.txt`;
- license texts for `whisper.cpp` and every redistributed dependency.

The build script verifies the upstream v1.9.1 source archive/hash and locked
toolchain inputs. It never writes a signature or production origin. Task 15
archives and signs local fixtures; production signing/publication remains
blocked by its Manual Gate.

## Contracts And Boundaries

- Task 07 owns process spawning, framing transport, timeouts, stderr capture,
  parent-death launcher/Job Object behavior, and force cleanup. This task owns
  only the `whisperCpp` peer and its engine adapter.
- Task 03 owns catalog truth and Task 04 owns safe path handles. The worker may
  consume a managed path only after those services supply a verified identity;
  it must echo the expected build/model digest in handshake/load results.
- The main engine adapter accepts canonical IDs/settings and produces canonical
  worker messages. It receives no renderer authority and resolves no URL/path.
- No native addon is loaded into Electron/Node. A native crash is confined to
  the child process.
- No new module-level mutable service or manager is allowed. The process-owned
  coordinator receives the adapter through constructor injection.
- Engine-specific tests must use public, synthetic, non-personal audio, Task
  03's injected signed catalog/manifest fakes, Task 07 protocol fixtures, and
  the directly verified unsigned staging tree produced in this packet. They
  must not consume Task-15 outputs or download upstream assets implicitly.

## Expected Files Or Components

- `runtime/local-whisper/whisper-cpp/CMakeLists.txt`
- `runtime/local-whisper/whisper-cpp/pins.json`
- `runtime/local-whisper/whisper-cpp/src/` for the minimal framed worker
- `runtime/local-whisper/whisper-cpp/cmake/` for locked backend profiles
- `scripts/local-whisper/build-whisper-cpp-runtime.mjs`
- `scripts/local-whisper/verify-whisper-cpp-runtime.mjs`
- `src/main/localWhisper/engines/WhisperCppEngineAdapter.ts`
- `tests/main/localWhisper/engines/whisperCppEngineAdapter.test.ts`
- `tests/runtime/localWhisper/whisperCppWorker.test.ts` or an equivalent
  protocol-conformance harness
- `package.json` scripts:
  - `build:local-whisper:whisper-cpp`;
  - `verify:local-whisper:whisper-cpp`;
  - `test:local-whisper:whisper-cpp`.

Equivalent focused filenames are acceptable only when the handoff records the
canonical replacement and preserves the ownership boundaries above. Generated
workers, archives, models, signatures, build caches, and staging packs remain
ignored artifacts and are not committed.

## Acceptance Criteria

- The same protocol-conformance suite passes for CPU, CUDA, Vulkan, and HIP
  build descriptors without changing message semantics.
- A load/warm-up/transcription/unload cycle holds one context resident, returns
  final text only, then frees it; repeated requests do not reload the model.
- Model, prompt, audio, and device values are absent from argv, process title,
  logs, and stderr fixtures.
- No socket/listener is created, and a network-deny harness observes zero
  worker egress.
- CPU, CUDA, Vulkan, and HIP failures return exact engine-stage errors and never
  initialize another profile or CPU fallback.
- Cancellation returns no partial text. Confirmed cancellation may keep the
  worker healthy; unconfirmed cancellation is resolved by Task 07 termination.
- Every output tree matches its expected-files manifest and contains no
  undeclared binary, dependency, install script, model, or production secret.
- HIP descriptors fail closed for an unlisted OS/ROCm/device/`gfx`
  intersection; AMD fixture success remains Preview.
- No macOS descriptor, worker, or runtime pack is emitted or accepted, and
  direct non-canonical worker-audio fixtures fail before inference without a
  temporary file.
- The adapter maps every common language ID and every decoding strategy to the
  reviewed upstream parameters with inactive flags disabled.

## Verification

Run deterministic checks without production credentials or public downloads:

```text
rtk npm run test:local-whisper:whisper-cpp
rtk npm run verify:local-whisper:whisper-cpp -- --profile=fixture-cpu
rtk node --import tsx --test tests/main/localWhisper/engines/whisperCppEngineAdapter.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk lint
rtk prettier --check
```

Run backend compilation only on the matching pinned toolchain/host or builder
image. A successful compile or mocked protocol test is not hardware evidence.
Record unavailable Windows, CUDA, Vulkan, and HIP builds in the handoff rather
than substituting the Linux CPU fixture.

## Failure And Rollback

- If the pinned API cannot provide persistent load/free, selected-device
  confirmation, or abort semantics without a listener/fallback, stop and return
  to `/plan`; do not import `whisper-server` behavior or weaken the protocol.
- A backend build that requires an unreviewed driver/library is omitted and its
  catalog entry remains absent; do not broaden prerequisites automatically.
- Rollback removes the new adapter/build scripts and any generated local staging
  directories. It does not delete user-installed artifacts or change selected
  settings.
- Old immutable runtime revisions remain selectable until explicitly removed;
  a failed new pack never overwrites them.

## Manual Gates

- `MANUAL GATE — licenses/SBOM/signing`: AC-MAN-012 must approve every
  redistributed CPU/CUDA/Vulkan/HIP file, provenance record, notices, SBOM,
  signature, and key ID before catalog inclusion.
- `MANUAL GATE — Linux NVIDIA`: AC-MAN-001, AC-MAN-004, and AC-MAN-005 on the
  available NVIDIA laptop are required before a Linux CUDA Production label.
- `MANUAL GATE — Windows NVIDIA`: AC-MAN-003 requires separate representative
  Windows x64 NVIDIA hardware; Linux evidence cannot substitute.
- `MANUAL GATE — CPU`: AC-MAN-002 runs separately for Windows/Linux x64.
- `MANUAL GATE — AMD`: AC-MAN-009 permits only explicitly untested Preview
  claims. AC-MAN-010 on physical Windows Vulkan and Linux Vulkan/HIP hardware
  is required for any future promotion.
- Production hosting, signing credentials, upload, release mutation, tag, and
  publication are explicitly deferred. Task execution may create only local
  unsigned staging packs; Task 15 later consumes/signs them under its own
  authorization.

## References

- Mandatory task-local sections:
  - `../spec.md` Sections 3.1, 5–7.4, 8.3–8.5, 9, 11, 13.4–16, 18, and 19;
  - `../decisions.yaml` entries `architecture.inference-engine`,
    `compatibility.engine-platform-matrix`,
    `planning.runtime-source-toolchain`,
    `planning.openwhispr-adaptation-boundary`, and
    `planning.artifact-publishing-target`.
- Evidence baseline:
  - `../../../researches/local-whisper/main.md` engine, AMD, packaging, and
    test-environment sections;
  - OpenWhispr commit `bf8b7e0` as a pattern reference only. Its HTTP,
    fallback, argv, downloader, and shared-bin choices are explicitly rejected.
- Dependency outputs: canonical protocol/conformance vectors from Tasks 01/07,
  authenticated runtime/path contracts from Tasks 03/04, and native build/test/
  lint conventions from Task 06.

## Completion And Handoff

- Mark Task 08 complete in `todo.md` and record changed files, generated local
  pack profiles, exact commands, unavailable platform checks, and blockers in
  `handoff.md`.
- Name Task 09 as the next packet if it remains unchecked; Task 08 does not
  authorize executing it.
- Present the adapter/runtime diff and local verification evidence, then stop.
  Do not commit, publish, upload, or begin another packet in the same invocation.
