# 15 Locked-Source Advisory Monitoring

## Outcome

A credential-free scheduled workflow maps the exact locked Whisper.cpp, nlohmann-json, and GoogleTest revisions to named public advisory evidence, fails closed on affected or ambiguous results, and enforces the seven-day qualification freshness contract without affecting unrelated pull requests.

## Prerequisites

- Packets 09–11 are complete so immutable scheduled workflows, repository security policy, native source manifests, and reporting conventions are available.
- This packet has separate execution authorization and no other packet is in progress.
- The three existing lock records and their schemas are present and unchanged.

## Owned Requirements

- Primary: ADV-001, ADV-002, ADV-003.
- Cross-cutting: SEC-003, SEC-004, OPS-002, OPS-003, TST-003, TST-007.
- Acceptance: AC-AUT-026, AC-AUT-027 (advisory-report portion).

## In Scope

- A read-only advisory mapping/scanner core, normalized schema, safe fixtures, weekly workflow, freshness validator, and bounded reporting.
- Affected, unaffected, ambiguous, malformed, unavailable-source, stale-evidence, and live locked-revision cases.

## Out Of Scope

- Updating locks, downloading replacement source, opening issues/PRs, adding credentials/services/dependencies, publishing artifacts, failing unrelated PRs, or performing qualification.

## Task Contract

1. Parse the exact three lock records and map each version/commit to one or more named public advisory sources plus corresponding upstream security/release metadata.
2. Record lock ID, exact revision, source identity, advisory ID, mapping basis, scan time, normalized status, and bounded provenance. A range match without exact mapping is unresolved.
3. Add deterministic fixture tests for safe, affected, unaffected, ambiguous, malformed, unavailable, stale, and clock/provenance failure cases.
4. Schedule the read-only scan at least weekly. Keep pull-request checks independent of live services.
5. Enforce qualification-time freshness: evidence must be successful and no older than seven days at qualification start; a retry/new run needs fresh evidence. A temporary source outage may reuse only the last complete still-fresh result when no newer result reports a match or ambiguity.
6. Fail the advisory workflow/qualification evidence on confirmed, unresolved, malformed, unavailable-fresh, stale, or provenance-ambiguous results. Do not mutate repository or contact external parties.
7. Bound and sanitize output; never expose absolute paths, environment dumps, credentials, source archives, or private data.

## Contracts And Boundaries

- The scanner uses public read-only data and existing checkout authority only.
- Normalized fixtures are synthetic. Live availability is not a prerequisite for deterministic unit tests.
- Advisory remediation requires a separate approved specification revision when it changes a lock.

## Expected Files Or Components

- A focused advisory core/CLI/schema under `scripts/local-whisper/source-import/` or `scripts/local-whisper/native-build/`.
- Tests and synthetic advisory fixtures under `tests/runtime/localWhisper/nativeSources/`.
- A dedicated scheduled workflow under `.github/workflows/`, `package.json`, and workflow-policy tests.
- Existing files under `runtime/local-whisper/sources/locks/` as read-only inputs.

## Acceptance Criteria

- AC-AUT-026 passes all deterministic fixtures and maps each live lock exactly when public sources are available.
- Weekly cadence, seven-day freshness, last-good outage handling, and pull-request independence are enforced by tests.
- The workflow requires no new credential and performs no update, download replacement, issue/PR, publication, or source upload action.
- AC-AUT-027 confirms all retained reports are bounded and non-sensitive.

## Verification

Run locally with fixtures and read-only live access when available:

```text
npm run test:local-whisper:native-advisory
npm run verify:local-whisper:native-advisory -- --locks=all
npm run validate:workflows
```

If public sources are temporarily unavailable, fixture tests may complete the packet implementation, but record live evidence as unavailable; qualification remains blocked after freshness expiry.

## Remote Completion Gate

1. Before the candidate or any fix commit, run every applicable local check. Leave Packet 15 unchecked, update `handoff.md`, stage only packet-owned paths, commit conventionally, and push without force; do not manually dispatch the scheduled workflow.
2. Confirm CI launched for the exact candidate SHA. Require all selected checks to succeed, including Quality Gates, workflow/repository security policy, fixture/package jobs, deterministic advisory fixtures, and both selected native runner jobs.
3. Windows Server 2025 must execute and pass its complete selected native surface with no required skip. Live advisory-service availability remains outside pull-request reproducibility and is governed by the separate freshness contract.
4. Fix packet-caused failures with focused synthetic regressions, rerun all applicable local checks before committing, push, and repeat the exact-SHA gate. Record unrelated/out-of-scope failures as blockers.
5. After the candidate SHA passes, check Packet 15 and update `handoff.md`. Push a documentation-only completion commit and confirm CI launch without waiting for that documentation-only run.

## Failure And Rollback

- Treat ambiguous mapping or malformed evidence as unavailable, never safe.
- Do not change a lock or dependency in this packet. A confirmed advisory stops qualification and requires separately approved remediation.
- Roll back scanner, schema, fixtures, package commands, and scheduled workflow together.

## Manual Gates

- Live public reads are allowed only through the read-only scanner and may be unavailable. The packet's non-force PR-head pushes are required; credentials, manual workflow dispatch, other external writes, and publication remain unauthorized.
- This packet does not qualify a candidate.

## References

- Specification Sections 10.7, 11, and 12; AC-AUT-026 and AC-AUT-027.

## Completion And Handoff

- Record sources, exact lock mappings, fixture results, live status/freshness, workflow cadence, exact candidate/completion commits, and successful Linux/Windows CI jobs in `handoff.md`.
- Check Packet 15 only after deterministic implementation checks and the code-bearing exact-SHA remote gate pass with no required Windows skip; stale or unavailable live evidence remains an explicit qualification blocker, not a PR failure.
- Set the exact next packet to Packet 16 and stop.
