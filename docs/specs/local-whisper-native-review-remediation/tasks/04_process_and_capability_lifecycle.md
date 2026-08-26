# 04 Process And Capability Lifecycle

## Outcome

Launcher and model-launch process loops stop waiting on permanently closed control directions without spinning, and every installed descriptor/handle from a rejected model-authority transfer is closed exactly once on Linux and Windows.

## Prerequisites

- Packets 01–03 are complete under decision `plan.remote-completion-backfill` revision 1, and Packet 03's implementation is isolated in its own local commit before Packet 04 implementation begins.
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

Author the Windows executable handle-policy and closed-channel cases in this packet; `--contract-only` is not sufficient evidence for CAP-001. The remote Windows native job must execute them and all resulting fixes before Packet 04 completes. Formatting and clang-tidy remain Linux-only quality gates and do not substitute for MSVC execution.

## Remote Completion Gate

1. After local verification passes, leave Packet 04 unchecked, update `handoff.md` with candidate state and pending remote evidence, stage only packet-owned paths, and create a conventional Packet 04 candidate commit.
2. Push the candidate commit without force to the verified head of pull request 58 (or its verified successor) and record the exact SHA. Confirm that the push launches CI for that SHA.
3. Require all checks selected for that SHA to finish successfully. At minimum inspect **Local Whisper Native Quality (Linux)**, **Local Whisper Native Quality (Windows)**, **Quality Gates**, **Package Smoke (Fedora Linux)**, **Package Smoke (Windows)**, **Actionlint**, every selected `Local Whisper Fixture Packaging` job, and every new or split native job introduced by this packet.
4. The Linux and Windows native jobs must execute the packet's applicable C++ builds, warnings-as-errors, formatting, lint/static analysis, sanitizer configuration, native tests, and process/capability cases. Every required Windows job must run and conclude `success`; a skipped Windows job is never acceptable.
5. Fix packet-caused in-scope failures, add focused regressions where applicable, commit and push the fix, and repeat the exact-SHA gate. Record an unrelated or out-of-scope failure as a blocker and leave the packet unchecked.
6. After the candidate SHA passes, check Packet 04, record the remote run/job evidence in `handoff.md`, create and push a separate completion-record commit, and require all workflows for that final SHA to pass again. That final external check result closes the gate without another self-referential documentation commit.

## Failure And Rollback

- If the kernel reports truncated ancillary data, close every descriptor that can be safely enumerated and fail closed; never attempt to use a partial record.
- If a Windows extra-handle shape cannot be created through the production allowlist, test the allowlist's exclusion property at child process level instead of inventing an alternate transfer protocol.
- Roll back wait-state, capability ownership, and related tests together. Do not restore a raw descriptor variable beside an RAII collection.

## Manual Gates

- No supported-host manual Windows smoke is performed in this packet; Packet 15 retains that final manual gate. Automated Windows CI is mandatory here.
- Verify fixture process IDs/jobs before cleanup. The packet's non-force PR-head pushes are required by the remote completion gate; manual workflow dispatch and termination of non-fixture processes remain unauthorized.

## References

- Specification Section 7; AC-AUT-009–AC-AUT-010.
- Review items M3 and M9.
- Existing common model-authority record tests are format precedent, not a substitute for OS capability tests.

## Completion And Handoff

- Record changed process/capability components, local Linux results, exact candidate/completion commits, and successful Linux/Windows CI jobs in `handoff.md`.
- Check Packet 04 only after local verification and both exact-SHA remote phases pass with no skipped Windows job. Packet 15 remains mandatory for supported-host manual Windows evidence.
- Set the exact next packet to Packet 05 and stop without starting it. The Packet 04 candidate and completion-record commits must already be pushed and green.
