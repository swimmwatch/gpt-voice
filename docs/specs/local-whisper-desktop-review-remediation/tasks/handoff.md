# Local Whisper Desktop Review Remediation Handoff

## Completed Packets

- [01 Artifact Transport Ownership](01_artifact_transport_ownership.md)
- [02 Renderer Command Lifecycle](02_renderer_command_lifecycle.md)
- [03 Exact-URL Capability Lifecycle](03_exact_url_capability_lifecycle.md)

## Changed Files

- `src/main/localWhisper/artifacts/ArtifactLifecycleTypes.ts`
- `src/main/localWhisper/artifacts/OwnedArtifactTransport.ts`
- `src/main/localWhisper/artifacts/CatalogHttpTransport.ts`
- `src/main/localWhisper/artifacts/NodeArtifactHttpClient.ts`
- `src/main/localWhisper/artifacts/LocalWhisperArtifactService.ts`
- `scripts/local-whisper/qualification/QualificationArtifactHttpClient.ts`
- `scripts/local-whisper/qualification/PublicModelTransportQualification.ts`
- `scripts/local-whisper/qualification/PinnedModelSetMaterializer.ts`
- `tests/main/localWhisper/artifacts/artifactTestUtils.ts`
- `tests/main/localWhisper/artifacts/ArtifactInfrastructure.test.ts`
- `tests/main/localWhisper/artifacts/ArtifactLifecycle.test.ts`
- `tests/main/localWhisper/artifacts/ArtifactStreamingBounds.test.ts`
- `tests/scripts/localWhisper/qualification/QualificationArtifactHttpClient.test.ts`
- `tests/scripts/localWhisper/qualification/QualificationHttpsArtifactServer.test.ts`
- `src/renderer/localWhisper/LocalWhisperSettingsLifecycle.ts`
- `src/renderer/localWhisper/useLocalWhisperSettings.ts`
- `tests/renderer/localWhisper/LocalWhisperSettingsLifecycle.test.ts`
- `tests/renderer/localWhisper/LocalWhisperUiContracts.test.ts`
- `src/main/localWhisper/ipc/ElectronLocalWhisperSenderAuthority.ts`
- `src/main/localWhisper/ipc/LocalWhisperIpcController.ts`
- `tests/main/localWhisper/ipc/ElectronLocalWhisperSenderAuthority.test.ts`
- `tests/main/localWhisper/ipc/LocalWhisperIpcController.test.ts`
- `tests/main/localWhisper/ipc/localWhisperIpcTestUtils.ts`
- `tests/main/windowManager.test.ts`
- `.github/workflows/pr-checks.yml`
- `docs/specs/local-whisper-desktop-review-remediation/decisions.yaml`
- `tests/main/localWhisper/capability/NvidiaRtx50Applicability.test.ts`
- `tests/main/prettifyCodexCli.test.ts`

## Checks

- `npm run test:local-whisper:artifacts` passes (32 tests), including deterministic redirect ownership, explicit pre-iteration disposal, concurrent disposal, pending-read cancellation, post-open journal failure, and URL-policy cases.
- `node --import tsx --test tests/scripts/localWhisper/qualification/QualificationArtifactHttpClient.test.ts tests/scripts/localWhisper/qualification/QualificationHttpsArtifactServer.test.ts` passes (6 tests), including loopback TLS completion, abandonment, and cancellation.
- `npm run typecheck` passes.
- `npx eslint src/main/localWhisper/artifacts scripts/local-whisper/qualification tests/main/localWhisper/artifacts tests/scripts/localWhisper/qualification` passes with pre-existing warnings and no errors.
- `npx prettier --check "src/main/localWhisper/artifacts/**/*.ts" "scripts/local-whisper/qualification/**/*.ts" "tests/main/localWhisper/artifacts/**/*.ts" "tests/scripts/localWhisper/qualification/**/*.ts"` passes.
- `node --import tsx --test tests/renderer/localWhisper/LocalWhisperSettingsLifecycle.test.ts tests/renderer/localWhisper/LocalWhisperRendererService.test.ts` passes (7 tests), including post-disposal ordinary/cancellation settlement, deterministic waiter cleanup, and a fresh lifecycle replay.
- `npm run verify:local-whisper:ui` passes (50 tests).
- `npm run test:local-whisper:ipc` passes (85 tests).
- `npm run typecheck` passes.
- `npx eslint src/renderer/localWhisper/useLocalWhisperSettings.ts src/renderer/localWhisper/LocalWhisperSettingsLifecycle.ts tests/renderer/localWhisper/LocalWhisperSettingsLifecycle.test.ts tests/renderer/localWhisper/LocalWhisperUiContracts.test.ts` passes.
- `npx prettier --check src/renderer/localWhisper/useLocalWhisperSettings.ts src/renderer/localWhisper/LocalWhisperSettingsLifecycle.ts tests/renderer/localWhisper/LocalWhisperSettingsLifecycle.test.ts tests/renderer/localWhisper/LocalWhisperUiContracts.test.ts` passes.
- Packets 01 and 02 introduced no remaining type-test failure; the shared-worktree fixture and renderer-prop failures that previously blocked `npm run test:types` are resolved.
- Linux loopback evidence is automated. Windows runtime and desktop-manual evidence remain mandatory in packet 04.
- `node --import tsx --test tests/main/localWhisper/ipc/ElectronLocalWhisperSenderAuthority.test.ts tests/main/localWhisper/ipc/LocalWhisperIpcController.test.ts tests/main/windowManager.test.ts` passes (31 tests), including same-document hash/history, nested-frame, renderer-loss, destruction, stale-send, synchronous-invalidation, and exact URL/frame ownership coverage.
- `npm run test:local-whisper:ipc` passes (88 tests).
- `npm run test:local-whisper:composition` passes (129 tests).
- `npm run typecheck` passes.
- `npm run test:types` passes.
- Scoped `npx eslint` and `npx prettier --check` for the Packet 03 authority, controller, fakes, and window tests pass.
- Packet 04 adds the read-only `local-whisper-remediation` matrix job for `ubuntu-latest` and `windows-latest`, with Node.js 24, 60-minute timeout, npm/Electron caches, and deterministic remediation checks. The existing unconditional `quality` job retains `npm run audit:prod`.
- Local Packet 04 preflight passes: `npm run test:local-whisper:artifacts` (32 tests), `npm run test:local-whisper:ipc` (88 tests), `npm run test:local-whisper:composition`, `npm run verify:local-whisper:ui`, qualification HTTPS tests (6 tests), `npm run typecheck`, `npm run test:types`, `npm run lint` (88 pre-existing warnings and no errors), `npm run build:prod` (webpack performance warnings only), and `npm run audit:prod` (0 vulnerabilities).
- `npm run format:check` and `npm run test:types` pass after formatting-only changes to `tests/main/localWhisper/capability/NvidiaRtx50Applicability.test.ts` and `tests/main/prettifyCodexCli.test.ts`. Their focused test command passes (21 tests).
- GitHub Actions [workflow dispatch run 31271967296](https://github.com/swimmwatch/gpt-voice/actions/runs/31271967296) passed the `Local Whisper Remediation` job on both `ubuntu-latest` and `windows-latest`, including the full Packet 04 command sequence.
- The same workflow’s overall conclusion is failure outside the Packet 04 matrix: existing Linux and Windows native-quality source-integrity checks failed, and the existing `quality` job’s full unit-test step failed. The Packet 04 remediation jobs completed successfully and no unrelated failure was changed.

## Exact Next Step

- Complete the pending Linux x64 and Windows x64 desktop smoke gates, then resolve the unrelated native-quality and full-unit-test CI failures through their owning workstreams before marking Packet 04 complete.

## Blockers

- Packet 04 remains incomplete because Linux and Windows x64 desktop smoke gates are pending. The overall workflow also remains failing due to unrelated native-quality source-integrity and full-unit-test failures; the dedicated Packet 04 matrix passed on both runners.
