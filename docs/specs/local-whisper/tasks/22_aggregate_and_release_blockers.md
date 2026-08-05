# Task 22: Aggregate Production Readiness And Release Blockers

## Outcome

Reconcile the immutable Task 20 Linux and Task 21 Windows branches without
rerunning their expensive profiles. Validate all automated ownership, seal
`aggregateEvidenceDigest`, prove allowed qualification-to-production deltas,
validate protected production trust/legal/provenance/SBOM/notice/
redistribution inputs, and produce one privacy-safe production-readiness and
release-blocker report.

After a separately authorized runtime upload exists, verify the identical
runtime digest through the final GitHub Release origin and the pinned anonymous
public Hugging Face model origin. Never fabricate credentials, approval,
upload, platform evidence, support promotion, or release authority.

## Prerequisites

- Specification revision 15 and plan revision 20 are approved.
- Tasks 19, 23, and 24 implementation/delivery readiness and Tasks 20–21 platform qualifications are
  complete. Both platform branches bind the exact same `candidateInputDigest`
  and are immutable, schema-valid, privacy-safe, and available by digest.
- Protected production catalog/keyring/origin, legal, provenance, SBOM,
  notices, redistribution, and signing evidence is supplied by authorized
  owners before a production-ready Pass can be issued.
- Final GitHub runtime-origin parity runs only after separate upload authority
  and the exact asset exists. Task 22 authorization alone does not authorize
  signing, upload, publication, tag, support promotion, or release.
- Task 22 has separate execution authorization.

## Owned Requirements

- Aggregate ownership: `REL-001`, `COMP-012`, `PKG-011`, `SEC-014`,
  `DIST-001`–`DIST-002`, `QUAL-001`–`QUAL-004`, `OPS-002`–`OPS-003`, and
  applicable release/privacy/packaging/diagnostics/documentation requirements.
- Primary automated acceptance: `AC-AUTO-002`, `AC-AUTO-023`,
  `AC-AUTO-032`, `AC-AUTO-040`, and `AC-AUTO-071`.
- Reconciliation of all 76 automated primary owners, including Task 19
  `AC-AUTO-064`–`AC-AUTO-070` and `AC-AUTO-072`–`AC-AUTO-075`, plus Task 23
  amended `AC-AUTO-059` and new `AC-AUTO-076`–`AC-AUTO-077`.
- Aggregate/manual reconciliation of `AC-MAN-001`–`AC-MAN-016`.

## In Scope

- Validate `acceptance-owners.json`, exact packet commands, Tasks 01–24, and
  all canonical automated acceptance IDs (`001`–`054`, `056`–`077`).
- Validate one unchanged shared candidate and exactly Linux x64 and Windows x64
  platform input/profile/graph/result/evidence-index chains.
- Seal canonical `aggregateEvidenceDigest` over the shared input, both
  platform graph/result/index identities, acceptance ownership, and
  qualification-to-production delta evidence.
- Run platform-independent aggregate, privacy, documentation, AMD Preview,
  macOS unavailable, downgrade, release-collection, and evidence-integrity
  checks.
- Build/validate the production-purpose catalog/keyring/package only from
  protected approved inputs and compare every field with the qualification
  candidate.
- Accept only declared SemVer, trust, catalog, origin, and release-metadata
  differences; executable, native, model, protocol, setting, and other
  qualification-relevant bytes remain identical.
- Validate licensing/facilitation/redistribution, provenance, SBOM, notices,
  key rotation/denylist, signing evidence, origin policy, and package
  collection isolation.
- Report every remaining technical, trust, legal, origin, publication, and
  release blocker with no false Production conclusion.

## Out Of Scope

- Rerunning, rewriting, repairing, or combining partial Linux/Windows evidence;
  changing thresholds; creating a new shared candidate or platform branch.
- Generating credentials/private keys, granting legal approval, uploading an
  asset, publishing, tagging, promoting support, or creating a release without
  separate explicit authority.
- Physical AMD qualification or executable macOS inference.
- Treating missing external gates as platform failures or treating platform
  passes as external authorization.

## Task Contract

### Aggregate graph and ownership

Both platform branches must bind the same shared `candidateInputDigest`, exact
common model/corpus/schema/Task 17 identities, distinct platform inputs and
graphs, complete results, and privacy-safe evidence indexes. Reject missing,
duplicate, mixed, backward, placeholder, unhashed, mutable, noncanonical, or
private fields.

The aggregate document binds exactly the shared candidate plus Linux and
Windows graph/result/index digests, acceptance-ownership digest, and
qualification-to-production-delta digest. It is the only layer allowed to bind
both platform branches. It cannot rewrite a prior document or compensate for a
failed/missing branch.

The task-plan registry must contain Tasks 01–24, at least one exact registered
verification command per packet, and one primary owner for every canonical
automated acceptance ID. Duplicate, missing, reordered, stale-task, or cross-
task command ownership fails closed.

### Promotion boundary

Qualification and production trust remain disjoint. Production collection
requires the protected production keyring/catalog inputs and rejects disabled,
fixture, qualification, unknown, stale, or denylisted trust. Only declared
trust/catalog/origin/release metadata may differ; any executable, native,
runtime archive, model, protocol, source, setting, or qualification-relevant
delta invalidates promotion.

Missing legal, facilitation, redistribution, signing, provenance, SBOM, notice,
key, origin, upload, or release authority is an explicit aggregate blocker. It
does not mutate a valid platform result and can never be fabricated as Pass.

### Final origins and release report

Only after separately authorized upload, download/install the exact frozen
runtime digest from the immutable GitHub Release asset using production trust.
Verify models continue to resolve only through the pinned anonymous public
Hugging Face identity/redirect policy. An unavailable asset, wrong digest,
changed redirect/object, credential requirement, or undeclared mirror blocks
readiness.

The final report contains implementation, Linux, Windows, aggregate,
trust/legal/origin, AMD, and macOS statuses separately. It includes only
sanitized digests and renderer/reviewer-safe blocker codes; no raw host path,
hardware identity, audio, transcript, measurement series, environment value,
or private key.

## Contracts And Boundaries

- Tasks 19, 23, 20, and 21 evidence is immutable input and is never rerun or
  repaired here.
- Platform, aggregate, trust, legal, publication, and release evidence classes
  are distinct and non-substitutable.
- AMD remains `Preview · Untested`; macOS remains `Planned · Unavailable`.
- No external action follows automatically from a passing technical report.
- No signing, upload, publication, push, PR, tag, support promotion, or release
  occurs without separate explicit authorization.

## Expected Files Or Components

- Aggregate graph/result/evidence validators and producers under
  `scripts/local-whisper/qualification/`.
- Qualification-to-production manifest comparator, production collection
  guard, origin verifier, and privacy-safe readiness report.
- Updated task-plan registry/validator and aggregate tests covering all 76
  automated acceptance IDs and Tasks 01–24.
- `package.json` aggregate verification command plus final `todo.md` and
  `handoff.md` status.

## Acceptance Criteria

- All 76 automated primary owners and registered commands validate exactly
  once against the approved packets.
- One aggregate root seals the unchanged shared/Linux/Windows identities and
  rejects every mixed, partial, mutated, backward, or private graph.
- Only approved production metadata deltas pass; qualification-relevant byte
  changes and cross-purpose trust fail.
- Protected external gates and final origin parity are truthful: missing inputs
  remain precise blockers and no external action is fabricated.
- The final privacy-safe report keeps platform and aggregate statuses separate
  and preserves AMD/macOS boundaries.

## Verification

Run only after Tasks 20 and 21 have complete immutable evidence:

```bash
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run test:local-whisper:qualification
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
```

Registered Task 22 commands are:

```bash
rtk npm run test:local-whisper:qualification
rtk npm run verify:local-whisper:all
```

Do not run platform qualification to repair or replace Tasks 20–21 evidence.

## Failure And Rollback

- Preserve both platform branches and truthful aggregate failures. Remove only
  exact task-owned aggregate staging; never delete platform evidence.
- A platform/shared mismatch returns to its owner and invalidates the aggregate
  attempt. An aggregate comparator/report defect remains Task 22 work.
- Missing protected external inputs remain blockers, not reasons to weaken
  trust, synthesize evidence, or rewrite a platform verdict.
- Failed final-origin parity preserves installed/candidate inputs and blocks
  readiness without fallback.

## Manual Gates

- Authorized access to immutable sanitized Linux and Windows evidence.
- Authentic production trust, signing, legal, facilitation, redistribution,
  provenance, SBOM, notice, and origin inputs from their owners.
- Separate explicit authorization before any upload, publication, signing,
  push, PR, tag, support promotion, or release. This packet itself authorizes
  none of them.
- Physical AMD and macOS execution remain future separately specified work.

## References

- Specification revision 15 Sections 9.6, 12.1, 18.3, 19.1–19.3, and 22.
- Immutable Task 20 Linux and Task 21 Windows handoffs.
- Task 17 fixture identity, production packaging/release conventions, and
  privacy-safe evidence templates.

## Completion And Handoff

Mark Task 22 complete only when the aggregate root and privacy-safe report are
truthful and schema-valid, all technical/platform evidence reconciles, and
every unavailable protected/external input is recorded as an explicit blocker.
Task completion does not require fabricating missing external authority and
does not itself authorize release.

Update `todo.md` and `handoff.md` with the aggregate digest, report digest,
separate platform/external statuses, exact blockers, checks, and any owner
packet that must be revisited. Stop before commit, push, PR, signing, upload,
publication, support promotion, tag, or release unless separately authorized.
