# 14 Migrate Preload And Renderer DI

## Outcome

Add separate functional preload and React composition roots and remove mutable
renderer service/coordinator singletons without crossing Electron boundaries.

## Prerequisites

- Tasks 08–13 are complete and main IPC contracts are stable.

## Owned Requirements

- Existing preload/renderer security and compatibility requirements plus
  `dependency-injection.process-boundaries`.

## In Scope

- Preload API construction.
- React desktop API context/provider/hooks.
- Renderer coordinator/cache instances currently created at module scope.

## Out Of Scope

- Renderer redesign, IPC changes, OOP UI containers, or Node exposure.

## Task Contract

1. Add pure `createElectronApi(ipcRenderer)` and expose exactly one returned API
   through `contextBridge`.
2. Add functional `DesktopApiProvider`/`useDesktopApi`; initialize it at each
   renderer entrypoint with `window.electronAPI`.
3. Replace direct global API consumption in components/hooks with the injected
   hook while preserving UI behavior.
4. Create mutable UI coordinators with `useMemo`/`useRef` inside providers;
   remove exported coordinator instances.
5. Keep React components/hooks/state updates functional. Do not introduce a
   class container or service locator in renderer.
6. Preserve `contextIsolation`, typed API declarations, channel names, routing,
   localization, accessibility, and window behavior.

## Contracts And Boundaries

- Renderer sees only the typed preload API.
- No main dependency object or Node/Electron object crosses the bridge.
- Shared modules remain pure.

## Expected Files Or Components

- `preload.ts`, renderer entrypoints/providers/hooks, affected components, and
  preload/renderer tests.

## Acceptance Criteria

- Preload API factory tests use fake IPC without Electron globals.
- Renderer tests inject fake APIs through providers and do not mutate
  `window.electronAPI`.
- No mutable renderer singleton remains.

## Verification

- Run preload/renderer/component/type tests, lint, format, full unit suite,
  production build, and `git diff --check`.

## Failure And Rollback

- Do not expose raw IPC or privileged objects as an injection shortcut.

## Manual Gates

- Packaged renderer smoke tests remain deferred.

## References

- Project conventions and Task 13 handoff.

## Completion And Handoff

- Mark only Task 14 complete and hand off to Task 15.
