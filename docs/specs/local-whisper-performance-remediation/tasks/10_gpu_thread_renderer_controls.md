# 10 GPU Thread Renderer Controls

## Outcome

Present one contextual advanced thread control that edits independent CPU and GPU values, validates the active
target, preserves draft state on switching, and remains keyboard- and screen-reader-usable in every supported UI
language.

## Prerequisites

- Packet 08 is complete and shared schema-v2 types expose separate `cpuThreads` and `gpuCpuThreads` fields.
- Existing renderer settings lifecycle, typed `window.electronAPI`, and translation ownership remain unchanged.

## Owned Requirements

SCP-002, CFG-004, MIG-003, UI-001, A11Y-001, AC-AUT-012.

## In Scope

- Renderer draft state, target switching, shared validation projection, inference settings section, translation
  keys, errors/hints, keyboard/focus behavior, and renderer tests.

## Out Of Scope

- A second visible GPU-only control, IPC redesign, native worker resolution, or settings migration logic.
- New dependencies, visual redesign outside the existing advanced control, or unrelated provider settings.

## Task Contract

1. Reuse the current control location and interaction. Label it `CPU threads` with CPU help on CPU target and
   `GPU CPU threads` with GPU-specific help on GPU target.
2. Maintain independent draft values. Switching targets restores the last valid/draft value for that target and
   never copies or clears the other target's value.
3. Display and accept `auto` or integers 1 through the current host logical-processor count. Renderer parsing and
   main/shared validation must agree exactly.
4. Attach errors only to the active target's field. Switching must not reveal a stale hidden error or silently lose
   a valid unsaved value.
5. Preserve predictable tab order, focus, input labeling, described-by relationships, keyboard editing, and save
   behavior. Announced labels/help/errors must identify the active target and valid range.
6. Add the necessary reviewed strings to every supported Local Whisper settings translation module; do not expose
   internal field names or rely on untranslated developer text.

## Contracts And Boundaries

- Renderer remains functional React and uses only `window.electronAPI`; no Node/Electron import is introduced.
- Shared candidate validation remains authoritative before save. The renderer does not gain host/process authority.
- No audio, transcript, path, or device-native identity is rendered or logged.

## Expected Files Or Components

- `src/renderer/localWhisper/LocalWhisperSettingsState.ts`
- `src/renderer/localWhisper/LocalWhisperSettingsLifecycle.ts`
- `src/renderer/localWhisper/components/LocalWhisperInferenceSections.tsx`
- `src/renderer/localWhisper/LocalWhisperSettingsPage.tsx` and CSS only if required by the existing control
- `src/main/i18n/localWhisperSettings/*.ts`
- `tests/renderer/localWhisper/LocalWhisperSettingsState.test.ts`
- Local Whisper presentation, UI-contract, and accessibility tests

## Acceptance Criteria

- AC-AUT-012 covers `auto`, boundaries, malformed input, target switches, save/reload, stale epochs, every label,
  translations, keyboard behavior, and focus/error association.
- Invalid values launch no worker; valid CPU/GPU values persist independently and reappear after target switches.
- No new renderer privilege or public IPC channel is introduced.

## Verification

- `npm run verify:local-whisper:ui`
- `npm run test:local-whisper:ipc`
- `npm run typecheck`
- `npm run test:types`
- `npm run format:check`

## CI Gate And Commit Discipline

- Task-specific CI commands are the complete Verification list above. Both performance aggregates must run the
  state, presentation, UI-contract, accessibility, translation, target-switch, and typed IPC fixtures; Windows UI
  contract execution must occur on `${{ vars.CI_WINDOWS_RUNNER }}`.
- Required checks for the exact pushed SHA: `Quality Gates`, `Local Whisper Performance (Linux)`, and
  `Local Whisper Performance (Windows)`.
- After local verification, stop for review and obtain explicit authorization for the implementation commit and
  push. Push the immutable implementation commit and wait until every required check reports `success`; every other
  conclusion is non-passing.
- Fix an actionable CI failure only in a later explicitly authorized invocation and a separate fix commit. Never
  amend or squash the implementation commit; push and rerun the same checks until green.
- Record implementation/fix SHAs, workflow run ID, check names, check-run URLs or IDs, and final results in
  `handoff.md`. Packet 11 remains blocked until the green result is reviewed.

## Failure And Rollback

- Any value crossover, hidden stale error, keyboard/focus regression, missing translation contract, or validation
  disagreement rejects the packet.
- Rollback removes renderer presentation changes but must not silently discard persisted schema-v2 GPU values.

## Manual Gates

- `MANUAL GATE`: review the control with keyboard-only navigation and a screen reader on the representative Linux
  desktop, then repeat the Windows end-to-end UI check on the regular Windows computer in Packet 14. Translation
  review must use project-approved language sources; do not invent unreviewed translations.

## References

- Specification Sections 9.1 and 9.3; AC-AUT-012.
- `docs/agent-guides/project-conventions.md` Sections “Electron And Providers” and “Tests And Documentation.”

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with UI/accessibility/translation checks and Packet 11 as the
next ordered packet, then stop for review.
