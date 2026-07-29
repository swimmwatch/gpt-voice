# 11 Complete Final Review And Merge Evidence

## Outcome

A new evidence-based code, security, standards, compatibility, and cross-platform review covers the complete branch
range at one recorded current `HEAD`, reconciles every original finding and acceptance gate, cites exact user decision
revisions for every retained blocking/important residual risk, and gives an honest merge-ready or not-merge-ready
verdict without changing application behavior. The packaged-runtime verifier uses a fresh artifact from that exact
review `HEAD`; earlier native evidence remains admissible only across the reviewed task-state-only commit boundary
defined below.

## Prerequisites

- Packets 01 through 10 are complete, reviewed, and committed.
- Packet 09 passed every automated gate, production build, advisory check, and current-`HEAD` packaged-runtime check.
- Packet 10 passed all six required native manual gates on Linux and Windows. A blocked or simulated manual gate does
  not satisfy this prerequisite.
- The commit recorded by Packet 10 and the current `HEAD` differ, if at all, only by the reviewed Packet 10 completion
  update to `tasks/todo.md` and `tasks/handoff.md`. Any application, test, dependency, workflow, packaging, skill,
  public-documentation, or task-contract change after native evidence requires the affected native gates to be rerun
  before review.
- The original review report remains immutable historical evidence:
  `docs/reviews/2026-07-28-current-branch-code-security-review.md`.
- Use `code-review-and-quality` as the primary execution skill and `security-and-hardening` as the supporting skill.
  Both reviews are read-only; any required fix returns to an implementation packet.

## Owned Requirements

- `OUT-001`, `OUT-002`
- `SCOPE-001`
- `ARCH-001`, `ARCH-002`, `ARCH-003`, `ARCH-007`
- `COMP-005`
- `AC-AUTO-019`, `AC-AUTO-020`
- The complete specification Merge Gate

## In Scope

- Re-review of the entire branch diff from its recorded tracked-branch merge base through the final remediation
  `HEAD`, not only the newest remediation commits.
- Reconciliation of every blocking, important, and optional item in the original review.
- Verification of every automated acceptance ID and every native manual acceptance ID.
- Security review of archive production, agent-managed analysis/report handling, Electron/IPC boundaries, readiness,
  browser/settings reset, provider status, dependency closure, packaged runtime, workflows, and documentation.
- Standards review for strict TypeScript, class-owned business state and DI, functional renderer/UI code, named
  constants, repository boundaries, privacy, tests, documentation, packaging, and cross-platform claims.
- Creation of one new dated Markdown final-review report and concise completion state in the handoff.

## Out Of Scope

- Editing or deleting the original review, historical task packets, superseded decision revisions, or completed
  evidence.
- Fixing findings, weakening checks, accepting a new residual risk, revising the specification, or changing
  application/test/dependency/workflow behavior.
- Live providers, credentials, accounts, private archives, private reports, audio, selected text, browser profiles,
  retained user diagnostics, or external issue/PR creation.
- Commit, push, pull request, merge, tag, installer, signing, publication, or release.
- Treating a passing unit fixture, static instruction assertion, synthetic archive, or one host's result as
  hostile-input, prompt-injection, native-other-platform, or complete dependency proof.

## Task Contract

### Review Range And Evidence Identity

1. Resolve and record:
   - the full tracked upstream commit;
   - the full merge base between `HEAD` and that tracked commit;
   - the full final review `HEAD`;
   - branch name;
   - worktree status.
2. Review the literal `<recorded-merge-base-sha>..<recorded-head-sha>` range after replacing the placeholders in
   every range command with those two recorded full hashes. Do not rely on a moving branch name in the saved report.
3. Packet 09's packaged artifact is historical gate evidence and is never reused. Packet 11 rebuilds and verifies a
   fresh native unpacked artifact from the exact review `HEAD`, but only after the read-only cache preflight in
   Verification proves CloakBrowser auto-update remains disabled and its native cached binary already exists.
   Missing cache evidence blocks packaging before `pack`; do not call `ensureBinary()` or allow a download.
4. Compare Packet 10's recorded native-gate commit with the review `HEAD` using a literal full-hash diff. Native
   evidence remains admissible without repetition only when the complete changed-path set is exactly:
   - `docs/specs/current-branch-security-remediation/tasks/todo.md`;
   - `docs/specs/current-branch-security-remediation/tasks/handoff.md`.

   This narrow exception recognizes the required reviewed completion commit and no application/package input. Any
   other path—including a task contract, review, public/security document, skill, source, test, script, dependency,
   workflow, build, or packaging file—invalidates the affected Packet 10 evidence and requires rerunning it at the
   review `HEAD`.

5. Before review, permit only the already reviewed Packet 10 checklist/handoff evidence as an unrelated worktree
   delta. Any uncommitted source, test, script, dependency, workflow, skill, security/public documentation, or
   packaging input blocks the review until it is included in the recorded review boundary and all affected gates are
   rerun.

### Review Method

6. Review every changed file and its integration boundaries. Use repository evidence, CodeGraph for indexed source,
   focused file reads for docs/configuration, exact caller/blast-radius inspection, tests, and actual command results.
   Do not infer safety from naming or test presence alone.
7. Reassess the original findings one by one:
   - archive resource amplification;
   - permanently pending startup;
   - untrusted normalized metadata;
   - Translation listener disposal/reset;
   - false diagnostics runtime compatibility;
   - unstable/special archive inputs;
   - plaintext extraction/cleanup claims;
   - local report safeguards;
   - malformed Prettify connected state;
   - stale Voice failure tooltips;
   - every optional standards/documentation/dependency item selected by `scope.remediation-depth` revision 1.
8. Check at least these trust and compatibility boundaries:
   - schema-v1 producer limits, fail-atomic export, retained-row/settings preservation, and private cleanup;
   - absence of a bundled archive parser/validator/launcher/extractor/report writer or executable analysis dependency;
   - best-effort agent provenance/tool/member/evidence/report procedure and truthful residual-risk disclosures;
   - main/preload/renderer privilege separation, trusted IPC validation, exact-key shared contracts, and unchanged
     channel/payload/result shapes;
   - one bounded Prettify deadline, response acquisition/shape limits, caller cancellation, and late suppression;
   - bounded Voice/Translation initial readiness and exactly one terminal startup state;
   - reusable Translation reset, rollback/restoration, listener retention, and resource cleanup;
   - localized, accessible, deduplicated provider status/reason presentation without adjacent layout movement;
   - target-aware locked dependency closure, native/executable classification, canonical advisory exception, and
     current-`HEAD` packaged runtime;
   - OOP/state/DI and repository ownership for business logic, functional React/UI, no free pass-through wrappers,
     no mutable module runtime container, and named domain constants;
   - Linux/Windows evidence qualifications, macOS pause, privacy documentation, and corrected historical handoff.
9. Re-run the final command set below. The saved report cites concise outcomes and test counts; it does not paste raw
   logs, environment values, local paths, provider data, archive content, or raw exceptions.

### Finding And Residual-Risk Rules

10. Use severity levels `blocking`, `important`, and `optional`. Each actionable finding includes:

- a concise impact statement;
- concrete file/line or artifact evidence;
- affected security/compatibility/standards contract;
- required remediation or explicit blocker.

11. A blocking or important finding cannot be silently downgraded because remediation is inconvenient, a test passes,
    or an agent acknowledges it. The verdict remains not merge-ready unless it is fixed and reverified or the user has
    explicitly accepted that exact residual boundary in an answered decision revision.
12. The following are the existing exact authorities for retained risks:

    | Residual boundary                                                                                                                                                                                         | Required primary user-decision citation           | Supplemental active decision where applicable                                                                                                                                           |
    | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | Agent/tool-managed archive inspection lacks deterministic hostile-container, authenticity, stable-file, parser-resource, complete-schema, prompt-injection, temporary-data, and cross-platform guarantees | `architecture.archive-analysis-engine` revision 1 | `security.archive-boundary` revision 2; `security.archive-resource-envelope` revision 2; `security.temporary-data-strategy` revision 2; `security.untrusted-metadata-policy` revision 2 |
    | Agent-written local report uses procedural filesystem, permission, collision, replacement, formatting, redaction, cleanup, and Windows safeguards rather than an owned safe writer                        | `security.report-publication` revision 3          | `security.report-existing-target` revision 2                                                                                                                                            |
    | Native Linux/Windows evidence remains manual instead of mandatory platform CI                                                                                                                             | `acceptance.platform-ci` revision 2               | None; this decision does **not** waive or pass a blocked `AC-MAN-*` gate                                                                                                                |
    | Existing `tar@7.5.19` advisory through `cloakbrowser@0.4.12` remains a tracked exception                                                                                                                  | `security.production-advisory` revision 1         | The canonical `SECURITY.md` row and current locked/audit evidence must still match                                                                                                      |

13. The two primary citations required by the Merge Gate are
    `architecture.archive-analysis-engine` revision 1 and, for every local-report risk,
    `security.report-publication` revision 3. A supplemental decision cannot replace either primary citation.
14. The known advisory authority applies only to the exact locked path/version/advisory and recheck conditions. It
    cannot accept a changed path, new advisory, increased severity, or newly blocking audit result.
15. Any retained blocking/important risk not fully covered by the exact answered revisions above requires a new
    explicit user decision through the specification workflow before merge. Do not invent a revision, cite a
    superseded answer, broaden an answer by analogy, or treat agent-authored text as approval.

### Final Report And Verdict

16. Create one new report at
    `docs/reviews/<execution-date>-current-branch-security-remediation-review.md`. If that exact date/name already
    exists, choose a distinct descriptive suffix; never overwrite either the original review or another report.
17. The final report contains:
    - review scope with literal merge-base and `HEAD` hashes;
    - executive verdict;
    - finding table ordered by severity;
    - reconciliation table for all original review items;
    - security/trust-boundary assessment;
    - standards and architecture assessment;
    - automated evidence table for `AC-AUTO-001` through `AC-AUTO-021`;
    - native evidence table for `AC-MAN-001` through `AC-MAN-006`;
    - dependency/advisory and current-`HEAD` packaged-artifact evidence;
    - residual-risk table with exact decision ID/revision citations;
    - cross-platform gaps/qualifications;
    - final merge-gate checklist.
18. The report may say `merge-ready` only when:
    - every in-scope requirement has implementation evidence;
    - all automated acceptance criteria pass;
    - all six Linux/Windows manual gates pass;
    - no unaccepted blocking or important finding remains;
    - every retained blocking/important residual cites its exact answered user decision revision;
    - the known advisory row and locked/audit evidence match; and
    - no new blocking advisory exists.
19. If any condition fails, the report says `not merge-ready`, Packet 11 remains unchecked, and the handoff names the
    owning packet or missing decision/manual environment. Do not present “conditionally passed” as completion.

## Contracts And Boundaries

- This is a read-only review of application and operational behavior. Only the new review report, checklist, and
  handoff may change.
- Renderer privileges, main ownership, typed IPC, provider results, settings, database state, cache, clipboard,
  notifications, history, archive schema, and package targets remain unchanged.
- Security conclusions distinguish deterministic producer/code guarantees from procedural agent/tool behavior and
  native observations.
- Historical reports, completed task packets, and superseded decisions remain evidence. Static absence assertions may
  exclude those historical artifacts only where the approved specification explicitly permits that scope.
- The report contains repository evidence only. It must not include private diagnostic data, credentials, sessions,
  provider payloads, local report paths, usernames, host-specific raw errors, or machine logs.

## Expected Files Or Components

- Add one new:
  `docs/reviews/<execution-date>-current-branch-security-remediation-review.md`
- Update after either verdict:
  `docs/specs/current-branch-security-remediation/tasks/handoff.md`
- Update only after a passing verdict:
  `docs/specs/current-branch-security-remediation/tasks/todo.md`

Do not modify the original review, `spec.md`, `decisions.yaml`, any numbered packet, production/test source,
dependencies, workflows, generated bundles, or release metadata except for local ignored outputs created by the
verification commands.

## Acceptance Criteria

- The saved report reviews the complete literal merge-base-to-`HEAD` branch range and all relevant integration
  boundaries, not a selected patch subset.
- Every original blocking, important, and optional review item has a factual resolution/evidence entry.
- Every active requirement and `AC-AUTO-001..021` / `AC-MAN-001..006` has passing evidence or makes the verdict not
  merge-ready.
- All required project commands pass against the recorded review `HEAD`; the packaged verifier inspects an artifact
  freshly built from that exact `HEAD`.
- Linux and Windows evidence comes from actual native environments against Packet 10's recorded commit. The only
  allowed difference from the review `HEAD` is the exact task-state-only boundary above; no simulated or stale
  application/package evidence is accepted.
- The report names no unaccepted blocking/important finding. Any retained such risk cites the exact primary decision
  revision and all applicable supplemental revision(s).
- `GHSA-r292-9mhp-454m` remains visible and accurately attributed; no new blocking advisory exists.
- The review confirms Electron/IPC/privacy, OOP/DI/repository, functional renderer, named-constant, documentation,
  packaging, and compatibility standards.
- The original review and historical evidence remain unchanged.
- `git diff --check` passes after writing the report and task-state updates.

## Verification

Resolve the immutable review range and record the literal outputs:

```bash
rtk git branch --show-current
rtk git rev-parse @{upstream}
rtk git merge-base HEAD @{upstream}
rtk git rev-parse HEAD
rtk git status --short
```

Replace the placeholders below with the recorded full hashes:

```bash
rtk git log --oneline <recorded-merge-base-sha>..<recorded-head-sha>
rtk git diff --name-status <recorded-merge-base-sha>..<recorded-head-sha>
rtk git diff --check <recorded-merge-base-sha>..<recorded-head-sha>
rtk git diff --name-only <packet-10-native-gate-sha>..<recorded-head-sha>
```

Re-run the final project gate against the recorded review `HEAD`:

```bash
rtk proxy node --import tsx --test \
  tests/skills/analyzeDiagnosticsArchive.test.ts \
  tests/scripts/diagnosticsArchiveDependencyPolicy.test.ts \
  tests/scripts/productionAdvisoryPolicy.test.ts \
  tests/scripts/packagedRuntimePolicy.test.ts \
  tests/docs/currentBranchRemediationDocumentation.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm test
rtk npm run validate:dependabot
rtk npm run verify:diagnostics-dependencies
rtk npm run audit:prod
rtk npm run build:prod
rtk grep \"CLOAKBROWSER_AUTO_UPDATE = 'false'\" scripts/prepare-cloakbrowser.mjs
rtk proxy node --input-type=module -e \"import { access } from 'node:fs/promises'; import { binaryInfo } from 'cloakbrowser'; const info = binaryInfo(); if (typeof info.binaryPath !== 'string') throw new Error('cached CloakBrowser binary unavailable'); await access(info.binaryPath);\"
rtk npm run pack
rtk npm run verify:packaged
rtk git diff --check
```

After writing the new report and, for a passing verdict, updating task state:

```bash
rtk git diff --check
rtk git status --short
```

The final command evidence must identify the recorded `HEAD`, current native host, test count, known advisory result,
build warnings, and confirmation that the unpacked artifact was rebuilt after recording that `HEAD`. Do not paste
logs or machine-private values.

## Failure And Rollback

- A new blocking/important finding, failed command, stale artifact, missing acceptance record, advisory mismatch, or
  changed review `HEAD` prevents completion.
- Route a code-owned failure to the numbered packet that owns the affected contract. After a fix, rerun that packet,
  Packet 09, every affected native gate in Packet 10, and this review against the new `HEAD`.
- Route a newly proposed residual-risk acceptance to the specification workflow. Packet 11 remains blocked until an
  explicit answered user-decision revision exists; an agent cannot approve it.
- Do not suppress warnings, rewrite historical evidence, edit tests to match broken behavior, or weaken a policy to
  obtain a merge-ready verdict.
- This packet's repository rollback deletes only the newly added final-review report and reverts its checklist/
  handoff edits. Generated ignored build/package outputs may be removed only by exact known safe cleanup. Application
  remediation has no rollback in this review packet.
- A not-merge-ready report may be retained as evidence, but Packet 11 stays unchecked and the handoff must identify
  the blocker.

## Manual Gates

- Packet 11 performs no substitute manual gate. It validates the complete Packet 10 evidence against its recorded
  native-gate commit and enforces the exact task-state-only diff rule to the review `HEAD`.
- If any native result is missing, blocked, simulated, executed on a different commit, or lacks the required
  host/tool/action/observation evidence, return to Packet 10.
- Native Linux and Windows requirements cannot be waived by source inspection, mocked `process.platform`, WSL/Wine,
  unit tests, CI on one platform, or an agent assertion. Only an explicit revision of the approved specification can
  change the required manual gates.

## References

- Mandatory review guidance at execution:
  [code-review-and-quality](../../../../.agents/skills/code-review-and-quality/SKILL.md) and
  [security-and-hardening](../../../../.agents/skills/security-and-hardening/SKILL.md).
- Mandatory project guidance:
  [Project And Commands](../../../agent-guides/project-conventions.md#project-and-commands),
  [Dependency Injection And Runtime Ownership](../../../agent-guides/project-conventions.md#dependency-injection-and-runtime-ownership),
  [Desktop, Browser, And Packaging](../../../agent-guides/project-conventions.md#desktop-browser-and-packaging), and
  [Git And Releases](../../../agent-guides/project-conventions.md#git-and-releases).
- Specification anchors:
  [Objective](../spec.md#objective),
  [Acceptance Criteria](../spec.md#acceptance-criteria),
  [Required Manual Platform Gates](../spec.md#required-manual-platform-gates), and
  [Merge Gate](../spec.md#merge-gate).
- Decision ledger:
  [decisions.yaml](../decisions.yaml), especially the exact active revisions listed in the residual-risk table above.
- Historical baseline:
  [2026-07-28 current branch code/security review](../../../reviews/2026-07-28-current-branch-code-security-review.md).

## Completion And Handoff

Only after the new report reaches a factual merge-ready verdict:

1. mark only Packet 11 complete in [todo.md](todo.md);
2. update [handoff.md](handoff.md) with the report path, literal merge-base and review `HEAD`, concise automated/native
   results, known-advisory status, exact retained-risk decision citations, and `none` as the next packet;
3. state that the remediation workstream is complete but that no commit, push, pull request, merge, package
   publication, or release occurred;
4. leave the report/checklist/handoff changes unstaged and uncommitted for review;
5. stop.

If the verdict is not merge-ready, leave Packet 11 unchecked, record the exact owning packet, missing native gate, or
required new user decision in the handoff, and stop without changing code.
