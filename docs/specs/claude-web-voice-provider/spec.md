# Spec: Claude Web Voice and CLI Prettify Providers

Status: Revised for human review on 2026-07-18
Date: 2026-07-17
Global task slug: `claude-web-voice-provider`
Scope owners: voice transcription providers and selected-text Prettify providers

## Assumptions and Product Decisions

1. `claude-web` is a browser-session voice transcription provider parallel to `chatgpt-web`; it is not a Claude chat-completion provider.
2. `claude-cli` and `codex-cli` are two new Prettify provider IDs. They transform selected text and are independent of Claude Web speech-to-text.
3. Production Claude Web authentication uses GPT-Voice's provider browser/session lifecycle. Chrome DevTools MCP and the supplied HAR are research inputs only; production must not depend on the user's external Chrome profile.
4. Claude Web's private endpoint is volatile and unsupported. The implementation must discover account-scoped values, validate protocol behavior, fail safely, and make revalidation possible without exposing session data.
5. CLI model and reasoning controls are provider-specific. Existing HTTP sampling fields are hidden when a CLI cannot honor them.
6. Codex CLI starts as experimental until a capability canary proves that executable tools, apps, hooks, plugins, multi-agent behavior, and web search are disabled for the installed version.
7. Claude organization routing and account-scope classification are separate contracts. Phase 1 may route a request when one active organization UUID is proven even if the account scope is still `unknown`. A future personal-state solution may classify scope as `personal`, but it must never infer that state from organization count, response order, display name, plan/subscription labels, or UUID shape.

Approval of this spec approves these decisions and the resolved product choices near the end of this document.

## Objective

Add three provider integrations:

- **Claude Web voice**: transcribe GPT-Voice recordings through Claude's authenticated, private WebSocket speech-to-text endpoint.
- **Claude CLI Prettify**: transform selected text through an installed and authenticated Claude Code CLI.
- **Codex CLI Prettify**: transform selected text through an installed and authenticated Codex CLI with the strongest available tool and persistence isolation.

The user must be able to authenticate/configure each provider, select supported models and reasoning controls, receive actionable errors, and retain the existing recording, clipboard, cache, notification, and provider-switching behavior.

Success means the integrations work without hardcoded account identifiers, copied CLI credentials, arbitrary shell execution, transcript/audio logging, or live-provider dependencies in automated tests.

## Scope

### In Scope

- Claude Web browser-session login, session validation, provider readiness, private WebSocket transcription, retry/error mapping, and session clearing.
- A research gate that decides whether buffered PCM replay is compatible with Claude or whether GPT-Voice needs an explicit streaming provider capability.
- Claude CLI and Codex CLI Prettify adapters, settings, model selection, reasoning controls, authentication preflight, cancellation, timeout, output limits, and UI capability handling.
- Provider-specific cache context, localization, privacy disclosure, deterministic tests, and user-facing setup documentation.
- A repeatable, sanitized Chrome MCP/HAR workflow for revalidating the private Claude contract.

### Out of Scope

- Claude chat submission/completion through undocumented web endpoints.
- Claude voice mode, text-to-speech, or conversation-engine responses beyond speech-to-text.
- Bundling, installing, updating, or authenticating either CLI on the user's behalf.
- Copying auth tokens from Claude or Codex CLI configuration.
- Exposing arbitrary CLI arguments, shell snippets, environment variables, or MCP/tool configuration in Settings.
- CI tests against live Claude/OpenAI accounts, personal browser profiles, or private endpoints.
- Automatic bypass of account restrictions, feature flags, anti-bot controls, subscription checks, or provider terms.
- Packaging/signing changes or new runtime dependencies unless separately approved.

## Existing Architecture Study

### Voice Provider Precedent

- `BaseVoiceProvider` owns the session/transcription contract. `transcribe(buffer, mimeType)` is currently batch-oriented.
- Renderer recording is also batch-oriented: it records until stop and normally produces a mono, 16-bit PCM, 16 kHz WAV before invoking `window.electronAPI.transcribeAudio`.
- Renderer, preload, main IPC, transcription orchestration, cache/history, and browser ownership are already separated. Main owns providers and privileged browser/session behavior.
- `ChatGPTVoiceProvider` is the direct browser-session precedent: it uses a provider-specific session, initializes an authenticated page, makes a same-origin request from `page.evaluate`, retries an expired session once, and parses/copies the result.
- Claude differs from ChatGPT Web in two important ways:
  - Claude's endpoint is a WebSocket with binary audio plus control/event messages.
  - Claude expects raw PCM samples, while GPT-Voice passes a WAV container to providers. The WAV header must not be sent as audio.
- `BaseVoiceProvider.isReady()` assumes a nonempty access token. Claude Web appears to use the authenticated page session directly, so it will need an explicit readiness implementation rather than a dummy token.

### Prettify Provider Precedent

- Prettify currently supports `ollama` and `vllm` through HTTP adapters in main.
- The settings schema, adapter registry, cache context, renderer UI, validation, and dirty-state logic contain two-provider unions and ternaries. New IDs require exhaustive provider switches or capability metadata; treating every non-Ollama provider as vLLM is invalid.
- The current adapter contract assumes a base URL and enumerable model list. CLI providers need capabilities for free-text models, discovered models, unsupported HTTP generation controls, and no load/unload action.
- Existing legacy `PRETTIFY_REASONING_VALUES` are not normalized into runtime settings. They must not be silently repurposed for CLI effort controls.
- Main-process `execFile` injection in text automation is the local subprocess precedent. CLI execution remains in main and must use a testable process-runner abstraction.

## Claude Web Provider Study

Research was performed on 2026-07-17 with Chrome DevTools MCP against an authenticated Claude page, the supplied 30 MB HAR, and the currently loaded JavaScript/CSS assets. No live microphone recording was started. Concrete organization/account identifiers, cookies, tokens, request bodies, transcript text, and audio bytes are intentionally omitted.

### UI and Frontend Assets

- The dictation button's stable accessibility name is `Press and hold to record`.
- The reported `r_2q`-style DOM ID is generated by React. A live reload produced a different ID, and the HAR assets do not contain that ID. It is not an integration contract.
- The button uses generic utility classes; compiled CSS contains recording-state styling such as `[data-recording]`, but hashed asset names and utility classes are also unsuitable production selectors.
- The current voice implementation is in a lazy JavaScript chunk matching `cfee10a37-*.js`; compiled voice styling is in `c6a992d55-*.css`. These hashes are evidence locators, not durable filenames.
- The bundle builds the WebSocket URL with `URLSearchParams`, sends raw binary audio, and handles JSON control/events. Production should call the endpoint directly in the authenticated provider page rather than automate the mic button.

### Observed WebSocket Contract

Endpoint:

```text
wss://claude.ai/api/ws/speech_to_text/voice_stream
```

Observed query contract:

| Parameter                 | Observed value/source                                                                 | Requirement                                                                |
| ------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `encoding`                | `linear16` when conversation-engine mode is enabled; otherwise bundle supports `opus` | Initial provider uses verified `linear16` only                             |
| `sample_rate`             | `16000`                                                                               | Validate and send 16 kHz audio                                             |
| `channels`                | `1`                                                                                   | Validate and send mono audio                                               |
| `endpointing_ms`          | `300`                                                                                 | Versioned internal default; not user-editable initially                    |
| `utterance_end_ms`        | `1000`                                                                                | Versioned internal default; not user-editable initially                    |
| `language`                | HAR: `en-US`; bundle default: `en`                                                    | Validated BCP-47 provider setting with explicit `en-US` default            |
| `use_conversation_engine` | `true`                                                                                | Required for the observed PCM path                                         |
| `stt_provider`            | `deepgram-nova3`                                                                      | Versioned internal default; not presented as a guaranteed model catalog    |
| `client_platform`         | `web_claude_ai`; bundle also supports `desktop_app`                                   | GPT-Voice uses `web_claude_ai` unless research proves otherwise            |
| `organization_uuid`       | Active organization, dynamic                                                          | Discover per authenticated session; never hardcode or persist from HAR     |
| `conversation_uuid`       | Optional in bundle                                                                    | Omit for standalone transcription unless a canary proves it is required    |
| `forward_interims`        | Optional `typed`, feature-flagged                                                     | Parser supports it; initial request omits it unless canary coverage exists |

Handshake observations:

- The HAR contains one successful HTTP `101` upgrade.
- No application WebSocket subprotocol or initial configuration frame was observed.
- Browser-managed headers included `Origin` and standard WebSocket upgrade headers. The HAR did not retain `Cookie` or `Authorization`, which does not prove anonymous access.
- A Chrome MCP same-origin canary opened the current endpoint through the authenticated page, sent `KeepAlive` and `CloseStream`, and received a clean close code `1000` without recording audio. This confirms the page-context approach for the current session, not a permanent auth contract.

### Audio and Event Contract

The supplied capture contained:

- 93 client-to-server binary audio frames.
- One client `KeepAlive` JSON message and one client `CloseStream` JSON message.
- Four server `TranscriptText` messages and one server `TranscriptEndpoint` message.
- No automatic reconnect, error frame, close frame/code, server audio, or `TranscriptInterim` frame in this capture.

The current bundle additionally handles `TranscriptInterim` with string `data`.

Observed audio frames decode to 2,730 bytes each: 1,365 signed 16-bit mono samples, approximately 85.31 ms at 16 kHz. HAR timestamps were partially batched, so they are not reliable pacing evidence. Chunk size and pacing remain a canary-validated implementation constant rather than a public setting.

`TranscriptText` values are cumulative snapshots, not deltas. The provider must replace the current interim value and commit it once on `TranscriptEndpoint`; appending every frame would duplicate text.

Client control messages:

```json
{ "type": "KeepAlive" }
```

```json
{ "type": "CloseStream" }
```

Server event shapes:

```json
{ "type": "TranscriptText", "data": "<cumulative text>" }
```

```json
{ "type": "TranscriptInterim", "data": "<cumulative text>" }
```

```json
{ "type": "TranscriptEndpoint" }
```

### Lifecycle Findings

- The bundle sends `KeepAlive` every four seconds while the socket is open.
- Normal stop ends recording, sends `CloseStream`, keeps transcript callbacks active while draining, and then waits for server close with a nominal two-second force-close timer.
- The HAR's final endpoint arrived about 2.56 seconds after `CloseStream`, so a two-second production timeout must not be copied without multi-run validation.
- `TranscriptEndpoint` commits the current transcript but does not reconnect or close the socket.
- Socket error or remote close stops the current dictation. The studied bundle has no automatic reconnect loop.
- A later recording creates a fresh WebSocket. The supplied HAR has only one socket and does not demonstrate reconnection after speech finishes.
- The web UI stops after roughly 15 seconds without a transcript outside push-to-talk mode and after a maximum recording duration of roughly 120 seconds. These UI timers are evidence, not automatically GPT-Voice requirements.

## Technical Direction

### Claude Web Data Flow

```text
renderer AudioWorklet -> incremental PCM16/16 kHz/mono -> typed streaming IPC
  -> main streaming service -> ClaudeWebVoiceProvider -> authenticated Claude Page
  -> paced page-owned WebSocket -> finalized transcript
  -> existing clipboard/cache/history flow
```

Claude Web uses live streaming automatically. The reusable capability is explicit
in provider metadata, while ChatGPT Web and OpenAI API retain the existing batch
recording path. The current buffered Claude `transcribe()` implementation remains
available only for an explicit manual Retry and rollback:

```text
failed live capture -> retained in-memory WAV -> explicit Retry -> buffered transcribe()
```

There is no automatic replay after any live audio byte has been sent. The final
UI remains unchanged: interim snapshots are consumed for protocol state only and
only a finalized transcript reaches the renderer completion flow.

### Live Streaming Contract

1. Provider metadata declares `VoiceTranscriptionMode = 'batch' | 'streaming'`.
   Claude Web advertises `streaming`; ChatGPT Web and OpenAI API advertise
   `batch`. Main uses a common provider lifecycle base plus nominal batch and
   streaming base classes. Streaming providers retain buffered `transcribe()`
   only for explicit retry; live operations require a separate privileged
   capability.
2. The preload exposes four typed operations:
   - `startStreamingTranscription()`
   - `sendStreamingTranscriptionChunk(operationId, sequence, chunk)`
   - `finishStreamingTranscription(operationId, sequence, finalChunk, recordingWav)`
   - `cancelStreamingTranscription(operationId)`
3. Main binds one opaque operation ID to the trusted main-window sender and the
   active streaming-capable provider. It rejects concurrent operations, wrong
   senders, provider switches, invalid or repeated sequence numbers, oversized
   chunks, odd-byte PCM, and finish data that does not match the accumulated
   recording WAV.
4. Capture begins immediately through a self-hosted `AudioWorklet`. It mixes
   input channels to mono, resamples statefully to 16 kHz, converts and clamps
   samples to little-endian PCM16, and retains only the current recording's PCM
   in memory so an equivalent retry WAV can be constructed.
5. Capture and socket connection start concurrently. While the socket connects,
   the renderer may queue at most 64 complete 2,730-byte frames. Frames drain in
   strict sequence, serially, and no faster than one every 85.31 ms. Queue
   overflow cancels the operation safely and retains the current recording only
   for explicit retry.
6. Pause excludes new microphone samples from PCM, frame, and WAV state. The
   socket stays open, queued frames continue draining, and `KeepAlive` continues
   every four seconds. Resume does not insert synthetic silence.
7. Stop flushes the resampler and the final even-length PCM fragment, drains all
   queued audio, sends `CloseStream` exactly once, and waits for the finalized
   endpoint within the existing transport deadline. Stop before socket open is
   supported by the same bounded queue and deadlines.
8. Transport start, push, finish, and cancel use one fresh page-owned WebSocket
   per operation. They serialize chunk and keepalive writes, replace cumulative
   transcript snapshots, commit endpoint text once, retain no interim UI, and
   release timers, sockets, page state, and buffers on every terminal path.
9. Provider switch, main-window destruction, browser shutdown, and application
   exit cancel the active operation. Late chunks or completion from a cancelled
   operation cannot affect clipboard, cache, history, notifications, or another
   provider.
10. Successful finish enters the existing cache, clipboard, history, and timing
    flow once. Diagnostics retain safe timing and byte/count metadata only;
    audio, transcript text, account data, socket URLs, and raw events are never
    logged or persisted.
11. The existing private transport deadline remains authoritative. Live mode
    adds no new user-visible recording-duration limit, setting, dependency, or
    automatic reconnect.
12. A feature gate keeps Claude on the current buffered path unless the
    metadata-only live canary passes. A canary failure blocks streaming rollout;
    it never silently enables a partial or unverified live implementation.

### Claude Web Requirements

1. Register `claude-web` as a `browserSession` provider with login URL `https://claude.ai`.
2. Reuse the centralized CloakBrowser lifecycle, trusted IPC sender checks, navigation retry, provider switching, and session clearing.
3. Store Claude session state separately from ChatGPT and encrypted API settings. Never reuse or import the research Chrome profile.
4. Validate session usability using only the minimum required Claude cookie/origin state. Research must confirm whether cookies alone are sufficient when restoring into the persistent background context.
5. Navigate an authenticated provider page and derive the active organization from current authenticated application state/traffic. Validate it against eligible organization evidence from an authenticated response, currently the bootstrap membership list. Never hardcode the supplied UUID, log it, or use list ordering as an undocumented selection rule.
6. If multiple eligible organizations make active selection ambiguous, fail with an actionable setup message until a deterministic policy is approved; do not guess.
7. Override readiness for page/session auth without inventing an access token.
8. Accept only verified PCM16/16 kHz/mono input for the WebSocket path. Validate live PCM chunks directly and parse/strip the WAV container only for explicit buffered retry. Reject compressed fallback input with an actionable error unless a deterministic conversion path is explicitly implemented and tested.
9. Open the WebSocket from the authenticated page context so browser-managed origin/session behavior remains inside the privileged provider browser.
10. Pace live and retry binary chunks according to canary evidence, send four-second keepalives, send `CloseStream` after the last chunk, and continue accepting final events during the existing bounded drain period.
11. Parse JSON defensively with an exhaustive known-event union. Ignore unknown events safely while recording length/type-only diagnostics.
12. Replace cumulative interim text; commit once per endpoint; deduplicate repeated final snapshots.
13. Use a fresh socket per transcription. Do not implement mid-stream reconnect. Explicit Retry may replay the retained original buffered audio, but no automatic replay occurs after live audio transmission starts.
14. Apply connect, first-event, overall, and drain timeouts; close sockets/timers on completion, error, provider switch, and shutdown.
15. Keep result-affecting language/protocol settings in the transcription cache context, excluding session/account identifiers.
16. Map login/session expiry, permission/feature unavailability, upgrade failure, rate limit, malformed event, timeout, empty transcript, and connection loss to safe localized errors.
17. Model organization resolution and account scope on separate axes. Organization resolution is `resolved`, `missing`, or `ambiguous`; account scope is `personal`, `organization`, or `unknown`. A resolved UUID with `unknown` scope is usable. Scope is private runtime metadata, is never persisted or added to cache context, and does not change WebSocket routing until a verified personal-specific contract is approved.

### Shared CLI Runner Requirements

1. Run processes only in Electron main through an injectable `CliProcessRunner` implemented with `spawn()` or `execFile()` and `shell: false`.
2. Pass selected text only through stdin. Arguments may contain validated application settings and the non-secret prompt, never transcript contents.
3. Use an empty, per-request temporary working directory so repository instructions and project-local settings are not context.
4. Use an environment allowlist. Do not inherit API-key/auth override, model override, debug, hook, telemetry-exporter, or proxy variables unless a later explicit setting requires them.
5. Auto-discover the executable through the GUI application's effective PATH and support an optional absolute executable path. A setting is a path only, never a command line.
6. Preflight installation and authentication without logging identity, account, subscription, or credential details.
7. Reuse the selected-text `AbortSignal`; own a configurable timeout; send graceful termination followed by bounded process-tree termination.
8. Bound stdout and stderr bytes. Treat `EPIPE`, spawn failure, signal exit, timeout, abort, nonzero exit, empty output, and malformed structured output distinctly.
9. Determine success from exit status and parsed output. Nonempty stderr is not failure by itself.
10. Never log stdin, stdout text, the full environment, CLI debug output, auth details, selected text, or model responses. A length-limited sanitized stderr excerpt may be shown only for a failed process.
11. Do not persist CLI sessions or transcripts. The CLI continues to own its authentication state.
12. Cache context includes provider ID, CLI version/capability version, model, reasoning/effort, verbosity, prompt, and other result-affecting settings.

### Claude CLI Prettify Requirements

Verified against Claude Code `2.1.71`; implementation must capability-check rather than freeze this as a permanent minimum.

- Noninteractive invocation: `--print`, text stdin, JSON output.
- Structured output: inline `--json-schema` requiring `{ "text": "..." }`.
- Isolation: `--tools ""`, `--disable-slash-commands`, empty `--setting-sources`, strict empty MCP config, `--no-chrome`, `--no-session-persistence`, and `--permission-mode dontAsk`.
- Model: unset means Claude default; otherwise accept a known alias or validated full model name. Claude has no machine-readable model catalog, so the UI supports known aliases plus free text.
- Effort: default, `low`, `medium`, or `high`.
- Include an optional fallback model. An empty value omits `--fallback-model`. `--max-budget-usd` and undocumented thinking/output environment variables remain deferred until subscription behavior and UX are validated.
- Authentication preflight: `claude auth status --json`; consume only the logged-in boolean.
- One authorized canary must capture and sanitize the exact JSON/structured-output envelope before parser fixtures are finalized.

Conceptual argument construction:

```typescript
const args = [
  '--print',
  '--input-format',
  'text',
  '--output-format',
  'json',
  '--system-prompt',
  protectedPrompt,
  '--json-schema',
  JSON.stringify(PRETTIFY_OUTPUT_SCHEMA),
  '--tools',
  '',
  '--disable-slash-commands',
  '--setting-sources',
  '',
  '--strict-mcp-config',
  '--mcp-config',
  '{"mcpServers":{}}',
  '--no-chrome',
  '--no-session-persistence',
  '--permission-mode',
  'dontAsk',
];
```

### Codex CLI Prettify Requirements

Verified against Codex CLI `0.144.3`; implementation must capability-check because negative feature switches and model-catalog fields can change.

- Noninteractive invocation: `codex exec` with transcript on stdin.
- Persistence/config isolation: `--ephemeral`, `--ignore-user-config`, `--ignore-rules`, `--strict-config`, and `--skip-git-repo-check` in an empty working directory.
- Execution isolation: `--sandbox read-only`, `approval_policy="never"`, disabled shell/unified-exec/apps/hooks/multi-agent/plugins/remote-plugin features, and disabled web search. The exact accepted switches must be verified for the installed version before enabling the provider.
- Structured output: a packaged, non-secret JSON schema file and schema-constrained final stdout. JSONL is reserved for future progress/error needs.
- Model discovery: try `codex debug models`, fall back to `codex debug models --bundled`, then retain the configured free-text model if the catalog contract changes.
- Use catalog `slug`, display name, supported reasoning levels, default effort, verbosity support, and default verbosity. Initially expose only verified `low`, `medium`, `high`, and `xhigh`; gate catalog-only `max`/`ultra` values behind a live compatibility canary.
- Model unset means the Codex default. Reasoning summary is forced to `none`; verbosity defaults to `low` and may be configured as `low`, `medium`, or `high` when supported.
- Authentication preflight: `codex login status`; rely on exit code, not localized output.
- Codex may emit benign stderr on exit `0`; the adapter must not misclassify this as failure.
- The provider remains disabled/experimental if a capability canary cannot prove that executable tools and external integrations are unavailable.

The installed CLI does not accept `codex exec --ask-for-approval`; the implementation must use a validated config override such as `-c approval_policy="never"` instead of inventing a flag.

### Settings and UI Requirements

1. Extend `PrettifyProviderId` with `claude-cli` and `codex-cli` and make every provider switch exhaustive.
2. Introduce provider capability metadata for base URL, model source (`discovered`, `known-plus-free-text`), reasoning controls, verbosity, load/unload, API key, and HTTP generation controls.
3. Claude CLI settings: optional absolute executable path, model, optional fallback model, effort, timeout.
4. Codex CLI settings: optional absolute executable path, model, reasoning effort, verbosity, timeout, and experimental/capability status.
5. Hide temperature, top-p, top-k, min-p, repetition penalty, seed, max-output-token, base-URL, API-key, and VRAM controls when the selected CLI does not document support. Never imply ignored settings are applied.
6. Preserve the existing Prettify prompt and conservative source-data guard.
7. Persist only non-secret CLI settings in normal app configuration. Do not copy CLI auth files or tokens.
8. Disclose that selected text is sent to Anthropic or OpenAI through the user's CLI account and may consume subscription/API quota.
9. Provide localized, actionable states for not installed, not executable, not authenticated, unsupported version/capability, invalid model/effort, timeout, cancellation, and malformed output.

## Private Endpoint Research Plan

This research is an implementation prerequisite, not a production telemetry feature.

### R1 — Reproduce and Sanitize

- Use Chrome DevTools MCP with an explicitly authorized Claude test session.
- Record endpoint path, query names, header names, close codes, event type/shape, frame direction/size/timing, and status only.
- Never retain cookie/header values, organization/account UUIDs, user transcript text, audio payloads, or personal page content.
- Confirm findings against both the supplied HAR and the currently loaded bundle/CSS; record asset version/date because hashes change.

### R2 — Authentication and Organization Selection

- Validate a fresh GPT-Voice login context and restored background context independently.
- Determine the minimum required cookie/origin storage and whether localStorage/IndexedDB is necessary.
- Identify a deterministic active-organization signal from authenticated
  bootstrap state or observed same-origin traffic and validate it against
  eligible organization evidence from the authenticated bootstrap response.
- Test single- and multi-organization accounts without persisting raw account metadata.
- Treat active-organization resolution separately from personal/organization scope classification. Record a personal scope only when a stable explicit same-origin signal is verified; otherwise record `unknown` without blocking a uniquely resolved active organization.
- Gate: no implementation proceeds with list-order selection or a hardcoded UUID.

### R3 — Buffered Replay Canary

- Generate non-personal synthetic PCM16/16 kHz/mono fixtures.
- In the authenticated page, open a socket, replay raw PCM at observed chunk sizes and real-time pacing, send keepalives, close, and capture only event metadata plus an expected synthetic phrase.
- Compare real-time pacing, bounded faster-than-real-time pacing, chunk sizes, and finalization behavior across several runs.
- Measure connect, first transcript, endpoint, and post-`CloseStream` drain latency.
- Gate A: if buffered replay is reliable, retain `BaseVoiceProvider.transcribe()`.
- Gate B: if the endpoint requires live capture/cadence, update this spec before introducing typed streaming IPC and renderer recorder changes.

### R4 — Lifecycle Matrix

- Capture two consecutive recordings to prove fresh-socket behavior.
- Exercise normal endpoint, manual stop, silence, cancel, delayed final transcript, malformed/unknown event, server close, network interruption, expired session, and feature unavailable.
- Test new-chat and existing-conversation contexts, optional `conversation_uuid`, locale changes, and typed interim feature flags.
- Determine whether retrying a buffered recording is duplicate-safe.

### R5 — Contract Fixture and Revalidation

- Convert sanitized event metadata into deterministic fixtures; no HAR/audio/transcript is committed.
- Document a manual revalidation checklist and the observed contract version/date.
- Fail closed with an actionable “Claude Web protocol changed” error when required query/event assumptions are no longer met.
- Re-run the checklist before releases that modify Claude Web, browser runtime, session persistence, or audio encoding.

### R6 — Live Streaming Canary

- Use the authorized dedicated CloakBrowser research profile and either locally
  generated synthetic speech or a publicly licensed, reference-transcribed,
  non-personal fixture converted in memory to PCM16/16 kHz/mono. Never run this
  canary in CI or commit the audio/reference text.
- Open fresh authenticated page-owned sockets and model immediate capture by
  accumulating frames before the connection opens, then draining them at the
  validated 2,730-byte and 85.31 ms cadence.
- Revalidate two consecutive streams, pause/resume with keepalive, cumulative
  transcript and multiple-endpoint behavior, cancellation, Stop before open,
  and finalization after `CloseStream`.
- Compare a short stream with a 30-second stream. On a stable connection the
  30-second stream should normally finalize within three seconds after Stop,
  and post-Stop time must not grow linearly with recording duration.
- Retain only timing ranges, event categories/counts, close codes, queue
  high-water marks, public fixture attribution, and normalized reference-match
  booleans. Do not retain audio, transcript/reference text, identifiers, URLs,
  raw events, or the profile.
- Gate: all downstream live-streaming work remains blocked until this canary
  passes and receives human review. Failure preserves the buffered provider as
  the default and requires contract revalidation or replanning.

## Tech Stack

- Electron `^43`, Node.js `>=24`, npm `>=11`.
- TypeScript `^6` in strict mode, CommonJS package model, Webpack, React `^19`, SCSS.
- Playwright Core `1.61.1` and the existing CloakBrowser integration for provider sessions.
- `node:test` with deterministic fakes/fixtures.
- Node `child_process` for CLI adapters; no shell and no new process dependency by default.
- Native browser WebSocket and Web Audio behavior inside the authenticated Claude provider page.

## Commands

Development and verification:

```bash
npm run dev
npm start
node --import tsx --test tests/main/providers/ClaudeWebVoiceProvider.test.ts
node --import tsx --test tests/main/prettifyProviders.test.ts tests/shared/prettifySettings.test.ts tests/renderer/appSettingsUtils.test.ts
npm run format:check
npm run lint
npm run typecheck
npm run test:types
npm test
npm run prepare:cloakbrowser
npm run smoke:cloakbrowser
npm run audit:prod
npm run build:prod
```

Read-only capability research:

```bash
claude --version
claude --help
claude auth status --json
codex --version
codex exec --help
codex login status
codex debug models --bundled
```

Live provider/CLI canaries are manual, opt-in checks. They are never part of CI or the default test command.

## Project Structure

Expected areas; the Phase-2 plan will assign exact slices after this spec is approved:

```text
src/main/providers/
  ClaudeWebVoiceProvider.ts       -> browser-session provider lifecycle
  claudeWebProtocol.ts            -> pure query/control/event helpers
  claudeWebPageTransport.ts       -> page-owned start/push/finish/cancel transport
  index.ts                        -> voice provider registry
src/main/services/
  transcription.ts               -> existing batch orchestration and explicit retry
  streamingTranscription.ts      -> owned live operation and completion orchestration
  prettifyProviders.ts            -> adapter registry/capabilities or extracted adapters
  cliProcessRunner.ts             -> bounded, cancellable, injectable subprocess runner
  selectedTextPrettify.ts         -> exhaustive cache/error behavior
src/shared/
  prettifySettings.ts             -> provider IDs, settings, defaults, validation
src/renderer/
  audio/                          -> self-hosted worklet and incremental PCM pipeline
  hooks/useRecording.ts           -> capability-driven batch/live recording workflow
  AppSettingsWindow.tsx           -> provider-specific settings state
  appSettingsUtils.ts             -> exhaustive validation/dirty-state handling
  components/settings/PrettifySection.tsx -> capability-driven controls
tests/main/providers/
  ClaudeWebVoiceProvider.test.ts
  claudeWebProtocol.test.ts
  claudeWebPageTransport.test.ts
tests/main/
  streamingTranscription.test.ts
  cliProcessRunner.test.ts
  prettifyProviders.test.ts
tests/shared/
  prettifySettings.test.ts
tests/renderer/
  appSettingsUtils.test.ts
docs/specs/claude-web-voice-provider/
  spec.md
  tasks/plan.md
  tasks/todo.md
  tasks/handoff.md
```

Streaming IPC contract files (`src/main/ipc.ts`, `src/main/preload.ts`, and
`src/renderer/types.d.ts`) change together and retain trusted main-window sender
validation.

## Code Style

Use strict, explicit protocol parsing and exhaustive provider handling. Do not weaken types to accommodate private responses.

```typescript
type ClaudeSpeechEvent =
  | { type: 'TranscriptText'; data: string }
  | { type: 'TranscriptInterim'; data: string }
  | { type: 'TranscriptEndpoint' };

export function parseClaudeSpeechEvent(value: unknown): ClaudeSpeechEvent | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  if (value.type === 'TranscriptEndpoint') return { type: value.type };
  if ((value.type === 'TranscriptText' || value.type === 'TranscriptInterim') && typeof value.data === 'string') {
    return { type: value.type, data: value.data };
  }
  return null;
}
```

Conventions:

- English repository text, Prettier formatting, aliases for cross-directory imports, and small explicit functions.
- No `any`, `@ts-ignore`, type-suppressing non-null assertions, runtime `console.*`, or shell command strings.
- Scoped `electron-log` with safe metadata only.
- Account IDs, session details, audio, selected text, transcripts, stdout, and raw provider responses are never log fields.

## Testing Strategy

### Unit Tests

- WAV validation/header stripping, 44.1/48-kHz stateful resampling, mono mixing,
  PCM clamping, exact frame boundaries, final fragments, pause behavior, WAV
  equality, query construction, event parsing, cumulative transcript
  replacement, endpoint commit/deduplication, keepalive/drain timeouts, and
  unknown events.
- Claude provider lifecycle with injected page/socket/session fakes: ready/not ready, active organization discovery, ambiguous organizations, auth expiry, connect failure, late final, timeout, empty result, cleanup, and shutdown.
- Live queue start/backlog, 64-frame overflow, strict pacing/order, Stop before
  connect, cancellation, provider switching, trusted sender and operation
  ownership, invalid sequences/chunks, final-WAV equality, cache/history
  completion, manual retry retention, and cleanup.
- CLI runner argv/stdin separation, `shell: false`, sanitized environment, isolated cwd, output caps, spawn errors, `EPIPE`, exit/signal handling, timeout, abort, graceful/forced process-tree cleanup, and sanitized errors.
- Claude/Codex adapter command vectors, auth preflights, schema output, malformed/empty output, stderr-on-success, model/effort validation, and cache context.
- Exhaustive settings normalization/migration, capability-driven UI validation, free-text/discovered models, hidden unsupported controls, and locale key parity.

### Integration Tests

- Registry/factory and browser navigation retry include `claude-web`.
- Typed renderer/preload/main contracts remain aligned.
- Selected-text single-flight cancellation, clipboard restoration, cache invalidation, and notification behavior remain unchanged for CLI adapters.
- No automated test launches a real CLI, browser account, WebSocket, or provider request.

### Manual Verification

- Use an isolated Claude test session/profile and synthetic/non-private audio.
- Verify short, 30-second, paused, cancelled, Stop-before-connect, and
  consecutive live recordings with metadata-only evidence. Under a stable
  connection, confirm normal finalization within three seconds after Stop and
  no duration-proportional replay delay.
- Verify the self-hosted AudioWorklet loads from the trusted application origin
  under the development and production CSP/bundles.
- Verify login/save/restart/restore, first transcription, consecutive recordings, provider switching, clear auth, expiry, network failure, and protocol-change error.
- Verify each CLI with an explicitly authorized account, no project files in cwd, tool isolation, model/effort selection, cancellation, timeout, and quota disclosure.
- Inspect logs and persisted configuration to confirm absence of account IDs, cookies, tokens, audio, selected text, transcript text, stdout, and response bodies.

### Coverage Expectations

- Every pure protocol/settings branch and process failure class has deterministic coverage.
- New provider registry IDs and exhaustive switches are compile/test enforced.
- Live-provider availability is never a criterion for automated suite success.

## Boundaries

### Always Do

- Preserve main/renderer privilege separation, trusted IPC sender validation, and typed contracts.
- Derive account-scoped Claude values from the authenticated session and validate them.
- Use session/provider-specific storage and safe length/type-only diagnostics.
- Use `spawn`/`execFile` with `shell: false`, transcript on stdin, bounded output, timeout, cancellation, and process cleanup.
- Run focused checks after each slice and the full applicable quality set before completion.
- Update provider setup/privacy documentation and all locale files.

### Ask First

- Add a dependency, package a CLI/schema asset in a new way, or alter installers/signing/entitlements.
- Persist or expose organization/account metadata in Settings.
- Add editable private endpoint/query controls, arbitrary CLI arguments, environment overrides, or API-key auth for CLI providers.
- Change CI, release targets, clipboard semantics, recording limits, or existing provider defaults.
- Enable Codex CLI without passing its no-tools capability canary.

### Never Do

- Commit the supplied HAR, browser profile, cookies, tokens, organization/account IDs, private audio, transcripts, selected text, screenshots, or raw CLI/provider output.
- Hardcode a captured Claude UUID, auth value, generated mic ID, hashed asset filename, or undocumented account-specific value.
- Automate the Claude mic button in production or require the user's external Chrome profile.
- Invoke a CLI through a shell, put selected text in argv, inherit unreviewed secret/debug variables, or allow unrestricted user arguments.
- Copy or parse CLI auth tokens, bypass provider restrictions, or run live account assertions in CI.
- Claim unsupported sampling/reasoning controls are applied.

## Success Criteria

### Claude Web

- `claude-web` appears in the provider registry and uses the existing browser-session login/clear flow.
- A restored GPT-Voice Claude session becomes ready without a fabricated access token and without importing the research Chrome profile.
- No account identifier is hardcoded; active organization ambiguity produces an actionable error.
- Multi-organization routing succeeds only from one proven active UUID. Personal, organization, and unknown scope classifications never alter that routing rule, and `unknown` remains usable when routing is resolved.
- Verified PCM WAV input is stripped to raw PCM, streamed with validated pacing/control messages, and finalized from cumulative transcript events without duplication.
- Claude captures, resamples, and sends PCM while the user speaks; Stop drains
  only the bounded live queue and normally finalizes a stable 30-second stream
  within three seconds rather than replaying 30 seconds of audio.
- Provider metadata selects live mode only for Claude. ChatGPT Web and OpenAI
  API remain behaviorally compatible batch providers.
- Pause excludes samples while keepalive and queued-frame draining continue;
  cancel, overflow, provider switch, browser shutdown, and window destruction
  release the live operation without side effects.
- Failed live audio is available only for explicit in-memory Retry. No live
  operation automatically replays after sending its first audio byte.
- Consecutive recordings use fresh sockets; all timers/sockets/audio buffers are released on success, error, switch, and shutdown.
- The live-streaming canary is documented and passed before streaming IPC is
  implemented or enabled.
- Mock tests cover auth, protocol, parsing, timeout, cleanup, and failure behavior; one opt-in isolated-profile canary succeeds.

### CLI Prettify

- `claude-cli` and `codex-cli` are first-class, exhaustively handled provider IDs rather than vLLM fallthroughs.
- Settings expose only supported provider-specific model, reasoning/effort, verbosity, executable, and timeout controls.
- Selected text travels only through child stdin; subprocesses use no shell, isolated cwd/config, bounded output, cancellation, timeout, and process-tree cleanup.
- Claude runs without tools, skills, MCP, Chrome integration, or session persistence and returns schema-validated text.
- Codex model discovery is capability-driven; unsupported effort values are hidden; benign stderr does not fail successful runs.
- Codex remains unavailable with a clear explanation if its installed version cannot prove the required no-tools isolation.
- Neither adapter logs/persists selected text or model output, and auth remains owned by the CLI.
- Existing Ollama/vLLM behavior, clipboard restoration, cache, notifications, and settings migration continue to pass.

### Quality Gate

- Focused tests, formatting, lint, application/test type checks, full tests, CloakBrowser smoke checks, production audit, and production build pass.
- User documentation explains private-endpoint volatility, login, CLI prerequisites, model/effort controls, quota/privacy, troubleshooting, and revalidation limits.
- Manual verification records only sanitized pass/fail findings in the task handoff.

## Resolved Product Decisions

1. **Claude language is an explicit provider setting.** Store and validate a BCP-47 language tag, defaulting to `en-US`. Settings may display the current app/browser locale as a one-click suggestion, but it must not silently replace the persisted value. Language remains part of the transcription cache context.
2. **Ambiguous Claude organizations fail safely in the first release.** Use deterministic authenticated active-organization discovery. If more than one organization remains eligible and no active organization can be proven, stop with localized instructions instead of guessing, exposing account metadata, or persisting a captured UUID. An organization chooser requires a later spec revision only if real-world validation proves it necessary.
3. **Both CLI providers support an optional absolute executable path.** An empty value uses PATH discovery. Main validates a nonempty value as one absolute, executable regular-file path; paths containing spaces are valid, while embedded arguments and command lines are rejected. The path is persisted as non-secret configuration and is always passed to `spawn` with `shell: false`.
4. **Claude fallback model ships in the first release.** The field is optional and omitted from argv when empty. A nonempty value is validated like the primary Claude model and contributes to the cache context. Cost ceilings and undocumented thinking/output-token environment controls remain deferred.
5. **CLI timeout defaults to 120 seconds.** Expose a shared integer-seconds setting from 15 through 600 seconds for Claude CLI and Codex CLI. Timeout triggers the normal graceful-then-forced process-tree termination path; the internal termination grace period is not a user setting. Canary timing may justify a future default change through a spec update.
6. **Codex CLI ships behind an experimental capability gate.** Ship its adapter and Settings UI alongside Claude CLI. Before a Prettify request, verify that the installed Codex version accepts the required ephemeral/config/rule isolation, read-only sandbox, never-approval policy, disabled executable tools/apps/hooks/plugins/multi-agent features, and disabled web search. If the canary fails, keep the provider visible but unavailable with an actionable explanation. The first release provides no bypass for this gate.
7. **Claude account scope is future-compatible but not inferred.** Keep active-organization routing independent from the private `personal | organization | unknown` scope classification. The first release may proceed with `unknown` whenever one active organization UUID is proven. It does not expose a chooser or personal-specific behavior. A later personal-state solution requires a sanitized research gate, a stable explicit signal, and a focused spec/plan revision before it can affect behavior or UI.

## Phase Gate

Phase 1 was approved by the explicit planning invocation on 2026-07-17. The
organization-scope revision and Claude Web live-streaming amendment dated
2026-07-18 were explicitly authorized. The metadata-only live canary is a hard
gate: production streaming contracts cannot begin until its evidence passes and
receives human review. Personal-specific behavior remains a future follow-up and
does not block Phase 1 when active routing is resolved.
