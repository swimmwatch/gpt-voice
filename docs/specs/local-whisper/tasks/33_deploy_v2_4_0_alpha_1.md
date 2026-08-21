# 33 Deploy v2.4.0-alpha.1

## Outcome

Promote only Task 32's exact signed and smoke-qualified alpha bytes: seal the
alpha pre-merge status, verify a separately authorized preserving merge, create
immutable tag `v2.4.0-alpha.1`, stage the complete six-output set without
clobbering, verify every final GitHub Release origin, and publish a public
GitHub prerelease. Build, rebuild, sign, re-sign, repackage, or mutate nothing.

## Prerequisites

- Specification revision 21 and plan revision 29 are approved.
- Task 32 is complete, reviewed, and immutable. Its release preparation,
  `release/v2.4.0-alpha.1` head/base, signed six-output manifest, alpha
  candidate/platform/aggregate digests, and bounded Linux/Windows smoke results
  are complete and read-only.
- The alpha release PR is open, current with `main`, unchanged at the qualified
  head, and has the required checks/reviewers. Tag `v2.4.0-alpha.1` and its
  GitHub Release do not exist.
- Repository settings allow merge commits and disable squash/rebase merging.
- Merge, tag, GitHub Release staging/upload, publication, and clean deployment
  remain separately authorized manual gates.

## Owned Requirements

- Alpha deploy slices of `CI-004`, `CI-007`, `CI-008`, `DIST-001`, `DIST-002`,
  `DIST-003`, `DIST-004`, `PKG-011`, `PKG-012`, `SEC-014`, `REL-001`,
  `REL-002`, `REL-003`, `REL-004`, `QUAL-001`, `QUAL-007`, `OPS-002`,
  `OPS-003`, and `OPS-004`.
- Primary `AC-AUTO-087`, `AC-AUTO-088`, `AC-AUTO-089`, and `AC-AUTO-090`.
- Deploy portion of `AC-MAN-020`.

## In Scope

- Revalidate the exact alpha preparation/version/manual-registry digest,
  release PR number/branch/head/base, candidate input, signed release manifest,
  six signed candidates, Linux/Windows bounded platform graphs/results/indexes,
  alpha aggregate root, acceptance ownership, external approvals, and expected
  absent tag.
- Emit the required privacy-safe pre-merge status bound to the live head/base
  and fail closed on any stale check, approval, setting, tag, or identity.
- After separate merge authorization, verify merge-commit mode preserved the
  exact qualified alpha head unchanged and reachable from `main`; do not merge
  automatically or repair history.
- Under separate tag authority, create `v2.4.0-alpha.1` on the exact qualified
  head—not a different merge commit—and prove tag/version/source identity.
- Create one recoverable non-installable GitHub Release staging area marked
  prerelease; upload exactly the six candidates plus required signed manifest,
  catalogs, signatures, checksums, SBOMs, notices, and provenance without
  `--clobber` or mutation.
- Download every staged asset through its final GitHub Release asset endpoint
  and verify exact length, digest, native/artifact/manifest signatures,
  catalog/manifest membership, source/tag/platform/target/app compatibility,
  and bounded install/launch expectations.
- After separate publication approval, publish publicly with the GitHub
  prerelease marker and perform one clean Linux and one clean Windows install,
  CPU/RTX 50 runtime acquisition, pinned Hugging Face `base/full` resolution,
  bounded load/transcribe/unload/offline-reuse/cleanup verification.

## Out Of Scope

- Any candidate creation, source change, rebuild, re-sign, retimestamp,
  repackaging, catalog/manifest regeneration, evidence rewrite, or alpha fix.
- Final `v2.4.0` branch, candidate, qualification, tag, GitHub Release,
  publication, or support promotion; Task 34 starts that work only after this
  alpha deployment is final-origin verified.
- Stable Production support claims. The alpha remains explicitly prerelease.
- Deleting/moving an existing tag, overwriting an asset, publishing partial
  staging, changing repository settings, RTX 30/40, AMD, or macOS work.

## Task Contract

Task 33 is a read-only promotion pipeline until each external action is
separately authorized. The aggregate pre-merge status is valid only while the
live alpha PR head/base, committed prerelease version/changelog/manual registry,
candidate and platform digests, repository merge policy, approvals, and tag
absence match Task 32 exactly. Any mutation returns to a new Task 32 candidate
generation; Task 33 cannot rebind old evidence.

The release PR is merged manually using merge-commit mode. The post-merge
verifier must prove the qualified head is an unchanged ancestor reachable from
`main`. Squash, rebase, conflict-resolution changes, a replacement commit, or a
stale base blocks tagging. The protected tag job receives write authority only
for its separately approved exact-tag phase and never moves, reuses, or deletes
a tag.

Staging is not an installation origin. Existing filenames or release assets
fail closed unless an explicitly authorized retry proves they are the exact
already-verified immutable objects. No `--clobber` path is allowed. A partial,
cancelled, or failed attempt remains non-installable; only attempt-owned proven
incomplete staging may be removed or quarantined. Published assets and tags are
never overwritten. Rollback selects a prior complete immutable release.

The public release is titled for `v2.4.0-alpha.1`, has GitHub prerelease state,
and preserves an explicit non-final support boundary. Application/native bytes
resolve only from its exact same-tag assets. Pinned public Hugging Face model
objects remain the sole external model-origin exception.

## Contracts And Boundaries

- Task 32 owns candidate bytes and alpha evidence; Task 33 consumes them
  without modification. Any defect returns to Task 32.
- Merge, tag, upload, publication, and clean-install authorities are distinct;
  approval of one grants none of the later actions.
- Secrets, signing keys, raw host evidence, private paths, audio, transcripts,
  prompts, and environment data never enter public assets or logs.
- A successful alpha Deploy unlocks Task 34 planning/execution only; it does
  not authorize it or provide final candidate/evidence reuse.

## Expected Files Or Components

- Aggregate/pre-merge status and exact-head ancestry validators.
- Protected exact-tag phase and tag policy fixtures.
- Non-clobbering GitHub Release staging, retry/quarantine, candidate comparator,
  final-origin downloader/verifier, prerelease-state verifier, and clean-install
  deployment checks.
- Protected release workflow phases and read-only policy tests; remove existing
  `--clobber`, publish-triggered rebuild, and partial-publication paths.
- `package.json` commands, acceptance ownership, `todo.md`, and `handoff.md`.

## Acceptance Criteria

- `AC-AUTO-087` accepts only Task 32's exact signed bytes and rejects rebuild,
  re-sign, timestamp, package, catalog, metadata, source, or evidence mutation.
- `AC-AUTO-088` proves cancellation, duplicate invocation, partial upload,
  verification failure, collision, and retry never clobber an asset or create
  an installable incomplete release.
- `AC-AUTO-089` rejects every application/native origin outside exact same-tag
  GitHub Release assets while preserving pinned Hugging Face model objects.
- `AC-AUTO-090` proves every final GitHub asset record matches the exact alpha
  candidate, manifest, catalog, signature, applicability, and package behavior.
- The qualified head is preserved through merge; tag `v2.4.0-alpha.1` points
  exactly to it; the public GitHub Release is marked prerelease and contains the
  complete verified asset set with no rebuild or clobber.
- The deploy portion of `AC-MAN-020` passes on clean Linux and Windows hosts;
  failures remain recoverable and no final Production verdict is created.

## Verification

Implement/register target-aware deploy commands before completion:

```bash
rtk npm run test:local-whisper:release-policy
rtk npm run test:local-whisper:release-delivery
rtk npm run verify:local-whisper:release-merge -- --target=v2.4.0-alpha.1
rtk npm run verify:local-whisper:release-origin -- --target=v2.4.0-alpha.1
rtk npm run verify:local-whisper:deploy -- --target=v2.4.0-alpha.1
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
rtk npm run test:local-whisper:release-policy
rtk npm run test:local-whisper:release-delivery
rtk npm run verify:local-whisper:release-merge -- --target=v2.4.0-alpha.1
rtk npm run verify:local-whisper:release-origin -- --target=v2.4.0-alpha.1
rtk npm run verify:local-whisper:deploy -- --target=v2.4.0-alpha.1
```

## Failure And Rollback

- A stale/mutated PR, incomplete evidence, wrong merge, existing/wrong tag,
  candidate mismatch, missing authority, upload collision, or final-origin
  mismatch blocks the next action. Never rewrite history, move/delete a tag,
  rebuild, re-sign, or clobber to obtain success.
- Preserve Task 32's immutable candidates and truthful failure evidence. Clean
  only exact attempt-owned incomplete staging; never delete published assets,
  shared caches, or user data broadly.
- If publication already occurred, rollback means selecting a prior approved
  immutable release or shipping a new version; it never mutates
  `v2.4.0-alpha.1`.

## Manual Gates

- `MANUAL GATE`: authorize merge of the exact qualified alpha PR using
  merge-commit mode only after the pre-merge status passes.
- `MANUAL GATE`: after ancestry proof, authorize creation of immutable tag
  `v2.4.0-alpha.1` on the exact qualified head.
- `MANUAL GATE`: separately authorize GitHub Release creation/staging, exact
  asset upload, final-origin verification, publication as prerelease, and clean
  Linux/Windows deployment checks.
- `MANUAL GATE`: authentic protected reviewers, release credentials, legal/
  signing/provenance evidence, and private clean-host evidence. Never request
  credentials through chat or commit them.
- Commit, push, PR update/merge, tag, GitHub Release action, publication, support
  promotion, and release are not authorized by plan or ordinary packet
  approval.

## References

- Mandatory: specification revision 21 Sections 9.6, 18.3–18.5, 19.1
  (`AC-AUTO-087`–`AC-AUTO-090`), `AC-MAN-020`, and 22.2.
- Mandatory input: Task 32 handoff with exact alpha identities.
- Historical context only: superseded Task 22 release-delivery contract.

## Completion And Handoff

Mark Task 33 complete only after the public prerelease, final-origin checks, and
clean Linux/Windows deploy checks pass against exact Task 32 bytes. Update
`todo.md` and `handoff.md` with the qualified head, merge ancestry, immutable
tag, release/asset identities, prerelease state, public origin checks, and
truthful blockers. Stop before commit or any Task 34 source, branch, build,
signing, qualification, or final-release action.
