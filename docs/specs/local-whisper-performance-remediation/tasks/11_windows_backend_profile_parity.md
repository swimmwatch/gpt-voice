# 11 Windows Backend Profile Parity

## Outcome

Prepare the Windows CPU/CUDA profile declarations for every applicable pinned upstream performance option while
preserving the existing effective values, broad Linux declarations, backend exclusivity, and package identity;
execute the Windows configure/build checks only in Packet 17.

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

- Linux-host static AC-AUT-014 audits show all applicable Windows declarations are present and source-consumed,
  platform differences are sourced, and Linux declarations are preserved. Packet 17 must still prove the generated
  Windows caches and runtime-pack manifests.
- CPU and CUDA builds select only their intended backend and retain flash attention off.

## Verification

- `npm run test:local-whisper:native-build-audits`
- `npm run verify:local-whisper:native-toolchain`
- `npm run audit:local-whisper:disconnected-build`
- `npm run test:local-whisper:qualification`
- `npm run format:check`

## Deferred Windows And CI Gate

- Run only the listed static/profile Verification commands on the Linux development host. Do not push or inspect CI
  and do not claim that an MSVC configure or Windows runtime pack was executed.
- Packet 17 runs the CPU configure/build, CUDA contract/cache, runtime-pack, packaging, and rejection checks on the
  Windows runner and regular Windows computer. Packet 18 owns every resulting fix and rerun.
- Record the inventory digest and Linux static-audit results in `handoff.md`; Packet 12 becomes executable after
  local review.

## Failure And Rollback

- Any ignored option, effective-value drift, backend leakage, generated-artifact change, or package identity change
  rejects the packet.
- Rollback removes only added current-value declarations and verifier changes; it must not change Linux values or
  package metadata.

## Manual Gates

- Packet 17 owns all hosted and direct Windows MSVC, contract/cache, and runtime-pack evidence.
- CUDA-unavailable hosted runners report hardware execution unavailable; they may not substitute a Linux cache or
  satisfy Packet 17.

## References

- Specification Sections 4, 5.2, and 10; AC-AUT-014.
- Pinned upstream CMake sources named by the source lock.
- `docs/agent-guides/project-conventions.md` Section “Desktop, Browser, And Packaging.”

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with the option inventory digest, cache checks, and Packet 12
as the next ordered packet, then stop for review.
