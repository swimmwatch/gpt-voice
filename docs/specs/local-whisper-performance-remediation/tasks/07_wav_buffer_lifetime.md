# 07 WAV Buffer Lifetime

## Outcome

Destroy or transfer ownership of the complete source WAV byte vector after validated PCM conversion and before
the inference thread starts, without changing transcription or cancellation behavior.

## Prerequisites

- Packet 01 is complete.
- Existing canonical WAV validation, PCM conversion, cancellation controller, inference thread, and exactly-one
  terminal result contracts remain intact.

## Owned Requirements

MEM-001, MEM-002, THR-006, RES-003, AC-AUT-010.

## In Scope

- Native worker audio ownership/scoping and focused allocation/lifetime test evidence.
- Success, malformed audio, conversion failure, cancellation, inference failure, and repeated resident-worker runs.

## Out Of Scope

- Audio format changes, streaming inference, transcription algorithm changes, or new audio logging.
- `shrink_to_fit()` as the sole release mechanism.
- Renderer recording, microphone, transcript/history, or provider result changes.

## Task Contract

1. Validate the complete WAV and finish conversion before releasing source bytes. No converter may read the WAV
   after release.
2. End the source vector's owning scope or explicitly transfer/destroy its storage before constructing/starting the
   inference thread. No lambda, callback, exception object, cancellation path, or test hook may retain a reference.
3. Keep the float PCM buffer alive until inference/cancellation cleanup completes.
4. Preserve the current stop guard, atomic cancellation/completion arbitration, and exactly one terminal response.
5. Add deterministic ownership evidence that distinguishes vector capacity release from mere logical size change.
6. A second transcription in the same resident worker must start with no stale WAV or PCM ownership.

## Contracts And Boundaries

- Audio bytes and PCM remain native worker-private and never enter logs, diagnostics, tests artifacts, or IPC beyond
  existing bounded protocol behavior.
- Native resource ownership remains RAII with non-throwing cleanup.

## Expected Files Or Components

- `runtime/local-whisper/whisper-cpp/core/worker_application.cpp`
- `runtime/local-whisper/whisper-cpp/core/pcm_audio.cpp` only if conversion ownership requires adjustment
- `runtime/local-whisper/whisper-cpp/tests/worker_application_test.cpp`
- Worker cancellation/TSan tests where lifetime interleavings need proof

## Acceptance Criteria

- AC-AUT-010 proves WAV storage is not live when inference starts for maximum accepted audio.
- Malformed, conversion-error, cancellation, inference-error, success, and second-request paths all clean up and
  preserve transcript/cancellation outcomes.
- ASan/UBSan and TSan report no use-after-free, leak, or race.

## Verification

- `npm run test:local-whisper:worker-common:native`
- `npm run test:local-whisper:whisper-cpp-cancellation`
- `npm run test:local-whisper:worker-tsan`
- `npm run test:local-whisper:native-sanitizer-proof`

## CI Gate And Commit Discipline

- Task-specific CI commands are the complete Verification list above. Linux native quality must run ASan/UBSan and
  TSan lifetime fixtures; Windows native quality must run `npm run test:local-whisper:whisper-cpp:msvc-asan` and the
  maximum synthetic WAV, cancellation, error, and second-request cases on `${{ vars.CI_WINDOWS_RUNNER }}`.
- Required checks for the exact pushed SHA: `Quality Gates`, `Local Whisper Performance (Linux)`,
  `Local Whisper Performance (Windows)`, `Local Whisper Native Quality (Linux)`, and
  `Local Whisper Native Quality (Windows)`.
- After local verification, stop for review and obtain explicit authorization for the implementation commit and
  push. Push the immutable implementation commit and wait until every required check reports `success`; every other
  conclusion is non-passing.
- Fix an actionable CI failure only in a later explicitly authorized invocation and a separate fix commit. Never
  amend or squash the implementation commit; push and rerun the same checks until green.
- Record implementation/fix SHAs, workflow run ID, check names, check-run URLs or IDs, and final results in
  `handoff.md`. Packet 08 remains blocked until the green result is reviewed.

## Failure And Rollback

- Any read-after-release, retained source capacity at inference start, result arbitration change, transcript drift,
  or cleanup failure rejects the packet.
- Rollback restores the prior scope without touching audio formats or persisted data.

## Manual Gates

- Windows MSVC ASan execution is required in hosted CI; Packet 14 repeats the real Windows end-to-end audio lifetime
  check on the regular Windows computer.
- Use only deterministic synthetic or approved public fixtures; never private recordings.

## References

- Specification Section 8, THR-006, RES-003, and AC-AUT-010.
- `docs/agent-guides/project-conventions.md` Sections “Code And Logging” and “Tests And Documentation.”

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with lifetime evidence, sanitizer checks, and Packet 08 as
the next ordered packet, then stop for review.
