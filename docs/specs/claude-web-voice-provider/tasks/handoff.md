# Handoff: Claude Web Voice and CLI Prettify Providers

Status: Task 08 is complete and awaits review. Do not begin Task 09 until a
later explicit incremental-implementation invocation.

Completed:

- Task 07 was approved and committed as `ee464c48`.
- Exported and registered `ClaudeWebVoiceProvider` under the shared
  `CLAUDE_WEB_PROVIDER_ID` without changing the existing ChatGPT Web or OpenAI
  API registry order.
- Claude Web now appears exactly once with `browserSession` authentication and
  its existing login URL; every factory call returns a fresh unready provider
  without an access-token surrogate.
- Locked the pre-UI language default to `en-US` and preserved the existing
  provider-driven metadata, startup, login, clear-session, switch, and shutdown
  ownership. No browser, IPC, preload, or renderer branch was required.
- Extended generic startup classification coverage for switched providers while the
  existing fake-backed Claude suite continues to cover restored, missing,
  expired, cleared, cancellation, and transport-first shutdown behavior.

Changed files:

- `src/main/providers/index.ts`
- `tests/main/providers/providerRegistry.test.ts`
- `tests/main/browserSessionStartup.test.ts`
- `docs/specs/claude-web-voice-provider/tasks/todo.md`
- `docs/specs/claude-web-voice-provider/tasks/handoff.md`

Checks:

- Focused registry, startup, and Claude lifecycle suites pass: 22 tests.
- Full unit suite passes: 380 tests.
- Application and test TypeScript checks pass.
- Full Prettier and ESLint checks pass.
- Registry uniqueness, exact metadata, fresh factory behavior, unknown-ID
  rejection, restored-session classification, and default-language checks pass.

Next step:

- Review Task 08. On the next explicit incremental-implementation invocation,
  commit it with a focused conventional commit and execute
  `09_expose_claude_voice_settings.md` only.

Blockers:

- Task 14 still requires explicit approval to add the Codex schema to packaged
  runtime assets.
- The private endpoint remains volatile. Non-default locales and any changed
  query/event contract require the recorded manual revalidation before use.
- Automated verification made no live provider request. Before feature sign-off,
  manually verify provider selection, login/save, restored startup, switching,
  clear-session, and shutdown in an explicitly authorized Claude account, and
  revalidate bootstrap readiness plus the dictation button accessibility name.
- Personal-specific behavior remains gated on deferred Task 20 and an explicitly
  authorized personal-state account.
