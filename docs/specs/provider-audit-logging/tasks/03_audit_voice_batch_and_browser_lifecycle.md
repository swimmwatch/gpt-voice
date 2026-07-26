# 03 Audit Voice Batch And Browser Lifecycle

## Outcome

Instrument the Voice registry, generic browser/session lifecycle, ChatGPT batch
provider, and OpenAI API batch provider with the shared schema-v1
`provider-audit` lifecycle. Preserve provider results, login/settings behavior,
cache semantics, retries, page recovery, clipboard, history, and renderer IPC.

## Prerequisites

- Packet 01 (shared provider-audit contracts, canonical sink, operation state,
  safe metadata builders, severity, error normalization, and mapping
  exhaustiveness) is completed, verified, and approved.
- The approved specification and its Voice operation/cause mappings remain
  authoritative.
- Packet 04 owns Claude Web buffered/streaming provider details. This packet
  must leave clear shared Voice lifecycle seams for that follow-up without
  partially instrumenting Claude streaming.

## Owned Requirements

- `SCOPE-002` for Voice registry, settings/readiness, browser session, batch
  transcription, bounded ChatGPT retry/recovery, cleanup, and shutdown.
- `VOICE-001`, `VOICE-002`, `VOICE-003`, and `VOICE-006`.
- Voice batch/browser portions of `COMP-001` and `COMP-002`.
- Voice application of `SEC-001`, `SEC-002`, and `SEC-003`, including the
  metadata-only privacy canaries required by `AC-AUTO-001`.
- Voice batch/browser portions of `AC-AUTO-001`: ChatGPT/OpenAI success, typed
  failure, exception, retry/recovery, rate limit, contract failure, cleanup,
  registry mapping, and fail-open behavior.
- Packet 01 remains the primary owner of the shared schema and sink
  requirements; this packet consumes and proves them for Voice batch/browser
  paths.

## In Scope

- Exhaustive audit mapping for the registered Voice IDs `chatgpt`,
  `openai-api`, and `claude-web`, while leaving Claude-specific operation
  instrumentation to Packet 04.
- Unknown-provider validation in the registry and privileged provider
  dispatch paths.
- Generic Voice operations `initialize`, `settings-readiness`, `session-load`,
  `session-save`, `session-clear`, `readiness`, `credential-refresh`,
  `transcribe-batch`, `recovery`, and `shutdown`.
- Browser-owned provider initialization, session loading, readiness, provider
  switching/restart, cleanup, and shutdown.
- ChatGPT session and cached-token lifecycle, page initialization/readiness,
  bounded authentication refresh, HTTP attempt/status handling, rate-limit
  cooldown, transport interruption, independent page recovery, response
  contract validation, success, and shutdown.
- OpenAI API settings/key readiness, request transport, numeric HTTP status,
  response parsing/contract checks, empty result, success, and failure.
- Consolidation of overlapping free-form Voice provider-operation logs while
  retaining distinct browser infrastructure, cache, history, settings,
  clipboard, and application logs.
- Focused registry, browser, provider, batch service, privacy, severity,
  terminal-invariant, and compatibility tests.

## Out Of Scope

- Claude Web provider-specific readiness, organization routing, buffered audio
  transport, streaming start/push/finish/cancel, and streaming aggregation;
  those belong to Packet 04.
- Voice audio or transcript persistence/export and any change to transcription
  history.
- Cache-key changes, cache-hit audit operations, retry-policy changes,
  automatic replay, browser launch changes, provider settings migration, or
  session storage format changes.
- Renderer audit handles, new IPC outcomes, localized error changes, or
  provider result shape changes.
- Raw audio, multipart bodies, prompts, model values, response bodies,
  transcripts, session/token/cookie data, account data, URLs, file paths,
  arbitrary error messages, or stacks in audit events.

## Task Contract

1. Use the Packet 01 main-process API for every audit event. The stable sink is
   scope `provider-audit`, label `Provider audit event`, and one canonical
   single-line schema-v1 JSON string. Provider code must not call the sink with
   an arbitrary object or `Error`.
2. Make Voice provider/audit mapping exhaustive. If a closed Voice provider ID
   type is introduced to replace the current `Map<string, ...>` weakness, keep
   it main/shared metadata-safe and do not widen renderer provider metadata.
   Registry/type tests must fail when a registered provider lacks an audit
   mapping.
3. Registry enumeration (`getAvailableProviders`) is metadata discovery, not
   provider initialization, and must not emit fake lifecycle operations.
   Explicit provider creation/dispatch is `initialize`.
4. An unknown provider rejected before dispatch emits one failure operation
   with `family: voice`, `providerKnown: false`, no `providerId`, and no
   rejected candidate anywhere in captured logger arguments. Preserve the
   existing throw/return outcome at each caller.
5. Browser/session work uses the approved operations and semantic phases:
   `dispatch`, `validation`, `configuration`, `session`, `readiness`,
   `context`, `navigation`, `recovery`, `cleanup`, and `shutdown`. A dispatched
   operation has one start, bounded phase events, and exactly one terminal.
6. Do not start `transcribe-batch` before the transcription cache decision. A
   cache hit remains a cache/application action and creates no provider-audit
   operation. Cache lookup/storage/history failures retain their existing
   fail-open behavior and logs.
7. A ChatGPT batch transcription uses one operation ID across request attempts,
   authentication refresh within the existing two-attempt bound, and the
   request terminal. Emit `retry` before the second attempt and record only
   approved safe metadata such as `attemptCount`, numeric `httpStatus`,
   `inputByteLength`, `hasMimeType`, and retry/recovery booleans.
8. Do not append a recovery completion event after a failed transcription has
   terminated. The currently asynchronous ChatGPT page reload is an independent
   `recovery` operation with its own opaque ID: the failed transcription may
   report `recoveryScheduled: true`, then terminate; the recovery operation
   starts and terminates independently. A later manual buffered retry receives
   a new transcription operation ID and may await that recovery without
   replaying the prior audio.
9. Map ChatGPT/OpenAI terminal causes only to the approved Voice set:
   `not-configured`, `not-authenticated`, `rate-limited`,
   `connection-failed`, `request-failed`, `unexpected-response`,
   `empty-result`, `cancelled`, `provider-contract-changed`,
   `cleanup-failed`, and `unknown`.
10. Preserve existing ChatGPT distinctions:
    - missing/expired session or missing token is configuration/auth readiness;
    - `401`/`403` authentication response may schedule only the existing single
      token-refresh retry;
    - `429` retains bounded retry-after/cooldown behavior and may include only
      numeric status and safe timing/count metadata;
    - page request timeout/network/context interruption reports transport
      cause, whether the page is closed/current only through approved
      booleans, and whether independent recovery was scheduled;
    - malformed/changed response and empty result remain distinct;
    - ambiguous transport failure never replays audio automatically.
11. Preserve existing OpenAI API distinctions:
    - key presence is a boolean readiness fact, never a credential value or
      length;
    - request audit includes input byte length and MIME presence only;
    - HTTP failure may include numeric status, never response body/error text;
    - JSON/contract failure and empty result remain separate;
    - prompt, model value, language value, authorization header, multipart
      content, raw result, and transcript are prohibited.
12. Audit explicit session load/save/clear, readiness, and credential refresh
    wherever those calls are dispatched, including browser startup, login,
    provider settings/auth mutation, restart/switch, and quit cleanup. Avoid
    wrapping pure getters or registry enumeration in uncontrolled duplicate
    operations.
13. Expected validation/auth/provider failures are `warn`; success, progress,
    retry/recovery, explicit cancellation, and stale outcomes are `info`;
    unexpected exceptions, corrupted/changed response contracts, and uncertain
    cleanup ownership are `error`.
14. Audit emission is fail open. Missing logger runtime, throwing sink,
    metadata rejection, ID/clock failure, or serialization failure never
    changes provider state, retry decisions, returned errors, clipboard,
    history, cache, browser ownership, or IPC behavior.
15. Remove or narrow superseded free-form operation messages in
    `browser.ts`, `transcription.ts`, ChatGPT/OpenAI providers, and related IPC
    handlers. Keep distinct settings persistence, cache, clipboard, history,
    notification, and browser-launch infrastructure diagnostics.

## Contracts And Boundaries

- Main remains the sole owner of Electron, filesystem/session access, provider
  instances, browser contexts, network calls, credentials, clipboard, history,
  audit IDs, and the audit sink.
- Renderer code continues to use only `window.electronAPI`. If an internal
  audit operation handle is added to a main-only call, it must not appear in
  preload or renderer type declarations.
- `BaseVoiceProvider` and the provider registry remain the Voice abstraction.
  Instrumentation may add main-only dependencies/wrappers, but cannot weaken
  nominal batch/streaming guards or expose privileged methods.
- Keep trusted sender validation around provider login, settings, auth clear,
  provider switch, and transcription IPC.
- Existing `TranscriptionResult` fields, including legacy provider `raw`
  values, remain behaviorally compatible but must never enter audit events.
- Known exception classification is supplied by Packet 01. Unrecognized
  `Error.name`, messages, stacks, paths, URLs, bodies, and provider-controlled
  names are not retained.
- No event follows its terminal. Every catch/finally path must preserve that
  invariant even when browser/provider cleanup itself fails.

## Expected Files Or Components

- `src/shared/voiceProvider.ts` only if needed for a closed exhaustive provider
  ID/mapping contract.
- `src/main/providers/index.ts`
- `src/main/providers/BaseVoiceProvider.ts`
- `src/main/providers/BatchVoiceProvider.ts` only if the internal audit
  contract belongs on the batch abstraction.
- `src/main/browser.ts`
- `src/main/providers/ChatGPTVoiceProvider.ts`
- `src/main/providers/OpenAIApiVoiceProvider.ts`
- `src/main/providers/transcriptionErrors.ts`
- `src/main/services/transcription.ts`
- `src/main/services/transcriptionCompletion.ts` only to preserve cache/history
  separation or remove overlapping provider-operation logging.
- `src/main/ipc.ts` for audited provider validation/login/settings/auth dispatch
  without changing trusted sender behavior.
- `src/main/main.ts` only for existing Voice shutdown orchestration.
- Packet 01 audit API and Voice mapping components.
- `tests/main/providers/providerRegistry.test.ts`
- `tests/main/providers/BaseVoiceProvider.test.ts`
- `tests/main/providers/ChatGPTVoiceProvider.test.ts`
- `tests/main/providers/OpenAIApiVoiceProvider.test.ts`
- `tests/main/providers/transcriptionErrors.test.ts`
- `tests/main/transcription.test.ts`
- `tests/main/browserSessionStartup.test.ts`
- `tests/main/backgroundBrowserLifecycle.test.ts`
- `tests/main/providerSettingsIpcContract.test.ts`
- Add a focused browser/provider lifecycle test seam if current hard-wired
  imports prevent deterministic audit assertions; do not use a live browser.

## Acceptance Criteria

- Voice registry/type tests prove the three registered providers have audit
  mappings and unknown IDs are omitted from audit events.
- Browser initialization, settings readiness, session load/save/clear,
  readiness, credential refresh, switch/restart, cleanup, and shutdown produce
  bounded lifecycles without changing current results.
- ChatGPT tests cover success, missing auth, typed response failure, unexpected
  exception, the existing one auth retry, rate limit/cooldown, transport
  interruption without replay, independent recovery, malformed/changed
  response, empty result, and cleanup.
- OpenAI API tests cover key absence, success, transport exception, numeric
  HTTP failure, rate limit, malformed JSON/contract, empty result, and cleanup.
- Cache hits create no Voice provider-audit operation and preserve clipboard
  and history completion.
- Each operation has positive monotonic sequence values beginning at `1`,
  exactly one terminal, and no event after terminal. Independent recovery has a
  distinct ID.
- Severity follows the approved outcome/cause rules.
- A throwing sink and rejected metadata do not alter results, retries,
  browser/session ownership, cache, history, or clipboard.
- Privacy canaries placed in audio-adjacent buffers/metadata, prompt/model
  settings, transcripts/raw results, credentials/tokens/cookies/sessions,
  account data, URLs, bodies, exception messages/stacks, and filesystem paths
  are absent from all captured audit logger arguments.
- Existing localized errors, provider result contracts, browser lifecycle,
  provider settings, cache, clipboard, history, and IPC tests remain
  compatible.

## Verification

Run focused checks:

```bash
rtk node --import tsx --test tests/main/providers/providerRegistry.test.ts tests/main/providers/BaseVoiceProvider.test.ts tests/main/providers/ChatGPTVoiceProvider.test.ts tests/main/providers/OpenAIApiVoiceProvider.test.ts tests/main/providers/transcriptionErrors.test.ts tests/main/transcription.test.ts tests/main/browserSessionStartup.test.ts tests/main/backgroundBrowserLifecycle.test.ts tests/main/providerSettingsIpcContract.test.ts
rtk node --import tsx --test tests/main/providerAudit/providerAudit.test.ts tests/main/providerAudit/providerAuditMappings.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
```

Run the full unit suite if shared Voice/provider contracts or IPC registration
changed:

```bash
rtk npm run test:unit
```

## Failure And Rollback

- If audit work changes login/session persistence, retry bounds, response
  parsing, result text/errors, cache/history/clipboard effects, browser
  readiness, or IPC outcomes, restore the prior behavior before continuing.
- Roll back this packet's Voice batch/browser instrumentation and focused tests
  only. Audit log lines require no migration and rotate normally.
- Do not weaken trusted sender checks, batch/stream nominal guards, metadata
  allowlists, privacy canaries, or terminal invariants to obtain a passing
  result.
- If provider behavior depends on audit success, treat that as a defect:
  restore fail-open observation rather than handling the provider differently.

## Manual Gates

- No credentials, real account sessions, private audio, commits, pushes,
  releases, or external provider calls are authorized.
- `MANUAL GATE`: any later desktop exercise requires separate authorization
  and synthetic non-private audio/settings. Confirm one ChatGPT and OpenAI
  success/failure path, correlation, severity, retry/recovery semantics, and
  absence of prohibited content.
- Platform archive/export verification belongs to later packets.

## References

- Mandatory: `docs/specs/provider-audit-logging/spec.md`, sections
  **Provider Audit Event Contract**, **Audit Metadata and Error
  Normalization**, **Family Requirements / Voice**, **Security and Privacy**,
  **Failure Behavior**, **Compatibility**, and **Acceptance Criteria /
  Provider Audit**.
- Mandatory: Packet 01's shared audit API task packet.
- Mandatory: `docs/agent-guides/project-conventions.md`, sections **Code And
  Logging**, **Electron And Providers**, and **Tests And Documentation**.
- Local implementation references: `src/main/providers/index.ts`,
  `src/main/providers/BaseVoiceProvider.ts`, `src/main/browser.ts`,
  `src/main/providers/ChatGPTVoiceProvider.ts`,
  `src/main/providers/OpenAIApiVoiceProvider.ts`, and
  `src/main/services/transcription.ts`.

## Completion And Handoff

- Mark only Packet 03 complete in `tasks/todo.md`.
- Update `tasks/handoff.md` with changed files, delivered operations/causes,
  exact verification commands/results, and blockers.
- Name Packet 04 as the next packet only when it is the next unchecked,
  authorized task; do not begin it automatically.
- Stop for review. Do not commit, push, open a pull request, or start another
  packet without a separate incremental-implementation invocation.
