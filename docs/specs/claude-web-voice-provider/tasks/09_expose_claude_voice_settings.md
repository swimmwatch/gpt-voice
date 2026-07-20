# 09 Expose Typed Claude Voice Settings

## Outcome

The existing provider-settings flow exposes Claude login, clear-session, saved
session state, explicit BCP-47 language, and a one-click locale suggestion
through trusted typed IPC without exposing organization data.

## Prerequisites

- Task 08 registered a working default-language Claude provider.
- Task 03 settings persistence and Task 07 localized labels/errors are stable.

## In Scope

- A discriminated Claude browser-session settings view/input.
- Existing get/save/clear provider-settings IPC behavior for Claude language.
- Preload and renderer declaration alignment.
- ProviderSettingsModal language control and explicit locale suggestion.
- Provider settings view-state tests and typed contract checks.

## Out Of Scope

- New IPC channels, organization chooser, account metadata, private query
  controls, endpoint controls, streaming audio, or browser-profile selection.
- Personal/organization scope labels, scope selection, or exposing the private
  account-scope union to the renderer.

## Task Contract

1. Extend ProviderSettings with a Claude-specific discriminant containing
   providerId claude-web, authType browserSession, hasSession, and language.
2. Extend saveProviderSettings input narrowly for Claude language while
   preserving OpenAI API settings and generic browser-session behavior.
3. Reuse the existing trusted IPC handler wrapper and sender validation. Update
   main, preload, and renderer declarations together.
4. Main validates/canonicalizes through Task 03 storage and returns the saved
   view. It never accepts organization IDs, arbitrary endpoint/query values, or
   session data from the renderer.
5. ProviderSettingsModal retains login/relogin and clear-auth behavior and shows
   a labeled BCP-47 language field only for claude-web.
6. The current app/browser locale is offered as an explicit suggestion action;
   it does not mutate the field or persisted setting without user action/save.
7. Saving language updates subsequent provider cache context and
   transcriptions without requiring the renderer to access the provider or
   filesystem directly.
8. Validation/dirty state remains stable when switching between ChatGPT,
   Claude, and OpenAI API provider settings.
9. The UI never displays organization/account metadata and never logs the
   language field together with session details.
10. Keep account-scope classification main-only in Phase 1. The generic saved-
    session state must work for resolved `personal`, `organization`, and
    `unknown` classifications without revealing or persisting the distinction.

## Architecture And File Boundaries

- Update src/main/ipc.ts.
- Update src/main/preload.ts.
- Update src/renderer/types.d.ts.
- Update src/renderer/components/ProviderSettingsModal.tsx.
- Update src/renderer/providerSettingsViewState.ts.
- Update tests/renderer/providerSettingsViewState.test.ts and focused IPC/type
  tests if current coverage is insufficient.

## Acceptance Criteria

- Main/preload/renderer provider-settings contracts compile and agree.
- en-US loads by default and a saved valid tag survives restart.
- Invalid tags fail with a localized actionable message and are not persisted.
- Locale suggestion requires explicit user action and save.
- Login, relogin, clear-session, provider switch, and non-Claude settings
  behavior are unchanged.
- Organization identifiers and private endpoint controls are absent from the
  renderer contract and UI.
- No personal/organization scope field or label crosses typed IPC; adding one
  requires the future research/spec gate.
- Keyboard labels, error association, focus behavior, and 200 percent zoom are
  manually checked.

## Verification

- node --import tsx --test tests/renderer/providerSettingsViewState.test.ts
- npm run typecheck
- npm run test:types
- npm test
- Manual settings-window check at narrow width and 200 percent zoom in every
  supported locale.

## References

- Mandatory: Task 03 settings contract and Task 07 translation keys.
- Mandatory: typed IPC project conventions.
- Optional traceability: Resolved Product Decisions 1 and 7 and Settings/UI
  Requirements 1-9.

## Completion And Handoff

- Update todo.md and handoff.md with typed boundaries, checks, and manual UI
  findings.
- Set 10_define_cli_prettify_contracts.md as the default next packet.
- Present the complete Claude Web user flow for the planned review checkpoint
  and stop. Do not commit this packet or begin CLI work in the same invocation.
