# Task 30: Release Branch Preparation And Pull Request Policy

## Outcome

Implement the deterministic, read-only release-preparation contract that a
future `release/v<SemVer>` pull request must satisfy before protected candidate
production: committed version/changelog consistency, a complete manual-check
registry, clean exact-head identity, current `main` base, and repository
merge-method policy. Create no release branch, commit, pull request, candidate,
tag, or release.

## Prerequisites

- Specification revision 20 and plan revision 27 are approved.
- Tasks 25, 27, and 31 are complete, reviewed, and committed. Task 31's
  unchanged hosted builder contract, rooted in Task 27's immutable inputs and
  disconnected executor, remains the only application/runtime build path.
- The current planned release is `2.4.0`, but Task 30 implementation does not
  mutate the current branch to that version or claim that a release attempt
  exists.
- Existing package versioning, release workflow, packaging policy, task-plan
  validator, and qualification commands remain the repository baseline.

## Owned Requirements

- Release-preparation and pull-request policy slices of `CI-004`, `CI-008`,
  `QUAL-004`, and `REL-002`.
- Primary `AC-AUTO-085`; supporting `AC-MAN-014` and `AC-MAN-019`.
- Exact preparation identity consumed by Tasks 28, 29, 21, and 22.

## In Scope

- Make the committed `package.json` version canonical. Require the root
  `package-lock.json` versions and one exact versioned changelog section to
  match; derive the release branch and expected tag as
  `release/v<SemVer>` and `v<SemVer>`.
- Add a deterministic generated release-version identity manifest and strict
  schema. Bind SemVer, expected branch/tag, base branch, exact head/base/tree,
  canonical file digests, changelog-section digest, manual-check-registry
  digest, manual-script identities, and generation time without treating the
  generated file as a source-of-truth replacement.
- Add and validate one checked-in manual-check registry covering every
  script-backed preparation, packaging/signing, Linux qualification, Windows
  qualification, aggregate, merge-policy, tag, final-origin, clean-install,
  and publication check used by Tasks 28, 29, 21, and 22.
- Replace release-workflow use of build-time tracked version mutation with
  non-mutating generation and consistency verification. Keep any compatibility
  wrapper incapable of writing `package.json`, `package-lock.json`, or the
  changelog in CI.
- Add a read-only release-pull-request workflow and policy verifier for exact
  branch/base shape, clean committed preparation, current base, immutable head,
  no existing expected tag, and no production signing/publication authority.
- Validate, without changing, repository merge settings: merge commits enabled,
  squash merging disabled, and rebase merging disabled.
- Add malformed, stale, dirty, missing, duplicate, cross-version,
  cross-generation, and post-freeze fixtures plus policy tests.

## Out Of Scope

- Actually creating `release/v2.4.0`, updating the real release changelog and
  package version, committing or pushing preparation, opening/updating a pull
  request, or changing GitHub repository settings.
- Production environment access, signing, candidate freeze, Linux/Windows
  physical qualification, merge, tag creation, GitHub Release staging/upload,
  publication, support promotion, or release.
- A second builder, runtime format, installation origin, RTX 30/40 support, AMD
  promotion, macOS execution, or a renderer/application interface change.

## Task Contract

The future release branch name is exactly `release/v<SemVer>`, its pull request
targets `main`, and the final tag value is exactly `v<SemVer>`. SemVer is read
from committed `package.json`; an explicit workflow input may select an
attempt only when it matches that committed value exactly. `package-lock.json`,
the changelog heading, catalog/app compatibility inputs, branch name, and tag
must agree. The verifier rejects prerelease/build metadata forms that existing
application packaging cannot represent consistently.

The generated canonical JSON identity contains only bounded public release
metadata and cryptographic identities. It is reproducible for the same
committed head/base inputs apart from an explicit frozen UTC field supplied by
the protected attempt; it contains no secret, token, private evidence, raw host
identity, path, environment, or mutable URL. Generation never edits tracked
files.

Each manual registry row has a stable ID, owner task, phase, platform,
script/package command, bounded entrypoint paths, required evidence schema,
network/secrets/external-write classification, and required/optional state.
Every referenced command and entrypoint must exist, every script-backed manual
gate in Tasks 28/29/21/22 must have exactly one active row, and no undeclared
manual entrypoint may enter candidate or release evidence. A registry or script
change changes the preparation digest and invalidates every later candidate.

Release-PR validation runs with read-only permissions and no protected
environment. It accepts only a clean committed head that is current with its
recorded `main` base and has no already-existing expected tag. It emits a
bounded preparation digest/status for Task 28; it creates no commit, branch,
tag, release, artifact installation origin, hardware claim, or Production
verdict.

Repository-wide merge settings are an external prerequisite selected by the
user: allow merge commits, disable squash, and disable rebase. Task 30 may read
and verify those settings but cannot modify them. A mismatch blocks the
release-PR gate and Task 28.

## Contracts And Boundaries

- Task 30 owns release preparation and read-only PR policy only. Task 28 owns
  production secrets, final signing, and candidate freeze.
- Task 31's builder contract and Task 27's input/isolation contract remain
  unchanged; release preparation may select their exact source but cannot fork
  or rewrite either one.
- The changelog and committed version files are reviewable source. The
  generated manifest is derived evidence and cannot override them.
- PR/fork/main validation receives no signing, merge, tag, release, or
  publication authority. Repository-setting mutation remains human-owned.
- Release-preparation logs and artifacts contain only public bounded metadata
  and digests; private qualification evidence never enters this packet.

## Expected Files Or Components

- `CHANGELOG.md` format and version-section validator.
- Release preparation/version-manifest generator, schema, manual-check registry,
  registry verifier, and focused fixtures under existing script/test
  boundaries.
- `scripts/apply-release-version.mjs` and release-workflow call sites revised
  so production CI validates committed versions without tracked-file writes.
- A focused read-only release-PR workflow and workflow/repository-policy tests.
- `package.json`, task-plan ownership files, `todo.md`, and `handoff.md`.

## Acceptance Criteria

- `AC-AUTO-085` rejects a feature PR, fork, wrong base/branch/version/tag,
  dirty or stale head, missing/incomplete changelog, inconsistent package lock,
  missing/duplicate/stale registry row, changed manual script, existing tag,
  mutable post-freeze input, production secret, write permission, and invalid
  repository merge setting.
- One valid `release/v2.4.0` fixture deterministically derives tag `v2.4.0`, a
  complete identity manifest, and one bounded preparation digest without
  modifying tracked files or entering a protected environment.
- The manual registry accounts exactly once for every script-backed gate owned
  by Tasks 28, 29, 21, and 22 and rejects cross-generation evidence.
- Merge-commit-only repository settings are verified read-only; any setting
  mismatch blocks release readiness without attempting to repair GitHub.
- Existing hosted builder, packaging, qualification, release-policy, type,
  lint, format, audit, and production-build checks remain passing.

## Verification

```bash
rtk npm run test:local-whisper:release-preparation
rtk npm run verify:local-whisper:release-preparation
rtk npm run test:local-whisper:release-policy
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
rtk npm run test:local-whisper:release-preparation
rtk npm run verify:local-whisper:release-preparation
```

## Failure And Rollback

- A missing/inconsistent version, changelog, registry, script, base/head,
  branch, expected tag, or repository setting leaves preparation invalid and
  blocks Task 28. Never infer, rewrite, or bypass the failed field.
- A post-freeze change creates a new preparation identity; no previous
  candidate or manual result may be rebound to it.
- Roll back Task 30's verifier/workflow/format changes together. Do not restore
  release-time tracked-file mutation or weaken existing workflow-policy checks.

## Manual Gates

- After Task 30 is reviewed and committed, separately authorize changing
  GitHub repository settings to enable merge commits and disable squash/rebase
  merging repository-wide. This affects feature pull requests as well.
- Separately authorize creation of `release/v2.4.0`, committed updates to
  `package.json`, `package-lock.json`, the complete `2.4.0` changelog section,
  catalog/compatibility inputs, and review of every registered manual script.
- Commit, push, release-PR creation/update, GitHub setting mutation, protected
  candidate execution, signing, physical qualification, merge, tag, upload,
  publication, support promotion, and release are not authorized by Task 30
  implementation approval.

## References

- Specification revision 20 Sections 18.3–18.5, 19.1
  (`AC-AUTO-085`), `AC-MAN-014`, `AC-MAN-019`, and Section 22.
- Task 27 toolchain and Task 31 builder handoffs; Tasks 28, 29, 21, and 22
  manual/identity contracts; release/project conventions.
- Decisions `planning.release-version-authority`,
  `planning.release-branch-name`, and `planning.release-merge-enforcement`.

## Completion And Handoff

After deterministic verification, update `todo.md` and `handoff.md` and stop
before commit or any external release action. Task 30 implementation completion
does not itself create a release attempt. After its later review/commit and
separate manual authorization, the prepared `release/v2.4.0` pull-request head
and preparation digest become Task 28 prerequisites; any mismatch remains a
blocker rather than permission to continue.
