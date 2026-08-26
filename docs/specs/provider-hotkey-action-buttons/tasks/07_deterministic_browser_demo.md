# 07 Deterministic Browser Demo

## Outcome

Update the development-only browser demo to render the completed production
homepage composition at exactly 620 × 292 with deterministic review data and
privilege-free key interactions. Prove hover, focus, press/release,
enabled-to-locked, final Disabled, and reduced-motion states without invoking
or simulating any recording, selected-text, provider, OS, session, persistence,
notification, or network work. Also prove the complete contextual action matrix,
timer/status priority, focus recovery, and no-megabytes treatment while leaving
the provider key design unchanged, then leave the demo open for review.

## Prerequisites

- Packets 03..06 are complete and approved.
- Read `AGENTS.md`, `tasks/todo.md`, `tasks/handoff.md`, and the **Desktop,
  Browser, And Packaging** convention section.
- Inspect `ProviderHotkeyDemo`, its renderer entry/webpack route and isolated
  stylesheet, shared production homepage components, existing deterministic
  demo tests, and the three approved visual references.

## Owned Requirements

- OUT-006, OUT-007
- SCOPE-001, SCOPE-006, SCOPE-007
- UI-002..UI-006, UI-008, UI-011, UI-014..UI-021
- FLOW-011, FLOW-012
- ACTION-001..ACTION-011
- MOTION-001..MOTION-014
- DEMO-001..DEMO-009
- PRIV-001, PRIV-002
- FAIL-007, FAIL-009, FAIL-011
- NON-006, NON-008..NON-010
- AC-AUTO-001..AC-AUTO-004, AC-AUTO-016, AC-AUTO-019,
  AC-AUTO-020, AC-AUTO-023..AC-AUTO-025
- AC-MAN-001..AC-MAN-004

## In Scope

- Exact complete browser fixture using production components and key styles.
- Deterministic Local Whisper/Codex CLI/Google Translation review data.
- Visual-only interaction/lock controls and deterministic timers.
- Deterministic Voice lifecycle, Prettify owner, Translation owner, unknown
  owner, and higher-priority status fixtures with exact contextual tiles.
- Demo isolation/no-capability tests, browser interaction checks, and local
  review screenshots where existing project practice permits.

## Out Of Scope

- Any `window.electronAPI` call, real provider/recording/clipboard/selected-text
  action, operational success/failure simulation, external URL, or packaged
  application navigation.
- Production-only CSS forks, persistent demo controls/state, analytics, or
  network mocking.
- Provider hotkey restyling or demo-only contextual tile variants that diverge
  from packet 05's production component/style.

## Task Contract

1. Render the complete resulting homepage through existing production
   `MainToolbar`, `MainPrettifyProviderBand`, `TranslateSection`, retained
   `RecordingControls`, and packet-03 `HotkeyActionButton` components. Fixture
   adapters may supply serializable props only; do not copy the component tree.
2. Set the page/root/home container and browser review viewport to exactly
   620 × 292 CSS pixels at device scale factor 1, with the same 60/57/60/60/54
   grid and no document overflow or scrollbars.
3. Default deterministic review data is:
   - Voice: Local Whisper, accelerator `F9`;
   - Prettify: Codex CLI, model `gpt-5.6-luna`, accelerator
     `Ctrl + Shift + F12`;
   - Translation: Google Translation targeting English, accelerator
     `Ctrl + F11`.
4. Provide only deterministic visual-state controls/activation. Pointer,
   Enter, and Space can press/release the key and a demo-only control/state can
   cause an enabled action to become semantically locked. Demo state selectors
   cover idle; every Voice lifecycle; cancellable Prettify; cancellable
   Translation; ownerless lock; and higher-priority status detail. They change
   fixture presentation only and report no simulated provider success/failure.
5. Reuse packet 03's immediate semantic lock and timing. Further activation is
   rejected immediately, the established enabled appearance remains for the
   nominal 110 ms mechanical cycle, and the final approved Disabled treatment
   appears by 200 ms. Initial locked render is immediately Disabled; clearing
   a pending lock cancels cleanly; reduced motion removes positional/delayed
   motion while retaining state feedback.
6. Keep demo-only container, fixture controls, sizing, and state selectors in
   `providerHotkeyDemo.css` or an equivalent isolated demo stylesheet. Shared
   key rules remain packet 03's production owner. No demo selector may alter
   the production homepage bundle.
7. Reuse packet 05's production contextual tile and timer/status components.
   Render exact actions: Voice Cancel in starting; Pause/Stop/Cancel in
   recording; Resume/Stop/Cancel in paused; no tiles in idle/stopping; Cancel
   in transcribing/retrying; one Cancel for active cancellable Prettify or
   Translation; none for unknown/settled ownership. Unavailable actions are
   omitted, never shown as Disabled placeholders.
8. Use deterministic `F9`, `F10`, and `Esc` contextual legends and a controlled
   clock. Prove time advances only in recording, freezes in pause, resumes
   without paused duration, and yields to higher-priority status detail. Render
   no byte/megabyte text, element, accessible label, or hidden placeholder.
9. Contextual tiles accept pointer, Enter, and Space as local visual feedback.
   A tile may advance to a safe fixture state solely to show tile removal/focus
   recovery, but it must not call Electron or emulate provider/recording
   success. Provider key markup/styles/props remain packet 03's exact baseline.
10. Ensure the demo bundle and fixture contain no microphone/media call,
   clipboard read/write, selected-text automation, Electron/preload access,
   provider/network request, browser session/profile, process execution,
   filesystem mutation, notification, persistence, telemetry, or external
   asset URL. Do not emulate these capabilities behind fake success.
11. Keep the demo excluded from packaged application navigation and production
   startup. Preserve only a development entry/route and deterministic static
   assets.
12. Add automated source/bundle/fixture tests for exact geometry/data, reuse of
   production components, no privileged API, no external network/persistence,
   semantic/final lock state, complete contextual matrix, timer/status
   priority, no megabytes, focus recovery, unchanged provider-key contract,
   reduced-motion CSS, and demo-style isolation.
13. Build/start the demo with the repository's existing development command,
    use the available local browser tooling to set a 620 × 292 viewport,
    inspect console and document bounds, exercise the manual interactions, and
    leave the exact-size demo open after successful verification.

## Contracts And Boundaries

- Browser demo data is synthetic and non-sensitive. It does not receive the
  general Electron API and cannot own business state.
- Production components/appearance are source of truth; demo code owns only
  deterministic props and review controls.
- No dependency, persistence, packaged route, external service, or generated
  runtime asset is added.

## Expected Files Or Components

- Update `src/renderer/ProviderHotkeyDemo.tsx`.
- Update `src/renderer/entries/providerHotkeyDemo.tsx` only as needed to mount
  the exact fixture.
- Update `src/renderer/styles/providerHotkeyDemo.css` with demo-only sizing and
  controls; do not duplicate shared key CSS.
- Update `webpack.config.js` only for the existing development demo entry/route
  contract and production exclusion if current demo work is incomplete.
- Add `tests/renderer/providerHotkeyDemo.test.ts` for structure, privacy, style
  isolation, and exact fixture geometry; extend
  `tests/scripts/webpackConfig.test.ts` for development-entry/production
  exclusion when required.
- Do not commit local browser screenshots unless the repository specification
  explicitly names them as durable design artifacts; record paths/results in
  `handoff.md` when they remain temporary.

## Acceptance Criteria

- The demo is exactly 620 × 292 with a 54-pixel footer, correct deterministic
  data, and no overflow/clipping/repositioning.
- Every key supports hover/focus/press/release/Enter/Space and the exact
  semantic-lock/visual-transition/reduced-motion contract.
- The demo imports production components and shared key styles, while all
  fixture overrides remain isolated.
- Every deterministic state renders the exact available-only contextual action
  list; timer/status priority is visible and no megabyte value exists.
- Provider key visuals, geometry, motion, markup, and public props match the
  packet 03 baseline exactly.
- Automated inspection finds no privileged, provider, network, persistence, or
  sensitive-data capability and no packaged navigation.
- `AC-AUTO-001`..`004`, `016`, `019`, `020`, `023`..`025` and manual gates
  `AC-MAN-001`..`004` are satisfied with local evidence.

## Verification

- `rtk node --import tsx --test tests/renderer/providerHotkeyDemo.test.ts tests/renderer/hotkeyActionButton.test.ts tests/renderer/hotkeyActionButtonTransition.test.ts tests/renderer/contextualProviderActions.test.ts tests/renderer/recordingElapsedTime.test.ts tests/scripts/webpackConfig.test.ts`
- `rtk npm run typecheck`
- `rtk npm run test:types`
- `rtk npm run build:prod`
- `rtk npm run lint -- --max-warnings 0`
- `rtk git diff --check`
- In the available browser, verify `document.documentElement` and the main
  container report 620 × 292 and zero overflow at device scale factor 1.

## Failure And Rollback

- Any privileged API call, external request, persistent state, simulated
  provider result, packaged navigation, or style leak is a hard packet failure.
- Any interrupted timer must settle to current fixture state before another
  review action.
- Rollback removes the demo-only changes while preserving production packets
  01..06.

## Manual Gates

- **MANUAL GATE — AC-MAN-001:** Compare the exact-size idle demo against
  `provider-hotkey-demo-compact-height.png`, the aligned-key reference, and the
  compact-footer/contextual-action references; record no provider-key visual
  change, megabyte value, overflow, clipping, or unintended movement.
- **MANUAL GATE — AC-MAN-002:** Exercise hover, focus, pointer hold/release,
  Enter, and Space for every key and confirm adjacent content is stationary.
- **MANUAL GATE — AC-MAN-003:** Trigger enabled-to-locked and confirm immediate
  input rejection, brief enabled appearance, and final Disabled treatment.
- **MANUAL GATE — AC-MAN-004:** Repeat with reduced motion and confirm no
  positional motion/delayed behavior lock.
- Exercise every Voice lifecycle and both selected-text owners. Confirm the
  exact available-only tile matrix, three-tile maximum fit, timer freeze/resume,
  status-detail priority, and deterministic focus recovery after tile removal.
- Use synthetic data only and leave the verified 620 × 292 demo open.

## References

- `provider-hotkey-demo-compact-height.png`.
- `docs/design/provider-hotkey-buttons-left-aligned.png`.
- `docs/design/status-area-options/01-compact-fixed-footer.png`.
- `docs/design/recording-hotkey-options/02-shortcut-action-tiles-no-megabytes.png`.
- Specification: **Browser Demonstration**, **Security And Privacy**, and
  `AC-AUTO-016`, `AC-AUTO-025`, `AC-MAN-001`..`004`.

## Completion And Handoff

After checks/manual gates pass, mark only packet 07 complete, record the demo
URL/viewport/browser evidence and packet 08 as next in `handoff.md`, present the
increment for review, and stop. Do not commit or start packet 08 without a
later explicit invocation.
