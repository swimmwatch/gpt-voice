# Renderer App Shell (non-Local-Whisper) — Code Review

- **Status:** PARTIAL — interrupted mid-review; coverage limited to the files listed in Scope.
- **Date:** 2026-08-08
- **Branch:** `feat/local-whisper-provider`
- **Reviewer focus:** Memory leaks (audio pipeline first), Performance (render/subscription churn), Security (HTML injection, secret retention), Correctness (async IPC vs. unmount races)
- **Method:** Static reading of the actual source. Every `useEffect` that subscribes to `window.electronAPI` was traced to its cleanup; every `MediaStream` / `AudioContext` / `MediaRecorder` acquisition was traced to a release path; every `await` on an IPC call was checked for a post-await ownership guard. Two repo-wide greps were run for injection sinks and for the PCM size constants. Findings are marked **VERIFIED** (read in code) or **INFERRED** (reasoned, not directly observable). Local Whisper renderer surfaces are excluded — they are covered by `docs/reviews/2026-08-08-local-whisper-desktop-app-review.md`, whose renderer findings (F2 identity churn, F3 unguarded `run()`) I checked against mine to avoid duplication. No source file was modified. No tests were executed.

## Scope

### Actually reviewed (read in full)

- `src/renderer/App.tsx` (1076 LOC)
- `src/renderer/hooks/useRecording.ts` (389 LOC)
- `src/renderer/hooks/useStreamingRecordingController.ts` (360 LOC)
- `src/renderer/hooks/useI18n.tsx` (119 LOC)
- `src/renderer/audio/livePcmCaptureBrowser.ts`
- `src/renderer/audio/livePcmCaptureSession.ts`
- `src/renderer/audio/livePcmPipeline.ts`
- `src/renderer/audio/pcmFrameAccumulator.ts`
- `src/renderer/audio/streamingTranscriptionQueue.ts` (327 LOC)

### Reviewed by targeted grep only

- Whole `src/renderer/**` tree for `dangerouslySetInnerHTML`, `innerHTML`, `target="_blank"`, `window.open`, `eval(`, `new Function`, `document.write`, `URL.createObjectURL`.
- Whole repo for the PCM/streaming size constants (`MAX_STREAMING_TRANSCRIPTION_PCM_CHUNK_BYTES`, `MAX_PENDING_STREAMING_TRANSCRIPTION_FRAMES`, `LIVE_PCM_FRAME_BYTES`, `retainedPcmByteLength`) to establish which bounds are actually enforced in production code.

### Not reviewed — see "Unreviewed / to resume"

`AppSettingsWindow.tsx`, `appSettingsUtils.ts`, `components/settings/**` (including `PrettifyProfilesSettingsSection.tsx`), `entries/**`, the remaining hooks and components.

All file references below are `file:line`.

---

## Summary Verdict

**The audio capture pipeline — the part I was most expecting to leak — does not leak.** `LivePcmCaptureSession.releaseResources` is a memoized, idempotent teardown that clears the worklet message port, disconnects the nodes, stops every `MediaStream` track and closes the `AudioContext`, and it is reached from both the success and the cancel path; the construction path has a full rollback so a failed `addModule` cannot strand a live microphone. Every `electronAPI` subscription I read is unsubscribed in its effect cleanup *and* additionally guarded by a `disposed` flag checked inside the callback. Every async IPC response is guarded by a monotonic request-id ref compared after the await, and the cleanups bump those counters so in-flight responses are dropped rather than written to unmounted state. There is no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, and no `new Function` anywhere in the renderer.

The real findings are concentrated in **unbounded audio retention** rather than in leaked handles: both recording modes accumulate the full recording in renderer memory with no duration or byte ceiling, and the batch mode additionally never releases its `Blob` chunk array after the recording ends. Nothing found is Critical. One Medium is a genuine OOM risk on long dictations; the rest are render-churn and narrow-race issues.

### Findings Table

| ID | Finding | Area | Axis | Severity |
| --- | --- | --- | --- | --- |
| R1 | Batch-mode `chunksRef` Blob array is never cleared after stop, cancel, or unmount | `useRecording` | Memory | Medium |
| R2 | `LivePcmPipeline` retains the whole recording as PCM with no ceiling; ~4 copies live at finish | `audio/livePcmPipeline` + queue | Memory | Medium |
| R3 | `useStreamingRecordingController` returns an unmemoized object, invalidating all six `useRecording` callbacks every render | hooks | Performance | Medium |
| R4 | `recordingActionsRef` is written in a passive effect, so an IPC hotkey can run a one-render-stale closure | `App.tsx` | Correctness | Low |
| R5 | Provider-settings effect couples a ref write to a subscription, so the ref only syncs when the listener is re-created | `App.tsx` | Correctness (fragility) | Low |
| R6 | `target="_blank"` in `AboutWindow`; `rel` and main-process window-open handling not confirmed | `AboutWindow.tsx` | Security | Low (unconfirmed) |

---

## Findings

### R1 — Batch-mode `Blob` chunk array is never released _(Medium, Memory)_ — VERIFIED

`src/renderer/hooks/useRecording.ts:52, 193, 195-197, 199-231, 334-361, 367-378`

`chunksRef.current` is assigned a fresh array in exactly one place — `startRecording` (line 193). The `ondataavailable` handler (195-197) pushes every `Blob` chunk into it for the whole recording. `onstop` builds the upload `Blob` from it (line 202) and its `finally` block (221-230) stops the tracks, nulls `mediaRecorderRef` and `recordingModeRef`, and resets the lifecycle — but **never clears `chunksRef`**. The unmount cleanup (367-378) does not clear it either.

The cancel path is worse. `cancelRecording` (343-349) sets `mediaRecorder.onstop = null` and calls `stop()`, but leaves `ondataavailable` attached. `MediaRecorder` fires a final `dataavailable` before `stop`, so that last chunk is still pushed into an array that now has no consumer and no owner.

**Failure scenario.** A user records a 20-minute meeting in batch mode. Opus in WebM runs roughly 0.5–1 MB/min, so ~10–20 MB of `Blob` data sits in `chunksRef` after the transcription completes. Concurrently, `retryStateRef` deliberately holds the prepared upload buffer for the retry feature (line 103, `storeRetryableTranscriptionAudio`) — so two full copies of the same audio are resident. Neither is released until the user starts *another* recording (line 174 `clearLastTranscriptionAudio`, line 193 `chunksRef.current = []`). If the user records once and then leaves the app idle — the normal usage pattern for a dictation tool — both copies are pinned for the process lifetime.

**Fix.** Set `chunksRef.current = []` in the `onstop` `finally` block, in `cancelRecording`, and in the unmount cleanup. Also null `mediaRecorder.ondataavailable` alongside `onstop` when cancelling, so the trailing chunk is never collected in the first place.

### R2 — Whole-recording PCM retention with no ceiling, and redundant copies at finish _(Medium, Memory)_ — VERIFIED mechanism / INFERRED threshold

`src/renderer/audio/livePcmPipeline.ts:24, 31-40, 50-71, 81-87`; `src/renderer/audio/streamingTranscriptionQueue.ts:161-166, 276-283`

`LivePcmPipeline.retain` (85-87) pushes a `.slice()` **copy** of every emitted frame into `retainedChunks` and never trims. `finish()` (50-71) then calls `concatenatePcmChunks(this.retainedChunks)` into one contiguous buffer and wraps that in `encodePcm16WavBytes`. At that instant three full-length copies of the recording are simultaneously live: the chunk array, the concatenated PCM, and the WAV. `StreamingTranscriptionQueue.finish` then takes `recordingWav.slice(0)` (line 164) and `finishOperation` takes **another** `recordingWav.slice(0)` at the IPC call site (line 283) — two more full copies, before the structured clone across the IPC boundary makes a sixth.

At the pipeline's fixed 16 kHz mono 16-bit format, that is 32 kB/s ≈ 1.9 MB/min of retained audio.

The class exposes a `retainedPcmByteLength` getter (81-83) that reads exactly like a budget hook — but the repo-wide grep shows it is referenced **only** from `tests/renderer/livePcmPipeline.test.ts:168, 174, 178`. **No production code consults it, and there is no max-duration or max-byte guard anywhere in the capture path.** The queue's bounds (`MAX_PENDING_STREAMING_TRANSCRIPTION_FRAMES`) cap only the in-flight backlog, not the retained recording.

**Failure scenario.** A user leaves streaming dictation running for an hour (a meeting transcript, a long-form draft). ~115 MB of PCM accumulates; at `finish()` the peak spikes to roughly 400–500 MB across the concat + WAV + two `slice(0)` copies, and then a buffer of that size is structured-cloned over IPC. The renderer either OOMs or the IPC clone fails — at precisely the moment the user expects their hour of work back. There is no early warning because nothing samples `retainedPcmByteLength`.

**Fix.** (a) Enforce a maximum retained-byte budget inside `LivePcmPipeline.pushChannels` using the getter that already exists, failing with a translated status well before the ceiling. (b) Drop at least one of the two `recordingWav.slice(0)` copies in `streamingTranscriptionQueue.ts:164`/`283` — the buffer is already an owned copy by the time `finish()` receives it. (c) Consider streaming the recording WAV to main incrementally rather than as one terminal blob.

### R3 — Unmemoized controller object invalidates every recording callback each render _(Medium, Performance)_ — VERIFIED

`src/renderer/hooks/useStreamingRecordingController.ts:359`; `src/renderer/hooks/useRecording.ts:150-164, 252-266, 300, 316, 332, 361, 365, 380-389`; `src/renderer/App.tsx:343-354, 1061-1071`

`useStreamingRecordingController` ends with a bare object literal:

```ts
return { cancel, cancelForProviderChange, pause, resume, start, stop };
```

It is not wrapped in `useMemo`, so it is a new identity on every render even though all six members are stable `useCallback`s. `useRecording` then lists `streamingRecording` in the dependency array of `startRecording` (262), `stopRecording` (300), `pauseRecording` (316), `resumeRecording` (332), `cancelRecording` (361) and `cancelStreamingForProviderChange` (365) — so **all six recording callbacks are recreated on every render**. `useRecording` in turn returns its own unmemoized object literal (380-389).

The consequences cascade into `App.tsx`:

- `useEffect(() => { recordingActionsRef.current = recordingActions; }, [recordingActions])` (351-353) fires on **every** render instead of when something meaningful changed.
- `RecordingControls` receives five brand-new function props on every render (1061-1071), so it can never be usefully `React.memo`'d.

**Failure scenario.** App re-renders on every status, translation-status, provider-connection and prettify-connection IPC event — several per second during an active recording and during a provider switch. Each of those re-renders now allocates six closures, allocates two objects, schedules and runs a passive effect, and re-renders the control row with all-new props. It is not a leak and not a correctness bug, but it is exactly the churn that makes future memoization ineffective. This is the same class of defect as F2 in the Local Whisper review (`performArtifactAction` identity churn), which suggests a repo-wide lint rule would pay off.

**Fix.** Wrap both returns in `useMemo` keyed on the stable callbacks.

### R4 — `recordingActionsRef` is populated post-commit, so IPC events can hit a stale closure _(Low, Correctness)_ — VERIFIED mechanism / INFERRED reachability

`src/renderer/App.tsx:350-353` vs `549-569`

The ten IPC subscriptions registered at 549-640 deliberately dereference `recordingActionsRef.current` rather than closing over the callbacks — a good pattern, because it keeps the subscription effect's dependency list down to `[desktopApi, isI18nReady]` (691) and prevents listener churn. But the ref is written in a **passive** `useEffect` (351-353), which runs after commit and after paint.

`transcriptionMode` flows into `useRecording` from `activeProviderTranscriptionMode` (162, 348), which is derived from `activeProvider`. When the active voice provider changes, React commits a render whose `startRecording` closure captures the new mode — but until the passive effect flushes, `recordingActionsRef.current` still holds the closure that captured the **old** mode.

**Failure scenario.** The user switches from a batch provider to a streaming-only provider and presses the record hotkey inside that window. `onToggleRecording` (550-553) invokes the stale `startRecording`, which takes the batch branch (useRecording.ts:187-233) and constructs a `MediaRecorder` against a provider that only accepts streaming PCM. The window is sub-frame and the user would have to be extraordinarily fast, hence Low — but the fix costs nothing.

**Fix.** Assign the ref during render (`recordingActionsRef.current = recordingActions;` at the top level of the component body) or convert the five subscription bodies to `useEffectEvent`, which this very file already uses correctly at line 431.

### R5 — Ref write coupled to a subscription lifetime _(Low, Correctness/fragility)_ — VERIFIED

`src/renderer/App.tsx:723-730`

```ts
useEffect(() => {
  activeProviderIdRef.current = activeProviderId;
  return desktopApi.onProviderSettingsChanged((settings) => { ... });
}, [activeProviderId, applyProviderSettingsSnapshot, desktopApi]);
```

The subscription itself is correct — the unsubscribe function is returned directly as the cleanup, so no listener leaks. The issue is that `activeProviderIdRef.current` is only refreshed as a side effect of the subscription being re-created. `activeProviderIdRef` is read by six other event handlers (552, 588, 601, 617, 626, 771, 787) as the authoritative "which provider is active right now" signal, and it is also written from the `useEffectEvent` handler at 445, 465, 483, 503. Two independent writers to the same ref, one of them gated on an unrelated effect's dependency array, is a shape that will eventually desynchronize under refactoring.

Note also that `applyProviderSettingsSnapshot` (693-721) transitively depends on `t`, so an application-language change tears down and re-registers this IPC listener. Harmless today (`t` is properly memoized on `translations` — useI18n.tsx:99-102 — and the context value is memoized at 113-116), but it means listener lifetime is coupled to locale.

**Fix.** Move the ref write to its own single-purpose effect (or to render), and reduce this effect's dependencies to `[desktopApi]` by routing the handler through `useEffectEvent`.

### R6 — `target="_blank"` in the About window, `rel` and window-open policy unconfirmed _(Low, Security)_ — INFERRED / UNVERIFIED

`src/renderer/AboutWindow.tsx:112, 121`

The repo-wide grep for injection and navigation sinks came back clean except for two `target="_blank"` attributes in `AboutWindow.tsx`. I did not get to read the surrounding markup, so I could not confirm whether `rel="noopener noreferrer"` is present, nor whether the main process installs a `setWindowOpenHandler` that denies the open and forwards the URL to the OS browser.

In Electron this matters more than on the web: an unhandled `target="_blank"` can materialize a new `BrowserWindow` that inherits the opener's `webPreferences`, and without `noopener` the opened page gets a live `window.opener` handle back into a renderer that holds the `electronAPI` bridge. Both URLs are almost certainly hardcoded project links rather than attacker-controlled, which caps the severity — but this needs a two-minute confirmation in the resumed pass.

**Fix / next step.** Confirm `rel="noopener noreferrer"` on both anchors and confirm `setWindowOpenHandler` returns `{ action: 'deny' }` + `shell.openExternal` after URL-scheme validation. The Local Whisper review (section on the Electron shell) states that navigation and window-open handling were verified there; cross-check rather than re-deriving.

---

## Verified Sound

This section is longer than the findings list, which is the honest result of the reading.

**No HTML-injection sink exists in the renderer.** A grep across the entire `src/renderer/**` tree for `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, `new Function`, `document.write` and `URL.createObjectURL` returned **zero** hits. Provider-returned, LLM-returned and transcript text can therefore only reach the DOM as React text children, which are escaped. This closes the highest-value axis of the security brief outright. VERIFIED.

**Every `electronAPI` subscription is unsubscribed, and additionally guarded.** App.tsx registers subscriptions in five effects — 172-190 (first-launch snapshot), 192-209 (interaction lock), 356-399 (prettify settings), 527-691 (the ten-listener block), 723-730 (provider settings) — plus useI18n.tsx:57-93 (locale). In every case the cleanup calls the returned unsubscribe (186-189, 205-208, 394-398, 687-689, the direct return at 725, 88-92). None is registered outside an effect, so none is re-added per render. Beyond unsubscribing, each effect carries a `disposed` boolean that every callback checks before touching state (e.g. 175, 195, 359, 551, 555, 559, 563, 565, 568, 571, 581, 586, 600, 634) — belt-and-braces against an event already in flight when the cleanup runs. VERIFIED.

**Async IPC responses cannot write state after unmount or out of order.** This codebase applies a single consistent discipline: a monotonically increasing request-id ref is captured before the await and compared after it. `prettifyModelRefreshIdRef` (295 → 314, 330; 853 → 863, 895, 900), `prettifyProviderChangeRequestRef` (818 → 826, 838), `translationSettingsRequestRef` (652 → 656; 943 → 953, 962), `translationConnectionRequestRef` (666 → 670, 674), `refreshRequestRef` (useI18n.tsx:49 → 51; 61 → 69), and `recordingGenerationRef` (useRecording.ts:57, 169 → 176, 237). Crucially, the **cleanups bump the counters** (App.tsx:396, 680-681; useI18n.tsx:90) so every in-flight response is invalidated at unmount rather than merely being unable to find a mounted component. I found no `setState` reachable after unmount along any path I traced. VERIFIED.

**Audio resource release is idempotent, ordered, and reached from every terminal path.** `LivePcmCaptureSession.releaseResources` (livePcmCaptureSession.ts:79-89) memoizes a single `releasePromise` so concurrent `finish()`/`cancel()` cannot double-release, and it releases in the correct order: clear the worklet `port.onmessage`, disconnect both nodes, `port.close()`, stop every `MediaStream` track, then `AudioContext.close()`. Each step is individually try/caught (`runCleanup`) so one failure cannot skip the rest. It is reached from `finish()` via a `finally` (line 51) — so even a throwing pipeline releases the microphone — and from `cancel()` (line 60), which is safe to call repeatedly. The construction path (livePcmCaptureBrowser.ts:44-50) has a complete rollback: if `addModule` or the node wiring throws, it disconnects whatever was built, stops the tracks, closes the context, and rethrows. **This is the part I most expected to leak and it does not.** VERIFIED.

**`MediaStream` tracks are stopped on every batch path.** Success (useRecording.ts:222-225), start failure (238-241), user cancel (350-353), and unmount (374). The stale-generation abort immediately after `getUserMedia` (176-179) stops the tracks it just acquired instead of stashing a stream nobody owns — a race that is easy to get wrong and is handled here. The unmount cleanup also nulls `onstop` before calling `stop()` (371-372), so the async transcription handler cannot fire against a dead component. VERIFIED.

**The streaming send queue is genuinely bounded and memory-hygienic.** The backlog is hard-capped at `MAX_PENDING_STREAMING_TRANSCRIPTION_FRAMES` = 64 frames × 2 730 B ≈ 175 kB, with an explicit `QueueOverflow` failure rather than silent growth (streamingTranscriptionQueue.ts:151-154). Every frame is zero-filled after it is consumed — after a successful send (236), after a transport throw (232), when cancelled mid-drain (222), and for the whole backlog on cancel/fail (323-326) — so PCM does not linger in the heap awaiting GC. The zeroing happens after the `await`, which is safe because `ipcRenderer.invoke` structured-clones synchronously at call time. The drain loop is single-flight via `drainPromise` with an identity check before clearing it (199-211), so no two drains can interleave sequence numbers. Frames are re-validated for exact byte length before enqueue (144-150), and the response's `operationId`/`acceptedSequence` are verified against what was sent (241-244), so a mis-routed main-process reply fails the operation instead of corrupting the stream. VERIFIED.

**`PcmFrameAccumulator` retains at most one partial frame** (pcmFrameAccumulator.ts:5, 27) and discards it on `cancel()` (39-42). `flush()` is one-shot and guarded by a `finished` flag (31-33). No unbounded partial accumulation. VERIFIED.

**The streaming controller's terminal-race handling is careful and explicit.** `finish()` builds an `ownsRecording()` predicate combining `unmountedRef`, queue identity **and** recording generation, and re-evaluates it after *every* await (useStreamingRecordingController.ts:213-214, 220, 223, 230, 248) rather than once at the top. `finalizeFailure` checks unmount + queue identity + a `finalizingRef` re-entrancy guard before doing anything (100) and again after its awaits (120). `clearOperation` is identity-guarded (72-74), so a stale operation's teardown cannot null out a newer operation's refs. The unmount cleanup (343-357) cancels both the queue and the in-flight capture promise, and I traced that `queueRef.current` and `capturePromiseRef.current` are both assigned **synchronously** in `start()` (151, 165) before the first await — so there is no window where an unmount can miss an in-flight capture. VERIFIED.

**`LivePcmPipeline` is a strict state machine.** States `active | paused | finished | cancelled`; push-after-finish throws (33-35), finish-after-cancel throws (51-53), double-finish throws (54-56), pause/resume are no-ops outside their legal states (42-48), and `cancel()` drops all retained bytes and cancels the resampler and framer (73-79). Pausing discards incoming audio rather than buffering it (line 32), which is the right choice for memory. VERIFIED.

**React 19.2 `useEffectEvent` is used correctly.** `handleProviderSelectionEvent` (App.tsx:431-525) reads `providers` (480, 500) and `isLoggedIn` (511) — both of which change frequently — yet the effect that installs the coordinator and the ten listeners (527-691) depends only on `[desktopApi, isI18nReady]`. That is precisely what `useEffectEvent` is for, and it is why the subscription block does not churn. R4 above is the observation that this same technique was *not* applied to the recording actions. VERIFIED.

**No secrets in main-window state.** `App.tsx` holds no API keys. The main window receives only `ProviderInfo` records and boolean verdicts — `hasSession` and the result of `isProviderConfigured(settings)` (693-718) — never credentials. Transcript text is passed to `showSuccessfulTranscription` and logged **only as a length**: `text.length` (useRecording.ts:111), `textLength: result.text?.length ?? 0` (124-127), `textLength: result.success ? result.text.length : 0` (useStreamingRecordingController.ts:231-234). Error logging goes through `presented.safeLogMetadata` (useRecording.ts:144, 220, 250) rather than raw error objects, and the raw provider response is logged only as `hasRawResponse: Boolean(...)` (137-139). No transcript body, no audio, and no key reaches the renderer log. VERIFIED.

**i18n interpolation is not a sink.** `translate` (useI18n.tsx:8-19) does plain `String.replace` of `{name}` placeholders and returns a string that is always rendered as a React text child. Note the minor non-security bug that `replace` without `/g` substitutes only the **first** occurrence of each placeholder — worth a follow-up but not in scope here.

---

## Unreviewed / To Resume

The following were in the assigned scope but were **not** read. A resumed pass should start here, in this priority order:

1. **`src/renderer/components/settings/PrettifyProfilesSettingsSection.tsx` (1177 LOC)** — the prime candidate for the "missing memoization on large lists" and "large state object copied per keystroke" axes. Nothing in this review says anything about it.
2. **`src/renderer/appSettingsUtils.ts` (1155 LOC)** — only `createPrettifyProviderSettingsInput` was seen, and only as an import in `App.tsx:37`. Check for heavy synchronous work called from render.
3. **`src/renderer/AppSettingsWindow.tsx` (1003 LOC)** — settings form state shape, per-keystroke copying, and (security) whether API keys are held in component state or logged.
4. **`src/renderer/components/ProviderSettingsForm.tsx` (457 LOC)** — the most likely place for API keys to live in React state; explicitly named in the security axis and not examined.
5. **`src/renderer/hooks/usePrettifySettingsController.ts` (444 LOC)** and `usePrettifyProfileChooserI18n.tsx`.
6. **`src/renderer/entries/**` (6 files)** — bootstrap/mount paths, per-window `createRoot` lifecycle, and whether any window mounts without a startup gate.
7. **`src/renderer/audio/pcm16.ts`, `streamingLinearResampler.ts`, `livePcmCapture.worklet.js`, `livePcmCaptureAsset.ts`, `audioEncoding.ts`** — the encode/resample math and the worklet itself were **not** read; R2's byte accounting assumes `encodePcm16WavBytes` allocates one full copy, which should be confirmed. `audioEncoding.ts` (`prepareTranscriptionAudio`) is a transcode path and a plausible second site of large-buffer duplication.
8. **`src/renderer/recordingRetryState.ts`** — R1 asserts the retry state pins a full audio buffer based on its call sites in `useRecording.ts`; confirm against the module itself.
9. **`src/renderer/DesktopApiProvider.tsx`, `RendererLoggerProvider.tsx`, `WindowStartupGate.tsx`** — assumed to provide a stable `desktopApi` identity (every subscription effect depends on it; if it is not stable, all subscriptions re-register per render and several findings escalate). **This assumption is load-bearing for the "no listener churn" verdict and was not verified.**
10. **`src/renderer/AboutWindow.tsx:105-125`** — resolve R6.
11. Remaining components: `MainToolbar`, `RecordingControls`, `MainPrettifyProviderBand`, `TranslateSection`, `SearchableSelectInput`, `HistoryEntry`, `HistoryWindow`, `PrettifyProfileChooser`, `components/settings/*`, `components/ui/*`.
