# 03 Define Claude Settings And Session Contracts

## Outcome

Pure, tested contracts own Claude language validation, private settings/session
persistence, minimum usable-session checks, and deterministic active-
organization resolution with a future-compatible private account-scope state,
without persisting account identifiers.

## Prerequisites

- Task 02 completed with approved Gate A.
- The Task 01 research record states the minimum storage categories and active-
  organization signal.

## In Scope

- Define the claude-web provider ID and Claude-specific non-secret settings.
- Validate and canonicalize an explicit BCP-47 language with en-US default.
- Store Claude settings and browser state separately from ChatGPT and encrypted
  API settings.
- Validate restored session usability from the minimum researched state.
- Resolve one active organization from authenticated application evidence and
  validate it against eligible organizations.
- Define organization routing separately from the private account-scope
  classification `personal | organization | unknown`.
- Return typed safe failure categories for missing, expired, feature-
  unavailable, and ambiguous states.

## Out Of Scope

- WebSocket audio, protocol parsing, page transport, provider registration, IPC,
  or renderer controls.
- Persisting organization IDs, organization names, account metadata, tokens, or
  a user organization chooser.
- Discovering a personal-scope signal or implementing personal-specific
  behavior, copy, routing, settings, or UI.
- Importing any Chrome MCP profile or HAR value.

## Task Contract

1. Add Claude settings with one persisted language field. Empty or absent input
   normalizes to en-US; invalid BCP-47 input is rejected; valid tags are
   canonicalized consistently.
2. A browser/app locale helper may return a one-click suggestion, but it must
   never silently overwrite the persisted language.
3. Language is non-secret and is the only result-affecting Claude setting in
   this packet.
4. Use provider-specific files under APP_DIR with restrictive permissions.
   Claude session state must never share the ChatGPT session/token files.
5. Persist only the researched minimum browser storage state. Never persist the
   active organization selected for a request.
6. Session readers treat malformed JSON, expired required cookies, missing
   required origin state, and unsupported schema versions as unusable without
   leaking values.
7. Organization resolution accepts sanitized application evidence and eligible
   organizations, returns exactly one validated active ID transiently, and
   returns typed missing/ambiguous errors otherwise. It must not use list order.
8. Tests use synthetic domains, cookies, and organization labels that cannot be
   confused with captured account data.
9. Logging is limited to provider ID, state category, counts, and booleans; no
   paths containing usernames, cookie names beyond approved contract names,
   values, URLs with IDs, or raw state.
10. Represent organization routing as a discriminated `resolved | missing |
ambiguous` result and account scope independently as `personal |
organization | unknown`.
11. A resolved organization with `unknown` scope is usable. Phase 1 defaults
    scope to `unknown` unless an explicitly injected, verified signal exists;
    it never derives `personal` from response count/order, display names,
    subscription/plan labels, or identifier shape.
12. The scope classification remains transient main-process state. It is not
    written to session/settings files, included in cache context, returned to
    the renderer, or used to alter the WebSocket query.

## Architecture And File Boundaries

- Add src/shared/claudeWebSettings.ts for provider ID, language types, defaults,
  canonicalization, normalization, and validation.
- Add src/main/providers/claudeWebSettings.ts for private file persistence.
- Add src/main/providers/claudeWebSession.ts for session schema, usability, and
  organization resolution.
- Add tests/main/providers/claudeWebSettings.test.ts and
  tests/main/providers/claudeWebSession.test.ts.
- Do not edit registry, browser lifecycle, IPC, preload, or renderer files.

## Acceptance Criteria

- en-US is the deterministic default and valid BCP-47 tags round-trip in
  canonical form.
- Invalid, blank, overlong, or malformed language input fails safely.
- A locale suggestion changes nothing until explicitly saved.
- Claude settings and session paths cannot collide with ChatGPT or OpenAI API
  storage.
- Malformed/expired/missing session states are rejected and can be cleared.
- A single proven active organization resolves; zero, mismatched, or ambiguous
  evidence returns a safe typed failure without guessing.
- Resolved multi-organization evidence is usable with `unknown` scope;
  classification and routing tests prove neither axis changes the other.
- The `personal` union member is reserved and type-checked, but no production
  code can emit it from an unverified heuristic.
- No account identifier enters persisted settings, cache context, logs, test
  fixtures, or error messages.

## Verification

- node --import tsx --test tests/main/providers/claudeWebSettings.test.ts tests/main/providers/claudeWebSession.test.ts
- npm run typecheck
- npm run test:types
- Run a sensitive identifier and credential scan over the new source, tests,
  and fixtures.

## References

- Mandatory: sanitized research outcomes from Tasks 01-02.
- Mandatory precedent: src/main/providers/chatgptUtils.ts and ChatGPT session
  methods, consulted only for current storage mechanics.
- Optional traceability: Claude Web Requirements 3-7, 15, and 17; Resolved
  Product Decisions 1-2 and 7.

## Completion And Handoff

- Update todo.md and handoff.md with changed files, focused checks, decisions,
  and the exact next packet.
- Set 04_build_claude_audio_and_protocol.md next unless explicitly coordinating
  it in parallel under the approved plan.
- Present the contract tests for review and stop. Do not commit this packet or
  start another packet in the same invocation.
