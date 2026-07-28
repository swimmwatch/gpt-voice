# 03 Harden Prettify HTTP Readiness

## Outcome

Every initial and later Ollama or vLLM availability/model-list operation settles within one main-owned absolute
deadline, accepts only bounded valid response contracts, and publishes the existing safe connected or not-connected
result without leaking provider-controlled or private data.

## Prerequisites

- Packets 01 and 02 are complete, reviewed, and committed.
- Approved specification requirements `READY-002` and `READY-003`.
- Preserve the completed diagnostics-remediation boundary and every unrelated worktree change.

## Owned Requirements

- `READY-002`, `READY-003`
- Applicable parts of `FAIL-003`, `FAIL-004`
- Applicable part of `COMP-005`
- `DEP-003`
- `AC-AUTO-011`, `AC-AUTO-012`

## In Scope

- One constructor-injected, main-owned deadline abstraction for Ollama and vLLM availability/model-list work.
- Bounded streaming acquisition and strict structural validation of HTTP readiness responses.
- Closed timeout, cancellation, malformed-contract, and over-limit results.
- Fail-open, exactly-once audit settlement for these operations.
- Deterministic provider, composition-root, privacy, and IPC-compatibility tests.

## Out Of Scope

- Voice or Translation initial-readiness deadlines; Packet 04 owns them.
- Translation browser reset or CloakBrowser settings-save behavior; Packet 05 owns them.
- Prettify generation, cache, model load/unload, cancellation, clipboard, notification, or retained-diagnostic
  behavior.
- Endpoint, provider, model, language, timeout, polling, or retry configuration changes beyond the approved
  readiness deadline and response ceilings.
- Renderer layout, status localization, accessibility, or tooltip changes; Packet 06 owns presentation.
- Database schema, settings migration, dependencies, live providers, network calls, Electron launch, packaging,
  commits, pushes, pull requests, or releases.

## Task Contract

### One absolute operation deadline

1. Add a state-owning main-process HTTP-readiness class with constructor-injected fetch, timer/clock, cancellation,
   and audit dependencies. Do not add a free wrapper around a provider or service.
2. Give every initial and later Ollama or vLLM availability/model-list operation one absolute 10-second deadline.
   The deadline begins when the logical operation starts and includes:
   - connection establishment and request completion;
   - response headers;
   - every response-body chunk;
   - UTF-8 decoding;
   - `JSON.parse`;
   - structural and provider-contract validation;
   - every subsidiary request.
3. Ollama running-model discovery through `/api/ps` uses the originating operation deadline. It receives only the
   remaining budget and never starts a fresh 10-second timer.
4. Compose the deadline with the existing caller-owned cancellation signal without transferring caller ownership.
   Whichever signal wins aborts the provider request once. Classify main deadline expiry as `timed-out` and caller
   cancellation as `cancelled`, even when fetch later rejects with the same platform abort exception.
5. On timeout or cancellation, suppress every late response, parse result, audit phase, terminal attempt, model
   mutation, readiness mutation, and renderer publication from that operation. Cleanup and settlement must remain
   idempotent when timer, caller signal, fetch rejection, and provider completion race.

### Bounded response acquisition and validation

6. Stream each relevant response body before decoding or parsing. Enforce these inclusive ceilings:
   - `4 * 1024 * 1024` UTF-8 bytes per response;
   - `10_000` model objects per logical model-list result;
   - `64` own properties per model object;
   - `16` JSON nesting levels;
   - `512` UTF-8 bytes per model identifier or display name.
7. Reject the next byte, object, property, nesting level, or identifier/name byte beyond a ceiling. Count UTF-8
   bytes, not JavaScript code units. Do not call an unbounded `Response.text()`, `Response.json()`, or equivalent
   whole-body helper on these paths.
8. Recheck the absolute deadline before UTF-8 decode, before and after `JSON.parse`, and before publishing the
   validated result. Synchronous parsing is allowed only after the complete bounded byte sequence is acquired.
9. Apply the same response and structural ceilings to Ollama's primary model-list response and subsidiary running
   model response. Aggregate model-object validation must prevent a provider from bypassing the `10_000` limit by
   splitting work across responses.
10. Reject invalid UTF-8, malformed JSON, arrays or objects of the wrong shape, excessive structure, excessive
    strings, missing required fields, invalid field types, and otherwise malformed successful HTTP responses.
11. A malformed or over-limit HTTP `200` response uses the existing safe `unexpected-response` classification and
    returns the existing closed shape:
    - `success: false`;
    - `availability: unavailable`;
    - `models: []`;
    - a localized safe error.
12. Preserve the approved Ollama and vLLM meanings for valid empty and non-empty model contracts. A reachable
    endpoint is connected only after both HTTP status and the complete applicable response contract are valid.
13. Preserve the current status handling for non-success HTTP responses except where the specification explicitly
    requires the fail-closed readiness shape. Never expose a response body in the returned error.

### Audit and privacy

14. Extend `PrettifyProviderAudit` only when a class-owned deadline terminal or metadata method is necessary. Keep
    the existing schema, closed causes, sequence ordering, severity derivation, and one-terminal/post-terminal
    guarantees.
15. Emit exactly one `timed-out`, `cancelled`, `unexpected-response`, or existing success/failure terminal for the
    logical operation. A subsidiary request, abort rejection, late response, validator failure, or throwing audit
    sink cannot create a second terminal.
16. Audit remains fail-open: missing or throwing audit dependencies cannot delay settlement, change availability,
    retain a response, or alter the provider result.
17. Never log, serialize, return, or retain an endpoint, URL, query, response body, raw error, stack, provider value,
    model identifier/name, API key, credential, prompt, selected text, result text, session, or account value.

## Contracts And Boundaries

- Electron main owns HTTP access, deadlines, abort composition, validation, and audit state.
- Renderer, preload, IPC channel names, payload keys/types, trusted-sender validation, and existing result interfaces
  remain unchanged.
- Stateful deadline/stream ownership is class-based and constructor-injected. Closed stateless structural guards may
  remain pure functions.
- Use named constants at their narrowest canonical owner for all time and size/count ceilings.
- Use native `Response.body`/`ReadableStream` capabilities already supported by the project's Node/Electron target.
  Do not add a runtime polyfill, platform command, native module, or dependency.
- Tests use deterministic synthetic streams and injected clocks/timers. They must not use wall-clock 10-second waits,
  live endpoints, private provider data, or actual network access.

## Expected Files Or Components

- A focused state-owning component such as `src/main/services/prettifyHttpReadiness.ts`
- Optional pure closed guards such as `src/main/services/prettifyHttpModelContracts.ts`
- `src/main/services/prettifyProviderBase.ts`
- `src/main/services/prettifyHttpProviders.ts`
- `src/main/services/prettifyProviders.ts`
- `src/main/services/prettifyProviderAudit.ts` only if class-owned timed-out settlement support is required
- `src/main/di/mainProcessCompositionRoot.ts`
- `src/main/main.ts`
- A focused new test such as `tests/main/prettifyHttpReadiness.test.ts`
- `tests/main/prettifyProviders.test.ts`
- `tests/main/providerAuditPrivacy.test.ts`
- `tests/main/prettifyIpcPrivacyContract.test.ts`
- `tests/main/mainProcessCompositionRoot.test.ts`
- `tests/shared/prettifySettings.test.ts`
- `tests/main/preloadApi.test.ts` for compatibility verification

Renderer components, locale catalogs, preload production code, shared IPC contracts, database repositories, and
lockfiles are not expected to change in this packet.

## Acceptance Criteria

- Never-resolving Ollama and vLLM primary and subsidiary requests settle at exactly one logical 10-second deadline,
  abort once, publish not connected, and release the startup gate.
- Caller cancellation before the deadline is `cancelled`; deadline expiry is `timed-out`; identical native abort
  exceptions cannot blur the classification.
- A subsidiary Ollama request receives only remaining time and cannot extend the operation beyond 10 seconds.
- Exact-limit and one-over fixtures cover 4 MiB response bodies, 10,000 model objects, 64 properties, 16 nesting
  levels, and 512 UTF-8-byte identifiers/names, including multibyte strings.
- Tests include oversized strings/arrays, invalid UTF-8, malformed JSON, wrong field types, parser-amplification
  shapes, missing or throwing response streams, and the Ollama running-model response.
- Every malformed or over-limit HTTP `200` fixture returns `success: false`, `availability: unavailable`,
  `models: []`, a safe localized error, and one `unexpected-response` audit terminal.
- Existing valid empty/non-empty Ollama and vLLM contract semantics remain passing.
- Late completion after timeout/cancellation cannot mutate model options, readiness, audit events, or renderer state.
- Event counts are bounded independently of response chunk count, and audit dependency failure cannot keep the
  operation pending.
- Privacy canaries prove that endpoints, bodies, raw errors, model values, credentials, prompts, results, sessions,
  and accounts are absent from returned errors, audits, logs, and test snapshots.
- Shared Prettify result shapes, trusted IPC, preload validation, cache/provider behavior, and platform-neutral
  Node/Electron compatibility remain unchanged.

## Verification

Run the focused checks first:

```bash
rtk proxy node --import tsx --test \
  tests/main/prettifyHttpReadiness.test.ts \
  tests/main/prettifyProviders.test.ts \
  tests/main/providerAuditPrivacy.test.ts \
  tests/main/prettifyIpcPrivacyContract.test.ts \
  tests/main/mainProcessCompositionRoot.test.ts \
  tests/shared/prettifySettings.test.ts \
  tests/main/preloadApi.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check
```

If shared provider/runtime composition changes beyond the expected focused seam, also run:

```bash
rtk npm test
```

Do not run Electron, contact Ollama/vLLM, use a private endpoint, or wait on a real network timeout.

## Failure And Rollback

- Any unbounded whole-body read, refreshed subsidiary deadline, duplicate abort/terminal, late mutation, or malformed
  contract reported as connected blocks completion.
- If the target Node/Electron stream API cannot establish the byte boundary consistently on supported platforms,
  leave the packet incomplete and document the exact compatibility blocker. Do not add a dependency or relax the
  ceiling.
- Rollback is a scoped revert of the internal HTTP-readiness adapter, provider/factory injection, audit extension,
  and focused tests. No database/settings migration, IPC rollback, or user-data repair is required.

## Manual Gates

None in this packet. Packaged Linux and Windows never-resolving-endpoint verification is `AC-MAN-003` and belongs to
the final integration/manual packet.

## References

- Mandatory project guidance:
  [Dependency Injection And Runtime Ownership](../../../agent-guides/project-conventions.md#dependency-injection-and-runtime-ownership),
  [Electron And Providers](../../../agent-guides/project-conventions.md#electron-and-providers),
  and [Tests And Documentation](../../../agent-guides/project-conventions.md#tests-and-documentation).
- Specification anchors:
  [Prettify HTTP Deadline and Contract Validity](../spec.md#prettify-http-deadline-and-contract-validity),
  [Failure Behavior](../spec.md#failure-behavior), and
  [Compatibility, Migration, and Rollback](../spec.md#compatibility-migration-and-rollback).
- Review evidence:
  [Finding 2](../../../reviews/2026-07-28-current-branch-code-security-review.md#2-startup-can-remain-permanently-covered-by-the-loader)
  and
  [Finding 9](../../../reviews/2026-07-28-current-branch-code-security-review.md#9-malformed-prettify-model-contracts-are-displayed-as-connected).

## Completion And Handoff

After all automated checks pass:

1. mark only Packet 03 complete in [todo.md](todo.md);
2. update [handoff.md](handoff.md) with changed files, concise check results, residual stream/platform risks, and
   Packet 04 as the exact next packet;
3. leave Packet 03 unstaged and uncommitted for review;
4. stop without starting Packet 04 or a packaged-platform gate.
