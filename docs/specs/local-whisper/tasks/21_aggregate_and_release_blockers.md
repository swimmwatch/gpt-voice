# Task 21: Aggregate Qualification And Release Blockers

## Outcome

Validate deterministic acceptance ownership, reconcile the immutable Linux and
Windows evidence slices without rerunning expensive profiles, execute the
remaining platform-independent claim and policy gates, and produce one
privacy-safe final qualification/release-blocker report. Preserve missing
external evidence as `Pending` and perform no publication or release action.

## Prerequisites

- Specification revision 7 and plan revision 13 are approved.
- Tasks 19 and 20 are complete and identify the same frozen candidate, profile
  set, evidence schemas, and Task 17 fixture digest.
- Linux and Windows evidence indexes are immutable, schema-valid, privacy-safe,
  and available by digest. Raw private evidence remains in its approved private
  location.
- Task 21 has separate execution authorization. Completion of platform packets
  does not authorize aggregation, claim changes, publication, or release.

## Owned Requirements

- Aggregate and platform-independent slices of `OUT-001`, `BASE-001`,
  `ARCH-001`, `ARCH-009`, `COMP-001`–`COMP-004`, `CAP-001`, `CAP-011`,
  `LIFE-005`, `PRIV-001`–`PRIV-004`, `DIAG-001`–`DIAG-003`, and `DOC-001`.
- Primary automated acceptance: `AC-AUTO-002`, `AC-AUTO-023`, `AC-AUTO-032`,
  and `AC-AUTO-040`.
- Deterministic reconciliation of all primary owners in `AC-AUTO-001`–
  `AC-AUTO-054` and `AC-AUTO-056`–`AC-AUTO-063`.
- Aggregate/manual reconciliation of `AC-MAN-001`–`AC-MAN-013`, including AMD
  claim review, macOS unavailable validation, external approvals, and
  cross-platform previous-binary status.
- Final privacy-safe result manifest and release-blocker report.

## In Scope

- Validate that every canonical deterministic acceptance ID has exactly one
  primary owner and one or more exact registered verification commands.
- Run the platform-independent deterministic aggregate suite and reconcile its
  results with immutable Task 19 and Task 20 evidence.
- Verify candidate/profile/result/evidence schemas, Task 17 fixture equality,
  hashes, links, units, bounds, evidence classes, privacy allowlists, and valid
  Pass/Fail/Pending/Not Applicable transitions.
- Perform AMD Preview claim review, macOS Planned/unavailable policy checks,
  documentation/support-matrix review, external license/provenance/signing/
  origin/redistribution review, and aggregate downgrade reconciliation.
- Produce one evidence-linked report distinguishing implementation completion,
  platform qualification, hardware claims, external blockers, and separately
  unauthorized publication/release.
- Update `todo.md` and `handoff.md` with final status and any exact owner packet
  to revisit through newly authorized work.

## Out Of Scope

- Rerunning Linux or Windows accuracy, performance, memory, repetition, crash,
  unload, offline, installer, native, or hardware qualification profiles when
  their frozen candidate/profile/evidence digests are unchanged.
- Using aggregate checks to replace missing real-platform, real-hardware,
  previous-binary, privacy, signing, origin, license, or redistribution
  evidence.
- Patching failed owner packets, changing qualification thresholds, generating
  a new candidate, or merging results from different candidates.
- Physical AMD promotion, executable macOS inference, publication, signing,
  tag, upload, push, pull request, release, or automatic support claim changes.

## Task Contract

### Ownership and deterministic aggregate

The machine-readable registry must contain Tasks 01–21, plan revision 13, every
canonical automated acceptance ID exactly once, and at least one exact
verification command per task. Tasks 19 and 20 own platform evidence; Task 21
owns the four aggregate/cross-platform primary assertions.

Run deterministic checks for settings persistence, multi-instance artifact and
filesystem behavior, complete quality/security/package validation, process-tree
cleanup, candidate/profile/result schemas, evidence consistency, fixture
identity, migration, privacy, diagnostics, UI/accessibility, AMD/macOS claims,
and release-collection guards. Reuse evidence indexes for expensive platform
profiles; rerun them only after an explicit new candidate/profile authorization.

### Evidence reconciliation

Reject aggregation when Linux and Windows differ on candidate digest, Task 17
fixture digest, profile-set digest, schema version, runtime/model/source-lock
identity, or immutable evidence roots. Reject missing owner links, unknown
statuses, impossible transitions, private fields, unsupported evidence classes,
Pass without required evidence, or Not Applicable used to hide a required row.

For every acceptance owner, manual gate, Production support-matrix cell,
platform, and external prerequisite, record one status, stable reason, evidence
class, and frozen digest. Missing external evidence remains `Pending`; an
implementation-complete task is not automatically qualification-complete.

### AMD and macOS boundaries

Perform `AC-MAN-009` without requiring AMD hardware. Exact Vulkan/HIP
manifests, failure matrices, UI, and documentation must say
`Preview · Untested`; unlisted engine/backend rows are absent; source/build/mock
results cannot claim hardware success or Production. Physical `AC-MAN-010`
promotion may remain Not Run without blocking the approved Preview label.

Validate macOS arm64 build/package policy, settings UI, IPC/provider contracts,
and adapter fixtures show `Planned · Unavailable in this release` and expose no
runtime/model download, helper/worker spawn, load, Ready, transcription, or CPU
exception. `AC-MAN-011` physical Apple review may remain future evidence and is
never inference qualification.

### External approvals and downgrade reconciliation

Reconcile Task 19 and Task 20 exact immediately preceding packaged-binary
results. `AC-MAN-013` passes only when every required representative platform
passes; a missing or behaviorally different prior binary blocks rollback
support and release.

Review `AC-MAN-012` source/runtime/model licenses, SBOMs, provenance, approved
origins, signatures/keys, redistribution rights, protected production inputs,
and package signing. Missing external evidence remains `Pending`. Aggregate
qualification never uses private signing material and never publishes.

### Final report and claims

The report must make these implications explicit:

- Linux NVIDIA Production requires passing `AC-MAN-001` evidence.
- CPU Production requires `AC-MAN-002` independently per OS/profile.
- Windows NVIDIA Production requires passing `AC-MAN-003` evidence.
- AMD remains Preview until separately approved physical `AC-MAN-010` evidence.
- macOS remains Planned/unavailable in this release.
- Catalog publication remains blocked until `AC-MAN-012` and every origin,
  signature, license, SBOM, and protected-input gate passes.
- Rollback support and release remain blocked until `AC-MAN-013` passes on all
  required representative platforms.

A clean implementation report may retain external blockers as Pending. Task 21
must not publish, sign, tag, upload, push, create/update a PR, or release.

## Contracts And Boundaries

- One frozen candidate, profile set, schema set, and Task 17 fixture digest bind
  all evidence from Tasks 19–21.
- Task 21 consumes platform evidence by digest and never silently regenerates or
  rewrites it.
- Automated, platform, hardware, human, and external evidence classes are
  distinct and non-substitutable.
- Each deterministic acceptance ID has exactly one primary task owner; aggregate
  reconciliation preserves rather than erases owner failures.
- Raw private evidence never enters repository files, chat, logs, or the final
  report.
- Support and release authority are separate from task completion.

## Expected Files Or Components

- Updated `acceptance-owners.json`, adjacent schema, and task-plan validator for
  plan revision 13 and Tasks 01–21.
- Aggregate result schema/validator and privacy-safe qualification/
  release-blocker report template under `docs/specs/local-whisper/qualification/`.
- Deterministic reconciliation, AMD-claims, macOS-unavailable, external-gate,
  downgrade-aggregate, and release-collection validators under
  `scripts/local-whisper/`.
- `package.json` commands required by Verification.
- Final `todo.md` and `handoff.md` state with exact remaining blockers.

## Acceptance Criteria

- The ownership registry contains all 62 canonical automated acceptance IDs
  exactly once, Tasks 01–21 exactly once, and exact commands present in their
  owning packet Verification sections.
- Linux and Windows evidence validate against one candidate/profile/schema/
  fixture identity; any mismatch fails aggregation.
- `AC-AUTO-002`, `AC-AUTO-023`, `AC-AUTO-032`, and `AC-AUTO-040` pass only from
  their complete deterministic and applicable cross-platform evidence.
- No expensive Linux or Windows profile reruns when immutable digests match.
- AMD remains Preview/untested and macOS remains Planned/unavailable unless a
  future approved specification and evidence explicitly change them.
- Downgrade status is reconciled per required platform; external signing,
  origin, license, redistribution, and publication blockers remain truthful.
- The final report contains only privacy-safe evidence links/digests and clearly
  separates implementation, qualification, claims, external gates, and release
  authority.
- No commit, push, PR, signing, tag, upload, publication, or release occurs.

## Verification

Run the platform-independent aggregate commands after Tasks 19 and 20:

```bash
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run test:local-whisper:qualification
rtk npm run verify:local-whisper:qualification:inputs
rtk npm run verify:local-whisper:amd-claims
rtk npm run verify:local-whisper:macos-unavailable
rtk npm run verify:local-whisper:downgrade
rtk npm run verify:local-whisper:all
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
```

The registered Task 21 commands are:

```bash
rtk npm run test:local-whisper:qualification
rtk npm run verify:local-whisper:all
```

`verify:local-whisper:all` validates evidence by digest and must not rerun
expensive platform/hardware profiles unless separately authorized after a
candidate/profile change. Missing external evidence yields `Pending` and a
nonzero qualification-complete result, never a fabricated Pass.

## Failure And Rollback

- Preserve both platform evidence indexes and the candidate identity. Aggregate
  output may be regenerated only from the same immutable inputs.
- On a candidate/profile/schema/fixture mismatch, stop and return to Task 19 for
  a newly authorized freeze; never rewrite evidence to match.
- On an owner-packet defect, name the exact primary owner and require new
  authorization; Task 21 does not patch around the failure.
- Missing external/hardware/platform evidence remains `Pending`. Privacy,
  evidence-integrity, cleanup, or trust failures are blocking `Fail` results.
- Clean only exact task-owned temporary output; do not delete platform evidence
  or user data.

## Manual Gates

- Reconcile `AC-MAN-001`–`AC-MAN-008` from Tasks 19 and 20.
- Execute `AC-MAN-009` AMD claim review; retain future physical
  `AC-MAN-010` as Not Run when hardware is unavailable.
- Validate the macOS planned-unavailable boundary; future physical
  `AC-MAN-011` is not inference evidence.
- Record `AC-MAN-012` external signing/license/origin/redistribution gates and
  `AC-MAN-013` exact previous-binary status per platform.
- Commit, push, PR, production signing, tag, upload, publication, support-claim
  promotion, and release remain separately unauthorized.

## References

- `../spec.md`: all normative sections, Sections 19.2, 20, 21, and 22, and all
  automated/manual acceptance rows.
- Tasks 01–20, especially immutable platform handoffs from Tasks 19 and 20.
- Acceptance ownership registry/schema and qualification evidence schemas.
- Project privacy, packaging, diagnostics, claims, and release conventions.

## Completion And Handoff

Update `todo.md` and `handoff.md` with the final candidate/evidence digests,
per-platform and aggregate Pass/Fail/Pending/Not Applicable summaries, exact
release blockers, and any primary owner requiring new work. Mark Task 21
complete when reconciliation and reporting are truthful and schema-valid, even
if external release blockers remain Pending. Stop before commit, push, PR,
signing, tag, upload, publication, claim promotion, or release unless each
action receives separate explicit authorization.
