# 06 Reveal Stage-Aware Startup Loader

## Outcome

The static HTML bootstrap shell yields to the existing localized React startup loader
as soon as React and localization are ready, allowing real startup stages and truthful
progress to remain visible until represented work reaches a terminal state.

## Prerequisites

- Packets 01–05 are complete.
- The approved 2026-08-10 startup-loader handoff decision is recorded.

## Owned Requirements

- `FLR-018`

## In Scope

- Mark the main renderer startup gate ready after localization, rather than after all
  startup jobs settle.
- Keep `App` rendering the existing startup-mode `LoadingScreen` while startup work is pending.
- Use only the one-time Translation settings/bootstrap signal for renderer-owned
  startup work. A later Translation provider `checking` state belongs exclusively
  to the inline provider status and must not reopen the full-window loader.
- Align the static fallback spinner with the shared loader and remove it from the
  accessibility tree once React takes ownership.
- Add focused startup gate and appearance coverage.

## Out Of Scope

- New loader components, colors, assets, progress estimates, startup IPC/schema
  changes, other renderer-window behavior, provider-selection behavior, packaging,
  commits, or live browser work.

## Task Contract

1. The static loader remains the only visible fallback before React and localization
   are ready. It contains no fabricated percentage or localized stage text.
2. Once localization is ready, the static shell fades out while the React startup
   screen is visible. The React screen retains its existing concurrent job order,
   measured progress, indeterminate fallback, safe retry, and terminal behavior.
3. A retryable CloakBrowser preparation failure remains on the startup screen with
   Retry. Terminal disconnected provider state lets the main window appear with the
   existing provider status.
4. After startup has closed, a Translation provider switch uses the existing inline
   checking state and configuration/recording locks; it cannot render `LoadingScreen`
   or restart first-launch presentation.
5. Other renderer windows retain their existing readiness conditions and generic
   loading presentation.

## Contracts And Boundaries

- Renderer startup data remains constrained to existing localized stage keys and safe
  numeric progress through `window.electronAPI`.
- The static HTML shell never receives privileged state, raw errors, filesystem paths,
  URLs, credentials, sessions, or provider content.

## Expected Files Or Components

- `src/renderer/App.tsx`, `src/renderer/firstLaunchStartupState.ts`,
  `src/renderer/WindowStartupGate.tsx`, `src/renderer/index.html`
- Existing startup state/loading and window-appearance tests

## Acceptance Criteria

- The user sees the localized startup stage screen during pending work, with no blank
  frame or double accessible status during handoff.
- Progress remains measured-only; unknown totals remain indeterminate.
- The static shell closes at React/localization readiness, while the startup screen
  closes only after represented work reaches a terminal state.
- A post-startup Translation `checking` state never renders the startup screen.

## Verification

- Run focused startup state, loader, window startup, window appearance, coordinator,
  and application tests.
- Run `npm run typecheck`, `npm run test:types`, scoped ESLint/Prettier, and `git diff --check`.

## Failure And Rollback

- Revert only the main-window gate condition and static-shell accessibility/style
  changes if handoff fails. Preserve coordinator, Retry, and provider startup logic.

## Manual Gates

- Linux and Windows packaged startup handoff confirmation requires separate
  authorization and is recorded with the deferred platform qualification work.

## References

- Specification: `FLR-018`.
- Existing startup presentation: `src/renderer/firstLaunchStartupState.ts` and
  `src/renderer/components/LoadingScreen.tsx`.

## Completion And Handoff

- Mark this packet complete only after its focused and type/format checks pass.
- Update this workstream's `todo.md` and `handoff.md`; leave the completed change
  uncommitted for review.
