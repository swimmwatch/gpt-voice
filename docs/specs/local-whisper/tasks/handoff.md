# Local Whisper Handoff

## Authoritative state

- Specification revision **17** and plan revision **23** are Approved and
  aligned across the plan, checklist, handoff, acceptance registry, and Task 24
  packet. Plan revision 21 and its revision-15 Task 24 contract are historical
  only.
- Task 24 Windows Runtime Delivery Readiness was committed and pushed as
  `7ebb102`. Its provider-selection, CUDA-runtime acquisition, transfer-journal
  performance, recoverable-transcription state, and automatic-language native
  transcription follow-up is complete and included in the authorized review
  commit. Work began from a clean native-Windows
  checkout whose HEAD contains `b796c46f`. Tasks 26, 25, 21, and 22 have not
  started.
- Task 24 covers Windows x64 CPU and RTX 50 `sm_120a` readiness only. It creates
  no candidate input digest, qualification result, evidence index, Production
  verdict, signing authority, upload, publication, support promotion, tag, or
  release.

## Task 24 result

- Sanitized host/toolchain identity: Git for Windows `2.55.0.windows.3`,
  PowerShell `7.6.4`, Node `v24.18.1`, npm `11.9.0`, rtk `0.42.4`, MSVC v143
  `14.39` with `_MSC_VER == 1939`, Windows SDK `10.0.26100.0`, CMake `3.31.8`,
  Ninja `1.12.1`, LLVM/clang-format `18.1.3`, CUDA Toolkit `12.8.1` with nvcc
  `12.8.93`, NVIDIA driver `610.88`, and an RTX 5090 reporting compute
  capability `12.0`.
- Exact profiles are `windows-x64-cpu-msvc-19.39-v1` and
  `windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1`. Both use the independently
  authenticated Microsoft VC Runtime x64 `14.51.36247.0` app-local closure.
  npm registry connectivity was verified, `ci:install` passed, and the Windows
  CloakBrowser input was prepared only for the authorized application/package
  checks.
- Added deterministic native-Windows tool activation, authenticated VC Runtime
  materialization, PE dependency closure, CPU/CUDA pack production, explicit
  platform-aware catalog/runtime tooling, Windows development activation,
  native filesystem guard and launcher behavior, base-resource boundaries, and
  unpacked-package inspection. Existing provider, artifact, IPC, settings,
  capability, worker, residency, and packaging components remain the only
  application path.
- Independent checks run concurrently where their outputs are isolated. CUDA
  compilation uses eight jobs. CPU and CUDA archive production intentionally
  runs sequentially because concurrent producers shared Windows toolchain/temp
  state and produced non-identical first-build bytes; the sequential boundary
  restores the required exact reproducibility contract.
- CPU pack: archive SHA-256
  `e8368bff71b6f04e75ea40c5ad45eadeaa14670972a0678fe8bbfdfa78c83b14`,
  pack-record digest
  `090affa9dcd01fcdd9513ea3207100076b057a0ed03a5590c2325a46558e36e8`,
  reproducibility digest
  `227fe499f898a12219dad834943eef8aa463ab6f8570a47ac0c0d7e0f55f68c7`.
- CUDA pack: archive SHA-256
  `f5bd1533e4c6cfca19af0ce9949fed4d29638d5a4565c93c4e2885b7525c2bd9`,
  pack-record digest
  `f2f0629ce3943de9049a78bdae12bca8d7c46d97cd2d29ffb2277826c7366bc6`,
  reproducibility digest
  `ce4229a99148f95cb0996f67d4be3c727ca13a97955668ff50abc648b35ff6ad`.
  Both records report `reproducible: true` from two clean roots.
- The unpacked application contains exactly the authenticated
  `fs-guard.exe` and `local-whisper-launcher.exe` base helpers. Workers, CUDA
  libraries, models, development trust, and qualification inputs are absent
  from base resources.

## Changed files

- Plan/readiness: `docs/specs/local-whisper/decisions.yaml`, plan revision 23
  task packets and registries under `docs/specs/local-whisper/tasks/`,
  `scripts/local-whisper/validate-task-plan.mjs`, and the implementation-
  readiness verifier and tests.
- Native/runtime profiles: the two Windows profiles, the exact VC Runtime lock
  and schema under `runtime/local-whisper/toolchains/`, Windows process-identity
  common code, and the existing fs-guard, launcher, and whisper.cpp Windows
  sources/build definitions and tests under `runtime/local-whisper/`.
- Tooling: `package.json`; Windows toolchain, runtime-materializer, PE audit,
  runtime-pack, integration, application-smoke, unpacked-package, and aggregate
  readiness tooling under `scripts/local-whisper/`; plus the existing source-
  import, native-build, development, qualification, packaging, and pack-audit
  components generalized for explicit Windows input.
- Application/runtime: the existing Local Whisper artifact, capability,
  composition, development, filesystem, packaging, and supervisor components
  under `src/main/localWhisper/`, with focused fixtures and tests under
  `tests/`.
- Post-commit provider-selection UI follow-up: the existing selection service
  and composition root, `App.tsx`, `MainToolbar.tsx`, the main status indicator,
  the legacy compatibility fixture, and focused composition/renderer tests.
  Local Whisper can now remain selected while not ready. The main toolbar now
  reports `Not connected` without opening settings. Transient provider
  switching no longer re-enters the startup screen.
- CUDA acquisition bootstrap follow-up:
  `createProductionLocalWhisperEnvironment.ts` now keeps a trusted Windows CUDA
  pack selectable for managed download before GPU topology discovery. GPU target,
  backend, device selection, compatibility, and execution remain fail-closed
  until the exact installed runtime discovers a trusted device.
- Transfer journal performance follow-up: `LocalWhisperArtifactService` now
  writes a durable resume checkpoint every 4 MiB rather than for every 64 KiB
  transport block. The renderer continues to receive rate-limited progress;
  handled failures force the latest checkpoint, while an interrupted process
  safely truncates and replays at most the bounded uncheckpointed tail.
- Recoverable-transcription state follow-up: `LocalWhisperCoordinator` keeps a
  healthy loaded worker and `Ready` provider state after empty audio results,
  unsupported input, or a cooperatively cancelled request. The failed request
  still returns its exact safe error. Local Whisper batch audit now classifies
  `EMPTY_TRANSCRIPTION` as `empty-result` instead of `unexpected-failure`.
- Automatic-language native transcription follow-up: the task-owned log showed
  a valid canonical WAV reaching a loaded CUDA worker before an empty result,
  while the same microphone path succeeded through OpenAI API. The native
  adapter no longer sets whisper.cpp's detection-only `detect_language` flag;
  `language=auto` now detects the language and continues transcription. The
  Windows application smoke now exercises `auto`. MSVC `/pathmap` plus its
  required deterministic compiler mode removes clean-build-root identity from
  C/C++ and CUDA host objects while preserving reproducible CPU/CUDA packs.
- User and task documentation: `docs/local-whisper.md`, `todo.md`, and this
  handoff. The follow-up commit's changed-file list is authoritative.

## Verification

- Passed registered commands:
  `npm run test:local-whisper:windows-readiness` and
  `npm run verify:local-whisper:windows-readiness`. The latest aggregate completed in
  730.4 seconds and covered focused contracts, native quality, release helpers,
  deterministic CPU/CUDA packs, direct CPU/CUDA integrations, pack audit,
  production build, unpacked Windows packaging, and packaged-resource checks.
- Passed filesystem native tests, launcher native tests, supervisor (43),
  composition (118), development, capability, packaging, acceptance ownership,
  implementation readiness, TypeScript typecheck/type tests, ESLint, Prettier,
  C++ clang-format checks, production build, `dist:win -- --dir`,
  `verify:packaged`, and `git diff --check`.
- Follow-up checks passed: composition (118), Local Whisper UI, UI contracts,
  accessibility, window-startup state, TypeScript typecheck, ESLint with only
  the pre-existing warning baseline, production build, and
  `npm run test:local-whisper:windows-readiness`. The updated native-Windows dev
  application was rebuilt and relaunched for interactive review.
- CUDA acquisition bootstrap checks passed: production-environment composition
  (44), TypeScript typecheck, focused ESLint, production build, and
  `npm run test:local-whisper:windows-readiness`. The Windows dev application
  was rebuilt and relaunched; select the CUDA runtime revision to start its
  managed download, then select the discovered RTX 5090 after installation.

- Transfer-journal performance checks passed: artifact lifecycle tests (10,
  including a 10 MiB 64 KiB-chunk stream with at most four durable journal
  writes), TypeScript typecheck, focused ESLint (pre-existing two
  max-parameter warnings only), Prettier, `git diff --check`, and production
  build. The updated native-Windows dev application was relaunched for
  interactive review. The local CUDA pack source read at a sanitized
  3,864 MiB/s; no external CDN is used by the development runtime server.
- Recoverable-transcription checks passed: coordinator tests (28), Local
  Whisper transcription-dispatch tests (8), composition (119), TypeScript
  typecheck, focused ESLint, Prettier, the registered
  `npm run test:local-whisper:windows-readiness`, and production build. A
  sanitized task-owned development log established the observed sequence:
  successful CUDA model load, one empty transcription result, then the prior
  erroneous `notConfigured` state. No audio or transcript content was read or
  retained.
- Automatic-language regression checks passed: the updated application smoke
  first reproduced `EMPTY_TRANSCRIPTION` against the previous worker, then
  passed CPU, exact RTX 5090 CUDA, restart-offline reuse, and cleanup against
  the rebuilt workers. Native core passed 10/10; CPU and CUDA clean-root worker
  hashes matched; `test:types`, typecheck, Prettier, both registered Task 24
  commands, native integrations, pack audit, production build, and unpacked
  package verification passed. No microphone audio or transcript content was
  inspected or retained. The updated native-Windows dev application was
  relaunched; its fresh startup log contains only the expected `not-configured`
  readiness state until the rebuilt runtime is installed and the model loaded.
- Bounded ordinary-app smoke passed in 274.3 seconds: CPU ran without GPU
  initialization; CUDA used the exact RTX 5090 `sm_120a` selection with no
  fallback; Check compatibility, Load, one pinned public deterministic WAV
  transcription, Free, restart-offline reuse, and cleanup all passed.
- The Linux-only common-native clang-tidy/sanitizer command remains an external
  Linux CI gate by design; it was not represented as a Windows pass. Task 21
  qualification commands and the all-model Windows matrix were not run.

## Cleanup, remaining gates, and next packet

- The fresh task-owned application-data root and ephemeral TLS certificate/key
  were removed after the smoke. No screenshots, transcripts, raw audio,
  hardware identifiers, private paths, certificates, or complete logs were
  retained as repository evidence. Download/build/dependency caches and pack
  outputs remain outside Git; no release installer was installed or removed.
- No Task 24 blocker remains for review. RTX 30 `sm_86` and RTX 40 `sm_89`
  physical checks are explicitly **Pending — external representative hardware
  required**. This RTX 5090 result cannot satisfy or waive them.
- The exact next packet is
  `26_hardware_matched_nvidia_cuda_runtime_expansion.md`. Do not start it until
  separately authorized. Stop before Task 25 candidate freeze/qualification,
  Task 21 Windows qualification, Task 22 aggregate readiness, follow-up commit
  or push beyond the currently authorized review update, PR, signing, upload,
  publication, support promotion, tag, or release.
