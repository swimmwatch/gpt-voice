# Handoff: Claude Web Voice and CLI Prettify Providers

Status: Task 07 is complete and awaits review. Do not begin Task 08 until a
later explicit incremental-implementation invocation.

Completed:

- Task 06 was approved and committed as `877d5725`.
- Added 25 Claude Web keys to every supported locale: the provider name, four
  language/settings strings, and one safe actionable message for each of the
  20 `ClaudeWebVoiceProviderErrorCode` values.
- Kept Claude messages free of placeholders and raw provider, account,
  organization, session, URL, audio, transcript, and browser values.
- Added complete locale-key and placeholder parity coverage plus exhaustive
  enum-to-key and runtime `t()` resolution checks in every locale.
- Locked organization ambiguity guidance to activating the intended
  organization in Claude, private-protocol drift guidance to sign-in and
  revalidation, compressed-audio guidance to recording again, and timeout or
  cancellation guidance to manual user action without replay claims.
- Added no personal/scope-specific copy; future personal-state behavior remains
  gated on Task 20.

Changed files:

- `src/main/i18n/en.ts`
- `src/main/i18n/ru.ts`
- `src/main/i18n/uk.ts`
- `src/main/i18n/be.ts`
- `tests/main/i18n.test.ts`
- `docs/specs/claude-web-voice-provider/tasks/todo.md`
- `docs/specs/claude-web-voice-provider/tasks/handoff.md`

Checks:

- Focused i18n suite passes: 11 tests.
- Full unit suite passes: 378 tests.
- Application and test TypeScript checks pass.
- Full Prettier and ESLint checks pass.
- Locale and placeholder parity, exhaustive enum coverage, runtime translation
  resolution, privacy-safe wording, and retry-claim checks pass.

Next step:

- Review Task 07. On the next explicit incremental-implementation invocation,
  commit it with a focused conventional commit and execute
  `08_register_claude_web_provider.md` only.

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
