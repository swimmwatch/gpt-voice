# Local Whisper Native Review Remediation Handoff

## State

- Packet 01 completed under `authorization.packet-01-execution` revision 2. No commit, later-packet, release, publishing, or real Windows-host execution authorization was granted.
- `WorkerApplication` now owns inference through `std::jthread` and a cancellation-before-join RAII guard. The control owner waits on a platform-neutral control/closed/completion contract, emits all terminal frames, preserves committed transcripts, and returns to warmed state after `cancelTooLate`.
- POSIX uses an owned `eventfd` with `poll`; Windows uses an owned event handle with `WaitForMultipleObjects`. Both serializers use `nlohmann::json::error_handler_t::replace`.
- Private protocol-v1 fixtures and runtime identity digest inputs now cover `cancelTooLate`; TypeScript supervisor/coordinator preserve a transcript when cancellation loses and return nonterminal `OPERATION_CONFLICT` for the cancel request.

## Changed Files

- Native worker protocol/application and deterministic worker tests under `runtime/local-whisper/whisper-cpp/`.
- Protocol validator, supervisor/coordinator behavior, conformance fixtures, and focused TypeScript tests under `src/` and `tests/`.
- Worker-vector generator and regenerated `tests/fixtures/local-whisper/protocol/v1/` fixture set, including `control/cancel-too-late.bin`.
- Native runtime identity inputs in `scripts/local-whisper/whisper-cpp-build-core.mjs` and Windows MSVC worker-core CI wiring in `.github/workflows/pr-checks.yml`.

## Checks

- Passed: `npm run verify:local-whisper:worker-vectors -- --check-clean`
- Passed: `npm run test:local-whisper:worker-codec`
- Passed: `npm run test:local-whisper:whisper-cpp-core` (Linux GCC and Clang ASan/UBSan core suites, formatting, and clang-tidy)
- Passed: `npm run test:local-whisper:supervisor`
- Passed: `npm run test:local-whisper:coordinator`
- Passed: `npm run format:check:local-whisper:worker-common`, `npm run lint:local-whisper:worker-common`, `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run test:types`

## Deferred Windows Evidence

- Packet 15 owns real Windows x64 execution and remediation for `npm run test:local-whisper:whisper-cpp-core`, wired in `.github/workflows/pr-checks.yml` as **Run MSVC Whisper.cpp worker-core suite**.
- Required Windows source paths: `runtime/local-whisper/whisper-cpp/platform/windows/worker_protocol_windows.cpp`, `runtime/local-whisper/whisper-cpp/core/worker_application.cpp`, and `runtime/local-whisper/whisper-cpp/tests/worker_application_test.cpp`.
- Linux/shared checks above are not Windows evidence.

## Exact Next Packet

- Packet 02 — Filesystem-guard resource ownership. Do not start it until a new incremental-implementation invocation; do not commit Packet 01 without separate commit authorization.

## Blockers

- None.
