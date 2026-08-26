# Local Whisper Desktop App Review — TypeScript, Electron, React

Date: 2026-08-08
Branch: `feat/local-whisper-provider`
Scope: ~27,159 lines of Local Whisper TypeScript across `src/main/localWhisper/**`,
`src/shared/localWhisper/**`, `src/renderer/localWhisper/**`, plus the Electron window, preload,
and IPC boundary that carry it
Companion to: [`2026-08-08-local-whisper-native-review.md`](2026-08-08-local-whisper-native-review.md)
(C++ side)

Verdict: **No merge-blocking defects found.** Six findings, all low or medium severity. The
Electron security posture and the main-process trust boundary are materially stronger than typical
for an Electron application.

## Summary

I went looking for the usual Electron and React failure modes and mostly did not find them. That is
the honest result, so this review leads with what was verified sound (section 4) rather than padding
the findings list. The six real findings are in section 3.

| ID | Finding | Area | Severity |
| --- | --- | --- | --- |
| F1 | Abort listener leaks when a transport stream is opened but never iterated | main / artifacts | medium |
| F2 | `performArtifactAction` identity churns on every progress tick | renderer / React | medium |
| F3 | `run()` sets state after unmount without the guard its sibling uses | renderer / React | low |
| F4 | `hasSafePath` takes an unused `value` parameter that implies a check it does not perform | main / artifacts | low |
| F5 | `parseSafeUrl` called purely for its throw, result discarded | main / artifacts | low |
| F6 | `did-start-navigation` invalidates IPC capabilities on same-document navigation | main / ipc | low |

## 1. What Was Reviewed

- **Electron shell**: `window.ts`, `desktopRuntimeController.ts`, preload surface, CSP, webPreferences,
  navigation and window-open handling.
- **IPC trust boundary**: `LocalWhisperIpcController.ts`, `ElectronLocalWhisperSenderAuthority.ts`,
  `LocalWhisperSnapshotService.ts`, `src/shared/localWhisper/ipc.ts`.
- **Main-process services**: coordinator, supervisor and worker transport, artifact lifecycle and
  HTTP transport, catalog repository, filesystem adapter and managed artifact store, settings
  repository, journal store.
- **Renderer**: `useLocalWhisperSettings.ts`, `useLocalWhisperMainStatus.ts`,
  `LocalWhisperSettingsPage.tsx`, the seven components under `components/`, and the presentation and
  state modules.

## 2. Threat Model Applied

- **Renderer is untrusted** for privilege purposes: it can only reach main through the preload
  contract, and every privileged call must prove sender identity.
- **The network is untrusted**: catalog and artifact origins, redirects, response headers, and body
  framing are all attacker-influenced.
- **The filesystem is untrusted**: managed artifact directories can be raced by another local
  process.
- **Audio, transcripts, tokens, and absolute paths are sensitive** and must not reach logs,
  diagnostics, or renderer-visible errors.

## 3. Findings

### F1 (medium) — Abort listener leaks when a transport stream is opened but never iterated

`src/main/localWhisper/artifacts/CatalogHttpTransport.ts:198-239`

`open()` registers an abort forwarder on the caller's signal:

```ts
const transportController = new AbortController();
const forwardAbort = (): void => transportController.abort();
signal.addEventListener('abort', forwardAbort, { once: true });
```

It is removed in exactly two places: the `catch` in `open()` (line 235), and the `finally` of the
`boundedBody` async generator (line 271).

`boundedBody` is an **async generator**. Calling it returns a generator object without executing any
of its body, so its `finally` runs only if the consumer actually iterates it and it then completes,
throws, or is `return()`ed. If `open()` succeeds and the caller drops the returned
`ArtifactTransportStream` without iterating — an early validation failure, a cancellation between
`open()` and the first read, or any future refactor that opens speculatively — the listener stays
attached to the caller's `AbortSignal` and the closure retains `transportController`.

`{ once: true }` limits this to one leak per opened-and-abandoned stream, and the signal is
per-operation, so this is bounded rather than unbounded. It is still a real retention path on the
download hot path.

**Fix:** register the forwarder inside `boundedBody` where its `finally` already owns teardown, or
attach an explicit `dispose()` to the returned stream and remove the listener there.

### F2 (medium) — `performArtifactAction` identity churns on every progress tick

`src/renderer/localWhisper/useLocalWhisperSettings.ts:305-333`

```ts
const performArtifactAction = useCallback(
  (action, artifact) => { /* ... */ },
  [cancelArtifactOperations, run, service, state.snapshot],
);
```

`state.snapshot` is in the dependency list, and the snapshot is republished on **every artifact
progress update** during a download. So `performArtifactAction` gets a new identity on every
progress tick and re-renders every component that receives it as a prop — during exactly the period
when the UI is already doing the most work.

Every other callback in this hook is correctly stabilized: `cancelArtifactOperations` reads live
state through `snapshotRef.current` and has stable dependencies. `performArtifactAction` only needs
the snapshot for one lookup in the `'cancel'` branch.

**Fix:** read the snapshot from `snapshotRef.current` in the `'cancel'` branch and drop
`state.snapshot` from the dependency array, matching the pattern already used two functions above.

### F3 (low) — `run()` sets state after unmount without the guard its sibling uses

`src/renderer/localWhisper/useLocalWhisperSettings.ts:191-205`

```ts
} finally {
  commandPendingRef.current = false;
  setState((current) => ({ ...current, pendingAction: null }));   // no disposedRef check
}
```

`cancelArtifactOperations` guards the identical situation at line 299
(`if (!disposedRef.current) setState(...)`), and the error paths at lines 197 and 200 are unguarded
too. The effect cleanup calls `service.dispose()`, but an in-flight `operation()` promise can still
resolve afterwards and reach `acceptSnapshot` at line 194.

React 18 removed the post-unmount `setState` warning and the call is a no-op, so this is not a leak
or a crash. It is flagged because the asymmetry means one of the two patterns is wrong, and the
guarded one is the intended contract.

**Fix:** guard the `run()` state writes with `disposedRef.current`, or drop the guard in
`cancelArtifactOperations` — but pick one.

### F4 (low) — `hasSafePath` takes an unused parameter that implies a check it does not perform

`src/main/localWhisper/artifacts/CatalogHttpTransport.ts:25-35`

```ts
function hasSafePath(value: string, parsed: URL): boolean {
  if (parsed.pathname.includes('\\') || ENCODED_SEPARATOR_OR_DOT_PATTERN.test(parsed.pathname)) return false;
  // ... `value` is never read
```

The signature reads as "validate the raw string *and* the parsed URL", but only `parsed.pathname` is
examined. On a security-relevant validator this is worse than a plain unused variable: a future
reader may assume the raw input is being checked for something `URL` normalization would have
already swallowed.

The current behavior is correct — `parsed.pathname` is the right thing to check, and
`URL` normalization happens before `parseSafeUrl`'s other guards. **Fix:** delete the parameter.

### F5 (low) — `parseSafeUrl` called purely for its throw, result discarded

`src/main/localWhisper/artifacts/CatalogHttpTransport.ts:91`

```ts
redirected = new URL(location, current);
parseSafeUrl(redirected.toString());   // return value discarded
assertRedirectTarget(redirected, spec);
```

This re-serializes and re-parses a `URL` that was just constructed, then throws away the result, to
reuse `parseSafeUrl`'s validation side effect. It is functionally correct but obscures that the
redirect target *is* being fully validated. **Fix:** split the predicate out of `parseSafeUrl` into
an `assertSafeUrl(url: URL)` and call it directly on `redirected`.

### F6 (low) — IPC capabilities invalidate on same-document navigation

`src/main/localWhisper/ipc/ElectronLocalWhisperSenderAuthority.ts:59-68`

`listenForInvalidation` treats `did-start-navigation` as invalidating. That event also fires for
same-document navigations (fragment changes, `history.pushState`). A settings page that adopts
hash-based routing or any `pushState` would silently drop its live snapshot subscription and stop
receiving updates until re-subscribed.

Failing closed is the right default here, so this is a robustness note, not a security issue. **Fix:**
check the event's `isSameDocument` argument and ignore same-document transitions, or document the
constraint that these renderer surfaces must not use client-side routing.

## 4. Verified Sound

Checked deliberately because each is a common failure point. All were correct; recording them so a
future reviewer does not repeat the work.

**Electron hardening** (`src/main/window.ts:398-431`)

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webviewTag: false` on both
  the main window and the prettify chooser window.
- `will-navigate` is intercepted; `setWindowOpenHandler` opens externally **only** for
  `parsed.protocol === 'https:'` and otherwise denies.
- `app.commandLine.appendSwitch('no-sandbox')` in `desktopRuntimeController.ts:252` is gated on
  `app.isPackaged && environment.APPIMAGE`. That is the standard, unavoidable AppImage workaround
  (no SUID sandbox helper in the image), correctly scoped rather than global.

**Content Security Policy** — `src/renderer/index.html:7` sets
`default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`.
I verified via `webpack.config.js:152-180` that **all** renderer pages (`index`,
`provider-settings`, `prettify-profile-chooser`, `settings`, `history`, `about`) are generated from
this single template, so the privileged settings window inherits the same policy. Only
`style-src 'unsafe-inline'` is relaxed, which is the normal cost of CSS-in-JS/inline styles and is
not exploitable without a `script-src` hole.

**IPC trust boundary** — `ElectronLocalWhisperSenderAuthority` is a capability model, not an
ambient-authority one. It requires `event.senderFrame === event.sender.mainFrame`, rejects destroyed
senders, checks window ownership per surface (`settings` vs `main`), and re-checks all of it inside
`isCurrent()` on every send rather than trusting the authorization moment. Capabilities carry an
`onInvalidated` hook wired to navigation, destruction, and renderer crash. This is stronger than the
usual `event.sender.id` comparison.

**Network transport** (`CatalogHttpTransport.ts`) — HTTPS-only; rejects embedded credentials and
fragments; blocks backslashes and `%2e`/`%2f`/`%5c` in paths; rejects `.`/`..` segments after
decoding; enforces an explicit redirect allowlist by host **and** port **and** path prefix; bounds
redirect count; withholds `Range`/`If-Range` from redirect targets unless the policy opts in;
requires `Content-Encoding: identity`; rejects `multipart/*`; requires exact `Content-Length`;
validates `Content-Range` and `ETag` on resume; and applies connection, no-progress, and total
transfer timeouts plus a per-chunk size bound. `NodeArtifactHttpClient.ts:56` sets
`rejectUnauthorized: true` explicitly.

**Supervisor timer lifecycle** (`LocalWhisperWorkerSupervisor.ts`) — I traced every
`clock.setTimeout` to a matching `clearTimeout`: request settle (643), handshake (675),
`failTerminal` clears the handshake timer and iterates all pending requests (700, 704), and the
cancel path (800). No stale `OPERATION_TIMEOUT` can fire against a healthy worker.

**Coordinator mutual exclusion** (`LocalWhisperCoordinator.ts:726-745`) — `beginOperation` is fully
synchronous between its `if (this.stopped || this.activeOperation) return null` guard and the
`this.activeOperation = operation` assignment, so there is no `await` window for two callers to both
pass the check. Staleness is then re-checked by identity plus epoch comparison in `isStageCurrent`.
This is the correct single-threaded-JS mutex pattern.

**Journal persistence** (`FileArtifactTransferJournalStore.ts:74-88`) — `path()` resolves and then
requires the candidate to start with `${resolve(this.root)}${sep}`, blocking traversal;
`readPath()` stats the open handle and rejects non-files and anything over `MAXIMUM_JOURNAL_BYTES`
**before** `readFile()`, so `JSON.parse` cannot be handed an unbounded buffer. The root is created
and chmod'ed `0o700`.

**Renderer waiter bookkeeping** — `resolveTerminalOperationWaiters` deletes from
`operationWaitersRef.current` while iterating it with `for...of`. Deleting the current element
during `Set` iteration is well-defined in ECMAScript, so this is safe. Effect cleanup settles all
outstanding waiters with `false` and clears their timeouts, so no timer survives unmount.

**Code hygiene sweep** — zero occurrences of `as any`, `@ts-ignore`, or `@ts-expect-error` across
all three Local Whisper trees; zero `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or
`new Function` in the renderer; `setTimeout`/`setInterval` balanced against clears in every
main-process Local Whisper file.

## 5. Recommended Order

1. **F1** — move the abort-listener registration into `boundedBody`, or add explicit stream disposal.
2. **F2** — drop `state.snapshot` from `performArtifactAction`'s dependencies and read
   `snapshotRef.current` instead. Cheapest visible win during downloads.
3. **F3** — make the two post-unmount patterns agree.
4. **F4**, **F5**, **F6** — clarity and robustness cleanups, no behavioral urgency.

None of these block merge. F1 and F2 are worth fixing before the next artifact-lifecycle change,
since both sit directly on the download path.
