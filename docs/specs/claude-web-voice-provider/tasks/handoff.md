# Handoff: CLI Prettify Localization

Status: Task 14 was committed as `2f2f3037 feat(prettify): package Codex
output schema`. Task 15 is complete and deliberately uncommitted for review.
Do not begin Task 16 or enable either CLI provider in this invocation.

Implemented in Task 15:

- Added Claude CLI and experimental Codex CLI provider labels plus executable,
  model, fallback, effort, verbosity, timeout, and capability guidance in
  English, Russian, Ukrainian, and Belarusian.
- Added provider-specific privacy notices explaining that selected text and the
  protected prompt use the user's Anthropic or OpenAI CLI account and may
  consume subscription or API quota.
- Localized every Claude and Codex adapter error code and the dedicated invalid
  path/model, output-limit, nonzero-exit, packaged-schema, no-tools isolation,
  and model-discovery states.
- Kept every CLI message placeholder-free. Cancellation and timeout messages
  state that the process was terminated without automatic retry; Codex remains
  unavailable when isolation cannot be proven and exposes no bypass.
- Extended i18n tests to enforce adapter-enum coverage, supported option values,
  locale/key parity, placeholder parity, fail-closed guidance, and privacy-safe
  wording.

Task 15 changed files:

- `src/main/i18n/{en,ru,uk,be}.ts`
- `tests/main/i18n.test.ts`
- `docs/specs/claude-web-voice-provider/tasks/{todo,handoff}.md`

Verification:

- `node --import tsx --test tests/main/i18n.test.ts`, `npm run typecheck`,
  `npm run test:types`, `npm run lint`, and `npm run format:check` pass. Lint
  retains only the two pre-existing warnings in
  `tests/main/streamingTranscription.test.ts`.
- `git diff --check` and the targeted localization privacy scan pass. The scan
  found no raw process fields, identities, credentials, full paths, URLs, or
  sensitive runtime placeholders in the new locale text.
- No adapter, renderer, IPC, provider-enablement, dependency, or packaging
  behavior changed. Unrelated provider-switching work remains preserved.

Exact next packet:

- After human review, run Task 16 (`16_integrate_cli_prettify_runtime.md`). Keep
  both CLI providers unselectable until that packet's capability gate passes.
