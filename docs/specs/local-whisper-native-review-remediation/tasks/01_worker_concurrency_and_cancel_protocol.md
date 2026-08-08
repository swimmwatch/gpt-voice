# 01 Worker Concurrency And Cancel Protocol

## Outcome

The resident worker handles control failures, inference completion, and both cancellation-race orderings without aborting, timing out, losing a committed transcript, or terminating a healthy warmed worker. Private protocol-v1 C++ and TypeScript peers, fixtures, and runtime identity change as one cross-platform unit.

## Prerequisites

- The plan is approved and this packet has separate execution authorization.
- Verified native test sources are provisioned with `npm run prepare:local-whisper:native-test-sources` when absent.
- No other packet in this bundle is in progress.

## Owned Requirements

- Primary: THR-001, INF-001, INF-002, CAN-001, CAN-002, CAN-003, CMP-003.
- Cross-cutting: CMP-004, ARC-002, ARC-003, SEC-001, SEC-002, TST-001, TST-002.
- Acceptance: AC-AUT-001, AC-AUT-002, AC-AUT-003, AC-AUT-004, AC-AUT-016.

## In Scope

- C++ worker inference-thread ownership and exception unwinding.
- A Linux and Windows channel wait contract for control input or inference completion.
- Protocol-v1 `cancelTooLate` generation, validation, fixtures, supervisor mapping, and coordinator state.
- Deterministic C++, TypeScript, conformance-worker, and mixed-identity tests.
- Windows native worker-core tests and quality-workflow wiring, with real Windows-host execution deferred to Packet 15.

## Out Of Scope

- Filesystem guard, launcher proxy loops, artifact transfer cancellation, public IPC, renderer behavior, settings, provider selection, or a protocol-v2 introduction.
- New public failure codes, runtime-pack revision renaming, package generation, qualification, or release work.
- Timeout increases that merely hide blocked inference failure.

## Task Contract

1. Introduce one narrow worker-channel wait abstraction that blocks until either control input is readable/closed or an inference-completion notification is signaled.
   - Linux uses descriptor/poll-compatible ownership behind the POSIX channel.
   - Windows uses handle/wait-compatible ownership behind the Windows channel.
   - The shared worker application consumes one platform-neutral result; it does not call platform APIs.
   - No polling sleep or unbounded wake loop is permitted.
2. Replace the raw joinable inference-thread lifetime with a scoped owner.
   - Every exceptional exit requests cancellation or otherwise wakes blocking inference before joining exactly once.
   - If `std::jthread` and a fallback wake/stop guard are used, declare the guard after the thread so the guard is destroyed first; disarm it only after a successful explicit normal-path join.
   - Do not detach, suppress a join failure, or let stack unwinding destroy a joinable `std::thread`.
3. Signal completion for both successful inference and exceptions. After the owner wakes for inference completion, join and rethrow the captured exception on the owner thread so the existing typed failure frame/exit path executes without another client frame.
4. Preserve exactly one terminal transcription outcome. Synchronize transcript commitment, cancellation commitment, completion notification, captured exception, and request-state cleanup without data races.
5. Add `cancelTooLate` to private protocol version 1 with `requestId` and `targetRequestId` fields matching `cancelled`.
   - Cancel-first: request inference cancellation, emit `cancelled`, emit no transcript, and return warmed.
   - Transcript-first: preserve the emitted transcript, emit `cancelTooLate` for the cancel request after the commitment is known, clear the active request, and return warmed.
   - Target mismatch and malformed input remain typed invalid/failure paths, but still perform bounded cancellation and join cleanup.
6. Teach the TypeScript protocol validator, worker transport, supervisor, and fixtures to accept only the exact new frame shape.
   - The supervisor returns existing nonfatal `OPERATION_CONFLICT` for `cancelTooLate`.
   - It resolves the original transcription with the committed transcript and leaves ownership, epoch, and warmed state intact.
   - It resolves cancel-first through the existing `CANCELLED` behavior.
7. Update coordinator cancellation state so calling `AbortController.abort()` does not force a committed transcript to be discarded when the supervisor reports `cancelTooLate`. Do not terminate or unload the resident worker for that result. All other cancellation failures retain existing cleanup policy.
8. Regenerate checked-in protocol-v1 fixtures through the canonical generator. Keep protocol version `1`; rely on the changed authenticated binary/build digest and exact handshake authority to reject mixed old/new peers. Add an explicit mixed-identity rejection test rather than inventing version negotiation.
9. Make committed-transcript emission unable to fail (INF-002).
   - Current behavior: the transcript is concatenated from `whisper_full_get_segment_text` and sent as `{"text", text}`. Both channels serialize with a bare `value.dump()` (`worker_protocol_posix.cpp:128`, `worker_protocol_windows.cpp:112`). nlohmann's `dump()` throws `type_error.316` on ill-formed UTF-8 and no `error_handler_t` is supplied anywhere in the tree. Whisper uses byte-level BPE, so a segment boundary can split a multibyte character.
   - Without this item, the rest of this packet converts a `std::terminate` into a typed failure but the committed transcript is still discarded and the warmed worker still exits — which AC-MAN-001 ("no lost committed transcript") and CAN-002 ("preserve the already committed transcript") forbid.
   - Required: after `terminal.try_succeed()` has committed the transcript, emission SHALL succeed. Either sanitize the text deterministically before assignment, or serialize control frames with `nlohmann::json::error_handler_t::replace`. Apply the same choice to both channel implementations so behavior is identical on Linux and Windows.
   - Sanitization SHALL be deterministic, SHALL NOT log or emit audio, model, or path data, and SHALL NOT change well-formed transcripts.
   - Add a deterministic test that commits a transcript containing a multibyte character split at a segment boundary on both transports, asserts the request receives exactly one terminal success, asserts the worker stays warmed, and asserts a following transcription succeeds.

## Contracts And Boundaries

- C++ owns inference resources and OS wait objects; TypeScript owns private message validation, pending-request resolution, process ownership, and coordinator state.
- Only the worker thread may call the inference engine. Output writes must remain ordered and non-overlapping.
- Safe protocol failures contain only existing failure codes; do not expose exception text, audio, transcript contents, paths, or runtime authority values.
- Runtime identity checks remain exact and fail closed before transcription traffic.

## Expected Files Or Components

- `runtime/local-whisper/whisper-cpp/core/worker_application.cpp`
- `runtime/local-whisper/whisper-cpp/include/local_whisper/whisper_cpp/worker_protocol.hpp`
- `runtime/local-whisper/whisper-cpp/core/worker_protocol_posix.cpp`
- `runtime/local-whisper/whisper-cpp/platform/windows/worker_protocol_windows.cpp`
- `runtime/local-whisper/whisper-cpp/tests/worker_application_test.cpp`
- `src/shared/localWhisper/protocol.ts`
- `src/main/localWhisper/supervisor/LocalWhisperWorkerTransport.ts`
- `src/main/localWhisper/supervisor/LocalWhisperWorkerSupervisor.ts`
- `src/main/localWhisper/coordinator/LocalWhisperCoordinator.ts`
- Directly related supervisor, coordinator, protocol, and conformance-worker tests.
- `scripts/local-whisper/generate-worker-protocol-vectors.ts` and `tests/fixtures/local-whisper/protocol/v1/`.
- `.github/workflows/pr-checks.yml` only as required to execute the Windows MSVC worker-core suite and its verified inputs.

## Acceptance Criteria

- Malformed cancel input and control EOF during blocked inference stop/wake and join exactly once on Linux and Windows; no abort, detach, hang, or resource leak occurs.
- Immediate and delayed inference exceptions emit the typed worker failure before the supervisor timeout without a follow-up client frame.
- Deterministic arbiter tests cover cancel-first and transcript-first. Each request gets one terminal result, a committed transcript is retained, and the next transcription succeeds on the same warmed worker.
- `cancelTooLate` has exact-key rejection coverage in TypeScript and C++, appears in canonical binary fixtures, and maps only to `OPERATION_CONFLICT` for the cancel operation.
- A committed transcript containing a split multibyte character is delivered as a terminal success on both transports; the worker stays warmed and serves the next request.
- A changed or old runtime identity is rejected before work begins.
- Linux and Windows tests exercise the same shared worker state matrix using their native channel implementations.

## Verification

Run on Linux x64:

```text
npm run verify:local-whisper:worker-vectors -- --check-clean
npm run test:local-whisper:worker-codec
npm run test:local-whisper:whisper-cpp-core
npm run test:local-whisper:supervisor
npm run test:local-whisper:coordinator
npm run format:check:local-whisper:worker-common
npm run lint:local-whisper:worker-common
npm run typecheck
npm run test:types
```

Run the smallest targeted tests while iterating; the Linux/shared commands above are this packet's completion set. Author the applicable Windows native-channel cases and workflow wiring in this packet, but do not require a Windows host run here. Packet 15 owns their real MSVC execution and any resulting fixes.

## Failure And Rollback

- If either platform cannot wait on control/completion without polling, stop and return the design conflict to planning; do not ship a platform fallback with weaker behavior.
- If `cancelTooLate` requires a public failure or protocol-v2 change, stop and return to specification.
- Roll back C++ channel/application changes, TypeScript peers, fixtures, and workflow wiring together. Never leave one protocol peer or fixture set at an intermediate shape.

## Manual Gates

- No Windows-host manual gate is performed in this packet. Record the exact deferred Windows suites and source paths for Packet 15.
- No push or workflow dispatch is authorized by this packet.

## References

- Specification Sections 4 and 5; AC-AUT-001–AC-AUT-004 and AC-AUT-016.
- `docs/reviews/2026-08-08-local-whisper-native-comments-to-address.md`, items C1, M1, and M2.
- `docs/agent-guides/project-conventions.md`, Dependency Injection And Runtime Ownership and Tests And Documentation.

## Completion And Handoff

- Record changed files, exact Linux/shared check results, and the deferred Windows suite inventory in `handoff.md`.
- Check Packet 01 in `todo.md` after its Linux/shared completion set passes; this does not satisfy the overall Windows evidence gate.
- Set the exact next packet to Packet 02 and stop. Do not begin Packet 02 or commit/push changes.
