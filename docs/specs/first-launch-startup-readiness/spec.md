# First-launch startup readiness

Status: Approved

## Outcome

On a genuinely new GPT-Voice profile, the application prepares its app-owned browser runtime before exposing the main workflow, shows truthful concurrent startup progress, and leaves the voice provider unselected until the user chooses one. The result is a usable first-launch path even when CloakBrowser was not included in the installed package.

## Requirements

### Provider selection and compatibility

- **FLR-001** A new profile has no selected voice provider. Startup must not instantiate, initialize, persist, or display any voice provider as the selected provider until the user explicitly selects one.
- **FLR-002** The unselected state is explicit and supported across configuration, main-process startup, typed IPC, and renderer state. It must never be passed to the provider registry or background browser service as a provider identifier.
- **FLR-003** The voice-provider selector remains available after initialization. Recording and provider-specific actions remain unavailable until a selection successfully completes.
- **FLR-004** Existing profiles preserve their persisted voice-provider selection. A pre-existing legacy configuration with no provider retains the historical ChatGPT fallback; only a genuinely new configuration begins unselected.

### First-launch component preparation

- **FLR-005** First-launch preparation verifies that the app-owned CloakBrowser runtime can be used before startup is considered successful. It checks the packaged runtime first and uses it without a network download when it is present and executable.
- **FLR-006** When the required packaged runtime is absent, startup may use CloakBrowser's supported vendor installer to download the runtime into its normal cache. It must preserve the dependency's signature and checksum verification; a verification failure is terminal for that attempt and must not fall back to an unverified executable.
- **FLR-007** This work does not download Local Whisper engines or models, authenticate a voice provider, create a provider session, or install third-party provider applications. Those remain explicit user actions.
- **FLR-008** A first-launch runtime-install failure keeps the startup view open, presents a concise safe failure message, and provides Retry. Retry reruns only incomplete or failed preparation work and starts a new startup generation; it must not re-run completed successful jobs or accept updates from the failed generation.

### Concurrent startup state and progress

- **FLR-009** One startup-state model owns an immutable snapshot of all bootstrap jobs, including each job's lifecycle and a renderer-safe status description. The main process publishes its owned jobs; the renderer merges that snapshot with only its own initialization jobs in one state reducer. Individual jobs must not independently overwrite a shared status string.
- **FLR-010** Main-owned startup state is published through a typed, sender-validated preload/IPC contract. The renderer must subscribe before relying on completion and must be able to obtain the current snapshot after a late subscription or reload.
- **FLR-011** The startup view displays one concise consolidated status line describing active work and the component being prepared. With concurrent work it deterministically represents all active jobs (for example, named jobs separated by a compact delimiter or a bounded summary), rather than showing whichever event arrived last. Superseded, completed, and stale-generation jobs cannot replace the current status.
- **FLR-012** The startup view displays a percentage and uses the existing shared determinate progress loader when a percentage is available. The percentage is derived only from completed, known startup work units and any dependency-provided byte totals. It must not be estimated from elapsed time, fabricated in-download milestones, or parsed from non-contractual installer logging.
- **FLR-013** Each unmeasurable operation occupies a real unfinished work unit until completion; it must not be visually advanced toward completion before measured work occurs. If no truthful aggregate percentage is available, the existing indeterminate loader is used instead.
- **FLR-014** A job terminal state is reported exactly once for its current generation. Concurrent success, failure, cancellation, retry, window creation, and renderer subscription ordering must leave the loader in a coherent current-generation state.

### Loading interface and recovery

- **FLR-015** The centered loading interface presents the shared loader, percentage, and concise status as one visually coherent group using the existing settings color and typography tokens. The status remains readable within the window without creating a new loader component or new color palette.
- **FLR-016** On successful first-launch preparation, the loading view exits only after the startup work it represents is terminal and the main screen can display the unselected provider state. It does not wait for provider login, voice-model download, or provider connection that the user has not selected.
- **FLR-017** Failure content is renderer-safe and must not expose filesystem paths, download URLs, credentials, provider sessions, or raw dependency errors. Retry is accessible by mouse and keyboard and clearly identifies the failed preparation as retryable.

## Constraints

- Renderer code accesses privileged startup state only through `window.electronAPI`; main owns filesystem, runtime installation, downloads, and process lifecycle.
- Existing shared loading components, including the current determinate `ProgressSpinner`, are reused. No parallel Select, spinner, or color system is introduced.
- IPC schemas validate startup snapshots at the preload boundary and retain trusted-sender validation.
- Startup status data contains only predefined, localized user-facing messages and numeric progress; it never includes sensitive data or raw dependency logs.
- The implementation preserves current packaged-runtime behavior and its normal build-time `prepare:cloakbrowser` path.

## Non-goals

- Pre-downloading Local Whisper models, engines, or runtime backends.
- Selecting, signing into, or testing the connection of a voice provider on a new profile.
- Changing existing provider settings, browser-session storage, or model-loading behavior.
- Introducing an elapsed-time progress estimate or depending on CloakBrowser console-log formatting.

## Acceptance criteria

### Automated

- Configuration tests distinguish a new profile from an existing profile and retain legacy/default provider compatibility.
- Coordinator tests cover: bundled runtime present; runtime missing then vendor installation succeeds; verification and network failure; retry; duplicate completion; stale update; and concurrent job ordering.
- IPC/preload tests reject malformed startup snapshots and expose current snapshot plus subscriptions only through the typed API.
- Renderer tests cover unselected-provider display, no automatic provider initialization, consolidated concurrent status, determinate percentage semantics, indeterminate fallback, retry presentation, and accessible loader semantics.
- CloakBrowser runtime tests prove that a bundled executable is preferred, fallback installation is invoked only when absent, and verification failure cannot choose an unverified fallback.

### Manual

- On a clean profile with no packaged CloakBrowser executable, launching the app shows concise preparation text and truthful progress, installs CloakBrowser successfully, and then presents no selected voice provider.
- On a clean profile with the bundled runtime, launching the app does not make a runtime download and then presents no selected voice provider.
- During intentionally overlapping startup jobs, the status remains coherent and never flips to an older or unrelated message after a newer update or Retry.
- With the network disabled or a forced installer failure, the loading view shows a safe error and Retry; a subsequent successful retry completes without restarting completed work.
- An existing configured profile opens with its previously selected provider unchanged.
