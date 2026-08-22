# Local Whisper Handoff

## Authoritative State

- Specification revision **23** is Approved.
- Plan revision **31** is Approved. Plan approval grants no packet execution or
  external-action authority.
- Tasks 01–20 and 23–25 are complete. Task 26 remains deferred and
  non-executable.
- Revision 31 materializes four one-shot packets: Task 32 releases alpha.1;
  Tasks 33 and 34 independently test its public Linux and Windows assets; a
  feedback gate seals the alpha aggregate; Task 35 conditionally releases final
  without physical final testing.
- No alpha or final candidate, deployment digest, platform-smoke result,
  aggregate, lineage root, release branch, tag, GitHub Release, publication,
  support promotion, or release currently exists.

## Preserved Task 32 Progress

- The prior Task 32 implementation authority covered only its earlier packet.
  Verified hosted input/materializer, task-registry, lifecycle-policy, and
  focused test work remains reusable, but the registry is stale against
  specification 23, plan 31, and the renamed packet topology.
- The former packet incorrectly placed Linux/Windows smoke before alpha
  publication. No such smoke result is valid or carried forward; the new Task
  32 stops after public prerelease deployment and `deploymentDigest`.
- Task 27 hosted acquisition/materializer and network-boundary work remains in
  commits `429aadf3` and `1a672e61`; production locks, closed active
  profiles, and actual hosted release rows remain Task 32 gates.
- The Microsoft VC Runtime installer and versioned license URL currently
  reproduce their existing locks. The earlier transient license response
  mismatch remains truthful historical failure evidence and must never be
  adopted as a replacement hash.
- Task 17 fixture digest remains
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- No candidate, hosted release run, signed artifact, private evidence, branch,
  pull request, tag, GitHub Release, upload, publication, test result, or
  support claim has been created.

## Task 32 Local Implementation

- The acceptance registry, validator, readiness verifier, and superseded
  packet markers now bind approved specification revision 23 and plan revision
  31, including the Release/Linux-smoke/Windows-smoke/final packet topology.
- `scripts/local-whisper/release-policy/` adds deterministic preparation,
  six-output candidate, staging, public-alpha deployment, smoke-order, and
  final-transition validators. The new package commands cover the Task 32
  policy paths; focused negative tests reject missing or changed outputs,
  prepublication smoke, failed-final feedback, release-time mutation, and
  clobbering.
- `.github/workflows/release-builds.yml` is manually dispatched and accepts one
  required release tag. Its sole write-scoped job waits for both candidate
  builds and attestation, rejects an existing tag or release, then creates the
  exact-head prerelease without upload replacement or `--clobber`. It no longer
  reacts to a published release or mutates tracked versions. Protected signing,
  staging, final-origin verification, and publication remain separately
  authorized external gates.
- Local checks passed: hosted-toolchain tests/verification, all Task 32 policy
  commands, acceptance ownership, implementation readiness, workflow and
  packaging policy, TypeScript checks, lint, formatting, 2,486 unit tests
  (2 skipped), production audit, production build, renderer verification, and
  `git diff --check`.
- On 2026-08-22, Task 32 local work was revalidated without changing release
  state: hosted-toolchain, release-policy, acceptance-ownership, and
  implementation-readiness checks passed; `test:types`, lint (258 existing
  warnings and no errors), formatting, 2,486 unit tests (2 skipped),
  production audit, production build, and `git diff --check` passed. No
  release workflow, candidate, tag, public prerelease, or deployment digest
  was created.

## Exact Next Packet

Task 32 `32_release_v2_4_0_alpha_1.md` remains the only executable packet. Its
local policy implementation is verified; it next requires the separately
authorized production-input, protected-build/signing, merge/tag/staging,
final-origin, and publication gates. It performs no physical Linux or Windows
smoke.

## Blockers And Manual Gates

- Official input acquisition, immutable workflow source, hosted builder rows,
  protected reviewers, signing/legal/provenance inputs, release
  branch/pull-request work, repository settings, commits, pushes, merge, tag,
  GitHub Release actions, publication, support promotion, and release each
  require their own authority.
- Task 33 requires an authorized Linux RTX 50 host. Task 34 requires an
  authorized Windows RTX 50 host. Both use only public alpha assets, keep
  private evidence outside the repository, and hold no release write/signing
  authority.
- After both platform results are sealed, feedback selection is a manual gate.
  A failed result can select only the next alpha and requires a new `/plan`;
  final selection requires both passes and no accepted fix absent from the
  latest alpha.
- Planning approval must not be treated as packet, commit, external-action, or
  release approval.
