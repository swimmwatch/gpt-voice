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

## Deferred Windows And CI Gate

- Run only the listed Verification commands on the Linux development host. Do not push or inspect CI in this packet.
- Packet 17 runs every deferred Windows UI, accessibility, translation, and IPC check; Packet 18 owns fixes and reruns.
- Record local results in `handoff.md` without claiming Windows coverage; the next numbered packet becomes
  executable after local review.

## Failure And Rollback

- Any value crossover, hidden stale error, keyboard/focus regression, missing translation contract, or validation
  disagreement rejects the packet.
- Rollback removes renderer presentation changes but must not silently discard persisted schema-v2 GPU values.

## Manual Gates

- `MANUAL GATE`: review the control with keyboard-only navigation and a screen reader on the representative Linux
  desktop, then repeat the Windows end-to-end UI check on the regular Windows computer in Packet 17. Translation
  review must use project-approved language sources; do not invent unreviewed translations.

## References

- Specification Sections 9.1 and 9.3; AC-AUT-012.
- `docs/agent-guides/project-conventions.md` Sections “Electron And Providers” and “Tests And Documentation.”

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with UI/accessibility/translation checks and Packet 11 as the
next ordered packet, then stop for review.
