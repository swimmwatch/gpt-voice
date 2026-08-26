# 16 Linux Standard Loader Implementation

## Outcome

Replace the active Linux ordinary model install/load path with bounded metadata validation followed by one
standard path-based `whisper.cpp` initialization call. Preserve the former authenticated reader, preflight,
model-authority handoff, and model-download proof code in source as deprecated and inactive.

## Prerequisites

- Approved specification revision 6 and approved plan revision 7.
- Packets 01–15 remain complete; do not rewrite their history.
- Start from the current working tree without overwriting unrelated supervisor/test changes or any private
  qualification/runtime artifacts.
- Linux x64 development host with the existing pinned CPU/CUDA native source and toolchains available for
  the applicable local checks.

## Owned Requirements

OUT-001, OUT-003, SCP-001–SCP-009, BASE-001, CMP-001–CMP-009, IPC-001–IPC-005, SEC-001–SEC-012,
ARC-001, ARC-002, ARC-005, ARC-006, CRY-001, CODEC-001, CODEC-002, INST-001, INST-002, FLOW-001,
FLOW-002, WRM-001, WRM-002, LOG-001, MEM-001, MEM-002, CFG-001–CFG-004, MIG-001–MIG-003,
UI-001, A11Y-001, BLD-001, DEP-001, THR-001–THR-006, RES-001, RES-003, RES-004, PRIV-001,
PRIV-002, FAIL-001–FAIL-005, OPS-001, OPS-002, OPS-004, AC-AUT-003–AC-AUT-020 (shared/Linux portions).

## In Scope

- Main-owned catalog selection, managed-root path resolution, metadata-only lease/revalidation, and private
  path transfer for ordinary model loads.
- Worker protocol v2 rollout as one main/launcher/worker compatibility set.
- Linux native regular-file, link, path, and exact-size validation immediately before `whisper.cpp` load.
- Standard CPU/CUDA engine initialization, failure cleanup, cancellation, warm-up, unload, and retry.
- Model installation through approved HTTPS temporary-file/expected-size/atomic-promotion checks without
  model SHA-256, signature, snapshot, or custom reader work.
- Retention and explicit deprecation of the old model-content proof implementation and its focused unit tests.
- Linux local automated tests, native sanitizers, and source/behavior assertions.

## Out Of Scope

- Deleting legacy loader/model-authority source or tests; enabling it as a fallback; feature flags that can
  reactivate it; runtime model-content verification or repair scans.
- Windows platform implementation, compilation, CI, package/E2E checks, simulation, or representative runs.
- Representative Linux qualification, production installation-window selection, commits, pushes, CI
  inspection, release work, or private evidence cleanup.
- New dependencies, GPU architecture families, backend option changes, flash attention, concurrency changes,
  or a five-second runtime timeout.

## Task Contract

1. Add a metadata-only main-owned model load authority that returns the catalog-selected canonical model path,
   expected byte count, active managed lease, and revalidation callback. It must validate that the path is an
   absolute canonical child of the configured managed model root, names the selected catalog entry, and is a
   final regular file with exact catalog size. Reject traversal, symlink/junction/reparse, directory, device,
   FIFO, socket, missing, stale-generation, stale-lease, and size-mismatch cases without reading model bytes.
2. Route ordinary full-load composition through the runtime-authenticated launcher path with no
   `modelGuardAuthority`, descriptor/handle transfer, model digest, or model identity acknowledgment. Retain
   runtime-pack/executable/dependency/process identity validation and process-tree ownership unchanged.
3. Advance the private worker control protocol from v1 to v2 as one compatibility set. The `load` request gains
   required main-produced `modelPath` and `expectedModelBytes` fields. `modelPath` must be valid non-empty UTF-8,
   contain no NUL/control character, and be at most 131,072 UTF-8 bytes; `expectedModelBytes` must be a positive
   safe integer converted to checked `uint64_t`. Neither field may originate in renderer/preload IPC.
4. Remove `modelSha256` from v2 loaded evidence. Return only bounded non-authenticating evidence needed by the
   existing residency/device contract, including exact size and an explicit `metadataOnly` validation marker.
   Mixed v1/v2 peers must fail closed before opening the model.
5. Add a Linux model-file validator behind a narrow platform interface. Immediately before the upstream call,
   validate canonical absolute form, final-component `O_NOFOLLOW` open, `fstat` regular type, and exact size;
   reject link/type/path failures. Close the metadata descriptor deterministically. Do not read payload bytes.
   The accepted revision-6 race after this check and before the upstream reopen remains documented.
6. Change `SpeechEngine`/`WhisperCppEngine` production load input to the canonical path and expected metadata.
   Preserve current backend parameters, RAII context ownership, cancellation checkpoints, and GPU ownership
   proof. The production call must invoke pinned `whisper_init_from_file_with_params` exactly once and must not
   call `whisper_init_from_loader_with_params` or any custom loader/preflight/snapshot/digest path.
7. At the former worker/engine invocation site, retain the old invocation only as a concise commented reference
   adjacent to the replacement. Mark `ExactModelReader`, `ModelFormatPreflight`, descriptor/handle model
   authority, and authenticated model-download proof owners with clear source documentation that they are
   deprecated and retained only for reference/whole-build rollback. Do not use `[[deprecated]]` where existing
   legacy unit tests would turn the warning into a warning-as-error failure.
8. Do not delete or hollow out legacy implementations or their focused tests. Add active-path source and
   behavior tests proving ordinary installation/load code cannot construct or fall back to them, including when
   standard parsing, allocation, backend activation, timeout, or cancellation fails.
9. Add a metadata-only raw-model download request/worker path. It accepts only approved HTTPS source policy,
   expected transfer/file size, temporary destination, cancellation/retry, disk-space/stale-temporary handling,
   and atomic promotion. It performs zero model digest/signature updates or comparisons. Keep runtime-pack and
   other non-model SHA/signature behavior unchanged; retain old authenticated model download code deprecated.
10. Preserve `loaded` before explicit real-inference `warmup`, stable content-free errors, no late success after
    terminal cancellation/timeout, full context/backend cleanup, unload/retry, early WAV release, schema-2
    settings, and current CPU/CUDA thread/backend option behavior.
11. Update protocol vectors, generated checked-in fixtures where already repository-owned, TypeScript/native
    decoders, composition, supervisor validation, qualification source-count assertions, and focused tests. Do
    not commit generated native binaries, runtime packs, packages, caches, or private evidence.

## Contracts And Boundaries

- The path is private main-to-worker control data only. It must never appear in argv, environment variables,
  renderer/preload IPC, logs, diagnostics, error text, crash attachments, qualification output, or handoff text.
- Main retains managed-root/catalog authority. The worker trusts neither renderer data nor ambient `PATH` and
  repeats bounded native metadata checks before the upstream call.
- Standard `whisper.cpp` parsing owns model-byte validation and allocation. A same-size parseable local
  replacement may load undetected and must not be described as authenticated.
- Five seconds is measured acceptance, not a supervisor/native timeout. Existing safe load timeout remains.
- No mutable global runtime state, shell execution, raw resource ownership, or concurrent model load/inference
  is introduced.

## Expected Files Or Components

- `src/shared/localWhisper/protocol.ts` and protocol codec/vector fixtures.
- Main composition, artifact-store/installer, model authority factory, worker lifecycle/supervisor boundaries
  under `src/main/localWhisper/` and their focused tests.
- `runtime/local-whisper/whisper-cpp/` engine, worker application, Linux model-file validator, build definitions,
  and native tests.
- Existing launcher/fs-guard/model-authority and exact-reader/preflight sources receive deprecation comments
  only where needed; they are not deleted.
- Qualification source-count/behavior tests and only documentation inside this specification bundle that must
  reflect the candidate contract.

## Acceptance Criteria

- AC-AUT-005 proves one standard path initialization call for a valid load; AC-AUT-006 proves zero active
  ExactModelReader/preflight/custom-loader/snapshot/model SHA/signature operations in ordinary install/load.
- AC-AUT-003 reports candidate model-content proof counts `0/0`; historical `8/7` and `7/6` fixtures remain
  attributable rather than rewritten.
- AC-AUT-004, AC-AUT-018, AC-AUT-019, and AC-AUT-020 cover path/type/size/stale/protocol failures, sanitized
  cleanup without fallback, accepted same-size replacement, and path non-disclosure.
- Model installation completes by expected size and atomic promotion with zero model-content proof; failure,
  cancellation, retry, cleanup, and serial production pipeline behavior remain deterministic.
- Linux CPU and CUDA native builds/tests preserve pinned backend options, runtime authentication, thread safety,
  warm-up ordering, resource cleanup, and no five-second timeout.

## Verification

Run the smallest focused check after each change, then the applicable local Linux set:

- `npm run test:local-whisper:worker-codec`
- `npm run test:local-whisper:worker-proof-vectors`
- `npm run test:local-whisper:supervisor`
- `npm run test:local-whisper:composition`
- `npm run test:local-whisper:filesystem`
- `npm run test:local-whisper:artifacts`
- `npm run test:local-whisper:qualification`
- `npm run test:local-whisper:whisper-cpp-core`
- `npm run test:local-whisper:whisper-cpp-loader`
- `npm run test:local-whisper:whisper-cpp-cancellation`
- `npm run test:local-whisper:worker-tsan`
- `npm run test:local-whisper:native-hardening`
- `npm run verify:local-whisper:whisper-cpp-cpu -- --profile=linux-x64-cpu-baseline-v1`
- `npm run test:local-whisper:whisper-cpp-cpu-integration`
- Run CUDA build/integration checks only when the authorized Linux host has the real supported CUDA toolchain;
  revision 9 creates no later Linux qualification gate when that hardware is unavailable.
- `npm run lint`
- `npx prettier --check docs/specs/local-whisper-performance-remediation`
- `git diff --check`

No CI check is run or inspected in this packet.

## Failure And Rollback

- Any payload read before upstream initialization, path disclosure, legacy fallback, runtime-authentication
  weakening, mixed-protocol acceptance, cleanup failure, or test regression leaves Packet 16 unchecked.
- Repair local failures inside Packet 16 and rerun the originating check plus affected aggregate checks. Do not
  create a commit unless separately authorized.
- Rollback is the complete pre-candidate app/runtime set. Do not reactivate the commented legacy call or select
  it dynamically.

## Manual Gates

- None for ordinary local verification. Revision 9 removes the former deferred Linux representative-host
  obligation.
- Commits, pushes, CI, package installation, representative workloads, and deletion of private evidence are not
  authorized by this packet.

## References

- Specification Sections 3, 4, 6–13, 14.1, and 16.
- `docs/agent-guides/project-conventions.md` C++, runtime/provider, privacy, and verification sections.
- Packets 03–06, 11, and 15 only for retained contracts and qualification integration points.

## Completion And Handoff

After every applicable local Linux check passes, update `todo.md` and `handoff.md` with changed components,
content-free results, and exact blockers. Under revision 9, [Packet 18](18_windows_final_remediation.md) is the
sole next packet. Stop without commit, push, CI inspection, representative qualification, Windows work, or
evidence deletion.
