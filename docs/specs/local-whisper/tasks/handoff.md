# Local Whisper Handoff

## Authoritative State

- Specification revision 7 and plan revision 12 are Approved.
- Tasks 01–15 are complete and committed. Task 16 is complete and remains
  uncommitted for review.
- AMD remains **Preview · Untested**. macOS remains
  **Planned · Unavailable**. Representative Windows execution remains
  exclusively in Task 19.

## Task 16 Completed

- Added a dedicated responsive Local Whisper provider-settings page with
  independent setup, compatibility, residency, activity, safe failure, and
  support state; approximate RAM/VRAM ranges for all six model families; exact
  catalog estimates, qualified peaks, current resource/headroom facts, and
  selected-stack identity.
- Added one snapshot-backed draft lifecycle that preserves edits across
  progress snapshots, rebases only after successful save/reset, serializes only
  active target/strategy fields, and enforces prompt, temperature, strategy,
  q5_0, language, device, revision, and host CPU-thread validation.
- Added immutable runtime/model artifact rows with bounded progress,
  download/resume/retry/cancel/remove actions, destructive confirmation,
  managed-folder access, opaque notice/provenance references, and explicit
  disabled reasons.
- Added production NVIDIA/CPU, AMD preview, and macOS planned-only labels. The
  main toolbar now consumes the Local Whisper main-status port and displays
  `Ready`, `Busy`, `Validated · Unloaded`, `Not ready`, `Planned`, or
  `Unsupported` without login, API-key, or browser-session actions.
- Completed the Task-15 renderer DTO with a sanitized host CPU bound, bounded
  resource decision, and model-variant option group. Strict IPC validation
  rejects forged host/resource facts; no path, URL, native, or raw-error
  authority entered the renderer.

## Changed Files

- UI and state: `src/renderer/localWhisper/`,
  `src/renderer/ProviderSettingsWindow.tsx`, `src/renderer/App.tsx`, and
  `src/renderer/components/MainToolbar.tsx`.
- Renderer-safe facts: `src/shared/localWhisper/ipc.ts` and
  `src/main/localWhisper/ipc/{LocalWhisperSnapshotService,createDeferredLocalWhisperEnvironment}.ts`.
- Tests and commands: `tests/renderer/localWhisper/`,
  `tests/main/localWhisper/ipc/localWhisperIpcTestUtils.ts`, and `package.json`.
- Task state: `tasks/todo.md` and this handoff.

## Verification

- Passed `test:local-whisper:ui`, `test:local-whisper:ui:contracts`,
  `test:local-whisper:ui:accessibility`, and `verify:local-whisper:ui` for the
  440 px/560 px, focus/live-region, draft race, action matrix, safe-boundary,
  and six-family estimate contracts.
- Passed `test:local-whisper:ipc` (**34 passed**), source and test typechecks,
  ESLint with zero issues, Prettier, and `git diff --check`.
- Passed the complete unit suite (**1,562 passed**), production dependency
  audit (**0 vulnerabilities**), development webpack build, and production
  webpack build. Production build retained the repository's non-failing
  entrypoint-size warnings.
- Remote CI and representative Windows, AMD, and macOS execution were not run
  and are not claimed.

## Exact Next Step

- Task 17 is the next eligible packet. Start it only through a separately
  authorized `incremental-implementation` invocation.

## Blockers And Manual Gates

- No deterministic Task-16 implementation blocker remains.
- `AC-MAN-008` compact-layout/accessibility review and `AC-MAN-009` AMD claims
  review remain human gates. `AC-MAN-011` remains a future physical Apple-host
  unavailable-state review; representative Windows execution remains Task 19.
- Authenticated production catalog/package inputs and privileged artifact and
  reference adapters remain intentionally deferred to Task 17; current
  production composition continues to fail closed.
- Commit, push, pull request, signing, packaging, publication, tag, upload, and
  release authority remain separately gated.
