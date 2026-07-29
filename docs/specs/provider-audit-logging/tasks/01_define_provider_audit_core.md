# 01 Define The Provider Audit Core

## Outcome

A main-process-only provider audit module defines the complete schema-v1 event
contract, validates its strict metadata allowlist, owns opaque correlation and
terminal state, derives severity, serializes canonical single-line JSON, and
emits fail-open through the existing `electron-log` file transport under one
`provider-audit` scope. Exhaustive mappings cover every currently registered
Voice, Prettify, and Translation provider before any provider integration is
activated.

## Prerequisites

- The specification status is `Approved`.
- The plan is approved.
- Task 01 has separate execution authorization.
- Read the “Code And Logging” and “Electron And Providers” sections of
  `docs/agent-guides/project-conventions.md`.

## Owned Requirements

- `OUT-001`
- `SCOPE-001`
- `BASE-001`
- `ARCH-001`–`ARCH-003`
- `AUD-001`–`AUD-007`
- `PERF-001`
- `SEC-001`–`SEC-003`
- `FAIL-001`
- `CFG-001`
- `OPS-001`–`OPS-003`
- `COMP-001`–`COMP-002`
- `NONGOAL-001`–`NONGOAL-003`
- Shared/core portion of `AC-AUTO-001`

## In Scope

- Closed audit family, provider, operation, phase, event, outcome, severity,
  cause, error-class, exception-type, and optional metadata contracts.
- Exhaustive current-provider mapping tables and compile/runtime guards.
- One injected lifecycle object per operation with opaque ID, monotonic
  sequence, semantic events, and terminal enforcement.
- Canonical JSON serialization and the exact `provider-audit` sink.
- Runtime allowlist rejection, severity derivation, fail-open behavior, and
  privacy canaries.
- Focused unit/type tests only; no provider call is instrumented in this packet.

## Out Of Scope

- Voice, Prettify, or Translation provider/service edits.
- Diagnostic text settings, redaction, SQLite, archive export, About UI, IPC,
  analysis skill, documentation, packaging, or manual provider execution.
- Remote telemetry, a dedicated audit file, a log viewer, compliance ledger,
  renderer logging handles, or changes to existing log rotation.
- Changes to provider results, retry/fallback limits, localized messages,
  cache/clipboard/history behavior, or existing non-provider logs.

## Task Contract

1. Add a main-only `src/main/providerAudit/` module. Keep audit types out of
   renderer/shared IPC contracts. Use:
   - `contracts.ts` for schema-v1 closed types and runtime guards;
   - `mappings.ts` for exhaustive family/provider/cause mappings;
   - `providerAudit.ts` for lifecycle state, canonical serialization, severity,
     and sink creation;
   - `index.ts` as the narrow provider-facing export surface.
2. Define current provider IDs exactly:
   - Voice: `chatgpt`, `openai-api`, `claude-web`;
   - Prettify: `ollama`, `vllm`, `claude-cli`, `codex-cli`;
   - Translation: `google`, `bing`, `yandex`.
     Mapping declarations must use exhaustive `Record`/`satisfies` relationships
     to the applicable registries or closed internal unions so a new provider
     cannot typecheck without an audit mapping.
3. Define operation IDs exactly as approved:
   - Voice: `initialize`, `settings-readiness`, `session-load`,
     `session-save`, `session-clear`, `readiness`, `credential-refresh`,
     `transcribe-batch`, `transcribe-stream`, `recovery`, `shutdown`;
   - Prettify: `settings-readiness`, `availability`, `capability-check`,
     `model-list`, `model-load`, `model-unload`, `prepare`, `prettify`,
     `process-cleanup`, `shutdown`;
   - Translation: `settings-readiness`, `translate`, `shutdown`.
4. Define phase IDs exactly as
   `dispatch`, `validation`, `configuration`, `session`, `readiness`,
   `context`, `navigation`, `consent-or-challenge`, `source-detection`,
   `target-selection`, `stale-state`, `submission`, `streaming`, `result`,
   `model-discovery`, `model-lifecycle`, `process`, `recovery`, `cleanup`, and
   `shutdown`.
5. Every emitted event contains `schemaVersion: 1`, a main-generated UTC ISO
   timestamp, family, closed operation, opaque operation ID, positive sequence
   beginning at `1`, event, phase, and outcome. A validated provider uses
   `providerId`; pre-dispatch unknown-provider failure omits the raw value and
   sets `providerKnown: false`.
6. Generate new IDs with injected `randomUUID()` by default. Never derive them
   from content, settings, path, process, account, cache, or hashes. Allow a
   caller to supply an already validated opaque streaming ID. Reusing an ID
   must not expose its value outside main or change existing IPC results.
7. The lifecycle API exposes semantic `started`, `phase-entered`,
   `phase-completed`, `retry`, `recovery`, and `terminal` operations. It:
   - emits exactly one start before provider work;
   - increments sequence once for each accepted event;
   - rejects/no-ops any post-terminal event;
   - accepts exactly one terminal outcome of `success`, `failure`,
     `cancelled`, or `stale`;
   - never adds a retry, recovery, cancellation, cleanup, or provider call.
8. Permit only the approved optional keys and validate their values before
   serialization:
   - finite nonnegative `attemptCount`, `durationMs`, `httpStatus`,
     `inputByteLength`, `sourceLength`, `resultLength`, `acceptedByteCount`,
     `chunkCount`, `frameCount`, and `modelNameLength`;
   - closed `causeCode`, `errorClass`, `exceptionType`, `contractVersion`,
     `targetLanguage`, `transcriptionMode`, and `modelSource`;
   - `usesDefaultModel`, `modelConfigured`, `providerKnown`, `hasMimeType`,
     `retryScheduled`, `recoveryScheduled`, `postSubmission`, `pageClosed`,
     `discarded`, `wasSanitized`, `hasMessage`, `hasUrl`, `hasFilePath`, and
     `hasStackTrace` booleans.
     Unknown keys, nonfinite numbers, negative counters, raw objects, `Error`
     instances, messages, stacks, bodies, or arrays are rejected.
9. Use a closed safe error-class taxonomy:
   `validation`, `configuration`, `authentication`, `provider-rejection`,
   `rate-limit`, `connection`, `timeout`, `contract`, `cancellation`,
   `cleanup`, and `internal`. Permit exception types `Error`, `TypeError`,
   `SyntaxError`, `RangeError`, `AbortError`, `TimeoutError`, and `unknown`;
   map every unrecognized or provider-controlled `Error.name` to `unknown`.
10. Include the approved closed family cause codes. Provider packets may select
    only mapped codes; localized text, HTTP/provider bodies, Playwright
    messages, CLI output, and exception text can never become a code.
11. Derive severity centrally:
    - `info` for starts, phase progress, retry/recovery, success, explicit
      cancellation, and stale/discarded completion;
    - `warn` for typed validation/configuration/auth/provider rejection,
      rate limit, expected connection/timeout, and nonfatal capture failure;
    - `error` for unexpected exceptions, changed/corrupt contracts, malformed
      internal results, and ownership-uncertain cleanup.
12. Serialize one canonical object with required keys in the contract order and
    present optional keys in lexical order. Emit exactly the stable label
    `Provider audit event` followed by that single-line JSON string through
    `createLogger('provider-audit')` at the derived level. Do not pass the event
    object or any additional argument to `electron-log`.
13. Wrap clock, ID generation, validation, serialization, severity selection,
    logger lookup, and logger invocation so any failure is swallowed. Builder
    rejection must never fall back to raw logging and must never change a
    provider return/throw path.
14. Keep normal file logging configuration at `info` and existing
    electron-log location/rotation authoritative. Do not add a second transport
    or migrate existing lines.

## Contracts And Boundaries

- Main owns the sink, builders, IDs, state, and mappings. Renderer/preload
  receive none of them.
- Audit events are metadata-only. Tests must reject unique canaries for API
  keys/tokens, cookies/session/storage, account/organization IDs, audio,
  selected text, prompts, transcripts/translations/prettified/model output,
  bodies, stdout/stderr, cache keys/digests, environment, argv, paths, URLs,
  model/base-URL values, and arbitrary exception data.
- Event volume is bounded by semantic phase, attempt, retry, and recovery
  counts; the core offers no chunk/poll/output-stream event API.
- Existing provider-operation free-form logs are not removed until the owning
  family packet replaces them. Infrastructure/settings/application logs remain
  distinct and are not audit events.

## Expected Files Or Components

- Add:
  - `src/main/providerAudit/contracts.ts`;
  - `src/main/providerAudit/mappings.ts`;
  - `src/main/providerAudit/providerAudit.ts`;
  - `src/main/providerAudit/index.ts`;
  - `tests/main/providerAudit/providerAudit.test.ts`;
  - `tests/main/providerAudit/providerAuditMappings.test.ts`.
- Update `src/main/logger.ts` only if a test-only injected scoped-sink seam is
  required; preserve its public behavior and fail-soft loading.
- Reference, but do not modify unless required for exhaustive type linkage:
  - `src/main/providers/index.ts`;
  - `src/main/services/prettifyProviders.ts`;
  - `src/main/translateProviders/index.ts`;
  - applicable shared provider-ID types.

## Acceptance Criteria

- Tests prove every required field, literal schema version, UTC timestamp,
  opaque UUID default, caller-supplied opaque streaming ID, and canonical
  single-line serialization.
- Sequence begins at one, increases monotonically, terminal occurs once, and
  no event follows terminal even when the sink throws.
- Unknown provider input is not serialized; only `providerKnown: false`
  remains.
- Every approved optional key accepts only its declared type/range; every
  unknown key and prohibited object fails closed without raw fallback.
- Severity tests cover progress, success, cancellation, stale, typed expected
  failure, nonfatal capture failure, unexpected exception, contract failure,
  and ownership-uncertain cleanup.
- The throwing/missing sink never changes a synthetic provider outcome.
- Registry/type tests cover all 3 Voice, 4 Prettify, and 3 Translation IDs and
  fail compilation or runtime validation when any mapping is absent.
- Privacy canaries inspect every captured logger argument and find none of the
  prohibited marker values.

## Verification

Run:

```text
rtk node --import tsx --test tests/main/providerAudit/providerAudit.test.ts tests/main/providerAudit/providerAuditMappings.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npx eslint src/main/providerAudit src/main/logger.ts tests/main/providerAudit
rtk npx prettier --check "src/main/providerAudit/**/*.ts" "tests/main/providerAudit/**/*.ts" "src/main/logger.ts"
rtk git diff --check
```

## Failure And Rollback

- Any raw value, message, stack, path, URL, output, content-derived identifier,
  post-terminal event, or sink exception crossing into provider behavior blocks
  completion.
- Rollback removes the unintegrated audit module and focused tests. No provider
  calls or persisted data change in this packet, and existing logs need no
  migration.
- Do not weaken validation/privacy assertions to make a provider mapping fit;
  leave the packet incomplete and repair the mapping.

## Manual Gates

- None. Do not launch Electron, providers, browser sessions, or external
  processes.
- No dependency addition, commit, push, pull request, package, release, or
  publication is authorized.

## References

- Mandatory:
  - `src/main/logger.ts`;
  - `src/main/providers/index.ts`;
  - `src/main/services/prettifyProviders.ts`;
  - `src/main/translateProviders/index.ts`;
  - `docs/agent-guides/project-conventions.md`, “Code And Logging” and
    “Electron And Providers”.
- Traceability:
  - approved specification sections “Provider Audit Event Contract”, “Audit
    Metadata and Error Normalization”, “Security and Privacy”, and “Failure
    Behavior”;
  - decisions `scope.event-coverage`, `operations.high-frequency-events`,
    `operations.severity-policy`, `interfaces.correlation`,
    `security.error-detail`, `interfaces.audit-scope`,
    `interfaces.schema-versioning`, and `failure.audit-sink-unavailable`.

## Completion And Handoff

- Mark Task 01 complete in `todo.md`.
- Update `handoff.md` with created contracts, exact schema values, tests,
  changed files, and Tasks 02, 03, 05, 06, and 07 as independently available
  next packets.
- Present verification evidence and stop. Do not commit or begin a provider
  integration packet in the same invocation.
