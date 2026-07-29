# 05 Audit Prettify HTTP Lifecycle

## Outcome

Add correlated schema-v1 audit lifecycles to Prettify dispatch and the Ollama
and vLLM HTTP providers, including settings readiness, model listing,
Ollama model lifecycle, preparation, execution, cancellation, cleanup, and
shutdown. Selected-text and direct main calls must converge on one provider
audit boundary without logging source, prompt, result, model, endpoint, or
credential values.

## Prerequisites

- Packet 01 (shared provider-audit contracts, sink, operation state, safe
  metadata builders, severity/error normalization, and exhaustive mapping
  support) is completed, verified, and approved.
- The approved Prettify operations, causes, privacy rules, and compatibility
  contract remain authoritative.
- Packet 06 is not required to execute this packet. Keep shared Prettify
  boundary changes compatible with later Claude/Codex CLI instrumentation and
  do not implement CLI subprocess internals here.

## Owned Requirements

- `SCOPE-002` for Prettify dispatch and Ollama/vLLM provider-owned operations.
- `PRETTY-001`, `PRETTY-002`, `PRETTY-004`, and `PRETTY-005` for HTTP
  providers and the shared dispatch boundary.
- Ollama/vLLM portions of `AC-AUTO-001`: availability/model/prepare/execute,
  HTTP causes/status, cancellation, response contract, empty result, cleanup,
  no duplicate terminal, registry mapping, and privacy canaries.
- Packet 01 remains the primary owner of shared audit schema and fail-open
  behavior. Packet 06 owns CLI-specific requirements.

## In Scope

- Concrete registered provider identity across shared Prettify dispatch.
- Unknown-provider failure before dispatch with omission of the candidate ID.
- HTTP Prettify operations `settings-readiness`, `availability`, `model-list`,
  `model-load`, `model-unload`, `prepare`, `prettify`, and `shutdown`.
- Ollama model discovery/running-state enrichment, load/pin/unload, replacement
  cleanup, generation, cancellation, response validation, and quit cleanup.
- vLLM model listing, settings readiness, generation, cancellation, response
  validation, and success/failure.
- Separate `prepare` and `prettify` operation identities, including the
  one-shot execution contract.
- Consolidation of overlapping Prettify provider-operation logs in service,
  HTTP provider, selected-text, and IPC paths.
- Deterministic tests for dispatch, both HTTP providers, model lifecycle,
  selected-text cache behavior, fail-open observation, severity, and privacy.

## Out Of Scope

- Claude CLI, Codex CLI, subprocess execution, executable resolution,
  capability/auth checks, CLI model discovery, structured CLI output, and
  process cleanup; Packet 06 owns those.
- Translation/Prettify diagnostic text persistence, redaction, SQLite,
  retention, clear/purge, and archive export.
- HTTP endpoint, request format, prompt, generation setting, model loading
  behavior, response parsing, cache keys, selected-text action gating,
  clipboard, notification, or localized error changes.
- Network retries, response streaming, live provider calls, or new
  dependencies.
- Audit events for a cache hit's primary `prettify` action. A provider-owned
  `prepare` support operation may already have occurred to establish cache
  context; no execution operation is fabricated.
- Raw request/response bodies, selected text, prompts, output, model values,
  base URLs, API keys, authorization headers, cache keys, exception messages,
  URLs, paths, or stacks in audit metadata.

## Task Contract

1. Use the Packet 01 main-process API. Provider code reports closed semantic
   facts to one audit owner; service, provider, selected-text, and IPC layers
   must not each emit duplicate starts or terminals.
2. The exhaustive Prettify mapping covers `ollama`, `vllm`, `claude-cli`, and
   `codex-cli`. This packet proves full operation mapping for Ollama/vLLM and
   must leave typed extension points for Packet 06. Registry/type tests fail
   when a known provider lacks a mapping.
3. Any unsupported provider candidate rejected by `prepare`, list/load/unload,
   or privileged IPC dispatch emits one family failure with
   `providerKnown: false`, no `providerId`, and no candidate value in logger
   arguments. Preserve existing public return/throw behavior.
4. A known dispatch always carries its concrete registered provider ID.
   Selected-text and other main callers enter the same audited provider method;
   application wrappers do not create duplicate provider lifecycles.
5. `prepare` and `prettify` are separate operations:
   - preparation starts before provider settings/capability work and terminates
     when a prepared one-shot execution or typed preparation failure exists;
   - execution starts only when `PreparedPrettifyExecution.execute(text)` is
     called and terminates exactly once;
   - a second one-shot execution attempt preserves its current failure result
     and receives no events on a previously terminated operation.
6. Approved semantic phases for HTTP work are `dispatch`, `validation`,
   `configuration`, `readiness`, `model-discovery`, `model-lifecycle`,
   `submission`, `result`, `cleanup`, and `shutdown`.
7. Use only approved safe metadata: `durationMs`, numeric `httpStatus`,
   `sourceLength`, `resultLength`, `modelSource`, `usesDefaultModel`,
   `modelConfigured`, `modelNameLength`, and closed booleans/causes when
   applicable. Never include the model string, endpoint, settings object, or
   response-derived arbitrary fields.
8. Preserve/add only the approved HTTP/provider causes:
   `not-configured`, `connection-failed`, `request-failed`,
   `unexpected-response`, `empty-result`, `model-lifecycle-failed`, and
   `unknown`; explicit cancellation uses the shared cancellation cause/outcome
   supplied by Packet 01. Do not derive a cause from localized messages or
   response bodies.
9. Ollama requirements:
   - missing configured model terminates settings/prepare/model lifecycle as
     `not-configured`;
   - model listing distinguishes request transport, numeric status, response
     contract, and success;
   - already-running/already-loaded paths terminate successfully without
     inventing network work;
   - switching a pinned model preserves the current unload-before-load order;
   - load/unload request or verification failure uses
     `model-lifecycle-failed`;
   - generation distinguishes cancellation, connection/request failure,
     numeric status, response contract, empty result, and success.
10. vLLM requirements:
    - missing model is `not-configured`;
    - key presence may be represented only as an approved boolean if required;
    - model listing and generation distinguish transport, numeric status,
      unexpected response, empty result, cancellation, and success;
    - authorization, endpoint, model, prompt, body, and output never enter
      audit metadata.
11. A user-requested Ollama load/unload is `model-load`/`model-unload`.
    App-quit cleanup of the retained loaded model is a `shutdown` operation
    with `model-lifecycle` and `cleanup` phases, not a duplicate user
    model-unload operation.
12. Do not emit events for each HTTP read or parsing step. One phase boundary
    per semantic step is sufficient; body size/content must not affect event
    count.
13. A selected-text cache hit creates no `prettify` provider operation and no
    provider terminal. Preserve the cache-hit clipboard/notification path. Any
    prior provider preparation remains its independent support operation.
14. Explicit cancellation is an `info` terminal. Expected settings,
    connection, request, status, and empty-result failures are `warn`.
    Unexpected contract/exception and cleanup ownership failures are `error`.
15. Audit emission is fail open. Throwing sinks, rejected fields,
    serialization/clock/ID failure, and missing logger runtime do not change
    fetches, abort behavior, model ownership, returned results, cache,
    clipboard, notifications, or shutdown.
16. Remove or narrow superseded operation logs from
    `prettifyProviders.ts`, `prettifyHttpProviders.ts`,
    `selectedTextPrettify.ts`, `prettify.ts`, and model IPC handlers. Keep
    distinct settings, cache, clipboard, notification, and infrastructure
    diagnostics.

## Contracts And Boundaries

- Main owns settings with secrets, `fetch`, provider instances, model
  ownership, abort signals, audit IDs, and the sink. Renderer receives only
  existing typed results.
- Keep `BasePrettifyProvider`, `PrettifyProviderDependencies`,
  `PreparePrettifyExecutionResult`, `PreparedPrettifyExecution`, and
  `TextProcessingResult` behaviorally compatible.
- If a main-only audit operation handle is added to a request/dependency, it
  must never cross preload/renderer declarations and must not retain text.
- Keep loopback/base-URL validation, request bodies, headers, generation
  options, model pinning, and one-shot consumption unchanged.
- `createConnectionError` and localized errors may remain user-facing but are
  not audit inputs. Audit code maps closed control-flow facts directly.
- Never spread settings, HTTP response objects, parsed bodies, exceptions, or
  model result objects into an audit builder.

## Expected Files Or Components

- `src/main/services/prettifyProviderBase.ts`
- `src/main/services/prettifyProviders.ts`
- `src/main/services/prettifyHttpProviders.ts`
- `src/main/services/prettify.ts` only for overlapping direct-operation logs.
- `src/main/services/selectedTextPrettify.ts` only for provider-boundary/cache
  separation and duplicate-log consolidation; text capture is out of scope.
- `src/main/ipc.ts` for unknown validation and HTTP model list/load/unload
  dispatch without changing trusted sender checks.
- `src/main/main.ts` only for the existing Ollama quit-cleanup call.
- `src/shared/prettifySettings.ts` only for exhaustive mapping/type integration;
  do not change settings behavior.
- Packet 01 audit API and Prettify mapping components.
- `tests/main/prettifyProviders.test.ts`
- `tests/main/selectedTextPrettify.test.ts`
- `tests/main/prettifyIpcPrivacyContract.test.ts`
- `tests/shared/prettifySettings.test.ts` if exhaustive mapping/types change.

## Acceptance Criteria

- Ollama and vLLM settings readiness, list, prepare, execute, HTTP status,
  response contract, empty result, cancellation, success, and cleanup produce
  bounded correlated lifecycles.
- Ollama load, already-running/load, replacement unload/load, explicit unload,
  failure, and quit shutdown paths each have the correct operation and exactly
  one terminal.
- Known dispatch carries the exact registered ID; unknown dispatch omits the
  candidate and sets `providerKnown: false`.
- Direct/main and selected-text flows produce one provider lifecycle per
  provider operation, not one per wrapper layer.
- Cache hits produce no `prettify` provider operation. Existing cache,
  clipboard, notification, and one-shot behavior remain unchanged.
- HTTP bodies and repeated reads do not affect event count.
- Numeric status and allowed lengths/booleans are accurate; model, endpoint,
  prompt, source, output, credential, header, body, URL, path, and exception
  canaries are absent from captured logger arguments.
- Every operation has monotonic sequence values beginning at `1`, exactly one
  terminal, correct severity, and no post-terminal event.
- Throwing sinks and metadata rejection do not alter provider/model/action
  behavior.
- Registry/type tests fail when Ollama or vLLM lacks an audit mapping.
- Existing Prettify HTTP/provider/selected-text/IPC contracts remain green.

## Verification

Run focused checks:

```bash
rtk node --import tsx --test tests/main/prettifyProviders.test.ts tests/main/selectedTextPrettify.test.ts tests/main/prettifyIpcPrivacyContract.test.ts tests/shared/prettifySettings.test.ts
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

- If instrumentation changes request payloads, abort behavior, response
  parsing, model ownership/load order, result/error values, cache, clipboard,
  notifications, settings, or shutdown, restore existing behavior before
  proceeding.
- Roll back only this packet's shared/HTTP Prettify audit hooks and focused
  tests. Audit lines rotate normally and require no migration.
- Do not weaken trusted sender checks, endpoint/settings validation, one-shot
  behavior, metadata allowlists, privacy canaries, or terminal invariants.
- Audit must remain a fail-open observer; do not skip cleanup or transform
  provider outcomes because logging failed.

## Manual Gates

- No live Ollama/vLLM request, private selected text, credential, destructive
  model action, commit, push, or release is authorized.
- `MANUAL GATE`: any later desktop HTTP-provider exercise requires separate
  authorization, a synthetic local provider fixture, and non-private text.
  Confirm success/failure correlation, model lifecycle, cancellation,
  severity, and prohibited-field absence.
- Diagnostic text capture and archive export are verified by later packets.

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
  `src/main/services/prettifyProviderBase.ts`,
  `src/main/services/prettifyProviders.ts`,
  `src/main/services/prettifyHttpProviders.ts`, and
  `src/main/services/selectedTextPrettify.ts`.

## Completion And Handoff

- Mark only Packet 05 complete in `tasks/todo.md`.
- Update `tasks/handoff.md` with changed files, operations/causes delivered,
  exact checks/results, and blockers.
- Identify the next unchecked packet from the approved plan; do not start it.
- Stop for review. Do not commit, push, open a pull request, or begin another
  packet without separate incremental-implementation authorization.
