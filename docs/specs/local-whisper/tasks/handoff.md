# Local Whisper Handoff

## Authoritative State

- Specification revision 7 and plan revision 12 are Approved.
- Tasks 01–13 are complete and committed; Task 13 is authoritative at
  `37fa79a`.
- Task 14 is complete, locally verified, and intentionally uncommitted for
  review. Task 15 has not started and is not authorized by this handoff.
- AMD remains **Preview · Untested**. macOS remains
  **Planned · Unavailable**. Representative Windows execution remains
  exclusively in Task 19.

## Task 14 Completed

- Added the immutable Windows/Linux CPU, NVIDIA CUDA, AMD Vulkan/HIP Preview,
  and Apple Metal planned/unavailable support policy; exact backend
  prerequisite adapters; composed capability preflight; and selected-
  configuration RAM/VRAM policy with qualified-peak precedence and required
  headroom.
- Added owner-private salt persistence and stable HMAC-SHA-256 opaque device
  IDs. Raw physical identities remain main-private, are never persisted, and
  collision/salt-loss cases fail closed.
- Added the sole mutable `LocalWhisperCoordinator` for atomic prompt-safe
  save/reset, epochs, immutable snapshots, disposable compatibility probes,
  fresh full loads, residency, cache eligibility, cancellation, exact selected
  artifact removal, provider switching, suspend/topology invalidation, and
  exactly-once shutdown.
- Prevented prompt propagation to capability, probe, load, and artifact ports;
  rejected stale asynchronous results; preserved one final lifecycle snapshot;
  and made cancellation win over late worker success.
- Added exact failure/action contracts, capability/coordinator package scripts,
  a profile-gated coordinator verifier, deterministic Linux integration, and
  unit/integration coverage for resource, platform, privacy, cleanup, and
  lifecycle boundaries.

## Changed Files

- Capability and identity:
  `src/main/localWhisper/capability/`,
  `src/main/localWhisper/deviceIdentity/`.
- Coordinator and provider seam:
  `src/main/localWhisper/coordinator/`,
  `src/main/providers/LocalWhisperVoiceProvider.ts`.
- Shared contracts:
  `src/shared/localWhisper/{domain,failures,settings}.ts`.
- Tests:
  `tests/main/localWhisper/{capability,coordinator}/` and focused shared
  Local Whisper domain/failure tests.
- Tooling and workflow state: `scripts/local-whisper/verify-coordinator.ts`,
  `package.json`, `docs/specs/local-whisper/decisions.yaml`, `tasks/todo.md`,
  and this handoff.

## Verification

- Passed every exact Task-14 command: capability tests, coordinator tests,
  deterministic Linux coordinator verification, source and test typechecks,
  ESLint with zero warnings, Prettier, and `git diff --check`.
- Additional regressions passed: all shared Local Whisper tests, focused Local
  Whisper provider/dispatch/registry tests, and the complete unit suite
  (**1,526 passed**).
- Remote CI and representative Windows, AMD, and macOS execution were not run
  and are not claimed.

## Exact Next Step

- Review the uncommitted Task-14 packet. A later explicitly authorized
  `incremental-implementation` invocation may commit only this approved packet
  before separately authorizing and starting Task 15.

## Blockers And Manual Gates

- No deterministic Task-14 implementation blocker remains.
- `real-linux-cpu` requires exact staged CPU runtime/model inputs plus explicit
  local authorization through
  `LOCAL_WHISPER_COORDINATOR_REAL_PROFILE_AUTHORIZED=real-linux-cpu`.
- `real-linux-cuda` requires the exact staged CUDA runtime/model inputs, a
  compatible NVIDIA GPU/driver, and explicit local authorization through
  `LOCAL_WHISPER_COORDINATOR_REAL_PROFILE_AUTHORIZED=real-linux-cuda`.
- The defined `windows-cpu`, `windows-cuda`, and `windows-vulkan` coordinator
  profiles must not run before Task 19.
- Commit, push, pull request, signing, packaging, publication, tag, upload, and
  release authority remain separately gated.
