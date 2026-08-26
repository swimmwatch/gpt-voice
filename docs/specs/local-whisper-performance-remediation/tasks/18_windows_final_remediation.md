# 18 Windows Functional Parity

## Outcome

Implement the missing Windows Local Whisper model-file loading behavior so it matches Linux, then run the
Windows development application once with the CPU backend and once with the CUDA backend and confirm recording
and transcription work.

## Prerequisites

- Packets 01–16 are complete; Linux is the functional reference.
- A real supported Windows x64 host is available with the project toolchain and a working CUDA environment for
  the CUDA flow.
- An application-managed Local Whisper model and non-sensitive test audio are available through the ordinary
  provider workflow.

## Owned Requirements

- OUT-001, OUT-002
- WIN-001–WIN-005
- AC-WIN-001–AC-WIN-003
- OPS-004

## In Scope

- The Windows C++20 model-file validator and its existing platform build selection.
- Windows-only corrections needed to preserve the shared standard path-based `whisper.cpp` loading contract.
- Compiling and starting the ordinary Windows development application with Local Whisper CPU and CUDA resources.
- One successful model-load, recording, and transcription flow for CPU and one for CUDA.
- A minimal Windows-specific correction and rerun if either functional flow fails.

## Out Of Scope

- Former Task 17 and any additional Linux qualification or execution.
- Benchmarks, cold/warm cache preparation, repeated samples, timing targets, medians, percentiles, resource
  sampling, baseline comparison, or performance evidence.
- CI execution or inspection, package qualification, installer testing, evidence digests, and release work.
- Expanded lifecycle, cancellation, retry, cleanup, privacy, device-failure, topology, settings, migration, or
  model matrices.
- New dependencies, public IPC/UI changes, loader fallback, model-content authentication, or unrelated shared/
  Linux behavior changes.

## Task Contract

1. Compare the existing Windows validator boundary with the completed Linux validator and implement the missing
   Windows behavior behind the same `ModelFileValidator` contract.
2. Preserve application-managed-root confinement, absolute canonical paths, regular disk-file checks,
   reparse-point rejection, expected-size validation, strict path conversion, RAII handle ownership, private
   path transport, sanitized failures, one standard `whisper_init_from_file_with_params` call, and no legacy
   fallback or model-payload pre-read.
3. Keep platform APIs inside the Windows translation unit and retain the existing shared process, protocol,
   threading, and resource-ownership boundaries.
4. On the Windows host, compile through the ordinary development path and start the Local Whisper development
   application.
5. Select the CPU backend, load the configured model weights, record audio, and confirm a transcript is returned.
6. Select the CUDA backend, load the configured model weights, record audio, confirm a transcript is returned,
   and confirm the CUDA backend is active rather than silently falling back to CPU.
7. If compilation or either flow fails, make the smallest Windows-specific correction and rerun only the failed
   compilation or functional flow. Stop when both flows work.

## Contracts And Boundaries

- Renderer and preload gain no new authority; privileged filesystem and worker work remains in main/native code.
- Model paths remain absent from argv, environment variables, renderer IPC, retained logs, diagnostics, and
  user-facing errors.
- Native resources use RAII and deterministic non-throwing cleanup; no mutable global runtime state is added.
- The standard path loader remains the sole production model reader on Linux and Windows.
- CUDA success requires the selected CUDA backend; CPU fallback is not a successful CUDA result.

## Expected Files Or Components

- `runtime/local-whisper/whisper-cpp/core/model_file_validator_windows.cpp` or the existing equivalent Windows
  platform unit.
- `runtime/local-whisper/whisper-cpp/CMakeLists.txt` only if Windows source selection requires correction.
- The smallest directly related shared declaration or Windows build file only when compilation proves it is
  necessary.
- `tasks/todo.md` and `tasks/handoff.md` after completion.

## Acceptance Criteria

- The Windows implementation compiles and the Local Whisper development application starts on the real Windows
  host with CPU and CUDA runtime resources.
- The CPU flow loads application-managed model weights and returns a transcription.
- The CUDA flow loads application-managed model weights, returns a transcription, and does not silently use CPU.
- Both functional flows complete without a provider crash or user-visible provider error.
- No benchmark, repeated sample, CI result, package result, or additional qualification evidence is required.

## Verification

On the real Windows host:

1. Compile and start the ordinary Local Whisper development application using the repository's existing Windows
   development command.
2. Run the CPU model-load, recording, and transcription flow once.
3. Run the CUDA model-load, recording, and transcription flow once and confirm CUDA is active.

No additional verification suite is required by this packet.

## Failure And Rollback

- A compile or functional failure leaves Packet 18 incomplete; apply the smallest Windows-specific fix and rerun
  only the affected step.
- Do not weaken path, process, runtime-pack, protocol, or privacy safeguards to obtain a successful run.
- If a proposed correction changes unrelated shared/Linux behavior, stop and revise the packet before proceeding.
- Rollback restores the prior whole compatible app/worker set; no per-load fallback is introduced.

## Manual Gates

- `MANUAL GATE`: the CPU and CUDA flows require a real Windows x64 host, local model weights, microphone input,
  and working CUDA hardware/toolchain.
- Commits, pushes, CI, publication, release, artifact upload, and private-evidence deletion are not authorized by
  this packet.

## References

- Specification Sections 4–6 and 13–16.
- [Packet 16](16_representative_linux_host_qualification.md) for the completed shared/Linux standard-loader
  reference.
- `docs/agent-guides/project-conventions.md` sections “Desktop, Browser, And Packaging”, “Tests And
  Documentation”, and “Git And Releases”.

## Completion And Handoff

After both Windows flows pass, mark Packet 18 complete in `todo.md` and update `handoff.md` with changed files,
the Windows build result, CPU functional result, CUDA functional result, and any blocker. No benchmark numbers,
private model/audio data, CI status, package evidence, or additional qualification results belong in the handoff.
No next packet remains.
