# Claude Web Voice Private-Endpoint Research

Status: Task 01 complete. Fresh and independently restored GPT-Voice-style
contexts passed the sanitized authentication and no-audio endpoint checks.

Evidence date: 2026-07-18

## Scope And Data Handling

This record stores endpoint metadata, storage categories and counts, event
names, and pass/fail outcomes only. It never stores credentials, identifiers,
personal page content, audio, transcript text, raw request or response bodies,
screenshots, HAR exports, or browser profiles.

The supplied HAR was parsed locally only to produce the sanitized metadata in
this record. It is excluded from version control and is not a runtime
dependency.

## Tested Contexts

| Context                                   | Outcome                                                                                                                | Limitation                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Fresh isolated Claude context             | Pass: after the user completed sign-in manually, authenticated organization access succeeded.                          | This proves the isolated, fresh-login case only.                                                              |
| Second page in the same isolated context  | Pass: it shares the live browser state.                                                                                | This is in-memory sharing, not a durable restoration.                                                         |
| CloakBrowser MCP context                  | Not suitable for restoration testing.                                                                                  | It is a temporary, headless browser profile with no user-visible window.                                      |
| Dedicated persistent CloakBrowser profile | Pass: after a clean close and separate relaunch, page-context authentication and the no-audio socket canary succeeded. | It is a dedicated research profile, not the application's existing persistent browser cache.                  |
| GPT-Voice persistent background context   | Not tested.                                                                                                            | This is not required to prove the separate GPT-Voice-style research profile, and was not interrupted or read. |

The restored dedicated profile retained page-context authentication across a
clean close and new process. It returned credentialed and omitted organization
statuses of `200` and `403`, respectively. Its observed categories were
document-cookie presence, local storage (4 keys), session storage (10 keys),
and IndexedDB availability.

The bootstrap-path candidate is asynchronous in the restored page: an immediate
inspection found none, while a bounded wait produced exactly one. That candidate
matched one organization `uuid` field and no generic `id` field. The restored
no-audio socket canary then opened, sent only `KeepAlive` and `CloseStream`,
received no events, and closed cleanly with `1000` without a
`conversation_uuid` query name.

## Sanitized Endpoint Contract

The private speech endpoint is volatile evidence, not a public API contract.

- Path: `/api/ws/speech_to_text/voice_stream`
- HAR handshake result: `101`
- Query names: `channels`, `client_platform`, `encoding`, `endpointing_ms`,
  `language`, `organization_uuid`, `sample_rate`, `stt_provider`,
  `use_conversation_engine`, and `utterance_end_ms`
- Request header names: `accept-encoding`, `accept-language`, `cache-control`,
  `connection`, `host`, `origin`, `pragma`, `sec-websocket-extensions`,
  `sec-websocket-key`, `sec-websocket-version`, `upgrade`, and `user-agent`
- Response header names: `alt-svc`, `cf-cache-status`, `cf-ray`, `connection`,
  `date`, `request-id`, `sec-websocket-accept`, `sec-websocket-extensions`,
  `server`, `strict-transport-security`, `upgrade`, and `x-robots-tag`
- HAR event names: `KeepAlive`, `CloseStream`, `TranscriptText`, and
  `TranscriptEndpoint`

On the evidence date, a sanitized in-page inspection located a current voice
asset and confirmed references to every listed query name. Asset filenames and
content were not retained. Generated DOM IDs and asset names are deliberately
excluded because they are volatile.

## Authentication And Storage Findings

In the user-authenticated isolated context, the organizations request succeeded
with page credentials and was rejected when credentials were omitted (`200`
and `403`, respectively). This demonstrates that credentialed same-origin page
access is required.

Observed storage categories were document-cookie presence, local storage (12
keys), session storage (11 keys), and IndexedDB availability. No values were
read or retained.

Cookies are required by the tested access path. Whether cookies alone are
sufficient, or local/session storage or IndexedDB are also required after a
durable restoration, is not yet proven: clearing one category in the only
authenticated context would mutate the user's session and is out of scope.

## Active-Organization Discovery

The organizations response was an array with two records, establishing an
authorized multi-organization state without recording names or identifiers.
Exactly one resource-path candidate matching
`/api/bootstrap/<identifier>/current_user_access` was present. Its identifier
matched exactly one organization `uuid` field and no generic `id` field.

The implementation rule supported by this observation is:

1. Read the active bootstrap resource path from authenticated same-origin page
   state.
2. Match its identifier to exactly one organization `uuid` field.
3. Fail safely with instructions if the candidate is absent, duplicated, or
   does not match exactly one organization. Never select by response order.

The current authorized account did not provide a single-organization state, so
that case remains untested rather than inferred.

In the restored context, wait for the asynchronous bootstrap-path candidate
within a bounded timeout. If it remains absent or ambiguous, the same rule
requires a safe failure rather than choosing an organization from the response.

## Standalone No-Audio WebSocket Check

With the active organization derived in page context, a socket opened with no
`conversation_uuid` query name and no audio sent. It sent only `KeepAlive` and
`CloseStream`, received no events, and closed cleanly with `1000`.

Result: standalone connection without `conversation_uuid` passed for this
limited no-audio canary. It does not establish buffered audio, pacing,
transcript, or reconnect behavior; those are reserved for Task 02.

## Repeatable Safe Procedure

1. Create a new isolated Claude context and let the user sign in manually.
2. In page context, return only credentialed and omitted request statuses plus
   storage categories/counts; do not return response values.
3. Derive the bootstrap-path candidate in page context, compare it against the
   organizations array there, and return only match counts and field names.
4. Run the no-audio socket canary with no `conversation_uuid`; return only
   open/close status and event names.
5. Cleanly close and relaunch a dedicated persistent profile, then wait for
   exactly one active bootstrap-path candidate before repeating the no-audio
   socket canary. If it remains absent or ambiguous, do not select an
   organization or open the socket.
6. Test a separately authorized single-organization state, if one becomes
   available.

## Known Limits

The current authorized account provided only a multi-organization state. The
single-organization case remains untested, not inferred, and contains no
identifiers or names. The provider must retain the safe-failure rule if active
state cannot be proven in a future account state.

Claude also has a conceptual personal account scope, but this investigation did
not inspect or retain account labels and did not establish a stable explicit
personal-scope signal. In Phase 1, personal scope must therefore remain
`unknown`. It must not be inferred from organization count/order, display names,
subscription labels, or identifier shape. A future authorized research gate
will determine whether personal scope needs behavior beyond the same resolved
organization UUID routing used by the current endpoint.

## Task 02 Buffered Replay And Lifecycle Gate

Evidence date: 2026-07-18

### Procedure And Run Count

The canary used the dedicated restored CloakBrowser research profile and
locally generated PCM16, 16 kHz, mono speech. It retained only synthetic
phrase-match booleans, event categories/counts, close codes, and timing ranges.
It did not retain the synthetic phrase, transcript text, audio, raw frames,
socket URLs, identifiers, responses, screenshots, or profile data.

Two accepted matrices each used nine measured fresh sockets plus one
interruption-only socket, for 20 accepted socket lifecycles. An earlier
nine-socket phrase calibration was excluded from Gate A evidence because its
exact phrase-match boolean failed; no captured value was retained. Both
accepted matrices used the same shorter synthetic phrase label and reproduced
the results below.

### Replay And Timing Results

| Case                        | Accepted result                                                                   |
| --------------------------- | --------------------------------------------------------------------------------- |
| Baseline A then B           | Pass twice per matrix on distinct sockets; exact phrase match and one endpoint    |
| 640 bytes every 20 ms       | Pass at real-time PCM throughput                                                  |
| 2,730 bytes every 85.31 ms  | Pass at real-time PCM throughput                                                  |
| 5,460 bytes every 170.63 ms | Pass at real-time PCM throughput                                                  |
| 2,730 bytes every 40 ms     | Pass at approximately 2.13 times real-time replay                                 |
| Stop after half the PCM     | One endpoint and a bounded normal remote close; partial result text not retained  |
| Cancel after one quarter    | No endpoint, client close `1000`, and no retained interim state                   |
| Five seconds of silence     | One four-second KeepAlive, no transcript/endpoint, normal remote close `1000`     |
| Invalid synthetic scope     | Handshake opened but produced no events before normal close; not a readiness test |
| Page reload interruption    | Open socket was discarded and the restored browser context remained responsive    |

Across the accepted matrices, connect time was 593-788 ms. Runs with transcript
events observed their first event 537-775 ms after open. `TranscriptEndpoint`
arrived 184-576 ms after `CloseStream`, and the final normal close completed
2,186-2,579 ms after `CloseStream`. Successful speech runs accepted three to
five events after `CloseStream`; consumers must therefore continue reading
during the drain phase. No `TranscriptInterim` event appeared, so interim
support remains optional and must not be required for finalization.

The proven frame range is 640-5,460 bytes at equivalent real-time PCM cadence.
The initial production contract remains the captured 2,730-byte frame with a
target cadence of 85.31 ms and a three-second post-`CloseStream` drain bound.
The approximately 2.13-times faster canary passed, but Phase 1 does not depend
on faster replay because the endpoint is private and volatile. Faster rates and
frame sizes outside the proven range remain unsupported until revalidated.

### Lifecycle And Failure Decisions

- Create a fresh socket for each recording. Both consecutive baseline pairs
  finalized exactly once and left zero active sockets or timers.
- Send `KeepAlive` every four seconds while a socket remains open. Short speech
  runs completed before the first interval; the silence run proved the control.
- Send `CloseStream` once after the final frame and accept cumulative text,
  optional interim, endpoint, and remote close events during the bounded drain.
- Treat `TranscriptText` and optional `TranscriptInterim` as cumulative
  snapshots. `TranscriptEndpoint` is the only commit boundary.
- Ignore unknown well-formed event types safely. A metadata-only parser harness
  classified malformed JSON as a protocol failure without retaining payloads.
- A normal server close after `CloseStream` is expected. A premature or
  non-`1000` remote close is a typed connection failure and never returns a
  partial result as final.
- A WebSocket handshake is not an authentication or organization-readiness
  check: the invalid synthetic scope still opened. Resolve and validate the
  active organization through authenticated same-origin HTTP state before
  opening the socket.
- The live session was not expired or mutated. Omitting credentials reproduced
  an unauthenticated readiness rejection. Feature unavailability was not safely
  inducible; production must map a failed authenticated readiness/feature
  preflight before opening a socket.
- Retry is disabled after the first audio byte. The private contract exposes no
  idempotency key, so replaying PCM on a fresh socket is not proven
  duplicate-safe. Navigation/readiness work may retry only before audio starts.
- Keep `conversation_uuid` omitted. The accepted runs used a standalone new-chat
  page; existing-conversation coupling is excluded from Phase 1.
- The gate validates explicit `en-US`. Other BCP-47 values remain configurable
  per the specification but require protocol revalidation if behavior differs;
  `en-US` is the safe default.

### Gate Decision

**Gate A approved by evidence.** Buffered PCM replay is repeatable through the
existing batch-provider contract, finalization is stable, cleanup is bounded,
and live recorder cadence is not required. Tasks 03-08 may proceed only after
human review of this gate. Gate B and a renderer streaming-IPC redesign are not
required by the current evidence.

### Manual Revalidation Triggers

Rerun this canary when the private endpoint path, query names, control/event
shapes, provider identifier, or authenticated bootstrap path changes; when two
consecutive baseline runs no longer phrase-match and finalize once; when the
selected frame/cadence or three-second drain bound fails; when a non-`1000`
close becomes normal; or when Claude begins requiring conversation context.
Run locale-specific confirmation before relying on materially different
language behavior. Personal-scope behavior remains outside this gate and must
follow the deferred sanitized research task.
