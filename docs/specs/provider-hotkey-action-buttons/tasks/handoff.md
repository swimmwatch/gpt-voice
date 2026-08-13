# Provider Hotkey Action Buttons — Handoff

## Completed Packets

- 01 — [Action Eligibility Contracts](./01_action_eligibility_contracts.md)
- 02 — [Main Action Dispatch And IPC](./02_main_action_dispatch_and_ipc.md)
- 03 — [Hotkey Action Button](./03_hotkey_action_button.md)
- 04 — [Home Screen Action Integration](./04_home_screen_action_integration.md)
- 05 — [Recording Footer And CTA Removal](./05_recording_footer_and_cta_removal.md)
- 06 — [Compact Window And Layout](./06_compact_window_and_layout.md), committed as `8c33a25`
- 07 — [Deterministic Browser Demo](./07_deterministic_browser_demo.md), committed under `authorization.commit-packet-07`

## Changed Files

- `src/renderer/DesktopApiProvider.tsx` — exposes the renderer-local
  `SelectOpenCoordinatorProvider` so the demo has no Electron API.
- `src/renderer/ProviderHotkeyDemo.tsx` and its entry/style — rebuild the demo
  from production home components with deterministic provider, lifecycle,
  lock, status, timer, and contextual-action fixtures at exactly 620 × 292.
- `src/renderer/components/RecordingControls.tsx` — accepts an optional
  renderer-local elapsed clock; production behavior is unchanged.
- `src/renderer/styles/hotkeyActionButton.css` — restores the approved inset
  bevel and graphite raised key appearance while preserving the layered
  pointer/keyboard press behavior and full shadow behind a pressed key.
- `webpack.config.js` — keeps the demo entry and HTML development-only and
  excludes them from production packaging.
- `tests/renderer/providerHotkeyDemo.test.ts`,
  `tests/renderer/hotkeyActionButton.test.ts`, and
  `tests/scripts/webpackConfig.test.ts` — cover fixture isolation, sizing,
  production-component reuse, visual-lock contracts, and packaging exclusion.

## Checks

- Focused Packet 07 suite — 21 passing tests:
  `rtk node --import tsx --test tests/renderer/providerHotkeyDemo.test.ts tests/renderer/hotkeyActionButton.test.ts tests/renderer/hotkeyActionButtonTransition.test.ts tests/renderer/contextualProviderActions.test.ts tests/renderer/recordingElapsedTime.test.ts tests/scripts/webpackConfig.test.ts`.
- `rtk npm run typecheck` and `rtk npm run test:types` — passed.
- `rtk npx eslint --max-warnings 0` on Packet 07 source and tests — passed.
- `rtk prettier --check` on changed demo, key-style, and test files — passed.
- `rtk git diff --check` — passed.
- `rtk npm run build:prod` — passed. The demo is absent from packaged assets;
  only existing webpack entrypoint-size warnings remain.
- Browser manual gates passed at device scale factor 1: idle layout bounds and
  document scroll bounds are exactly 620 × 292; all three keys are enabled;
  hover changes only the raised face; pointer, Enter, and Space lock safely;
  the Voice recording fixture keeps F9 pressed while its peers become Disabled
  and exposes Pause/F9, Stop/F10, and Cancel/Esc; no megabyte value appears.
  The final idle review page is open at
  `file:///home/dmitry-vasiliev/PycharmProjects/open-source/chatgpt-web-voice/dist/provider-hotkey-demo.html`.

## Exact Next Packet

The requested transfer of a demo visual treatment to production Hotkey buttons
requires a specification/plan revision: the current shared
`HotkeyActionButton` already renders both surfaces, while Packet 08 explicitly
excludes new design polish. After that revision is approved, execute its
dedicated packet before Packet 08.

## Blockers

- No Packet 07 blocker. Do not start Packet 08 or any visual-transfer work
  without an approved, dedicated packet.
