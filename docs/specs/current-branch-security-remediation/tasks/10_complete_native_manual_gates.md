# 10 Complete Native Manual Gates

## Outcome

All six required manual acceptance gates are exercised with benign synthetic data on representative native Linux
and Windows environments, against packaged applications and dependency evidence built from one recorded current
`HEAD`. The handoff records what each real host and tool proved, what it did not prove, and any exact blocker without
promoting simulation, source inspection, or another platform's result into a pass.

## Prerequisites

- Packet 09 is complete, reviewed, and committed, and its full automated, build, advisory, and current-`HEAD`
  packaged-runtime evidence passed.
- Active user decision `acceptance.platform-ci` revision 2 requires recorded manual platform gates rather than new
  mandatory CI jobs.
- The same full Git commit is available on representative Linux and Windows hosts with the locked dependencies and
  native packaging prerequisites already provisioned.
- Current-`HEAD` benign synthetic diagnostics fixtures, isolated non-private application state, and a local
  never-responding HTTP test endpoint are available. Do not substitute user data or a live provider.
- The active agent environment on each archive host already provides a read-only tool that can list member metadata
  and selectively read one member without bulk extraction. No tool may be downloaded or installed for the gate.
- The operator has explicit authorization to launch the local packaged applications and to create the one synthetic
  local report. Replacement of an existing report still requires a separate, immediate authorization for that exact
  synthetic target.

## Owned Requirements

- `AC-MAN-001`
- `AC-MAN-002`
- `AC-MAN-003`
- `AC-MAN-004`
- `AC-MAN-005`
- `AC-MAN-006`

## In Scope

- A benign Linux tar.gz analysis/report walkthrough.
- A benign Windows ZIP analysis/refusal/report-filesystem walkthrough.
- Native packaged Linux and Windows Prettify timeout/readiness behavior.
- Translation readiness continuity after a real Settings-driven CloakBrowser reset using synthetic/non-private
  state.
- Native keyboard, focus, tooltip, layout, and screen-reader smoke verification.
- Native Linux and Windows dependency-closure and packaged-artifact inspection.
- Concise, sanitized per-gate evidence in `handoff.md`.

## Out Of Scope

- Malicious, third-party, shared, modified-positive-path, private, or unverifiable archives.
- Claims of authenticity, malicious-input safety, stable-file identity, prompt-injection isolation, complete parsing,
  resource containment, tool temporary-data absence, atomic report publication, exact Windows ACL ownership, or
  cross-platform equivalence.
- Credentials, accounts, private browser profiles, live Translation/Voice/Prettify provider actions, private audio,
  transcripts, selected text, retained user diagnostics, clipboard content, or notifications containing user data.
- New fixtures that weaken the producer contract or are committed with generated archive/report content.
- Dependency installation/update, browser-runtime download/update, production data migration, signing, notarization,
  installer publication, push, pull request, or release.
- macOS packaging or manual acceptance while macOS distribution remains paused.

## Task Contract

### Shared Native And Artifact Rules

1. Resolve and record one full gate commit with `git rev-parse HEAD`. Linux and Windows must check out that exact
   commit. If an application, dependency, build, workflow, packaging, or manual-test input changes, Packet 09 and all
   affected native gates must be rerun against the new commit.
2. On each host, record the native OS name/version, architecture, Node/npm versions, and exact project commands.
   Do not record usernames, home directories, environment dumps, provider values, local report paths, or raw
   operating-system errors.
3. Build the unpacked application natively from the recorded commit in the same host session:

   ```bash
   rtk git rev-parse HEAD
   rtk proxy node --version
   rtk proxy npm --version
   rtk proxy node -p "process.platform + ' ' + process.arch"
   rtk npm run build:prod
   rtk grep \"CLOAKBROWSER_AUTO_UPDATE = 'false'\" scripts/prepare-cloakbrowser.mjs
   rtk proxy node --input-type=module -e \"import { access } from 'node:fs/promises'; import { binaryInfo } from 'cloakbrowser'; const info = binaryInfo(); if (typeof info.binaryPath !== 'string') throw new Error('cached CloakBrowser binary unavailable'); await access(info.binaryPath);\"
   rtk npm run pack
   rtk npm run verify:packaged
   ```

   The two preflight commands are read-only: they must establish auto-update is disabled before CloakBrowser import
   and the native cached binary already exists without calling `ensureBinary()`. If either fails, stop before
   `pack`; a missing binary is a host-preparation blocker and must not trigger a download.

   Do not use an artifact that existed before these commands, came from another checkout/commit, or was built on
   another operating system. Local unpacked packaging is verification only and does not authorize an installer or
   publication.

4. A real Linux userspace and kernel must perform Linux gates. A real Windows kernel and userspace must perform
   Windows gates. A native virtual machine is acceptable only when the packaged application, filesystem behavior,
   accessibility technology, and dependency/artifact inspection actually run inside that guest OS. Mocked
   `process.platform`, unit fixtures, source inspection, WSL-as-Windows, Wine/Proton, browser emulation, a container
   for the opposite OS, or reuse of another host's result cannot pass a native gate.
5. Use only deterministic benign/synthetic data. Keep synthetic app data isolated from the user's normal GPT-Voice
   profile. Never open an account-backed browser session or point a provider at a real private service.

### Linux Archive And Local Report (`AC-MAN-001`)

6. Confirm in the active conversation that the positive fixture is a local schema-v1 GPT-Voice export generated from
   synthetic data and kept under the operator's control.
7. Record the already-available read-only archive tool and version. Before content, verify with that tool that the
   tar.gz is one regular non-symlink file at most `130 MiB`, and that it reports exactly:
   - `manifest.json`;
   - `provider-audit/events.jsonl`;
   - optionally `diagnostics/text-actions.jsonl`;
   - no duplicate, linked, special, absolute, parent-traversal, encrypted, or unreportable member.
8. Read `manifest.json` first, then select only the minimum relevant audit lifecycle and, only if indispensable, one
   action/field. Do not bulk extract or load either JSONL member. Record the evidence selection, tool, sampling, and
   omitted/unvalidated evidence qualitatively.
9. Produce the fixed ten-section report from benign evidence, with citations, confidence/uncertainty, private-data,
   sampling/tool, prompt-injection, and best-effort-redaction disclosures. Save exactly one report to a
   current-user-controlled local target. Where supported, verify created directory mode `0700` and report mode
   `0600`.
10. Attempt the same target again without replacement authorization and confirm refusal with the original report
    unchanged. Then pause for separate explicit authorization for that exact synthetic target, immediately recheck
    its regular-file/current-user ownership, replace it, and recheck the supported permission properties. If
    replacement is not separately authorized, record this gate as blocked rather than assuming permission.
11. Record only the tool/version, selected-member behavior, verified mode bits, collision/refusal/replacement outcome,
    safeguards actually observed, and disclosed limitations. Do not call the benign exercise malicious-input,
    stable-file, temporary-data, prompt-injection, or resource-containment proof.

### Windows Archive And Local Report (`AC-MAN-002`)

12. Repeat the positive-path provenance and selective-read walkthrough on a native Windows host with a benign
    synthetic schema-v1 ZIP and an already-available read-only tool.
13. Create a separate benign negative fixture under the operator's control whose only intentional defect is one
    unexpected member. Confirm the agent refuses it before reading member content and writes no report from it. Never
    present that deliberately modified negative fixture as a valid export.
14. For the valid ZIP, verify a current-user-controlled report location, default collision refusal, separately
    authorized replacement, and a locked-file write/replacement failure. Confirm the existing target remains intact
    and the failure is summarized without raw host/path/error detail.
15. Record which current-user ownership, ACL, reparse-point, regular-file, collision, replacement, and cleanup checks
    the actual filesystem tool supported. Exact DACL ownership, reparse safety, atomicity, path-race resistance, and
    cleanup are residual risks unless directly observed; unsupported properties must be recorded as unverified, not
    passed.

### Packaged Prettify Timeout (`AC-MAN-003`)

16. On both native packaged applications, use an isolated profile and configure the selected HTTP Prettify provider
    to a local loopback test endpoint that accepts a connection but never completes the readiness/model-list
    response. Do not use an external endpoint.
17. Start the packaged application and verify the global startup loader releases after the selected providers settle,
    Prettify displays the localized not-connected state and safe human-readable timeout reason, and adjacent layout
    does not move. Repeat one later explicit availability/model-list refresh and confirm it also settles.
18. Record the observable elapsed time to loader release/not-connected settlement, the localized reason, the later
    refresh settlement, stable layout, and absence of endpoint/body/raw-error data from public UI. Do not claim the
    packaged UI proves internal abort count or late-result suppression; cite Packet 03's automated tests for the
    one-deadline, one-abort, caller-cancellation, and late-completion invariants.

### Translation Reset Continuity (`AC-MAN-004`)

19. On a representative desktop build with an isolated profile and sanctioned synthetic/non-private provider state,
    subscribe to Translation readiness, save a valid CloakBrowser-settings change through the real Settings flow, and
    observe `checking` followed by exactly one terminal connected/not-connected update without restarting GPT-Voice.
20. Confirm the old work cannot publish after reset and a later readiness update still reaches the renderer,
    demonstrating the listener survived the reusable reset. Do not inspect or retain browser session/account data.
21. If no sanctioned synthetic setup can exercise the real reset without a live provider, account, or private
    browser profile, record the gate as blocked. Do not substitute a unit test or broaden authorization.

### Accessibility And Layout (`AC-MAN-005`)

22. On representative native desktop builds, use a real keyboard and one native screen reader/accessibility
    technology per exercised platform. Trigger connected and sanitized failure states for Translation, Voice, and
    Prettify with synthetic/non-private setup.
23. Verify each visible status is keyboard/focus reachable, announces one concise localized state and tooltip reason,
    does not duplicate identical label/tooltip text, and preserves the single-level row and adjacent-control geometry
    while state changes. Verify non-English output and English fallback only when localization is unavailable.
24. Record the accessibility technology/version, locale, provider states, announcement result, tooltip/focus result,
    and layout result. Source review, DOM assertions, screenshots alone, or synthetic keyboard events cannot pass
    this gate.

### Native Dependency And Packaged Artifact Evidence (`AC-MAN-006`)

25. On both native hosts, run:

    ```bash
    rtk npm run verify:diagnostics-dependencies
    rtk npm run audit:prod
    rtk npm run verify:packaged
    ```

26. Confirm the dependency verifier distinguishes:
    - host-independent locked `linux-x64` and `win32-x64` production closures;
    - current-native-host installed artifacts; and
    - the newly built current-`HEAD` packaged runtime.
27. Inspect and record detection coverage for install scripts, native-build metadata, PE, ELF, Mach-O, WebAssembly,
    executable scripts, and applicable packaged executables without relying only on filename suffixes. Record
    non-applicable signatures for the current host as non-applicable, not passed through absence.
28. Reconcile `GHSA-r292-9mhp-454m` separately as the accepted CloakBrowser `tar` path. Do not attribute it to
    `archiver`, hide it because `audit:prod` exits successfully at the blocking threshold, or accept any new advisory.

## Contracts And Boundaries

- Application behavior and privileged ownership remain unchanged; this packet observes existing public UI and
  service behavior and does not add a debug IPC, test backdoor, or renderer privilege.
- The archive exercise validates a benign workflow only. Available-tool parsing, allocation, temporary data,
  instruction handling, and filesystem behavior stay outside repository enforcement.
- The report is local, private, unencrypted, best-effort redacted, and inherits filesystem/tool limitations. It is
  never uploaded, opened externally, committed, or used as provider input.
- Provider gates use only closed status/reason surfaces. Raw endpoint, browser, error, session, and provider values
  remain absent from screenshots, notes, logs, and handoff.
- A blocked host/tool/setup is honest evidence. It cannot be converted into a pass by an agent assertion or by the
  automated gates from Packet 09.

## Expected Files Or Components

- `docs/specs/current-branch-security-remediation/tasks/todo.md`
- `docs/specs/current-branch-security-remediation/tasks/handoff.md`
- Local ignored current-`HEAD` build/package outputs produced by existing scripts
- One local ignored synthetic diagnostics report per successfully exercised archive host

No production source, test, dependency, workflow, public documentation, generated archive fixture, screenshot, raw
manual log, or private report is committed by this packet. The handoff is the sole repository evidence summary.

## Acceptance Criteria

- All six manual acceptance IDs have an explicit Linux/Windows result at the scope required above; no required native
  result is inferred from another host.
- Linux uses a benign synthetic tar.gz and Windows uses a benign synthetic ZIP. Both positive paths use bounded,
  selective, read-only member access with no bulk extraction.
- Windows refuses the deliberate unexpected-member copy before content analysis and writes no report from it.
- Linux report save/collision/separately authorized replacement and Windows current-user/collision/replacement/
  locked-file behaviors are exercised. Unsupported filesystem guarantees remain named residual risks.
- Current-`HEAD` packaged Linux and Windows builds settle a never-responding Prettify endpoint to localized not
  connected without indefinite startup.
- The real Settings-driven Translation reset retains readiness updates without an application restart and without
  live/private provider state.
- Keyboard/focus and native assistive-technology checks announce one localized status/reason without duplicate text
  or adjacent layout movement.
- Native dependency and packaged-runtime evidence covers both supported packaged platforms, distinguishes evidence
  tiers, keeps the known advisory explicit, and finds no new blocking advisory.
- Evidence contains no credentials, account/session data, private archive content, provider body/response, endpoint,
  username, home path, raw operating-system error, or full local report path.

## Verification

After the native exercises, rerun the non-interactive contract checks on the coordinating checkout:

```bash
rtk proxy node --import tsx --test \
  tests/skills/analyzeDiagnosticsArchive.test.ts \
  tests/main/prettifyProviders.test.ts \
  tests/main/prettifyConnectionCheckCoordinator.test.ts \
  tests/main/translationRuntimeLifecycle.test.ts \
  tests/renderer/providerStatusIndicator.test.ts \
  tests/renderer/statusPresentation.test.ts \
  tests/scripts/diagnosticsArchiveDependencyPolicy.test.ts \
  tests/scripts/productionAdvisoryPolicy.test.ts \
  tests/scripts/packagedRuntimePolicy.test.ts
rtk git diff --check
```

For each manual gate, `handoff.md` must record:

- acceptance ID and `passed` or `blocked`;
- full tested Git commit;
- native OS/version and architecture;
- packaged-build command and confirmation it completed after checkout of that commit;
- exact tool/accessibility technology and version where applicable;
- concise actions and observed result;
- safeguards actually verified;
- properties explicitly unverified or non-applicable; and
- a sanitized blocker when not passed.

Do not paste command logs. A manual note without the commit, native platform, actual tool, actions, and observed result
is not acceptance evidence.

## Failure And Rollback

- Any unpassed required Linux or Windows gate leaves Packet 10 incomplete and blocks Packet 11. Name the missing host,
  tool capability, packaged artifact, accessibility setup, or synthetic setup in the handoff.
- Do not weaken the skill procedure, substitute live/private data, enable a renderer privilege, or install a tool to
  obtain a pass.
- A finding in packaged behavior returns to the owning implementation packet and invalidates Packet 09 plus affected
  manual results after the fix.
- Manual testing does not mutate production application data. Remove only exact synthetic profiles, fixtures,
  reports, and ignored package outputs that the gate created when their ownership is certain and removal is
  authorized; otherwise leave them isolated and disclose the residual locally. Never delete real user data.
- Rollback of this packet removes only its checklist/handoff evidence. It does not revert application remediation or
  reinterpret a failed/blocked gate as success.

## Manual Gates

This packet is entirely manual-gate work:

- `AC-MAN-001`: native Linux benign tar.gz analysis and report procedure;
- `AC-MAN-002`: native Windows benign ZIP analysis, unexpected-member refusal, and report-filesystem procedure;
- `AC-MAN-003`: current-`HEAD` packaged Linux and Windows Prettify timeout/readiness;
- `AC-MAN-004`: real desktop CloakBrowser-settings reset and Translation listener continuity with synthetic state;
- `AC-MAN-005`: native keyboard/focus/screen-reader and no-layout-movement smoke;
- `AC-MAN-006`: native Linux and Windows dependency and packaged-runtime inspection.

Missing native access is recorded as `blocked`, never `passed`. The specification's merge gate requires all six gates
to pass unless the user explicitly revises the approved specification; an agent cannot waive them.

## References

- Active manual-platform decision: `acceptance.platform-ci` revision 2 in
  [decisions.yaml](../decisions.yaml).
- Accepted analysis/tool boundary: `architecture.archive-analysis-engine` revision 1.
- Accepted local-report boundary: `security.report-publication` revision 3.
- Specification anchors:
  [Required Manual Platform Gates](../spec.md#required-manual-platform-gates),
  [Agent-Managed Analysis Compatibility](../spec.md#agent-managed-analysis-compatibility),
  [Temporary Data and Local Report](../spec.md#temporary-data-and-local-report),
  [Provider Readiness and Connection State](../spec.md#provider-readiness-and-connection-state), and
  [Dependency and Advisory Policy](../spec.md#dependency-and-advisory-policy).
- Mandatory project guidance:
  [Desktop, Browser, And Packaging](../../../agent-guides/project-conventions.md#desktop-browser-and-packaging) and
  [Tests And Documentation](../../../agent-guides/project-conventions.md#tests-and-documentation).

## Completion And Handoff

Only after every required manual gate passes:

1. mark only Packet 10 complete in [todo.md](todo.md);
2. update [handoff.md](handoff.md) with the concise evidence fields defined above, confirmation that Linux and
   Windows exercised the same full current-`HEAD` commit, and Packet 11 as the exact next packet;
3. explicitly retain the agent/tool/report limitations and known advisory as residual risks rather than claiming
   those properties were proved;
4. leave the checklist/handoff changes unstaged and uncommitted for review;
5. stop without starting the final review, committing, pushing, or publishing.

If any gate is blocked, leave Packet 10 unchecked, update the handoff with the exact sanitized blocker, and stop.
