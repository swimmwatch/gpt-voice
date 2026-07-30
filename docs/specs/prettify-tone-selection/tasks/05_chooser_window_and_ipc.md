# 05 Chooser Window And IPC

## Outcome

Implement the concrete single-instance chooser window and its exact trust
boundary. Main must place a native fixed BrowserWindow on the cursor display,
hold one operation-scoped payload, expose a separate capability-minimal chooser
preload, validate every chooser sender/action without granting generic app
trust, clear sensitive state on every terminal path, and integrate idempotently
with shutdown, locale changes, and App Settings navigation.

## Prerequisites

- Packets 01..04 are complete and approved.
- Read `AGENTS.md`, `todo.md`, `handoff.md`, and the **Electron And Providers**,
  **Dependency Injection And Runtime Ownership**, and **Desktop, Browser, And
  Packaging** convention sections.
- Inspect `WindowManager`, `AboutWindowController`,
  `ProviderSettingsWindowController`, `TrustedIpcRegistrar`, preload API/types,
  main composition/lifecycle, and their direct tests.
- Read the **Window Contract** in
  [`../design/chooser-design.md`](../design/chooser-design.md). The UI component
  and visual implementation remain packet 06.

## Owned Requirements

- PROF-006
- UI-001, UI-005
- ARCH-001, ARCH-002, ARCH-003
- PRIV-002
- FAIL-002, FAIL-003
- OPS-002
- QUAL-002 / AC-AUTO-008

## In Scope

- A process-owned chooser window/controller and injected Electron screen/window
  adapters.
- Active-display size/placement, single-instance focus, operation payload, and
  idempotent disposal.
- Exact chooser-only trusted sender validation, a chooser-specific IPC
  registrar, and typed minimal preload/main/renderer contracts.
- A separate Electron preload entry/output for the chooser; it must not expose
  the normal application `ElectronAPI`.
- Manage-profiles navigation to App Settings > Prettify.
- Main/window/IPC/preload/webpack declaration tests.

## Out Of Scope

- Chooser React layout/styles/entry/webpack asset (packet 06).
- Hotkey config/routing (packet 07).
- Settings management UI/import/export.
- Custom title bar, overlay Dialog over main, main-window resize, or a second
  close control.

## Task Contract

1. Add a stateful class such as `PrettifyProfileChooserWindowController`,
   constructed and disposed by the main composition root. It owns at most one
   BrowserWindow and one packet-04 operation. Do not add mutable module state.
2. Use a separate trusted renderer BrowserWindow, never a `Dialog` over the
   fixed 520×420 main window. Required native window values:
   - title `Choose a Prettify profile`;
   - native frame/title bar;
   - `show: false` until payload and renderer readiness are both confirmed;
   - fixed/resizable false at its calculated content size;
   - `backgroundColor: #181a1b`;
   - current sandboxed/context-isolated preferences and navigation guards, but
     with `preload` set to the dedicated chooser preload output
     `prettify-profile-chooser-preload.js`, never the general `preload.js`;
   - no custom title bar, duplicate close icon, Node integration, webview, or
     raw Electron exposure.
3. Inject a narrow screen adapter for cursor point, nearest display, and primary
   display. Resolve the display containing/nearest the cursor; if discovery
   fails or yields no valid work area, use primary display.
4. Placement is deterministic:
   - preferred content size 620×640;
   - use 16 px inset on all sides when preferred size fits;
   - otherwise use an 8 px inset and reduce width/height to the available work
     area;
   - renderer target at 440×520, but if the OS work area is smaller, use the
     available inset area rather than placing actions off-screen;
   - center the fixed calculated rectangle inside resolved work area;
   - account for content size consistently (`useContentSize`) and round
     coordinates to integers.
5. The packet 04 source and ordered summary payload must exist before window
   creation/show. Send/return only:
   - operation token opaque to renderer;
   - captured source;
   - localized ordered profile summaries with ID, name, description, kind,
     default marker;
   - valid session-only initial selected profile ID, if any.
     Do not send profile instructions, provider settings/secrets, filesystem
     paths, logs, cache context, or process data.
6. Define one narrow shared `PrettifyProfileChooserAPI` contract and
   chooser-namespaced channel constants. The chooser preload must be built from
   its own factory and entry (for example,
   `createPrettifyProfileChooserApi` and
   `prettifyProfileChooserPreload.ts`) into
   `dist/prettify-profile-chooser-preload.js`. It may expose under the
   repository-standard `window.electronAPI` key, but the runtime object and its
   renderer type for this entry contain only:
   - load current chooser payload;
   - renderer ready;
   - apply one profile ID;
   - cancel;
   - manage profiles;
   - the read-only localization minimum needed by this renderer:
     get current translations, get current locale, and subscribe/unsubscribe to
     chooser locale changes.
     Do not expose `setLocale`, supported-locale management, recording,
     Settings, history, diagnostics, provider, clipboard, filesystem, or any
     other general API method. All invoke/event channels, including the
     read-only localization channels, are chooser-namespaced and exhaustive,
     typed across main/preload/renderer, and absent from the general preload
     factory. Do not call the generic `get-translations`, `get-locale`, or
     `locale-changed` channels from this preload.
7. Add a dedicated chooser IPC registrar that registers only the channel set
   from item 6 directly against the low-level IPC transport. It must not call
   `TrustedIpcRegistrar.handle` or inherit generic app-window trust. Its sender
   validation matches the sender WebContents ID, sender-frame URL, current
   chooser window, and exact expected chooser URL. A trusted
   main/settings/history/provider/about renderer is not a trusted chooser
   sender. Reject stale, destroyed, wrong-URL, wrong-window, or missing-frame
   senders with one generic safe error.
8. Every action includes/matches the current operation token and is accepted at
   most once. Apply additionally validates the profile ID is in the immutable
   operation payload. Unknown IDs, duplicate submits, stale tokens, malformed
   payloads, or late events do no provider work.
9. Show/focus behavior:
   - create once for the operation;
   - when ready, show and focus the chooser;
   - reentry while open restores if minimized, shows, and focuses the same
     instance without replacing payload/source;
   - never create a second chooser or repeat selected-text capture.
10. Close paths resolve exactly once:
    - Apply: close immediately, clear renderer/main chooser payload, then allow
      packet 04 to generate;
    - Cancel/native close/Escape: cancel without provider work;
    - Manage profiles: cancel, clear, close, then call
      `WindowManager.showSettingsWindow('prettify')`;
    - app shutdown/dispose: cancel/abort through packet 04, clear payload, close
      idempotently.

11. **Never** add the chooser to `WindowManager.getAllWindows()` or make
    `WindowManager.isTrustedAppWindow()` return true for it. Consequently the
    existing generic `TrustedIpcRegistrar.handle`,
    `handleSettingsWindow`, and streaming handlers must reject the chooser on
    every non-chooser channel, including generic localization and all
    Settings-only channels. Add explicit negative tests using the live chooser
    WebContents identity. Keep exact chooser lookup on the chooser controller
    and registrar only.
12. Track lifecycle and locale separately from generic trust. The composition
    root/application lifecycle owns and disposes the chooser controller
    explicitly rather than discovering it through `WindowManager.getAllWindows`.
    Locale changes are forwarded only to the controller's exact current chooser
    WebContents through its chooser-namespaced locale event (or an equivalently
    narrow injected publisher). This lifecycle/locale path must not register the
    chooser as a generic trusted app or Settings window.
13. Route every terminal renderer/window event through one idempotent terminal
    method. Main-frame `did-fail-load`, `render-process-gone`, `unresponsive`,
    and `closed` are all terminal: before resolving, clear the payload, captured
    source, operation token, profile-ID allow-list, summaries, and remembered
    initial selection. Resolve packet 04 as cancel exactly once and ensure no
    provider work can begin. For the first three events, close the window if it
    still exists; the resulting `closed` event is a no-op. If Apply, Cancel,
    Manage, dispose, or native close already won, every late terminal callback
    is also a no-op.
14. No source/profile content appears in window/controller/IPC logs or errors.
    Allowed logs are lifecycle booleans, window state, safe action category,
    counts, and safe error categories.

## Contracts And Boundaries

- Main owns BrowserWindow, screen, payload, lifecycle, Settings navigation, and
  action validation.
- Preload exposes only narrow functions on `window.electronAPI`; renderer has
  no Node/Electron/raw IPC/provider/filesystem access.
- Chooser state is operation-scoped and is cleared on close, submit, cancel,
  Manage, main-frame load failure, crash, unresponsive renderer, or shutdown.
- The window controller does not resolve instructions or run providers; it
  returns a validated outcome to packet 04.
- Existing main/settings/history/provider/about window trust rules must not
  become broader. The chooser is deliberately outside generic
  `isTrustedAppWindow` authorization.

## Expected Files Or Components

- Add `src/main/prettifyProfileChooserWindowController.ts`.
- Add `src/main/prettifyProfileChooserIpcRegistrar.ts`.
- Add `src/main/prettifyProfileChooserPreloadApi.ts`.
- Add `src/main/prettifyProfileChooserPreload.ts`.
- Add `src/shared/prettifyProfileChooser.ts` for renderer-safe payload/results
  and channel names if packet 04 did not already establish it.
- Add a chooser-entry renderer declaration/type that exposes only
  `PrettifyProfileChooserAPI`; do not widen the normal `ElectronAPI`.
- Update `webpack.config.js` with the separate Electron-preload entry and exact
  `dist/prettify-profile-chooser-preload.js` output. Do not add the chooser
  renderer entry or HTML yet.
- Preserve `src/main/preloadApi.ts` and `src/main/preload.ts` as the general
  preload path; update them only if needed to prove chooser methods are absent.
- Update `src/main/ipc.ts` only for a narrow shared transport/type seam if the
  chooser registrar requires it. Do not register chooser channels through
  `TrustedIpcRegistrar`.
- Update main composition/runtime/lifecycle files.
- Add `tests/main/prettifyProfileChooserWindowController.test.ts`.
- Add `tests/main/prettifyProfileChooserIpc.test.ts`.
- Add `tests/main/prettifyProfileChooserPreloadApi.test.ts`.
- Extend `tests/main/windowManager.test.ts`, `tests/main/preloadApi.test.ts`,
  composition tests, and shutdown tests.
- Extend `tests/scripts/webpackConfig.test.ts` for the isolated chooser preload
  entry/output and absence of the general preload from chooser
  `webPreferences`.

Do not add the renderer entry or webpack HTML in this packet.

## Acceptance Criteria

- Placement tests cover cursor display, primary fallback, preferred 620×640,
  constrained 440×520, work areas smaller than target, centering, and insets.
- Exactly one hidden-until-ready chooser exists; reentry focuses it without
  payload replacement.
- Exact chooser sender validation rejects main, Settings, stale, destroyed,
  wrong-URL, wrong-token, malformed, duplicate, and unknown-profile events.
- The chooser preload exposes only chooser actions and read-only chooser locale
  methods; it cannot invoke any generic or Settings-only channel.
- Generic, Settings-only, and streaming registrations reject the live chooser
  sender, while the chooser registrar rejects every non-chooser sender.
- Apply/cancel/manage/native close/main-frame `did-fail-load`/
  `render-process-gone`/`unresponsive`/shutdown each resolve once and clear all
  source/profile/token state; cascaded or late events remain no-ops.
- Manage opens the existing Settings window at Prettify management.
- Main window size/layout, `WindowManager.getAllWindows()`,
  `isTrustedAppWindow`, and every other window trust contract remain unchanged.
- The production build emits both `dist/preload.js` and the separate
  `dist/prettify-profile-chooser-preload.js`.

## Verification

```text
rtk test node --import tsx --test tests/main/prettifyProfileChooserWindowController.test.ts
rtk test node --import tsx --test tests/main/prettifyProfileChooserIpc.test.ts
rtk test node --import tsx --test tests/main/prettifyProfileChooserPreloadApi.test.ts
rtk test node --import tsx --test tests/main/windowManager.test.ts
rtk test node --import tsx --test tests/main/preloadApi.test.ts
rtk test node --import tsx --test tests/main/mainProcessApplication.test.ts
rtk test node --import tsx --test tests/main/mainProcessCompositionRoot.test.ts
rtk test node --import tsx --test tests/scripts/webpackConfig.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run build:prod
```

Run all directly affected existing generic/Settings-only/streaming IPC contract
tests to prove the chooser cannot cross those boundaries. Run task-local
lint/format checks.

## Failure And Rollback

- If payload preparation fails, never show a half-loaded window; resolve a
  generic failure through packet 04.
- If renderer load fails, exits, or becomes unresponsive before or after ready,
  the common terminal path clears all operation state and cancels exactly once.
- Invalid/stale IPC is rejected without mutation/provider work.
- Rollback removes the controller, chooser registrar/channels, isolated preload
  entry/output, and their wiring; generic preload/window trust remains
  unchanged and no persisted user data was added by this packet.

## Manual Gates

- MANUAL GATE: multi-display/focus/platform chrome verification is deferred to
  packets 06/10 and requires an appropriate desktop environment.
- No private source text, credentials, commit, push, PR, packaging, or release
  action is authorized.

## References

Mandatory:

- [`../design/chooser-design.md`](../design/chooser-design.md), **Window
  Contract** only.
- Specification **Architecture And IPC**, **F12 Chooser Flow**, and **Failure
  And Recovery**.
- `src/main/window.ts`, `src/main/ipc.ts`, and
  `src/main/providerSettingsWindowController.ts` local precedents.

## Completion And Handoff

After verification:

1. Mark packet 05 complete in `todo.md`.
2. Update `handoff.md` with exact channels/trust/lifecycle/files/checks and
   packet 06 as next.
3. Present for review and stop. Do not commit or start packet 06.
