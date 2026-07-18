# Handoff: Claude Web Voice and CLI Prettify Providers

Status: Task 05 is complete and awaits review. Do not begin Task 06 until a
later explicit incremental-implementation invocation.

Completed:

- Task 04 was approved and committed as `c133461a`.
- Added a native WebSocket registry owned by the authenticated Claude page and
  controlled through short, independently cancellable Page evaluations.
- Added deterministic raw-PCM replay at 2,730 bytes every 85.31 ms, four-second
  keepalives, one CloseStream, and late endpoint handling through a bounded
  drain.
- Selected a 5-second connect timeout, 15-second first-event timeout,
  130-second overall timeout, and 3-second post-CloseStream drain timeout from
  the sanitized Gate A and studied UI bounds.
- Added a single exported error-code enum for typed upgrade/auth, connection,
  malformed-event, rate-limit, timeout, empty-result, cancellation, and page-
  shutdown failures with phase, event type, byte/event counts, duration, and
  close code only.
- Added explicit cancel and shutdown paths. Every socket, timeout, interval,
  queued page message, and accumulator is operation-scoped and cleared on all
  terminal paths; no reconnect or audio replay occurs after failure.

Changed files:

- `src/main/providers/claudeWebPageTransport.ts`
- `tests/main/providers/claudeWebPageTransport.test.ts`
- `docs/specs/claude-web-voice-provider/tasks/todo.md`
- `docs/specs/claude-web-voice-provider/tasks/handoff.md`

Checks:

- Focused Claude page transport tests pass: 10 tests.
- Upstream Claude audio/protocol tests pass: 14 tests.
- Application and test TypeScript checks pass.
- Focused Prettier and ESLint checks pass.
- Full unit suite passes: 360 tests.
- A fake-page native-WebSocket smoke proves the real boundary without browser,
  network, account, or private-endpoint access.
- Diff, captured-value, auth-field, logging, and diagnostic-shape scans pass.

Next step:

- Review Task 05. On the next explicit incremental-implementation invocation,
  commit it with a focused conventional commit and execute
  `06_implement_claude_provider_lifecycle.md` only.

Blockers:

- Task 14 still requires explicit approval to add the Codex schema to packaged
  runtime assets.
- The private endpoint remains volatile. Non-default locales and any changed
  query/event contract require the recorded manual revalidation before use.
- Personal-specific behavior remains gated on deferred Task 20 and an explicitly
  authorized personal-state account.
