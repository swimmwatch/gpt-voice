# Prettify Provider Resource and Automation Hardening Specification

Status: Approved  
Date: 2026-08-09  
Decision ledger: `docs/specs/prettify-provider-hardening/decisions.yaml`

## 1. Purpose

This specification defines bounded, cancellation-safe resource ownership for:

1. Ollama and vLLM Prettify generation responses;
2. Ollama and vLLM Prettify generation and readiness deadlines;
3. Claude CLI and Codex CLI end-to-end operation budgets; and
4. the selected-text OS automation boundary shared by Prettify and Translation.

The desired outcome is that a slow, stalled, malformed, oversized, or
uncooperative provider or desktop helper cannot retain unbounded main-process
memory, block a selected-text workflow indefinitely, publish a late result, expose
sensitive data, or outlive a controllable cancellation or application shutdown.

## 2. Stakeholders and Success

- Desktop users must receive predictable success, cancellation, timeout, retry,
  clipboard, and fallback behavior.
- Maintainers must have one explicit lifecycle contract for HTTP generation and
  one shared lifecycle contract for selected-text automation.
- Security and privacy reviewers must be able to verify finite resource budgets,
  fixed process inputs, safe diagnostics, and deterministic cleanup.
- Test and release owners must be able to enforce Linux and Windows behavior with
  deterministic tests and bounded manual smoke checks.

The work succeeds when all in-scope operations have finite time and memory bounds,
the first terminal cause wins exactly once, successful existing workflows remain
compatible, and the acceptance criteria in this specification pass.

## 3. Scope

### 3.1 In scope

- **SCOPE-001:** Address review findings `PRETTIFY-1`, `PRETTIFY-2`, and
  `PRETTIFY-6` from the accepted Prettify provider review assessment.
- **SCOPE-003:** Apply OS automation timeout and cancellation behavior at the
  shared boundary used by both Prettify and Translation.
- **SCOPE-004:** Permit internal injected interface changes needed for clocks,
  abort signals, child ownership, and deterministic testing.
- **SCOPE-006:** Replace long automatic Prettify waits with short defaults while
  retaining bounded, explicit user configuration for slower HTTP and CLI providers.
- **COMP-001:** Preserve common selected-text behavior across Prettify and
  Translation rather than creating workflow-specific process policies.

### 3.2 Non-goals

- **SCOPE-002:** Planning, task decomposition, implementation, commits, and
  release work are not part of this specification phase.
- **SCOPE-005:** This specification bounds the complete CLI workflow but does not
  redesign preflight capability checks, cache them, alter Codex argument
  construction, or change CLI stdout parsing. Provider selection, HTTP redirect
  policy, and model lifecycle calls outside a generation operation also remain
  unchanged.
- Hard termination of the entire desktop process, such as `SIGKILL`, power loss,
  or operating-system failure, is not recoverable by application cleanup and is
  not an orphan-prevention acceptance case.
- No new provider, dependency, installer target, release target, or macOS release
  verification is introduced.

## 4. Current Contract to Preserve

- Renderer code does not receive Node, Electron, filesystem, network, or process
  privileges. Provider and OS automation operations remain in Electron main.
- Ollama and vLLM use non-streaming JSON generation and keep selected text separate
  from provider configuration.
- Remote non-loopback provider URLs require HTTPS; vLLM credentials remain confined
  to the authorized provider request.
- Selected-text actions are serialized by the process-owned action gate.
- Prettify already exposes explicit cancellation and suppresses results arriving
  after cancellation.
- Linux may recover a selected-text capture from the primary selection clipboard
  when normal copy automation fails. Windows uses PowerShell SendKeys. Linux uses
  `xdotool` for X11 and `wtype` for Wayland.
- Clipboard contents are restored after unsuccessful capture, and failed or
  cancelled operations do not populate the result cache.
- Provider audit events contain bounded metadata and cause codes, never selected
  text, prompts, provider response bodies, credentials, clipboard contents, or
  helper output.

## 5. HTTP Generation Lifecycle

### 5.1 Operation ownership and deadline

- **ARCH-001:** HTTP generation remains a privileged main-process operation behind
  the existing provider abstraction.
- **ARCH-002:** Each generation invocation owns an independent lifecycle containing
  its deadline, elapsed-time clock, abort controller, caller-abort listener,
  response reader, terminal state, and cleanup. No mutable operation container may
  be shared between concurrent invocations or stored at module scope.
- **LIMIT-001:** One absolute HTTP generation deadline applies to each Ollama or
  vLLM operation. The default is 30 seconds, and the user may select an integer from
  10 through 60 seconds.
- **CONFIG-001:** One shared, non-secret HTTP generation timeout setting applies to
  both Ollama and vLLM. Missing or invalid values normalize to 30 seconds. Renderer
  validation and main-process normalization enforce the 10–60 second range.
- The HTTP timeout affects resource lifetime only. It does not enter the Prettify
  result cache key or change a successful model result.
- The deadline begins before the first generation-related network action. For vLLM
  it includes any required wake request, the completion request, and response-body
  consumption. For Ollama it includes request submission and response-body
  consumption.
- The operation uses one remaining budget throughout. Receiving headers or a body
  chunk does not restart or extend the deadline; a slow-drip response therefore
  cannot keep the operation alive past the configured deadline.
- The elapsed-time source must have monotonic semantics and be injected for
  deterministic tests. Wall-clock changes must not extend or prematurely expire an
  operation.
- Caller cancellation and application shutdown are composed into the
  operation-owned abort controller. An already-aborted caller signal prevents all
  network work.
- A provider transport that ignores abort must not prevent the public operation
  from settling at the deadline. Any late transport completion must be observed or
  suppressed safely so it cannot cause an unhandled rejection, terminal event,
  cache write, clipboard write, notification, or retained provider body.

### 5.2 Readiness deadline

- **LIMIT-005:** HTTP availability and model-readiness work has one fixed,
  non-configurable 5,000-millisecond absolute deadline.
- **CONFIG-006:** The readiness value is an internal constant. It applies across
  primary fetch, Ollama subsidiary discovery, body consumption, decoding, and model
  contract validation without restarting between stages or chunks.
- Readiness timeout retains the existing safe unavailable result and `timed-out`
  audit cause. It does not display the generation-timeout message because no
  generation was running.

### 5.3 Bounded body contract

- **LIMIT-002:** The maximum raw body consumed for a successful HTTP generation
  response is exactly 4 MiB, defined as `4 * 1024 * 1024` bytes.
- A body of exactly 4 MiB may proceed to decoding. The first byte above that limit
  fails the operation before that byte is copied into retained aggregate storage.
- The limit applies across all chunks in the response, not per chunk. A single
  over-limit chunk and many chunks crossing the aggregate limit have the same
  outcome.
- The reader must check the incoming chunk size against the remaining budget before
  cloning or retaining it. Transport-owned memory already delivered by the runtime
  is outside the reader's control, but the application must not create an
  additional unbounded copy.
- Successful bodies are decoded once as strict UTF-8. Missing bodies, non-byte
  chunks, invalid UTF-8, invalid JSON, an invalid provider envelope, and oversized
  bodies are unexpected responses.
- Non-2xx response bodies are never parsed, logged, included in diagnostics, or
  exposed to the user. The operation records the bounded status code and promptly
  cancels or disposes the body stream without retaining it.
- Body reading must share the operation's absolute remaining deadline. A pending
  read is raced against cancellation and deadline settlement.
- The reader lock and transport body are cancelled or released on success, parser
  failure, stream failure, oversize failure, timeout, and caller cancellation.
  Cleanup is idempotent and best effort, while cleanup failure cannot replace an
  earlier timeout, cancellation, or provider failure.
- Retained body chunks, decoded text, and parsed JSON become unreachable promptly
  after the provider result is accepted or rejected.

### 5.4 Result and audit classification

- **FAIL-001:** Deadline expiry returns a distinct localized Prettify timeout result.
  It must not be presented as user cancellation or as a generic connection error.
- **UX-001:** The timeout message communicates that Prettify exceeded its time
  limit and may be retried. It contains no endpoint, model, selected text, response
  body, key, stack, or transport detail.
- Explicit caller cancellation retains the existing localized cancellation result.
- The first terminal cause observed by the operation is immutable:
  - an already-aborted or first-observed caller abort is `cancelled`;
  - a first-observed deadline is `timed-out`;
  - a connection failure before response acquisition is `connection-failed`;
  - a body transport rejection is `request-failed`;
  - a non-2xx response is `request-failed` with only the bounded HTTP status;
  - a missing, malformed, invalid UTF-8, invalid-envelope, or oversized body is
    `unexpected-response`;
  - a valid envelope with no non-whitespace result remains `empty-result`.
- Each provider generation lifecycle emits exactly one terminal audit outcome.
  Timeout is a failure with cause `timed-out`; caller cancellation is a cancelled
  outcome with cause `cancelled`.
- **PRIV-002:** Provider error text and response bodies never influence localized
  user error detail or diagnostic metadata.

## 6. CLI End-to-End Operation Budget

- **LIMIT-006:** Claude CLI and Codex CLI use one absolute budget for a complete
  operation rather than granting a fresh timeout to every sequential child process.
  The default is 45 seconds, and the user may select an integer from 15 through
  120 seconds.
- **CONFIG-007:** Each existing provider-specific CLI timeout setting represents
  this end-to-end budget. The UI and help text must describe the complete operation,
  not an individual process.
- The budget begins before the first preflight action and includes executable
  resolution, version and capability checks, authentication checks, schema
  validation, model discovery where applicable, generation, output validation, and
  owned process cleanup.
- Every sequential child receives only the operation's remaining budget. Successful
  preflight, model discovery, or child output never restarts the budget.
- The existing graceful-to-forced process termination grace must be reserved inside
  the configured overall budget. It may not extend the user-visible wait beyond that
  budget.
- A connection check, model-list operation, or one-shot Prettify operation owns its
  own overall budget. Concurrent operations do not share timers or remaining time.
- **CONC-005:** Timeout, caller abort, process error, output-limit failure, and normal
  completion obey the existing first-terminal-cause rule across the complete
  multi-process workflow. Late child completion cannot start a later stage.
- CLI timeout retains the existing localized CLI timeout classification. Explicit
  cancellation remains distinct.

## 7. Selected-Text Automation Lifecycle

### 7.1 Shared process contract

- **SEC-001:** OS automation remains owned by Electron main and is never exposed as
  raw process execution through IPC or `window.electronAPI`.
- **SEC-004:** Every availability probe, copy command, and paste command uses a
  closed application-owned executable and argument vector. Selected text, clipboard
  content, provider data, user settings, and other renderer input never enter the
  executable path, arguments, environment additions, or shell program text.
- The process boundary uses `shell: false`. Any explicit POSIX shell used solely for
  fixed executable discovery receives only compile-time-owned command text; new
  user-derived interpolation is forbidden.
- Helper stdout and stderr are not needed for product behavior. They must be ignored
  or byte-bounded, never persisted, and never copied into logs, diagnostics,
  notifications, or renderer results.
- The runner owns a spawned helper from spawn attempt through confirmed close. A
  timeout or abort requests termination and the operation does not report cleanup
  complete while an owned helper can still send a late key event.

### 7.2 Timeout and cancellation

- **LIMIT-003:** Executable discovery has an independent absolute
  2,000-millisecond deadline. Each subsequent copy or paste command has an
  independent absolute 5,000-millisecond deadline and is not entitled to unused
  discovery time.
- **CONFIG-002:** The 2-second discovery and 5-second command values are named
  internal constants and are not configurable or persisted.
- Process termination is part of each phase's deadline. Timeout uses immediate
  bounded termination rather than adding a new grace period after 2 or 5 seconds.
- **PROC-001:** The shared automation runner accepts the active operation's
  `AbortSignal`. If the signal is already aborted, no discovery or automation
  process is spawned. If it aborts after spawn, the owned process is terminated
  promptly.
- Timeout and caller abort are distinct internal terminal causes. The first terminal
  cause wins, settlement occurs exactly once, timers and listeners are removed, and
  a late close or error event cannot change the result.
- Canonical Linux and Windows helpers are direct, fixed commands and are not expected
  to create an owned descendant tree. If a future helper introduces descendants,
  it must add bounded cross-platform tree ownership or revise this specification
  before shipping.

### 7.3 Workflow integration and recovery

- **ARCH-003:** Prettify passes its active run signal into capture automation.
  Translation owns an operation abort source for its selected-text automation even
  though Translation exposes no new public user-cancel action.
- **CONC-004:** Translation provides idempotent service disposal that aborts pending
  automation. Application shutdown disposes both selected-text services before
  shutting down their provider runtimes and before destroying desktop resources.
- Prettify user cancellation, Prettify disposal, Translation disposal, and app
  shutdown must terminate any pending helper owned by the affected workflow.
- **FAIL-002:** Automation timeout or abort follows the existing safe capture-failure
  path. It does not introduce raw process errors or a new user setting.
- **COMP-007:** Linux continues to accept a nonempty primary selection when normal
  copy automation times out, aborts, or fails. This fallback does not apply to an
  empty primary selection or to Windows.
- When capture cannot produce selected text, the previous clipboard is restored,
  the provider is not invoked, no result is cached or persisted, and the existing
  localized capture/empty-selection failure is used.
- When cancellation or shutdown occurs during capture, clipboard restoration and
  action-gate release occur exactly once. A late helper event cannot press a key,
  start provider work, overwrite the clipboard, notify success, or keep the action
  gate occupied.

## 8. Concurrency and Thread-Safety Contract

This work does not introduce worker threads or shared-memory concurrency. Thread
safety is expressed as deterministic ownership under asynchronous Electron
main-process concurrency.

- **CONC-001:** Simultaneous Ollama and vLLM operations, or multiple direct runtime
  operations, have independent deadline, abort, body, timer, and terminal state.
- **CONC-002:** Completion, timeout, cancellation, stream errors, child errors, child
  close, and shutdown may race, but only the first terminal transition publishes an
  outcome. Cleanup may be called repeatedly and remains idempotent.
- **CONC-003:** Automation abort and timeout cannot settle the same process twice,
  release the cross-action gate twice, restore the clipboard twice, or allow an old
  completion to affect a new selected-text action.
- No module-level mutable runtime instance, global active-operation registry, shared
  response buffer, or shared timer is introduced. Process-owned services are
  constructed in the existing composition root and disposed through application
  lifecycle ownership.
- Every timer, abort listener, stream reader, process listener, and child reference
  is removed or released after settlement. Deadline timers must not keep the app
  alive after controlled shutdown.

## 9. Security and Privacy Requirements

- **SEC-002 / PRIV-001:** Selected text, effective instructions, generated text,
  provider bodies, API keys, clipboard contents, helper output, command environment,
  and filesystem or account detail remain private and are not added to normal logs,
  audit metadata, diagnostics, notifications, or persisted settings.
- **SEC-003:** The 4 MiB raw-body ceiling, configured 10–60 second HTTP generation
  deadline, and fixed 5-second readiness deadline are abuse limits for loopback and
  remote endpoints alike. Loopback trust does not bypass these limits.
- Existing endpoint validation, TLS requirements, credential handling, request
  headers, prompt hardening, model selection, and non-streaming request contracts
  remain unchanged.
- **PRIV-003:** Clipboard restoration and sensitive in-memory run state are cleared
  on automation success, failure, timeout, cancellation, and controlled shutdown.
- **PRIV-004:** Process diagnostics may contain only bounded categorical metadata
  such as platform strategy, timeout versus cancellation, and cleanup success.
  Executable arguments, stdout, stderr, selected text, and clipboard content are
  excluded.
- Over-limit bytes and late provider results are discarded and are never forwarded
  to diagnostic capture.

## 10. Compatibility, Configuration, and Operations

- **COMP-002:** Linux and Windows are the compatibility and acceptance targets.
  Linux covers both X11 and Wayland strategies. Windows covers the packaged
  PowerShell SendKeys strategy.
- **ACCEPT-001:** macOS release, packaging, and manual verification are outside this
  specification. Existing macOS code is not a release acceptance gate for this work.
- **COMP-003:** Valid Ollama and vLLM responses no larger than 4 MiB and completed
  within the configured 10–60 second deadline retain their current successful
  output, cache, clipboard, notification, and audit behavior.
- **COMP-004 / COMP-005:** Prettify gains prompt user cancellation of capture helpers;
  Translation gains shutdown disposal only and no new public cancel command.
- **COMP-006 / CONFIG-003 / CONFIG-005:** Add one shared HTTP generation timeout
  field to the synchronized settings, renderer validation, persistence, and
  localization contracts. It is non-secret, defaults to 30 seconds, accepts 10–60,
  and stays out of result cache context. Existing settings without the field migrate
  by defaulting it to 30.
- **COMP-008 / CONFIG-008:** Change both existing CLI timeout defaults from 120 to
  45 seconds, change their maximum from 600 to 120 seconds, and keep the 15-second
  minimum. During migration, a stored old-default value of 120 becomes 45, values
  from 15 through 119 are preserved, values above 120 are clamped to 120, and
  missing, non-integer, or otherwise invalid values normalize to 45.
- **UX-002 / LIMIT-004:** No automatic Prettify timeout default is 120 seconds.
  A 120-second CLI budget is possible only after an explicit user choice made under
  the new range.
- **UX-003 / CONFIG-004:** Automatic waits use the short defaults in this
  specification. Only HTTP generation and CLI operations expose bounded longer-wait
  settings; readiness and OS automation do not.
- Retry is the recovery action after a provider timeout or automation failure. No
  resume token, partial result, retry loop, or automatic repeat is introduced.
- Controlled shutdown remains best effort across independent resources; a cleanup
  failure is safely logged as bounded metadata and does not expose private input.
- Rollback introduces no private-data or database repair. An older build may ignore
  the new HTTP field; migrated CLI values remain within its accepted legacy range
  but are not automatically restored to the old defaults.
- User-facing settings and troubleshooting guidance must state the 30-second HTTP
  default and 10–60 range, the 45-second CLI default and 15–120 overall-operation
  range, the distinct timeout outcomes, and the retry action. All supported
  application locales must define the new HTTP timeout and help text.

## 11. Acceptance Criteria

### 11.1 Automated provider tests

For both Ollama and vLLM, deterministic tests must prove:

1. exact 4 MiB success and 4 MiB plus one byte rejection;
2. single-chunk and multi-chunk limit enforcement without retaining the over-limit
   chunk;
3. strict UTF-8, missing-body, invalid JSON, invalid-envelope, and empty-result
   classifications;
4. non-2xx bodies are not parsed, retained, logged, or exposed and their streams are
   disposed;
5. timeout before headers, during vLLM wake, during body read, and during a slow
   multi-chunk response;
6. default 30-second, minimum 10-second, and maximum 60-second absolute budgets
   rather than renewed per-stage or per-chunk timeouts;
7. already-aborted input, caller cancellation before deadline, and deadline before a
   later caller cancellation;
8. exactly one abort, one public settlement, one terminal audit result, and no late
   cache, clipboard, notification, audit, or diagnostic-capture effect;
9. reader cancellation, lock release, timer removal, abort-listener removal, and no
   unhandled late promise rejection on every terminal path; and
10. independent state under concurrent provider operations.

Provider readiness tests must separately prove one fixed 5-second absolute budget,
late-result suppression, timer and listener cleanup, and unchanged unavailable
presentation.

### 11.2 Automated CLI budget tests

For Claude CLI and Codex CLI, deterministic tests must prove:

1. one 45-second default budget covers every sequential preflight, discovery,
   generation, validation, and cleanup stage;
2. each child receives only the remaining operation time and no successful stage
   renews the budget;
3. exact 15-second minimum and 120-second maximum configured budgets;
4. forced-termination grace is reserved inside, rather than added after, the
   configured budget;
5. timeout prevents later children and late output from starting or completing a
   later stage;
6. timeout and explicit cancellation remain distinct and settle once; and
7. existing stored 120 values migrate to 45, 15–119 values remain unchanged, values
   above 120 clamp to 120, and invalid or missing values normalize to 45.

### 11.3 Automated automation and workflow tests

Deterministic tests must cover Linux X11, Linux Wayland, and Windows command
strategies and prove:

1. fixed executable and argument vectors, `shell: false`, and no selected text in
   process inputs;
2. an already-aborted signal prevents process creation;
3. executable discovery times out at 2 seconds and prevents the automation command;
4. copy and paste commands each time out independently at 5 seconds;
5. caller abort terminates a pending helper before the public workflow settles;
6. timeout, abort, process error, and close races preserve the first cause and settle
   exactly once;
7. all timers, abort listeners, process listeners, output buffers, and child
   references are released after settlement;
8. Prettify cancellation and disposal terminate capture; Translation disposal and
   application shutdown terminate Translation capture;
9. clipboard restoration and action-gate release occur exactly once, with no late
   provider call, cache write, clipboard write, paste, or success notification;
10. Linux primary-selection fallback still succeeds after automation failure, while
    an empty capture fails safely; and
11. logs and diagnostic records contain no helper output, arguments, selected text,
    or clipboard content.

### 11.4 Quality and CI gates

- Formatting, lint, application typecheck, test typecheck, the full deterministic
  test suite, production dependency audit, and production build pass.
- **ACCEPT-002 / OPS-001:** The existing Windows package-smoke job runs focused
  automation timeout, abort, process-close, cleanup, and privacy tests on the actual
  Windows runner. The normal Linux quality job continues to run the full suite.
- The Windows package smoke and Linux package smoke remain successful; no macOS job
  is required by this specification.
- Localization parity tests cover the distinct HTTP timeout message in every
  supported application locale.
- Settings tests cover the new HTTP field, both timeout ranges, CLI migration,
  renderer validation, normalization, dirty-state behavior, and synchronized
  main/preload/renderer contracts where those settings already travel.
- Documentation checks confirm the canonical user guidance contains no private
  provider or clipboard examples.

### 11.5 Manual verification

Use only synthetic, non-sensitive selected text and sanitized pass/fail records.

- On Linux X11, verify normal copy and paste through `xdotool`, cancellation during
  pending capture, clipboard restoration, and a subsequent successful action.
- On Linux Wayland, perform the equivalent `wtype` checks.
- On a packaged Windows build, verify PowerShell copy and paste, cancellation or
  controlled shutdown during a deliberately pending synthetic helper, clipboard
  restoration, and a subsequent successful action.
- On Linux and Windows, verify a synthetic stalled HTTP provider produces the
  localized timeout state without a late clipboard/cache write. The automated clock
  test is authoritative for the exact configured threshold; manual verification
  need not wait in real time when a controlled test adapter is available.
- Verify settings display and persist HTTP 10, 30, and 60 second values and CLI 15,
  45, and 120 second values, with clear wording that the CLI value covers the whole
  operation.
- Confirm sanitized logs and diagnostics contain only bounded cause and cleanup
  metadata after each failure case.

## 12. Explicit Rejection Conditions

The change is not acceptable if any of the following is true:

- HTTP generation can exceed its configured 10–60 second deadline because a stage
  or chunk renews its timeout;
- HTTP readiness can exceed 5 seconds because a subsidiary request or body chunk
  renews its timeout;
- a CLI child receives a fresh complete timeout or the complete CLI workflow exceeds
  its configured 15–120 second overall budget;
- a generation body above 4 MiB is retained, parsed, logged, or returned;
- a timed-out or cancelled operation can publish a late result or a second audit
  terminal;
- caller cancellation waits for the 2-second discovery or 5-second command timeout
  instead of
  terminating the pending helper;
- an owned helper can send a late key event after the workflow reports cancellation
  or shutdown cleanup complete;
- clipboard restoration, action-gate release, timer cleanup, listener cleanup, or
  reader cleanup is not idempotent;
- process arguments or diagnostics contain selected text, clipboard content,
  provider responses, credentials, or user-derived shell content;
- Translation and Prettify receive divergent automation resource limits;
- an existing old-default CLI value remains at 120 without an explicit new user
  choice, or the HTTP setting accepts a value outside 10–60;
- any automatic Prettify default remains at 120 seconds;
- a new dependency, unrelated public IPC surface, or new release target is
  introduced without a specification revision; or
- the focused Windows CI coverage or required Linux/Windows manual evidence is
  missing.
