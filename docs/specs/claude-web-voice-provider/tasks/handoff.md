# Handoff: Claude Web Voice and CLI Prettify Providers

Status: Task 06 is complete and awaits review. Do not begin Task 07 until a
later explicit incremental-implementation invocation.

Completed:

- Task 05 was approved and committed as `973b73b4`.
- Added an unregistered `ClaudeWebVoiceProvider` with isolated session
  save/load/clear, scoped local-storage restoration, safe page resource
  blocking, and Claude-specific bounded navigation retry classification.
- Added async initialization readiness and per-transcription revalidation with
  no access-token surrogate. Active routing comes from the exact
  `current_user_access` request path and is validated against UUID-only
  `account.memberships` projected from the studied authenticated bootstrap
  response.
- Kept organization UUID and `personal | organization | unknown` scope out of
  provider fields, persistence, results, cache context, renderer contracts, and
  logs. All three scopes use the same Phase 1 routing path.
- Added WAV-only PCM extraction, current-language transport calls, one
  clipboard write on success, stable enum-based provider errors, cancellation,
  and transport-first shutdown without reconnect or replay.
- Consulted the committed HAR only through sanitized shape scripts. It
  confirmed `current_user_access`; compiled frontend assets disproved the
  tentative bare `/api/organizations` path and confirmed bootstrap
  `account.memberships` as the eligible-organization source.

Changed files:

- `src/main/browserNavigationRetry.ts`
- `src/main/providers/ClaudeWebVoiceProvider.ts`
- `tests/main/browserNavigationRetry.test.ts`
- `tests/main/providers/ClaudeWebVoiceProvider.test.ts`
- `docs/specs/claude-web-voice-provider/tasks/todo.md`
- `docs/specs/claude-web-voice-provider/tasks/handoff.md`

Checks:

- Focused provider and navigation suites pass: 20 tests.
- Task 03-05 Claude settings, session, audio, protocol, and transport suites
  pass: 38 tests.
- Application and test TypeScript checks pass.
- Full Prettier and ESLint checks pass.
- Full unit suite passes: 375 tests.
- A synthetic page-boundary test executes the studied bootstrap/current-access
  projection without a browser, network, account, or private response fixture.
- Diff, session-artifact, field-retention, logging, captured-UUID intersection,
  and cache-privacy scans pass.

Next step:

- Review Task 06. On the next explicit incremental-implementation invocation,
  commit it with a focused conventional commit and execute
  `07_localize_claude_voice.md` only.

Blockers:

- Task 14 still requires explicit approval to add the Codex schema to packaged
  runtime assets.
- The private endpoint remains volatile. Non-default locales and any changed
  query/event contract require the recorded manual revalidation before use.
- The unregistered provider has not made a live request. Before enabling it,
  manually revalidate restored-session bootstrap readiness and the dictation
  button accessibility name in an explicitly authorized Claude account.
- Personal-specific behavior remains gated on deferred Task 20 and an explicitly
  authorized personal-state account.
