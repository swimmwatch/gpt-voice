# 08 Register The Claude Web Voice Provider

## Outcome

Claude Web becomes a selectable browser-session voice provider through the
existing provider registry and startup/switch lifecycle, using the default
en-US language until the typed settings UI packet is complete.

## Prerequisites

- Tasks 06-07 are complete and approved.
- Task 02 Gate A is still valid.

## In Scope

- Export and register ClaudeWebVoiceProvider.
- Verify available-provider metadata and factory behavior.
- Verify background startup, login, restore, switch, clear, readiness, and
  shutdown classification through existing generic browser ownership.
- Preserve existing ChatGPT Web and OpenAI API provider behavior.

## Out Of Scope

- New IPC channels, language editing UI, organization chooser, streaming IPC,
  renderer recorder changes, or live-provider CI.

## Task Contract

1. Add claude-web to the exhaustive provider registry only after its complete
   lifecycle and localized failures exist.
2. getAvailableProviders returns Claude Web with browserSession auth and the
   existing UI discovers it without provider-specific toolbar branches.
3. createProvider returns a fresh ClaudeWebVoiceProvider instance and rejects
   unknown IDs unchanged.
4. Existing initBackgroundBrowser, switchProvider, login, clear-session, and
   shutdown flows remain registry-driven. Change src/main/browser.ts only if a
   failing contract test proves a generic lifecycle defect.
5. Restored startup follows loadSession, initPage, and isReady in the current
   order and classifies missing/expired Claude auth safely.
6. Provider switching cancels/shuts down Claude transport work before releasing
   the browser context.
7. Default language is en-US and already participates in cache context; no
   settings IPC change is required in this packet.

## Architecture And File Boundaries

- Update src/main/providers/index.ts.
- Add tests/main/providers/providerRegistry.test.ts if no focused registry test
  exists.
- Add or update tests/main/browserSessionStartup.test.ts for generic restored
  startup and switch behavior.
- Avoid src/main/browser.ts changes unless the tests identify a generic bug.

## Acceptance Criteria

- Claude Web appears once with correct metadata.
- Factory, restored startup, login-needed, clear-session, switch, and shutdown
  paths pass with fakes.
- ChatGPT Web and OpenAI API registry/startup tests remain unchanged in
  behavior.
- No access token, organization value, session state, or live page is required
  by automated tests.

## Verification

- node --import tsx --test tests/main/providers/providerRegistry.test.ts tests/main/browserSessionStartup.test.ts
- node --import tsx --test tests/main/providers/ClaudeWebVoiceProvider.test.ts
- npm run typecheck
- npm run test:types

## References

- Mandatory: Task 06 ClaudeWebVoiceProvider public lifecycle.
- Mandatory precedent: src/main/providers/index.ts and generic browser startup
  call path.
- Optional traceability: Claude Web Requirements 1-3 and Claude Web success
  criteria.

## Completion And Handoff

- Update todo.md and handoff.md with registry/startup checks and manual login
  follow-up.
- Set 09_expose_claude_voice_settings.md as the next packet.
- Present the selectable default-language provider for review and stop. Do not
  commit this packet or begin settings UI work in the same invocation.
