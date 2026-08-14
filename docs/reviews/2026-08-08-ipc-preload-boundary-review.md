# Renderer↔Main IPC & Preload Trust Boundary — Code Review

- **Date:** 2026-08-08
- **Branch:** `feat/local-whisper-provider`
- **Reviewer focus:** Security (input validation, sender trust, path/URL/child-process reachability, secret echo), Performance (main-thread blocking in handlers), Memory (per-window listeners, unbounded maps, closure capture), Correctness (handler races, double registration)
- **Method:** Static reading of the actual source. `src/main/ipc.ts` read in full; both preload entry points and both preload API builders read in full; `window.ts` read in full for the trust predicates and window hardening; riskiest downstream call sites sampled rather than read exhaustively. Findings marked **VERIFIED** (read in code) or **INFERRED** (reasoned, not directly observed). No source file was modified. No tests were executed.
- **Status:** **PARTIAL — interrupted mid-review; coverage limited to the files listed in Scope.** See §5 for what remains.
- **Excluded by design:** Local Whisper IPC, already covered by [`2026-08-08-local-whisper-desktop-app-review.md`](2026-08-08-local-whisper-desktop-app-review.md) (findings F1–F6). Prettify child-process internals, already covered by [`provider-review-2026-08-08-prettify-providers.md`](provider-review-2026-08-08-prettify-providers.md).

---

## Verdict

**No critical or high-severity defect found in the reviewed surface.** The boundary is deliberately built, not accidental: every privileged channel goes through a single `TrustedIpcRegistrar` that re-checks sender identity on every invoke, the preload exposes a closed literal of functions with no channel-name passthrough, no renderer-supplied string reaches `fs` path construction, `shell.openExternal` is unreachable from any IPC handler, and the window hardening trio (`contextIsolation` / `nodeIntegration:false` / `sandbox:true`) is applied uniformly.

The findings below are **one Medium cluster and several Low items**. The Medium cluster is a single theme: the boundary validates *identity* rigorously but validates *payloads* unevenly — a number of handlers rely on TypeScript parameter types (erased at runtime) where their neighbours use real runtime guards.

### Findings Table

| ID | Finding | Axis | Severity |
| --- | --- | --- | --- |
| IPC-1 | `assertTrustedSender` falls back to `event.sender.getURL()`, making the URL binding self-comparing; no main-frame check | Security | Medium |
| IPC-2 | `show-notification` forwards renderer-controlled `title`/`body`/`options` to the OS with no type check or length bound | Security | Medium |
| IPC-3 | Handlers typed-but-unvalidated: `transcribe-audio`, `translate-text`, `get-provider-settings`, `clear-provider-auth`, `check-prettify-cli-connection` | Security | Medium |
| IPC-4 | `handleStreaming` channels are not tracked in the registrar's channel set, so `dispose()` cannot remove them | Correctness / Memory | Low–Medium |
| IPC-5 | Prettify model lifecycle handlers are not serialized against the `set-prettify-settings` mutation queue | Correctness | Low |
| IPC-6 | `check-session` / `get-provider-settings` construct a provider and open an audit operation on every renderer poll | Performance | Low |
| IPC-7 | `transcribe-audio` / `translate-text` gate on `mainInteractionLock.locked` only, not the shared `isMainInteractionActionBlocked` predicate | Correctness | Low |

---

## 1. Scope — files actually read

**Read in full**

- `src/main/ipc.ts` (1383 LOC) — the whole privileged handler surface plus `TrustedIpcRegistrar`
- `src/main/preload.ts`
- `src/main/preloadApi.ts` (528 LOC) — the main `electronAPI` bridge
- `src/main/prettifyProfileChooserPreload.ts`
- `src/main/prettifyProfileChooserPreloadApi.ts`
- `src/main/prettifyProfileChooserIpcRegistrar.ts`
- `src/main/window.ts` (538 LOC) — `isTrustedAppWindow`, `getTrustedSettingsWindow`, `isTrustedMainFrame`, `createWebPreferences`, `applyNavigationGuards`
- `src/main/services/transcriptionHistoryIpcController.ts`
- `src/main/providers/voiceProviderRegistry.ts`

**Read partially / sampled**

- `src/main/services/diagnosticsExport.ts` (first 120 lines — dialog + single-flight logic)
- `src/main/services/prettifyProfilePortability.ts` (path-handling call sites only)
- `src/main/repositories/transcriptionHistoryRepository.ts` (query clamping only)
- `src/shared/notifications.ts` (option shape only)

**Verified by targeted grep across `src/`**

`contextBridge` entry points; `openExternal` / `setWindowOpenHandler` / `will-navigate` / `webviewTag`; `contextIsolation` / `nodeIntegration` / `sandbox` / `preload`; `clipboard`; synchronous `fs` in `src/main`; `Object.assign`; `ipcMain.handle` wiring; `path.join` under `src/main/providers`.

All file references below are `file:line`.

---

## 2. Findings

### IPC-1 — Trusted-sender URL check degrades to a self-comparison _(Medium, Security)_ — VERIFIED

`src/main/ipc.ts:293-299`

```ts
private assertTrustedSender(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url || event.sender.getURL();
  if (this.windowManager.isTrustedAppWindow(event.sender, senderUrl)) return;
  ...
}
```

`isTrustedAppWindow` (`window.ts:146-150`) accepts when `window.webContents.id === webContents.id && senderUrl === window.webContents.getURL()`. When `event.senderFrame` is `null` — Electron returns null for a frame that has already been disposed, and for some cross-process transitions — the fallback substitutes `event.sender.getURL()`, which is *the very value the check then compares against*. The URL half of the predicate becomes tautological and the check collapses to "this webContents id belongs to one of our windows".

Two consequences:

1. **No main-frame binding.** Unlike the Local Whisper authority, which requires `event.senderFrame === event.sender.mainFrame` (see prior review §4), this predicate accepts *any* frame of a trusted window whose URL happens to equal the top-level URL. The sibling `handleSettingsWindow` (`ipc.ts:255-272`) is stricter and correctly rejects outright when `senderUrl` is falsy — the two paths disagree about the same hazard.
2. **A race window.** A message queued by a frame that is destroyed before the handler runs is evaluated under the degraded rule rather than being rejected.

**Concrete failure scenario:** an attacker who achieves script execution in a renderer (the CSP is strong, so this presupposes a chained bug) creates a same-origin iframe. Under the strict rule the iframe's IPC would be rejected because `senderFrame.url` is the iframe URL; under the fallback, or if the frame is torn down at the right moment, it is accepted. Exploitability today is limited because preload scripts do not run in subframes when `nodeIntegrationInSubFrames` is false (default) and `sandbox: true`, so a subframe has no `ipcRenderer` handle — hence Medium, not High. **INFERRED** for the exploit path; **VERIFIED** for the degraded predicate.

**Fix:** reject when `event.senderFrame` is absent (mirror `handleSettingsWindow`), and add `event.senderFrame === event.sender.mainFrame`. Delete the `|| event.sender.getURL()` fallback — it can only ever weaken the check.

### IPC-2 — `show-notification` forwards renderer-controlled strings to the OS unvalidated _(Medium, Security)_ — VERIFIED

`src/main/ipc.ts:1176-1181`

```ts
this.trustedIpc.handle('show-notification', (_event, title: string, body: string, options?: SystemNotificationOptions) => {
  dependencies.notification.show(title, body, options);
});
```

The parameter types are compile-time only. The renderer controls all three values across the structured-clone boundary, and there is no `typeof` check, no length bound, and no validation of `options.sound` against its two-member union (`@shared/notifications.ts`, `SystemNotificationSound = 'success' | 'error'`). The shared module even defines `NOTIFICATION_BODY_MAX_CHARS = 120`, which this path does not apply.

**Concrete failure scenario:** a compromised renderer emits OS-level desktop notifications carrying arbitrary attacker text under the application's own name and icon — a credible phishing surface precisely because the notification is genuinely from the trusted app ("GPT-Voice: your session expired, sign in at …"). Separately, a non-string `title` (object, symbol-free clone) reaches Electron's `Notification` constructor at `electronRuntime.ts:96`, and an unbounded string is a cheap main-process memory/render-stall lever.

**Fix:** assert `typeof title === 'string' && typeof body === 'string'`, clamp both to the existing `NOTIFICATION_BODY_MAX_CHARS`-style bounds, and accept `options.sound` only if it is one of the two enum members; drop the argument otherwise.

### IPC-3 — Typed-but-unvalidated handler parameters _(Medium, Security)_ — VERIFIED (as a class)

TypeScript annotations on IPC listener parameters are erased; the renderer decides the runtime shape. The file is *mostly* careful about this — `provider-login` (`ipc.ts:459`), `open-provider-settings` (`587`), `set-active-provider`, `set-hotkey` (`880-894`), `set-locale` (`1197`), `set-recording-lifecycle-state` (`441`), `open-app-settings` (`617`) and the whole Prettify family all use real runtime guards. The exceptions stand out:

| Channel | Line | Declared type | Runtime check |
| --- | --- | --- | --- |
| `transcribe-audio` | `ipc.ts:391` | `buffer: ArrayBuffer, mimeType: string` | none |
| `translate-text` | `ipc.ts:398` | `text: string, targetLang: string` | none |
| `get-provider-settings` | `ipc.ts:582` | `providerId: string` | none at the handler |
| `clear-provider-auth` | `ipc.ts:819` | `providerId: string` | `isKnownProviderId` — but only *after* `voiceAudit.startOperation(providerId, …)` at `820` |
| `copy-transcription-history-text` | `ipc.ts:423` | `id: number` | none at the handler |
| `get-transcription-history` | `ipc.ts:419` | `query: TranscriptionHistoryQuery` | none at the handler |
| `check-prettify-cli-connection` | `ipc.ts:1033-1034` | `providerId: unknown` | the **rejecting** branch forwards the raw value to `prettifyRuntime.checkCliConnection(providerId)` |

Several are neutralized downstream and are noted as sound in §3 (`copyText` coerces with `Number()`; the history repository clamps `limit`/`offset`; `getProviderSettingsSnapshot` funnels into `createProvider`, which throws for unknown ids). The residual concerns:

- **`transcribe-audio` / `translate-text`** are the two highest-volume, highest-payload channels and carry *zero* validation and *no size bound*. An unbounded `text` or `buffer` is a direct main-process memory lever from the renderer, and `mimeType` / `targetLang` flow into the transcription and translation services whose own handling I did not trace (**INFERRED** — the reach beyond the handler is unverified; this is a gap, see §5).
- **`clear-provider-auth`** opens an audit operation keyed on an unvalidated value before validating it. If any audit layer retains per-provider state in a map, that is a renderer-keyed unbounded map. **INFERRED** — I did not read `voiceProviderAudit`/`BaseProviderAudit`.
- **`check-prettify-cli-connection`**'s "unsupported" branch is inverted relative to its siblings: `list/load/unload-prettify-model` call the runtime with a hardcoded `{}` and overwrite the error, whereas this one hands the runtime the attacker-chosen value.

**Fix:** add runtime guards at the handler for the six channels above; bound `text` and `buffer` lengths explicitly; move `startOperation` after the `isKnownProviderId` check in `clear-provider-auth`; make `check-prettify-cli-connection` return a synthetic rejection instead of forwarding.

### IPC-4 — Streaming channels escape the registrar's disposal set _(Low–Medium, Correctness / Memory)_ — VERIFIED

`src/main/ipc.ts:274-291`

```ts
public handleStreaming(channel: string, listener: …): void {
  if (this.disposed) throw new Error('Main IPC registrar is disposed');
  this.ipc.handle(channel, (event, ...args) => { … });
  // note: no this.channels.add(channel)
}
```

`handle()` records `this.channels.add(channel)` at `252`; `handleStreaming()` does not. `dispose()` (`286-291`) therefore removes every ordinary channel but **no streaming channel**. Removal depends entirely on `StreamingTranscriptionIpcController.dispose()` calling back through `removeStreamingHandler`.

Aggravating the coupling, `MainIpcController.dispose()` (`1219-1228`) disposes `trustedIpc` **first** (`1223`) and the streaming controller **second** (`1225`). The ordering happens to work because `removeStreamingHandler` (`282-284`) has no `disposed` guard — but that is an accident of omission, and adding the guard that `handle`/`handleStreaming` both have would silently break teardown.

**Concrete failure scenario:** `ipcMain.handle` throws `Attempted to register a second handler for '<channel>'` (transport wired at `main.ts:378`). Any path where the streaming controller's disposal is skipped or partial — an exception mid-dispose, a future refactor that nulls the controller before dispose, a test harness re-registering a controller — leaves a live handler bound to a dead closure (retaining the whole dependency graph) and makes the next `register()` throw.

**Fix:** `this.channels.add(channel)` in `handleStreaming` too, making the registrar's disposal set authoritative; keep the controller's own removal as an optimization.

### IPC-5 — Prettify model lifecycle is not serialized against settings mutation _(Low, Correctness)_ — VERIFIED

`set-prettify-settings` is correctly funnelled through a promise chain (`ipc.ts:1040`, `enqueuePrettifySettingsMutation` at `1309-1316`) precisely because a provider switch calls `releaseProviderResources(previous.providerId)` (`1055`) before saving. But `list-prettify-models` (`1089`), `load-prettify-model` (`1120`), `unload-prettify-model` (`1148`) and `check-prettify-cli-connection` (`1030`) bypass that queue entirely.

**Concrete failure scenario:** the user switches provider (vLLM → Ollama) while a `load-prettify-model` is in flight for vLLM. The mutation awaits `releaseProviderResources('vllm')`; the concurrent load re-acquires the GPU model immediately afterwards. The settings now say Ollama while vLLM holds VRAM, and the `vllm-gpu-release-failed` warning path (`1070-1080`) never fires because the release itself succeeded. **VERIFIED** for the missing serialization; **INFERRED** for the VRAM outcome.

**Fix:** route the three model-lifecycle handlers through `enqueuePrettifySettingsMutation` (or a shared provider-lifecycle queue).

### IPC-6 — Per-poll provider construction and audit records on read-only handlers _(Low, Performance)_ — VERIFIED code / INFERRED cost

`check-session` (`ipc.ts:538-566`) and `get-provider-settings` → `getProviderSettingsSnapshot` (`582-584`, `1318-1374`) each: construct a fresh provider through `VoiceProviderRegistry.createProvider` — which itself opens a second audit operation (`voiceProviderRegistry.ts:31-63`) — then open a `settings-readiness` audit operation, call `provider.hasSession()`, and emit two-to-four lifecycle records. These are renderer-callable read paths that UI code polls.

`hasSession()` implementations exist in `BaseVoiceProvider.ts:62`, `ChatGPTVoiceProvider.ts:159`, `ClaudeWebVoiceProvider.ts:367`, `OpenAIApiVoiceProvider.ts:55`. I did **not** read their bodies, so whether they perform synchronous `fs` existence checks on the main thread is **INFERRED** — but that is the conventional implementation for a session-file check, and `existsSync` is used liberally elsewhere in `src/main` (`config.ts:407`, `cloakBrowserSettings.ts:182`, `prettifySettingsStorage.ts:178`).

**Fix:** cache the provider instance per id, and short-TTL the readiness snapshot; if `hasSession()` does hit the filesystem, make it async or memoize the stat.

### IPC-7 — Two handlers use a weaker interaction-lock gate than their peers _(Low, Correctness)_ — VERIFIED

`transcribe-audio` (`ipc.ts:392`) and `translate-text` (`399`) check only `dependencies.mainInteractionLock.locked`. Every other guarded handler uses `isMainInteractionActionBlocked(event)` (`1230-1236`), which additionally (a) blocks when `operationActive` is set and (b) *permits* the lock owner to proceed. So these two channels are simultaneously **too permissive** (they run during an active operation) and **too restrictive** (they block the window that holds the lease). The asymmetry means one of the two behaviours is unintended.

**Fix:** use `isMainInteractionActionBlocked(event)` on both, or document why the transcription/translation paths must differ.

---

## 3. Verified Sound

Checked deliberately, found correct. Recorded so a future reviewer does not repeat the work.

**Preload / contextBridge posture** — VERIFIED

- Exactly two `contextBridge.exposeInMainWorld` call sites in the whole tree: `preload.ts:4` and `prettifyProfileChooserPreload.ts:4`. Both expose a single `electronAPI` object.
- Both APIs are **closed object literals of named functions** (`preloadApi.ts:132-527`, `prettifyProfileChooserPreloadApi.ts:17-32`). Neither exposes `ipcRenderer`, a generic `invoke(channel, …)`, `send`, `on`, `require`, `process`, or any Node primitive. **Channel names are compile-time constants inside the preload; the renderer can never choose a channel.** This is the single most important property of the boundary and it holds.
- Listener registration returns an unsubscribe closure in every case (`onMainEvent` `113-120`), so renderer components can and do detach. No `removeAllListeners` footgun.
- The preload additionally **validates main→renderer payloads** — `sanitizeFirstLaunchStartupSnapshot` (`161`, `167`, `173`), `isMainInteractionLockState` (`191`, `195`), `sanitizeTextActionStatus` (`152`), `isTranslationProviderConnectionState` (`156`), the whole `isLocalWhisper*` family (`299-355`), `sanitizeTranslationProviderConnectionState` (`459`). Defense-in-depth in the correct direction, and unusual to see.
- `runLocalWhisperSettingsCommand` / `runLocalWhisperMainResidencyCommand` validate the *outgoing* command in the preload before invoking (`323`, `349`).

**Electron window hardening** — VERIFIED

- `window.ts:495-504`: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webviewTag: false`, `navigateOnDragDrop: false` — applied by a single `createWebPreferences()` used by **every** window (main `212`, settings `274`, history `327`, provider settings `379`, about `486`). No window opts out.
- Chooser window matches (`prettifyProfileChooserWindowController.ts:250-255`).

**Navigation and external URLs** — VERIFIED

- `applyNavigationGuards` (`window.ts:512-537`) is applied to every window it creates (`229`, `285`, `332`, `383`, `490`). `will-navigate` allows only `app://gpt-voice`; anything unparseable or off-origin is `preventDefault`ed.
- `setWindowOpenHandler` **always** returns `{ action: 'deny' }` and hands off to `openExternal` only when `parsed.protocol === 'https:'`. No `file:`, no `javascript:`, no custom scheme.
- **`shell.openExternal` is not reachable from any IPC handler.** Its only three consumers are the two window-open handlers above and `desktopRuntimeController.ts:117`, which passes a hardcoded `APP_WEBSITE` constant. No renderer-supplied URL reaches it.

**Filesystem and path construction** — VERIFIED

- **No renderer-supplied string is used to build a filesystem path.** The two IPC flows that touch files derive their paths from native dialogs: `DiagnosticsExportService` (`diagnosticsExport.ts`, save dialog + generated `gpt-voice-diagnostics-<random>` name) and `PrettifyProfilePortabilityService` (`showSaveDialog`/`showOpenDialog` at `530`, `544`). Both additionally require `isUsableAbsolutePath` — `path.isAbsolute` plus a NUL-byte rejection (`prettifyProfilePortability.ts:211-212`) — and the import path uses `readFileBounded(filePath, maxBytes)`.
- `grep` for `path.join` under `src/main/providers/` returns **nothing**: provider ids are not used in path construction, so the `providerId` handlers cannot traverse.
- Portability and diagnostics handlers are registered via `handleSettingsWindow`, so they are additionally restricted to the live Settings window.

**Clipboard** — VERIFIED

- The only clipboard write reachable from IPC is `copy-transcription-history-text` → `TranscriptionHistoryIpcController.copyText` (`transcriptionHistoryIpcController.ts:26-43`). It coerces the id with `Number(id)`, looks the text up in the local history store, and writes **only** that stored text. The renderer cannot inject arbitrary clipboard content, and a miss returns a generic `History entry not found`.
- The other clipboard users (`selectedTextTranslation.ts`, `selectedTextPrettify.ts`) are hotkey-driven, not IPC-driven.

**Sender validation** — VERIFIED

- Every channel in `ipc.ts` is registered through `TrustedIpcRegistrar`, never `ipcMain.handle` directly; the identity check runs **inside** the wrapper on every invoke (`ipc.ts:246-253`), not once at registration.
- `handleSettingsWindow` (`255-272`) is the strong variant: it rejects a missing `senderFrame` outright, then requires `getTrustedSettingsWindow` to match both webContents id **and** live URL (`window.ts:152-163`), and passes the resolved `BrowserWindow` to the listener so the handler cannot pick its own parent window for a dialog.
- The chooser registrar (`prettifyProfileChooserIpcRegistrar.ts:67-78`) enforces an **exact argument count** per channel *and* `controller.isTrustedSender(event.sender, event.senderFrame?.url)` on every call, and its privileged operations additionally require a capability token minted by main (`apply`, `cancel`, `ready`, `manageProfiles`). Capability model, not ambient authority.

**Prototype pollution** — VERIFIED

- **Zero `Object.assign` in `src/main`.** Every merge of renderer input observed uses object spread, which performs `CreateDataProperty` and therefore cannot trigger an inherited setter or reassign `[[Prototype]]` from an own `__proto__` key.
- Every spread in `ipc.ts` operates on a **main-produced** object, not renderer input: `...getHotkeySettings()` (`884`, `890`, `899`, `914`, `974`), `...savedSettings` (`803`), `...rejected` (`1099`, `1136`, `1164`), `...getOpenAIApiSettingsView()` (`1331`), `...getClaudeWebSettings()` (`1348`).
- `readForbiddenCustomProfileIdsRequest` (`ipc.ts:208-223`) is an exemplary prototype-aware validator: rejects non-objects, `null`, arrays, **anything whose prototype is not `Object.prototype`**, any key count other than 1, and reads the value through `getOwnPropertyDescriptor` rather than a property get. This pattern should be the template for the IPC-3 fixes.
- `createPrettifyProfileCatalogSettingsSnapshot` (`191-206`) deep-freezes what it returns.

**Argument-count discipline** — VERIFIED

- `assertEmptyIpcArguments` (`225-227`) is applied to the zero-argument channels: first-launch snapshot/retry (`1256`, `1260`) and the interaction-lock query (`1269`). Extra arguments are a `TypeError`, not silently ignored.

**Registration / disposal lifecycle** — VERIFIED

- `register()` is idempotent via the `registered` flag and refuses to run after disposal (`362-365`); `dispose()` is idempotent via `disposalPromise` (`1219-1228`) and awaits both the streaming disposal and the in-flight prettify mutation before resolving — so a quit cannot tear down mid-write.
- `TrustedIpcRegistrar.dispose()` removes every tracked channel and clears the set (`286-291`), and further `handle()` calls throw. (Streaming channels are the one gap — IPC-4.)
- `MainIpcController` captures only `dependencies`; there are **no maps keyed by renderer-supplied values** in `ipc.ts`. The only per-sender state lives in `StreamingTranscriptionIpcController` and `PrettifyConnectionCheckCoordinator`, both of which receive explicit `addSenderDestroyedListener`/`removeSenderDestroyedListener` hooks (`377`, `387`) and both of which are disposed (`1224-1225`). The coordinator's listener discipline was independently verified in the Prettify review.
- Handler-registered window listeners in `window.ts` are per-window `close`/`closed` handlers that null out the field they own (`231-239`, `295-299`, `334-336`) and `releaseInteractionLockedWindow` deletes from `interactionLockedWindowIds` (`468-471`), so that `Set` is keyed by main-created webContents ids and is bounded by live window count — not by renderer input.

**Renderer-supplied query bounds** — VERIFIED

- `get-transcription-history` forwards `query` unvalidated, but the repository clamps: `limit: Math.min(MAX_LIMIT, Math.max(1, requestedLimit))`, `offset: Math.max(0, requestedOffset)` after `normalizeInteger` (`transcriptionHistoryRepository.ts:36-41`). No unbounded page size, and no string interpolation into SQL was observed on that path.

**Secret handling** — VERIFIED for the reviewed lines, INFERRED for `getView()` bodies

- The two log summarizers deliberately emit **derived facts only** — `apiKeyUpdated` booleans, `promptLength`, `modelLength`, `baseUrlLength`, `hasExecutablePath` (`ipc.ts:306-345`). No key, prompt, or URL is logged.
- The success log for provider settings records `hasApiKey` / `promptLength`, never the values (`792-799`), and the Prettify save log records `*ModelLength` / `vllmHasApiKey` (`1061-1068`).
- The snapshots returned to the renderer are built from `getOpenAIApiSettingsView()` / `getClaudeWebSettings()` / `prettifySettings.getView()`; the surrounding code consistently reads `hasApiKey` (`1336`) and `hasSession` (`1353`, `1366`) booleans, indicating the views are already redacted. **I did not read the `getView()` bodies** — confirming they never return the raw key is listed in §5.

**Error surfaces** — VERIFIED

- Validation failures return coded, localized strings (`invalid-catalog` / `save-failed` at `681-684`, `allocation-exhausted` / `invalid-request` at `697-703`, `error.translationSettingsInvalid` at `1301-1303`) rather than raw exception text, and the corresponding logs record a code, not the payload.
- Counter-example worth noting: `save-provider-settings` (`815`) and `set-text-action-settings` (`1020`) return `getErrorMessage(error)` verbatim to the renderer. Given the renderer is same-trust UI this is acceptable, but it does mean a downstream `Error` carrying a filesystem path would be echoed. Low, folded into §4.

---

## 4. Notes Not Rising to Findings

- **`get-provider-settings` has no handler-level type check** (`ipc.ts:582`) but is saved by `getProviderSettingsSnapshot` → `createProvider`, which throws `Unknown voice provider` for anything not in the audit mapping (`voiceProviderRegistry.ts:33-42`). Adding the guard at the handler would make the intent local rather than emergent.
- **Verbatim `getErrorMessage(error)` returned to the renderer** on two save paths (see above). Consider mapping to codes for consistency with the newer handlers.
- **`set-hotkey`'s dispatch chain** (`ipc.ts:918-969`) mixes `key === …` and `target === …` comparisons on the same validated value. Harmless — `target` is `key` — but it reads as though two different values are being tested.

---

## 5. Unreviewed / To Resume

This review was interrupted. The following were **in scope but not read**, and should be covered before the boundary is considered fully audited:

**Handler downstream reach (highest value to resume first)**

1. `src/main/services/transcription.ts` — where `transcribe-audio`'s unvalidated `buffer` and `mimeType` actually go. Specifically: is `mimeType` used to derive a file extension, a temp path, or a request header? Is the buffer size bounded?
2. `src/main/services/translation.ts` / `TranslationRuntime.translateText` — reach of unvalidated `text` and `targetLang`; whether `targetLang` is interpolated into a URL, a prompt, or a provider argument.
3. `src/main/providers/voiceProviderAudit.ts` and `src/main/providerAudit/**` — whether `startOperation(providerId, …)` retains per-id state in a map (bears directly on IPC-3's unbounded-map concern).
4. `src/main/providers/*.ts` `hasSession()` bodies — confirm/refute synchronous `fs` on the `check-session` poll path (IPC-6).
5. `src/main/services/cloakBrowserSettingsReset.ts` — `save-cloakbrowser-settings` (`ipc.ts:711-713`) forwards `unknown` straight through; the validator was not located.
6. `src/main/services/diagnosticCaptureSettings.ts` — `setSettings(request)` / `clear(request)` (`ipc.ts:409-417`) forward `unknown`; Settings-window-gated, but the validators were not read.

**Boundary machinery not read**

7. `src/main/streamingTranscriptionIpcController.ts` — per-sender listener add/remove balance, operation-id map bounds, and which channels it registers (bears on IPC-4).
8. `src/main/prettifyProfileChooserWindowController.ts` — `isTrustedSender` and the token minting/validation that the chooser registrar depends on.
9. `src/main/providerSettingsWindowController.ts`, `src/main/aboutWindowController.ts` — window maps and disposal.
10. `src/main/localWhisper/ipc/VoiceProviderSelectionService.ts` — reached from `set-active-provider` (`ipc.ts:853`), which passes `unknown` through. Adjacent to the excluded Local Whisper scope but on a non-Local-Whisper channel.
11. `src/main/main.ts:370-400` — the full `MainIpcTransport` wiring and whether anything else calls `ipcMain.handle` outside the two registrars (a duplicate-registration audit was started but not completed).

**Not attempted**

12. `getView()` bodies for OpenAI / Claude Web / CloakBrowser / Prettify settings — confirming no secret is returned to the renderer (currently inferred from field names).
13. `src/renderer/**` consumers of `electronAPI` — out of scope for the boundary itself.
14. Any dynamic testing, fuzzing of IPC payloads, or test-suite execution. Static reading only.
15. CSP verification was **not** repeated here; it was verified in the prior Local Whisper review (§4) and is assumed unchanged.
