# Local Whisper Handoff

## Authoritative state

- Specification revision 14 and plan revision 18 are Approved. Tasks 01–18 are
  complete and committed. Task 19 is reopened, incomplete, and uncommitted;
  Tasks 20–22 have not started.
- The development app, loopback server, filesystem guard, worker, launcher,
  model guard, and current development session are stopped. Reusable ignored
  development state remains private and includes the saved Local Whisper
  settings, opaque device identity, six installed exact models, the installed
  CUDA runtime, and public-only runtime attestation metadata.
- No candidate input digest, platform branch/result/evidence index,
  predecessor result, aggregate root, Production verdict, push, PR, signing,
  upload, publication, tag, or release exists.

## Task 19 work completed in the latest continuation

- Synchronized renderer target/runtime/backend/device and model dependent
  settings, excluded CPU from GPU backend choices, and reject incompatible
  drafts before IPC.
- Allowed an installed validated unloaded configuration to load lazily on the
  first transcription and present it as `Available on demand`.
- Adapted the generic provider configuration query through
  `LocalWhisperVoiceProvider.hasSession()` without introducing browser-session
  state.
- Moved reusable Electron/config state out of the ephemeral development
  session. Descriptors, staged resources, loopback trust, and server state
  remain session-owned and are removed on normal shutdown.
- Added a public-only runtime attestation store. Runtime archive signatures and
  public verification material remain stable across sessions, while private
  signing material and each catalog-envelope key remain ephemeral. The already
  installed CUDA runtime is recognized after restart without downloading it
  again.

## Current blocker

- The restarted ordinary application authenticated the development catalog and
  recognized all six models plus the installed CUDA runtime. Provider settings
  readiness succeeded and no backend download was requested.
- The next normal recording reached lazy model loading, then failed after the
  bounded load attempt with `MODEL_LOAD_FAILED`. No transcript or private audio
  evidence was retained. This invalidates the prior Task 19 completion claim
  and keeps `AC-MAN-015` incomplete.

## Verification completed

- Passed: `test:local-whisper:development`, `artifacts`, `catalog`,
  `composition`, `ipc`, `ui`, `ui:accessibility`, `packaging`,
  `qualification` (one intentional predecessor-package skip),
  `acceptance-ownership`, and
  `verify:local-whisper:implementation-readiness`.
- Passed after the implementation changes: `typecheck` and `test:types`.
- `lint` reported zero errors; the two newly introduced warnings were then
  corrected. The three reported formatting targets were formatted. Final lint
  and format rechecks remain pending.
- `test:unit`, `audit:prod`, `build:prod`, and `smoke:fedora` remain pending
  after the final fix.

## Exact next step

1. Re-run lint and formatting, then restart the ordinary development app.
2. Reproduce `MODEL_LOAD_FAILED` with content-free worker/coordinator lifecycle
   evidence and determine the exact CUDA load failure without recording native
   private output, audio, transcripts, paths, or device identifiers.
3. Fix the load path, verify save/restart without another runtime download, and
   complete one successful ordinary CUDA load/transcribe/unload flow.
4. Run the remaining Task 19 checks and update this handoff and `todo.md`.
5. The user authorized atomic commits after the fix. This incremental packet
   still stops before push; pushing requires a separate authorized action.
