# Handoff: Claude Web Voice and CLI Prettify Providers

Status: Task 03 is complete and awaits review. Do not begin Task 04 until a
later explicit incremental-implementation invocation.

Completed:

- Task 02 Gate A was approved and committed as `63646880`.
- Added the shared `claude-web` provider ID, explicit BCP-47 language contract,
  `en-US` default, canonicalization, strict validation, and side-effect-free
  locale suggestion.
- Added isolated versioned Claude settings and session files under `APP_DIR`
  with restrictive `0600` file permissions.
- Limited saved sessions to non-empty Secure, HttpOnly, unexpired cookies for
  the configured Claude domain plus non-empty local storage for the configured
  Claude origin; unrelated browser state is discarded.
- Added typed missing, malformed, unsupported-version, expired, missing-origin,
  feature-unavailable, and ambiguous readiness handling without values.
- Added deterministic active-organization routing that never chooses by list
  order and never persists an identifier.
- Reserved `personal | organization | unknown` account scope while ensuring all
  Phase-1 production resolution remains `unknown` and independent of routing.

Changed files:

- `src/shared/claudeWebSettings.ts`
- `src/main/providers/claudeWebSettings.ts`
- `src/main/providers/claudeWebSession.ts`
- `tests/main/providers/claudeWebSettings.test.ts`
- `tests/main/providers/claudeWebSession.test.ts`
- `docs/specs/claude-web-voice-provider/tasks/todo.md`
- `docs/specs/claude-web-voice-provider/tasks/handoff.md`

Checks:

- Focused Claude settings/session tests pass: 14 tests.
- Application and test TypeScript checks pass.
- Focused Prettier and ESLint checks pass.
- Full unit suite passes: 336 tests.
- Sensitive-value, profile/HAR-reference, logging, and synthetic-identifier
  scans pass.

Next step:

- Review Task 03. On the next explicit incremental-implementation invocation,
  commit it with a focused conventional commit and execute
  `04_build_claude_audio_and_protocol.md` only.

Blockers:

- Task 14 still requires explicit approval to add the Codex schema to packaged
  runtime assets.
- Personal-specific behavior remains gated on deferred Task 20 and an explicitly
  authorized personal-state account.
