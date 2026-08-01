# Local Whisper Handoff

## Authoritative State

- Specification revision 6 is Approved.
- Plan revision 9 and replacement Tasks 08–19 are Approved by durable Prompt
  MCP answer `approval.plan-revision-9`, sequence 40, revision 1. The
  revision-8 graph and former Task-08 execution authorization are stale.
- Tasks 01–07 remain complete at `d0083259`, `d516d034`, `14749e88`,
  `649ec3b9`, `32440674`, `e294e8a`, and `31c13c54`.
- No implementation continuation, source import, commit, push, PR, packaging,
  signing, publication, or release is authorized.
- Every representative Windows execution belongs exclusively to Task 19.
  Tasks 08–18 may define Windows code, source-contract tests, profiles,
  fixtures, and non-triggered CI/jobs, but may not execute or claim
  representative Windows evidence.

## Revision-9 Planning Changes

Updated authoritative artifacts: `../spec.md`, `../decisions.yaml`, `plan.md`,
`todo.md`, and `handoff.md`.

Completed packets modified only to repair final-gate references:

- `04_managed_filesystem_safety.md`: representative Windows filesystem
  execution now points to Task 19.
- `06_native_cpp_modularization.md`: representative Windows/MSVC and
  filesystem evidence now points to Task 19; its separate packaging ownership
  reference to Task 17 remains correct.
- `07_framed_worker_supervisor.md`: representative Windows launcher/process
  evidence and post-completion repair ownership now point to Tasks 19 and 09.

Deleted superseded packets:

- `08_hardened_whisper_cpp_runtime.md`
- `09_isolated_faster_whisper_runtime.md`
- `10_device_capability_validation.md`
- `11_coordinator_residency_and_lifecycle.md`
- `12_protected_ipc_and_settings_service.md`
- `13_provider_settings_ui.md`
- `14_artifact_capability_and_residency_ui.md`
- `15_packaging_and_signed_fixture_pipeline.md`
- `16_migration_privacy_diagnostics_and_docs.md`
- `17_integration_and_qualification_gates.md`
- `18_future_native_hardening_and_macos_readiness.md`

Added replacement packets:

- `08_deterministic_native_source_and_toolchain_locks.md`
- `09_shared_worker_protocol_model_authority_and_lifecycle.md`
- `10_hardened_whisper_cpp_core_and_cpu_pack.md`
- `11_whisper_cpp_device_proof_cancellation_and_cuda_pack.md`
- `12_amd_vulkan_and_linux_hip_preview_packs.md`
- `13_isolated_faster_whisper_ctranslate2_worker_and_packs.md`
- `14_capability_coordinator_residency_and_lifecycle.md`
- `15_protected_ipc_composition_and_provider_selection.md`
- `16_local_whisper_settings_and_status_ui.md`
- `17_signed_envelope_packaging_and_fixture_ci.md`
- `18_migration_privacy_diagnostics_and_macos_skeleton.md`
- `19_integration_and_qualification_gates.md`

Added plan-audit tooling:

- `acceptance-owners.schema.json`
- `acceptance-owners.json` is the machine-readable Tasks 01–19 command
  and unique `AC-AUTO-001`–`AC-AUTO-062` primary-owner registry. It currently
  passes the structural validator and must remain synchronized through the
  final audit.
- `scripts/local-whisper/validate-task-plan.mjs` rejects missing/extra packets,
  incomplete replacement packet sections, absent exact `rtk` commands, and
  missing, duplicate, unknown, or cross-task acceptance owners.

`spec.md` received editorial final-qualification cross-reference repairs, and
`decisions.yaml` records the Windows Faster-Whisper directory-authority,
revision-9 audit, and durable plan-approval decisions.

## Preserved Dirty Protocol/Supervisor Checkpoint

The dirty worktree contains unreleased protocol-v1 and supervisor work started
under the superseded graph. Preserve it exactly through Task 08; replacement
Task 09 must reconcile and complete it rather than overwrite or discard it:

- `src/shared/localWhisper/protocol.ts`
- `src/main/localWhisper/supervisor/LocalWhisperWorkerSupervisor.ts`
- `scripts/local-whisper/generate-worker-protocol-vectors.ts`
- `tests/fixtures/local-whisper/protocol/v1/control/`
- `tests/fixtures/local-whisper/protocol/v1/malformed/`
- `tests/fixtures/local-whisper/protocol/v1/manifest.json`
- `tests/fixtures/local-whisper/worker/conformance-worker.ts`
- `tests/shared/localWhisper/protocol.test.ts`
- `tests/main/localWhisper/supervisor/LocalWhisperConformanceWorker.test.ts`
- `tests/main/localWhisper/supervisor/LocalWhisperWorkerSupervisor.test.ts`

The checkpoint adds CPU/bounded runtime-local GPU binding, regenerated strict
vectors, malformed device-index/residency cases, and focused supervisor and
conformance coverage. Last recorded prior-session results were 6/6 protocol
fixture groups and 24/24 supervisor/conformance/ownership tests plus applicable
type/unit checks. These results are preservation evidence, not Task-09
completion evidence.

Preserve unrelated user-owned chooser/composition changes and tests unless a
future authorized packet explicitly owns an overlap.

## Platform And External Gates

- Current host: Linux x64 laptop, NVIDIA RTX 5070 Ti Laptop GPU, driver 595.84,
  compute capability 12.0, 12,227 MiB VRAM. No representative Windows, AMD, or
  Apple Silicon host is available.
- AMD remains `Preview · Untested`; Faster-Whisper AMD is Unsupported. Task 12
  cannot claim a physical HIP row without one complete reviewed immutable
  compatibility intersection.
- macOS remains Planned/unavailable. Task 18 owns only an unreachable skeleton;
  executable Apple Silicon work requires a new specification and plan.
- Networked source/toolchain acquisition, production artifacts/signing, and
  exact previous packaged binaries remain separate manual gates. GitHub source
  review must use the GitHub plugin.

## Exact Next Step

1. Stop after the approved-plan verification and handoff.
2. In a later invocation, obtain separate `incremental-implementation`
   authorization for replacement Task 08.
3. Do not import source, implement Task 08, commit, or start another packet
   under plan approval alone.

Current blocker for implementation: replacement Task 08 has no current
execution authorization. Future Task-19 Windows and external-input gates remain
release blockers, not reasons to weaken or move their evidence.
