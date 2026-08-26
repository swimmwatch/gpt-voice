# 09 Google Translation Copy Then Keyboard Clear

## Outcome

Google keeps its immediate current-generation result acceptance and warm page reuse,
but a selected-text success reaches the clipboard before Google source clearing starts.
The provider then focuses the source and sends `Control+A` followed by `Backspace`,
without a post-Backspace page query, and blocks later submission until that keyboard
work settles.

## Prerequisites

- Packets 01–05, 07, and 08 are complete; Packet 08 is committed as `71794a9`.
- Packet 09's overwrite-and-reuse implementation is complete but uncommitted and is
  reopened under execution decision `execution.packet-09` revision 2.
- The approved specification records copy-before-keyboard-clear in `PERF-007`–`PERF-008`,
  `CONC-007`, `LIFE-003`, `LIFE-009`, `FAIL-010`, and `ACC-024`.

## Owned Requirements

`PERF-002`, `PERF-007`–`PERF-008`, `QUAL-001`, `QUAL-003`, `LIFE-003`–`LIFE-004`,
`LIFE-009`, `FAIL-010`, `SEC-001`, `SEC-005`–`SEC-006`, `CONC-004`–`CONC-007`,
`ACC-024`.

## In Scope

- Google source overwrite, page-local epoch, generation evidence, immediate result
  acceptance, acknowledged selected-text delivery, keyboard clearing, serialization,
  warm reuse, deterministic tests, and sanitized timing evidence.
- The internal result-ready callback and failure contract required to distinguish a
  completed clipboard write from rejected, stale, cancelled, or exceptional delivery.

## Out Of Scope

- Bing or Yandex result detection, clearing algorithms, contract versions, or benchmark
  baselines.
- Renderer, preload, public IPC, settings, persistence, dependencies, packaging,
  credentials, releases, commits, pushes, or Packet 06 execution.

## Task Contract

1. Preserve Google's atomic source replacement, submission epoch, exact source and
   route/target checks, and immediate `changed-after-submission` or `renewed-identical`
   acceptance without Copy-control or 500 ms stability waits.
2. For selected-text delivery, invoke the main-process result-ready callback and require
   an affirmative acknowledgement returned only after Electron clipboard write completes.
   Rejection or exception returns `resultDeliveryFailure`, starts no keyboard clearing,
   and produces no success effects. Calls without that internal callback proceed to
   cleanup after result acceptance.
3. After acknowledged delivery, find exactly one visible enabled editable Google source,
   focus it, send `Control+A`, then send `Backspace`. Backspace completion is the clear
   completion boundary; perform no subsequent source, result, route, readiness, Clear-
   control, or network-state query in that cleanup operation.
4. Keep the provider queue, selected-text action gate, and Translation tray activity
   pending until Backspace or bounded close settlement completes. No later generation
   may prepare or insert source while the keyboard operation or quarantine is unresolved.
5. A keyboard failure after delivery follows the existing page-before-context close path.
   Confirmed closure preserves the valid copied result and returns success with closed-
   page metadata. Unconfirmed bounded settlement returns cleanup failure and permits the
   selected-text owner to restore its prior clipboard exactly once.
6. Cancellation, timeout, reset, shutdown, and late browser work retain exact lifecycle
   precedence and identity guards. They cannot duplicate clearing or mutate clipboard,
   cache, notifications, diagnostics, audit terminal count, connection state, tray, or a
   newer resource.

## Contracts And Boundaries

- Electron main and provider adapters own clipboard and browser work. The callback is
  internal and synchronous; successful return is the delivery acknowledgement.
- `Control+A` and `Backspace` are Playwright page keyboard input focused on the source
  field, not OS-level global automation. Linux and Windows use the same browser chord.
- Google contract version remains `2026-08-09`; cache identity is unchanged.
- Existing 60-second operation, 15-second result, and five-second cleanup deadlines,
  one active context, one quarantine, and page-before-context ordering remain unchanged.

## Expected Files Or Components

- Base provider, Google provider/page adapter, internal translation contracts/runtime,
  and selected-text Translation service.
- Base, Google, runtime, selected-text, shortcut/tray, registry, and controlled
  performance tests.
- This workstream's specification, decision ledger, plan, todo, handoff, and Packet 06
  later manual-gate references.

## Acceptance Criteria

- Deterministic events prove clipboard write completes before source focus, followed by
  exactly `Control+A` and `Backspace`, with no post-Backspace page query or Clear click.
- Deferred delivery starts no clearing; deferred Backspace blocks a second submission.
- Sequential Google requests reuse one page/context and atomically replace source text.
- Delivery rejection/exception, keyboard failure, close success/failure, cancellation,
  timeout, reset, shutdown, hung work, quarantine, and safe late completion satisfy the
  task contract without duplicate success or privacy-sensitive evidence.
- Result-ready timing contains no keyboard work; keyboard-clear and total settlement are
  separately attributable. Bing and Yandex controlled baselines remain unchanged.

## Verification

Run focused Base Provider, Google Provider, lifecycle, runtime, selected-text,
shortcut/tray, registry, and controlled performance tests; then `npm run typecheck`,
`npm run test:types`, scoped ESLint/Prettier, YAML validation, and `git diff --check`.

Run only a sanitized no-login CloakBrowser smoke with synthetic text if the public page
is available. Record result-ready, keyboard-clear, and total duration only; never record
text, URLs, cookies, sessions, account data, network payloads, or content screenshots.

## Failure And Rollback

Delivery failure keeps the Google page dirty and follows the existing bounded healthy-
resource or close policy without sending clearing keys. Keyboard failure closes or
quarantines through existing ownership guards. Reverting this revision restores the
uncommitted retained-visible-state Packet 09 behavior; no settings or data migration is
required.

## Manual Gates

- Do not use credentials, account data, persistent browser profiles, packaging,
  release, publish, push, or commit actions.
- Linux/Windows packaged confirmation belongs only to Packet 06.

## References

- `../spec.md` — owned requirement IDs
- `../decisions.yaml` — revision 2 scope/execution and post-copy failure decisions
- `08_show_translation_tray_activity.md` — preceding committed packet

## Completion And Handoff

After verification, mark Packet 09 complete in `todo.md`, record changed files, checks,
sanitized timings or a precise smoke blocker in `handoff.md`, leave Packet 09
uncommitted, and stop before Packet 06.
