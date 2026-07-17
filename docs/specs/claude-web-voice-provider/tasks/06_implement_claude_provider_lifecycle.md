# 06 Implement The Claude Web Provider Lifecycle

## Outcome

A complete but not yet registered ClaudeWebVoiceProvider implements isolated
browser-session persistence, authenticated readiness, organization discovery,
batch transcription, cache context, clipboard behavior, and leak-free shutdown.

## Prerequisites

- Tasks 03-05 are complete and approved.
- Task 02 Gate A remains valid for the implemented browser/runtime version.

## In Scope

- ClaudeWebVoiceProvider metadata and browser-session lifecycle.
- Claude navigation retry classification.
- Save/load/clear session, initialize page, and page/session readiness.
- Audio validation, transient organization discovery, page transport, result
  parsing, clipboard write, cache context, and shutdown.
- Deterministic provider tests with injected settings/session/page/transport
  dependencies.

## Out Of Scope

- Provider registry, settings IPC/UI, streaming IPC, auto-reconnect, live CI
  requests, or organization chooser.
- Copying access tokens, inventing a dummy access token, or importing research
  browser state.

## Task Contract

1. Provider info uses ID claude-web, name Claude Web, authType browserSession,
   and login URL https://claude.ai.
2. Add Claude to the browser-navigation retry service taxonomy and use the
   existing bounded navigation retry behavior.
3. initPage configures only safe resource blocking, navigates to Claude, and
   establishes enough authenticated application state for session and
   organization checks.
4. saveSession/loadSession/hasSession/clearSession delegate to the Task 03
   contracts and never share ChatGPT storage.
5. Override isReady using page presence plus validated Claude session/
   organization readiness. Never set or require BaseVoiceProvider.accessToken.
6. transcribe validates/extracts WAV PCM, reads the current explicit language,
   derives and validates the organization transiently, and invokes a fresh Task
   05 transport operation.
7. Compressed renderer fallback input returns an actionable invalid-audio
   category. Do not add conversion or silently send it.
8. A successful non-cached result writes the finalized text to the clipboard
   exactly once, matching current provider behavior. The transcription service
   continues to own cache/history orchestration.
9. getTranscriptionCacheContext includes language, protocol-contract version,
   and other result-affecting stable constants only. It excludes organization,
   session, account, URL, and browser identifiers.
10. No mid-stream reconnect or replay retry is added. Only a future proven
    duplicate-safe retry may change this contract.
11. shutdown first cancels/drains transport work, closes timers/sockets, then
    clears page/context references through the base lifecycle.
12. Map internal settings/session/audio/transport failures to stable error codes
    for Task 07 localization. Raw Playwright/WebSocket messages are safe-log
    metadata only after sanitization.
13. Treat account scope as private classification metadata, separate from the
    transient resolved organization UUID. `unknown` scope is ready when routing
    is resolved; `personal` and `organization` use the same routing path in
    Phase 1.
14. Never infer or log scope from organization count/order, display name,
    subscription/plan labels, or identifier shape. Do not expose scope through
    provider info, transcription results, cache context, or renderer contracts.

## Architecture And File Boundaries

- Add src/main/providers/ClaudeWebVoiceProvider.ts.
- Add tests/main/providers/ClaudeWebVoiceProvider.test.ts.
- Update src/main/browserNavigationRetry.ts.
- Update tests/main/browserNavigationRetry.test.ts.
- Do not edit src/main/providers/index.ts yet.
- Keep src/main/services/transcription.ts and renderer recording/IPC unchanged.

## Acceptance Criteria

- Fresh, restored, missing, expired, malformed, and cleared sessions are
  deterministic in tests.
- Readiness succeeds with a valid page/session and no access token.
- Organization ambiguity fails before a socket opens and exposes no metadata.
- Multi-organization active-state resolution succeeds with `unknown` scope,
  while missing/ambiguous routing still fails. Scope alone never opens or
  blocks a socket.
- Valid WAV reaches the transport as raw PCM; invalid/compressed audio does not.
- Successful final text is written once and returned once.
- Cache context changes with language/protocol version but never account state.
- Timeout, connection, empty-result, cancellation, provider-switch, and
  shutdown paths release all operations.
- Browser navigation retries classify Claude separately.

## Verification

- node --import tsx --test tests/main/providers/ClaudeWebVoiceProvider.test.ts tests/main/browserNavigationRetry.test.ts
- node --import tsx --test tests/main/providers/claudeWebAudio.test.ts tests/main/providers/claudeWebProtocol.test.ts tests/main/providers/claudeWebPageTransport.test.ts
- npm run typecheck
- npm run test:types
- Scan logs and fixtures for URLs, UUIDs, cookies, audio, transcripts, and raw
  provider responses.

## References

- Mandatory: public contracts from Tasks 03-05.
- Mandatory precedent: BaseVoiceProvider and ChatGPTVoiceProvider lifecycle
  methods named in this packet.
- Optional traceability: Claude Web Requirements 1-17, Resolved Product
  Decision 7, and Claude Web success criteria.

## Completion And Handoff

- Update todo.md and handoff.md with lifecycle behavior, changed files, checks,
  and any manual verification still required.
- Set 07_localize_claude_voice.md as the next packet.
- Present the unregistered provider tests for review and stop. Do not commit
  this packet or register the provider in the same invocation.
