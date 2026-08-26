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

## Deferred Windows And CI Gate

- Run only the listed Verification commands on the Linux development host. Do not push or inspect CI in this packet.
- Packet 17 runs the deferred Windows MSVC/ASan WAV lifetime checks; Packet 18 owns fixes and reruns.
- Record local results in `handoff.md` without claiming Windows coverage; the next numbered packet becomes
  executable after local review.

## Failure And Rollback

- Any read-after-release, retained source capacity at inference start, result arbitration change, transcript drift,
  or cleanup failure rejects the packet.
- Rollback restores the prior scope without touching audio formats or persisted data.

## Manual Gates

- Packet 17 owns Windows MSVC ASan execution and the real Windows end-to-end audio lifetime check.
- Use only deterministic synthetic or approved public fixtures; never private recordings.

## References

- Specification Section 8, THR-006, RES-003, and AC-AUT-010.
- `docs/agent-guides/project-conventions.md` Sections “Code And Logging” and “Tests And Documentation.”

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with lifetime evidence, sanitizer checks, and Packet 08 as
the next ordered packet, then stop for review.
