# 18 Windows Implementation And Focused Base Qualification

## Outcome

On a real Windows x64 host, implement the Windows metadata-only model-file validator, prove the shared standard
path loader through required Windows CI and package checks, then run the same focused `base/full` CPU/CUDA
cold/warm and packaged lifecycle/privacy qualification used on Linux. Fix each Windows CI failure in a separate
reviewable commit and close the workstream only after every required result is positive.

## Prerequisites

- Packets 16 and 17 are complete. Packet 17 supplies valid Linux Base evidence bound to the reviewed candidate and
  a candidate-only qualification contract that Windows can consume.
- The Windows operator has an authenticated checkout, approved MSVC/Windows SDK/CUDA toolchains, representative
  supported CPU/CUDA hardware, the private 147,951,465-byte `base/full` artifact, one private transcription
  fixture, candidate package inputs, and validated disposable roots.
- Commit and push authority is obtained separately before each action. CI starts only from the exact pushed SHA.
- Existing Linux/Windows private evidence and generated artifacts remain private and must not be deleted.

## Owned Requirements

OUT-001–OUT-003, GAT-002–GAT-004, QUAL-001, QUAL-002, OBS-001–OBS-005, PERF-001,
PERF-004, PERF-008–PERF-012, CMP-001–CMP-009, IPC-005, SEC-001, SEC-002, SEC-004,
SEC-006, SEC-010–SEC-012, ARC-001, ARC-002, ARC-005, ARC-006, BLD-001, DEP-001,
RES-002–RES-004, PRIV-001, PRIV-002, FAIL-001–FAIL-005, OPS-001–OPS-004,
AC-AUT-003–AC-AUT-020 (Windows and final cross-platform portions), AC-MAN-001–AC-MAN-008
(Windows and final portions).

## In Scope

- Windows C++20 `ModelFileValidator` implementation, CMake source selection, RAII ownership, and focused tests.
- Real MSVC CPU/CUDA build and compatibility validation for the Packet 16 protocol-v2/private-path/standard-loader
  candidate without descriptor/handle model authority or model-content proof.
- Required GitHub CI checks on exact pushed SHAs, a separate fix commit for each actionable Windows CI failure,
  and complete reruns until every required result is `success`.
- Candidate Windows package only; four Base timing cells with three candidate loads per cell; one focused packaged
  lifecycle flow per backend; real CUDA ownership; bounded RAM/VRAM; privacy; cleanup; rollback evidence.
- Windows-only remediation and final sanitized cross-platform evidence/documentation.

## Out Of Scope

- Windows simulation on Linux or Linux/fixture evidence represented as a Windows host result.
- A baseline package, paired measurements, other models, p95, variance, uncertainty, relative speedup, 25-percent
  component, 3-percent resource/end-to-end, or absolute-duration qualification gates.
- Installation-window experiments or production selection; suspend/resume, unavailable-device, CPU-thread-count,
  topology/model-switch, or delete/redownload representative matrices.
- Deleting or enabling the deprecated loader as fallback, changing the standard path API, weakening runtime-pack/
  process/path safety, adding dependencies, changing package targets, public IPC/UI work, release publication,
  artifact upload, history rewriting, squashing, or private evidence deletion.
- Shared/Linux production behavior changes. Such a change invalidates affected Linux evidence and requires a
  return to planning before Windows qualification continues.

## Task Contract

1. Execute implementation and representative checks on a real Windows x64 computer. Record the exact checkout or
   bounded source identity, runtime/package identities, MSVC/SDK/CUDA profiles, candidate Base identity, and
   validated private attempt root before building. Never substitute a Linux fixture for Windows execution.
2. Implement the Windows backend corresponding to `model_file_validator_linux.cpp` behind the existing
   `ModelFileValidator` contract. Use strict UTF-8-to-UTF-16 conversion and an RAII-owned `HANDLE`. Require an
   absolute canonical catalog-selected child beneath the managed model root; open the final component without
   following reparse points; reject symlink, junction, any reparse tag, directory, device, non-disk file, stale or
   missing path, and exact-size mismatch. Read no model payload bytes and close the metadata handle before the
   upstream API call.
3. Preserve the explicitly accepted race between metadata validation and the standard API reopen. Call
   `whisper_init_from_file_with_params` exactly once with the canonical path, keep current CPU/CUDA/backend/thread
   options, sanitize parser/allocation/backend failures, clean all partial state, and never invoke the legacy
   reader/preflight/descriptor/handle/snapshot path as fallback.
4. Add focused native tests for a regular exact-size child and for traversal/escape, relative path, wrong size,
   missing/stale path, directory, device/non-disk type, symlink/junction/reparse point, spaces, and non-ASCII path
   behavior. Tests use only validated temporary roots and RAII; no broad recursive user-data operation is allowed.
5. Compile and run the complete Windows compatibility boundary. Mixed protocol peers fail before model open; the
   private path remains bounded and absent from argv, environment, renderer/preload IPC, logs, diagnostics,
   errors/crash output, package evidence, and qualification artifacts. Runtime-pack/executable authentication
   remains independent and fail closed.
6. Confirm ordinary Windows install/load performs zero model-content hashes, signatures, preflight passes,
   snapshots, custom-loader reads, descriptor/handle model handoffs, or loader-consumption proofs. Qualification-
   input authentication remains private harness behavior and cannot leak into production loading.
7. Run the focused Windows commands below. When the implementation is reviewable, create and push its commit only
   with explicit authorization. Run the complete required CI set on that exact SHA and wait for final conclusions.
   Only `success` passes; skipped, cancelled, neutral, stale, action-required, timed-out, or missing results fail.
8. For each actionable CI failure, preserve its non-sensitive evidence, diagnose it, create one separate minimal
   fix commit, obtain push authorization, push, and rerun the complete required CI set. Never amend or squash the
   implementation/fix commits. A check may not be weakened to obtain green status.
9. After CI is green, build and install only the actual candidate Windows package. Verify managed roots containing
   spaces and non-ASCII characters through the packaged path. If the pinned standard API cannot consume a valid
   managed Unicode path, stop for `/spec`; do not copy the model to an ambient path or add a custom loader.
10. Using the locked candidate-only manifest, run CPU cold, CPU warm, CUDA cold, and CUDA warm cells for the exact
    Base artifact. Each cell completes only with exactly three successful candidate loads. Retain ordering,
    durations, median, minimum, maximum, distance from 5,000 ms, bounded phase attribution, peak main/guard/worker
    RSS, and CUDA VRAM. Five seconds and resource magnitude are informational, not pass/fail thresholds.
11. After timed loads, run one sequential packaged flow per backend: load, explicit real-inference warm-up,
    successful transcription, cancel one active request and observe one terminal outcome, unload, retry from a
    clean state, and confirm owned process/resource cleanup. Prove the CUDA flow owns the selected GPU and does
    not silently fall back to CPU.
12. Perform one bounded Windows privacy inspection over logs, diagnostics, errors/crash surfaces, package output,
    and retained evidence. Preserve failed attempts with content-free reasons and use a fresh validated root for
    any disclosed replacement attempt.
13. Audit the final production diff against Packet 17. Any shared/Linux production behavior change invalidates
    affected Linux evidence and stops the packet. A Windows-only or qualification-tool compatibility fix reruns
    its focused tests; rerun Linux representative cells only when their manifest/collection/result semantics were
    changed.
14. Retain only sanitized aggregate Linux/Windows results and exact non-sensitive source/artifact/evidence
    identities. Update operations and rollback documentation to state the accepted same-size replacement risk,
    zero ordinary model-content authentication, five-second informational semantics, private-path constraints,
    inactive deprecated loader, and whole-compatible-build rollback.

## Contracts And Boundaries

- Windows platform APIs stay behind the native validator boundary; shared engine/protocol semantics match Linux.
- No shell execution, ambient `PATH` model resolution, mutable global runtime state, unchecked path, raw resource
  ownership, concurrent load/inference, or private-data disclosure is permitted.
- Generated workers, runtime packs, models, packages, caches, manifests, raw samples, environment/capability dumps,
  and device identities remain uncommitted and unshared.
- CI proves deterministic build/contract behavior; real Windows CPU/CUDA execution separately proves supported-
  host behavior. Neither substitutes for the other.

## Expected Files Or Components

- `runtime/local-whisper/whisper-cpp/core/model_file_validator_windows.cpp` (or the equivalent platform-selected
  Windows translation unit), `runtime/local-whisper/whisper-cpp/CMakeLists.txt`, and native validator tests.
- Windows-focused worker protocol, supervisor/composition, qualification, package, or workflow tests only where
  implementation or real failure evidence requires them.
- Candidate-only Windows qualification adapters/commands/tests under `scripts/local-whisper/qualification/` and
  `tests/scripts/localWhisper/qualification/` where Packet 17 did not already provide platform-neutral support.
- Privacy-safe final cross-platform evidence/documentation plus `tasks/todo.md` and `tasks/handoff.md`.

## Acceptance Criteria

- MSVC CPU/CUDA builds validate the bounded canonical Windows path and metadata, read zero model payload bytes,
  close the metadata handle, and call the standard path API exactly once; every invalid path/type/size/reparse/
  protocol case fails before upstream load without path disclosure.
- All required CI checks conclude `success` on the final exact SHA. Each actionable CI correction exists as a
  separate authorized fix commit followed by a complete CI rerun.
- The candidate package passes spaces/non-ASCII roots and focused CPU/CUDA lifecycle, cancellation, retry,
  cleanup, no-fallback, runtime-authentication, and privacy checks.
- Base CPU/CUDA cold/warm cells each contain exactly three successful candidate loads and report sample ordering,
  median, minimum, maximum, distance from five seconds, bounded RAM/VRAM, and no timing/resource threshold.
- Real CUDA ownership is confirmed with no silent CPU fallback. Linux and Windows evidence remains independently
  attributable and private raw evidence remains retained outside source control.
- Final documentation and evidence describe whole-build rollback, accepted model-replacement risk, inactive
  legacy code, and no release/publication authorization.

## Verification

Run on a real Windows host with pinned project toolchains:

- `npm run test:local-whisper:whisper-cpp:msvc-asan`
- `npm run test:local-whisper:worker-codec:msvc-asan`
- `npm run test:local-whisper:fs-guard:msvc-asan`
- `npm run test:local-whisper:launcher:msvc-asan`
- `npm run test:local-whisper:performance-contracts`
- `npm run test:local-whisper:qualification`
- `npm run test:local-whisper:supervisor`
- `npm run test:local-whisper:composition`
- `npm run test:local-whisper:artifacts`
- `npm run test:local-whisper:filesystem`
- `npm run test:local-whisper:windows-readiness`
- `npm run verify:local-whisper:windows-readiness`
- `npm run produce:local-whisper:windows-runtime-pack:cpu`
- `npm run produce:local-whisper:windows-runtime-pack:cuda`
- `npm run test:local-whisper:windows-application-smoke`
- `npm run test:local-whisper:packaging`
- `npm run verify:local-whisper:packaging:windows-unpacked`
- `npm run run:local-whisper:qualification:windows`
- `npm run verify:local-whisper:qualification:windows`
- Candidate-package CPU/CUDA procedures in Task Contract 9–12.
- `npx prettier --check docs/specs/local-whisper-performance-remediation scripts/local-whisper/qualification tests/scripts/localWhisper/qualification`
- `git diff --check`

Required CI checks after every authorized push:

- `Quality Gates`
- `Local Whisper Performance (Linux)`
- `Local Whisper Performance (Windows)`
- `Local Whisper Native Quality (Linux)`
- `Local Whisper Native Quality (Windows)`
- `Package Smoke (Windows)`
- `Package Attestation (Windows)`

Wait for every required result. Record only the exact SHA, check name, URL or non-sensitive run ID, final
conclusion, and sanitized evidence digest in `handoff.md`.

## Failure And Rollback

- A missing/partial Windows result, non-success CI conclusion, shared/Linux production diff, Unicode-root failure,
  path disclosure, model-content proof, legacy fallback, runtime-authentication weakening, CUDA fallback,
  incomplete cell/lifecycle/resource/privacy evidence, or uncertain cleanup leaves Packet 18 unchecked.
- Preserve all failed private evidence. Retry from a new validated private root only after resources reach a known
  clean state. Give each actionable CI failure its own minimal authorized fix commit and complete rerun.
- Rollback deploys the previous whole compatible app/runtime set. Never reactivate the deprecated loader, mix
  protocol versions, or use a per-load fallback.

## Manual Gates

- `MANUAL GATE`: real Windows host and MSVC/SDK/CUDA toolchains, private model/fixture/runtime/package access,
  package installation, representative CPU/CUDA/cache/lifecycle execution, induced cancellation, and private
  evidence retention.
- `MANUAL GATE`: every commit and push requires separate authorization. CI then runs and must be awaited to a
  final positive result.
- Pull requests, releases, publication, artifact/evidence upload, history rewriting, and private evidence deletion
  remain unauthorized.

## References

- Specification Sections 4–16.
- Packets 16 and 17 for the shared standard-loader contract and valid Linux candidate/evidence identity.
- `docs/agent-guides/project-conventions.md` sections “Dependency Injection And Runtime Ownership”, “Desktop,
  Browser, And Packaging”, “Tests And Documentation”, and “Git And Releases”.

## Completion And Handoff

Mark Packet 18 complete only after the final exact SHA has all required CI conclusions `success`, the installed
candidate package passes focused Windows CPU/CUDA and privacy/cleanup gates, every Base cell has three valid
candidate samples, and final evidence contains no prohibited data. Update `todo.md` and `handoff.md` with commits,
checks, host outcomes, changed files, and rollback status, preserve all private evidence, state that no next packet
remains, and stop without pull request, release, publication, or evidence deletion.
