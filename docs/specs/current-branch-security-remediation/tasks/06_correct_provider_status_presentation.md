# 06 Correct Provider Status Presentation

## Outcome

Voice coordinator failures display one authoritative not-connected reason, and Voice, Translation, and Prettify
status indicators expose localized, non-duplicated explanations without changing the established single-level
layout or any provider, preload, or IPC contract.

## Prerequisites

- Packets 03, 04, and 05 are complete, reviewed, and committed.
- Packet 03 supplies bounded, contract-valid Prettify readiness.
- Packet 04 guarantees initial Voice and Translation readiness settles.
- Packet 05 preserves Translation subscriptions across reusable browser resets.
- Preserve every unrelated worktree change and the existing functional renderer composition.

## Owned Requirements

- `ARCH-003`
- `READY-005`
- `UX-001`, `UX-002`
- `COMP-005`
- `AC-AUTO-014`, `AC-AUTO-015`

## In Scope

- Authoritative Voice reason and sanitized failure state for provider-selection failures.
- Localized Voice, Translation, and Prettify status explanations.
- Accessible-name deduplication when a status label and tooltip are identical.
- Focused functional renderer, localization, accessibility, and locale-parity tests.

## Out Of Scope

- Provider readiness deadlines, HTTP response limits, Translation reset ownership, or browser warmup; Packets
  03–05 own those behaviors.
- Provider selection, authentication, transcription, translation, prettification, cache, clipboard, history,
  notification, or retry behavior.
- IPC channel names, payload keys, preload validation, renderer declarations, or main-process provider contracts.
- New status values, error payloads, dependencies, layout redesign, control-width changes, or animation changes.
- Live providers, browser sessions, credentials, private text/audio, Electron launches, packaging, commits, pushes,
  pull requests, or releases.

## Task Contract

1. For Voice `bootstrap-failed`, unsuccessful `switch-completed`, and `switch-failed` events:
   - set the closed reason to `PROVIDER_CONNECTION_REASONS.BrowserUnavailable`;
   - build one sanitized `RendererStatus` failure descriptor through the existing notification-error presenter;
   - store that descriptor in `providerConnectionFailureStatus`;
   - use the same descriptor for the central status/notification and the provider-status tooltip;
   - settle loading through the existing coordinator lifecycle without creating another provider action.
2. A later successful bootstrap or switch must replace the failed reason with the authoritative success/session reason
   and clear the stored failure descriptor. `switch-settled` must not overwrite the reason or resurrect a stale
   failure.
3. Provider-controlled errors remain behind the existing presentation/redaction boundary. Do not add raw errors,
   messages, stacks, URLs, paths, sessions, credentials, provider payloads, or diagnostic values to renderer state,
   accessibility text, notifications, logs, or tests.
4. Render every Translation connection explanation from the existing closed
   `TranslationProviderConnectionDetail`-to-locale-key mapping. Unknown or malformed main-to-renderer values remain
   rejected by the existing preload/shared validators rather than receiving free-form fallback text.
5. Present Prettify HTTP and CLI connection failures through the active `t` translator. Pass the translator into the
   existing error-presentation boundary where supported; use the English fallback only when localization itself is
   unavailable. Do not change the provider result or connection-state shape.
6. `ProviderStatusIndicator` must keep its visible label, focusable tooltip trigger, `status | alert` role, icon, and
   tooltip content. Its accessible name is:
   - the label once when trimmed label and tooltip text are identical;
   - the label followed by the tooltip when they differ.
7. Keep the status bands at one visual level and preserve adjacent-control geometry. Do not conditionally insert a
   second status row, change select widths, or make status length move neighboring controls.
8. Reuse existing locale keys when they express the closed reason. If a missing key is required, add the same key
   and placeholder contract to all eleven catalogs: `be`, `de`, `en`, `es`, `fr`, `hi`, `ja`, `pt-BR`, `ru`, `uk`,
   and `zh`. Do not invent or machine-generate translations.

## Contracts And Boundaries

- React/UI work remains functional: components, hooks, reducers, pure presentation functions, and functional state
  updates. Do not introduce a stateful renderer business class.
- Main remains the provider/browser owner. Renderer status correction uses only values already delivered through
  `window.electronAPI`.
- Trusted-sender validation and exact main/preload/renderer types remain unchanged.
- The stored Voice failure descriptor is renderer-owned presentation state, not a provider error or audit record.
- Audit emission remains fail-open and cannot alter status, provider actions, or startup settlement.
- Windows and Linux use the same renderer contract. macOS remains unit-owned while packaged distribution is paused.

## Expected Files Or Components

- `src/renderer/App.tsx`
- `src/renderer/providerState.ts` only if a pure state/presentation transition keeps coordinator behavior directly
  testable
- `src/renderer/components/MainToolbar.tsx`
- `src/renderer/components/MainPrettifyProviderBand.tsx`
- `src/renderer/components/ProviderStatusIndicator.tsx`
- `src/renderer/components/TranslateSection.tsx` only if the closed mapping needs a correction
- `src/main/i18n/{be,de,en,es,fr,hi,ja,pt-BR,ru,uk,zh}.ts` only when an existing key cannot express an approved
  reason
- `tests/renderer/providerState.test.ts`
- `tests/renderer/providerStatusIndicator.test.ts`
- `tests/renderer/mainPrettifyProvider.test.ts`
- `tests/renderer/mainPrettifyProviderBand.test.ts`
- `tests/renderer/translateSection.test.ts`
- `tests/main/i18n.test.ts`
- A focused `tests/renderer/providerStatusPresentation.test.ts` is allowed for end-to-end functional state and
  rendered localization assertions.

Do not change main IPC, preload, renderer declarations, shared provider result types, provider implementations, or
styles unless a failing layout-regression assertion proves an existing approved geometry is not preserved.

## Acceptance Criteria

- `bootstrap-failed`, unsuccessful `switch-completed`, and `switch-failed` each render not connected with the closed
  browser-unavailable reason and one sanitized explanation, never stale `Session missing` or `Checking` text.
- The central Voice failure status and tooltip are rendered from the same descriptor, and a later successful
  bootstrap/switch clears both the failure descriptor and browser-unavailable reason.
- Non-English rendered fixtures cover:
  - a bounded Prettify timeout/failure;
  - a Voice coordinator failure;
  - every Translation closed-detail category used by the main window;
  - English fallback only when the translation function cannot provide a value.
- All eleven locale catalogs remain key- and placeholder-aligned.
- Equal visible label and tooltip text occur once in the accessible name. Distinct label and tooltip text remain
  present in order without losing the visible label or focusable tooltip.
- Keyboard focus, `status | alert` roles, tooltip hover/focus behavior, reduced-motion behavior, single-level layout,
  and adjacent-control geometry remain covered.
- Primary provider results, provider selection, IPC payloads, cache, clipboard, history, notifications, and audit
  records remain unchanged.

## Verification

Run the focused renderer and localization checks first:

```bash
rtk proxy node --import tsx --test \
  tests/renderer/providerState.test.ts \
  tests/renderer/providerStatusIndicator.test.ts \
  tests/renderer/mainPrettifyProvider.test.ts \
  tests/renderer/mainPrettifyProviderBand.test.ts \
  tests/renderer/translateSection.test.ts \
  tests/renderer/providerStatusPresentation.test.ts \
  tests/main/i18n.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check
```

Omit the new focused test path only if its assertions are placed in the named existing suites. If shared provider
contracts or preload types change unexpectedly, stop and repair the scope conflict rather than expanding this
packet.

## Failure And Rollback

- A failure path that leaves a stale reason, exposes free-form provider data, duplicates an accessible name, or
  depends on English-only presentation blocks completion.
- Do not suppress accessibility assertions, weaken translation parity, or change the provider result to obtain a
  pass.
- Rollback is a scoped revert of renderer presentation state, localization, and focused tests. It requires no data,
  settings, cache, browser-session, or database migration.

## Manual Gates

Do not run the keyboard/focus/screen-reader smoke in this packet. Packet 10 owns `AC-MAN-005` on a representative
desktop build and must confirm one concise localized announcement, focusable tooltip behavior, and no adjacent
layout movement. Source inspection or mocked platform values cannot satisfy that gate.

## References

- Mandatory project guidance:
  [Electron And Providers](../../../agent-guides/project-conventions.md#electron-and-providers) and
  [Tests And Documentation](../../../agent-guides/project-conventions.md#tests-and-documentation).
- Specification anchors:
  [Voice and Prettify Status Presentation](../spec.md#voice-and-prettify-status-presentation),
  [Automated Provider and Renderer Tests](../spec.md#automated-provider-and-renderer-tests), and
  [Compatibility, Migration, and Rollback](../spec.md#compatibility-migration-and-rollback).
- Review evidence:
  [Finding 10](../../../reviews/2026-07-28-current-branch-code-security-review.md#10-voice-bootstrap-and-switch-failures-leave-misleading-tooltips)
  and optional improvements 1–2 in
  [Optional Improvements](../../../reviews/2026-07-28-current-branch-code-security-review.md#optional-improvements).

## Completion And Handoff

After all automated checks pass:

1. mark only Packet 06 complete in [todo.md](todo.md);
2. update [handoff.md](handoff.md) with changed files, concise check results, residual accessibility/platform risks,
   and Packet 07 as the exact next packet;
3. leave Packet 06 unstaged and uncommitted for review;
4. stop without running the native accessibility gate or starting Packet 07.
