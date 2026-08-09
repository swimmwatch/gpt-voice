# 08 Show Translation Tray Activity

## Outcome

A cache-miss selected-text Translation provider run changes the existing desktop tray
to the already packaged `processing` icon only while provider work is active. Its
accepted terminal outcome, including bounded cancellation cleanup, restores the current
recording-derived tray state.

## Prerequisites

- Packet 07 is committed as `80f801a`.
- The user approved this packet through `execution.packet-08` revision 2 in
  `../decisions.yaml`.

## Owned Requirements

- `UX-001`
- `ACC-023`

## In Scope

- A main-process-only selected-text Translation run observer.
- Existing `processing` tray presentation from provider-run start through terminal
  resolution.
- Deterministic selected-text and shortcut tests, workstream contract, and later
  supported-platform manual confirmation.

## Out Of Scope

- New tray assets or states, renderer, preload, IPC, settings, persisted data,
  provider adapters, direct `translate-text` IPC behavior, dependencies, packaging,
  live providers, credentials, commits, pushes, releases, or Packet 06 execution.

## Task Contract

1. `SelectedTextTranslationService.translateSelectedTextToClipboard()` accepts one
   optional main-process observer. It calls `onTranslationStarted()` once only after
   selected-text validation has succeeded and the translation cache has missed, just
   before it invokes `translateWithSnapshot()`.
2. The observer is fail-open: a duplicate start request or observer exception cannot
   alter cancellation, lifecycle, clipboard, cache, notification, audit, connection,
   or result behavior. Its sanitized logger metadata contains no selected/result text
   or raw error details.
3. `ShortcutController` passes an observer from the configured Translation hotkey.
   On its first start it changes the tray to `processing`; when the same result promise
   settles it sends the established terminal status and restores the recording-derived
   tray state. A caller Cancel does not reset the icon before the operation resolves.
4. Invalid selection, unsupported input, selected-text cache hit, skipped action,
   pre-provider cancellation, and direct `translate-text` IPC do not activate the
   Translation presentation observer or alter the tray. Existing voice and Prettify
   tray behavior remains authoritative.

## Contracts And Boundaries

- Electron main owns the shortcut, tray, selected text, provider lifecycle, and
  observer; no renderer privilege or IPC surface changes.
- Reuse the existing packaged `processing` tray state; do not add assets or platform
  branches. Restoring the recording-derived state preserves Linux/Windows behavior and
  existing recording/transcription precedence.
- No log, test name, document, or manual evidence contains selected text, translated
  text, provider pages, URLs, credentials, or raw observer errors.

## Expected Files Or Components

- `src/main/services/selectedTextTranslation.ts`
- `src/main/services/selectedTextTranslationOperation.ts`
- `src/main/shortcuts.ts`
- `tests/main/selectedTextTranslation.test.ts`
- `tests/main/shortcutController.test.ts`
- This workstream's specification, decision ledger, plan, checklist, handoff, and
  Packet 06 manual gate.

## Acceptance Criteria

- A deferred cache-miss provider operation produces `processing` then the idle tray
  state after success; terminal failure, timeout, and caller cancellation also restore
  it exactly once after their promise settles.
- The Cancel hotkey leaves `processing` visible until the active Translation promise
  settles, then emits only the existing cancelled renderer status and resets the tray.
- Cache hit, invalid input, skipped work, and pre-provider cancellation never change
  the tray. Direct IPC remains uninstrumented.
- Throwing or duplicate observer presentation does not fail, delay, or leak private
  data from Translation work.

## Verification

```text
node --import tsx --test tests/main/selectedTextTranslation.test.ts tests/main/shortcutController.test.ts tests/main/shortcuts.test.ts
npm run typecheck
npm run test:types
npx eslint src/main/services/selectedTextTranslation.ts src/main/services/selectedTextTranslationOperation.ts src/main/shortcuts.ts tests/main/selectedTextTranslation.test.ts tests/main/shortcutController.test.ts tests/main/shortcuts.test.ts
npx prettier --check src/main/services/selectedTextTranslation.ts src/main/services/selectedTextTranslationOperation.ts src/main/shortcuts.ts tests/main/selectedTextTranslation.test.ts tests/main/shortcutController.test.ts tests/main/shortcuts.test.ts docs/specs/translation-provider-reliability-remediation/decisions.yaml docs/specs/translation-provider-reliability-remediation/spec.md docs/specs/translation-provider-reliability-remediation/tasks/06_qualify_supported_packaged_platforms.md docs/specs/translation-provider-reliability-remediation/tasks/08_show_translation_tray_activity.md docs/specs/translation-provider-reliability-remediation/tasks/plan.md docs/specs/translation-provider-reliability-remediation/tasks/todo.md docs/specs/translation-provider-reliability-remediation/tasks/handoff.md
git diff --check
```

## Failure And Rollback

- A tray change before provider work, after terminal settlement, from direct IPC, or a
  new public/packaging surface fails this packet. Revert only the Packet 08 files;
  retain the committed cancellation lifecycle and unrelated worktree changes.

## Manual Gates

- Linux and Windows packaged tray confirmation belongs to Packet 06. Do not launch a
  provider, access credentials, package, publish, or commit while executing this packet.

## References

- `../spec.md`: “Translation Activity Presentation” and `ACC-023`.
- `docs/agent-guides/project-conventions.md`: “Electron And Providers,” “Dependency
  Injection And Runtime Ownership,” “Desktop, Browser, And Packaging,” and “Tests And
  Documentation.”

## Completion And Handoff

- Mark Packet 08 complete only after all deterministic verification passes.
- Update `todo.md` and `handoff.md` with changed files, checks, Packet 06 as the later
  manual gate, and any blocker.
- Leave Packet 08 uncommitted and stop for review.
