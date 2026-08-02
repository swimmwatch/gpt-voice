# Local Whisper Handoff

## Authoritative State

- Specification revision 6 and plan revision 11 are Approved.
- Tasks 01–11 are committed; Task 11 implementation is authoritative at
  `24e268f`. Task 12 is complete, verified, and intentionally uncommitted for
  review under the incremental-implementation boundary.
- AMD remains **Preview · Untested**. No AMD hardware, Windows executable,
  SDK/driver acquisition, remote CI, signing, catalog publication, or release
  operation was performed.

## Completed Task 12

- Added exactly three `whisperCpp` AMD contracts: Windows x64 Vulkan Preview,
  Linux x64 Vulkan Preview, and Linux x64 HIP Preview unavailable without an
  approved exact row. Windows HIP, Faster-Whisper AMD, DirectML, Windows ML,
  and fallback paths remain absent.
- Generalized the worker's compile-time backend, GGML registry, handshake,
  residency, device authority, proof input, and safe failure mapping for CUDA,
  HIP, and Vulkan without changing the Task 11 CUDA/CPU patch identity.
- Added `AmdPreviewValidator` and deterministic GoogleTests for AMD vendor,
  Vulkan 1.3/features/loader/driver/allocation/dispatch, exact HIP
  intersections/dependencies/PCIe atomics/device-node access, and shared
  selected-device model-weight/primary-state proof.
- Added chained patch lock `local-whisper-whisper-cpp-amd-preview-v1`. Its
  Vulkan 1.3 patch SHA-256 is
  `a73142f1a6ae6a76fc72268fe521f09a83412e80147f92cae303dc72c3bfc34a`;
  the final patched manifest is
  `85e3a5687b75b6524b50681a0efe9293381c43accec9b91882deed610daed21f`.
  Task 11's final manifest remains
  `a6215efee754e586d7346a1d6716e3ccc4426cf38efb211c4397789fc2127404`.
- Added contract-only AMD toolchain profiles, the closed Preview matrix,
  Vulkan manifest, HIP pre-signing JSON Schema, negative fixtures, and the sole
  checked-in HIP availability record `unavailable-no-approved-row`. HIP CMake
  configuration fails before build until a future approved exact row exists.
- Added deterministic AMD pack tooling for contract validation, synthetic
  disconnected staging, exact expected-file/dependency closure, relocation,
  malicious-CWD clean start, and fail-closed HIP absence. Synthetic results are
  never promoted to hardware or catalog evidence.
- Added package commands, concise native README guidance, Linux CI contract
  checks, and a disabled Task 19 placeholder in the existing dedicated Windows
  native job. No Windows-native check was moved to Linux.

## Changed Areas

- `runtime/local-whisper/whisper-cpp/`: backend-neutral worker seams, AMD
  validator/tests/contracts/fixtures, CMake, README, and chained source patch.
- `runtime/local-whisper/toolchains/profiles/`: three unqualified AMD contract
  profiles with no acquired or qualified input identities.
- `scripts/local-whisper/amd-packs/` and native build helpers: profile/schema,
  patch, staging, closure, relocation, and clean-start verification.
- `tests/runtime/localWhisper/amdPacks/`, `package.json`, and
  `.github/workflows/pr-checks.yml`: deterministic tests, commands, formatting,
  linting, and platform-owned CI definitions.
- `docs/specs/local-whisper/decisions.yaml`, `tasks/todo.md`, and this handoff.

## Verification

- `format:check:local-whisper:amd-packs`, `lint:local-whisper:amd-packs`, and
  `test:local-whisper:amd-packs` passed; JavaScript contract suite is 7/7.
- Linux Vulkan contract verification passed with exact Task 12 source patch,
  synthetic manifest closure, relocation, and clean-start checks. HIP
  no-approved-row verification passed only by proving configure, stage,
  catalog, download, load, and fallback remain unavailable.
- All three AMD native toolchain JSON contracts passed schema/contract-only
  validation and remain unqualified with null evidence.
- GCC 13 and Clang 18 ASan/UBSan device-proof suites passed 11/11, including
  four AMD tests. Warnings-as-errors, clang-format 18, and clang-tidy 18 passed
  for the changed native surface.
- Repository typecheck, type tests, zero-warning lint, format check, and
  `git diff --check` passed. Remote CI was not run.

## Exact Next Step

- Review the uncommitted Task 12 packet. A later explicitly authorized
  incremental-implementation invocation may commit the reviewed Task 12 scope
  and then open Task 13. Do not start Task 13 in this invocation.

## Remaining Manual Gates

- Acquire and review exact Vulkan/ROCm toolchains and redistribution inputs.
- Approve one complete immutable HIP pre-signing/catalog-row intersection
  before any HIP build, stage, catalog, download, or Ready path exists.
- Execute representative Windows/Linux AMD qualification only in Task 19;
  signing, publication, upload, release, and support-tier promotion remain
  separately authorized operations.
