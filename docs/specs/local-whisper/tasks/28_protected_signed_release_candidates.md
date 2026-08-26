# Task 28: Protected Signed Release Candidates

Status: **Superseded by approved plan revision 31. Do not execute this packet.**
Its protected candidate work is owned by Task 32 for alpha and Task 34 for the
fresh final generation.

## Outcome

Implement the protected release-candidate workflow and, after every manual
authority is available, consume one exact Task 30 release-pull-request
preparation identity and freeze its immutable head as a SemVer/source generation
containing the natively signed Linux and Windows application candidates, four
signed CPU/RTX 50 runtime packs, production catalogs/keyrings, and one signed
release manifest. Merge and publish nothing.

## Prerequisites

- Specification revision 20 and plan revision 27 are approved.
- Tasks 25, 27, 31, and 30 are complete, reviewed, and committed. Task 31
  builders using Task 27 immutable inputs are the sole application/runtime
  build implementation.
- Under separate authority, repository merge settings permit merge commits
  only and one current `release/v2.4.0` pull request into `main` has complete
  committed preparation, a clean frozen head, and a passing Task 30 digest.
- Candidate SemVer `2.4.0` is canonical in committed `package.json`; its package
  lock, changelog section, branch, generated version manifest, catalog inputs,
  and expected tag `v2.4.0` match exactly.
- Production signing, legal, redistribution, provenance, SBOM, notice,
  reviewer, and protected GitHub Environment authorities are available through
  their manual gates.
- No platform qualification branch, release upload, or publication exists.

## Owned Requirements

- Candidate/signing slices of `CI-004`–`CI-008`, `DIST-004`, `PKG-011`–`PKG-012`, `SEC-014`, and
  `REL-002` candidate-production slices.
- Primary `AC-AUTO-086`–`AC-AUTO-089`; supporting `AC-AUTO-085`,
  `AC-MAN-014`, and `AC-MAN-019`.
- Same-tag asset layout and exact signed-candidate identity needed by Tasks
  29, 21, and 22.

## In Scope

- Define the protected reviewer-gated production environment, least-privilege
  job permissions, secret custody, audit records, rotation/revocation failure,
  and fork/PR/self-hosted exclusion policy.
- Revalidate and freeze the exact release PR number, `release/v2.4.0` branch,
  `main` base, unchanged head/tree, clean-state proof, Task 30 preparation
  digest, canonical/generator version manifests, changelog section,
  manual-registry/script identities, expected `v2.4.0` tag value, toolchain and
  source locks, catalogs/keyrings/origins, four runtime archives, two
  application packages, signatures, SBOMs, notices, provenance, and release
  manifest entries.
- Apply Windows Authenticode and every applicable Linux package-native
  signature before qualification; retain independent catalog/runtime
  signatures and sign the release manifest.
- Bind every candidate by filename, role, platform, architecture, target,
  length, SHA-256, signature, source revision, release tag, and app/protocol
  compatibility.
- Produce immutable candidate-generation records and read-only transfer inputs
  for Task 29 and Task 21. A CI artifact may transport them only as a protected
  qualification input; it is never an installation origin.
- Add policy/failure tests for missing or stale approval, revoked/missing
  signer, secret disclosure, source/tag/preparation drift, changed PR head/base,
  premature/existing tag, duplicates, cross-tag assets, post-sign mutation,
  retry, and no-clobber publication handoff.

## Out Of Scope

- Linux or Windows representative qualification, which consumes the frozen
  candidates in Tasks 29 and 21.
- Creating/updating/merging the release pull request, changing its source,
  committing version/changelog preparation, or changing repository settings.
- Uploading to, creating, publishing, deleting, or mutating a GitHub Release;
  final-origin verification and deploy remain Task 22 manual gates.
- Release-time rebuild, re-sign, timestamp replacement, repackaging, catalog
  regeneration, metadata mutation, or qualification-purpose artifact
  publication.
- Source commit/push, PR creation/update/merge, tag creation, RTX 30/40, AMD
  promotion, or macOS release.

## Task Contract

Only the immutable Task 30-qualified release pull-request head and matching
committed SemVer/expected-tag identity may enter the protected candidate
workflow. The workflow takes a bounded PR number plus expected head and
preparation digest, then independently reads and compares the live head/base,
branch, version/changelog/registry identities, repository merge settings, and
tag absence before protected authority is reachable. Ordinary feature
PR/main/reusable callers cannot select the production environment. Required
reviewers approve before secrets become available. Signing jobs log only safe
key IDs/certificate metadata and signed digests—never keys, tokens, certificate
secrets, signer responses, or private material.

Task 31 builders and Task 27 input/isolation contracts run unchanged. Native
signing occurs before the candidates are declared frozen. Runtime archive
bytes remain deterministic; detached
signatures do not alter them. Native application signatures are part of the
final installer bytes. Every later platform result must name those final
digests plus the exact release PR head and Task 30 preparation digest. Any
head/base/preparation/script or candidate-byte change creates a new preparation
and candidate generation and invalidates prior evidence; no in-place repair or
rebinding is permitted. The final Git tag remains absent and exists only as
frozen metadata.

The production catalog points only to exact same-tag GitHub Release asset URLs
for native/runtime objects and to the six pinned Hugging Face model objects.
CI artifacts, raw/branch URLs, mirrors, mutable tags, prerelease scratch URLs,
and renderer/user-supplied origins are rejected. Bundled helpers/browser arrive
inside the signed installer; inference binaries arrive only in matching packs.

## Contracts And Boundaries

- Production secrets are environment-scoped and unavailable to forks,
  PR/main validation, self-hosted GPU jobs, artifacts, clients, or logs.
- The signed release manifest is the canonical complete candidate set; Tasks
  29/21 may consume it read-only, and Task 22 may merge/tag/promote only that
  exact head and those bytes.
- Qualification-purpose packages remain visibly separate, non-publishable,
  and useful only for the loopback transport proof.
- Task 28 creates no support claim and no installation origin.

## Expected Files Or Components

- Protected release-candidate workflow definitions and policy tests.
- Candidate manifest/schema, native/artifact signing adapters, signed release
  manifest producer/verifier, and privacy-safe audit output.
- Task 30 release-preparation manifest/registry consumers and exact PR
  head/base/tag-absence policy fixtures.
- Production packaging/catalog collection guards and `package.json` commands.
- Task-plan ownership files, `todo.md`, and `handoff.md`.

## Acceptance Criteria

- Supporting `AC-AUTO-085` proves only the exact Task 30-qualified release PR
  head may request protected signing and that head/base/preparation drift fails
  before secrets are available.
- `AC-AUTO-086` validates the exact complete six-output same-tag asset set and
  rejects missing, extra, duplicate, renamed, cross-tag, or mismatched objects.
- `AC-AUTO-087` proves every later handoff uses the exact signed bytes and
  rejects every rebuild or mutation.
- `AC-AUTO-088` proves cancellation/retry preserves immutable candidates and
  never authorizes clobbering or partial installation.
- `AC-AUTO-089` rejects every native binary origin outside the approved release
  contract while preserving the pinned Hugging Face model exception.
- No upload, publication, release, hardware verdict, or secret disclosure
  occurs; the release PR remains open and the final tag remains absent.

## Verification

```bash
rtk npm run test:local-whisper:release-candidates
rtk npm run verify:local-whisper:release-candidates
rtk npm run test:local-whisper:release-policy
rtk npm run test:local-whisper:packaging
rtk npm run verify:local-whisper:packaging:release-guard
rtk npm run test:local-whisper:qualification
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run audit:prod
rtk npm run build:prod
rtk git diff --check
```

Registered commands:

```bash
rtk npm run test:local-whisper:release-candidates
rtk npm run verify:local-whisper:release-candidates
rtk npm run test:local-whisper:release-policy
```

## Failure And Rollback

- Missing authority, signer, legal input, complete asset, or deterministic
  identity leaves Task 28 incomplete and creates no frozen generation.
- Preserve safe candidate digests and audit evidence; destroy/revoke only
  attempt-scoped signing material according to policy.
- A post-freeze source, signing, manifest, or candidate defect requires a new
  source/candidate generation. Never overwrite, re-sign, or patch the frozen
  set.
- A release PR head/base, committed version/changelog/manual-registry, or Task
  30 digest change requires Task 30 revalidation and a new Task 28 generation;
  never attach old signatures or platform evidence to it.

## Manual Gates

- Required production-environment reviewers and authentic signing/legal/
  redistribution/provenance/SBOM/notice inputs.
- Access to Windows Authenticode and applicable Linux signing authority. Do not
  request or store credentials in repository artifacts or chat.
- Actual protected candidate workflow execution and live release PR
  head/base/preparation plus candidate SemVer/expected-tag confirmation.
- The release branch, committed `2.4.0` version/changelog/manual review, push,
  release PR, and repository-wide merge setting must already exist through
  separate authority; Task 28 may only validate them.
- Commit, push, PR update/merge, hardware qualification, GitHub Release
  upload/publication, support promotion, tag creation/mutation, and release
  remain separately authorized. The tag value may be frozen as metadata
  without creating it.

## References

- Specification revision 20 Sections 9.6, 12.1, 18.3–18.5, 19.1
  (`AC-AUTO-085`–`AC-AUTO-089`), and 22.
- Tasks 27/31/30 handoffs, packaging/release conventions, and decisions
  `security.ci-signing-custody`, `security.application-artifact-signing`, and
  `distribution.ci-artifact-promotion` revision 2 plus
  `planning.release-version-authority` and `planning.release-branch-name`.

## Completion And Handoff

Mark Task 28 complete only when one exact signed generation, release PR head,
Task 30 preparation digest, and manifest are frozen and verifiable with no
merge, tag, upload, or platform verdict. Update `todo.md` and `handoff.md` with
safe candidate identities and blockers. Hand the immutable Linux inputs to
Task 29 and stop before commit, qualification, PR merge, tag, upload, or Task 29.
