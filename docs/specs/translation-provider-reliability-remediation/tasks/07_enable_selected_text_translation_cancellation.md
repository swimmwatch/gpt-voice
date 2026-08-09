# 07 Enable Selected-Text Translation Cancellation

## Outcome

The existing configured Cancel hotkey cancels only the current selected-text
Translation workflow. Caller cancellation reaches the shared translation lifecycle,
waits for its existing bounded cleanup, restores the workflow's captured clipboard,
and emits the established renderer cancelled status without an OS notification.

## Prerequisites

- Packets 01–05 are committed as `e1fe686`, `de5ec2e`, `02fbd227`, `1ca2f81e`, and
  `d43fcc70`.
- The user explicitly authorized this packet through the approved Translation Provider
  Cancellation plan; `decisions.yaml` records `execution.packet-07`.

## Owned Requirements

- `CONC-008`
- `FAIL-009`
- `SEC-010`
- `ACC-022`

## In Scope

- One operation-owned caller `AbortController` for selected-text Translation.
- Linking its signal to `TranslationRuntime` and the existing 60/15/5-second lifecycle.
- Cancellation precedence, clipboard restoration, audit, and side-effect safety.
- Existing Cancel-hotkey routing and existing cancelled renderer status.
- Deterministic unit/runtime/shortcut coverage and the required quality checks.

## Out Of Scope

- New renderer controls, preload methods, IPC channels, settings, persisted data,
  provider adapters, contract-version changes, dependencies, packaging, live provider
  access, credentials, commits, pushes, releases, or direct `translate-text` IPC
  cancellation.

## Task Contract

1. `SelectedTextTranslationService` owns at most one active operation. Its public
   `cancel()` is idempotent, returns `true` only for the first active cancellation,
   and never cancels a direct IPC translation or another service instance.
2. Pass the operation signal only through the internal `translateWithSnapshot()` call.
   The runtime creates its existing lifecycle with that signal and, when it is already
   cancelled, settles its no-resource cleanup and returns before registry lookup or
   provider submission.
3. When caller cancellation wins after dispatch, the runtime returns discardable
   `cancelledOrStaleOperation` marked internally as caller-owned, emits one sanitized
   cancelled audit terminal, and suppresses diagnostic-success and connection-state
   effects. A reset, shutdown, or stale winner remains unmarked and silent.
4. The selected-text workflow returns `{ cancelled: true, success: false }` only for
   caller-owned cancellation. It restores its captured prior clipboard exactly once;
   it never writes a result/cache entry, notifies success or failure, captures success
   diagnostics, or overrides a stale/reset clipboard outcome.
5. The current Cancel shortcut priority remains Voice recording, then Prettify, then
   Translation. Translation cancellation does not send a separate notification; the
   already running Translation hotkey promise emits exactly one `translation/cancelled`
   renderer status after its `working` status.

## Contracts And Boundaries

- All cancellation state and browser/lifecycle authority remain in Electron main.
- The existing cross-platform global-shortcut abstraction and Node/Electron
  `AbortController` are used; no worker, lock, blocking wait, or platform-specific
  branch is introduced.
- The internal caller-cancellation marker is never exposed through renderer, preload,
  IPC, audit metadata, logs, diagnostics, or persisted data.
- Selected text, result text, clipboard contents, provider pages, URLs, credentials,
  cookies, sessions, and raw errors remain absent from logs, test names, and evidence.

## Expected Files Or Components

- `src/main/services/selectedTextTranslation.ts`
- `src/main/services/selectedTextTranslationOperation.ts`
- `src/main/services/translation.ts`
- `src/main/shortcuts.ts`
- `src/main/translateProviders/translationProviderContracts.ts`
- Focused main-process tests and this workstream's specification, decision, plan,
  checklist, and handoff artifacts.

## Acceptance Criteria

- A pre-cancelled caller causes no provider registry lookup or submission.
- Cancellation before dispatch and after submission restores the prior clipboard and
  produces no result/cache/notification/diagnostic-success effect.
- A late provider success is discarded with one audit terminal and no connection-state
  overwrite; cleanup still follows the existing lifecycle budget/quarantine rules.
- Repeated Cancel is harmless; the selected-text gate stays occupied until the active
  runtime promise settles. Reset-first work stays skipped and does not restore data.
- Direct `translate-text` retains its existing behavior after selected-text cancellation.

## Verification

```text
node --import tsx --test tests/main/selectedTextTranslation.test.ts tests/main/translationRuntime.test.ts tests/main/shortcuts.test.ts tests/main/shortcutController.test.ts
npm run typecheck
npm run test:types
npx eslint src/main/services/selectedTextTranslation.ts src/main/services/selectedTextTranslationOperation.ts src/main/services/translation.ts src/main/shortcuts.ts src/main/translateProviders/translationProviderContracts.ts tests/main/selectedTextTranslation.test.ts tests/main/translationRuntime.test.ts tests/main/shortcuts.test.ts tests/main/shortcutController.test.ts tests/main/mainProcessApplication.test.ts
npx prettier --check src/main/services/selectedTextTranslation.ts src/main/services/selectedTextTranslationOperation.ts src/main/services/translation.ts src/main/shortcuts.ts src/main/translateProviders/translationProviderContracts.ts tests/main/selectedTextTranslation.test.ts tests/main/translationRuntime.test.ts tests/main/shortcuts.test.ts tests/main/shortcutController.test.ts tests/main/mainProcessApplication.test.ts docs/specs/translation-provider-reliability-remediation/decisions.yaml docs/specs/translation-provider-reliability-remediation/spec.md docs/specs/translation-provider-reliability-remediation/tasks/06_qualify_supported_packaged_platforms.md docs/specs/translation-provider-reliability-remediation/tasks/07_enable_selected_text_translation_cancellation.md docs/specs/translation-provider-reliability-remediation/tasks/plan.md docs/specs/translation-provider-reliability-remediation/tasks/todo.md docs/specs/translation-provider-reliability-remediation/tasks/handoff.md
git diff --check
```

## Failure And Rollback

- Any additional IPC/preload/renderer/settings/persistence/provider contract surface,
  visible late result, duplicate audit terminal, clipboard overwrite after reset-first
  invalidation, unbounded cleanup, or sensitive test/log data fails this packet.
- Revert only the isolated Packet 07 files as one coherent change; do not alter the
  completed lifecycle packets or unrelated worktree changes.

## Manual Gates

- No live provider, browser session, credential, package, release, external system,
  commit, push, or pull request action is authorized.
- Linux/Windows packaged cancellation confirmation is deferred to Packet 06.

## References

- `../spec.md`: “Concurrency and Terminal Arbitration,” “Failure and User-Visible
  Behavior,” “Security and Privacy,” and `ACC-022`.
- `docs/agent-guides/project-conventions.md`: “Electron And Providers,” “Dependency
  Injection And Runtime Ownership,” “Tests And Documentation,” and “Git And Releases.”

## Completion And Handoff

- Mark Packet 07 complete only after all deterministic checks pass.
- Update `todo.md` and `handoff.md` with checked commands, changed files, the later
  Packet 06 manual gate, and any blocker.
- Leave Packet 07 uncommitted and stop for review.
