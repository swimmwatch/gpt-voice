# Local Whisper Desktop App Review Comments to Address

Date: 2026-08-08  
Source review: `docs/reviews/2026-08-08-local-whisper-desktop-app-review.md`  
Assessment basis: current `feat/local-whisper-provider` source, directly related tests,
the Local Whisper specification, and the Electron types installed by the project.

## Address in the Current Remediation

### 1. F1 — Give every opened transport stream explicit disposal ownership

**Locations:**

- `src/main/localWhisper/artifacts/CatalogHttpTransport.ts:190`
- `src/main/localWhisper/artifacts/ArtifactLifecycleTypes.ts:97`
- `src/main/localWhisper/artifacts/LocalWhisperArtifactService.ts:228`

The review identifies a real teardown gap, but moving the abort listener into
`boundedBody` is not sufficient. `open()` needs abort forwarding while the HTTP
client is opening, and a successfully opened response itself needs cleanup even if
its body is never iterated.

The production service has a concrete abandonment path: after `transport.open()`
returns, it awaits `journals.update()` before calling the verifier. If that update
throws, `transport.body` is never iterated, so the generator's `finally` does not run,
the transport controller is not aborted, and the caller-signal listener remains
registered until that signal is aborted or collected. Future callers can make the
same mistake because `ArtifactTransportStream` exposes no close/dispose contract.

Add an explicit, idempotent asynchronous disposal operation to the transport stream
contract. The transport should own response cancellation and listener removal, and
every caller should close it in `finally` after a successful `open()`. Normal body
completion and early iterator return should use the same idempotent teardown path.
Do not rely on calling `return()` on an async generator that has never been started.

Add deterministic tests for:

- successful `open()` followed by a journal-update failure before the first read;
- explicit disposal before iteration aborting the underlying client signal and
  removing the caller-signal listener;
- idempotent disposal after normal completion, cancellation, and partial iteration;
- all production and qualification call sites closing an opened stream on failure.

## Address as Follow-up Cleanup and Hardening

### 2. F3 — Apply one post-disposal state-update policy across the settings hook

**Location:** `src/renderer/localWhisper/useLocalWhisperSettings.ts:175`

`run()` can call `acceptSnapshot` or `setState` after its awaited service operation
settles even though effect cleanup has set `disposedRef.current`. React 18 treats the
state update as a no-op, so this is not a memory leak or current user-visible defect,
but it conflicts with the hook's explicit disposal contract and with the partial
guarding in `cancelArtifactOperations`.

Keep ref-owned lifecycle cleanup unconditional, but guard all state and snapshot
acceptance that follows an asynchronous boundary once the hook is disposed. Apply
the same rule to the success, failure, catch, and `finally` paths of both `run()` and
`cancelArtifactOperations`; changing only line 204 would leave the same inconsistency
elsewhere.

Add a hook-level regression test with deferred successful and failed commands that
unmounts before settlement and proves that no late snapshot or error is published to
the disposed controller.

### 3. F4 and F5 — Make URL validation operate explicitly on the validated object

**Location:** `src/main/localWhisper/artifacts/CatalogHttpTransport.ts:25`

Both review comments describe the same clarity problem in a security-sensitive
validator. `hasSafePath` accepts an unused raw string, while `parseRedirect` invokes
`parseSafeUrl` only for its exception side effect and then continues with a different
`URL` object. Current behavior is correct, but the API shape makes the validation
evidence harder to follow and easier to misuse during a later redirect change.

Extract a side-effect-free-in-name assertion such as `assertSafeUrl(url: URL)`, make
the path predicate accept only the `URL` it inspects, and have `parseSafeUrl` parse
once and assert that exact object. `parseRedirect` should assert and return its
already constructed redirect object without serializing and reparsing it.

Preserve behavior with a table-driven test matrix applied to both initial and
redirect URLs: non-HTTPS schemes, credentials, fragments, backslashes, encoded
separators/dot segments, malformed escapes, allowed normalized paths, host/port
changes, and path-prefix boundaries.

### 4. F6 — Codify the fail-closed no-routing capability contract

**Locations:**

- `src/main/localWhisper/ipc/ElectronLocalWhisperSenderAuthority.ts:59`
- `src/main/window.ts:141`
- `src/main/window.ts:154`

Electron's installed `did-start-navigation` event details do distinguish
`isSameDocument`, so the review is right that hash and History API transitions
currently invalidate the subscription. The suggested event-only fix is incomplete,
however. `WindowManager.isTrustedMainFrame` and
`isTrustedLocalWhisperSettingsFrame` also require the frame URL to equal one exact
URL, so a hash-changing same-document navigation makes `capability.isCurrent()`
false even if the invalidation callback ignores the event. In addition, a filtered
handler cannot remain a `once` listener: Electron removes it after the first ignored
event, leaving no listener for a later document-changing navigation.

The current renderer does not use hash or History API routing, and failing closed is
consistent with the exact approved-URL capability contract. Address this finding now
by documenting and testing that these privileged surfaces must not use client-side
routing without a coordinated capability redesign. Keep same-document navigation
invalidating under that policy.

If routing becomes a product requirement later, change the full contract together:
define the approved route set in `WindowManager`, update `isCurrent()`, use a
persistent navigation listener that ignores only approved same-document main-frame
transitions, remove it after the first real invalidation, and define renderer
resubscription behavior. Do not weaken only the event callback.

Add explicit tests for same-document main-frame navigation, subframe navigation,
cross-document main-frame navigation, renderer failure, destruction, listener
removal, and exactly-once subscriber revocation under the selected policy.

## Review Comment Not Selected

### F2 — Do not make the proposed callback-only performance change

`performArtifactAction` does capture `state.snapshot`, but removing that dependency
alone will not prevent the progress renders claimed by the review.
`useLocalWhisperSettings` returns a new controller object on every state update, and
`useLocalWhisperInterruption` defines the downstream `requestArtifactAction` callback
with `[controller]` as its dependency. The receiving
`LocalWhisperRuntimeModelSection` is not memoized and also receives the changing
snapshot that it must render as progress advances.

The proposed edit is harmless but has no demonstrated visible performance effect in
the current component tree. Do not carry F2 as a standalone remediation item. If
profiling later shows excessive renderer work, optimize the complete snapshot and
prop boundary with a measured before/after result rather than stabilizing only the
inner callback.

## Verdict and Verification Gaps

Address F1 as the substantive lifecycle correction. Address F3, F4/F5, and F6 as
bounded follow-up consistency, validator-clarity, and contract-hardening work. Do not
schedule F2 in its proposed form.

This assessment is based on source, specification, test, and installed Electron type
inspection. No implementation was changed and no test suite or runtime profiler was
run; each selected item therefore includes the focused verification expected with
its eventual remediation.
