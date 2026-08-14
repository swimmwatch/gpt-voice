# Prettify Providers Review Comments to Address

Date: 2026-08-09  
Source review: `docs/reviews/provider-review-2026-08-08-prettify-providers.md`  
Assessment basis: current `feat/local-whisper-provider` source, directly related
tests, the CLI Prettify specification, and the existing bounded HTTP-readiness
implementation.

## Address in the Current Remediation

### 1. PRETTIFY-1 — Bound HTTP generation response bodies

**Locations:**

- `src/main/services/prettifyHttpProviders.ts:384`
- `src/main/services/prettifyHttpProviders.ts:742`
- `src/main/services/prettifyProviderBase.ts:28`
- `src/main/services/prettifyHttpReadiness.ts:407`

The review comment is valid. Both Ollama and vLLM generation paths call
`response.text()` before checking the response status, so successful and error
responses are read without an application-owned byte limit. A faulty local server
or remote HTTPS endpoint can therefore make the Electron main process retain an
arbitrarily large response. The configured output-token limit does not enforce a
transport limit against a server that violates the protocol.

Replace `response.text()` in both generation paths with one shared bounded body
reader. Give the generation response limit its own named constant, cancel the
reader and release its lock on every terminal path, decode UTF-8 explicitly, and
apply the limit before parsing or inspecting either successful or error responses.
The existing readiness reader is the nearest precedent, but the reusable primitive
should not couple generation behavior to readiness-specific errors or audit phases.

Add deterministic tests for:

- an exact-limit response and a response one byte over the limit;
- a single chunk larger than the limit and a multi-chunk response that crosses it;
- bounded non-2xx response bodies as well as successful bodies;
- stream cancellation and lock release after success, rejection, caller
  cancellation, and limit failure;
- unchanged safe user errors and exactly one terminal audit outcome for Ollama and
  vLLM.

### 2. PRETTIFY-2 — Give HTTP generation one absolute operation deadline

**Locations:**

- `src/main/services/prettifyHttpProviders.ts:360`
- `src/main/services/prettifyHttpProviders.ts:724`
- `src/main/services/selectedTextPrettify.ts:419`
- `src/main/services/prettifyHttpReadiness.ts:78`

The review comment is valid. HTTP generation receives the selected-text run's
`AbortSignal`, but that controller is aborted only by cancellation or owner
disposal. There is no application-owned generation deadline, so a provider that
accepts the request and stops producing headers or body data can hold the operation
until the user cancels, the app shuts down, or a transport-level default happens to
intervene.

Add a dedicated HTTP generation timeout rather than reusing the 10-second readiness
deadline. Compose it with the caller signal through an operation-owned
`AbortController`, use one absolute deadline across fetch and every response-body
read, and dispose the timer and caller listener on every terminal path. The body
reader from PRETTIFY-1 must consume the same remaining budget instead of starting a
fresh timeout for each chunk, so a slow-drip response cannot extend the operation
indefinitely. Preserve the distinction between explicit cancellation and timeout in
the audit and safe user-facing result.

Add deterministic tests for:

- timeout before response headers and while waiting for a body chunk;
- a slow multi-chunk response exhausting one absolute budget;
- caller cancellation winning before the deadline and timeout winning when no
  caller cancellation occurs;
- response cancellation plus timer/listener cleanup after every outcome;
- no late result, cache write, clipboard write, or duplicate terminal audit after
  timeout.

## Address as Follow-up Hardening

### 3. PRETTIFY-6 — Bound selected-text OS automation helpers

**Locations:**

- `src/main/main.ts:150`
- `src/main/services/textAutomation.ts:84`
- `src/main/services/selectedTextPrettify.ts:528`

The review comment is valid. `TextAutomationService.run()` uses the same production
runner first for executable discovery and then for the copy or paste command, while
`runTextAutomationCommand()` invokes `execFile()` without a timeout. A hung
`where.exe`, shell availability probe, `xdotool`, `wtype`, `osascript`, or
PowerShell process can therefore stall selected-text capture. Cancelling the
Prettify run does not currently terminate that helper because the automation
boundary has no cancellation contract.

Give the production automation runner a named, bounded timeout and ensure timeout
termination settles the promise with the existing safe capture failure. Apply the
same bound to executable discovery and the actual automation command. If the runner
contract is extended to accept an `AbortSignal`, compose selected-text cancellation
with the timeout and retain process ownership until the child has terminated.

Add deterministic tests for:

- timed-out executable discovery and timed-out copy/paste execution;
- explicit selected-text cancellation while an automation helper is pending if an
  abort contract is added;
- helper termination and single promise settlement after timeout or cancellation;
- clipboard restoration, no provider invocation, no cache write, and the existing
  safe notification when capture cannot complete.

## Verdict and Verification Gaps

Carry `PRETTIFY-1` and `PRETTIFY-2` into the current remediation because they leave
the HTTP generation operation without the resource bounds already enforced by HTTP
readiness. Carry `PRETTIFY-6` as bounded cross-platform follow-up hardening because
it can indefinitely block the shared selected-text capture path.

This assessment selected three of the seven review comments. No provider
implementation was changed and no runtime or test suite was executed; each selected
item therefore lists the focused verification expected with its eventual fix.
