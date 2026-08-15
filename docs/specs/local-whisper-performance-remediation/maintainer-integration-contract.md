# Local Whisper Performance Integration Contract

This document is the maintainer-facing integration evidence for remediation
Packets 02–12. It records contracts and deferred gates, not raw qualification
measurements. Representative Linux results belong to Packet 13; all Windows
execution belongs to Packet 14; Packet 15 alone selects and freezes the final
installation window and owns subsequent Windows fixes.

## Compatibility set

| Boundary                | Shipped contract                  | Integration rule                                                                                                               |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| App to filesystem guard | Protocol 2                        | App and guard ship together; a version-1/version-2 pair fails before interpreting or writing a chunk.                          |
| App to worker           | Worker protocol 1                 | The existing state sequence and runtime-pack compatibility checks remain unchanged.                                            |
| Native structured logs  | Schema 1                          | The canonical, content-free JSONL contract and its bounds remain unchanged.                                                    |
| Local Whisper settings  | Document 2 and nested settings 2  | Version 1 migrates in memory; a newer version is read-only and fails with `SETTINGS_VERSION_UNSUPPORTED`.                      |
| Runtime and model       | Existing authenticated identities | Runtime-pack identity governs worker compatibility; catalog, model bytes, managed layout, and provider results do not migrate. |

Main retains filesystem, process, settings, model, device, and lifecycle
privileges. Renderer code uses only the typed desktop boundary. Local Whisper
remains unavailable on macOS, and no backend, device, engine, model, or CPU
fallback is introduced.

## Protocol-v2 payload budget

The native `protocol.hpp` constants are canonical and TypeScript mirrors them.
The maximum request payload is 262,144 bytes and excludes the terminating
newline. `WRITE_FILE` reserves a 4,096-byte future margin and derives its raw
chunk limit rather than guessing it:

```text
fixed = max request ID (20)
      + protocol version bytes (1)
      + "WRITE_FILE" bytes (10)
      + base64url(max "lease-" + uint64 token) (35)
      + four tab separators (4)
      = 70 bytes

max encoded chunk = 262,144 - 4,096 - 70 = 257,978 bytes
max raw chunk     = floor(257,978 * 3 / 4) = 193,483 bytes
```

The app appends one newline after enforcing the payload bound. The guard's
bounded reader excludes that newline from the payload. Exactly 262,144 payload
bytes are accepted; observing the first additional byte produces overflow,
fail-stops the guard, rejects all pending requests, and prevents parse,
allocation, or write. EOF after an in-budget unterminated payload is processed
as one line. Base64url is canonical, decoded once, size-checked before
allocation, and then passed to the typed command.

## Installation pipeline

Candidate in-flight windows are exactly 1, 2, 4, and 8. Production remains
bound to window 1, preserving serial source-ordered writes, until Packet 15
selects the first fully qualified cross-platform candidate. Fixture or
single-platform results cannot change that binding.

Every issued write owns a bounded accounting charge for raw and encoded copies.
Admission applies both the selected window and the 32 MiB aggregate owned-byte
cap. Backpressure, timeout, cancellation, pipe failure, process exit, and an
early or mid-window failure stop new issuance, settle all issued work, release
leases, and discard unpublished staging. Promotion occurs only after ordered
size and SHA-256 verification succeeds.

## Qualification contract

Each manifest covers Linux or Windows x64, CPU or CUDA, `base/full`,
`medium/full`, and `large-v3/q5_0`, cold and warm cache states, and every
candidate window. Runs use alternating before/after order, normally plan six
pairs per cache state, and require at least five successful pairs in each cache
state.

The ordered duration phases are:

1. `directoryProofRuntimeAcquisition`
2. `directoryProofModelAcquisition`
3. `directoryProofRuntimePreSpawn`
4. `directoryProofModelPreSpawn`
5. `directoryProofModelPreLoad`
6. `nativeModelGuardDigest`
7. `nativeAuthorityDigest` (Linux only)
8. `workerPreflightDigest`
9. `workerLoaderDigest`
10. `guardedProcessCreation`
11. `authorityTransfer`
12. `modelPreflight`
13. `whisperLoad`
14. `inferenceWarmup`
15. `gpuUploadAllocation` (GPU only)
16. `installationEncode`
17. `installationPipeWait`
18. `installationDecode`
19. `installationWrite`

Peak resources are main, guard, and worker RSS plus GPU VRAM for GPU runs. The
targeted installation component is `installationPipeWait` plus
`installationWrite`. Analysis uses the median of paired percentages and median
absolute deviation. A candidate requires at least 25 percent conservative
target improvement, with the upper conservative end-to-end and peak-resource
regression at or below 3 percent. Missing phases, incomplete pairs, or failed
thresholds block selection; failed samples remain as content-free reasons.

## SHA-256 and backend profiles

On supported x64 GCC, Clang, and MSVC builds, process-local CPUID evidence is
evaluated once and selects an immutable SHA-256 transform. SHA-extension hosts
use the accelerated transform; unsupported hosts use the scalar transform and
never execute accelerated instructions. Selection does not consult the
environment, `PATH`, ambient libraries, network input, or user-controlled
addresses, and concurrent first use is covered by the race-free static
initialization contract.

| Platform/backend | Pinned profile                                 | State for this packet                                     |
| ---------------- | ---------------------------------------------- | --------------------------------------------------------- |
| Linux x64 CPU    | `linux-x64-cpu-baseline-v1`                    | Qualified declarations retained unchanged                 |
| Linux x64 CUDA   | `linux-x64-cuda-12.8.1-sm120a-v1`              | Qualified declarations retained unchanged                 |
| Windows x64 CPU  | `windows-x64-cpu-msvc-19.51-v1`                | Source-complete contract; execution deferred to Packet 14 |
| Windows x64 CUDA | `windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1` | Source-complete contract; execution deferred to Packet 14 |

All four caches pin every applicable whisper.cpp v1.9.1 performance option to
its previous effective value. Windows records source-backed MSVC differences
where F16C, FMA, and AMX switches are unavailable; Windows CUDA records its
guarded `GGML_STATIC=ON` difference. The removed `GGML_CUDA_F16` option is not
invented, and flash attention remains off. Cache verification rejects missing,
duplicate, unknown, ignored, or drifted options. Runtime-pack manifests and
provenance bind the exact profile rather than accepting an ambient build.

## Native logs and privacy

Native log schema 1 is canonical JSONL with a maximum 4,096 bytes including
the newline. It contains a closed component/event/level/error vocabulary, one
launch-scoped process instance ID, a monotonic sequence, and only bounded
optional request, elapsed, and suppression fields. The decoder validates UTF-8,
canonical key order, schema, level, launch identity, and length before
forwarding. Invalid or overlong input is discarded without retaining raw bytes;
pre-composition retention is bounded to 64 validated records.

Documentation and evidence must not contain private paths, native device
identities, raw measurements, audio, transcripts, prompts, credentials,
capability or environment dumps, model contents, or unrestricted child output.
No performance instrumentation creates telemetry.

## Platform and deferred verification matrix

| Platform             | Packet 12 status                                                           | Remaining authority                         |
| -------------------- | -------------------------------------------------------------------------- | ------------------------------------------- |
| Linux x64 CPU/CUDA   | Full local automated matrix runs here; no representative performance claim | Packet 13 representative-host qualification |
| Windows x64 CPU/CUDA | Profiles are contract-checked only; Linux does not substitute for Windows  | Packet 14 CI and direct-host qualification  |
| Linux/Windows AMD    | Existing Preview · Untested status is unchanged                            | Separate approved qualification work        |
| macOS                | Planned · Unavailable; no Local Whisper route                              | Separate approved specification             |

Packet 14 must run, on the exact accumulated candidate SHA, `Quality Gates`,
both Local Whisper Performance jobs, both Local Whisper Native Quality jobs,
`Package Smoke (Windows)`, and `Package Attestation (Windows)`, followed by:

- `npm run verify:local-whisper:qualification:inputs`;
- `npm run produce:local-whisper:windows-runtime-pack:cpu` and
  `npm run produce:local-whisper:windows-runtime-pack:cuda`;
- `npm run run:local-whisper:qualification:windows` and
  `npm run verify:local-whisper:qualification:windows`;
- `npm run test:local-whisper:windows-application-smoke`;
- the paired analyzer for every Windows CPU/CUDA matrix cell and pipeline
  window 1, 2, 4, and 8;
- real Windows filesystem checks for normal, slow-pipe, cancellation,
  mid-window failure, retry, mixed protocol peers, staging cleanup, and handle
  baselines;
- real worker checks for model proof counts, load/warm-up order, failure/retry,
  WAV/PCM lifetime, cancellation, thread identity, stale-residency rejection,
  structured logs, MSVC analysis, and ASan;
- settings and UI checks for schema-v2 fail-closed recovery, `auto`, 1, 4, and
  host-maximum GPU CPU threads, CPU/GPU switching, restart, topology change,
  keyboard operation, screen-reader output, and translations;
- exact CPU/CUDA profile, cache, build, runtime-pack, dependency-closure,
  packaged-startup, package, and privacy inspection.

Packet 14 records failures without fixes or selection. Packet 15 owns each
separate Windows/CI fix commit, the complete Linux/Windows rerun, and final
production-window selection.

## Exact rollback and recovery

Use disposable private data for rollback qualification. A mixed protocol peer
must fail before writing and the coherent app/guard set must then retry cleanly.
A newer settings document must remain byte-for-byte unchanged while load and
save report `SETTINGS_VERSION_UNSUPPORTED`.

Use exactly one recovery path:

1. Invoke the explicit Local Whisper reset in a build that offers the recovery
   action, wait for it to finish, and then close every app instance. Reset
   removes only Local Whisper settings and its private prompt. It does not
   invoke artifact removal, delete runtime/model artifacts, or remove the
   device-identity salt.
2. Close every app instance first, then restore a known-good, complete version-1
   Local Whisper settings backup as a single document before starting the
   compatible build. Do not edit selected fields in a version-2 file or
   synthesize a downgrade. The current repository validates and migrates a
   compatible v1 document in memory without rewriting it; only a later explicit
   save writes version 2.

After either path, reopen the intended build, verify the expected unconfigured
or restored settings state, confirm runtime/model rows remain installed, and
perform an ordinary compatibility check. Artifact deletion is a separate,
confirmed action. No automatic backup is promised. Direct Windows proof of
this procedure remains AC-MAN-005 in Packet 14.

## Focused evidence

- Protocol constants and fail-stop tests:
  `runtime/local-whisper/fs-guard/include/local_whisper/fs_guard/protocol.hpp`
  and `tests/main/localWhisper/filesystem/NativeManagedFilesystemGuardTransport.test.ts`.
- Pipeline bounds and recovery tests:
  `src/main/localWhisper/artifacts/StreamingArtifactExtractor.ts` and its
  focused test.
- Settings migration and recovery tests:
  `tests/main/localWhisper/settings/LocalWhisperSettingsRepository.test.ts`.
- Reset/artifact separation:
  `tests/main/localWhisper/coordinator/LocalWhisperCoordinator.test.ts`.
- Qualification contracts:
  `scripts/local-whisper/qualification/PerformanceQualification.ts` and
  `PerformanceQualificationResultProducer.ts`.
- SHA dispatch, native log, profile, packaging, privacy, and native-quality
  evidence is exercised by Packet 12's recorded verification matrix.
