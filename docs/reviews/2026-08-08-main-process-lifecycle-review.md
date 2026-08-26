# Main-Process Application Lifecycle — Code Review

- **Date:** 2026-08-08
- **Branch:** `feat/local-whisper-provider`
- **Status:** **PARTIAL — interrupted mid-review; coverage limited to the files listed in Scope.** See "Unreviewed / to resume" for what is still outstanding.
- **Reviewer focus:** Security (sandbox posture, `BrowserWindow` trust boundary, desktop-file generation), Memory leaks (listener/timer/disposable balance across recreate + quit), Performance (startup critical path before first paint), Correctness (quit-while-initializing, single-instance, ordering)
- **Method:** Static reading of actual source. Startup ordering traced from the module top level of `main.ts` through `MainProcessApplication.bootstrap()` → `register()` → `onReady()` → `startRuntime()` → `onWillQuit()`. Every `new BrowserWindow` / `createBrowserWindow` call site grepped and its `webPreferences` inspected. Every `app.on(...)` registration grepped. Subscribe/unsubscribe and create/dispose pairs traced by hand. Findings marked **VERIFIED** (read directly in code) or **INFERRED** (reasoned from Electron semantics, not directly observable in this repo). No source file modified. No tests executed.
- **Companion:** Local Whisper subsystem internals are covered by [`2026-08-08-local-whisper-desktop-app-review.md`](2026-08-08-local-whisper-desktop-app-review.md) and are deliberately **not** re-reviewed here; only the *lifecycle placement* of Local Whisper construction inside `main.ts` is in scope.

---

## Scope

### Files actually read in full

- `src/main/main.ts` (566 LOC) — process entry, dependency literal, bootstrap tail
- `src/main/mainProcessApplication.ts` (352 LOC) — lifecycle owner: bootstrap/register/ready/quit
- `src/main/desktopRuntimeController.ts` (255 LOC) — pre-ready config, single-instance lock, Linux switches, permission handlers, benchmark mode
- `src/main/window.ts` (538 LOC) — every renderer window, `webPreferences`, navigation guards, dispose
- `src/main/tray.ts` (132 LOC) — tray create/dispose, context menu, interaction-lock subscription
- `src/main/shortcuts.ts` (499 LOC) — global hotkey registration, suspension, dispose
- `src/main/linuxDesktopIntegration.ts` (159 LOC) — `.desktop` generation, icon sync, `escapeDesktopExecArg`

### Greps run repo-wide over `src/main/**`

- all `new BrowserWindow` / `createBrowserWindow(` call sites
- all `app.on(` / `.app.on(` registrations
- all `trayController.` call sites

### Not read (see "Unreviewed / to resume")

`src/main/di/mainProcessCompositionRoot.ts`, `src/main/di/mainProcessRuntimeFactory.ts`, `src/main/config.ts`, `src/main/ipc.ts`, `src/main/appProtocol.ts`, `src/main/prettifyProfileChooserWindowController.ts`, `src/main/firstLaunchStartupCoordinator.ts`, `src/main/logger.ts`, `src/main/browser.ts`, `src/main/providerSettingsWindowController.ts`, `src/main/aboutWindowController.ts`.

All file references below are `file:line`.

---

## Summary Verdict

The lifecycle layer is **structurally sound and unusually disciplined** for an Electron main process: quit cleanup is idempotent and ordered, every window is created through one hardened `createWebPreferences()` factory, navigation is default-deny, and `dispose()` exists and is wired for every desktop resource. **No Critical finding.** The single most consequential issue is an **ordering defect**: because `bootstrapMainProcess()` awaits Local Whisper environment construction before it ever calls `requestSingleInstanceLock()` or registers `app` listeners, the whole single-instance / Linux-switch / first-paint chain has been pushed *behind* the `ready` event. That one root cause produces MAIN-1, MAIN-2 and MAIN-3 below.

### Findings Table

| ID | Finding | Area | Severity |
| --- | --- | --- | --- |
| MAIN-1 | Single-instance lock acquired after `ready` and after full Local Whisper construction | Correctness / resources | **High** |
| MAIN-2 | Linux Chromium switches (`no-sandbox`, `disable-gpu`, …) appended after `ready` — too late for the current process | Security / correctness | **High** |
| MAIN-3 | Main window creation blocked behind `await createProductionLocalWhisperEnvironment()` | Performance (first paint) | **High** |
| MAIN-4 | `escapeDesktopExecArg` does not neutralise newlines, `` ` `` or `$` — `.desktop` key injection | Security | **Medium** |
| MAIN-5 | `--no-sandbox` written unconditionally into both `Exec=` lines, persisting after uninstall/upgrade | Security | **Medium** |
| MAIN-6 | `TrayController.create()` overwrites its lock subscription if the tray was destroyed | Memory leak | **Low** |
| MAIN-7 | `setWindowOpenHandler` opens *any* `https:` URL externally with no allowlist | Security | **Low** |
| MAIN-8 | `will-navigate` only guards the main frame; no `will-frame-navigate` | Security | **Low** |
| MAIN-9 | Startup-benchmark poll loop has no stop condition on quit | Memory / correctness | **Low** |
| MAIN-10 | Synchronous package-manifest walk (`existsSync` + `readFileSync` ×2) on the startup path | Performance | **Low** |

---

## 1. Startup ordering (root cause of MAIN-1..3)

The process entry is, at `main.ts:560-566`:

```ts
configureDesktopApplicationBeforeReady(app);   // 560 — synchronous, correct
registerAppProtocolScheme(protocol);           // 561 — synchronous, correct
void bootstrapMainProcess().catch(...);        // 562 — ASYNC from here on
```

`bootstrapMainProcess()` immediately awaits (`main.ts:188` `await new LocalWhisperDevelopmentActivationLoader({...}).load()`), then on non-darwin platforms awaits again (`main.ts:262` / `main.ts:271` `await ...LocalWhisperEnvironmentFactory(...).create()` / `await createProductionLocalWhisperEnvironment(...)`), and only then constructs `MainProcessCompositionRoot` and calls `application.bootstrap()` at `main.ts:557`.

`MainProcessApplication.bootstrap()` (`mainProcessApplication.ts:121-128`) is therefore the *first* place the app requests the single-instance lock and registers `app` listeners — and it now runs one or more I/O turns after the main script returned. The code itself acknowledges this: `register()` ends with `if (app.isReady()) this.onReady();` (`mainProcessApplication.ts:140`), a compensation that is only needed because `ready` is expected to have already fired.

### MAIN-1 — Single-instance lock is acquired after `ready` and after the full Local Whisper environment is built _(High, Correctness / resources)_ **VERIFIED**

**Mechanism.** `DesktopRuntimeController.acquireSingleInstanceLock()` (`desktopRuntimeController.ts:84-97`) is reached only from `bootstrap()` (`mainProcessApplication.ts:126`). Everything in `bootstrapMainProcess()` from `main.ts:188` to `main.ts:271` — development-activation loading, catalog authentication, `NvidiaSmiVramAvailability` / `NvidiaSmiHostInventory` construction, and the full `createProductionLocalWhisperEnvironment(...)` — runs **in every instance**, including instances that are about to discover they are duplicates and `process.exit(0)` at `desktopRuntimeController.ts:90`.

**Failure scenario.** A user double-clicks the launcher (or a `%U` file association fires) twice in quick succession. Both processes build a Local Whisper production environment against the *same* `configurationRoot` (`main.ts:229`, the shared `appConfigPaths.appDirectory`). If that construction touches the model/catalog directory — creates lockfiles, materialises a runtime dir, or spawns a probe — the second instance races the first over shared state, then calls `process.exit(0)` (`desktopRuntimeController.ts:90`) which is an **immediate, non-cleanup exit**: no `will-quit`, no `runQuitCleanup()`, no chance to release anything it just created. Worst case the duplicate leaves a half-written or orphaned artifact behind that the surviving instance then reads.

**Suggested fix.** Move the lock to the top of the module, before any await:

```ts
configureDesktopApplicationBeforeReady(app);
registerAppProtocolScheme(protocol);
if (!isRemovingLinuxDesktopIntegration && !app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
void bootstrapMainProcess()...
```

and reduce `acquireSingleInstanceLock()` to an idempotent no-op when a `preLockAcquired: true` flag is passed, mirroring the existing `preReadyConfigurationComplete` pattern at `desktopRuntimeController.ts:71`.

### MAIN-2 — Linux Chromium switches, including `no-sandbox`, are appended after `ready` _(High, Security / correctness)_ **VERIFIED (call site) / INFERRED (Electron timing)**

**Mechanism.** `configureLinuxRuntime()` (`desktopRuntimeController.ts:241-254`) appends `class`, `disable-gpu`, `disable-dev-shm-usage`, `log-level` and — for packaged AppImages — `no-sandbox` (`desktopRuntimeController.ts:252`), plus sets `process.env.ELECTRON_DISABLE_SANDBOX = '1'` (`desktopRuntimeController.ts:251`). It is called only from `acquireSingleInstanceLock()` (`desktopRuntimeController.ts:94`), which per MAIN-1 now runs after `ready`.

Electron requires `app.commandLine.appendSwitch` to be called **before** the `ready` event; the sandbox decision in particular is made in `ContentMain` before the JS main script executes at all, so `ELECTRON_DISABLE_SANDBOX` set from JS cannot affect the already-launched browser process. The switches therefore land in one of two states, neither good:

1. **No-op for the browser process** — `disable-gpu` and `disable-dev-shm-usage` silently do nothing, which is the exact failure mode those flags exist to prevent (GPU crashes and `/dev/shm` exhaustion inside containers/AppImages). The code reads as if it is protecting against them; it is not.
2. **Late security downgrade for children** — switches appended to the Chromium command-line singleton *are* propagated to child processes spawned afterwards. If the browser process itself started sandboxed, appending `no-sandbox` at this point can hand *unsandboxed renderers* to a process that did not need them, which is strictly worse than either consistent state.

**Failure scenario.** On an AppImage build the developer believes GPU is disabled and the sandbox state is deliberate. In reality the effective sandbox state is decided entirely by the `--no-sandbox` baked into the `.desktop` `Exec=` line (`linuxDesktopIntegration.ts:74`, `:87`) — so a user who launches the AppImage from a terminal, from a file manager, or from a `.desktop` file written by an *older* version gets a *different* sandbox posture than a user who launches from the tray shortcut. Sandbox posture must not be launch-path-dependent.

**Suggested fix.** Call `configureLinuxRuntime()` synchronously at the module top level next to `configureDesktopApplicationBeforeReady(app)` (`main.ts:560`), independently of the lock. Then decide `no-sandbox` from one place: either detect unprivileged user-namespace availability at that point and append the switch only when the sandbox genuinely cannot start, or drop the JS path entirely and treat the `.desktop` line as the sole authority (see MAIN-5). Add a startup log line recording the *effective* sandbox state so the two paths cannot silently diverge.

### MAIN-3 — First paint is blocked behind Local Whisper environment construction _(High, Performance)_ **VERIFIED**

**Mechanism.** The main window is created in `startRuntime()` at `mainProcessApplication.ts:205` (`windowManager.createMainWindow()`), reachable only via `onReady()` → `register()` → `bootstrap()` → the awaits in `bootstrapMainProcess()`. On darwin the code sidesteps this by using `createDeferredLocalWhisperEnvironment(...)` (`main.ts:255-260`), which is synchronous in spirit; on **Linux and Windows** the non-deferred branch `await createProductionLocalWhisperEnvironment(localWhisperDependencies)` (`main.ts:271`) runs to completion first. Nothing about drawing a 520×420 window depends on Local Whisper being ready.

**Failure scenario.** Cold start on a Linux box with a large model catalog or a slow `nvidia-smi` probe: the user sees **no window at all** — not even the `#181a1b` background at `window.ts:207` — until the whole Local Whisper environment resolves. The `LOCAL_WHISPER_NVIDIA_SMI_TIMEOUT_MS = 2_000` budget at `main.ts:61` is per-invocation, and `availableVramBytes` / `readNvidiaInventory` (`main.ts:228`, `:241`) are both wired to `execFile`-based probes, so a hung driver can add seconds of pure blank-screen time. That the darwin path already uses a deferred environment shows the deferral is architecturally available.

**Suggested fix.** Use `createDeferredLocalWhisperEnvironment(...)` on **all** platforms for the initial graph and resolve the production environment lazily on first use (or on an idle callback after `did-finish-load`). Failing that, split `bootstrapMainProcess()` so that `application.bootstrap()` — and therefore window creation — happens before the Local Whisper await, and inject the environment through a promise the runtime already knows how to wait on.

---

## 2. Security

### MAIN-4 — `escapeDesktopExecArg` does not neutralise newlines, backticks or `$` _(Medium, Security)_ **VERIFIED**

`linuxDesktopIntegration.ts:157-159`:

```ts
export function escapeDesktopExecArg(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/%/g, '%%')}"`;
}
```

**Mechanism.** The value escaped is `this.dependencies.environment.APPIMAGE` (`linuxDesktopIntegration.ts:59`) — an arbitrary filesystem path from the environment — and the result is interpolated into `Exec=` at `linuxDesktopIntegration.ts:74` and `linuxDesktopIntegration.ts:87`, then written with `writeFileSync` at `linuxDesktopIntegration.ts:69`. Three gaps:

1. **Newline / carriage return are not escaped, and the Desktop Entry format is line-oriented.** A path containing `\n` terminates the `Exec=` line early and lets the remainder of the path become **arbitrary desktop-entry keys**. `\n` and `\r` are legal in Linux filenames.
2. **`` ` `` and `$` are not escaped**, although the Desktop Entry specification explicitly lists them (with `"` and `\`) as characters that must be backslash-escaped inside a quoted argument. GLib's `g_shell_parse_argv` does no expansion, but launchers that hand `Exec` to a shell will.
3. The `%` → `%%` handling (field codes) is **correct** and worth keeping.

**Failure scenario.** A user extracts a downloaded archive that creates a directory named `GPT-Voice\nExec=/bin/sh -c 'curl … | sh'` (or drops the AppImage there), runs the AppImage once, and `registerAppImage()` writes a `.desktop` file whose *second* `Exec=` key — or an injected `[Desktop Action]` block — now runs attacker-chosen commands **every subsequent time the user clicks the launcher**, long after the original archive is deleted. The persistence is the interesting part: the AppImage itself was only run once, but the launcher entry outlives it.

**Suggested fix.** Reject rather than escape. Before writing, validate the path:

```ts
if (/[\n\r]/.test(appImagePath)) { logger.warn('Refusing desktop integration for path containing newline'); return; }
```

and extend the escape chain with `.replace(/([`$])/g, '\\$1')`. Add unit cases for `\n`, `\r`, `` ` ``, `$`, and a path that is *only* `%`.

### MAIN-5 — `--no-sandbox` is written unconditionally into both `Exec=` lines _(Medium, Security)_ **VERIFIED**

**Mechanism.** `linuxDesktopIntegration.ts:74` and `linuxDesktopIntegration.ts:87` hard-code `--no-sandbox` into the generated launcher and into the "Remove launcher" desktop action. Unlike the runtime path (`desktopRuntimeController.ts:250`, gated on `app.isPackaged && environment.APPIMAGE`), the `.desktop` line has **no gate and no expiry**: it is written once and then defines the sandbox posture of every future launch from that shortcut.

The scoping is partially justified — AppImages cannot ship a setuid `chrome-sandbox` helper, and on kernels without unprivileged user namespaces Chromium will not start otherwise. But the blast radius is real: with the OS sandbox off, `webPreferences.sandbox: true` (`window.ts:500`) no longer buys OS-level renderer isolation, so a renderer compromise becomes full user-level code execution. The app's own mitigations (renderers load only `app:` content, `contextIsolation: true`, default-deny navigation) are what currently carry that weight.

**Failure scenario.** The `.desktop` file survives an app upgrade to a version that *can* sandbox (e.g. a `.deb`/Flatpak migration, or a kernel that gains `unprivileged_userns_clone`). Every launch from the existing shortcut still passes `--no-sandbox`, silently keeping the weakened posture indefinitely. `removeAppImage()` (`linuxDesktopIntegration.ts:98-109`) only runs on explicit user request, so nothing ever rewrites the stale line.

**Suggested fix.** Emit the flag conditionally: probe user-namespace support (`/proc/sys/kernel/unprivileged_userns_clone`, `/proc/sys/user/max_user_namespaces`) at `registerAppImage()` time and only append `--no-sandbox` when the probe says the sandbox cannot start. Independently, always **rewrite** the `.desktop` file on version change (the entry already carries `X-AppImage-Version`, `linuxDesktopIntegration.ts:80` — compare it and regenerate) so a stale flag cannot persist across upgrades. Add a comment at both sites recording *why* the flag is there.

### MAIN-6 — `setWindowOpenHandler` opens any `https:` URL externally _(Low, Security)_ **VERIFIED**

`window.ts:528-536` denies the popup (`action: 'deny'`, correct) but first calls `openExternal` for **any** URL whose protocol is `https:`, with no host allowlist. Since renderers only ever load `app:` content this is not reachable today; it becomes a one-click phishing/drive-by primitive the moment a renderer is compromised (MAIN-5 raises the value of that primitive). Suggested fix: allowlist the small set of hosts the app actually links to (`APP_WEBSITE` and provider docs), log-and-drop everything else. Note the sibling code at `desktopRuntimeController.ts:117` already only opens the fixed `APP_WEBSITE` constant, so an allowlist is consistent with existing practice.

### MAIN-7 — `will-navigate` guards the main frame only _(Low, Security)_ **VERIFIED (absence) / INFERRED (impact)**

`applyNavigationGuards` (`window.ts:512-537`) subscribes to `will-navigate`, which in current Electron fires for **main-frame** navigations. There is no `will-frame-navigate` handler, so a subframe navigation is not covered by the `app:` + `gpt-voice` host check at `window.ts:517`. `webviewTag: false` (`window.ts:501`) removes the `<webview>` vector, and iframes are presumably blocked by CSP, so this is defence-in-depth rather than a live hole. Suggested fix: add the same predicate on `will-frame-navigate`, extracting the URL check into one shared function so the two guards cannot drift.

### Permission handlers — noted, sound

`desktopRuntimeController.ts:198-204` installs both `setPermissionRequestHandler` and `setPermissionCheckHandler` on the default session and allows exactly `'media'`, denying everything else including `geolocation`, `notifications` and `midi`. Installing **both** handlers (rather than only the request handler, the common mistake) is correct.

---

## 3. Memory / lifecycle

### MAIN-8 — `TrayController.create()` overwrites its interaction-lock subscription when the tray was destroyed _(Low, Memory leak)_ **VERIFIED**

`tray.ts:31-42`. The re-entrancy guard is `if (this.tray && !this.tray.isDestroyed()) return;` — so when `this.tray` exists but **is** destroyed, the method proceeds and assigns `this.mainInteractionLockUnsubscribe = ...subscribe(...)` at `tray.ts:37` **without first invoking the previous unsubscribe**. The stale closure stays registered on `mainInteractionLock` forever and its `updateContextMenu()` will run against the destroyed tray (harmlessly, thanks to the `isDestroyed()` guard at `tray.ts:96`) on every lock transition.

**Current reachability is nil** — `create()` has exactly one call site (`mainProcessApplication.ts:217`, once per process) and `dispose()` (`tray.ts:50-56`) correctly nulls both fields. This is a latent trap for whoever adds tray recreation (e.g. on locale change: note that `updateContextMenu()` is re-run *only* on lock changes, so translated tray labels at `tray.ts:101-122` do not currently follow a runtime locale switch — a separate small gap worth confirming).

**Suggested fix.** Make the first line of `create()` unconditional cleanup: `this.mainInteractionLockUnsubscribe?.(); this.mainInteractionLockUnsubscribe = null;` before the guard, or simply call `this.dispose()` when `this.tray?.isDestroyed()`.

### MAIN-9 — Startup-benchmark poll loop never stops on quit _(Low, Memory / correctness)_ **VERIFIED**

`desktopRuntimeController.ts:211-239`. `checkWindowStartupState` re-arms itself through `dependencies.schedule(...)` every 25 ms (`STARTUP_BENCHMARK_POLL_INTERVAL_MS`, `desktopRuntimeController.ts:8`) and the **only** exits are `mainWindow.isDestroyed()` (`:216`) and the success path (`:224-228`). The scheduled handle is discarded (`schedule` returns `unknown` and the result is ignored), so there is no way to cancel it, and the `try/catch` at `:229-231` swallows every failure and re-arms. If the renderer never mounts `#window-startup-content`, the loop runs `executeJavaScript` forever.

**Failure scenario.** A benchmark run against a renderer that fails to boot never emits `GPT_VOICE_STARTUP_READY` and never terminates — CI hangs until the outer job timeout instead of failing fast. Benchmark-mode only, hence Low.

**Suggested fix.** Add a deadline (e.g. 30 s) after which the loop writes a failure marker and calls `app.quit()`, and retain the `schedule` handle so `dispose()`/`will-quit` can cancel it.

### MAIN-10 — Synchronous package-manifest walk on the startup path _(Low, Performance)_ **VERIFIED**

`main.ts:89-114` `getInstalledPackageVersion` performs, per package, up to `MAX_PACKAGE_DIRECTORY_ASCENTS = 6` (`main.ts:60`) iterations of `fs.existsSync` + `fs.readFileSync` + `JSON.parse`, and is called **twice eagerly** while building the dependency literal (`main.ts:301` for `cloakbrowser`, `main.ts:304` for `playwright-core`). Both values feed only `diagnosticsArchive.runtimeVersions` — data needed when a diagnostics archive is written, never at startup. Combined with `os.cpus()` (`main.ts:233`, `:258`, `:266`) this is avoidable synchronous I/O ahead of MAIN-3's already-serialised window creation. Suggested fix: make `runtimeVersions` lazy (`() => getInstalledPackageVersion(...)` memoised), so the walk happens on first diagnostics export.

---

## 4. Correctness — quit and second instance

### Quit-while-initializing — handled, with one gap

`startRuntime()` checks `if (this.quitCleanupPromise)` at `mainProcessApplication.ts:199` *before* `registerIpc()` and `createMainWindow()`, so a quit that arrives during the `pruneDiagnostics()` await correctly skips window/IPC/tray/shortcut setup. That is a deliberate and correct race guard.

**Gap (INFERRED, Low).** The check happens once. Between `mainProcessApplication.ts:204` and `:218` there are no further awaits, so the window is created synchronously after the check — safe. But `void this.dependencies.firstLaunchStartupCoordinator.start()` at `:216` is fire-and-forget with no completion tracking; `runQuitCleanup()` calls `firstLaunchStartupCoordinator.dispose()` at `:253` without awaiting anything the in-flight `start()` might still be doing. Whether that is safe depends on the coordinator's own dispose semantics — **unverified**, `firstLaunchStartupCoordinator.ts` was not read. Flagged for the resumed pass.

### Second instance — correct but narrow

`onSecondInstance` (`mainProcessApplication.ts:143-147`) calls `windowManager.showMainWindow()` when ready. `showMainWindow()` (`window.ts:242-249`) recreates the window if it was destroyed, so tray-hidden and window-closed states both recover. Two notes: the handler ignores the second instance's `argv`/`workingDirectory` (fine today — the `.desktop` `%U` at `linuxDesktopIntegration.ts:74` implies file arguments *may* be passed, and they would be silently dropped), and when `!app.isReady()` the call is silently dropped with no deferral, which is now reachable given MAIN-1's late lock acquisition.

### `process.exit(0)` on duplicate launch

`desktopRuntimeController.ts:89-90` calls `app.quit()` then `this.dependencies.exit(0)` (wired to `process.exit` at `main.ts:517`). `process.exit` on the same tick makes `app.quit()` a no-op and skips all buffered stdio flushing. Acceptable for a duplicate that owns nothing — but only because of that precondition, which MAIN-1 erodes.

---

## 5. Verified Sound

Things I specifically went looking for and confirmed are **not** problems:

**Window trust boundary (VERIFIED).** Exactly two `createBrowserWindow` call paths exist repo-wide (`main.ts:549` factory; `prettifyProfileChooserWindowController.ts:237` consumer) and every window in `window.ts` — main (`:212`), settings (`:274`), history (`:327`), provider settings (`:379`), about (`:486`) — routes through the **single** `createWebPreferences()` factory at `window.ts:495-504`: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webviewTag: false`, `navigateOnDragDrop: false`. No window overrides them, no `nodeIntegrationInWorker`, no `enableRemoteModule`, no `webSecurity: false` anywhere. This is the correct hardened baseline and the no-exceptions factory pattern is the right way to enforce it.

**Navigation default-deny (VERIFIED).** `applyNavigationGuards` is applied to every window at `window.ts:229, 285, 332, 383, 490` — no window is missed. The `will-navigate` predicate (`window.ts:513-526`) is allowlist-shaped (`protocol === 'app:' && host === 'gpt-voice'`) with the `catch` defaulting to `allowed = false` (`window.ts:519`), which is the correct failure direction. `setWindowOpenHandler` always returns `{ action: 'deny' }`.

**Sender-identity checks (VERIFIED).** `isTrustedAppWindow` (`window.ts:146`), `getTrustedSettingsWindow` (`window.ts:152`), `isTrustedMainFrame` (`window.ts:165`) and `isTrustedLocalWhisperSettingsFrame` (`window.ts:178`) all compare `webContents.id` **and** the live URL, and the frame variants additionally require `webContents.mainFrame === frame` and `webContents.getURL() === frame.url`. Comparing id-plus-URL rather than id alone closes the post-navigation confusion window.

**Quit cleanup ordering and idempotence (VERIFIED).** `onWillQuit` (`mainProcessApplication.ts:234-246`) is the model implementation: `preventDefault()`, a memoised `quitCleanupPromise ??=`, a `.finally()` that flips `quitCleanupComplete` and re-calls `app.quit()`, and an early return on the second pass so the re-entrant quit proceeds. `runQuitCleanup()` (`:249-333`) wraps **every** step in its own `try/catch` so one failing disposal cannot strand the rest, and the order is dependency-correct: shortcuts → selected-text → chooser window → IPC → prettify → translation → browser → Local Whisper → diagnostics archive → diagnostics storage → database close → desktop resources. Tearing down IPC before the services it fronts, and closing the database last, are both right.

**Window `close` vs `closed` semantics (VERIFIED).** `window.ts:234-239` hides rather than closes the main window unless `quitting`, and `dispose()` (`window.ts:420-434`) sets `this.quitting = true` and `settingsCloseConfirmed = true` **before** iterating, so the guarded `close` handlers do not veto teardown. The `if (this.mainWindow === window)` identity checks in the `closed` handlers (`:232`, `:296`, `:335`) correctly prevent a late `closed` event from a stale window nulling a freshly recreated one.

**Interaction-lock lease accounting (VERIFIED).** Every `mainInteractionLock.acquire()` has a matching release on **all** paths: settings window releases on constructor throw (`window.ts:278`) and on `closed` (`window.ts:298`); provider settings releases on throw (`window.ts:411`), on `!shown.created` (`window.ts:404`) and via `onClosed` (`window.ts:399`). `interactionLockedWindowIds` is cleared in `dispose()` (`window.ts:431`). Lease-leak-on-throw is the usual bug here and it is explicitly handled.

**Subscribe/unsubscribe balance (VERIFIED).** `WindowManager` (`window.ts:79` subscribe → `:423` unsubscribe in `dispose`), `ShortcutController` (`shortcuts.ts:98` → `:278`), `TrayController` (`tray.ts:37` → `:51`), and `MainProcessApplication.startupSnapshotUnsubscribe` (`:213` with `??=` → `:251-252`) all pair correctly. The `??=` on the startup snapshot subscription is a deliberate double-subscribe guard.

**Global shortcut hygiene (VERIFIED).** `ShortcutController.register()` calls `globalShortcut.unregisterAll()` first (`shortcuts.ts:161`) so repeated registration cannot stack duplicate handlers, `dispose()` sets `disposed` and unregisters all (`shortcuts.ts:275-282`), and every mutator (`setSuspension` `:136`, `register` `:159`, `syncRetryTranscriptionShortcut` `:373`) short-circuits on `disposed`. Hotkey **callbacks** touch only main-process state and optional-chain the window (`window?.webContents.send(...)` at `:182`, `:186`, `:190`, `:228`), so a hotkey pressed while the window is destroyed is a no-op rather than a throw — and none of them forward untrusted renderer-supplied data into privileged calls. Conflicting accelerators are resolved up-front via `getConflictingHotkeyTargets` (`shortcuts.ts:163`) rather than relying on `register()` returning `false`.

**Listener registration is once-only (VERIFIED by grep).** All six `app.on(...)` registrations live in one place (`mainProcessApplication.ts:134-139`) behind the `registered` flag (`:131-132`), and `onReady` is separately guarded by `readyHandled` (`:150-151`) so the `app.on('ready')` path and the `if (app.isReady())` fallback (`:140`) cannot both fire. No `app`, `ipcMain` or `webContents` listener is added per window-recreate anywhere in the reviewed files — the classic Electron leak is absent.

**Icon-refresh child process (VERIFIED).** `refreshIconCache` (`linuxDesktopIntegration.ts:136-154`) uses `spawn` with `stdio: 'ignore'`, attaches `once` handlers for `error` and `close`, treats `ENOENT` as expected, and calls `unref()` so a missing `gtk-update-icon-cache` cannot hold the process open.

---

## 6. Unreviewed / to resume

The following were in the assigned scope but **not** examined. A resumed pass should start here:

1. **`src/main/di/mainProcessCompositionRoot.ts` (861 LOC) — highest priority.** Construction/disposal ordering, whether every constructed disposable is reachable from `runQuitCleanup()`, and whether the `MainProcessOwnedRuntime` narrow interface (`mainProcessApplication.ts:64-72`) omits any disposable the root creates. Specifically: does anything constructed in the root register a timer, a subscription, or an `ipcMain` handler that has no counterpart in the seven `dispose`/`shutdown` methods that interface exposes?
2. **`src/main/di/mainProcessRuntimeFactory.ts` (228 LOC)** — what `create()` builds, and whether a second `create()` (unreachable today, but `this.runtime` is reassigned at `mainProcessApplication.ts:188` without disposing a previous value) would leak.
3. **`src/main/config.ts` (633 LOC)** — config load/save races were an explicit review axis and are entirely unexamined. `config.load()` is called at `mainProcessApplication.ts:171` and `getSnapshot()` is read from hotkey callbacks (`shortcuts.ts:160`, `:236`, `:300`) and elsewhere; check for read-modify-write races between IPC-driven saves and the atomic-write helper wired at `main.ts:350-354`.
4. **`src/main/ipc.ts` (1383 LOC)** — `ipcMain.handle` registration/removal balance; `disposeIpc()` is called at `mainProcessApplication.ts:273` but its coverage is unverified. Note the composition root is given only `handle`/`removeHandler` (`main.ts:378-379`) — confirm no `ipcMain.on` is used anywhere without removal.
5. **`src/main/prettifyProfileChooserWindowController.ts`** — the second `createBrowserWindow` call site (`:237`); confirm it uses the same hardened `webPreferences` and applies navigation guards (it uses a *different* preload, `main.ts:534`).
6. **`src/main/appProtocol.ts`** — the `app:` scheme handler is the entire basis for the navigation allowlist; path-traversal safety of its `readFile` (`main.ts:508`) is load-bearing and unchecked.
7. **`src/main/firstLaunchStartupCoordinator.ts`** — see the gap noted in §4: `start()` is fire-and-forget and `dispose()` is not awaited.
8. **`src/main/logger.ts`** — `logger.initialize()` and `errorHandler.startCatching()` run at `mainProcessApplication.ts:153-154`; check for synchronous fs work on the startup path and for crash-handler behaviour during quit.
9. **Crash handling generally** — `render-process-gone`, `child-process-gone` and `unresponsive` handlers were **not found** in the reviewed files. Confirm whether they exist elsewhere; if not, a renderer crash currently leaves the app with a dead window and no recovery path, which pairs badly with MAIN-5.
10. **`main.ts:562-566` unhandled-rejection path** — `bootstrapMainProcess().catch` rethrows inside `setImmediate`, turning a bootstrap failure into an uncaught exception. Whether `logger.errorHandler.startCatching()` is installed by then depends on MAIN-1's timing; worth confirming the crash is actually reported rather than silently killing the process.

---

## 7. Recommended Order

1. **MAIN-1 / MAIN-2 / MAIN-3** — one refactor of `main.ts:560-566` fixes all three: acquire the lock and apply Linux switches synchronously at module scope, and defer Local Whisper construction off the first-paint path.
2. **MAIN-4** — reject newline-bearing paths in `registerAppImage()`; extend the escape set. Small, self-contained, add unit tests.
3. **MAIN-5** — gate `--no-sandbox` in the `.desktop` file and regenerate the entry on version change.
4. **MAIN-6 / MAIN-7** — allowlist external `https:` opens; add `will-frame-navigate`.
5. **MAIN-8 / MAIN-9 / MAIN-10** — latent-trap and benchmark-only cleanups.
6. **Resume the review** at §6 item 1 (`mainProcessCompositionRoot.ts`), which carries the highest residual risk of the unreviewed set.
