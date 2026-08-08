# Local Whisper Native Review Remediation Handoff

## State

- Packet 01 is contained in user-authored commit `0b4d7825`; that commit also contains unrelated renderer/test edits, which remain outside this workstream.
- Packet 02 completed under `authorization.packet-02-execution` revision 1. The Linux and Windows backends now use RAII for transient descriptors, directory streams, handles, process tokens, security descriptors, and BCrypt hash resources. Instance-scoped constructor injection deterministically fails each resource-acquisition ordinal without production globals. A shared `kMaxLiveLeases` constant caps all retained lease kinds at 64 with `IO_FAILED` before lease-producing mutation.
- Packet 03 completed under `authorization.packet-03-execution` revision 1. A bounded 262,144-byte reader fail-stops on the first over-limit byte without draining; the TypeScript transport bounds raw stdout before newline, rejects pending work once on guard death, and starts a fresh guard for the next request. Common parsing now owns closed platform/artifact/namespace/operation domains, checked process IDs and modes, decoded write bytes, and typed `LIST` entries. Linux and Windows backend `Impl` methods consume typed commands directly; supplied `LIST` expectations require exact name/mode equality, while the existing no-expectation discovery path remains available for partial-staging cleanup.
- Planning decision `plan.remote-completion-backfill` revision 1 keeps Packets 01–03 complete under their former evidence rule. Packet 03 is still uncommitted and must be isolated in its own local commit before Packet 04 implementation begins.
- Beginning with Packet 04, every packet uses a two-phase remote completion gate: candidate commit/push and exact-SHA CI, followed by a completion-record commit/push and exact-SHA CI. Every required Windows job must execute and conclude successfully; a skipped Windows job is never evidence.
- The revised plan is approved under **PLAN-APPROVAL-003**. Approval does not start Packet 04; a new `incremental-implementation` invocation remains required.
- Packet 04 candidate is ready for its first remote gate. Linux launcher and model-launch control directions now become terminal once and are removed from later polls; Windows control directions close once and are no longer probed. The Linux authority receiver owns every installed ancillary descriptor before validation, and Windows revokes an unconfirmed worker duplicate before job termination.
- `WorkerApplication` now owns inference through `std::jthread` and a cancellation-before-join RAII guard. The control owner waits on a platform-neutral control/closed/completion contract, emits all terminal frames, preserves committed transcripts, and returns to warmed state after `cancelTooLate`.
- POSIX uses an owned `eventfd` with `poll`; Windows uses an owned event handle with `WaitForMultipleObjects`. Both serializers use `nlohmann::json::error_handler_t::replace`.
- Private protocol-v1 fixtures and runtime identity digest inputs now cover `cancelTooLate`; TypeScript supervisor/coordinator preserve a transcript when cancellation loses and return nonterminal `OPERATION_CONFLICT` for the cancel request.

## Changed Files

- Native worker protocol/application and deterministic worker tests under `runtime/local-whisper/whisper-cpp/`.
- Protocol validator, supervisor/coordinator behavior, conformance fixtures, and focused TypeScript tests under `src/` and `tests/`.
- Worker-vector generator and regenerated `tests/fixtures/local-whisper/protocol/v1/` fixture set, including `control/cancel-too-late.bin`.
- Native runtime identity inputs in `scripts/local-whisper/whisper-cpp-build-core.mjs` and Windows MSVC worker-core CI wiring in `.github/workflows/pr-checks.yml`.
- Filesystem-guard ownership, capacity, and cross-platform baseline tests in `runtime/local-whisper/fs-guard/`, including Linux `/proc/self/fd` and Windows `GetProcessHandleCount` coverage.
- Filesystem-guard bounded reader, typed command/domain values, exact expected-list checks, and real-backend matrix in `runtime/local-whisper/fs-guard/`; native guard transport buffering/restart coverage in `src/main/localWhisper/filesystem/` and `tests/main/localWhisper/filesystem/`.
- Packet 04 launcher/model-launch lifecycle and authority-transfer cleanup under `runtime/local-whisper/launcher/` and `runtime/local-whisper/fs-guard/`; the launcher fixture now closes model-launch ownership control after a successful handshake.

## Checks

- Passed: `npm run verify:local-whisper:worker-vectors -- --check-clean`
- Passed: `npm run test:local-whisper:worker-codec`
- Passed: `npm run test:local-whisper:whisper-cpp-core` (Linux GCC and Clang ASan/UBSan core suites, formatting, and clang-tidy)
- Passed: `npm run test:local-whisper:supervisor`
- Passed: `npm run test:local-whisper:coordinator`
- Passed: `npm run format:check:local-whisper:worker-common`, `npm run lint:local-whisper:worker-common`, `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run test:types`
- Passed: `npm run format:check:local-whisper:fs-guard`, `npm run lint:local-whisper:fs-guard`, `npm run test:local-whisper:fs-guard:unit`, `npm run test:local-whisper:fs-guard:integration`, and `npm run test:local-whisper:fs-guard:native` (Linux Clang ASan/UBSan)
- Passed: `npm run test:local-whisper:filesystem`, `npm run typecheck`, and `npm run test:types`
- Packet 04 local candidate passed: `npm run format:check:local-whisper:launcher`, `npm run lint:local-whisper:launcher`, `npm run test:local-whisper:launcher:native`, `npm run verify:local-whisper:worker-authority -- --platform=linux`, `npm run format:check:local-whisper:fs-guard`, `npm run lint:local-whisper:fs-guard`, `npm run test:local-whisper:fs-guard:native`, `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run test:types`.

## Remote CI And Final Windows Evidence

- Pull request 58 currently uses head `feat/local-whisper-provider` and base `main`. Packet 04–15 pushes must be non-force pushes to the verified PR head and must bind evidence to the exact pushed SHA.
- Required remote evidence includes **Local Whisper Native Quality (Linux)**, **Local Whisper Native Quality (Windows)**, **Quality Gates**, **Package Smoke (Fedora Linux)**, **Package Smoke (Windows)**, **Actionlint**, every selected `Local Whisper Fixture Packaging` job, and every packet-added native job.
- Automated Windows MSVC build/test/analysis/ASan and PE evidence is packet-local from Packet 04 onward. Packet 15 retains only the final supported-host manual Windows package, manual-only remediation, and final cross-platform regression/closure.
- Linux/shared checks are not Windows evidence, and a skipped Windows job is never evidence.

## Exact Next Packet

- Packet 04 — Process and capability lifecycle. Candidate commit and exact-SHA remote CI are pending; do not check this packet or start Packet 05 until the candidate and a subsequent completion-record commit are each pushed and pass every required Linux and Windows job.

## Blockers

- None.
