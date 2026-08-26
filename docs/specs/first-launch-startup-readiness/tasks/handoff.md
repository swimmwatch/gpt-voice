# First-launch startup readiness handoff

Completed packets: `01_startup-preparation-foundation.md`,
`02_unselected-provider-flow.md`,
`03_main-startup-orchestration-and-ipc.md` (`a8029e3b`),
`04_loader-state-and-interface.md` (`1e0920ea`), and
`05_first-launch-review-remediation.md`.

Packet 06 is implemented and intentionally uncommitted. The static pre-React shell
now yields at localization readiness to the existing stage-aware React loader, which
remains until represented startup work is terminal. The requested full-unit command
did not complete: the pre-existing diagnostics-archive test stayed idle for more
than ten minutes and was stopped without a failure report. Rerun that gate before a
full-suite verification claim.

Changed files (packet 06): `src/renderer/App.tsx`,
`src/renderer/firstLaunchStartupState.ts`, `src/renderer/WindowStartupGate.tsx`, and
`src/renderer/index.html`; focused startup and window-appearance tests; the
first-launch specification, decisions, task packet, plan, checklist, and this
handoff. No startup IPC, persistence, dependency, asset, package, or other
renderer-window contract changed.

Changed files (packet 05): startup runner and Retry IPC in
`src/main/di/mainProcessCompositionRoot.ts` and `src/main/ipc.ts`; loader
mode/accessibility in `src/renderer/App.tsx` and
`src/renderer/components/LoadingScreen.tsx`; focused main/renderer tests;
packet plan/checklist; and formatting-only updates to the ten files previously
reported by Prettier, including `src/main/cloakbrowser.ts`,
`src/main/firstLaunchStartupCoordinator.ts`, and
`src/main/localWhisper/ipc/VoiceProviderSelectionService.ts`.

Checks run: `npm run typecheck` (pass); focused `node --import tsx --test`
suite for coordinator, application, composition root, startup IPC/preload,
startup reducer/loader, window readiness, and recording controls (57 pass);
direct `npx eslint --quiet` for changed and formatting-only files (pass);
`npm run format:check` (pass); and `git diff --check` (pass).

Packet 06 checks: focused startup coordinator/IPC/state/loader/window-appearance
tests passed; `npm run typecheck`, `npm run test:types`, scoped ESLint, scoped
Prettier, and YAML parsing passed. `npm test` was terminated with exit 143 only after
`tests/main/diagnosticsArchive.test.ts` stayed idle for over ten minutes without a
failure report. Linux and Windows packaged startup-handoff confirmation remains a
manual gate in the Translation supported-platform qualification packet.

Follow-up regression correction: a post-startup Translation `checking` state was
mistakenly counted as renderer bootstrap work and reopened the full-window loader.
The startup presentation now uses only one-time Translation settings/bootstrap work;
the focused first-launch, inline Translation status, and window tests passed after
the correction.

Manual gates pending: package/browser smoke and disposable clean-profile UI,
keyboard Retry, screen-reader, bundled-runtime, and missing-runtime Retry
checks remain unrun because they require separate network/manual authorization.

Next packet: none. The workstream is ready for review; Packet 05 is left
uncommitted.

Blockers: none within Packet 05.
