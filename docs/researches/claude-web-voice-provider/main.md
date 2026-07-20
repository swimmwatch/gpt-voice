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

## Task 21 Live Streaming Canary

Evidence date: 2026-07-18

### Procedure And Privacy

The canary used the authorized dedicated CloakBrowser research profile and
one public reference-transcribed clip from
[LibriSpeech ASR Dummy](https://huggingface.co/datasets/hf-internal-testing/librispeech_asr_dummy),
`clean/validation` row 0, utterance `1272-128104-0000`. The source is the
[LibriSpeech ASR Corpus](https://www.openslr.org/12), licensed CC BY 4.0. The
clip was downloaded and converted in memory to PCM16, 16-kHz, mono; neither its
audio nor reference text was written to disk, output, or committed.

Organization resolution, the socket URL, PCM, cumulative transcript snapshots,
and reference text remained inside transient process/page memory. The page
normalized words and returned only a boolean requiring at least 80% reference
coverage in order. Earlier runner/tooling and generated-voice calibration
attempts were excluded from gate evidence and retained no raw content.

Authenticated bootstrap returned status `200`. The authorized
multi-organization state contained two eligible memberships, one asynchronous
active candidate, and one exact match. No identifier, membership value, label, or
response body was retained.

### Accepted Matrix

The accepted matrix used six fresh page-owned sockets: two consecutive short
streams, pause/resume, an approximately 30-second stream made from repeated
fixture audio with 1.2-second generated-silence gaps, cancellation, and Stop
before open.

| Evidence                       | Sanitized result                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Connect                        | 615-667 ms                                                                                               |
| Immediate-capture backlog      | Seven complete frames before open in normal cases                                                        |
| Queue bound                    | High-water 0-21 frames; never exceeded the 64-frame limit                                                |
| Binary cadence                 | Minimum observed interval 85.4-85.5 ms                                                                   |
| Public reference               | All four normal cases passed the 80% normalized word-order coverage threshold                            |
| Consecutive short streams      | Both used distinct sockets, reference-matched, finalized once, and closed `1000`                         |
| Normal finalization            | Every normal case received a final endpoint after `CloseStream`                                          |
| Post-Stop final endpoint       | 377-2,163 ms                                                                                             |
| Approximately 30-second stream | 352 sends, 960,000 bytes, 21-frame high-water, two endpoints, final endpoint after 2,163 ms              |
| Duration scaling               | Sanitized slope 0.05; short and long cases stayed below the three-second target                          |
| Pause/resume                   | One KeepAlive occurred during the 4.5-second no-sample pause; queued audio drained and reference matched |
| Cancellation                   | Five frames sent; no `CloseStream`, endpoint, or result; clean `1000`; zero resources                    |
| Stop before open               | Stop at 20 ms before a 653-ms open; 640-byte tail sent; clean `1000`; zero resources                     |
| Event safety                   | No interim, unknown, malformed, or binary server events                                                  |
| Cleanup                        | Every reported case ended with zero active socket/timer/queue resources                                  |

### Gate Decision

**Task 21 gate passed.** The attributed public fixture proved reference
correctness without exposing transcript text. Immediate backlog, bounded
ordering/cadence, repeated endpoint handling, pause/KeepAlive behavior,
cancellation, Stop-before-open handling, clean consecutive sockets, cleanup, and
duration-independent post-Stop timing all passed. The 30-second case finalized
within the three-second target and did not replay recording duration after Stop.

Tasks 22-28 may proceed in order after human review. The endpoint remains
private and volatile; rerun this metadata-only gate if the query/event contract,
selected cadence, authenticated bootstrap routing, or finalization timing
changes.

## Task 28 Streaming Feature-Gate Attempt

Evidence date: 2026-07-19

### Procedure And Privacy

An authorized saved Claude session was loaded into an isolated CloakBrowser
context by a temporary local runner. The runner was removed after the attempt.
It retained no audio, transcript, socket URL, session value, account data,
browser-profile data, or raw provider event. The evidence below contains only
safe result classifications and completion booleans.

### Sanitized Runtime Matrix

| Case                               | Result                                                  |
| ---------------------------------- | ------------------------------------------------------- |
| First short recording              | Completed                                               |
| Second consecutive short recording | Completed                                               |
| Paused and resumed recording       | Completed                                               |
| Approximately 30-second recording  | Failed with the safe `transport-failure` classification |
| Cancellation and immediate Stop    | Not asserted after the long-stream failure              |

The long recording did not produce the required normal post-Stop result, so its
finalization target and duration-independence requirement could not be
established. The short, consecutive, and pause/resume cases do not substitute
for that release evidence.

### Gate Decision

**Task 28 remains blocked and unchecked.** The implementation must keep the
safe live path and explicit Retry behavior; it must not silently switch to
buffered transcription. Rerun the complete authorized metadata-only matrix on
a stable connection before release review can enable this gate.

### Authorized Revalidation Attempt

Evidence date: 2026-07-19

The same public reference fixture and authorized saved session were used in a
fresh isolated CloakBrowser context. Audio, reference text, transcript text,
raw events, URLs, session values, and browser-profile data stayed in transient
process/page memory. The temporary runner and its sanitized output were removed
after this record was prepared.

| Case                              | Safe outcome                          | Sanitized metadata                                      |
| --------------------------------- | ------------------------------------- | ------------------------------------------------------- |
| First short recording             | Safe terminal failure                 | 68 sent frames; queue high-water 10; post-Stop 2,316 ms |
| Second short recording            | Safe terminal failure                 | 68 sent frames; queue high-water 7; post-Stop 2,258 ms  |
| Paused and resumed recording      | Safe terminal failure                 | 68 sent frames; queue high-water 4; post-Stop 2,260 ms  |
| Immediate Stop                    | Safe terminal failure                 | No complete frame; post-Stop 3,146 ms                   |
| Cancellation                      | Cancelled cleanly                     | Five sent frames                                        |
| Approximately 30-second recording | Completed but did not reference-match | 351 sent frames; queue high-water 7; post-Stop 256 ms   |

The long recording met the three-second post-Stop target, but the short and
paused recordings did not finalize normally and the long result failed the
metadata-only reference-match check. Consequently, duration-independent normal
finalization was not established. Provider-owned socket close-code observation
was unavailable from this temporary harness, so no close code was recorded.

### Revalidation Decision

**Task 28 remains blocked and unchecked.** This attempt does not authorize an
automatic replay, reconnect, fallback to buffered transcription, or transport
change. A future authorized investigation must first explain the divergent
short/long behavior and restore close-code observation before it can rerun the
release matrix.

### Runtime-Gap Resolution Revalidation

Evidence date: 2026-07-19

The authorized matrix was repeated in a fresh isolated CloakBrowser context
after correcting three temporary-runner defects. The runner captured the
existing typed transport error before provider-level presentation, compared
normal results with at least 80% normalized word-order coverage using an
in-memory longest-common-subsequence check, and observed the page-owned
socket's actual `CloseEvent` code outside the measured post-Stop interval.
The long fixture ended on a complete public utterance and used generated
silence to reach approximately 30 seconds, avoiding a truncated final
reference repetition.

The public fixture audio, reference, recognized text, socket URL, raw events,
session values, and organization values remained transient and were neither
printed nor persisted. The ignored temporary runner was removed after the
sanitized aggregate was inspected.

| Case                                            | Sanitized outcome                                                       | Permitted metadata                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Consecutive short recordings                    | Completion and reference match: true for both                           | 69 audio sends each; queue high-water 6; post-Stop 475-503 ms; close `1000` |
| Pause and resume                                | Completion and reference match: true                                    | 69 audio sends; queue high-water 6; post-Stop 660 ms; close `1000`          |
| Immediate Stop before awaiting socket readiness | Completion: false with the expected typed `empty-result` classification | Zero complete-frame sends; post-Stop 2,946 ms; close `1000`                 |
| Cancellation                                    | Cancellation completion: true                                           | Five audio sends; close `1000`                                              |
| Approximately 30 seconds                        | Completion and reference match: true                                    | 352 audio sends; queue high-water 7; post-Stop 280 ms; close `1000`         |

The long case finalized faster after Stop than either short case, so post-Stop
time did not scale with recording length, and all normal cases stayed below the
three-second target.

The corrected run establishes current successful short, pause/resume, and long
behavior; fixes the long-fixture matching check; and makes typed failures and
actual socket close codes observable in future attempts. It cannot reconstruct
the reasons discarded by the earlier temporary runner, so it does not claim
that every historical short or paused failure was caused by that runner.

### Visible Application Verification

The freshly built application selected Claude Web on the first provider-change
attempt, reached the passive Connected state, and retained that provider after
the main window was recreated. An in-memory zero-gain synthetic source exercised
the recording UI without using the microphone or retaining audio. The visible
window showed only the recording lifecycle while capture was active, rendered
no interim transcript, and ended with the short localized live-connection
message rather than an error code, URL, sequence value, or raw provider error.
The renderer accepted focus when brought to the foreground.

**The Task 28 authorized runtime and visible-application gates now pass.** This
result does not authorize reconnect, automatic replay, buffered fallback, or a
transport-contract change.

## Task 19 Documentation And Runtime Verification

Evidence date: 2026-07-19

### Procedure And Privacy

One explicitly authorized provider matrix ran on Linux with isolated temporary
application and browser state. The Claude Web run reused the saved session and
the existing public reference fixture. The Claude CLI and Codex CLI runs each
used one inert synthetic request through the production process runner.

Only versions, booleans, safe error classifications, counts, close codes, and
rounded durations were retained. Audio, reference and recognized text, selected
text, provider output, raw events, socket URLs, executable paths, raw stderr,
environment values, account data, credentials, sessions, and organization data
were neither recorded nor added to the repository. The temporary runners and
isolated state were removed after inspection.

### Claude Web Matrix

| Case                                    | Sanitized outcome                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| Initial and restored session            | Both reached authenticated readiness; the isolated saved-session round trip passed       |
| Language and Clear                      | Language configuration was present; isolated Clear passed                                |
| Two consecutive short streams           | Both ended with typed `empty-result`                                                     |
| Pause and resume                        | Ended with typed `empty-result`                                                          |
| Immediate Stop                          | Ended with typed `empty-result`                                                          |
| Approximately 30 seconds                | Completed and reference-match boolean was true; measured post-Stop duration was 3,589 ms |
| Cancellation                            | Completed safely after five sent frames                                                  |
| Interruption                            | Failed safely with typed `page-shutdown`                                                 |
| Expired session and compressed fallback | Both rejected safely                                                                     |
| Socket/event observation                | Five close codes were `1000`; no malformed or unknown events were observed               |

The long-stream timing included the temporary close-code observer and is
therefore conservative, but the observed value still exceeded the required
three-second gate. Short, paused, and immediate-Stop cases did not produce a
normal final result. This attempt does not authorize transport changes,
reconnect, automatic replay, or buffered fallback.

### CLI Matrix

| Evidence         | Sanitized outcome                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude CLI       | Capability version `2.1.71`; PATH and configured-path preparation passed; output accepted; prepare 442 ms; execution 7,439 ms                                                            |
| Codex CLI        | Capability version `0.144.3`; PATH and configured-path preparation passed; eight catalog entries; selected capability booleans true; output accepted; prepare 186 ms; execution 3,418 ms |
| Lifecycle        | Both prepared handles rejected reuse; cancellation and timeout terminated safely                                                                                                         |
| Failure handling | Missing executables returned `not-installed`; isolated unauthenticated state returned `nonzero-exit` for Claude and `not-authenticated` for Codex                                        |
| Persistence      | The isolated CLI settings round trip passed                                                                                                                                              |

No CLI binary or provider-owned authentication data was copied into application
state or packaged output. The canary did not retain the configured model names,
source text, or generated values.

### Gate Decision

**Task 19 remains blocked and unchecked.** The complete unit suite still has
the existing `buildSizeCli` stdout-capture failure. In addition, the current
Claude Web short and pause cases returned `empty-result`, and the long case
missed the three-second post-Stop requirement. These failures are recorded for
their owning follow-up work and are not repaired inside the documentation and
verification packet.

## v2.1.0 Release Runtime Gate Revalidation

Evidence date: 2026-07-20

PR #38 was rechecked at reviewed head `904d5c4b`, with all four required checks
successful, and merged into `main` with merge commit `1f35876b`. Before any
release tag or GitHub Release was created, one newly authorized Claude Web
runtime-matrix attempt was made from that exact merged commit.

The first disposable runner passed its local output-sanitization check but
failed during module loading because a temporary ESM entry point could not
resolve the repository-local CloakBrowser package. The failure occurred before
fixture retrieval, browser launch, saved-session restoration, or a Claude
speech connection. It therefore provided no evidence of a Claude or product
startup failure.

After fresh explicit authorization, the runner was executed from the repository
module context. Nine production-module imports passed, as did the public-fixture
setup. A separate no-speech preflight then passed browser launch, saved-session
restoration, Claude readiness, and final cleanup.

After another explicit release continuation, a rebuilt runner emitted one
sanitized terminal record per case. Its local dry run, bounded public-fixture
setup, saved-session restoration, Claude readiness, and cleanup preflights all
passed before the live matrix.

| Case                     | Safe outcome          | Permitted metadata                                                                                         |
| ------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------- |
| First short stream       | `empty-result`        | 68 frames; zero events/endpoints; queue high-water 12; post-Stop 3,200-3,299 ms; close `1000`              |
| Second short stream      | `empty-result`        | 68 frames; zero events/endpoints; queue high-water 12; post-Stop 3,500-3,599 ms; close `1000`              |
| Pause and resume         | `empty-result`        | 68 frames; KeepAlive observed; zero events/endpoints; queue high-water 12; post-Stop 2,200-2,299 ms        |
| Immediate Stop           | Expected empty result | Zero complete frames/events/endpoints; post-Stop 3,200-3,299 ms; close `1000`                              |
| Cancellation             | Completed safely      | Five frames; cleanup passed; close code was not observed                                                   |
| Approximately 30 seconds | `transport-failure`   | Enqueue rejected at frame 192 after 176 sends; zero events/endpoints; queue high-water 17; no finalization |

Every emitted fragment was valid, the minimum send cadence passed, each queue
remained below its 64-frame bound, no malformed or unknown event was observed,
and all operation/final cleanup checks passed. The long failure was not a queue
overflow: the queue rejected further input after a typed transport failure. The
runner did not retain the more specific page-transport subtype, so no
first-event timeout, connection, authentication, endpoint, or rate-limit cause
is asserted. Long finalization and duration independence were not reached.

All disposable runners, inspectors, and their identified generated cache were
removed. Audio, reference or recognized text, socket URLs, raw events,
session/account/organization data, browser state, and provider output were not
printed or persisted. No automatic retry, reconnect, buffered fallback,
transport change, tag, or release followed.

**The v2.1.0 runtime gate remains failed closed and Task 19 remains unchecked.**
Normal short and paused streams produced no server events or final transcript,
and the long stream terminated before Stop. The authorized live attempt is
consumed. Diagnose the missing server events and preserve the specific safe
page-transport subtype before requesting any further live matrix.

### Release-Owner Known-Issue Decision

Decision date: 2026-07-20

After reviewing this sanitized evidence, the release owner explicitly directed
the stable v2.1.0 release to continue without another live request or a
transport change. This is a release-risk acceptance, not successful runtime
evidence: Task 19 remains unchecked, the failed outcomes above remain the
authoritative result, and Claude Web streaming must be disclosed as a known
issue. No automatic replay, reconnect, buffered fallback, or hidden batch path
is authorized by this decision.
