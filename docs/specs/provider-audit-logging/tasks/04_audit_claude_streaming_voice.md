# 04 Audit Claude Streaming Voice

## Outcome

Complete Voice audit coverage for Claude Web buffered fallback and live
streaming. Reuse the main-generated streaming operation UUID for one bounded
schema-v1 lifecycle, preserve Claude's existing typed errors and ownership
rules, and prohibit per-chunk or per-poll audit growth.

## Prerequisites

- Packet 01 (shared provider-audit core) is completed, verified, and approved.
- Packet 03 is completed, verified, and approved so the Voice registry,
  browser/session lifecycle, batch conventions, and Voice audit mapping are
  established.
- Preserve the current nominal `ClaudeWebVoiceProvider` capability resolver,
  main-process operation ownership, copied PCM boundary, and trusted streaming
  IPC controller.

## Owned Requirements

- `VOICE-001` for Claude buffered and streaming envelope compatibility.
- `VOICE-004`, `VOICE-005`, and `VOICE-006`.
- `AUD-002` and `PERF-001` for Claude streaming/readiness detail.
- Claude buffered/streaming portions of `AC-AUTO-001`, including success,
  typed failure, exception, readiness/recovery, cancellation, rate limit,
  contract failure, cleanup, bounded counters, terminal invariants, and privacy
  canaries.
- Packet 01 remains the primary owner of shared audit schema rules; Packet 03
  remains the primary owner of generic Voice browser/session lifecycle.

## In Scope

- Claude Web provider-specific settings/readiness and safe failure mapping.
- Buffered Claude `transcribe-batch` using the Voice envelope.
- Live `transcribe-stream` start, semantic streaming phase, finish,
  cancellation, typed failure, cleanup, and shutdown.
- Reuse of a valid main-generated streaming UUID as the audit `operationId`.
- Main validation/ownership failures that terminate or reject streaming work,
  without retaining renderer-supplied IDs.
- Aggregate accepted byte/chunk/frame counters at terminal.
- Provider/transport readiness and bounded recovery phases without poll-level
  events.
- Consolidation of overlapping Claude/streaming free-form operation logs.
- Focused provider, service, transport-mapping, IPC-controller, privacy,
  severity, and bounded-volume tests.

## Out Of Scope

- Changes to Claude Web session format, settings, organization routing rules,
  speech protocol, WAV validation, PCM sizes/cadence, socket behavior,
  timeouts, retry policy, or page selectors.
- Automatic batch replay after a streaming failure.
- Per-PCM-chunk success events, per-keepalive events, per-provider-event logs,
  token/progress logs, or readiness/result poll logs.
- Voice audio/transcript persistence or diagnostic result capture.
- Renderer-created audit IDs, renderer logging handles, or changes to the
  existing streaming IPC result types.
- Account/organization identity, session data, socket query values, audio,
  transcript/event payloads, browser/page content, URLs, response bodies,
  exception messages/stacks, or raw transport diagnostic objects in audit
  metadata.

## Task Contract

1. Use the Packet 01 operation API and Packet 03 Voice mapping. Do not create a
   second Claude-specific sink or schema.
2. `ClaudeWebVoiceProvider.transcribe()` is a `transcribe-batch` operation with
   the same envelope and cause/severity rules as Packet 03. It gets a fresh
   main-generated ID and preserves its existing buffered fallback result.
3. A valid live stream is one `transcribe-stream` operation. Reuse the UUID
   created by `StreamingTranscriptionService.start()` as the audit operation
   ID. The main service is the lifecycle owner; provider and page transport
   report closed semantic facts through that operation instead of emitting a
   duplicate start or terminal.
4. Emit `started` only after main has accepted a concrete registered provider
   dispatch and claimed operation ownership. Then emit bounded phases from the
   approved set: `dispatch`, `validation`, `configuration`, `session`,
   `readiness`, `context`, `navigation`, `streaming`, `result`, `recovery`,
   `cleanup`, and `shutdown`.
5. Do not emit on every successful `pushStreamingTranscriptionChunk`. At most
   one semantic transition into `streaming` is emitted. Terminal metadata may
   contain `acceptedByteCount`, `chunkCount`, and `frameCount`; these counters
   are aggregate numeric facts and never content-derived hashes.
6. Invalid sequence/chunk/audio, operation conflict, provider change,
   cancellation, and transport failure terminate an owned active operation
   exactly once. Duplicate finish, late push, late provider completion, and
   lifecycle cancellation cannot append events after terminal.
7. Rejections before a valid returned streaming UUID may use a fresh internal
   opaque audit ID and one bounded failure lifecycle. Never use or serialize an
   untrusted renderer-supplied operation ID. Wrong-owner/unknown/late IPC calls
   must not mutate or add events to another operation.
8. Preserve the shared streaming codes exactly:
   `cancelled`, `invalid-audio`, `invalid-chunk`, `invalid-operation`,
   `invalid-sequence`, `operation-conflict`, `provider-changed`, and
   `transport-failure`.
9. Preserve Claude Web's safe provider codes exactly:
   `session-missing`, `session-expired`, `session-invalid`,
   `feature-unavailable`, `organization-missing`,
   `organization-ambiguous`, `invalid-settings`, `invalid-audio`,
   `upgrade-or-auth`, `connect-timeout`, `connection-loss`,
   `malformed-event`, `rate-limit`, `first-event-timeout`,
   `overall-timeout`, `drain-timeout`, `empty-result`, `cancelled`,
   `page-shutdown`, and `unexpected-failure`.
10. Readiness/recovery and startup polling emit only semantic phase,
    retry/recovery, and terminal events. Increasing readiness, socket, drain,
    or result poll/keepalive counts must not increase audit event count.
11. Map only Packet 01 allowlisted transport facts. Existing
    `ClaudeWebPageTransportDiagnostics` must not be spread into an event.
    Specifically prohibit organization UUID/scope, URL/query, event type or
    payload, close reason/body, transcript, bytes containing audio, page data,
    and arbitrary transport exceptions. Use aggregate counters and a closed
    cause code only where approved.
12. A successful finish emits its provider terminal after the validated
    provider result and provider-owned cleanup, independently of later
    cache/clipboard/history completion side effects. Those application effects
    retain their existing outcomes and distinct logs; their failure cannot
    rewrite or delay the provider terminal. Preserve existing copied-audio
    zeroization.
13. Explicit cancellation is an `info` terminal. Typed readiness, rate-limit,
    timeout, and expected transport failures are `warn`. Malformed contracts,
    unexpected exceptions, and cleanup ownership uncertainty are `error`.
14. Provider cancellation and transport drain remain best effort exactly as
    today. Audit failure never changes whether main releases ownership,
    zeroizes buffers, cancels transport, allows retry, or returns a result.
15. On provider/browser/app shutdown, active operations terminate at most once,
    then the existing transport cancellation/drain and base cleanup run.
    `shutdown` uses its own operation and cannot revive a terminated stream.
16. Remove or narrow superseded `claude-web-provider` and
    `streaming-transcription` operation logs. Keep distinct IPC rejection,
    recording, cache, clipboard, history, and browser infrastructure logs when
    they are not duplicate provider lifecycle records.

## Contracts And Boundaries

- Main creates and validates streaming IDs, owns provider capability and active
  operation state, and writes audit events. Renderer ownership tokens and
  copied PCM boundaries remain unchanged.
- Preserve `resolveStreamingVoiceProviderCapability`: only the nominal
  `ClaudeWebVoiceProvider` with the exact registered ID receives privileged
  live operations.
- Preserve `StreamingTranscriptionOperationError`,
  `MainStreamingTranscriptionRejection`, lifecycle/result enums, and renderer
  retry-eligibility behavior.
- Never include audio bytes, recording WAV, chunk contents, transcript text,
  operation-owner tokens, cache keys, session/account/organization data, URLs,
  provider event payloads, stdout/stderr, raw errors, or stacks in audit
  arguments.
- Streaming IDs are safe only because main generated them. Do not treat
  renderer-provided candidate IDs as trusted audit IDs.
- Audit observation is fail open and may not hold provider/transport ownership
  or audio buffers longer than existing behavior.

## Expected Files Or Components

- `src/main/providers/ClaudeWebVoiceProvider.ts`
- `src/main/providers/streamingVoiceProvider.ts`
- `src/main/providers/streamingVoiceProviderCapability.ts`
- `src/main/providers/StreamingTranscriptionOperationError.ts`
- `src/main/providers/claudeWebPageTransport.ts` only if a closed safe mapping
  hook is required; do not change transport behavior.
- `src/main/services/streamingTranscription.ts`
- `src/main/streamingTranscriptionIpcController.ts` only if correlation must be
  passed through main-owned controller state; do not broaden IPC authority.
- Packet 01 audit API and Packet 03 Voice/Claude mapping.
- `tests/main/providers/ClaudeWebVoiceProvider.test.ts`
- `tests/main/providers/claudeWebPageTransport.test.ts`
- `tests/main/providers/providerRegistry.test.ts`
- `tests/main/streamingTranscription.test.ts`
- `tests/main/streamingTranscriptionIpcController.test.ts`
- `tests/shared/streamingTranscription.test.ts`

## Acceptance Criteria

- Buffered Claude success/failure uses `transcribe-batch` with one terminal and
  the existing result contract.
- A valid live operation's audit ID equals its main-generated streaming UUID.
  Provider/service layers do not duplicate start or terminal events.
- Streaming success, typed provider failure, invalid sequence/chunk/audio,
  conflict, provider change, explicit/lifecycle cancellation, rate limit,
  transport failure, contract failure, cleanup, and shutdown are covered.
- Successful chunk pushes do not emit per-chunk audit events. Increasing chunk,
  readiness-poll, event, keepalive, or result-poll counts does not increase
  lifecycle event count.
- Terminal aggregate counters are accurate and limited to approved numeric
  fields. Operation IDs, audio, transcript, and provider event payloads are
  absent from arbitrary diagnostic metadata.
- Duplicate/late operations produce no post-terminal events and cannot disturb
  a claimed finish or another owner.
- Existing retry eligibility, zeroization, clipboard, cache, history,
  cancellation, shutdown, and IPC results remain unchanged.
- A throwing audit sink and metadata rejection do not alter ownership,
  cancellation/drain, buffer clearing, or terminal results.
- Privacy canaries placed in audio/chunks/WAV, transcript, organization/session
  state, query/URL, provider events/bodies, exception messages/stacks, and
  renderer-supplied IDs are absent from captured audit logger arguments.
- Registry/type tests continue to fail when Claude lacks an audit mapping.

## Verification

Run focused checks:

```bash
rtk node --import tsx --test tests/main/providers/ClaudeWebVoiceProvider.test.ts tests/main/providers/claudeWebPageTransport.test.ts tests/main/providers/providerRegistry.test.ts tests/main/streamingTranscription.test.ts tests/main/streamingTranscriptionIpcController.test.ts tests/shared/streamingTranscription.test.ts
rtk node --import tsx --test tests/main/providerAudit/providerAudit.test.ts tests/main/providerAudit/providerAuditMappings.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
```

Run the full unit suite if shared streaming or Voice contracts changed:

```bash
rtk npm run test:unit
```

## Failure And Rollback

- If instrumentation changes chunk validation, operation ownership, retry
  eligibility, provider routing, buffer zeroization, finish/cancel ordering,
  transport drain, result text/error, clipboard/cache/history, or IPC output,
  restore existing behavior before proceeding.
- Roll back only this packet's Claude/streaming audit hooks and focused tests.
  Existing audit lines rotate normally and require no migration.
- Never weaken nominal capability checks, trusted IPC ownership, copied buffer
  boundaries, event bounds, privacy allowlists, or terminal invariants.
- Treat any dependency on audit success as a fail-open defect; do not suppress
  provider errors to keep logging active.

## Manual Gates

- No real Claude session, private audio, external provider request, commit,
  push, release, or destructive action is authorized.
- `MANUAL GATE`: a later desktop streaming exercise requires separate
  authorization and synthetic non-private audio. Confirm correlation across
  start/finish or failure, bounded event count, aggregate counters, terminal
  severity, and absence of audio/transcript/session/organization content.
- Archive and optional text-capture verification belong to later packets.

## References

- Mandatory: `docs/specs/provider-audit-logging/spec.md`, sections
  **Provider Audit Event Contract / Lifecycle Invariants**, **Bounded
  High-Frequency Detail**, **Audit Metadata and Error Normalization**, **Family
  Requirements / Voice**, **Security and Privacy**, and **Acceptance Criteria /
  Provider Audit**.
- Mandatory: Packet 01 shared audit core and
  `tasks/03_audit_voice_batch_and_browser_lifecycle.md`.
- Mandatory: `docs/agent-guides/project-conventions.md`, sections **Code And
  Logging**, **Electron And Providers**, and **Tests And Documentation**.
- Local implementation references:
  `src/main/providers/ClaudeWebVoiceProvider.ts`,
  `src/main/services/streamingTranscription.ts`,
  `src/main/providers/streamingVoiceProviderCapability.ts`, and
  `src/shared/streamingTranscription.ts`.

## Completion And Handoff

- Mark only Packet 04 complete in `tasks/todo.md`.
- Update `tasks/handoff.md` with changed files, delivered Claude/streaming
  lifecycle coverage, exact checks/results, and blockers.
- Name the next unchecked approved packet; do not begin it.
- Stop for review. Do not commit, push, open a pull request, or start another
  packet without separate incremental-implementation authorization.
