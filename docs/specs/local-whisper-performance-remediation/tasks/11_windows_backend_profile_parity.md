# 11 Windows Backend Profile Parity

## Outcome

Complete the Windows CPU/CUDA profile declarations for every applicable pinned upstream performance option while
preserving the existing effective values, broad Linux declarations, backend exclusivity, and package identity.

## Prerequisites

- Packet 01 is complete and the pinned whisper.cpp source revision has not changed.
- Current Linux CPU/CUDA profiles remain the comparison baseline; Windows CPU/CUDA profiles remain partial.

## Owned Requirements

CMP-001, PERF-005, BLD-001, DEP-001, AC-AUT-014.

## In Scope

- A pinned-source option inventory, platform applicability classification, Windows profile declarations, generated
  CMake cache verification, runtime-pack manifests, and focused build-audit tests.

## Out Of Scope

- Tuning or changing any effective value, enabling flash attention, changing ggml/CUDA behavior, adding a backend,
  host-native flags, dependencies, package targets, or artifacts.
- AMD preview profiles except where a shared verifier must explicitly classify them as outside this CPU/CUDA scope.

## Task Contract

1. Derive the option inventory from the pinned upstream CMake sources and prove each option exists and is consumed.
   Do not copy an unverified current-upstream list.
2. Preserve every existing Linux declaration and effective value.
3. For each Windows CPU/CUDA-applicable option, pin its current effective value. Classify a genuine platform-only
   option explicitly with source evidence instead of silently omitting it.
4. Keep flash attention off and preserve selected-backend exclusivity, `GGML_NATIVE` policy, disconnected builds,
   pinned toolchains, runtime closure, signatures, SBOM, and package identity.
5. Extend build-audit tests so generated CMake caches and exact runtime-pack manifests fail on missing, ignored,
   duplicated, unknown, or drifted options.

## Contracts And Boundaries

- Profiles are declarative build inputs; no runtime environment override or host-default discovery becomes product
  behavior.
- No generated build directory, runtime pack, cache, binary, or installer is committed.
- Preserve unrelated dirty workflow/runner-policy files; this packet does not own them.

## Expected Files Or Components

- `runtime/local-whisper/toolchains/profiles/windows-x64-cpu-msvc-19.51-v1.json`
- `runtime/local-whisper/toolchains/profiles/windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1.json`
- Linux CPU/CUDA profiles as read-only parity baselines unless a verifier reference must be updated
- Native build/profile verification scripts and `tests/runtime/localWhisper/nativeSources/nativeBuildAudits.test.mjs`
- Runtime-pack reproducibility tests

## Acceptance Criteria

- AC-AUT-014 proves all applicable Windows omissions are closed, platform differences are sourced, every value is
  consumed and unchanged, Linux declarations are preserved, and no dependency/package drift occurs.
- CPU and CUDA builds select only their intended backend and retain flash attention off.

## Verification

- `npm run test:local-whisper:native-build-audits`
- `npm run verify:local-whisper:native-toolchain`
- `npm run audit:local-whisper:disconnected-build`
- `npm run test:local-whisper:qualification`
- `npm run format:check`

## CI Gate And Commit Discipline

- Task-specific CI commands are the complete Verification list above. Windows native quality must configure and
  build the CPU profile, verify the CUDA profile contract/cache without a hardware claim, and reject missing,
  ignored, duplicated, unknown, or drifted options on `${{ vars.CI_WINDOWS_RUNNER }}`. Linux native quality proves
  the existing Linux declarations remain unchanged.
- Required checks for the exact pushed SHA: `Quality Gates`, `Local Whisper Performance (Linux)`,
  `Local Whisper Performance (Windows)`, `Local Whisper Native Quality (Linux)`, and
  `Local Whisper Native Quality (Windows)`.
- After local verification, stop for review and obtain explicit authorization for the implementation commit and
  push. Push the immutable implementation commit and wait until every required check reports `success`; every other
  conclusion is non-passing.
- Fix an actionable CI failure only in a later explicitly authorized invocation and a separate fix commit. Never
  amend or squash the implementation commit; push and rerun the same checks until green.
- Record implementation/fix SHAs, workflow run ID, check names, check-run URLs or IDs, and final results in
  `handoff.md`. Packet 12 remains blocked until the green result is reviewed.

## Failure And Rollback

- Any ignored option, effective-value drift, backend leakage, generated-artifact change, or package identity change
  rejects the packet.
- Rollback removes only added current-value declarations and verifier changes; it must not change Linux values or
  package metadata.

## Manual Gates

- Hosted Windows CI owns ordinary MSVC and contract/cache evidence. Packet 14 produces and inspects the exact CPU and
  CUDA runtime packs on the regular Windows computer without committing generated artifacts.
- CUDA-unavailable hosted runners report hardware execution unavailable; they may not substitute a Linux cache or
  satisfy Packet 14.

## References

- Specification Sections 4, 5.2, and 10; AC-AUT-014.
- Pinned upstream CMake sources named by the source lock.
- `docs/agent-guides/project-conventions.md` Section “Desktop, Browser, And Packaging.”

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with the option inventory digest, cache checks, and Packet 12
as the next ordered packet, then stop for review.
