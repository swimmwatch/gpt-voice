# 12 Implement The Claude CLI Prettify Adapter

## Outcome

A tested, not-yet-enabled Claude CLI adapter validates installation/auth,
constructs the exact isolated print-mode invocation, parses schema-constrained
output, and returns safe typed availability and result states.

## Prerequisites

- Tasks 10-11 are complete and approved.
- The user explicitly authorizes one Claude CLI canary before a real output
  envelope fixture is finalized.

## In Scope

- Claude executable preflight and auth status.
- Exact noninteractive isolation arguments.
- Primary/fallback model, effort, timeout, prompt, and stdin mapping.
- Inline output schema and defensive JSON envelope parsing.
- A sanitized synthetic fixture derived from the authorized canary.
- Adapter-specific cache/capability version context and safe errors.

## Out Of Scope

- Provider registry enablement, renderer UI, arbitrary arguments, API keys,
  tools, skills, MCP, Chrome integration, session persistence, budget ceiling,
  undocumented environment controls, or CLI installation.

## Task Contract

1. Use Task 11 for every process. The adapter never imports child_process
   directly.
2. Preflight version/capability compatibility and run claude auth status --json.
   Consume only the logged-in boolean; discard identity/account/subscription
   fields without logging.
3. The Prettify request uses --print, input-format text, output-format json, the
   protected prompt, and an inline JSON schema requiring one text string.
4. Include --tools with an empty value, --disable-slash-commands, empty
   --setting-sources, strict empty MCP config, --no-chrome,
   --no-session-persistence, and permission-mode dontAsk.
5. Selected text is stdin only. The non-secret protected prompt and validated
   settings may be argv.
6. Empty model omits the model flag. Nonempty model accepts known aliases or a
   validated full model name. Empty fallback omits --fallback-model; a nonempty
   fallback uses the same validation.
7. Effort supports default, low, medium, and high only. Timeout comes from the
   shared 15-600 setting.
8. Run one authorized canary with synthetic inert text. Preserve only envelope
   key/type structure and replace output content with a synthetic placeholder;
   do not commit identity, raw stdout/stderr, selected text, or model output.
9. Parse success only on exit zero plus a valid schema-constrained text field.
   Distinguish not installed, not executable, not authenticated, unsupported
   version/capability, timeout, cancellation, nonzero exit, empty output, and
   malformed output.
10. Stderr on success is ignored except for byte-count diagnostics. Failed
    stderr may be presented only through Task 11 sanitization.
11. Cache context includes provider ID, CLI/capability version, model, fallback,
    effort, prompt, and timeout only when timeout can affect behavior. It never
    includes executable path, auth, cwd, source, or output.
12. The adapter remains internal/unselectable until Task 16 runtime integration.

## Architecture And File Boundaries

- Add src/main/services/prettifyClaudeCli.ts.
- Add tests/main/prettifyClaudeCli.test.ts.
- Add one metadata-only sanitized fixture under tests/fixtures if needed.
- Reuse Task 11 runner and Task 10 settings/capabilities.
- Do not edit renderer or enable the provider registry.

## Acceptance Criteria

- Tests assert the complete isolation argument vector and stdin separation.
- Auth preflight consumes only logged-in state.
- Model, fallback, effort, timeout, and omitted-default behavior are covered.
- Valid sanitized envelope returns text; empty/malformed envelopes fail safely.
- Every runner failure maps to a stable adapter code without exposing paths,
  identity, source, stdout, or raw stderr.
- No tools, MCP, Chrome, slash commands, permission prompts, or session
  persistence are enabled by the constructed invocation.

## Verification

- node --import tsx --test tests/main/prettifyClaudeCli.test.ts tests/main/prettifyCliRunner.test.ts
- npm run typecheck
- npm run test:types
- Inspect the canary fixture and git status for identity, auth, source, output,
  session, or CLI debug artifacts.

## References

- Mandatory: Task 10 Claude settings and Task 11 runner contracts.
- Mandatory: installed Claude --help/auth behavior rechecked during the
  authorized canary.
- Optional traceability: Claude CLI Prettify Requirements and CLI success
  criteria.

## Completion And Handoff

- Update todo.md and handoff.md with capability version, sanitized fixture,
  changed files, checks, and any unsupported-version blocker.
- Set 13_implement_codex_cli_adapter.md as the next packet unless it was
  explicitly coordinated in parallel.
- Present the exact isolation contract for review and stop. Do not commit this
  packet or enable the adapter in the same invocation.
