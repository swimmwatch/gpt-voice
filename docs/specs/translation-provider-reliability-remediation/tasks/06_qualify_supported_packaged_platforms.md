# 06 Qualify Supported Packaged Platforms

## Outcome

Representative packaged Linux x64 and Windows x64 builds complete sanitized
timeout, cleanup, suspend/resume, successful-provider, warm-reuse, and before/after
latency evidence for Google, Bing, and Yandex. External limitations remain explicit,
and macOS release support remains paused.

## Prerequisites

- Tasks 01–05 and 07 are complete and approved.
- Task 06 has separate execution authorization.
- The full deterministic gate passes on the candidate revision.
- A suitable Linux x64 host and Windows x64 host are available.
- The Task 01 baseline revision and current candidate revision are recorded exactly.

## Owned Requirements

- `OUT-001`–`OUT-004`
- `TIME-004`–`TIME-005`
- `PERF-001`, `PERF-004`–`PERF-005`
- `LIFE-003`–`LIFE-008`
- `SEC-001`, `SEC-006`–`SEC-009`
- `COMP-001`–`COMP-002`, `COMP-006`
- `ACC-013`–`ACC-016`, `ACC-021`

## In Scope

- Platform-native production build and package verification on Linux x64 and
  Windows x64.
- Non-sensitive synthetic stalled, suspend/resume, cold, and warm translations.
- Non-sensitive selected-text cancellation through the configured existing Cancel hotkey.
- Separate baseline/candidate measurements and sanitized evidence.
- Explicit recording of provider, markup, network, proxy, packaging, or host gaps.

## Out Of Scope

- macOS packaging/signing/notarization, release publication, credentials, private
  text, account login, provider challenge bypass, screenshots/DOM capture, selector
  changes, dependency/workflow changes, or acceptance weakening.

## Task Contract

1. Use the recorded Task 01 revision as the before-build source and the current Task
   05 revision as the candidate. Build the baseline in a separate disposable
   worktree or equivalent isolated source copy; never reset or checkout over the
   user's current worktree. Record exact revisions and dirty-state qualifications.
2. On each platform, run the normal production build, prepare the platform's
   CloakBrowser runtime, build the supported package, and verify the packaged
   runtime. Use repository scripts without editing package metadata, installer
   policy, workflows, or generated artifacts into source control.
3. Use only short non-sensitive synthetic source text and ordinary public provider
   pages. Do not authenticate, retain screenshots, export browser state, inspect
   cookies, record DOM/page text, or use personal clipboard content.
4. For `ACC-013`, create a controlled overall-operation stall in a disposable test
   environment using an operator-approved reversible mechanism that targets only
   the exact isolated translation browser child/resource after one confirmed source
   insertion. Resume it in time for the five-second cleanup window. Confirm the
   localized timeout, previous clipboard restoration, no result/cache/success
   notification, no late clipboard change, and later action recovery. If exact
   ownership cannot be proven, do not suspend or terminate a process; record a gap.
5. For `ACC-014`, start one synthetic pending translation, suspend the whole test
   system beyond its 60-second operation deadline, and resume. Confirm timeout wins
   before any provider result is accepted, cleanup remains bounded, and no stale
   clipboard/cache/notification effect appears. Record ordinary scheduler tolerance
   without changing the contract.
6. For `ACC-015`, run Google, Bing, and Yandex on each platform. Confirm exact target,
   clipboard copy, success notification, and healthy context reuse. Bing and Yandex
   retain adaptive/fallback acceptance and clear-or-close success. Google must replace
   source in its reused warm page without Clear or Copy-control readiness; confirm
   changed-result and identical-result generation behavior, clipboard delivery before
   focused `Control+A` and `Backspace`, and no page inspection after Backspace.
   Provider unavailability is a gap, not a reason to weaken origin/route/target,
   generation, delivery, serialization, or timeout checks.
7. For `ACC-021`, record at least one cold and four warm completed translations per
   provider for both baseline and candidate on each platform. Use the same host,
   build mode, target, synthetic input shape, provider state, and nearby network
   window within each comparison.
8. Record safe phase durations separately from end-to-end time. Compare
   application-controlled timing with Task 05 deterministic evidence; external
   provider/network time is reported separately and is not the deterministic gate.
   Any apparent regression must be explained by controlled evidence or the packet
   remains incomplete.
9. Confirm only the selected provider is prepared at startup; switching provider or
   language does not navigate or prewarm; first use of another provider remains
   cold/on-demand; healthy repeated use is warm.
10. Confirm timeout/cleanup behavior, boundary meanings, failure messages, and
    provider contract version are consistent across Linux and Windows. Do not rely on
    OS-localized browser errors as evidence.
11. During one non-sensitive pending selected-text translation per supported platform,
    invoke the configured Cancel hotkey. Confirm the cancelled renderer status,
    restoration of the prior clipboard, absence of result/cache/success notification,
    bounded cleanup, and later action recovery. Do not retain selected text or
    clipboard contents in evidence.
12. During one non-sensitive cache-miss selected-text Translation per supported
    platform, confirm the existing `processing` tray icon appears only after provider
    work begins, remains visible until the accepted terminal cleanup settles, and then
    returns to the recording-derived tray state. Record no selected text, result text,
    screenshot, provider page, URL, or credential in evidence.
13. For Google, run several synthetic warm requests, including identical-result and
    cancellation-followed-by-reuse cases. Confirm a second request cannot prepare or
    insert source until the prior Backspace or safe close/quarantine settles. Record
    only result-ready, keyboard-clear, and total duration, cold/warm state, provider ID,
    target code, and pass/fail. Do not record text, URL, cookies, account data, or page
    screenshots.
14. Write `tasks/evidence/supported-platform-acceptance.md` with safe metadata only:
    platform/architecture, app and provider contract versions, baseline/candidate
    revisions, provider ID, target code, cold/warm, elapsed safe phases, end-to-end
    duration, evaluation counts when available, pass/fail, scheduler tolerance, and
    explicit gaps. Exclude all sensitive/provider-controlled data named above.
15. Generated packages, temporary worktrees, browser caches, and test-only process
    state are not committed. Remove them only through an explicitly reviewed,
    narrowly targeted cleanup after evidence is secured; never use a broad recursive
    deletion target.

## Contracts And Boundaries

- Every live provider action is a `MANUAL GATE` because it contacts an external
  service. Ordinary synthetic translation is allowed only after execution-time
  authorization; credentials and challenge suppression remain prohibited.
- Process suspension/termination is destructive-risk work. Resolve the exact owned
  test process/resource read-only first, use a reversible suspend/resume where
  possible, and never target a broad process group or unrelated browser profile.
- Linux x64 and Windows x64 are required. macOS compilation may remain compatible,
  but no macOS package/release claim is made.
- Live canaries are operational evidence, never automated tests or a substitute for
  deterministic acceptance.

## Expected Files Or Components

- Add `tasks/evidence/supported-platform-acceptance.md` during execution.
- Update `todo.md` and `handoff.md` only after both supported platforms complete or
  with explicit blockers.
- Do not change production source or tests unless manual evidence exposes an in-scope
  defect; any such change returns to Task 05 verification before qualification
  resumes.
- Do not commit `dist/`, package installers, browser runtimes, temporary worktrees,
  logs, screenshots, or provider session data.

## Acceptance Criteria

- Linux x64 and Windows x64 each have a passing sanitized timeout/stall check,
  real suspend/resume check, selected-text cancellation check, and successful
  Google/Bing/Yandex smoke when providers are available.
- Baseline and candidate evidence contains at least one cold and four warm results
  per provider/platform and separates safe application phases from external time.
- No late clipboard/cache/notification effect appears after timeout or resume.
- Healthy contexts reuse; selection causes no prewarm; failed or uncertain contexts
  never reuse.
- Every external limitation is recorded; no credentials, private text, challenge
  bypass, weakened check, or unsupported-platform claim substitutes for evidence.

## Verification

Run the repository quality gate once more on the candidate before packaging:

```text
npm run format:check
npm run lint
npm run typecheck
npm run test:types
npm test
npm run build:prod
```

On the corresponding native host, use the applicable repository commands:

```text
npm run prepare:cloakbrowser -- --target=linux
npm run smoke:cloakbrowser
npm run dist:linux
npm run verify:packaged
```

```text
npm run prepare:cloakbrowser -- --target=win32
npm run smoke:cloakbrowser
npm run dist:win
npm run verify:packaged
```

Record exact command outcomes and artifact names in the evidence file, not full logs.

## Failure And Rollback

- Missing supported-platform host/evidence, provider unavailability without a
  recorded gap, unsafe process targeting, sensitive capture, late result effect,
  unexplained controlled regression, or a failed package/quality command leaves
  Task 06 incomplete.
- A production defect discovered here returns to Task 05: make the smallest in-scope
  correction, rerun the full automated gate, rebuild both affected packages, and
  repeat invalidated evidence.
- Rollback uses the coordinated Task 03–04 code/version/localization rollback from
  the specification. Settings and stored data need no repair. Do not delete user
  browser/session data during rollback.

## Manual Gates

- `MANUAL GATE`: create/use a disposable baseline worktree or isolated source copy.
- `MANUAL GATE`: prepare CloakBrowser and build Linux/Windows packages.
- `MANUAL GATE`: contact Google, Bing, and Yandex with synthetic text.
- `MANUAL GATE`: suspend/resume the operating system and, for the controlled stall,
  suspend/resume only an exactly identified translation browser child/resource.
- `MANUAL GATE`: remove generated packages, browser test data, and temporary
  worktrees using explicit reviewed paths.
- No commit, push, pull request, tag, release, upload, or publication is authorized.

## References

- Mandatory:
  - `package.json` scripts `build:prod`, `prepare:cloakbrowser`,
    `smoke:cloakbrowser`, `dist:linux`, `dist:win`, and `verify:packaged`;
  - `tasks/evidence/performance-baseline.md`;
  - Task 05 handoff and exact candidate revision;
  - `README.md` and `SECURITY.md` supported-platform/privacy sections;
  - `docs/agent-guides/project-conventions.md`, “Desktop, Browser, And Packaging,”
    “Tests And Documentation,” and “Git And Releases.”
- Traceability:
  - approved specification “Supported-Platform Manual Acceptance,” “Compatibility,
    Versioning, and Configuration,” “Security and Privacy,” and “Residual Risks and
    Operational Notes.”

## Completion And Handoff

- Mark Task 06 complete only when required Linux and Windows evidence is present and
  every gap is explicitly acceptable under the specification.
- Update `handoff.md` with completed packets, changed evidence files, exact checks,
  artifact cleanup state, blockers, and no next implementation packet.
- Present supported-platform evidence and stop. Do not commit, push, publish, or
  start release work.
