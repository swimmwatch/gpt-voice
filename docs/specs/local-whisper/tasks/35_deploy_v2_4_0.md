# 35 Deploy v2.4.0

## Outcome

Promote only Task 34's fresh fully qualified final generation: validate final
aggregate readiness, preserve the exact qualified head through merge, create
immutable tag `v2.4.0`, stage and final-origin verify the complete signed asset
set without clobbering, publish the stable release, perform clean Linux/Windows
deployment checks, and promote only the qualified CPU/RTX 50 support cells.

## Prerequisites

- Specification revision 21 and plan revision 29 are approved.
- Tasks 32–34 are complete. Public `v2.4.0-alpha.1` remains immutable and
  independent; Task 34's final preparation, head/base, signed six-output set,
  Linux/Windows branches, aggregate root, and manual evidence are complete and
  read-only.
- The final `release/v2.4.0` PR is open, current with `main`, unchanged at the
  qualified head, and has every required check/reviewer. Tag `v2.4.0` and its
  GitHub Release do not exist.
- Repository settings allow merge commits and disable squash/rebase merging.
- Merge, tag, GitHub Release staging/upload, publication, clean deployment, and
  support promotion remain separate manual gates.

## Owned Requirements

- Final deploy and aggregate slices of `REL-001`, `REL-002`, `REL-003`,
  `REL-004`, `CI-004`, `CI-007`, `CI-008`, `DIST-001`, `DIST-002`, `DIST-003`,
  `DIST-004`, `PKG-011`, `PKG-012`, `SEC-014`, `COMP-012`, `COMP-013`,
  `QUAL-001`, `QUAL-002`, `QUAL-003`, `QUAL-004`, `QUAL-005`, `QUAL-006`,
  `QUAL-007`, `OPS-002`, `OPS-003`, and `OPS-004`.
- Primary `AC-AUTO-002`, `AC-AUTO-023`, `AC-AUTO-032`, `AC-AUTO-040`,
  `AC-AUTO-071`, and `AC-AUTO-091`; supporting final rerun of Task 33-primary
  `AC-AUTO-087`–`AC-AUTO-090`.
- `AC-MAN-019` and the Deploy portion of `AC-MAN-021`; reconciliation of every
  applicable `AC-MAN-001`–`AC-MAN-018` result without rerunning or rewriting it.

## In Scope

- Revalidate the exact final release preparation/version/manual registry,
  release PR head/base/branch, fresh candidate input, signed final manifest,
  all six final candidate files, immutable Linux and Windows platform inputs,
  profiles, graphs, results, evidence indexes, final aggregate root, acceptance
  ownership, legal/signing/provenance approvals, and absent expected tag.
- Emit the required privacy-safe final pre-merge status and fail on any stale
  head/base/check/approval, merge-setting mismatch, tag, cross-generation
  input, missing platform edge, alpha artifact, or post-qualification delta.
- After separate merge authorization, verify merge-commit mode preserved Task
  34's exact qualified final head unchanged and reachable from `main`.
- Under separate tag authority, create `v2.4.0` on that exact qualified head,
  never on a substituted merge commit, and prove source/version/tag identity.
- Stage exactly the signed final installers, four runtime packs, manifest,
  catalogs, signatures, checksums, SBOMs, notices, and provenance in a
  recoverable non-installable GitHub Release with no clobber path.
- Download every staged object through its final GitHub Release endpoint and
  verify exact byte/signature/manifest/catalog/source/tag/platform/target/app
  identity and bounded package/install/launch behavior.
- After separate publication approval, publish `v2.4.0` as stable, perform one
  clean Linux and one clean Windows application/runtime/model deployment, and
  verify public same-tag native/runtime origin plus pinned Hugging Face model
  origin, CPU/RTX 50 compatibility/load/transcribe/unload/offline cleanup.
- Promote Linux and Windows CPU plus RTX 50 `sm_120a` support only after every
  final gate passes. Keep RTX 30/40 unavailable, AMD Preview/Untested, and
  macOS Planned/Unavailable.

## Out Of Scope

- Any source/candidate/evidence build, rebuild, repair, re-sign, retimestamp,
  repackage, catalog/manifest regeneration, or qualification rerun/rewrite.
- Mutating, retagging, republishing, or deleting `v2.4.0-alpha.1`.
- Publishing a partial/mixed/alpha candidate set, moving or reusing a tag,
  overwriting an asset, changing repository history/settings, or fabricating a
  platform/legal/signing/support result.
- RTX 30/40, AMD qualification, macOS release, or unrelated product work.

## Task Contract

Task 35 is read-only with respect to Task 34 candidates and evidence. The final
aggregate root binds exact SemVer/source/preparation, signed manifest and all
six candidates, both complete platform graph/result/index branches,
acceptance ownership, exact-promotion, and final-origin evidence. Any missing,
mixed, backward, duplicate, private, alpha-derived, rewritten, or
post-qualification identity blocks deployment.

The pre-merge status remains valid only while live final PR head/base, required
checks/reviewers, repository merge policy, and tag absence match. Merge is a
manual merge-commit action. The verifier proves the qualified head is an
unchanged ancestor reachable from `main`; an incorrect merge leaves the tag
absent and cannot be repaired by rewriting history or rebinding evidence.

The protected tag phase has write authority only for the exact approved
`v2.4.0` tag. It never moves, deletes, overwrites, or reuses a tag. Tag approval
does not authorize GitHub Release creation/upload/publication.

Staging is non-installable. Existing assets/filenames fail closed unless an
authorized retry proves exact immutable identity. No `--clobber` behavior,
publish-triggered rebuild, re-sign, timestamp substitution, or catalog
regeneration is permitted. A failed attempt preserves valid candidates and
private evidence, quarantines/removes only attempt-owned incomplete staging,
and leaves the release unpublished where possible. Rollback selects a prior
approved immutable release.

Stable publication and support promotion occur only after final-origin
verification and clean Linux/Windows deploy checks. The public alpha remains
historical prerelease evidence and never supplies a final asset or support
claim.

## Contracts And Boundaries

- Task 34 owns final bytes/evidence; Task 35 may only promote them exactly.
- Merge, tag, staging/upload, publication, clean deployment, and support
  promotion are separate authorities and audit events.
- Same-tag GitHub Release assets are the only application/native installation
  origins. The six pinned Hugging Face model objects remain the sole exception.
- Secrets, private keys, raw platform evidence, paths, device identifiers,
  audio, transcripts, prompts, and private logs never enter repository or
  public release assets.
- A stable release failure leaves alpha unchanged and `v2.4.0` absent or
  non-installable; it never weakens final qualification.

## Expected Files Or Components

- Final aggregate/pre-merge validator and privacy-safe report.
- Exact-head ancestry and protected exact-tag workflow phases.
- Non-clobbering final GitHub Release staging/retry/quarantine/rollback,
  candidate comparator, final-origin verifier, stable-state verifier, and clean
  Linux/Windows deployment checks.
- Support-label promotion guard requiring exact final platform evidence.
- Workflow policy tests, `package.json` commands, acceptance ownership,
  `todo.md`, and final `handoff.md`.

## Acceptance Criteria

- Primary `AC-AUTO-002`, `AC-AUTO-023`, `AC-AUTO-032`, `AC-AUTO-040`, and
  `AC-AUTO-071` remain covered by one final aggregate/all verification command
  over exact final inputs.
- `AC-AUTO-091` admits only
  `Build alpha → Deploy alpha → Build final → Deploy final`, proves the alpha
  public prerelease and final fresh generation, and rejects skipped, reordered,
  cross-generation, incomplete-platform, or reused-alpha states.
- Supporting `AC-AUTO-087`–`AC-AUTO-090` reruns prove exact promotion,
  non-clobbering recovery, approved origins, and final GitHub asset parity for
  the final generation.
- `AC-MAN-019` and the Deploy portion of `AC-MAN-021` prove preserving merge,
  exact immutable tag, complete final asset set, final-origin parity, stable
  publication, and clean Linux/Windows deployment against Task 34 bytes.
- Linux and Windows CPU plus RTX 50 support is promoted only after every final
  platform, aggregate, external, origin, and clean-install gate passes; other
  support boundaries remain unchanged.
- No final action mutates the public alpha or any frozen final candidate/
  platform evidence.

## Verification

Run target-aware final deployment checks before completion:

```bash
rtk npm run test:local-whisper:qualification
rtk npm run test:local-whisper:release-policy
rtk npm run test:local-whisper:release-delivery
rtk npm run test:local-whisper:release-lifecycle
rtk npm run verify:local-whisper:release-merge -- --target=v2.4.0
rtk npm run verify:local-whisper:release-origin -- --target=v2.4.0
rtk npm run verify:local-whisper:deploy -- --target=v2.4.0
rtk npm run verify:local-whisper:all
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk git diff --check
```

Registered ownership commands:

```bash
rtk npm run test:local-whisper:qualification
rtk npm run test:local-whisper:release-delivery
rtk npm run verify:local-whisper:release-merge -- --target=v2.4.0
rtk npm run verify:local-whisper:release-origin -- --target=v2.4.0
rtk npm run verify:local-whisper:all
rtk npm run verify:local-whisper:deploy -- --target=v2.4.0
```

## Failure And Rollback

- A stale/mutated final PR, incomplete/mixed evidence, wrong merge, wrong/
  existing tag, missing authority, candidate mismatch, upload collision,
  final-origin divergence, clean-install failure, or platform/support mismatch
  blocks the next action. Never rewrite, rebuild, re-sign, move/delete tags, or
  clobber assets to obtain success.
- Preserve Task 34 candidates and truthful evidence. Remove/quarantine only
  proven attempt-owned incomplete staging; never delete published alpha/final
  assets, shared caches, or user data broadly.
- Before publication, an authorized exact retry may reuse only unchanged
  verified final candidates while every approval/identity remains current.
  After publication, rollback selects a prior immutable release or a new
  version; it never mutates `v2.4.0`.

## Manual Gates

- `MANUAL GATE`: authorize merge of the exact qualified final PR using
  merge-commit mode only after the final pre-merge status passes.
- `MANUAL GATE`: after ancestry proof, authorize immutable tag `v2.4.0` on the
  exact qualified head.
- `MANUAL GATE`: separately authorize GitHub Release creation/staging, exact
  upload, final-origin verification, stable publication, clean Linux/Windows
  deployment, and support-label promotion.
- `MANUAL GATE`: authentic protected reviewers, release credentials, legal/
  signing/provenance evidence, and private clean-host evidence. Never request
  credentials through chat or commit them.
- Commit, push, PR update/merge, tag, GitHub Release action, publication,
  support promotion, and release are not authorized by plan or ordinary packet
  approval.

## References

- Mandatory: specification revision 21 Sections 9.6, 18.3–18.5, 19.1–19.3,
  `AC-MAN-019`, `AC-MAN-021`, and 22.2.
- Mandatory input: Task 34 handoff with exact final candidate/platform/
  aggregate identities and Task 33's immutable alpha deployment identity.
- Historical context only: superseded Task 22 aggregate/delivery packet.

## Completion And Handoff

Mark Task 35 complete only after exact stable publication, final-origin checks,
clean Linux/Windows deployment, and qualified support promotions pass. Update
`todo.md` and `handoff.md` with final immutable source/tag/release/asset/origin/
support identities and any residual non-release support boundaries. Stop before
any unapproved commit, push, release mutation, follow-up version, or unrelated
work.
