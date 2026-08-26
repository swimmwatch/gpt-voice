# Local Whisper Desktop Review Remediation Specification

Status: Approved

Date: 2026-08-08

Spec slug: `local-whisper-desktop-review-remediation`

Decision evidence: [decisions.yaml](decisions.yaml)

Approval: **APPROVAL-001** — explicit `approve` recorded in the persistent
`spec:local-whisper-desktop-review-remediation` interview on 2026-08-08.

Source review selection: [Local Whisper Desktop App Review Comments to Address](../../reviews/2026-08-08-local-whisper-desktop-app-comments-to-address.md)

Parent contract: [Local Whisper Technical Specification](../local-whisper/spec.md)

## 1. Purpose

This specification defines the required remediation of the Local Whisper desktop
review comments selected as F1, F3, F4, F5, and F6. It is a narrow amendment to the
approved Local Whisper contract. The parent contract remains authoritative except
where this document strengthens HTTP-response ownership, asynchronous lifecycle
safety, URL-validation clarity, privileged-navigation behavior, and cross-platform
verification.

The outcome is a Local Whisper desktop implementation that:

- releases every opened artifact HTTP response deterministically, including
  intermediate redirects and a final stream abandoned before its first read;
- remains correct under concurrent cancellation, iteration, disposal, timeout,
  command settlement, and renderer unmount interleavings;
- preserves the authenticated HTTPS and exact Electron sender-capability trust
  boundaries;
- behaves equivalently on supported Linux x64 and Windows x64 builds; and
- supplies deterministic automated and targeted manual evidence on both supported
  operating systems before merge.

**OUT-001:** All selected review comments and the directly related intermediate
redirect-response ownership gap SHALL be resolved according to this specification.
A partial subset SHALL NOT be described as completion of this remediation.

## 2. Stakeholders and observable outcome

- **Desktop users** retain the existing Local Whisper setup and download workflow
  without hangs, stale settings state, unexpected navigation support, or new error
  vocabulary.
- **Maintainers** receive explicit ownership for every opened network response and
  one consistent post-disposal policy for renderer commands.
- **Operators and release owners** receive Linux and Windows evidence without a new
  setting, dependency, installer behavior, migration, or release procedure.
- **Security reviewers** receive unchanged URL allowlisting, fail-closed exact-frame
  capabilities, bounded teardown, and sanitized failure behavior.

The remediation adds no user-facing feature. Successful behavior, action labels,
provider selection, artifact formats, and settings remain unchanged.

## 3. Scope and merge gate

### 3.1 In scope

The following subjects are in scope:

1. explicit idempotent disposal ownership for every response returned by the
   artifact HTTP client and for every final artifact transport stream;
2. teardown of each redirect response before another redirect request is opened;
3. cleanup when transport opening succeeds but journal persistence or another
   pre-consumption step fails;
4. consistent post-unmount state and snapshot suppression in Local Whisper settings
   commands and artifact cancellation;
5. behavior-preserving simplification of safe URL/path validation so one visibly
   validated `URL` object continues through the redirect policy;
6. an explicit fail-closed exact-URL/no-client-routing contract for privileged main
   and Local Whisper settings surfaces; and
7. deterministic cross-platform, concurrency, failure-injection, security, privacy,
   and regression evidence.

**GAT-001:** Every in-scope subject is required before the reviewed branch may merge.
There is no lower-priority post-merge subset in this workstream.

### 3.2 Out of scope

**SCP-001:** The F2 callback-only performance suggestion is excluded. This
remediation SHALL NOT claim renderer performance improvement, introduce memoization,
or restructure the snapshot/prop boundary without separate profiling evidence.

**SCP-002:** This work SHALL NOT:

- add client-side routing or an approved same-document route set;
- add or change public IPC channels, preload methods, renderer DTOs, provider
  registration, settings schemas, artifact formats, journals, failure codes, or
  persisted user data;
- change catalog trust, allowed origins, redirect limits, timeout values, queue
  limits, transfer formats, model/runtime identity, or qualification claims;
- add a package dependency, native component, worker, process, thread, setting,
  diagnostic archive field, package target, signing step, or release action; or
- commit generated artifacts or use live external network services in automated
  tests.

**SCP-003:** Planning, task packets, estimates, implementation, commits, pushes,
pull requests, qualification, and release work require separate authorization and
are not part of this specification.

## 4. Cross-platform compatibility and architecture

**CMP-001:** Linux x64 and Windows x64 remain the supported targets for this
remediation. macOS remains unavailable under the parent Local Whisper contract and
gains no new execution, download, or support claim.

**CMP-002:** The same artifact-response, renderer-lifecycle, URL-validation, and
sender-capability outcomes SHALL hold on Linux and Windows. Shared TypeScript logic
SHALL remain platform-neutral unless an operating-system adapter is demonstrably
required. Platform-specific tests MAY supplement but SHALL NOT replace the shared
contract matrix.

**CMP-003:** Public desktop behavior and all persisted formats remain compatible.
No user-data, settings, journal, cache, provider, or IPC migration is required.
Existing safe failures and recovery actions remain authoritative.

**ARC-001:** Electron main continues to own HTTP, artifact lifecycle, privileged
window identity, and IPC subscription authority. Renderer code continues to own
only UI-local state and accesses desktop behavior only through `window.electronAPI`.
No privileged operation moves into the renderer.

**ARC-002:** The process-owned Local Whisper composition root continues to own the
production artifact service and adapters. Response and stream ownership SHALL be
transferred through narrow internal interfaces; no module-level mutable owner,
service locator, or free pass-through wrapper may be introduced.

**MNT-001:** The internal response/stream interfaces SHALL make ownership and
terminal state explicit enough that a caller cannot reasonably mistake an opened
response for a value that may be dropped without cleanup. Production, qualification,
and test adapters SHALL implement the same ownership contract.

## 5. Artifact response ownership and concurrency safety

### 5.1 Ownership transfer

**RES-001:** A successful artifact HTTP-client open SHALL transfer ownership of
exactly one live response to its caller. That response contract SHALL expose an
explicit asynchronous, idempotent disposal operation that terminates or closes the
underlying response without requiring body iteration. Header-parsing failure and
every open rejection SHALL remain owned and cleaned up by the HTTP client before the
failure is returned.

**RES-002:** A successful artifact transport open SHALL transfer ownership of one
final transport stream to its caller. The stream SHALL expose an explicit
asynchronous, idempotent disposal operation. Every production and qualification
caller SHALL invoke it from a `finally`-equivalent scope after ownership transfers,
including failures before the body iterator starts. Normal exhaustion, early
iterator return, caller cancellation, timeout, body failure, and explicit disposal
SHALL converge on the same terminal teardown state.

Calling `return()` on a never-started async generator is not sufficient evidence of
cleanup. The disposal contract itself SHALL own listener removal and underlying
response termination.

### 5.2 Redirect responses

**RES-003:** Every intermediate redirect response SHALL be disposed successfully
before the next network request begins. The transport SHALL NOT drain an untrusted
redirect body merely to reuse the connection, SHALL NOT retain one redirect response
while opening another, and SHALL NOT continue the redirect chain after bounded
teardown fails. Unsafe targets, missing locations, excess redirects, and redirect
policy failures SHALL also close the current response.

Redirect response disposal SHALL NOT forward range or validator headers differently,
broaden an origin, or alter the existing host, effective-port, path-prefix, and
maximum-redirect policy.

### 5.3 Idempotence, races, and bounds

**CON-001:** Response and stream disposal SHALL be safe under every ordering of:

- caller abort before open settles;
- abort after open but before the first body read;
- one or more concurrent disposal requests;
- disposal concurrent with a pending iterator read;
- iterator exhaustion or early return concurrent with caller disposal;
- no-progress or total-transfer timeout concurrent with cancellation; and
- body or journal failure concurrent with teardown.

Exactly one terminal teardown owns the underlying resource. Other contenders SHALL
join or observe that terminal result without double-closing, double-returning an
iterator, emitting an uncaught rejection, or retaining an abort listener. After
terminal teardown, no new body read may succeed.

**RES-004:** Transport teardown SHALL use the existing five-second helper-cancellation
bound or a stricter bound. It SHALL never wait indefinitely for an iterator, socket,
or adapter. A redirect response that cannot be closed within the bound stops the
operation through an existing safe failure. Teardown after a primary operation
result SHALL NOT replace that primary result, but it MAY emit one sanitized warning.
No incomplete or unverified transfer may be promoted because cleanup failed.

**FAIL-001:** Cancellation, timeout, response error, redirect cleanup failure,
pre-consumption journal failure, and explicit disposal SHALL leave no active network
request attributable to the completed operation, no retained caller-signal listener,
and no executable or promotable staging state. Existing journal/resume classification
remains authoritative.

## 6. Renderer asynchronous lifecycle

**REN-001:** Once the Local Whisper settings hook is disposed, no asynchronous
continuation may call its snapshot acceptance path or publish React state. This rule
applies consistently to success, typed failure, thrown failure, cancellation,
timeout, and `finally` paths in both ordinary commands and artifact-cancellation
commands.

**REN-002:** Ref-owned cleanup remains unconditional. Command-pending ownership SHALL
be released, operation waiters SHALL settle once, timeouts SHALL clear, subscriptions
SHALL unsubscribe, and the renderer service SHALL dispose even when the hook no
longer accepts state. Disposal SHALL NOT leave a command permanently marked pending
inside retained non-React state.

**CON-002:** Closing the settings window or disposing its renderer subscription SHALL
not cancel a process-owned artifact transfer merely because its UI disappeared. An
already accepted main-process command may finish under the existing coordinator
contract; its late result SHALL not repopulate the disposed renderer. Reopening the
settings surface obtains a fresh authoritative snapshot through the existing atomic
subscription flow.

No new hook return value, visible notification, or command result is introduced.

## 7. URL and redirect security

**URL-001:** Initial and redirect URL handling SHALL validate the exact `URL` object
that is subsequently checked against policy and returned to the transport loop. A
path predicate SHALL accept only the parsed URL data it actually examines. Validation
SHALL not depend on invoking a parser solely for an ignored return value.

**URL-002:** The refactor SHALL preserve all current rejection behavior:

- HTTPS only;
- no username, password, or fragment;
- no backslash, encoded separator, encoded dot-segment, decoded `.`/`..`, malformed
  escape, or decoded separator path ambiguity;
- exact authenticated initial origin, scheme, host, effective port, and path prefix;
- exact allowlisted redirect host, effective port, and path prefix;
- the existing redirect limit and range-header forwarding policy; and
- rejection of transformed, multipart, wrong-length, invalid-range, or inconsistent
  validator responses.

**URL-003:** URL normalization SHALL NOT create authority. Policy comparisons use the
validated parsed URL and authenticated catalog policy. Raw URL strings, redirect
locations, response headers, credentials, and full paths SHALL remain absent from
renderer DTOs, routine logs, and user-visible errors.

## 8. Privileged navigation and subscriber lifetime

**NAV-001:** The main window and Local Whisper settings window retain an exact
canonical URL contract. Hash routing, `history.pushState`, `history.replaceState`,
same-document history navigation, nested-frame navigation, and any other
`did-start-navigation` event are unsupported on these privileged surfaces and SHALL
invalidate the current IPC capability and its subscription.

**NAV-002:** Invalidation SHALL remove the subscriber and all lifecycle listeners
exactly once. It SHALL remain correct when navigation, renderer-process failure,
window destruction, explicit unsubscribe, and controller disposal race. A stale
capability SHALL fail `isCurrent()`, SHALL send no data, and SHALL authorize no
command even if its old `WebContents` identifier still exists.

**NAV-003:** Recovery from an unsupported same-document navigation requires returning
to the canonical application URL in a fresh trusted top-level document and creating
a new atomic subscription. The application SHALL NOT silently reauthorize the old
frame or add renderer-side automatic resubscription. Any future client-side routing
requires a specification revision covering the approved route set, URL trust,
capability lifetime, and resubscription semantics together.

## 9. Security, privacy, failure, and operations

**SEC-001:** Network input remains untrusted. Response cleanup SHALL not execute
content, follow an unvalidated location, allocate or drain an unbounded body, invoke
a shell, weaken TLS verification, forward credentials, or continue after ownership
cannot be proven.

**SEC-002:** Renderer and navigation input remains untrusted. Exact live
`WebContents`, top-level frame, window ownership, canonical URL, and current
capability checks remain mandatory for every command and send. No same-origin-only,
process-ID-only, or once-trusted authorization is permitted.

**SEC-003:** New failures and diagnostic events SHALL contain only existing safe
failure codes and bounded metadata such as logical artifact ID, operation ID, phase,
or cleanup outcome. They SHALL NOT contain a URL, redirect location, request or
response header, absolute path, raw network error, audio, transcript, prompt,
credential, device identifier, or renderer-provided object.

**PRV-001:** The remediation creates no new persistence or telemetry. Tests and
manual evidence use deterministic public fixtures or private loopback fixtures and
contain no credentials, personal profiles, private audio, transcripts, or real user
artifact roots.

**OPS-001:** No configuration, installation instruction, package target, signing
policy, artifact origin, support tier, or release procedure changes. No third-party
dependency may be added to implement or test this work.

**OPS-002:** Rollback before merge reverts the internal HTTP-response,
transport-stream, renderer-lifecycle, validator, capability-contract, and matching
test changes as one coherent application build. Existing journals, installed
artifacts, settings, and provider state SHALL be preserved. Rollback SHALL NOT delete
or rewrite user data and SHALL NOT ship a mixed internal response/stream interface.

## 10. Verification contract

**TST-001:** Tests SHALL use `node:test`, deterministic clocks, deferred promises,
controlled abort signals, and local fixtures. Timing sleeps, live providers, public
internet services, credentials, real user roots, and unbounded resource probes are
not acceptable evidence.

**TST-002:** Artifact tests SHALL prove explicit response and stream ownership from
open through every terminal path. They SHALL observe underlying adapter abort/close,
iterator return where applicable, listener removal, idempotence, and bounded
settlement rather than inferring cleanup from garbage collection.

**TST-003:** Renderer tests SHALL exercise deferred success, safe failure, thrown
failure, and artifact cancellation that settle after unmount. They SHALL prove no
late snapshot/state publication while ref-owned cleanup and main-process command
ownership remain correct. The tests SHALL use existing dependencies.

**TST-004:** Security tests SHALL apply the same table-driven URL matrix to initial
and redirect targets and SHALL explicitly cover same-document navigation,
cross-document navigation, nested-frame navigation, destruction,
renderer-process failure, explicit unsubscribe, listener removal, stale sends, and
exactly-once subscriber revocation.

**TST-005:** Focused behavior and build evidence SHALL run on both Linux x64 and
Windows x64. At minimum, each operating system SHALL pass the applicable repository
commands for:

- `npm run test:local-whisper:artifacts`;
- `npm run test:local-whisper:ipc`;
- `npm run test:local-whisper:composition`;
- `npm run verify:local-whisper:ui`;
- `npm run typecheck`;
- `npm run test:types`;
- `npm run lint`;
- `npm run format:check`; and
- `npm run build:prod`.

`npm run audit:prod` SHALL also pass at least once against the unchanged lockfile.
No check may be reported as passing on an operating system where it was not run.

### 10.1 Automated acceptance criteria

| ID | Scenario | Required result | Traces |
| --- | --- | --- | --- |
| AC-AUT-001 | Open a final response successfully, then inject journal persistence failure before the first body read. | The stream disposes within the bound, the client request/response closes, caller-signal listeners return to baseline, the body is never read, no staging is promoted, and the existing safe primary failure is retained. | RES-001–RES-004, FAIL-001 |
| AC-AUT-002 | Run normal exhaustion, early return, abort-before-open, abort-before-first-read, pending-read cancellation, timeout, body failure, concurrent disposal, and repeated disposal orderings. | Each case has exactly one terminal resource owner, no double close or uncaught rejection, no successful read after close, and no retained request, iterator, timer, or abort listener. | CON-001, RES-002, RES-004 |
| AC-AUT-003 | Follow zero through the maximum allowed redirects, then exercise an excess redirect and an unsafe redirect target; give every redirect a body that would block or overproduce if drained. | Each intermediate response is terminated before the next request, no redirect body is drained, limits and header-forwarding policy remain unchanged, and every rejection closes its current response. | RES-003, URL-002, SEC-001 |
| AC-AUT-004 | Exercise the production Node HTTPS adapter against a deterministic loopback TLS server for completion, cancellation, abandoned final response, and redirects. | Socket/request/response ownership returns to baseline on Linux and Windows without external traffic, raw network errors, or uncaught late `ECONNRESET`. | CMP-002, RES-001–RES-004, SEC-003 |
| AC-AUT-005 | Apply the initial/redirect URL matrix for schemes, credentials, fragments, backslashes, encoded and decoded separators/dot segments, malformed escapes, normalization, host, effective port, and path-prefix boundaries. | Accepted and rejected cases remain identical for initial and redirect validation; the exact asserted URL object proceeds to policy checks; no authority broadens. | URL-001–URL-003 |
| AC-AUT-006 | Settle ordinary and artifact-cancellation commands with success, safe failure, and thrown failure after the settings hook unmounts. | No disposed hook accepts a snapshot or publishes React state; pending refs, waiters, timeouts, subscriptions, and service disposal settle once; a process-owned accepted transfer is not cancelled merely by unmount. | REN-001–REN-002, CON-002 |
| AC-AUT-007 | Race same-document, cross-document, and nested-frame navigation with renderer failure, destruction, explicit unsubscribe, and snapshot publication. | The old capability and subscriber invalidate exactly once, all listeners are removed, no stale send or command succeeds, and canonical fresh-document subscription still works. | NAV-001–NAV-003, SEC-002 |
| AC-AUT-008 | Compare public IPC, preload, renderer DTO, provider, settings, journal, and artifact-format contracts before and after remediation. | No public or persisted contract changes and no migration is introduced. | CMP-003, SCP-002 |
| AC-AUT-009 | Capture every new cleanup and failure diagnostic path. | Only safe bounded metadata is present; URLs, headers, paths, raw errors, audio, transcripts, prompts, credentials, and device data are absent. | SEC-003, PRV-001 |
| AC-AUT-010 | Run the focused quality matrix on supported Linux x64 and Windows x64. | Every command in TST-005 passes on both systems, the production renderer/main bundles build, and no new dependency or generated artifact is present. | CMP-001–CMP-002, TST-005, OPS-001 |

### 10.2 Manual acceptance criteria

| ID | Procedure | Required evidence | Traces |
| --- | --- | --- | --- |
| AC-MAN-001 | On a supported Linux x64 desktop, use a deterministic authenticated Local Whisper fixture to start and cancel a download, close the settings window while a command is pending, reopen it, trigger a same-document navigation attempt, then reload the canonical page. | Cancellation and window close do not hang or crash; no stale UI result appears after close; reopening shows the authoritative process-owned state; the navigation attempt invalidates the old subscription and permits no stale IPC; canonical reload creates a working fresh subscription; no sensitive diagnostic output or orphan request remains. | RES-001–RES-004, REN-001–REN-002, NAV-001–NAV-003, SEC-003 |
| AC-MAN-002 | Repeat AC-MAN-001 on a supported Windows x64 desktop using the Windows application build and the same logical fixture/scenarios. | The same observable outcomes and cleanup properties hold; Windows Electron and Node behavior does not weaken the contract or substitute build-only evidence for runtime evidence. | CMP-001–CMP-002, TST-005 |

## 11. Completion criteria

This specification is satisfied only when:

- F1, F3, F4, F5, F6, and the directly related redirect-response ownership gap
  satisfy every applicable requirement and acceptance criterion;
- focused automated evidence passes on both Linux x64 and Windows x64;
- targeted manual desktop smoke passes on both Linux x64 and Windows x64;
- every opened response and final stream has explicit bounded ownership and no
  unresolved abandonment path remains;
- exact URL, redirect, sender-capability, privacy, and safe-failure behavior remains
  at least as restrictive as before;
- no public contract, migration, dependency, package, generated artifact,
  qualification claim, or release change is included; and
- all evidence is complete before merge rather than deferred as follow-up work.

Approval of this specification authorizes neither implementation planning nor
implementation. Planning requires a separate request after explicit draft approval.
