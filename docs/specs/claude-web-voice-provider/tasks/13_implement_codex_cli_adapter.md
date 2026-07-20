# 13 Implement The Experimental Codex CLI Adapter

## Outcome

A tested, not-yet-enabled Codex CLI adapter discovers compatible models,
preflights authentication, and remains unavailable unless the installed version
proves ephemeral/config/rule isolation, read-only execution, never approval, no
tools/integrations, and disabled web search.

## Prerequisites

- Tasks 10-11 are complete and approved.
- The user explicitly authorizes a Codex CLI capability canary with synthetic
  inert input.

## In Scope

- Version/capability and login preflight.
- Exact codex exec isolation arguments/config overrides.
- Model discovery with bundled fallback.
- Model effort/verbosity capability mapping.
- Schema-path injection and structured final-output parsing.
- Experimental fail-closed availability state and sanitized fixtures.

## Out Of Scope

- Packaging the schema asset, enabling the provider, renderer UI, arbitrary
  config/arguments, writable sandbox, approval prompts, tools, apps, hooks,
  plugins, multi-agent behavior, MCP, web search, or CLI installation.

## Task Contract

1. Use Task 11 for every process and keep selected text on stdin only.
2. Authentication preflight runs codex login status and relies on exit code,
   never localized output or auth details.
3. Capability preflight revalidates the installed version's accepted flags and
   config keys before any Prettify request.
4. The invocation uses codex exec with ephemeral, ignore-user-config,
   ignore-rules, strict-config, skip-git-repo-check, read-only sandbox, and a
   validated approval_policy never override.
5. Explicitly disable shell/unified execution, apps, hooks, plugins, remote
   plugins, multi-agent behavior, MCP/external integrations, and web search
   using switches/config accepted by that installed version. Do not invent the
   unsupported --ask-for-approval flag.
6. Any unrecognized/ineffective required isolation switch leaves capability
   status unavailable. There is no bypass.
7. Accept an injected absolute output-schema path. Automated tests create a
   temporary synthetic schema; packaged resolution belongs to Task 14.
8. Discover models with codex debug models, then --bundled fallback. Parse only
   documented catalog fields and retain the configured free-text model if the
   catalog shape changes.
9. Model unset means Codex default. Expose only verified low, medium, high, and
   xhigh reasoning levels; max/ultra remain hidden without a live compatibility
   proof. Force reasoning summary none.
10. Verbosity defaults to low and accepts low/medium/high only when the model
    advertises support.
11. One authorized canary records only version/capability booleans and sanitized
    model/envelope shapes with synthetic slugs/content. Never commit identity,
    selected text, output, debug logs, or raw catalog.
12. Exit zero plus valid schema-constrained stdout is success even when stderr
    is nonempty. Every other runner/parser outcome maps to a stable safe code.
13. Cache context includes provider/capability version, model, effective
    reasoning effort, verbosity, and prompt; it excludes path, auth, cwd,
    source, output, and raw catalog.
14. The adapter remains internal/unselectable until schema packaging and Task
    16 integration pass.

## Architecture And File Boundaries

- Add src/main/services/prettifyCodexCli.ts.
- Add tests/main/prettifyCodexCli.test.ts.
- Add metadata-only sanitized capability/model fixtures under tests/fixtures if
  needed.
- Do not add an assets file or edit package.json in this packet.

## Acceptance Criteria

- Tests assert the complete accepted isolation vector and stdin separation.
- Missing or unprovable no-tools/no-search capability yields visible
  unavailable status and no Prettify process.
- Auth uses exit code only.
- Discovery primary/fallback paths, catalog changes, free-text retention,
  effort filtering, default effort, and verbosity support are covered.
- Benign stderr on exit zero does not fail valid structured output.
- Invalid schema path/output, cancellation, timeout, nonzero exit, and runner
  errors fail safely without leaking content or identity.

## Verification

- node --import tsx --test tests/main/prettifyCodexCli.test.ts tests/main/prettifyCliRunner.test.ts
- npm run typecheck
- npm run test:types
- Inspect fixtures/status/log metadata for account, source, output, path, config,
  and raw catalog leakage.

## References

- Mandatory: Task 10 Codex settings/capabilities and Task 11 runner.
- Mandatory: installed Codex help/model behavior rechecked during the authorized
  canary.
- Optional traceability: Codex CLI Prettify Requirements, Resolved Product
  Decision 6, and CLI success criteria.

## Completion And Handoff

- Update todo.md and handoff.md with the proven capability matrix, sanitized
  fixtures, changed files, checks, and unavailable reasons.
- Set 14_package_codex_output_schema.md as the next packet and record that it
  cannot begin without explicit packaging approval.
- Present the capability gate for review and stop. Do not commit this packet,
  package an asset, or enable Codex in the same invocation.
