# 33 Release v2.4.0-alpha.1

## Outcome

Use the completed production release pipeline to perform one combined Build +
Deploy operation for `v2.4.0-alpha.1`. Prepare and preserve the release source,
construct/sign the complete physical Linux/Windows inventory, stage and
final-origin verify the exact bytes, create the immutable tag, and publish one
public GitHub prerelease before either platform smoke. Seal
`candidateInputDigest`, `releaseCandidateDigest`, `releaseStagingDigest`, and
alpha `deploymentDigest`; create no platform result, aggregate, final lineage,
or Production support claim.

## Prerequisites

- Specification revision 25 and plan revision 33 are approved.
- Task 32 is complete: the same production builders have generated and
  verified every required physical asset in protected nonpublishing Linux and
  Windows runs.
- Tasks 01–20 and 23–25 remain complete; Task 26 remains deferred.
- No release branch, committed `2.4.0-alpha.1` identity, tag, GitHub Release,
  candidate generation, staging digest, or deployment digest exists.
- Exact production inputs, protected reviewers, signers, legal/provenance
  material, and non-clobbering recovery procedures are available through
  separately authorized manual gates.

## Owned Requirements

- Alpha-release slices of `CI-001`–`CI-008`, `PKG-002`–`PKG-004`,
  `PKG-009`–`PKG-012`, `SEC-003`, `SEC-009`, `SEC-014`,
  `DIST-001`–`DIST-004`, `REL-001`–`REL-004`, `QUAL-001`,
  `QUAL-004`, `QUAL-007`, `COMP-012`–`COMP-013`, and
  `OPS-003`–`OPS-004`.
- Primary target-specific application of `AC-AUTO-085`–`AC-AUTO-090`;
  supporting reruns of `AC-AUTO-073`, `AC-AUTO-080`, `AC-AUTO-083`,
  `AC-AUTO-084`, and `AC-AUTO-091`. Task 33 does not instantiate the
  shared `AC-AUTO-082` platform-smoke result.
- `AC-MAN-012`, `AC-MAN-014`, and `AC-MAN-020`.

## In Scope

- Prepare canonical SemVer `2.4.0-alpha.1`, branch
  `release/v2.4.0-alpha.1`, expected absent tag `v2.4.0-alpha.1`, changelog,
  release notes, and registered manual-script inputs as reviewed committed
  source. Reject dirty, stale, mutable, or incorrectly based heads.
- Freeze the release pull-request head and `candidateInputDigest`, revalidate
  immutable hosted inputs, closed Linux/Windows CPU/CUDA profiles, action pins,
  approvals, signing/legal/provenance inputs, and exact package configuration.
- In protected builders, freshly construct and authenticate the complete
  physical inventory represented by the six logical output classes:
  - Linux x64 `AppImage`, `deb`, and `rpm`;
  - Windows x64 NSIS installer;
  - separate Linux/Windows CPU runtime archives;
  - separate Linux/Windows RTX 50 `sm_120a-real` runtime archives;
  - production catalogs and public keyring material, required detached/native
    signatures, checksum set, signed release manifest, SBOMs, notices,
    provenance, and compatibility records.
- Repeat required clean-root deterministic builds, natively sign both
  application classes, sign all four runtime archives/catalogs/manifest, and
  freeze the exact `releaseCandidateDigest` with bidirectional bindings for
  every physical file.
- Preserve the frozen head unchanged through the approved merge method and
  prove it remains reachable from `main`; reject squash/rebase/conflict
  mutation, post-freeze commits, stale approval, or rewritten history.
- Create immutable tag `v2.4.0-alpha.1` on the exact preserved head. Reject an
  existing/moved tag, release name, or asset filename.
- Explicitly enable Task 32's preserved publication gate with
  `publish=true` and `release_tag=v2.4.0-alpha.1` only after all preceding
  protected gates pass. The publication job must consume and reverify the
  complete candidate preserved by the exact-inventory job; no second build,
  partial application-only upload, or alternate publication path is allowed.
- Stage every candidate without clobbering. Download each through its canonical
  final GitHub Release asset endpoint and verify exact byte, manifest, catalog,
  signature, origin, platform, target, and applicability parity before the
  staging set becomes installable.
- Seal `releaseStagingDigest`, publish the complete public prerelease from the
  unchanged staged bytes, verify final public origin/state, and seal alpha
  `deploymentDigest`.
- Leave the later platform-smoke input/result and aggregate validators
  uninstantiated until Tasks 34/35 and the feedback gate.

## Out Of Scope

- Reimplementing or weakening Task 32's pipeline. A construction/inventory
  defect returns to Task 32 and invalidates this attempt before publication.
- Any physical Linux or Windows install/runtime/model/transcription smoke,
  `platformSmokeInputDigest`, platform result, or `alphaAggregateDigest`.
- Feedback selection, alpha.2 or later, final construction/publication,
  physical final tests, or Production support promotion.
- CI artifacts or qualification packs as installation origins, copying pinned
  Hugging Face models into the release, RTX 30/40, AMD promotion, macOS, or
  unrelated product/dependency changes.

## Task Contract

Build and Deploy are one version-scoped packet with ordered phases: committed
preparation; protected build/sign/freeze; preserving merge; exact tag;
non-installable staging and final-origin verification; public publication.
Each external phase remains a separate `MANUAL GATE`. Later phases may consume
only immutable outputs of earlier phases and may never rebuild, re-sign,
retimestamp, repackage, regenerate catalogs, or mutate metadata.

The signed manifest owns the exact physical inventory. Six logical classes do
not mean six files. Missing Linux formats, runtime archives, trust inputs,
signatures, or verification assets fail closed even when static policy tests
pass. A CI artifact, synthetic fixture, qualification-purpose pack, or disabled
packaging result cannot enter staging or publication.

Staging is non-installable and non-clobbering. An authorized retry may reuse
only unchanged verified candidates while all identities and approvals remain
current; it may remove or quarantine only attempt-owned incomplete staging.
Published tags/releases/assets are immutable and never overwritten or deleted
as rollback.

Task 33 owns enabling the single guarded publication job preserved by Task 32.
It must fail when the boolean authorization is absent, the release tag is empty
or differs from the verified candidate, the candidate dependency is bypassed,
or the tag/release already exists. No candidate job may inherit publication
write authority.

## Contracts And Boundaries

- Task 33 owns alpha.1 graph steps from prepared release source through public
  `deploymentDigest`. Task 32 owns reusable construction; Tasks 34 and 35
  receive only public final-origin identities and cannot mutate the release.
- Release workflows cannot dispatch physical platform smokes. Smoke workflows
  have no signing secrets, release token, or `contents: write` permission.
- Production catalogs resolve every installable application/runtime asset from
  this same tag. The six pinned Hugging Face model objects remain the sole
  external content origins.
- Alpha.1 source, tag, candidate, signature, catalog, staging, and deployment
  identities cannot satisfy alpha.2 or final.
- Signing keys, tokens, raw hardware identifiers, private paths/environments,
  audio, transcripts, prompts, logs, and measurements never enter repository
  or public evidence.

## Expected Files Or Components

- Committed `package.json`/lockstep release identity, changelog/release notes,
  and reviewed manual-script registry for `2.4.0-alpha.1`.
- Protected release workflow inputs and privacy-safe candidate, signing,
  reproducibility, legal, provenance, staging, origin, deployment, and retry
  evidence generated by Task 32's implementation.
- The preserved default-off publication job, explicitly enabled for alpha.1
  only after exact-candidate verification and the separate external gates.
- Exact signed manifest and complete physical public asset set under tag
  `v2.4.0-alpha.1`; models are not copied.
- Target-aware verification records plus `todo.md` and `handoff.md` updates.
- No new dependency, alternate build path, or release-time tracked mutation.

## Acceptance Criteria

- Targeted `AC-AUTO-085` admits only the clean reviewed prepared release head
  and protected candidate flow, with no prepublication platform-smoke gate;
  it also proves the publication path exists, defaults off, and can be enabled
  only with the verified candidate and matching explicit tag.
- Expanded `AC-AUTO-086` proves exact construction of Linux AppImage/deb/rpm,
  Windows NSIS, four runtime archives, and every required catalog/keyring/
  signature/checksum/manifest/SBOM/notice/provenance/compatibility asset.
- `AC-AUTO-087`–`AC-AUTO-090` prove frozen-byte promotion,
  non-clobbering recovery, closed origins, and canonical final-origin parity.
- `AC-AUTO-091` makes Tasks 34 and 35 eligible only after public immutable
  alpha deployment and rejects invalid numbering, cross-generation reuse,
  prepublication smoke, or a physical final-test branch.
- `AC-MAN-012` and `AC-MAN-014` pass for the exact alpha.1 source and complete
  physical candidate. Optional extended FLEURS diagnostics remain nonblocking.
- `AC-MAN-020` publishes the complete same-tag inventory before either
  platform smoke. Neither platform needs a CI artifact, qualification pack,
  unpublished trust input, local substitution, or other binary origin.
- Publication creates no platform pass, feedback decision, final authority, or
  Production claim.

## Verification

Run target-aware release commands against the frozen alpha identity:

```bash
rtk npm run test:local-whisper:release-preparation
rtk npm run verify:local-whisper:release-preparation
rtk npm run test:local-whisper:release-candidates
rtk npm run verify:local-whisper:release-candidates
rtk npm run test:local-whisper:release-policy
rtk npm run test:local-whisper:release-delivery
rtk npm run test:local-whisper:release-lifecycle
rtk npm run verify:local-whisper:build -- --target=v2.4.0-alpha.1
rtk npm run verify:local-whisper:release-merge -- --target=v2.4.0-alpha.1
rtk npm run verify:local-whisper:release-origin -- --target=v2.4.0-alpha.1
rtk npm run verify:local-whisper:deploy -- --target=v2.4.0-alpha.1
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk git diff --check
```

Protected and final-origin checks use the same exact physical inventory. Do
not run Linux or Windows platform-smoke commands in Task 33.

## Failure And Rollback

- Missing preparation, input/profile closure, protected builder, deterministic
  output, signature/legal approval, complete inventory, preserved merge, tag
  absence, staging parity, or publication authority blocks the next phase.
- A defect before publication invalidates the attempt at its earliest changed
  digest and permits only a clean alpha.1 retry. A construction defect returns
  to Task 32 rather than being patched inside an active release attempt.
- A defect after publication never mutates alpha.1; an accepted fix requires
  alpha.2 through a new planning revision.
- Preserve truthful sanitized failures. Clean only attempt-owned roots,
  processes, and incomplete staging; never broadly delete shared caches, user
  data, published assets, releases, or tags.

## Manual Gates

- `MANUAL GATE`: prepare/commit/push `release/v2.4.0-alpha.1`, update the
  release pull request, review changelog/version/scripts, and verify preserving
  merge settings.
- `MANUAL GATE`: protected reviewers, Linux/Windows builders and signing,
  legal/SBOM/notice/provenance review, and candidate execution.
- `MANUAL GATE`: preserving merge, exact tag creation, non-clobbering GitHub
  Release staging/upload, final-origin verification, public prerelease
  publication, and final public inventory verification—each separately
  authorized.
- Commit, push, pull-request change, merge, tag, upload, publication, support
  promotion, and release are not authorized by plan or packet approval.

## References

- Mandatory: specification revision 25 Sections 9.6, 18.1–18.5, 19.1
  (`AC-AUTO-083`–`AC-AUTO-091`), `AC-MAN-012`, `AC-MAN-014`,
  `AC-MAN-020`, and 22.1.
- Mandatory input: completed Task 32 handoff with reviewed pipeline, exact
  physical inventory schema, protected nonpublishing construction evidence,
  and all residual manual gates.
- Historical context only: superseded plan-31 Task 32, which incorrectly
  combined pipeline implementation with irreversible alpha publication.

## Completion And Handoff

Mark Task 33 complete only when the exact public prerelease, complete physical
same-tag inventory, immutable source/tag/origin chain, and `deploymentDigest`
exist. Update `todo.md` and `handoff.md`; stop before commit, either platform
smoke, feedback selection, later-alpha planning, final source work, or support
promotion. A later explicit `incremental-implementation` invocation is
required for Task 34 or Task 35.
