# Handoff: Task 07 Complete, Windows Checks Deferred

## Status

Plan revision 6 is committed as `fd0f942`; revision 7 is approved and
uncommitted. `planning.native-cpp-windows-gate` revision 2 applies the user's
directive that all representative Windows checks execute only in Task 17.
Task 07's implementation, automated/source-contract checks, and available
Linux evidence are complete and uncommitted. Task 08, commit, push, pull
request, packaging, publication, and release are not authorized.

## Completed Packets

- [01 Shared domain contracts](01_shared_domain_contracts.md), `d0083259`
- [02 Provider dispatch and cache](02_provider_dispatch_and_cache.md), `d516d034`
- [03 Trusted catalog, settings, and inventory](03_trusted_catalog_settings_and_inventory.md), `14749e88`
- [04 Managed filesystem safety](04_managed_filesystem_safety.md), `649ec3b9`
- [05 Streaming artifact lifecycle](05_streaming_artifact_lifecycle.md), `32440674`
- [06 Native C++ modularization](06_native_cpp_modularization.md), `e294e8a`
- [07 Framed worker supervisor](07_framed_worker_supervisor.md), uncommitted

## Task 07 Implementation

- Protocol v1 is `[uint32-be bodyLength][uint8 frameKind][body]`; kinds are
  `0x01` strict control JSON and `0x02` versioned sequenced audio. Checked-in
  binary/hex vectors cover every lifecycle message, representative audio, and
  malformed/stream-order cases.
- `LocalWhisperWorkerSupervisor` exposes `startAndHandshake`, `probe`, `load`,
  `warmup`, `transcribe`, `cancel`, `unload`, `shutdown`, and `forceCleanup`.
  Transport construction, clocks, request IDs, and process ownership are
  injected; durable ownership records bind nonce, PID/start identity,
  executable identity/build, runtime identity, and configuration epoch.
- Bounds are 10-second handshake, 30-second probe, 5-minute load, 2-minute
  warm-up, 15-second unload, two 5-second cleanup stages, 1 MiB control/audio
  bodies, 64 KiB stderr, and `max(120s, 10x audio duration)` inference capped
  at 30 minutes.
- Linux uses held executable identity, `openat2`, `PDEATHSIG`, a subreaper, and
  a dedicated process group. Windows source uses suspended creation,
  restricted inherited handles, assign-before-resume, and a kill-on-close Job
  Object; it has source-contract evidence only.
- The standalone non-inference worker covers lifecycle, malformed, oversized,
  flood, hang, crash, out-of-order, descendant, and stream-close modes. No
  runtime/model, inference, listener, fallback, or publication claim exists.

## Changed Components

- Shared protocol and tests: `src/shared/localWhisper/protocol.ts`,
  `tests/shared/localWhisper/protocol.test.ts`, and
  `tests/fixtures/local-whisper/protocol/v1/`.
- Supervisor and tests: `src/main/localWhisper/supervisor/`,
  `tests/main/localWhisper/supervisor/`, and the conformance worker under
  `tests/fixtures/local-whisper/worker/`.
- Native launcher: `runtime/local-whisper/launcher/` with CMake presets,
  clang-format/clang-tidy, GoogleTest, Linux/Windows backends, fixtures, and a
  concise human/LLM README.
- Build/verification integration: `scripts/local-whisper/`, `package.json`,
  and Linux/Windows jobs in `.github/workflows/pr-checks.yml`.
- Generated launcher binaries/build trees remain ignored under
  `.cache/local-whisper/launcher/`; protocol `.bin` fixtures and their manifest
  are intentional checked-in golden vectors.

## Verification Evidence

- Protocol: 6/6 passed; supervisor/conformance/ownership: 22/22 passed.
- `npm run typecheck`, `npm run test:types`, and `npm run test:unit` passed;
  the full unit suite is 1470/1470.
- Task-owned production TypeScript ESLint and scoped Prettier passed. Full
  repository lint remains blocked only by the preserved user-owned
  `prettifyProfileChooserWindowController.ts` error. Full format check also
  reports pre-existing formatting in `PlatformAdapterContract.test.ts` and the
  preserved user-owned chooser test.
- Linux C++ strict GCC ASan/UBSan build and GoogleTest passed 5/5;
  clang-format and clang-tidy passed. The real launcher verified immediate
  descendants, control closure, parent death, ignored `SIGTERM` hard cleanup,
  confirmed group exit, and survival of an unrelated process.
- Commands: `node --import tsx --test tests/shared/localWhisper/protocol.test.ts`,
  `npm run test:local-whisper:supervisor`, `npm run typecheck`,
  `npm run test:types`, `npm run test:unit`, and the launcher
  format/lint/native package scripts. Local native commands used the temporary
  CMake/Ninja/clang-format/clang-tidy tools recorded in the prior session.

## Exact Continuation

- Review the uncommitted Task 07 plus revision 7 plan diff without mixing the
  unrelated chooser and composition-root test changes, then obtain separate
  commit authorization.
- Task 08 is the exact next packet, but requires a new explicit
  `incremental-implementation` invocation and execution authorization after
  the completed Task 07 changes are reviewed and committed.
- Preserve the unrelated user-owned changes in
  `src/main/prettifyProfileChooserWindowController.ts`,
  `tests/main/mainProcessCompositionRoot.test.ts`, and
  `tests/main/prettifyProfileChooserWindowController.test.ts`.

## Open Gates

- Task 17 owns every representative Windows check from Tasks 01–16:
  filesystem, MSVC native quality, launcher/Job Object behavior, supervisor
  conformance, whisper.cpp/Faster-Whisper CPU/GPU runtimes, device capability
  and lifecycle, package/install evidence, and applicable hardware
  qualification. No Windows qualification claim is made before those gates
  pass; physical AMD evidence remains a future-promotion gate for the current
  untested Preview tier.
- Task 17 also owns real-engine lifecycle/offline qualification.
