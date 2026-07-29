# 07 Integrate The Selected-Text Translation Runtime

## Outcome

The selected-text hotkey snapshots authoritative provider settings, rejects
invalid or over-limit input before browser creation, routes through the
provider registry, keys cache entries by provider contract, preserves existing
clipboard/single-flight behavior, and shuts isolated translator contexts down
at every required lifecycle boundary. The legacy Google page is removed from
the persistent voice-provider browser context.

## Prerequisites

- Tasks 01–06 are complete and approved.
- Task 07 has separate execution authorization.
- Registry, settings, provider fixtures, and base lifecycle checks pass.

## Owned Requirements

- `RUN-001`–`RUN-004`
- Integrated enforcement of `ARCH-005`–`ARCH-008`
- Integrated enforcement of `RUN-005`–`RUN-013`
- `SEC-001`–`SEC-006`
- `COMP-001`–`COMP-003`
- `AC-AUTO-006`
- Implementation prerequisites for `AC-MAN-002`–`AC-MAN-003`

## In Scope

- Registry-backed translation service/facade.
- Selected-text settings snapshot, validation, input limits, cache identity,
  result application, error localization, and safe logging.
- Removal of Google translator state from `src/main/browser.ts`.
- Provider shutdown on application exit and successful relevant CloakBrowser
  settings changes.
- Compatibility handling for the existing direct translation IPC signature.
- Focused selected-text, browser-lifecycle, navigation-retry, and shutdown
  tests.

## Out Of Scope

- Main-screen provider/language controls, live translation canaries, language
  monitor, documentation, automatic provider fallback, text splitting, or
  post-submission replay.
- Sharing a translation page/context with any voice provider.
- Raw error propagation, source/result logging, or a Yandex-specific notice.

## Task Contract

1. Refactor `src/main/services/translation.ts` into a thin main-process
   orchestration facade. Provider-specific selectors, navigation, insertion,
   result, and clearing behavior must exist only in provider subclasses.
   Atomically remove Task 06's in-memory legacy Google-target compatibility
   view when registry routing activates; no mixed legacy/new route may remain.
2. At the beginning of a selected-text action, after acquiring the existing
   action gate and before clipboard automation, copy one immutable settings
   snapshot: selected provider ID plus that provider's remembered target.
   Validate both against shared metadata without creating a browser.
3. A provider/language change after that snapshot applies only to the next
   operation. It cannot cancel, redirect, alter, or change the cache identity
   of the current action.
4. Preserve the existing selected-text action gate, OS copy automation, Linux
   selection fallback, previous-clipboard capture and restoration, success
   copy, notification behavior, and silent duplicate-hotkey suppression.
5. After selected text is acquired, reject blank input and input longer than
   the selected provider maximum before asking the lazy registry for a provider
   instance. Over-limit failure:
   - sends no text;
   - restores the prior clipboard;
   - reports provider name, allowed length, and selected-text length through a
     localized safe message;
   - logs lengths and public metadata only.
6. Build successful translation cache keys from exactly:
   `['translate', providerId, contractVersion, targetCode, selectedText]`.
   The existing SHA-256 cache-key helper keeps plaintext out of key storage and
   logs.
7. Read from cache only after snapshot validation and limit checks. Cache only
   a nonblank provider success that has already completed clear-or-close
   cleanup. Never cache failed, empty, stale, cancelled, timed-out, or
   cleanup-failed results.
8. Apply a provider result to cache, clipboard, success notification, and safe
   logs only when its generation is still current. A late result/failure after
   invalidation or shutdown is ignored.
9. On every provider failure, restore the previous clipboard, emit one
   localized user-safe failure, and retain only provider ID, target,
   contract version, source/result lengths, safe phase, duration, attempt
   count, and typed outcome in logs.
10. Preserve the existing `translate-text(text, targetLang)` IPC/preload
    signature for compatibility. Its main handler snapshots authoritative
    settings, requires the untrusted `targetLang` argument to exactly equal the
    snapshot target, validates input, and routes through the selected provider.
    It cannot accept a caller-supplied provider or override remembered state.
11. Remove all legacy translator ownership from the persistent background
    browser:
    - `translatePage` and target globals;
    - `includeTranslate` and translator-target background options;
    - translator page getters/setters and ensure/init helpers;
    - Google translator navigation from voice-provider startup/restart.
      Persistent ChatGPT/Claude voice behavior remains otherwise unchanged.
12. Reuse the Google/Bing/Yandex navigation identities and bounded transient
    `page.goto` retry policy established by Task 02. This packet may remove
    obsolete legacy call sites but must not fork provider-specific backoff or
    permit any navigation service to replay post-insertion text.
13. Add `shutdownAllTranslationProviders()` to application quit cleanup. It
    must attempt every provider even when one close fails and log only safe
    provider/outcome metadata.
14. On a validated CloakBrowser settings save, close all translation contexts
    before the candidate becomes durable. A close failure returns a safe save
    failure and does not persist the new browser settings. Rejected browser
    settings do not needlessly touch translation contexts.
15. A terminal contract failure closes only the affected provider. A later
    manual hotkey operation may lazily create that provider again; no automatic
    provider switch occurs.
16. Add locale-parity error/status text for unsupported provider/language,
    over-limit input, navigation/connection, consent/challenge, page-contract
    change, result timeout/empty result, stale/cancelled action, and cleanup
    failure. Messages contain no raw provider response or URL.

## Contracts And Boundaries

- Selected text and result are sensitive from clipboard read through provider
  cleanup. They exist only in memory and the chosen provider page; they never
  enter config, logs, persisted browser profiles, fixtures, IPC error text, or
  filenames.
- Main owns clipboard, registry, provider execution, cache, notification,
  browser lifecycle, and settings snapshots.
- Translation contexts are nonpersistent and separate from voice sessions but
  reuse validated user CloakBrowser proxy/locale/timezone/fingerprint/
  background/humanization settings.
- Direct IPC remains trusted-sender validated and cannot become a settings
  bypass.
- Clearing/closing is not described as deleting provider-side or browser
  history data.

## Expected Files Or Components

- Refactor:
  - `src/main/services/translation.ts`;
  - `src/main/services/selectedTextTranslation.ts`;
  - `src/main/browser.ts`;
  - `src/main/main.ts`;
  - CloakBrowser settings save handling in `src/main/ipc.ts`;
  - matching locale dictionaries.
- Remove obsolete Google-only exports from
  `src/main/services/translationUtils.ts` when no longer used; retain only
  genuinely generic helpers under a provider-neutral name.
- Update the compatibility IPC implementation without changing its preload/
  renderer signature.
- Reuse without normally changing
  `src/main/browserNavigationRetry.ts`; update only provider navigation call
  sites and its tests if integration exposes a verified shared-policy defect.
- Extend:
  - `tests/main/selectedTextTranslation.test.ts`;
  - `tests/main/browserNavigationRetry.test.ts`;
  - browser startup/shutdown and CloakBrowser settings save tests.
- Add a focused registry-backed translation-service test if orchestration is
  not cleanly covered by existing files.

## Acceptance Criteria

- Existing empty-selection, Linux fallback, clipboard recovery, success,
  cache, and duplicate-action tests continue to pass.
- New selected-text tests prove provider and contract version are cache
  dimensions; target remains a dimension; failures/cleanup failures are not
  cached; and one provider cannot satisfy another.
- Unknown provider/target and over-limit input create zero provider instances
  and zero browser contexts.
- Settings changes during copy/provider execution do not change the current
  request.
- Legacy Google translator state and functions no longer exist in the
  persistent background browser.
- Task 06's legacy Google target bridge is gone, and no code path can combine a
  selected provider with the compatibility Google route.
- Voice-provider startup, restart, switching, and shutdown tests remain
  unchanged except for removal of translator coupling.
- Application quit and successful CloakBrowser settings changes close every
  translation provider; failures are safe and bounded.
- Direct translation IPC cannot override authoritative provider or target.
- Runtime source/log scan finds no selected text, result text, source-bearing
  URL, raw Playwright error, cookie, storage value, or response body.

## Verification

Run at least:

```text
node --import tsx --test tests/main/selectedTextTranslation.test.ts tests/main/browserNavigationRetry.test.ts tests/main/browserSessionStartup.test.ts tests/main/translateProviders/*.test.ts
npm run typecheck
npm run test:types
npm run lint
npm run format:check
```

Run every focused IPC, CloakBrowser settings, app-shutdown, and browser
lifecycle test modified or added by this packet. Do not run a live provider.

## Failure And Rollback

- Clipboard mutation before cleanup success, a cache collision, persistent
  translator state, post-submit replay, or unsafe logging blocks the packet.
- Rollback restores the legacy Google routing and browser state while leaving
  provider classes/settings dormant. It must not partially route some hotkeys
  through the new registry.
- If a provider shutdown fails, retain ownership for quit cleanup and surface a
  typed failure; do not drop the reference or claim success.

## Manual Gates

- Live Google/Bing/Yandex canaries are deferred to Task 11.
- No real selected text, user's config/profile, dependency, package, commit,
  push, pull request, issue, or release operation is authorized.

## References

- Mandatory:
  - `src/main/services/selectedTextTranslation.ts` and its tests;
  - `src/main/services/textActionCache.ts`;
  - `src/main/browser.ts` and browser-startup tests;
  - `src/main/main.ts` quit cleanup;
  - CloakBrowser settings save handler;
  - Tasks 02–06 contracts.
- Traceability:
  - approved specification “Translation Operation Requirements”, “Security and
    Privacy Requirements”, and “Compatibility and Failure Behavior”;
  - decisions `current.selected-text-flow`,
    `normal-flow.selection-side-effects`,
    `failure.input-limit`, and
    `failure.submission-replay`.

## Completion And Handoff

- Mark Task 07 complete in `todo.md`.
- Update `handoff.md` with snapshot/cache schema, removed legacy browser state,
  shutdown hooks, error keys, exact checks, and Task 08 as next.
- Present deterministic runtime evidence and stop. Do not commit, run a live
  canary, or begin Task 08 in the same invocation.
