# 04 Process And Capability Lifecycle

## Outcome

Launcher and model-launch process loops stop waiting on permanently closed control directions without spinning, and every installed descriptor/handle from a rejected model-authority transfer is closed exactly once on Linux and Windows.

## Prerequisites

- Packets 01 and 02 are complete with Linux/shared evidence so worker shutdown behavior and native RAII owners are stable. Their real Windows evidence remains deferred to Packet 15.
- This packet has separate execution authorization and no other packet is in progress.
- Packet 03 may be complete or may execute later; do not modify its common command/input ownership.

## Owned Requirements

- Primary: LNX-001, CAP-001.
- Cross-cutting: CMP-004, ARC-002, ARC-003, SEC-001, SEC-002, TST-001, TST-002.
- Acceptance: AC-AUT-009, AC-AUT-010.

## In Scope

- Linux launcher proxy `poll` lifecycle and Linux model-launch owner-control polling.
- Windows launcher/model-launch equivalent broken/closed control handling.
- Linux ancillary `SCM_RIGHTS` parsing and ownership on the launcher receiver.
- Windows inherited/duplicated handle allowlist rejection and cleanup.
- Hostile capability, closure, CPU/wakeup, process-tree, and leak tests.

## Out Of Scope

- Changing authority record bytes, logical model slot, credentials, acknowledgment asymmetry, public process ownership APIs, or worker protocol messages.
- Adding a Linux acknowledgment redesign or repeating the stale `MSG_CMSG_CLOEXEC` finding.
- Treating shutdown timeout expiration as successful cleanup.

## Task Contract

1. Model each launcher/model-launch input direction as live or terminal.
   - On EOF, `POLLHUP`, `POLLERR`, broken pipe, closed handle, or the platform-equivalent permanent condition, close/disable that direction and exclude it from later waits.
   - Preserve remaining live directions, process-exit observation, group/job cleanup, signal handling, and graceful-termination timers.
   - A terminal direction causes at most one state transition; it cannot trigger repeated zero-work wakeups.
2. Add deterministic wait/poll observation in tests. Assert transition/wait counts rather than relying only on wall-clock sleeps. Retain one real process smoke on each platform to catch OS event semantics.
3. Rewrite the Linux authority receiver to inspect every complete ancillary record and immediately move every installed descriptor into an RAII collection before semantic validation.
   - Safely calculate payload counts for all `SCM_RIGHTS` records; reject malformed lengths and overflow.
   - Collect descriptors even when the data record is truncated or another control record is unexpected, to the extent the kernel installed them.
   - Retain exactly one descriptor only after payload length, credential count, descriptor count, binding, hop, carrier, process identity, UID/GID, access mode, and artifact-kind checks all pass.
   - Keep `MSG_CMSG_CLOEXEC` and close every duplicate/extra descriptor on all exits.
4. Prove Windows capability equivalence through its explicit handle list, duplication, bootstrap, and acknowledgment path.
   - Only allowlisted inherited handles and the one fully validated model handle may reach the intended child.
   - Failed duplication, mismatched binding, malformed bootstrap, failed acknowledgment, or child creation failure closes every newly owned handle.
   - A rejected or extra handle is not usable in the child and does not remain open in the parent.
5. Add hostile Linux cases: zero descriptors, one valid descriptor, multiple descriptors in one rights record, multiple rights records, truncation, unexpected control records, duplicate credentials, and credential/binding/identity failure.
6. Add the equivalent available Windows cases: unapproved handle inheritance, duplicate/invalid carrier values, failed duplication, malformed binding/bootstrap, child creation/resume failure, and acknowledgment mismatch.

## Contracts And Boundaries

- Capability records and OS resources remain main/native process boundaries; no raw descriptor or handle reaches renderer, preload, logs, or public IPC.
- Validation happens before ownership release or logical-slot installation.
- Linux and Windows can use different control primitives, but no rejected capability may survive and no closed control channel may spin.
- Process tests must own exact fixture trees and exact child PIDs/jobs; never kill an ambient process group.

## Expected Files Or Components

- `runtime/local-whisper/launcher/src/platform/linux/linux_launcher.cpp`
- `runtime/local-whisper/launcher/src/platform/windows/windows_launcher.cpp`
- `runtime/local-whisper/fs-guard/src/platform/linux/model_launch_application.cpp`
- `runtime/local-whisper/fs-guard/src/platform/windows/windows_model_launch_application.cpp`
- `runtime/local-whisper/launcher/src/platform/linux/model_authority_client.cpp`
- `runtime/local-whisper/launcher/src/platform/windows/windows_model_authority_client.cpp`
- Platform RAII headers and narrow wait/capability helpers where justified.
- Launcher authority/process-tree fixtures and integration tests.
- Filesystem-guard model-launch integration tests and `scripts/local-whisper/verify-launcher.ts` only where executable process verification belongs there.

## Acceptance Criteria

- Permanent close/HUP tests show each direction is disabled after one terminal event; graceful timeout and remaining channels still function; no repeated wait wake loop or sustained CPU spin occurs.
- Linux hostile ancillary tests close every installed descriptor on rejection and retain exactly one only on complete success. Repetition returns descriptor counts to baseline.
- Windows handle-policy tests prove unapproved handles are not inherited/usable and every failed transfer returns handle counts to baseline.
- Valid Linux and Windows authority handoff, worker bootstrap, process-tree shutdown, and acknowledgment behavior remain unchanged.
- No test or runtime output exposes descriptor/handle numbers, raw credentials, paths, tokens, or binding contents.

## Verification

Run on Linux x64:

```text
npm run format:check:local-whisper:launcher
npm run lint:local-whisper:launcher
npm run test:local-whisper:launcher:native
npm run verify:local-whisper:worker-authority -- --platform=linux
npm run format:check:local-whisper:fs-guard
npm run lint:local-whisper:fs-guard
npm run test:local-whisper:fs-guard:native
```

Author the Windows executable handle-policy and closed-channel cases in this packet; `--contract-only` is not sufficient evidence for CAP-001. Packet 15 owns real Windows execution and any resulting fixes. Formatting and clang-tidy remain Linux-only quality gates.

## Failure And Rollback

- If the kernel reports truncated ancillary data, close every descriptor that can be safely enumerated and fail closed; never attempt to use a partial record.
- If a Windows extra-handle shape cannot be created through the production allowlist, test the allowlist's exclusion property at child process level instead of inventing an alternate transfer protocol.
- Roll back wait-state, capability ownership, and related tests together. Do not restore a raw descriptor variable beside an RAII collection.

## Manual Gates

- No Windows-host manual gate is performed in this packet. Record the deferred executable handle-policy and closed-channel suites for Packet 15.
- Verify fixture process IDs/jobs before cleanup. No workflow dispatch, push, or termination of non-fixture processes is authorized.

## References

- Specification Section 7; AC-AUT-009–AC-AUT-010.
- Review items M3 and M9.
- Existing common model-authority record tests are format precedent, not a substitute for OS capability tests.

## Completion And Handoff

- Record changed process/capability components, Linux hostile-case and resource-count results, and the deferred Windows suite inventory in `handoff.md`.
- Check Packet 04 after its Linux/shared completion set passes; Packet 15 remains mandatory for Windows lifecycle evidence.
- Set the exact next packet to Packet 05 when Packets 02 and 04 are complete, then stop without starting it or committing/pushing.
