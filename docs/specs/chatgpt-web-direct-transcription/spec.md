# ChatGPT Web Direct Batch Transcription

Status: Draft

Revision: 1

## Summary

GPT-Voice will retain the existing `chatgpt` voice provider and interactive
browser login while replacing authenticated Playwright page-side token and
transcription requests with an Electron main-process Axios transport. The
batch request will follow the behavior observed in the locally installed
ChatGPT Desktop application without copying its code, credentials, identity,
or device state.

The provider will support an explicit transcription language, encrypted
authentication state, bounded token refresh, optional account routing, and the
observed rolling integrity-state protocol. Streaming transcription remains
deferred.

## Goals

- **OUT-001:** A user can log in through the existing visible browser flow,
  close that flow, and perform ChatGPT Web batch transcription without a
  persistent authenticated Playwright page.
- **OUT-002:** The direct transport preserves the existing provider selection,
  recording, completion, history, clipboard, retry, audit, and error UX.
- **OUT-003:** The user can choose automatic language detection or one explicit
  supported transcription language.

## Non-Goals

- **NONGOAL-001:** Do not implement WebSocket or other streaming
  transcription in this revision.
- **NONGOAL-002:** Do not create a second ChatGPT provider, a new renderer-to-
  provider transport, or an OpenAI API-key flow.
- **NONGOAL-003:** Do not copy proprietary ChatGPT Desktop source, read or
  reuse its credentials or application data, emulate device attestation, or
  identify GPT-Voice as `Codex Desktop`.
- **NONGOAL-004:** Do not change Local Whisper, Claude Web, OpenAI API,
  translation, Prettify, release, signing, or installer behavior except where
  shared types require compatibility-preserving additions.

## Current State And Evidence

- GPT-Voice currently opens a persistent ChatGPT Playwright page, calls
  `/api/auth/session` through `page.evaluate`, and uploads audio through another
  `page.evaluate` request.
- The current upload includes `file` and the obsolete `model=whisper-1` field;
  it has no user-configurable ChatGPT transcription language.
- ChatGPT cookies and the cached access token are currently stored as plaintext
  JSON in the application-data directory.
- The installed `OpenAI.Codex` package version `26.814.5167.0` performs batch
  transcription with multipart `file` and optional `language`, expects a
  response text field, obtains authorization in its privileged process, may
  attach an account identifier, and advances a bounded rolling integrity
  state. Its renderer-only attach headers are not network protocol headers.
- The observed ChatGPT backend is private and undocumented. Compatibility with
  a future server or application version is not guaranteed and must fail
  safely when the contract changes.

## Architecture And Dependency Contract

- **DEP-001:** Add exactly `axios@1.19.0` as a production dependency and update
  `package-lock.json` only through npm. Axios and its required runtime modules
  must be present in the unpacked Windows application.
- **ARCH-001:** ChatGPT authentication refresh and transcription HTTP requests
  execute only in the Electron main process. Renderer code receives no token,
  cookie, account identifier, integrity value, raw response, or Axios object.
- **ARCH-002:** Preserve `ChatGPTVoiceProvider`, `BaseVoiceProvider`, the
  provider registry, existing trusted IPC sender validation, and the current
  batch transcription service. Introduce an injected, state-owning direct HTTP
  adapter rather than a parallel provider or free pass-through wrapper.
- **ARCH-003:** Separate `browserSession` authentication from the requirement
  for a persistent browser runtime. ChatGPT uses a transient login context;
  Claude Web retains its existing persistent browser context and streaming
  behavior.
- **ARCH-004:** The ChatGPT provider is ready when it has usable encrypted
  session state and a usable access token, not when it owns a Playwright page.
  Normal shutdown closes/aborts runtime resources and clears in-memory secrets
  without logging out or deleting valid persisted authorization.

## Authentication And Session Lifecycle

- **AUTH-001:** Login continues through the existing visible, task-owned
  CloakBrowser context. Closing the login page saves its validated session
  state, closes the context, and initializes the direct HTTP provider. No
  background ChatGPT page remains open.
- **AUTH-002:** Token acquisition and refresh use `GET
  https://chatgpt.com/api/auth/session` through Axios. Only unexpired secure
  cookies applicable to the exact HTTPS host and request path are added to
  this request. Cookies are never added to the transcription upload.
- **AUTH-003:** A cached access token may be used only when its bounded JWT
  payload has a future `exp` value beyond a 60-second clock-skew window.
  Decoded claims are routing hints only and never substitute for signature or
  server authentication.
- **AUTH-004:** On startup, missing or stale tokens are refreshed from the
  stored browser session. On transcription `401` or `403`, refresh once and
  replay the upload once. An unauthenticated session becomes Not connected and
  requires the existing login action; it never falls back to hidden
  Playwright.
- **AUTH-005:** If the authenticated token contains a bounded string
  `https://api.openai.com/auth.chatgpt_account_id`, attach it as
  `ChatGPT-Account-Id`. If absent or invalid, omit the header. Do not persist
  decoded account claims separately.
- **AUTH-006:** A network error, timeout, or server `5xx` while refreshing does
  not erase an otherwise valid saved session. A confirmed unauthenticated or
  malformed session clears its cached token and reports a localized relogin
  requirement.

## Batch HTTP Contract

- **HTTP-001:** Send `POST
  https://chatgpt.com/backend-api/transcribe` as multipart form data containing
  one `file` part with the original normalized MIME type and a sanitized
  `gpt-voice.<extension>` filename. Do not send a `model` field.
- **HTTP-002:** When language is `auto`, omit `language`; otherwise add exactly
  one `language` form field containing the validated canonical language code.
  `OAI-Language` remains the application UI locale and is not used as the
  transcription-language setting.
- **HTTP-003:** Attach `Authorization: Bearer <token>`, `Accept: */*`, the
  current application locale as `OAI-Language`, and `originator: GPT-Voice`.
  Attach `ChatGPT-Account-Id` and `X-OAI-IS` only when their validated values
  are available. Let Axios generate the multipart boundary.
- **HTTP-004:** Never send the desktop-internal
  `X-OpenAI-Attach-Auth` or `X-OpenAI-Attach-Integrity-State` markers to the
  network.
- **HTTP-005:** Accept a non-empty string `text` as the canonical success
  response and retain `transcript` as a compatibility-only legacy alias.
  Malformed JSON, an empty result, an error object, or an unexpected contract
  produces an existing renderer-safe localized failure.
- **HTTP-006:** Use a 20-second request timeout, reject redirects, bound
  response bodies and response-header values, and do not automatically replay
  ambiguous timeouts, connection interruptions, `429`, or `5xx` responses.
- **HTTP-007:** A valid `X-OAI-IS-Update` response value advances the encrypted
  integrity state only when the stored current value still equals the state
  sent by that request. Values must be trimmed, no longer than 2,048
  characters, and match the observed `ois1` four-segment base64url form.
  Invalid or stale updates are ignored without logging their contents.

## Settings And Public Interfaces

- **SET-001:** Extend the renderer-safe ChatGPT settings snapshot with
  `language`, defaulting to `auto`, while retaining `providerId: 'chatgpt'`,
  `authType: 'browserSession'`, and `hasSession`.
- **SET-002:** Add a typed ChatGPT settings-save input containing only the
  provider ID and language. Reuse one provider-neutral canonical language
  catalog for ChatGPT Web and OpenAI API. Reject unknown values in main before
  persistence or network use.
- **SET-003:** The ChatGPT provider-settings window shows the existing login,
  relogin, session-clear, and session-status controls plus the language
  selector and Save action. It does not expose model, prompt, temperature,
  token, account ID, or integrity state.
- **SET-004:** Include the effective ChatGPT language in the transcription
  cache context so different explicit languages cannot share a cached result.

## Security, Privacy, And Storage

- **SEC-001:** Store ChatGPT cookies, access token, saved timestamp, and
  integrity state only inside a versioned encrypted envelope protected by
  Electron `safeStorage` (Windows user-scoped DPAPI on the target system).
  Use atomic writes and private file permissions where the platform supports
  them. There is no plaintext fallback.
- **SEC-002:** If secure storage is unavailable, login persistence and direct
  transcription fail closed with a localized configuration error. Secrets
  remain main-process only and are cleared from memory when no longer owned.
- **SEC-003:** Logs, audit events, diagnostics, errors, notifications, history,
  and renderer results must not contain tokens, cookies, JWT claims, account
  identifiers, integrity values, raw audio, transcripts beyond the normal
  successful result path, full provider responses, private paths, or Axios
  request configuration.
- **SEC-004:** Audit only allowlisted metadata already supported by provider
  audit contracts: phase, outcome, bounded status, attempt count, byte/result
  lengths, timing, retry/cooldown flags, and normalized cause/exception type.
- **SEC-005:** The client never reads ChatGPT Desktop files, tokens, cookies,
  device-check material, integrity state, or user profiles. Account and
  integrity values originate only from GPT-Voice's own authenticated flow.
- **SEC-006:** The direct client has fixed HTTPS allowlists for
  `chatgpt.com/api/auth/session` and
  `chatgpt.com/backend-api/transcribe`, rejects redirects, and never accepts a
  renderer-controlled URL, base URL, header map, cookie, or token.

## Migration And Compatibility

- **MIG-001:** On first compatible startup, migrate valid legacy
  `chatgpt-session.json` and `access-token.json` content into the encrypted
  versioned repository. Delete both plaintext files only after the encrypted
  atomic write succeeds. Invalid legacy content or a failed secure migration
  is deleted and requires relogin; it is never used for a network request.
- **COMP-001:** Preserve provider ID `chatgpt`, display category, browser-session
  login semantics, batch mode, recording IPC, successful-result clipboard and
  history behavior, and existing user-facing provider selection.
- **COMP-002:** Preserve the current two-attempt authentication bound,
  rate-limit cooldown, provider audit lifecycle, cache integration, and
  privacy-safe error presentation. Do not weaken trusted IPC or renderer
  isolation.
- **COMP-003:** Windows is the required live validation platform. Linux and
  other currently buildable desktop targets must continue to compile and use
  Electron `safeStorage`; when secure storage is unavailable they fail closed.
- **NET-001:** Direct requests honor the application's explicit CloakBrowser
  proxy configuration, including supported HTTP/HTTPS credentials, SOCKS5 via
  the existing agent dependency, and bypass rules. When the application proxy
  is disabled, ignore ambient proxy environment variables and connect
  directly.
- **COMP-004:** Documentation must identify ChatGPT Web transcription as an
  authenticated private backend integration whose server contract may change;
  it must not be described as the official OpenAI API or as guaranteed by
  ChatGPT Desktop compatibility.

## Failure Behavior

- **FAIL-001:** Retry an audio upload automatically only after a definitive
  `401` or `403` followed by a successful token refresh. Every other failed
  upload is terminal and may be retried only by the user's existing explicit
  retry action.
- **FAIL-002:** `429` establishes the existing bounded cooldown from a valid
  `Retry-After` value or the existing fallback. No request is sent during the
  cooldown.
- **FAIL-003:** Timeout, DNS, TLS, proxy, cancellation, redirect, malformed
  response, empty result, and provider-contract failures map to stable,
  localized, non-sensitive errors and existing normalized audit cause codes.
- **FAIL-004:** Clearing the ChatGPT session aborts in-flight ChatGPT HTTP work,
  deletes encrypted and legacy auth state idempotently, resets rate-limit and
  integrity state, and leaves other providers and application data untouched.

## Acceptance Criteria

### Automated

- **AC-AUTO-001:** Dependency and packaging checks prove exactly Axios 1.19.0
  is locked as a production dependency and available in the built/unpacked
  application without an ambient global installation.
- **AC-AUTO-002:** Transport tests prove exact host/path allowlists, multipart
  `file`, optional `language`, absence of `model` and internal attach markers,
  bounded headers/body/timeout, redirect rejection, and renderer-safe response
  parsing.
- **AC-AUTO-003:** Authentication tests cover cached-token validity, direct
  session refresh, one `401`/`403` refresh and replay, no replay for ambiguous
  failures, optional validated account ID, missing authentication, and
  transient refresh failures that preserve the session.
- **AC-AUTO-004:** Integrity tests cover absent state, valid request state,
  valid compare-and-set update, invalid/oversized/stale update rejection,
  encrypted persistence, logout reset, and absence from logs.
- **AC-AUTO-005:** Storage tests cover DPAPI/safeStorage success, unavailable
  encryption fail-closed behavior, atomic private writes, successful legacy
  migration, invalid legacy deletion, idempotent clear, and sanitized errors.
- **AC-AUTO-006:** Lifecycle tests prove ChatGPT startup and transcription do
  not create a background Playwright context or page, while interactive login
  still uses a transient context and Claude Web behavior is unchanged.
- **AC-AUTO-007:** Settings, preload/main/renderer type, UI, localization, and
  cache tests cover `auto`, explicit language, invalid input, save/reload, and
  session clear without exposing secret fields.
- **AC-AUTO-008:** Focused tests pass before the project unit, type, lint,
  production build, production dependency audit, and unpacked packaging
  checks.

### Manual Gates

- **AC-MAN-001:** On native Windows, use only the user's own ChatGPT account and
  public or generated non-private audio. Log in through the visible GPT-Voice
  browser window, close it, verify no persistent authenticated Playwright page
  remains, transcribe once with `auto` and once with one explicit language,
  restart the application, and verify encrypted-session reuse and one bounded
  relogin recovery path.
- **AC-MAN-002:** Repeat the Windows smoke with direct networking and, when a
  test proxy is already safely available, the configured proxy path. Confirm
  cancellation/shutdown leaves no in-flight request or browser process.
- **AC-MAN-003:** Inspect only an unpacked Windows application. Do not capture
  or retain tokens, cookies, account identifiers, audio, transcripts,
  screenshots, full responses, private paths, or complete logs as evidence.

## Approval State

The contract is complete as a Draft, but repository workflow requires an
explicit Prompt MCP `approve` answer before changing the status to Approved.
Prompt MCP interview tools were unavailable in the current client session, so
approval remains blocked and no planning or implementation is authorized by
this document yet.
