# Task 22: Aggregate Production Readiness And Release Delivery

Status: **Superseded by approved plan revision 31. Do not execute this packet.**
Its alpha deployment contract is owned by Task 33 and its final deployment
contract is owned by Task 35.

## Outcome

Reconcile the exact Task 30 release preparation and Task 28 signed candidate set
with immutable Task 29 Linux and Task 21 Windows branches, seal
`aggregateEvidenceDigest`, produce the required pre-merge release-PR status,
verify the separately authorized preserving merge, and—only after separate tag,
upload, and publication authorization—tag the unchanged qualified head, stage,
verify, and publish its complete same-tag GitHub Release asset set.

## Prerequisites

- Specification revision 20 and plan revision 27 are approved.
- Tasks 25, 27, 31, 30, 28, 29, and 21 are complete; their toolchain, builder,
  release preparation, source, candidate, platform, result, and evidence
  identities are immutable.
- The exact `release/v2.4.0` pull request remains open, current with `main`, and
  unchanged at the Task 28 head before aggregate pre-merge readiness; the final
  `v2.4.0` tag does not exist.
- GitHub repository settings permit merge commits and disable squash/rebase
  merging repository-wide; Task 30's read-only policy check passes.
- All 89 automated acceptance IDs have one registered active owner; Task 26 is
  deferred with no command or owner.
- Protected reviewer, signing, legal, redistribution, provenance, SBOM, notice,
  and publication evidence is authentic or recorded as a precise blocker.
- Release-PR merge, tag creation, upload, and publication remain separate manual
  gates not implied by packet or plan approval.

## Owned Requirements

- Aggregate `REL-001`–`REL-002`, `CI-004`, `CI-007`–`CI-008`, `DIST-001`–`DIST-004`,
  `PKG-011`–`PKG-012`, `SEC-014`, `COMP-012`–`COMP-013`, `QUAL-001`–`QUAL-006`,
  and `OPS-002`–`OPS-004`.
- Primary `AC-AUTO-002`, `AC-AUTO-023`, `AC-AUTO-032`, `AC-AUTO-040`,
  `AC-AUTO-071`, `AC-AUTO-082`, and `AC-AUTO-090`; aggregate support for
  `AC-AUTO-080`, Task 30-primary `AC-AUTO-085`, and `AC-AUTO-086`–`AC-AUTO-089`.
- Reconciliation of `AC-MAN-001`–`AC-MAN-019`, with `AC-MAN-019` executed only
  under explicit release authorization.

## In Scope

- Validate the Task 30 preparation/version/manual-registry manifest, exact
  release PR head/base/branch, shared candidate, signed release manifest,
  complete six-output candidate set, Linux/Windows platform inputs, profiles,
  graphs, results, evidence indexes, predecessor results, and acceptance
  ownership.
- Seal an acyclic aggregate root without regenerating either platform branch.
- Publish a required privacy-safe aggregate pre-merge status bound to the exact
  release PR head and base. Recheck the live PR, tag absence, repository merge
  settings, and every external approval immediately before allowing the manual
  merge gate.
- After separately authorized merge-commit mode is used, verify that the exact
  qualified head is unchanged and reachable from `main`, the recorded base is
  an ancestor of the merge result, and no squash/rebase/replacement occurred.
- Under separate tag authorization, create `v2.4.0` on the exact qualified PR
  head only after the ancestry proof passes; reject an existing, moved, wrong,
  premature, merge-commit, or cross-generation tag.
- Verify exact promotion: no rebuild, re-sign, timestamp replacement,
  repackaging, catalog regeneration, metadata mutation, missing/extra asset, or
  cross-tag/source substitution.
- Implement non-clobbering draft/staging, complete-set verification,
  attempt-owned cleanup/quarantine, immutable retry, previous-release rollback,
  and final privacy-safe readiness reporting.
- Under a separate authorized external phase, upload exact candidates to a
  non-installable draft release, download every object from its final GitHub
  Release asset record, verify manifest/catalog/native/artifact signatures and
  bounded install/launch behavior, then publish the approved release.
- Perform clean Linux and Windows installer/runtime setup from the published
  release and verify models still resolve only from pinned Hugging Face.

## Out Of Scope

- Rebuilding, repairing, re-signing, rerunning, or rewriting Task 28/29/21
  inputs or platform qualification.
- Publishing partial, failed, stale, unreviewed, or clobbered assets.
- Source commit/push, release-branch or PR creation/update, automatic PR merge,
  unapproved tag creation/mutation, RTX 30/40, AMD promotion, or macOS release.
- Inferring credentials, legal approval, platform passes, support labels, or
  release authorization.

## Task Contract

The aggregate root binds the Task 30 preparation/version/manual-registry digest,
exact release PR number/branch/head/base, `candidateInputDigest`, signed
release-manifest digest, the complete exact signed candidate set, and for
Linux/Windows each platform graph, result, and evidence-index digest plus
acceptance/exact-promotion/final-origin evidence. Any missing, mixed, backward,
duplicate, private, cross-source, rewritten, or post-qualification identity
blocks pre-merge readiness.

The pre-merge status is valid only while the live PR head and recorded current
`main` base remain exact, every required check/approval remains current, the
repository allows merge commits only, and the expected tag is absent. A new
commit, base update, conflict resolution, registry/script/version/changelog
change, or stale approval invalidates the status and returns to Task 30/28; it
cannot be repaired in Task 22.

Task 22 does not merge the pull request automatically. After separate merge
authorization, a maintainer uses GitHub merge-commit mode under the selected
repository-wide policy. The post-merge verifier reads `main`, the PR, and the
merge result and proves that the exact qualified head is an unchanged ancestor.
Failure blocks tagging and publication; no history, candidate, evidence, or tag
is rewritten to hide an incorrect merge.

The protected tag job has `contents: write` only for the separately approved
tag phase. It revalidates the aggregate root, ancestry, exact head, committed
`2.4.0` version, expected `v2.4.0` tag, and tag absence, then creates that tag
on the qualified head—not on the merge commit. It never moves, overwrites, or
reuses a tag. Approval to merge does not authorize tagging, and tag approval
does not authorize asset upload or publication.

PR/main and self-hosted jobs cannot call the protected tag or publish paths. The
publication job requires the reviewed release preparation/source/tag, protected environment,
complete Task 29/21 evidence, legal/signing approvals, and explicit release
authorization. It uses no `--clobber` behavior. Existing filenames or assets
fail closed unless they match the exact already-verified immutable object and
the retry contract explicitly permits reuse.

Draft/staging is not an installation origin. Before publication, download each
asset record with protected workflow authority and verify exact bytes,
signatures, manifest/catalog bindings, platform/target/app identity, and
bounded package behavior. After publication, verify public canonical URLs and
clean Linux/Windows setup. A failure keeps the release non-installable where
possible, preserves valid candidates/evidence, and never mutates a published
tag. Rollback selects a prior approved immutable release.

## Contracts And Boundaries

- Task 22 consumes all earlier work read-only and owns only aggregate/staging/
  preserving-merge verification, tag, release evidence, and policy
  implementation. Actual merge/tag/publication remain manually authorized.
- Native application/runtime installation origins are same-tag immutable
  GitHub Release assets. The six exact model objects remain the sole pinned
  Hugging Face exception.
- Secrets, private keys, raw hardware/evidence, host paths, audio, transcripts,
  and private logs never enter repository or public release assets.
- Platform Production labels remain independent; RTX 30/40 stay unavailable,
  AMD Preview/Untested, and macOS Planned/Unavailable.

## Expected Files Or Components

- Aggregate graph/result/evidence validators and privacy-safe report producer.
- Release-PR pre-merge status, repository merge-setting/ancestry verifier, and
  exact-head non-clobbering tag phase with focused policy fixtures.
- Exact candidate/release-manifest comparator, GitHub Release staging/origin
  verifier, no-clobber/retry/rollback policy, and focused failure tests.
- Protected release workflow publication phase and `package.json` commands.
- Updated acceptance registry/validator, `todo.md`, and `handoff.md`.

## Acceptance Criteria

- All 89 automated acceptance IDs and active/deferred task rules validate.
- One aggregate root seals the unchanged signed generation and both complete
  platform branches plus the exact Task 30 preparation and release PR head;
  every mutation or incomplete graph fails.
- The required pre-merge status fails for any stale head/base/check/approval,
  merge-setting mismatch, existing tag, or cross-generation input. After manual
  merge, only exact qualified-head ancestry passes; under separate authority,
  `v2.4.0` is created on that head and never on the merge commit.
- `AC-AUTO-090` proves every final GitHub asset record matches exact candidate,
  manifest, catalog, signature, applicability, and package expectations.
- Partial/cancelled/retried publication never creates an approved incomplete
  install origin or overwrites a published asset.
- With separate authorization, `AC-MAN-019` proves protected reviewer/signer/
  legal evidence and clean Linux/Windows release installation.
- Final reporting keeps platform, aggregate, and external blockers separate and
  never fabricates a Production verdict.

## Verification

```bash
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run test:local-whisper:qualification
rtk npm run test:local-whisper:release-policy
rtk npm run test:local-whisper:release-delivery
rtk npm run verify:local-whisper:release-merge
rtk npm run verify:local-whisper:release-origin
rtk npm run test:local-whisper:artifacts
rtk npm run test:local-whisper:packaging
rtk npm run verify:local-whisper:qualification:inputs
rtk npm run verify:local-whisper:all
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk git diff --check
```

Registered commands:

```bash
rtk npm run test:local-whisper:qualification
rtk npm run test:local-whisper:release-delivery
rtk npm run verify:local-whisper:release-merge
rtk npm run verify:local-whisper:release-origin
rtk npm run verify:local-whisper:all
```

## Failure And Rollback

- Preserve platform branches and truthful aggregate/release failures. Remove or
  quarantine only proven attempt-owned incomplete staging.
- Shared/platform/candidate mismatch returns to its owner and invalidates the
  aggregate attempt; never rewrite frozen evidence.
- A stale or mutated release PR returns to Task 30/28. An incorrect merge leaves
  the tag absent and the generation unreleasable; do not rewrite `main`, retag,
  or reuse its platform evidence as another source generation.
- Tag creation failure preserves the untagged qualified head for an authorized
  exact retry only when all identities still match; an existing wrong tag is a
  hard blocker and is never moved or deleted by this packet.
- Missing external authority remains a blocker. Failed origin parity blocks
  publication/support without fallback or clobbering.
- Rollback points to a prior complete approved release and never mutates assets
  under an existing tag.

## Manual Gates

- Immutable sanitized Linux/Windows evidence and authentic protected reviewer,
  signer, legal, redistribution, provenance, SBOM, notice, and release inputs.
- Separate authorization for the maintainer to merge the exact qualified
  release PR using merge-commit mode after the required pre-merge status passes.
- Separate authorization, after ancestry verification, to create the immutable
  `v2.4.0` tag on the exact qualified PR head.
- Separate explicit authorization to create/use the draft GitHub Release,
  upload assets, verify final origin, publish, change support labels, or release.
- Clean Linux and Windows release-install hosts for `AC-MAN-019`.
- Commit, push, release-branch/PR creation or update, merge, tag creation,
  publication, and release are not authorized by plan or ordinary Task 22
  implementation approval. Repository merge-setting changes remain an earlier
  Task 30 manual gate.

## References

- Specification revision 20 Sections 9.6, 12.1, 18.3–18.5, 19.1–19.3, and 22.
- Tasks 27, 31, 30, 28, 29, and 21 immutable handoffs; release/project
  conventions; signed release-manifest, preparation, and aggregate evidence
  schemas; decision `planning.release-merge-enforcement`.

## Completion And Handoff

Without merge/tag/upload/publication authority, Task 22 may finish
implementation and report those external steps as ordered blockers but cannot
claim release completion. With each separate authority, mark it complete only
after the exact qualified head is merged and verified, its immutable tag is
created, and aggregate/final-origin evidence plus `AC-MAN-019` pass. Update
`todo.md` and `handoff.md`, then stop before any unapproved commit, push,
release-PR action, merge, tag, support promotion, or release.
