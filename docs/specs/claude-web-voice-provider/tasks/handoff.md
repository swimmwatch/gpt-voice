# Handoff: Experimental Codex CLI Adapter

Status: Task 12 was committed as `5e66896c feat(prettify): add Claude CLI
adapter`. Task 13 is complete and deliberately uncommitted for review. Do not
begin Task 14, enable either CLI provider, or add packaging changes in this
invocation.

Implemented in Task 13:

- Added an internal `CodexCliPrettifyAdapter` that uses `CliProcessRunner`
  exclusively, keeps selected text on stdin, checks version and login status,
  validates the `exec`/model/feature capabilities, and maps every runner or
  parser failure to stable safe codes.
- Added the fixed isolated `codex exec` vector: ephemeral session, ignored user
  config and rules, strict config, skipped Git check, read-only sandbox, never
  approval, empty MCP configuration, disabled executable/integration features,
  disabled web search, forced reasoning summary `none`, and an injected
  absolute readable output-schema path.
- Added model discovery through `codex debug models` with bundled fallback,
  parsing for the installed catalog's `slug`, reasoning-level objects, and
  verbosity support. Only low/medium/high/xhigh reasoning and
  low/medium/high verbosity are exposed; configured free-text models survive
  catalog drift.
- Corrected the initial runtime blocker: the installed bundled catalog is
  286,936 bytes, so model discovery now has a dedicated 512 KiB cap while
  Prettify output remains capped at 256 KiB. Obsolete feature names were
  replaced with names proven by the installed feature registry.
- Added deterministic tests for capability rejection, exact argv/stdin
  separation, catalog fallback/drift, model-option filtering, schema and output
  validation, auth-by-exit-code, runner failures, and cache privacy.

Sanitized canary evidence:

- Codex CLI capability version `0.144.3` passed version, exec-help,
  model-help, feature-registry, authentication, model-discovery, and isolated
  execution gates.
- The final envelope was an object with one nonempty string `text` field. Model
  metadata exposed only the redacted key/type shape for slug/display name,
  verbosity support, and reasoning levels.
- Evidence is stored in
  `tests/fixtures/codex-cli-capability-shape.json`. No identity, source text,
  provider output, model identifiers, raw catalog, paths, auth, or session data
  is retained. The disposable canary files were deleted.

Task 13 changed files:

- `src/main/services/prettifyCodexCli.ts`
- `tests/main/prettifyCodexCli.test.ts`
- `tests/fixtures/codex-cli-capability-shape.json`
- `docs/specs/claude-web-voice-provider/tasks/{todo,handoff}.md`

Checks:

- Focused Codex adapter/runner tests, `npm run typecheck`,
  `npm run test:types`, `npm run lint`, `npm run format:check`, and diff hygiene
  pass. Lint retains only the two pre-existing warnings in
  `tests/main/streamingTranscription.test.ts`.
- `npm test` passes 98/99 files. The unrelated
  `tests/scripts/buildSizeCli.test.ts` stdout-capture failure persists.

Exact next packet:

- After human review and explicit packaging approval, run Task 14
  (`14_package_codex_output_schema.md`). Keep both CLI providers unselectable
  until their runtime-integration packet.
