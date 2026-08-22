# 35 Release v2.4.0

## Outcome

After the latest public alpha has separate passing Linux and Windows smoke
results and feedback selects final, build and publish a fresh immutable
`v2.4.0` generation. Prove the closed final-only source delta, rebuild and
sign all six outputs reproducibly, preserve the exact release head through
merge/tag/staging/final-origin verification, seal `finalLineageDigest`, and
publish stable. Run no physical Linux or Windows test against final bytes.

## Prerequisites

- Specification revision 23 and plan revision 31 are approved.
- Tasks 33 and 34 are complete for the latest public alpha and both immutable
  results are Pass.
- The feedback gate has sealed `alphaAggregateDigest`, explicitly selected
  final, and confirmed no accepted product/runtime/packaging/compatibility/
  user-visible fix is absent from that alpha.
- Under the current finite plan the latest alpha is
  `v2.4.0-alpha.1`. If feedback selected another alpha, this packet is
  superseded before execution by a new planning revision.
- Task 32's reviewed builder/release implementation is the sole release
  implementation. Representative platform hosts are not prerequisites because
  final has no physical test branch.

## Owned Requirements

- Final slices of `CI-001`–`CI-008`, `PKG-002`–`PKG-004`,
  `PKG-009`–`PKG-012`, `SEC-003`, `SEC-009`, `SEC-014`,
  `DIST-001`–`DIST-004`, `REL-001`–`REL-004`, `QUAL-001`–`QUAL-007`,
  `MODEL-011`, `PRIV-005`, `PRIV-006`, `COMP-004`, `COMP-012`,
  `COMP-013`, and `OPS-003`–`OPS-004`.
- Primary `AC-AUTO-071` and `AC-AUTO-091`; supporting target-aware reruns
  of `AC-AUTO-002`, `AC-AUTO-023`, `AC-AUTO-032`, `AC-AUTO-040`,
  `AC-AUTO-073`, `AC-AUTO-080`, and
  `AC-AUTO-083`–`AC-AUTO-090`.
- `AC-MAN-019` and `AC-MAN-021`; final application of `AC-MAN-014`.

## In Scope

- Verify the latest alpha `deploymentDigest`, separate Linux/Windows
  platform-smoke input/result/evidence digests, passing statuses,
  `alphaAggregateDigest`, and explicit final transition without modifying
  any alpha record.
- Enforce the closed final source-delta schema frozen by the latest alpha's
  `candidateInputDigest`. Permit only canonical SemVer/changelog,
  tag-derived catalog/manifest/release-note preparation, and non-executable
  metadata deterministic from final identity.
- Reject every dependency, build-policy, runtime, application,
  packaging-behavior, compatibility, model, protocol, setting, trust-policy,
  origin, or other behavior-affecting delta. Any accepted fix requires the
  next sequential public alpha.
- Revalidate immutable hosted inputs, disconnected boundaries, closed
  Linux/Windows CPU/CUDA profiles, action pins, legal/provenance inputs, and
  shared target-aware builder.
- Prepare exact final identity: SemVer `2.4.0`, branch
  `release/v2.4.0`, absent tag `v2.4.0`, committed canonical version/
  changelog/manual-script registry, clean head/current `main` base, and
  preserving merge policy.
- Freshly build and sign the Linux/Windows application installers, CPU packs,
  and RTX 50 `sm_120a-real` packs plus production catalogs and complete
  release manifest. Repeat deterministic builds in independent clean roots.
- Freeze new final `candidateInputDigest` and `releaseCandidateDigest`.
  Reuse no alpha candidate bytes, signatures, catalogs, manifest, or tag as
  final candidates even when source inputs overlap.
- Under separate authorities, preserve the frozen final head through merge,
  create exact immutable tag `v2.4.0`, stage without clobbering, download and
  structurally final-origin verify every staged asset, and freeze
  `releaseStagingDigest`.
- Seal `finalLineageDigest` from the latest passing alpha aggregate, closed
  final delta, fresh final generation/staging, deterministic checks,
  independent reproducibility, and signing/legal approvals.
- Publish stable only from the unchanged staged bytes, seal final
  `deploymentDigest`, and promote Linux/Windows CPU plus RTX 50 support based
  on their latest-alpha platform passes and final lineage.

## Out Of Scope

- Physical install, launch, model acquisition, load, transcription, unload,
  offline-reuse, resource, or cleanup testing against final bytes.
- Rerunning `AC-MAN-017` or `AC-MAN-018` for final; alpha evidence enters
  only through `alphaAggregateDigest`.
- All-six-model FLEURS/direct-engine accuracy/performance/resource/repetition
  diagnostics; they remain optional and nonblocking.
- Reusing or relabeling alpha assets as final, mutating any alpha, or adding an
  accepted fix directly to final.
- RTX 30/40, AMD promotion, macOS release, or unrelated product work.

## Task Contract

The final Release packet has the same ordered internal phases as Task 32:
prepare/build; sign/freeze; preserving merge; exact tag; non-installable
staging/final-origin verification; lineage sealing; stable publication. Each
external phase is a separate `MANUAL GATE`, but Build and Deploy remain one
version-scoped packet.

Latest-alpha results authorize lineage only. They never substitute for final
candidate bytes or claim those exact bytes were physically tested. Final
confidence is the conjunction of latest-alpha dual-platform functional
evidence, a closed non-behavioral source delta, fresh signed construction,
independent reproducibility, deterministic automated checks, and exact staged
promotion.

Any change after final candidate freeze invalidates downstream final records.
Any behavior-affecting change before freeze invalidates the final path and
requires alpha.2 through a new plan. A signing, tag, staging, origin, or
reproducibility failure blocks stable without mutating any alpha.

Staging is non-installable and non-clobbering. An authorized retry may reuse
only exact unchanged verified final candidates while all identities/approvals
remain current. Published tags/assets are never moved, replaced, deleted, or
rewritten; rollback selects a prior immutable stable release or a later version.

## Contracts And Boundaries

- The final delta allowlist cannot be expanded after latest-alpha smoke.
- Task 35 consumes Tasks 33/34 only through the sealed aggregate and preserves
  each platform branch read-only.
- Final graph construction has no `platformSmokeInputDigest` or physical-test
  result for final.
- Same-tag GitHub Release assets are the only final application/native
  installation origins; pinned Hugging Face models remain the sole exception.
- Release/signing credentials, raw test evidence, paths, device identifiers,
  audio, transcripts, prompts, environments, private logs, and secrets never
  enter repository/public evidence.

## Expected Files Or Components

- Closed final-delta schema/manifest producer/verifier and negative fixtures.
- Reused target-aware builders/reproducibility/signing/candidate components
  with final identities and immutable action pins.
- Final release preparation, exact-head/merge/tag, non-clobbering staging,
  final-origin, lineage, deployment, recovery, rollback, and support-promotion
  validators/workflow phases.
- Lifecycle policy covering one/multiple alpha sets followed by final and no
  final physical-test branch.
- Target-aware `package.json` commands, acceptance ownership,
  `todo.md`, and `handoff.md`.

## Acceptance Criteria

- `AC-AUTO-071` admits only the closed non-behavioral final delta and binds
  fresh reproducible signed candidates; every product/runtime/package/
  compatibility change requires another alpha.
- `AC-AUTO-073`, `AC-AUTO-080`, and `AC-AUTO-083`–`AC-AUTO-086`
  prove complete final implementation/build/release preparation without a
  physical final test.
- `AC-AUTO-087`–`AC-AUTO-090` prove frozen-byte promotion,
  no-clobbering recovery, allowed origins, and exact staged final-origin parity.
- `AC-AUTO-091` requires the latest-alpha dual pass, explicit final
  transition, fresh final six-output generation, closed delta, reproducibility,
  and no physical final-test branch.
- `AC-MAN-019` proves final branch preparation, closed delta,
  build/sign/reproducibility, preserving merge/tag, staging, final-origin, and
  stable publication without physical final tests.
- `AC-MAN-021` publishes only fresh final bytes and promotes support only
  when latest-alpha Linux/Windows passes and final lineage are complete.
- No final action mutates any alpha, reuses an alpha asset, or creates an
  all-six-model performance/resource claim.

## Verification

Implement/register target-aware final commands where absent:

```bash
rtk npm run test:local-whisper:release-lifecycle
rtk npm run test:local-whisper:release-policy
rtk npm run test:local-whisper:release-delivery
rtk npm run test:local-whisper:ci-builds
rtk npm run verify:local-whisper:ci-builds
rtk npm run test:local-whisper:release-preparation
rtk npm run verify:local-whisper:release-preparation
rtk npm run test:local-whisper:release-candidates
rtk npm run verify:local-whisper:release-candidates
rtk npm run verify:local-whisper:build -- --target=v2.4.0
rtk npm run verify:local-whisper:release-merge -- --target=v2.4.0
rtk npm run verify:local-whisper:release-origin -- --target=v2.4.0
rtk npm run verify:local-whisper:final-lineage -- --target=v2.4.0
rtk npm run verify:local-whisper:deploy -- --target=v2.4.0
rtk npm run verify:local-whisper:all
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk git diff --check
```

Do not run Linux/Windows alpha-smoke, all-six-model qualification, or clean-host
physical final commands as Task 35 completion gates.

## Failure And Rollback

- Missing/failed latest-alpha pass, absent final transition, accepted product
  fix, non-allowlisted delta, input/profile change, reproducibility mismatch,
  signing/legal failure, stale head, wrong/existing tag, collision, or
  final-origin divergence blocks stable.
- Any accepted behavior fix requires a new `/plan` revision and alpha.2
  Release/Linux-smoke/Windows-smoke set; Task 35 is superseded before execution.
- A prepublication final-only failure may retry from a fresh invalidated stage
  or generation as dictated by its earliest changed digest. It never changes
  alpha evidence.
- Preserve truthful failures and immutable candidates. Remove only proven
  attempt-owned incomplete staging; never delete published assets/tags, shared
  caches, or user data.
- After stable publication, rollback selects a prior immutable release or a
  new version; it never mutates `v2.4.0`.

## Manual Gates

- `MANUAL GATE`: durably select final only after both latest-alpha passes and
  confirmation that no accepted fix is absent.
- `MANUAL GATE`: create/prepare/push `release/v2.4.0`, update the release
  pull request, and verify merge policy.
- `MANUAL GATE`: protected reviewers, Linux/Windows signing, legal/SBOM/
  notice/provenance approval, and protected final candidate execution.
- `MANUAL GATE`: preserving merge, exact tag creation, GitHub Release
  staging/upload, final-origin verification, lineage review, stable
  publication, and support promotion—each separately authorized.
- Commit, push, pull-request change, merge, tag, release action, publication,
  support promotion, and release are not authorized by plan or packet approval.

## References

- Mandatory: specification revision 23 Sections 9.6, 18.3–18.5, 19.1
  (`AC-AUTO-071`, `AC-AUTO-073`, `AC-AUTO-087`–`AC-AUTO-091`),
  `AC-MAN-019`, `AC-MAN-021`, and 22.2.
- Mandatory inputs: latest alpha `deploymentDigest`, Tasks 33/34 immutable
  passing results, sealed `alphaAggregateDigest`, explicit final transition,
  and Task 32 builder/release contracts.
- Historical context only: superseded revision-30 Tasks 34 and 35.

## Completion And Handoff

Mark Task 35 complete only after exact stable publication, final
`deploymentDigest`, and permitted support promotions are recorded. Update
`todo.md` and `handoff.md` with final immutable source/tag/release/asset/
origin/lineage identities and residual support boundaries. Stop before any
unapproved commit, push, release mutation, follow-up version, or unrelated
work.
