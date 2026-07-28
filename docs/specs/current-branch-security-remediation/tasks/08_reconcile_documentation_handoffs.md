# 08 Reconcile Documentation And Handoffs

## Outcome

Active documentation distinguishes deterministic archive-production guarantees from best-effort agent analysis,
qualifies dependency evidence by platform, records the known advisory canonically, and reconciles the Provider
Audit handoff with repository history without starting its separate manual-verification packet.

## Prerequisites

- Packets 01–07 are complete, reviewed, and committed.
- Packet 01 owns the final producer limits.
- Packet 02 owns the instruction-only analysis and private-report residual-risk contract.
- Packet 07 owns the target-aware dependency policy and canonical advisory row.
- Provider Audit Task 23 is committed as `89e8e833 docs(diagnostics): complete integration gate`.
- Preserve historical reviews, completed packets, superseded decisions, and every unrelated worktree change.

## Owned Requirements

- `DOC-004`, `DOC-005`
- `AC-AUTO-020`

## In Scope

- Reconciliation of active archive, security, dependency, and cross-platform statements after Packets 01–07.
- Correction of the stale Provider Audit Task 23 commit boundary.
- Explicit separation of Provider Audit Task 24 from this remediation's bounded manual gates.
- Static documentation, locale-parity, and repository-history assertions.

## Out Of Scope

- Any runtime, renderer, provider, browser, archive, dependency-policy, IPC, locale-string, or packaging behavior
  change.
- Rewriting the approved specification, decisions, historical review findings, completed task packets, or
  superseded decision revisions.
- Completing, checking, executing, or authorizing Provider Audit Task 24.
- Running Packet 09's full integration gate, Packet 10's native/manual gates, or Packet 11's final re-review.
- Live providers, private archives, credentials, packaging, commits, pushes, pull requests, publication, or release.

## Task Contract

### Reconcile active archive and privacy guidance

1. Active skill, schema, public, and security documentation must use the exact Packet 01 producer ceilings:
   - `64 MiB` per member;
   - `128 MiB` total uncompressed payload;
   - `8 MiB` per JSONL line excluding its terminator;
   - `100,000` records per JSONL member;
   - `1 MiB` archive structure;
   - `130 MiB` outer archive;
   - the retained `1000:1` compression-ratio rule where applicable.
2. Describe schema-v1 ZIP/tar.gz validation as an app-owned producer contract. Agent analysis is instruction-only,
   selective, best-effort, tool-dependent, and proves neither archive authenticity nor hostile-input safety,
   complete schema validation, prompt-injection isolation, stable-file handling, resource containment, or absence
   of tool-created temporary data.
3. Preserve the private-artifact policy: the diagnostic database, archive, and report are local, unencrypted,
   best-effort-redacted artifacts that users review before sharing. Report publication remains one private local
   Markdown file under the explicit collision/replacement and capability-dependent residual-risk procedure from
   Packet 02.
4. Do not reintroduce a Python version, `python3`, Windows `py`, interpreter selector, parser, validator, extractor,
   process adapter, launcher, report writer, executable asset, or portable analysis-runtime claim into active
   guidance.

### Qualify dependency and platform evidence

5. Active dependency-policy documentation must distinguish:
   - host-independent lockfile closure for `linux-x64` and `win32-x64`;
   - host-installed artifact inspection for only the current matching target;
   - native Linux/Windows installation and packaged-runtime evidence from Packet 10.
6. Do not describe a current-host scan, filename-suffix scan, mocked `process.platform`, unit fixture, or stale
   packaged artifact as exhaustive evidence for another platform. Mach-O classifier fixtures do not imply active
   macOS packaging; macOS distribution remains paused.
7. Preserve Packet 07's exact `Known production advisory exceptions` row and recheck triggers. State that the
   `cloakbrowser@0.4.12 -> tar@7.5.19` advisory is separate from `archiver`'s creation-only closure and predates the
   reviewed six-commit range.

### Reconcile Provider Audit history and continuation

8. Update `docs/specs/provider-audit-logging/tasks/handoff.md` to state:
   - Tasks 01–23 are committed;
   - Task 23 is commit `89e8e833 docs(diagnostics): complete integration gate`;
   - Task 24 remains unchecked, unstarted, and requires separate execution authorization;
   - the current continuation is this remediation workstream, whose next packet after Packet 08 is Packet 09 only
     after its own review/commit and execution authorization.
9. Remove claims that Task 23 is unstaged/uncommitted, that the deleted inspector supplied a successful deterministic
   consumer gate, that an unidentified existing unpacked artifact proves current-HEAD packaged behavior, or that the
   old installed suffix scan proves exhaustive cross-platform dependency safety.
10. Do not mark Provider Audit Task 24 complete or absorb its broader live-provider/manual checks into remediation
    `AC-MAN-001`–`AC-MAN-006`. The two workstreams remain separate.
11. `docs/specs/provider-audit-logging/tasks/todo.md` should remain semantically unchanged when it already has Task
    23 checked and Task 24 unchecked. Modify it only if repository evidence shows that exact state is false.

### Add static proof

12. Add one focused documentation-contract test that asserts:
    - exact producer limits;
    - agent-managed/no-validator analysis language;
    - the private-report procedure and accepted tool/model/filesystem residual risks;
    - the schema-v1 producer disclaimer;
    - the three cross-platform evidence tiers;
    - the canonical advisory row and recheck triggers;
    - all eleven locale catalogs remain key- and placeholder-aligned.
13. Add a repository-history assertion that:
    - the Provider Audit handoff and todo are tracked;
    - commit `89e8e833` exists in the current repository history with the exact Task 23 subject and relevant
      Provider Audit task-state paths;
    - the active handoff no longer describes Task 23 as uncommitted;
    - Task 24 is still unchecked and the handoff names the exact separate continuation.
14. History unavailability or a shallow checkout that cannot establish the required commit is a failed/blocked
    assertion, not a skipped pass. Do not change CI history behavior in this packet without a separately identified
    repository constraint.

## Contracts And Boundaries

- `spec.md` and `decisions.yaml` remain the approved contract/history and are not edited.
- Historical reviews and completed packet text remain evidence; absence assertions are limited to active guidance
  and current task state.
- Documentation stays in English except existing locale catalogs, which receive no invented translations.
- Tests use repository paths and synthetic canaries only. They expose no machine paths, usernames, private archive
  contents, credentials, provider values, raw audit output, or operating-system errors.
- No documentation claim can upgrade a missing native/manual gate to a pass.

## Expected Files Or Components

Update where final active facts require it:

- `.agents/skills/analyze-diagnostics-archive/SKILL.md`
- `.agents/skills/analyze-diagnostics-archive/references/archive-schema.md`
- `README.md`
- `SECURITY.md`
- `docs/specs/provider-audit-logging/tasks/handoff.md`
- `docs/specs/provider-audit-logging/tasks/todo.md` only if its Task 23/24 state is incorrect

Add:

- `tests/docs/currentBranchRemediationDocumentation.test.ts`

The new test may use a small constructor-injected repository-history reader owned inside the test suite. Do not add
a production history service, shell wrapper, mutable global, or pass-through helper.

Do not update this remediation's `plan.md`, `todo.md`, or `handoff.md` during implementation until the packet's
normal completion-and-handoff step.

## Acceptance Criteria

- Every active archive limit and member/schema statement matches Packet 01 and contains no obsolete consumer limit.
- Active analysis guidance contains no bundled validator/runtime claim and explicitly states the best-effort,
  selective, tool-dependent residual risks.
- Public/security guidance preserves the private, unencrypted, best-effort-redacted handling contract.
- Dependency claims name the evidence tier and never infer Windows/Linux/macOS proof from another host, fixtures,
  suffixes, or stale packaging output.
- The canonical advisory row remains exact, visible, and separate from `archiver`.
- Provider Audit handoff records Task 23 as committed at `89e8e833`, Task 24 as unchecked/unstarted/separately
  authorized, and Packet 09 as the remediation continuation after Packet 08 review.
- Static and repository-history assertions fail on stale uncommitted wording, missing commit evidence, unchecked
  mismatch, unsupported exhaustiveness language, missing residual-risk disclosure, locale parity drift, or advisory
  row drift.
- No product/runtime source, dependency, lockfile, approved specification, or decision-ledger content changes.

## Verification

Run focused documentation and contract checks:

```bash
rtk proxy node --import tsx --test \
  tests/docs/currentBranchRemediationDocumentation.test.ts \
  tests/skills/analyzeDiagnosticsArchive.test.ts \
  tests/scripts/diagnosticsArchiveDependencyPolicy.test.ts \
  tests/scripts/productionAdvisoryPolicy.test.ts \
  tests/main/i18n.test.ts
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check
```

Confirm the packet did not change runtime, dependencies, the approved specification, or decisions:

```bash
rtk git diff --exit-code -- \
  package.json \
  package-lock.json \
  src \
  docs/specs/current-branch-security-remediation/spec.md \
  docs/specs/current-branch-security-remediation/decisions.yaml
```

Packet 09 owns the full unit, production build, dependency audit, packaged-runtime, and project-wide integration
gate.

## Failure And Rollback

- Missing history, contradictory active guidance, an unsupported cross-platform claim, stale Task 23 state, a
  changed advisory row, or locale-contract drift blocks completion.
- Do not rewrite historical evidence, check Task 24, remove a residual-risk disclosure, or weaken a static
  assertion to obtain a pass.
- Rollback is a scoped revert of active documentation, Provider Audit handoff correction, and documentation tests.
  It requires no runtime, data, settings, archive, dependency, or migration work.

## Manual Gates

None in this packet. Packet 10 owns all native/manual evidence, including Linux/Windows agent walkthroughs,
provider-readiness smoke tests, keyboard/focus/screen-reader checks, and native dependency/package inspection.
Until those gates run, documentation must label them pending or blocked and must not imply a pass.

Provider Audit Task 24 remains a separate future packet. It must not begin without its own explicit execution
authorization and is not completed by remediation manual gates.

## References

- Mandatory project guidance:
  [Tests And Documentation](../../../agent-guides/project-conventions.md#tests-and-documentation) and
  [Git And Releases](../../../agent-guides/project-conventions.md#git-and-releases).
- Specification anchors:
  [Documentation and Operational Corrections](../spec.md#documentation-and-operational-corrections),
  [Dependency and Project Verification](../spec.md#dependency-and-project-verification), and
  [Merge Gate](../spec.md#merge-gate).
- Provider Audit state:
  [handoff.md](../../provider-audit-logging/tasks/handoff.md) and
  [todo.md](../../provider-audit-logging/tasks/todo.md).
- Review evidence:
  optional improvements 3–4 in
  [Optional Improvements](../../../reviews/2026-07-28-current-branch-code-security-review.md#optional-improvements).

## Completion And Handoff

After all automated checks pass:

1. mark only Packet 08 complete in [todo.md](todo.md);
2. update [handoff.md](handoff.md) with corrected documentation, history evidence, focused check results, pending
   native/platform risks, and Packet 09 as the exact next packet;
3. leave Packet 08 unstaged and uncommitted for review;
4. stop without starting the integration gate, any native/manual gate, Provider Audit Task 24, or Packet 09.
