# Local Whisper Performance Remediation Handoff

- Approved specification revision 8 and plan revision 9 remove the unfinished Linux qualification packet and
  all remaining benchmark, repeated-sample, timing/resource, CI, package, and evidence gates.
- Packets 01–16 remain complete historical work. The Linux standard path-based `whisper.cpp` implementation is
  the functional reference and ordinary model loading retains zero project-owned model-content proofs.
- Former Packet 17 is removed and is not a prerequisite or completion gate. Existing private evidence remains
  private and retained; no new qualification evidence is required.
- Exact next packet: [18 Windows functional parity](18_windows_final_remediation.md).
- Packet 18 owns only the missing Windows adapter behavior and one real Windows development application flow per
  CPU and CUDA backend: load application-managed weights, record audio, and obtain a transcription. CUDA must not
  silently fall back to CPU.
- No additional tests, benchmarks, CI inspection, package qualification, repeated samples, or expanded manual
  matrices are required. If a flow fails, make the smallest Windows-specific correction and rerun only the
  affected build or flow.
- A real supported Windows x64 host with a working CUDA environment, model weights, and microphone input is the
  only current manual gate.
- This planning revision changed `spec.md`, `decisions.yaml`, `tasks/plan.md`, `tasks/todo.md`, `tasks/handoff.md`,
  and `tasks/18_windows_final_remediation.md`, and removed `tasks/17_windows_end_to_end_qualification.md`.
- No implementation, commit, push, CI, publication, release, or private-evidence deletion occurred during this
  revision.
