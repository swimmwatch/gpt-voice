# Local Whisper Handoff

## Authoritative state

- Specification revision 15 and plan revision 19 are Approved. Tasks 01–19 are
  complete and committed. Task 23 and its Q5_0/load-path follow-ups are complete
  and committed as `043aba8`, `b48877d`, and `a4a0a2a`. Tasks 20–22 have not
  started.
- No candidate input digest, platform branch/result/evidence index, predecessor
  result, aggregate root, Production verdict, PR, signing, upload, publication,
  support promotion, tag, or release exists. The settings redesign `0e50716d`,
  resource-preview fix `90c0d8dd`, and live selected-GPU VRAM fix `c258a24` are
  committed on the current branch.
- The authorized development app is running the current build with the Local
  Whisper settings window open after live resource verification. The model is
  unloaded. The authenticated CPU runtime remains installed, the saved
  CUDA/GPU Large v3 Turbo Q5_0 selection remains active, and desktop animations
  remain enabled.

## Task 23 implementation

- Added the separate exact `local-whisper:main:residency-command` IPC channel,
  closed positive-revision `load|unload` request/result validators, exact main
  sender/provider/revision/action authorization, exactly-once coordinator
  delegation, and sanitized lifecycle audit/result projection.
- Added preload/renderer contract parity and revision-aware pending, result,
  subscription, reload, and replacement reconciliation without optimistic
  residency or duplicate invocation.
- Added the localized accessible main-toolbar Load/Free control with focusable
  disabled reasons, tooltips, status announcements, failure alert, reduced-motion
  spinner contract, and compact-layout styling. Remote providers and Ollama
  Prettify remain separate.
- Added provider-switch conflict, malformed/stale/forged IPC, revision ordering,
  accessibility, localization, composition, and plan-readiness regression
  coverage. Revision-19 validation now owns 23 packets and 76 automated
  acceptance IDs.
- Corrected GGML Q5_0 preflight so the model-header file type is `8` while the
  tensor type remains `6`; the regression accepts the upstream versioned
  `ftype = 2008` used by Large v3 Turbo Q5_0.
- Reused the GPU binding already proven by successful post-load device evidence
  for the immediately following binding revalidation. Required pre-load and
  post-load device proof remain intact, while one duplicate registry worker
  discovery is removed from each successful GPU load.

## Settings-window follow-ups

- Redesigned and committed the Local Whisper settings experience as `0e50716d`,
  including the window-centered loader and a continuous canvas/scrollbar-gutter
  background without a visible right-edge seam.
- Added selected-model RAM/VRAM peaks, live system RAM, safe-reserve values, and
  fail-closed resource presentation as `90c0d8dd`.
- Added bounded, shell-free `nvidia-smi` sampling for the exact selected private
  PCI identity. The process graph caches samples only against the current opaque
  NVIDIA device, republishes them after device refresh and compatibility
  preflight, and leaves availability unknown on unsupported or failed telemetry.
  This follow-up is committed as `c258a24`.

## Changed files

- Shared/main/preload: `src/shared/localWhisper/ipc.ts`,
  `src/main/localWhisper/ipc/LocalWhisperIpcController.ts`,
  `src/main/localWhisper/audit/LocalWhisperCommandAudit.ts`,
  `src/main/di/mainProcessCompositionRoot.ts`, `src/main/preloadApi.ts`.
- Renderer: `src/renderer/App.tsx`, `src/renderer/components/MainToolbar.tsx`,
  `src/renderer/localWhisper/LocalWhisperPresentation.ts`,
  `src/renderer/localWhisper/LocalWhisperRendererService.ts`,
  `src/renderer/localWhisper/useLocalWhisperMainStatus.ts`,
  `src/renderer/localWhisper/components/LocalWhisperMainResidencyControl.tsx`,
  `src/renderer/styles/globals.css`, and `src/renderer/types.d.ts`.
- Localization: all 11 `src/main/i18n/` locale catalogs.
- Tests: shared IPC, main IPC/coordinator/composition/preload, renderer service,
  presentation, UI, and accessibility contracts under `tests/`.
- Follow-up fixes: `runtime/local-whisper/whisper-cpp/core/model_format_preflight.cpp`,
  `runtime/local-whisper/whisper-cpp/tests/model_format_preflight_test.cpp`,
  `src/main/localWhisper/composition/LocalWhisperProductionWorkerPort.ts`, and
  `tests/main/localWhisper/composition/LocalWhisperProductionWorkerPort.test.ts`.
- Settings resource follow-up: `src/main/main.ts`,
  `src/main/localWhisper/capability/NvidiaSmiVramAvailability.ts`,
  `src/main/localWhisper/capability/SelectedDeviceVramAvailability.ts`,
  `src/main/localWhisper/composition/createProductionLocalWhisperEnvironment.ts`,
  their focused capability/composition tests, and the Linux qualification
  dependency stub.
- Plan/readiness: `scripts/local-whisper/validate-task-plan.mjs`,
  `scripts/local-whisper/implementation-readiness/LocalWhisperImplementationReadinessVerifier.ts`,
  and the revision-19 local-whisper specification, decisions, task packets,
  acceptance-owner registry/schema, checklist, and this handoff.

## Verification

- Passed `test:local-whisper:ipc` (55),
  `test:local-whisper:composition` (105), `verify:local-whisper:ui`,
  `test:local-whisper:acceptance-ownership`, and
  `verify:local-whisper:implementation-readiness`.
- Passed `typecheck`, `test:types`, `format:check`, and `git diff --check`.
  `lint` reported zero errors and 62 pre-existing warnings. The full unit suite
  passed 1,747 tests with one intentional skip.
- Passed the Whisper.cpp loader suite under GCC and Clang ASan/UBSan, CPU and
  CUDA integration for the canonical Linux profiles, and CPU/CUDA pack audits.
- Authorized CUDA smoke passed with the saved installed stack: Load entered the
  pending state and created one GPU worker, a simultaneous provider switch was
  rejected while Local Whisper remained selected, renderer reload replayed the
  Loaded state without replacing or duplicating the worker, and keyboard focus,
  tooltip, pending status, compact English layout, and keyboard Free behavior
  were visible. Free removed the worker and GPU allocation.
- After explicit authorization, the missing authenticated CPU runtime was
  downloaded through the development artifact flow. CPU selection and Save
  succeeded without the prior save error; CPU Load reached Loaded without an
  NVIDIA compute allocation, and CPU Free removed its worker.
- Reduced motion was verified after restarting Electron with desktop animations
  disabled: pending-spinner captures 600 ms apart had identical decoded pixels.
  The final CUDA Load/Free again created and removed the GPU worker/allocation.
  The CUDA/GPU `base/full` selection was restored and saved, desktop animations
  were re-enabled, and private temporary screenshots were deleted.
- Large v3 Turbo Q5_0 loaded successfully twice through the ordinary
  application after the header fix. Direct CUDA engine loads were approximately
  2.37–2.74 seconds for Base, 5.50–5.52 seconds for Large v3 Turbo, and 9.06
  seconds for Large v3. Ordinary application loads remained approximately 70
  seconds for Base and 80–122 seconds for Large v3 Turbo because guarded runtime
  verification, registry/device proof, and warm-up dominate the native load.
  The duplicate post-load registry discovery described above is now removed;
  no post-fix ordinary-application timing claim has been recorded.
- A later Large v3 Turbo attempt correctly failed the conservative memory gate:
  about 12.65 GB was available while about 12.88 GB was required. Runtime
  restart reuse was also reconfirmed without a backend redownload; older
  duplicate development-runtime directories remain untouched.
- The settings follow-up passed Local Whisper capability (22), IPC (60),
  composition (105), composition activation (41), and UI verification tests,
  plus focused ESLint, Prettier, TypeScript typecheck, webpack build, and
  `git diff --check`.
- Live verification on the selected NVIDIA device showed 9.16 GiB available,
  7.96 GiB safe to reserve, a 6.00 GiB selected-model peak, and `Safe to load`.
  The centered layout and continuous scrollbar-gutter background were also
  confirmed. The private temporary screenshot was deleted.

## Exact next packet and blockers

- No Task 23 or settings-resource blocker remains. The settings redesign and
  resource-preview follow-ups and the live VRAM fix are committed on the current
  branch.
- The exact next packet is `20_linux_qualification.md`, which requires a later
  incremental-implementation invocation after Task 23 review/commit. Stop before
  push, qualification, candidate freeze, PR, signing, upload, publication, tag,
  or release unless separately authorized by the applicable workflow.
