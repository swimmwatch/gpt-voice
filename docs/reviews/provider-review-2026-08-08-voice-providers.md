# Voice Provider Family Review

- Date: 2026-08-08
- Branch: `feat/local-whisper-provider`
- Reviewer scope: static code review (no runtime profiling)

## Scope

The voice provider family and its shared base, **excluding** `LocalWhisperVoiceProvider.ts`
(reviewed separately). Covered:

- Base/shared: `src/main/providers/BaseVoiceProvider.ts`, `streamingVoiceProvider.ts`,
  `streamingVoiceProviderCapability.ts`, `BatchVoiceProvider.ts`,
  `voiceProviderFactory.ts`, `voiceProviderRegistry.ts`, `voiceProviderGuards.ts`,
  `voiceProviderAudit.ts`, `transcriptionErrors.ts`, `StreamingTranscriptionOperationError.ts`.
- ChatGPT web automation: `ChatGPTVoiceProvider.ts`, `chatgptSessionStore.ts`, `chatgptUtils.ts`.
- OpenAI HTTP API: `OpenAIApiVoiceProvider.ts`, `openaiApiSettings.ts`, `openaiApiSettingsUtils.ts`.
- Claude web automation: `ClaudeWebVoiceProvider.ts`, `claudeWebAudio.ts`,
  `claudeWebNavigationService.ts`, `claudeWebPageTransport.ts`, `claudeWebProtocol.ts`,
  `claudeWebSession.ts`, `claudeWebSettings.ts`.
- Supporting services: `src/main/services/streamingTranscription.ts`, `transcription.ts`,
  `transcriptionCompletion.ts`, `transcriptionResultCache.ts`,
  `MainStreamingTranscriptionRejection.ts`.

Evaluated axes: performance, security, memory leaks, cross-platform error handling.

## Summary verdict

The family is, overall, **well-engineered and defensively coded**. The Claude web transport in
particular is a careful design: it keeps the WebSocket inside the authenticated page, exposes only
a small typed snapshot to main, bounds every page-side buffer, balances its timers/abort listeners,
and zeroes sensitive audio buffers on every terminal path. The audit layer is exhaustive and error
classification is consistent across providers. No critical defects were found.

The most material issues are:

1. **ChatGPT session cookies and access token are persisted in plaintext with default file
   permissions** — no encryption and no `0600`, unlike the hardened OpenAI (encrypted + `0600`) and
   Claude (`0600` + `0700` dir) siblings (VOICE-1, security, **high**).
2. **Per-frame `Array.from` JSON marshalling** of every 2,730-byte PCM chunk across the Playwright
   CDP boundary, ~4x payload inflation plus two `page.evaluate` round trips per push (VOICE-2,
   performance, **medium**).
3. **The streaming service retains the entire session's PCM in memory** and makes several
   full-audio copies at `finish` to verify the canonical WAV (VOICE-3, memory, **medium**).

The remainder are low-severity inconsistencies and platform notes. Distinctions between
VERIFIED (traced in code) and INFERRED (reasoned, not profiled) are called out per finding.

## Findings table

| ID       | Finding                                                                                                 | Implementation             | Axis           | Severity |
| -------- | ------------------------------------------------------------------------------------------------------- | -------------------------- | -------------- | -------- |
| VOICE-1  | Session cookies + bearer access token stored in plaintext, default file mode (no encryption, no `0600`) | ChatGPT                    | Security       | High     |
| VOICE-2  | Per-PCM-frame `Array.from(bytes)` → JSON across CDP; ~4x inflation + 2 evaluate round trips per push    | Claude                     | Performance    | Medium   |
| VOICE-3  | Whole-session PCM retained in `operation.chunks`; multiple full-audio copies at `finish` for WAV proof  | Claude (streaming service) | Memory         | Medium   |
| VOICE-4  | Batch `transcribe()` returns raw enum error codes as user-facing `error` (not localized)                | Claude                     | Error handling | Medium   |
| VOICE-5  | Page-socket registry on the page main-world global, shared realm with claude.ai scripts                 | Claude                     | Security       | Low      |
| VOICE-6  | `0600`/`0700` file hardening is effectively a no-op on Windows; relies on AppData ACLs                  | Claude, OpenAI             | Cross-platform | Low      |
| VOICE-7  | Linux `safeStorage` may use a weak/plaintext backend while `isEncryptionAvailable()` is `true`          | OpenAI                     | Security       | Low      |
| VOICE-8  | Full-audio SHA-256 (cache key) and full base64 (ChatGPT) computed per batch request                     | ChatGPT, OpenAI, cache     | Performance    | Low      |
| VOICE-9  | `page.route('**/*')` handler registered per page, never `unroute`d                                      | ChatGPT, Claude            | Memory         | Low      |
| VOICE-10 | ChatGPT `saveSession` persists the full multi-domain `storageState`, not just auth cookies              | ChatGPT                    | Security       | Low      |

---

## ChatGPT web-automation provider

### VOICE-1 — Plaintext, world-readable session and token at rest (Security, High)

VERIFIED. `FileChatGPTSessionStore` writes both the session cookies and the cached bearer token
with `writeFileSync` and **no `mode` option and no encryption**:

- `chatgptSessionStore.ts:53` — `writeFileSync(sessionFile, JSON.stringify(state, null, 2))`
- `chatgptSessionStore.ts:85` — `writeFileSync(tokenFile, JSON.stringify(stored, null, 2))`

Node's default file mode is `0666 & ~umask` (typically `0644`), so these files are group/other
readable on Linux unless the parent directory happens to be restrictive. The files live in the
shared app directory (`config.ts:153-154`, `~/.config/<app>/` on Linux). The token is the ChatGPT
`accessToken` used directly as `Authorization: Bearer` (`ChatGPTVoiceProvider.ts:632`) — i.e. a full
account credential — and the cookies include the `__Secure-next-auth.session-token` auth cookie.

This is inconsistent with the two sibling providers, both of which are hardened:

- OpenAI: API key encrypted via `safeStorage` and written with `mode: 0o600`
  (`openaiApiSettings.ts:14`, `openaiApiSettings.ts:88-92`, `openaiApiSettings.ts:94-99`).
- Claude: session written through `FileClaudeWebPrivateJsonRepository` with `mode: 0o600` on the
  file, `0o700` on the directory, and an explicit `chmodSync`
  (`claudeWebSettings.ts:63-77`).

Recommendation: at minimum write the ChatGPT session and token files with `mode: 0o600` (and
`chmodSync` for the pre-existing-file case, mirroring the Claude repo); ideally encrypt the token
via the same `safeStorage` path used for the OpenAI key. Exploitability depends on the ambient
directory permissions, so this is not remotely exploitable, but the plaintext-at-rest of an account
bearer token combined with the inconsistency with hardened siblings makes it the top finding.

### VOICE-10 — Over-broad session persistence (Security, Low)

VERIFIED. `saveSession` persists the entire browser `storageState()` for all visited origins
(`ChatGPTVoiceProvider.ts:179-182`), whereas the Claude repository deliberately narrows the stored
state to the relevant origin's cookies/localStorage before writing
(`claudeWebSession.ts:153-162`, `getRelevantCookies`/`getRelevantOrigins`). Combined with VOICE-1
this widens what is stored in plaintext (any third-party cookies picked up during navigation).
`getUnexpiredCookies` filters on load (`ChatGPTVoiceProvider.ts:193`) but the disk copy is still the
full state.

### ChatGPT — sound aspects

- The transcription fetch runs **inside** the authenticated page via `page.evaluate` with a bounded
  `AbortController` timeout and structured (not string-concatenated) arguments
  (`ChatGPTVoiceProvider.ts:590-667`); the token and audio cross as evaluate arguments, so there is
  no code injection surface. VERIFIED.
- Rate-limit cooldown is a single scalar (`transcriptionRateLimitUntil`) clamped to
  `TRANSCRIPTION_RATE_LIMIT_MAX_SECONDS` (`ChatGPTVoiceProvider.ts:557-565`) — no unbounded map.
- Bounded retry (`TRANSCRIPTION_MAX_ATTEMPTS = 2`) with token-refresh only on 401/403
  (`chatgptUtils.ts:60-63`); 5xx is correctly _not_ treated as an expired-token signal.
- Page-recovery promise is single-flighted and self-clearing
  (`ChatGPTVoiceProvider.ts:508-522`) and reset in `shutdown` (`ChatGPTVoiceProvider.ts:280-285`).
- `retry-after` header is length-capped (`<= 128`) before crossing back
  (`ChatGPTVoiceProvider.ts:645`).
- The token store logs only the token **length**, never the value (`chatgptSessionStore.ts:71`).
- Blocked-domain/resource routing reduces automation cost (`ChatGPTVoiceProvider.ts:41-58`).
- Error-body previews are truncated to 300 chars (`chatgptUtils.ts:25`, `chatgptUtils.ts:102`).

---

## OpenAI HTTP API provider

### VOICE-7 — safeStorage backend strength is environment-dependent (Security, Low)

INFERRED (Electron behavior, not this repo's code). `encryptApiKey` guards on
`isEncryptionAvailable()` and throws otherwise (`openaiApiSettings.ts:94-99`). On Linux, Electron's
`safeStorage` can report available while falling back to the `basic_text` backend (or a
password-derived key with a weak default) depending on the desktop keyring. The code is correct;
the caveat is that "encrypted at rest" is only as strong as the platform keyring. Worth a comment
so operators on headless/keyring-less Linux understand the guarantee. `decryptApiKey` fails closed
to `''` (`openaiApiSettings.ts:101-110`), which is the right default.

### OpenAI — sound aspects

- API key is encrypted and stored `0600` (see VOICE-1 comparison); never logged.
- Settings are validated and normalized before persistence
  (`openaiApiSettingsUtils.ts:67-111`); temperature is clamped to `[0,1]`, model/language are
  allow-listed.
- `getTranscriptionCacheContext` correctly includes model/language/prompt/temperature so cache keys
  cannot collide across settings (`OpenAIApiVoiceProvider.ts:67-80`).
- Error mapping distinguishes rate-limit, structured `error.message`, and non-JSON bodies with a
  300-char preview (`OpenAIApiVoiceProvider.ts:206-228`); network exceptions map to
  `connection-failed` with a normalized exception type (`OpenAIApiVoiceProvider.ts:169-176`).
- `getRetryAfterSeconds` bounds recursion depth to 4 when scanning the JSON body
  (`transcriptionErrors.ts:56-75`) — no unbounded traversal of a hostile payload.
- Note (minor): the connection-failure arm returns `error.message` directly
  (`OpenAIApiVoiceProvider.ts:175`), so a raw Node/undici message can reach the user, unlike the
  localized `error.*` strings used elsewhere. Low-impact consistency nit.

---

## Claude web-automation provider

### VOICE-2 — Per-frame `Array.from` JSON marshalling across CDP (Performance, Medium)

INFERRED (from code; not profiled). Each PCM frame is sent to the page by converting the
`Uint8Array` to a plain number array and passing it as an evaluate argument, then rebuilt in-page:

- `claudeWebPageTransport.ts:284` — `values: Array.from(bytes)`
- `claudeWebPageTransport.ts:279` — `record.socket.send(new Uint8Array(values))`

Playwright serializes evaluate arguments over the CDP JSON protocol, so a 2,730-byte frame
(`MAX_STREAMING_TRANSCRIPTION_PCM_CHUNK_BYTES = 2_730`, `src/shared/streamingTranscription.ts:3`)
becomes a JSON array of up to ~2,730 numbers (`"255,"` ≈ up to 4 chars/byte → ~4x inflation).
Additionally, each `push` performs **two** `page.evaluate` round trips — `sendBinary` then
`inspectNow` (`claudeWebPageTransport.ts:502-510`) — and the keep-alive interval adds more
(`claudeWebPageTransport.ts:737-758`). At ~85 ms cadence a 130 s max operation is on the order of
1.5k frames, i.e. thousands of CDP round trips carrying ~4x the necessary bytes.

This is a consequence of the (sound) decision to keep the socket inside the page; the inflation
itself is avoidable. Consider base64/hex encoding the frame, or batching binary sends and folding
the snapshot read into the same evaluate to halve the round trips.

### VOICE-3 — Whole-session PCM retained and re-copied at finish (Memory, Medium)

VERIFIED (retention/copies traced; peak sizes INFERRED). The streaming service keeps every accepted
frame for the entire operation to later prove the canonical WAV matches:

- `streamingTranscription.ts:431` — `operation.chunks.push(chunk)` for each frame.
- At `finish`, `copyValidatedRecordingWav` copies the whole WAV
  (`streamingTranscription.ts:208`), then `extractClaudeWebPcm` copies the PCM slice again
  (`claudeWebAudio.ts:161`), then `isMatchingPcmRecording` walks the entire recording byte-by-byte
  against the concatenated chunks (`streamingTranscription.ts:179-195`), then
  `copyToArrayBuffer(wave)` copies the WAV a third time before completion
  (`streamingTranscription.ts:612`).

For a max-length recording (~4 MB PCM / ~4 MB WAV) the transient peak is several simultaneous
full-audio copies (~12-16 MB) on top of the retained `chunks`. It is bounded by the 130 s overall
timeout, so not unbounded, but the retained `chunks` array plus the copy fan-out at finish is the
heaviest allocation in the family.

Mitigation: the byte-by-byte compare could use `Buffer.compare` on subarrays, and the retained
`chunks` could be a single growable buffer rather than N small copies. Retention is zeroed correctly
(see sound aspects), so this is a footprint/throughput concern, not a leak.

### VOICE-4 — Batch `transcribe()` returns raw enum codes to the user (Error handling, Medium)

VERIFIED. Claude is a streaming provider, but its inherited batch `transcribe()` is still invoked on
the buffered/retry path (`transcription.ts:71-78`: non-batch providers fall through to
`provider.transcribe(buffer, mimeType)`). On failure it returns the internal enum value as the
user-facing string:

- `ClaudeWebVoiceProvider.ts:456` — `return { success: false, error: ClaudeWebVoiceProviderErrorCode.InvalidAudio }`
- `ClaudeWebVoiceProvider.ts:466` — `return { success: false, error: context.errorCode }`
- `ClaudeWebVoiceProvider.ts:506` — `return { success: false, error: errorCode }`

So a user can see a raw `session-missing` / `organization-ambiguous` string, whereas ChatGPT and
OpenAI return `localization.translate('error.*')`. The readiness path _does_ localize
(`getReadinessError`, `ClaudeWebVoiceProvider.ts:418-422`, key `error.claudeWeb.${code}`), so the
fix is to route the batch failures through the same catalog. This also mildly leaks internal
taxonomy to the UI.

### VOICE-5 — Page-socket registry on the page main-world global (Security, Low)

VERIFIED (design tradeoff). The sockets live in a registry attached to the page's global object
under `__gptVoiceClaudePageSocketsV1` (`claudeWebPageTransport.ts:28`, `:143-147`). `page.evaluate`
runs in the page's main world, so claude.ai's own (first-party, trusted) scripts share the realm and
could in principle read/close these sockets. This is inherent to running the WebSocket inside the
authenticated page to reuse its credentials, and the origin is trusted, so the residual risk is low.
Noting it because a compromised or malicious first-party script would have direct access; an isolated
world would remove that exposure at some ergonomic cost.

### Claude — sound aspects (notable)

- **Bounded page-side buffering**: message count `<= 1024`, total `<= 1 MB`, per-text-message
  `<= 256 KB`; overflow zeroes the buffer and closes with 1009
  (`claudeWebPageTransport.ts:172-206`, `:222-226`). Binary server frames are treated as malformed
  (`claudeWebPageTransport.ts:699-703`). Only a small typed snapshot crosses to main
  (`ClaudeWebPageSocketSnapshot`), never a raw browser error. Strong boundary. VERIFIED.
- **URL/injection safety**: the speech endpoint host is a constant
  (`claudeWebProtocol.ts:8`); `organizationUuid` is validated against a strict UUID regex and
  language against the settings validator before the URL is built, and values go through
  `URLSearchParams.set` (encoded) (`claudeWebProtocol.ts:41-60`). No injection surface. VERIFIED.
- **Org-routing defense in depth**: the active-org candidate scraped from resource timing must also
  appear in the authenticated `/bootstrap` memberships _and_ pass the UUID regex before use
  (`ClaudeWebVoiceProvider.ts:174-249`, `claudeWebSession.ts:197-217`,
  `claudeWebProtocol.ts:45`). VERIFIED.
- **Timer/abort balance**: `armDeadline`/`clearDeadline` keep `deadlineTimers`, `timeoutHandles`,
  `intervalHandles` consistent; `clearAllTimers` drains all three
  (`claudeWebPageTransport.ts:765-788`, `:906-912`); abort listeners are registered `{ once: true }`
  and removed on both settle branches (`claudeWebPageTransport.ts:790-865`); `cleanupOperation` is
  idempotent via a memoized promise (`claudeWebPageTransport.ts:914-924`). No listener/timer leak
  found. VERIFIED.
- **Session validation** requires `secure` + `httpOnly` + domain match + unexpired, and exactly one
  relevant origin (`claudeWebSession.ts:100-151`); malformed/expired states clear the session.
- **Sensitive-buffer hygiene**: chunks and WAV copies are `.fill(0)`-zeroed on every terminal path
  in the streaming service (`streamingTranscription.ts:212-218`, `:492-503`, `:547`, `:628`,
  `:715-720`). VERIFIED.
- **WAV parsing** (`extractClaudeWebPcm`, `claudeWebAudio.ts:117-162`) does explicit bounds/overflow
  checks (container size match, per-chunk end/next-offset validation, alignment), uses a
  `DataView` with explicit `byteOffset`/`length`, and rejects duplicate `fmt `/`data` chunks. No
  out-of-bounds read path found. VERIFIED.
- The `owner`-token gate plus single-active-operation invariant in the streaming service
  (`streamingTranscription.ts:260-269`, `:649-656`) is a clean privilege boundary; capability is
  resolved only from the exact `ClaudeWebVoiceProvider` instance
  (`streamingVoiceProviderCapability.ts:7-18`).

---

## Cross-cutting

### VOICE-6 — POSIX file modes are near-no-ops on Windows (Cross-platform, Low)

INFERRED (Node/Windows semantics). The `0600`/`0700` protections for the Claude and OpenAI stores
(`claudeWebSettings.ts:63-77`, `openaiApiSettings.ts:88-92`) only toggle the read-only bit on
Windows; confidentiality there relies on the per-user `%APPDATA%` ACL, which is the default and
generally adequate. Worth a one-line comment so the protection model is explicit per platform. The
app-data path resolution itself is correctly platform-branched (`config.ts:136-145`).

### VOICE-8 — Per-request full-audio hashing / base64 (Performance, Low)

VERIFIED (cost is one-time O(n)). Every batch request SHA-256-hashes the entire audio buffer to form
the cache key (`transcriptionResultCache.ts:28`), and ChatGPT base64-encodes the whole buffer once
per transcription (`ChatGPTVoiceProvider.ts:270`, reused across the two attempts). Both are linear
and unavoidable for their purpose; noted only so the cost is acknowledged. The result cache itself is
a bounded LRU (max 10, 5 min TTL) with `unref`'d, always-cleared expiry timers — no leak
(`transcriptionResultCache.ts:9-10`, `textActionCache.ts:37-89`). VERIFIED.

### VOICE-9 — `page.route` handlers never removed (Memory, Low)

VERIFIED. Both automation providers install a catch-all route handler
(`ChatGPTVoiceProvider.ts:291-302`, `ClaudeWebVoiceProvider.ts:157-162`) and never call `unroute`
(grep for `unroute` across `src/main` returns nothing). Each handler closes only over module
constants, and it is released when the page/context is disposed, so there is no per-operation growth;
flagged only for completeness. If a provider's page were ever re-`route`d without disposal the
handlers would stack.

### Error-classification consistency

The audit `causeCode → errorClass` map is exhaustive and typed against the union
(`voiceProviderAudit.ts:61-102`), and `getErrorClass` promotes any exception-typed failure to
`internal` except `cleanup-failed` (`voiceProviderAudit.ts:118-124`). The browser navigation retry
classifier matches stable Chromium `ERR_*` and Node `errno` strings that are identical across
Windows/Linux/macOS (`browserNavigationRetry.ts:52-71`), so offline/DNS/reset mapping is
cross-platform. Streaming vs batch failure phases are centralized
(`voiceProviderAudit.ts:242-271`, `ClaudeWebVoiceProvider.ts:714-733`). This layer is sound.

---

## Verified sound

- Claude page-socket boundary: bounded buffers, typed snapshot, no raw-error leakage, fixed host +
  validated UUID/language → no injection (`claudeWebPageTransport.ts`, `claudeWebProtocol.ts`).
- Transport timer/abort/cleanup lifecycle is balanced and idempotent
  (`claudeWebPageTransport.ts:765-972`).
- Sensitive audio buffers are zeroed on all terminal paths (`streamingTranscription.ts`).
- WAV/PCM parsing is bounds-checked with no OOB path (`claudeWebAudio.ts`).
- Result cache is a bounded LRU + TTL with cleared, `unref`'d timers (`textActionCache.ts`).
- OpenAI settings validated/normalized; API key encrypted + `0600`; never logged
  (`openaiApiSettings.ts`, `openaiApiSettingsUtils.ts`).
- ChatGPT token store logs length only; bounded retry with correct 401/403-only refresh; single-flight
  page recovery (`chatgptSessionStore.ts`, `ChatGPTVoiceProvider.ts`, `chatgptUtils.ts`).
- Registry/factory enforce transcription-mode ↔ class ↔ id contracts under audit
  (`voiceProviderRegistry.ts`, `voiceProviderFactory.ts`, `voiceProviderGuards.ts`).
- Owner-token + single-active-operation gating in the streaming service
  (`streamingTranscription.ts`).
- Org-routing defense in depth (candidate must match authenticated eligible org + UUID regex).

## Not covered

- `LocalWhisperVoiceProvider.ts` (explicitly out of scope; reviewed separately).
- Renderer-side code and the IPC controllers that call these services; only the service-boundary
  inputs and the `owner`-token gating were reviewed, not the wiring in `src/renderer`/preload.
- The background browser service and context/page lifecycle (creation, close, provider switch) beyond
  the provider methods themselves — VOICE-1/VOICE-9 exposure partly depends on it.
- `BaseProviderAudit` internals and the shared `providerAudit` mappings (treated as a trusted
  dependency; only the voice-family subclass was read).
- The i18n catalog completeness for the `error.*` / `error.claudeWeb.*` keys referenced here.
- Diagnostics capture/redaction pipeline (`reportDiagnostic` sink).
- Runtime behavior: this is a static review. CDP payload inflation (VOICE-2) and the finish-time
  memory peak (VOICE-3) are reasoned from the code, **not profiled**; sizes are estimates.
