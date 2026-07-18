# Handoff: Claude Web Live Streaming Amendment

Status: Task 21 is complete and uncommitted; it awaits human review. Do not
begin Task 22 until a later explicit incremental-implementation invocation.

Completed:

- Tasks 01-09 are committed through `48755dd5`.
- Materialized the approved live-streaming amendment and self-contained Tasks
  21-28 ahead of existing CLI Task 10 without renumbering Tasks 10-20.
- Task 21 passed through the authorized dedicated CloakBrowser research profile
  with six fresh page-owned sockets and one transient public LibriSpeech clip.
- Fixture attribution: `hf-internal-testing/librispeech_asr_dummy`,
  `clean/validation` row 0, utterance `1272-128104-0000`, derived from the
  LibriSpeech ASR Corpus under CC BY 4.0.
- Audio and reference text were downloaded, converted, compared, and discarded
  in memory. All four normal cases passed the 80% normalized word-order
  reference threshold; no transcript/reference text was output or retained.
- Passed immediate pre-connect backlog, 64-frame bound, minimum 85.31-ms
  cadence, two consecutive reference-matched sockets, pause/KeepAlive, repeated
  endpoints, cancellation, Stop before open, and cleanup.
- The 30-second case produced two endpoints and finalized 2,163 ms after Stop;
  the sanitized duration slope was 0.05 and every normal case stayed under three
  seconds.

Changed files:

- `docs/researches/claude-web-voice-provider/main.md`
- `docs/specs/claude-web-voice-provider/spec.md`
- `docs/specs/claude-web-voice-provider/tasks/plan.md`
- `docs/specs/claude-web-voice-provider/tasks/todo.md`
- `docs/specs/claude-web-voice-provider/tasks/handoff.md`
- `docs/specs/claude-web-voice-provider/tasks/21_revalidate_live_streaming.md`
- `docs/specs/claude-web-voice-provider/tasks/22_define_streaming_provider_contracts.md`
- `docs/specs/claude-web-voice-provider/tasks/23_build_live_pcm_capture.md`
- `docs/specs/claude-web-voice-provider/tasks/24_refactor_claude_streaming_transport.md`
- `docs/specs/claude-web-voice-provider/tasks/25_build_main_streaming_service.md`
- `docs/specs/claude-web-voice-provider/tasks/26_integrate_trusted_streaming_ipc.md`
- `docs/specs/claude-web-voice-provider/tasks/27_integrate_streaming_recording_workflow.md`
- `docs/specs/claude-web-voice-provider/tasks/28_complete_streaming_feature_gate.md`

Checks:

- The final Task 21 matrix returned metadata and public attribution only.
- All six terminal cases closed `1000` and reported zero active socket, timer,
  or queue resources.
- Targeted Markdown Prettier, task-packet/link checks, `git diff --check`, and
  sensitive-value scans pass.
- No production source, tests, package files, dependencies, session/profile,
  HAR, audio, screenshot, transcript/reference text, raw event, identifier, or
  query-bearing socket URL was added.

Exact next packet:

- After human approval, commit Task 21 with its specification/task artifacts,
  then execute `22_define_streaming_provider_contracts.md` only.

Blockers:

- Task 21 has no technical blocker. Human review is the required checkpoint.
- The private endpoint remains volatile; changed query/event/bootstrap behavior
  or failed timing/reference checks require rerunning the metadata-only canary.
