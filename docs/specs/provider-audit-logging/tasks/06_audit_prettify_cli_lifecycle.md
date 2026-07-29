# 06 Audit Prettify CLI Lifecycle

## Outcome

Add bounded schema-v1 audit lifecycles for Claude CLI and Codex CLI Prettify
availability, capability/auth gates, model discovery, preparation, execution,
cancellation/timeout, structured-output validation, process termination, and
cleanup. Preserve process isolation and existing typed provider results while
excluding executable paths, arguments, environment, input, output, and debug
data.

## Prerequisites

- Packet 01 (shared provider-audit contracts, canonical sink, operation state,
  safe metadata builders, severity/error normalization, and exhaustive mapping
  support) is completed, verified, and approved.
- Packet 05 is completed, verified, and approved so CLI instrumentation extends
  the same common Prettify prepare/execute boundary used by HTTP providers.
- The approved Prettify CLI cause codes, operation/phase identifiers, privacy
  rules, and compatibility constraints remain authoritative.
- Preserve Packet 05's HTTP behavior while extending its shared boundary; do
  not add a second start/terminal or change Ollama/vLLM behavior.

## Owned Requirements

- `SCOPE-002` for Claude CLI and Codex CLI provider-owned operations.
- `PRETTY-001`, `PRETTY-003`, `PRETTY-004`, and `PRETTY-005` for CLI
  providers.
- Claude/Codex CLI portions of `AC-AUTO-001`: availability, capability/auth,
  model discovery, prepare/execute, process codes, timeout/cancel, output
  limits, structured-output failure, cleanup, no duplicate terminal, registry
  mapping, and privacy canaries.
- Packet 01 remains the primary owner of shared audit contracts. Packet 05
  owns HTTP-specific Prettify behavior.

## In Scope

- Concrete provider identity for `claude-cli` and `codex-cli`.
- CLI operations `settings-readiness`, `availability`, `capability-check`,
  `model-list`, `prepare`, `prettify`, `process-cleanup`, and `shutdown` where
  an independently invoked cleanup exists.
- Claude version/help/auth checks, capability gating, preparation, one-shot
  execution, typed failure mapping, and structured text-envelope validation.
- Codex exact-version/help/features/auth/schema gates, primary and bundled
  model discovery, configured-model fallback, preparation, one-shot execution,
  typed failure mapping, and structured text-envelope validation.
- `CliProcessRunner` resolution, spawn, stdin, running, timeout/cancellation,
  output limits, exit, termination, temporary-directory cleanup, and tree
  cleanup as bounded semantic phases.
- Direct connection/model/main calls and selected-text execution converging on
  one provider lifecycle.
- Consolidation of overlapping CLI provider-operation logs.
- Deterministic adapter, runner, dispatch, privacy, severity, and fail-open
  tests with no real executable or network use.

## Out Of Scope

- Ollama/vLLM HTTP operations and model lifecycle.
- CLI command lines, capability requirements, audited versions, schema hash,
  model catalog logic, process isolation, environment allowlist, timeout,
  stdout/stderr limits, tree termination, or temporary-directory behavior
  changes.
- Diagnostic text persistence, redaction, SQLite, retention, purge, or archive
  export.
- New subprocesses, shells, network calls, dependencies, or live CLI probes in
  tests.
- Selected text, prompt, output, model value, executable/configured path,
  working/temporary directory, environment, argv, stdin, stdout, stderr,
  stderr excerpts, schema contents/path, account/auth output, URLs, raw errors,
  messages, or stacks in audit events.
- Per-output-chunk, JSONL-progress, token, or model-catalog-record events.

## Task Contract

1. Use the Packet 01 main-process API and the shared Prettify provider mapping.
   The provider/adapter/runner layers collaborate on one top-level operation;
   they must not emit duplicate start or terminal events.
2. Known CLI dispatch carries `claude-cli` or `codex-cli`. An unsupported
   candidate rejected by connection/model/prepare dispatch emits
   `providerKnown: false`, omits `providerId`, and never serializes the
   candidate. Preserve the current renderer/main return or throw behavior.
3. Public action mapping:
   - connection readiness is `availability`;
   - an independently requested capability/auth gate is `capability-check`;
   - UI/model discovery is `model-list`;
   - creation of a one-shot execution is `prepare`;
   - generation is `prettify`;
   - cleanup invoked without an active parent may be `process-cleanup`;
   - provider/app cleanup without another active action may be `shutdown`.
4. Nested checks performed as part of `prepare`, `model-list`, or `prettify`
   reuse the parent operation ID and appear as semantic phases. Do not fabricate
   an independent operation for every fixed subprocess. When availability or a
   capability check is invoked independently, it receives its own operation
   ID.
5. Use approved phases only: `dispatch`, `validation`, `configuration`,
   `readiness`, `model-discovery`, `submission`, `process`, `result`,
   `recovery`, `cleanup`, and `shutdown`.
6. Each fixed CLI subprocess contributes bounded semantic phase transitions.
   stdout/stderr chunk count, JSONL progress, token count, catalog record count,
   and output size must not increase audit event volume.
7. Keep the existing Claude CLI provider runtime codes:
   `not-installed`, `not-executable`, `not-authenticated`, `unsupported`,
   `cancelled`, `timed-out`, `output-limit`, `nonzero-exit`,
   `process-failed`, `empty-output`, `malformed-output`, and `invalid-model`.
8. Keep the existing Codex CLI provider runtime codes above plus
   `schema-unavailable`, `no-tools-unavailable`, and
   `model-discovery-failed`.
9. Map runner control-flow facts to those existing provider codes. Do not
   derive audit causes from stdout/stderr, auth output, localized messages,
   thrown messages, or arbitrary process errors.
10. Only Packet 01 allowlisted metadata may be emitted. Useful safe facts are
    limited to values such as `durationMs`, `attemptCount`, `modelSource`,
    `usesDefaultModel`, `modelConfigured`, `modelNameLength`, and approved
    booleans. Do not include exit code, signal, executable name/path,
    operation label, stdout/stderr byte counts, or cleanup objects unless
    Packet 01 explicitly includes that exact field in its closed schema.
11. Never spread `CliProcessDiagnostics`, `CliProcessResult`,
    `stderrExcerpt`, adapter input, settings, parsed catalog/envelope, or an
    `Error` into the audit builder.
12. Preserve Claude behavior:
    - version, required help capabilities, and auth status execute in the
      existing order;
    - auth nonzero exit remains `not-authenticated`;
    - invalid model fails before generation;
    - one prepared execution invokes generation at most once;
    - only a nonempty structured text envelope succeeds.
13. Preserve Codex behavior:
    - exact audited version, exec/model help, disabled-feature, login, and
      schema gates stay unchanged;
    - primary then bundled model discovery and configured-model fallback retain
      current order/semantics;
    - terminal cancellation/timeout during discovery suppresses fallback as it
      does today;
    - one prepared execution invokes generation at most once;
    - only a nonempty structured output succeeds.
14. Process cleanup belongs to the active provider action when it is caused by
    that action: emit a `cleanup` phase and let cleanup failure determine that
    action's terminal. Use a separate `process-cleanup` operation only for an
    independently invoked cleanup with no active parent. Never terminate the
    parent before cleanup if current behavior waits for cleanup.
15. Explicit cancellation is an `info` terminal. Expected availability/auth,
    timeout, output-limit, nonzero-exit, and provider rejection are `warn`.
    Malformed structured output/internal contract, unexpected exception, and
    failed cleanup with uncertain ownership are `error`.
16. Preserve first-terminal-cause behavior across timeout, cancellation,
    graceful termination, forced termination, process close, and cleanup. Late
    callbacks cannot emit after terminal.
17. Selected-text cache hits create no `prettify` execution operation. Any CLI
    preparation already performed to derive capability/cache context remains a
    separate provider support operation.
18. Audit emission is fail open. Throwing sinks, rejected metadata,
    serialization/clock/ID failure, or missing logger runtime must not alter
    process spawn/termination, temporary cleanup, adapter/provider results,
    action cancellation, cache, clipboard, notifications, or shutdown.
19. Remove or narrow superseded provider-operation logs from shared Prettify
    dispatch/IPC/selected-text paths when they duplicate the CLI lifecycle.
    Keep distinct settings, cache, clipboard, notification, and infrastructure
    diagnostics.

## Contracts And Boundaries

- Main owns subprocess execution, filesystem/path resolution, environment,
  settings with executable paths, stdin/stdout/stderr, audit IDs, and the
  audit sink. No new CLI details cross preload/renderer boundaries.
- Preserve `shell: false`, isolated temporary working directory, environment
  allowlist, native executable validation, bounded output, abort/timeout, and
  process-tree cleanup.
- Keep `ClaudeCliPrettifyAdapter`, `CodexCliPrettifyAdapter`,
  `BasePrettifyProvider`, prepared execution, and renderer-safe result types
  behaviorally compatible.
- A main-only audit operation handle must not retain source/prompt/output and
  must never be placed in shared renderer types.
- The existing sanitized optional stderr excerpt is still prohibited from
  audit events and provider results unless its current non-audit contract
  already permits it.
- No audit failure may delay or skip child termination or temporary-directory
  cleanup.

## Expected Files Or Components

- `src/main/services/prettifyCliProviders.ts`
- `src/main/services/prettifyClaudeCli.ts`
- `src/main/services/prettifyCodexCli.ts`
- `src/main/services/prettifyCliRunner.ts`
- `src/main/services/prettifyProviderBase.ts` only for a shared main-only audit
  context compatible with HTTP providers.
- `src/main/services/prettifyProviders.ts` only for CLI dispatch correlation
  and unknown-provider validation; do not change HTTP behavior.
- `src/main/services/selectedTextPrettify.ts` only if duplicate provider
  operation logs must be removed; capture remains out of scope.
- `src/main/ipc.ts` for trusted CLI connection/model dispatch validation and
  duplicate-log consolidation.
- Packet 01 audit API and Prettify CLI mapping components.
- `tests/main/prettifyCliRunner.test.ts`
- `tests/main/prettifyClaudeCli.test.ts`
- `tests/main/prettifyCodexCli.test.ts`
- `tests/main/prettifyProviders.test.ts`
- `tests/main/selectedTextPrettify.test.ts`
- `tests/main/prettifyIpcPrivacyContract.test.ts`

## Acceptance Criteria

- Both CLI providers emit correlated bounded lifecycles for independent
  availability/capability/model-list calls, prepare, execute, timeout/cancel,
  typed process failure, structured-output failure, success, and cleanup.
- Fixed capability/model subprocess sequences produce phase events bounded by
  semantic steps; output chunks, progress records, tokens, and catalog size do
  not increase event count.
- Existing provider runtime codes survive as closed audit causes without
  stdout/stderr/error-derived text.
- Process timeout/cancellation/exit/cleanup races retain the first terminal
  cause, produce exactly one terminal, and emit nothing afterward.
- Direct/main and selected-text execution converge on one provider lifecycle;
  a cache hit has no `prettify` execution operation.
- Registered CLI IDs are present; unknown candidates are omitted with
  `providerKnown: false`. Registry/type tests fail if either CLI provider lacks
  an audit mapping.
- Captured logger arguments contain none of the privacy canaries placed in
  source, prompt, output/model, executable/path, cwd/temp directory,
  environment, argv/stdin/stdout/stderr/excerpt, schema, auth/account output,
  URLs, exceptions, or stacks.
- A throwing sink and rejected metadata do not alter subprocess isolation,
  timeout/cancellation, cleanup, adapter/provider results, cache, clipboard, or
  notifications.
- Existing CLI runner, adapter, provider dispatch, selected-text, and IPC
  privacy tests remain behaviorally compatible.

## Verification

Run focused checks:

```bash
rtk node --import tsx --test tests/main/prettifyCliRunner.test.ts tests/main/prettifyClaudeCli.test.ts tests/main/prettifyCodexCli.test.ts tests/main/prettifyProviders.test.ts tests/main/selectedTextPrettify.test.ts tests/main/prettifyIpcPrivacyContract.test.ts
rtk node --import tsx --test tests/main/providerAudit/providerAudit.test.ts tests/main/providerAudit/providerAuditMappings.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
```

Run the full unit suite if shared Prettify/provider contracts or IPC handlers
changed:

```bash
rtk npm run test:unit
```

## Failure And Rollback

- If instrumentation changes args, environment, executable resolution, spawn
  mode, timeout/cancellation, output limits, model discovery, schema checks,
  structured parsing, cleanup, result/error values, cache, clipboard,
  notification, or IPC behavior, restore existing behavior before proceeding.
- Roll back only this packet's CLI audit hooks and focused tests. Audit lines
  rotate normally and require no migration.
- Do not weaken process isolation, trusted sender checks, typed error mapping,
  output bounds, cleanup, metadata allowlists, privacy canaries, or terminal
  invariants.
- Audit is fail open; never retain a process or sensitive buffer because the
  sink failed.

## Manual Gates

- No real Claude/Codex executable invocation, login/account probe, private
  selected text, network call, commit, push, or release is authorized.
- `MANUAL GATE`: any later desktop CLI exercise requires separate
  authorization, synthetic non-private input, and a controlled test account or
  fixture. Confirm capability/execute correlation, timeout/cancellation,
  cleanup, severity, and absence of command/input/output/path/environment
  content.
- Archive and optional text-capture verification belong to later packets.

## References

- Mandatory: `docs/specs/provider-audit-logging/spec.md`, sections
  **Provider Audit Event Contract**, **Bounded High-Frequency Detail**, **Audit
  Metadata and Error Normalization**, **Family Requirements / Prettify**,
  **Security and Privacy**, **Failure Behavior**, and **Acceptance Criteria /
  Provider Audit**.
- Mandatory: Packet 01 shared audit core.
- Mandatory: `docs/agent-guides/project-conventions.md`, sections **Code And
  Logging**, **Electron And Providers**, and **Tests And Documentation**.
- Local implementation references:
  `src/main/services/prettifyCliProviders.ts`,
  `src/main/services/prettifyClaudeCli.ts`,
  `src/main/services/prettifyCodexCli.ts`, and
  `src/main/services/prettifyCliRunner.ts`.

## Completion And Handoff

- Mark only Packet 06 complete in `tasks/todo.md`.
- Update `tasks/handoff.md` with changed files, delivered CLI operations/causes,
  exact checks/results, and blockers.
- Identify the next unchecked packet from the approved plan; do not begin it.
- Stop for review. Do not commit, push, open a pull request, or begin another
  packet without separate incremental-implementation authorization.
