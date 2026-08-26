# 11 Shared Translation Browser Context

## Outcome

Translation owns one main-process in-memory browser context and at most one page. A
provider-ID switch replaces that page and clears Translation-site session state before
initializing the selected provider; same-provider work retains its warm page.

## Prerequisites

- Packets 01–05 and 07–10 are complete; Packet 10 is committed as `6a918dd`.
- The approved shared-context and session-reset decisions are recorded in the ledger.

## Owned Requirements

- `ARCH-011`, `CONC-010`, `LIFE-010`, `FAIL-012`, `SEC-011`, `ACC-026`
- Updates to `ARCH-004`–`ARCH-006`, `CONC-002`, `LIFE-001`–`LIFE-002`,
  `SEC-006`, `COMP-006`, and `ACC-018`

## In Scope

- Add one injected main-process Translation browser-resource coordinator.
- Move browser context/page, shared queue, generation/identity, and quarantine
  ownership from individual provider instances to that coordinator.
- Replace a page only when the provider ID changes; preserve same-provider warm reuse.
- Clear Translation context cookies, permissions, HTTP cache, and canonical provider
  origin storage through a blank temporary control page after the old page closes.
- Preserve lifecycle, cancellation, timeout, Google copy-then-keyboard-clear,
  existing inline switch state, and typed connection-state behavior.

## Out Of Scope

- Renderer, preload, IPC, settings, persistence, provider contract versions,
  dependencies, packaging, user profile persistence, live provider use, commits,
  pushes, releases, or platform manual testing.

## Task Contract

1. The coordinator is constructed in `MainProcessCompositionRoot` with the existing
   CloakBrowser settings, translation context-options factory, and context launcher.
   Provider factory creation injects that one coordinator into Google, Bing, and Yandex.
2. The coordinator owns one global asynchronous queue, one lazy context, one active
   page, the active provider/page lease identity, and one quarantined closing context.
   A provider class retains only provider DOM behavior and local operation generation.
3. Same-provider initialization, target-language selection, and translation reuse the
   healthy active page. A provider-ID change waits behind shared work, closes the old
   page, clears session state with a temporary blank page, closes that page, and only
   then creates a fresh selected-provider page.
4. Session reset calls Playwright cookie and permission clearing plus CDP cache and
   `Storage.clearDataForOrigin` for `https://translate.google.ru`,
   `https://www.bing.com`, and `https://translate.yandex.com`. It never records or
   forwards browser/session data.
5. Page close is attempted before context close. Failure, stale page creation, or an
   unconfirmed session reset closes/quarantines the captured context and blocks new
   Translation work until it settles. No replacement context may overlap it.
6. Request-level cleanup closes only the affected page when possible and retains the
   healthy shared context. CloakBrowser settings reset and application shutdown close
   the shared context exactly once; later settings use a new context with current
   options.
7. No late completion can touch a newer provider page/context, clipboard, cache,
   notification, successful diagnostics, connection state, or terminal audit.

## Contracts And Boundaries

- Browser, CDP, session, queue, and lifecycle ownership stays in Electron main.
- `TranslationProviderFactory` and Base-provider dependencies change only internally.
- No cookie, storage, URL, page content, account state, selected text, or result text
  is logged, placed in tests, diagnostics, or IPC.
- Linux and Windows use the same Playwright/CDP sequence; no OS keyboard automation
  or new external browser request is introduced.

## Expected Files Or Components

- `src/main/translateProviders/TranslationBrowserResourceCoordinator.ts`
- `BaseTranslateProvider`, Translation provider factory/registry, and composition root
- Focused shared-coordinator, Base Provider, provider registry, provider, lifecycle,
  runtime, selected-text, switch-status, and performance tests

## Acceptance Criteria

- Google → Bing → Yandex has one retained context, one active page maximum, fresh page
  replacement on each switch, and no same-provider replacement.
- Session reset is ordered old-page close → control page → clear state → control-page
  close → fresh provider page; a failure never opens a new provider page in uncertain
  state.
- Queued cross-provider work, cancellation, timeout, stale `newPage()`, reset,
  shutdown, hanging/failed closes, and late cleanup preserve one terminal outcome and
  identity-safe resource ownership.
- Existing Google delivery/keyboard-clear and Bing/Yandex clear contracts remain
  covered, including no post-Backspace inspection and no regression in warm reuse.

## Verification

- Run focused shared-coordinator, Base Provider, Google/Bing/Yandex, registry,
  lifecycle, runtime, selected-text, shortcut/tray, settings-switching, and controlled
  performance tests.
- Run `npm run typecheck`, `npm run test:types`, scoped ESLint/Prettier, `npm test`,
  and `git diff --check`.
- If `diagnosticsArchive.test.ts` again remains idle, record the stopped full-suite
  run without claiming a complete full gate.

## Failure And Rollback

- Revert only shared Translation resource ownership and Packet 11 documentation/tests.
  The prior per-provider context behavior is recoverable without data migration.
- Never bypass quarantine or clear only part of a failed session reset to obtain reuse.

## Manual Gates

- Linux and Windows packaged checks for one context/page, provider-switch session
  reset, consent/login reappearance, same-provider warm reuse, and failed cleanup
  recovery remain in Packet 06. Do not use credentials or private text.

## References

- Specification: `ARCH-011`, `CONC-010`, `LIFE-010`, `FAIL-012`, `SEC-011`,
  `ACC-026`.
- Existing lifecycle: `BaseTranslateProvider` and `translationOperationLifecycle`.

## Completion And Handoff

- Mark Packet 11 complete only after focused checks and all applicable quality gates.
- Update this workstream's `todo.md`, `handoff.md`, decision ledger, and Packet 06
  manual gates. Leave Packet 11 uncommitted for review.
