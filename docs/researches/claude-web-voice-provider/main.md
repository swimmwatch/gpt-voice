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
personal-scope signal. Personal scope must therefore remain `unknown` in Phase

1. It must not be inferred from organization count/order, display names,
   subscription labels, or identifier shape. A future authorized research gate
   will determine whether personal scope needs behavior beyond the same resolved
   organization UUID routing used by the current endpoint.
