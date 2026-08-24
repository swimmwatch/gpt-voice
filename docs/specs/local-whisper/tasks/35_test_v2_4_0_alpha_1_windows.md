# 35 Test v2.4.0-alpha.1 on Windows

## Outcome

Run the bounded post-publication Windows alpha smoke against only
`v2.4.0-alpha.1` final-origin assets and seal one truthful immutable Windows
platform-smoke result/evidence index. A pass supplies Windows lineage evidence;
a valid test failure is preserved and blocks final. Perform no release
mutation, Linux test, feedback transition, or final work.

## Prerequisites

- Specification revision 26 and plan revision 34 are approved.
- Task 33 is complete: public prerelease `v2.4.0-alpha.1`, its immutable tag,
  complete physical public inventory, signed manifest/catalogs/keyring,
  final-origin records, and
  alpha `deploymentDigest` exist.
- The representative Windows x64 RTX 50 host is explicitly authorized and has
  a fresh task-owned application/runtime inventory plus private evidence root.
- Task 34 is not a prerequisite. The task receives no production
  signing/publication secret and no release write authority.

## Owned Requirements

- Windows slices of `CI-005`, `REL-001`, `REL-003`, `REL-004`,
  `QUAL-001`, `QUAL-004`, `QUAL-005`, `QUAL-006`, `QUAL-007`,
  `COMP-004`, `COMP-013`, and `OPS-004`.
- Windows slice of `AC-AUTO-082`.
- `AC-MAN-018`.

## In Scope

- Revalidate the alpha `deploymentDigest`, exact tag/prerelease state, public
  same-tag Windows NSIS installer, Windows CPU pack, Windows
  `sm_120a-real` pack, required public trust and verification assets, and
  pinned public Hugging Face `base/full` model identity before installation.
- Freeze one Windows `platformSmokeInputDigest` binding the public alpha
  deployment, exact assets, Windows x64 host class, CPU and representative RTX
  50 target, driver/runtime/device-proof class, deterministic non-private
  fixture, bounded algorithm/timeouts/cleanup, and privacy-safe tool identities.
- Start from a clean task-owned inventory and exercise, once per target:
  packaged installation and native prerequisites; exact runtime/model
  acquisition and validation; compatibility check; load/warm-up; one
  non-private deterministic transcription; unload; offline restart/reuse; and
  cleanup.
- Prove CPU initializes no GPU; RTX uses the selected physical device and no
  CPU/PTX/other-device fallback; the launcher/Job Object contains the worker
  tree; cleanup leaves no worker/listener/orphan or task-owned allocation.
- Seal one canonical Windows result and privacy-safe evidence index whether the
  smoke passes or truthfully fails.
- Scrub only task-owned temporary state after evidence sealing.

## Out Of Scope

- Linux execution or any dependency on Task 34's state.
- Building, signing, staging, uploading, publishing, deleting, retagging, or
  changing the public alpha or any release asset.
- Sealing `alphaAggregateDigest`, selecting feedback, planning alpha.2, or
  executing final.
- All-six-model FLEURS/direct-engine performance/resource/repetition or
  predecessor qualification. Those remain optional/nonblocking diagnostics.
- Private user recordings, personal inventory, ambient models/runtimes,
  support promotion, RTX 30/40, AMD, or macOS work.

## Task Contract

The test consumes public GitHub Release assets read-only. CI artifacts,
qualification-purpose packages, branch/raw/mirror URLs, another tag, mutable
redirect rules, or locally substituted binaries fail before installation. The
pinned Hugging Face model object is the only external content origin.

The Windows workflow is isolated from pull requests and forks, uses a manually
approved test host, and has no `contents: write`, signing, tag, release, or
publication permission. It never prints environment dumps, raw paths, device
identifiers, audio, transcripts, prompts, keys, private logs, or measurements.

The result is immutable after sealing. A changed input requires a new result
identity but never rewrites the public alpha. A genuine functional failure is
not retried until it passes and is not converted to `Pending`; it completes
the task with a failed result that forces the next-alpha path. Infrastructure
failure before a valid bounded attempt remains `Pending`.

## Contracts And Boundaries

- Task 35 binds only Windows. It neither reads nor writes the Linux
  platform-smoke result.
- The input graph points backward to Task 33's `deploymentDigest`; it contains
  no result or aggregate digest.
- The result/evidence graph contains no future feedback or final identity.
- The later feedback gate consumes Task 35 read-only and may not alter it.
- Public evidence is checksum-linked and privacy-safe; raw evidence remains in
  the authorized private task root only.

## Expected Files Or Components

- Windows post-release smoke workflow and least-privilege policy tests.
- Shared alpha-smoke schema/validator plus Windows host, installer,
  Authenticode/native dependency, launcher/Job Object, origin, CPU/RTX 50
  device-proof, offline-reuse, cleanup, and evidence adapters.
- Deterministic non-private fixture manifest and bounded test profile.
- Target-aware CLI/package command and fixtures for pass, functional failure,
  wrong origin, mixed alpha, fallback, orphan, privacy leak, and incomplete
  attempt.
- Acceptance ownership, `todo.md`, and `handoff.md`.

## Acceptance Criteria

- The Windows slice of `AC-AUTO-082` accepts only the exact public alpha.1
  Windows installer/CPU/`sm_120a-real` set and rejects missing deployment,
  prepublication, wrong-origin, cross-tag, cross-platform, cross-target,
  `sm_86`, `sm_89`, mixed-alpha, fallback, private, or incomplete evidence.
- `AC-MAN-018` executes the full bounded Section 19.2 Windows CPU and RTX 50
  flow and seals a truthful result.
- A pass records bounded Windows CPU/RTX 50 functional evidence only; it makes
  no per-model performance/resource claim and cannot substitute for Linux.
- A valid failure preserves the public alpha, blocks final, and permits only a
  future next-alpha transition.

## Verification

Implement/register the target-aware Windows command where absent:

```bash
rtk npm run test:local-whisper:qualification
rtk npm run test:local-whisper:release-lifecycle
rtk npm run verify:local-whisper:qualification:alpha -- --platform=win32 --target=v2.4.0-alpha.1
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check
```

The authorized physical run uses the same bounded command/profile against the
public final-origin assets. Do not run an all-six-model diagnostic as a
completion requirement.

## Failure And Rollback

- Invalid/missing public assets, wrong tag, unavailable authorized host,
  untrusted fixture/tool, unsafe private root, or inability to produce a valid
  bounded attempt leaves Task 35 pending.
- A valid failed result is immutable completion evidence, not a reason to
  mutate/retry alpha.1 until green. Feedback must select alpha.2 through a new
  plan.
- Clean only validated task-owned inventory, roots, processes, and
  allocations. Never delete shared caches, user data, public assets, or tags.
- Rollback of test tooling removes only Task 35 code/workflow changes and
  leaves Task 33's public alpha untouched.

## Manual Gates

- `MANUAL GATE`: authorize the representative Windows x64 RTX 50 host, public
  network access to exact alpha/Hugging Face assets, and private evidence root.
- `MANUAL GATE`: execute the bounded packaged CPU/RTX 50 smoke and review the
  sanitized result before sealing.
- Any commit, push, workflow dispatch, or access to a private test host requires
  separate authority. No merge, tag, upload, publication, or release authority
  is implied.

## References

- Mandatory: specification revision 26 Sections 9.6 steps 4–7, 18.4
  `CI-005`, 19.2, `AC-AUTO-082`, `AC-MAN-018`, and 22.1.
- Mandatory input: Task 33 handoff with exact alpha
  `deploymentDigest`/asset identities and the checked-in bounded fixture/profile.
- Optional background: Section 19.2 extended diagnostic contract; it is not a
  release gate.

## Completion And Handoff

Mark Task 35 complete after one valid immutable Windows result is sealed,
whether Pass or Fail. Update `todo.md` and `handoff.md` with privacy-safe
input, result, and evidence digests plus status. Stop before commit, Linux work,
aggregate sealing, feedback selection, alpha.2 planning, or final release.
