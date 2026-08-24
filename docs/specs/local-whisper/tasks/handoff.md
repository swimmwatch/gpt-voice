# Local Whisper Handoff

## Authoritative State

- Specification revision **26** is Approved.
- Plan revision **34** is Approved. Plan approval grants no live process or
  external-action authority.
- Tasks 01–20 and 23–25 are complete. Task 26 remains deferred and
  non-executable.
- Revision 34 preserves Tasks 32–36 while allowing one exact future
  `local-whisper-alpha-release` Watch to cross the Task 32/33 boundary. It uses
  one six-hour deadline, one version-scoped authority, and one exact
  prior-candidate promotion without rebuilding. Tasks 34 and 35 remain
  independent later consumers of the public alpha; the feedback gate and Task
  36 remain unchanged.
- No complete production candidate, alpha/final deployment, platform-smoke
  result, aggregate, lineage root, release branch, tag, GitHub Release,
  publication, support promotion, or release currently exists.

## Preserved Implementation Evidence

- Task 27 hosted acquisition/materializer and network-boundary work remains in
  commits `429aadf3` and `1a672e61`.
- Former Task 32 static task-registry, lifecycle-policy, candidate/staging/
  deployment identity, workflow-shape, and focused test work remains reusable
but is superseded by specification 26, plan 34, and Tasks 32–36.
- `.github/workflows/release-builds.yml` still prepares Local Whisper with
  production-only packaging now, constructs deterministic Linux/Windows CPU
  and RTX 50 runtime candidate bytes from independently built stages, and
  verifies an exact signature-bound private inventory. It preserves one
  default-off publication job for Task 33; Task 32 cannot invoke it, candidate
  jobs remain read-only, and no tag, GitHub Release, upload, or publication has
  occurred. The `local-whisper-production` GitHub Environment exists with a
  required `swimmwatch` approval and admin-bypass disabled. The repository has
  no other collaborator, so self-review remains enabled. A dedicated Ed25519
  production signer is configured there: the private PEM exists only as an
  Environment secret, while its key ID and public PEM are Environment
  variables. The private secret is available only to the three approved
  signing jobs (`verify-production-signing-authority`,
  `produce-production-bundles`, and `verify-production-candidate`); it is not
  forwarded through artifacts, outputs, repository files, or logs.
- `package.json` remains version `1.4.0`; no alpha release preparation or
  publication has occurred.
- The Microsoft VC Runtime installer and versioned license URL retain their
  existing locks. The historical transient license response mismatch is not a
  replacement hash.
- Task 17 fixture digest remains
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.

## Planning Revision Changes

- `spec.md` and `decisions.yaml` define the complete physical same-tag
  inventory, reject static/disabled/qualification-only substitutes, and state
  that a nonexecution boundary cannot delete a later packet's capability. They
  now also define the exact alpha.1 Watch authority, shared deadline,
  prepublication repair, prior-run candidate reuse, and post-publication block.
- `plan.md`, `todo.md`, and this handoff separate pipeline completion from
  irreversible publication while requiring Task 32 to preserve the guarded
  default-off path that Task 33 enables for the real public alpha.
- Current executable packets are
  `32_complete_production_release_pipeline.md`,
  `33_release_v2_4_0_alpha_1.md`,
  `34_test_v2_4_0_alpha_1_linux.md`,
  `35_test_v2_4_0_alpha_1_windows.md`, and `36_release_v2_4_0.md`.
- Planning validation covers YAML/Markdown formatting, links, packet headings,
  identifier traceability, and whitespace. Revision 34 adds the unlaunched
  class-based release Watch scenario and protected promotion policy; package
  versions, dependencies, and external release state remain unchanged.

## Exact Next Packet

Task 32 `32_complete_production_release_pipeline.md` remains the only
executable packet. Its local implementation is complete:

- revision-25/plan-33 ownership/readiness migration;
- a fail-closed production-only release-collection guard and collector;
- exact 16-class/32-file physical inventory and signature-binding validation, including all four
  platform runtime variants and catalog, keyring, checksum, manifest, SBOM,
  notice, provenance, and compatibility records;
- deterministic two-clean-stage production runtime archive construction and
  a hosted-runner collector that revalidates the two pack records and bytes
  before admitting canonical production archive names, plus a byte-level
  private candidate inventory verifier;
- protected Linux/Windows candidate wiring with publication disabled by
  default, plus one verified-candidate-dependent Task 33 publication job and
  workflow/security regression coverage.

GitHub-hosted `ubuntu-24.04` and `windows-2025` are the selected builders.
The workflow no longer accepts the external CPU/CUDA stage-directory
variables. Each platform provisions the locked native sources, performs both
network-denied builds in the ephemeral runner workspace, and transfers only
the reverified archive output through private Actions artifacts. A protected
preflight job validates the configured signing key pair before either platform
build starts. Windows activates MSVC 14.51 before CPU construction, then MSVC
14.39 before CUDA construction; policy tests fail if that order or mapping
changes.

Latest local checks passed: release policy/delivery/lifecycle,
acceptance-ownership, implementation-readiness (7/7), task-plan structure (36
packets and 90 unique automated owners), workflow and supply-chain policy,
Windows-reporting, security workflow, full Node.js unit tests (2,522 passed, 2
skipped), Node.js 22/24 Watch compatibility (135/135 on each runtime), types,
lint (0 errors), formatting, production build, post-build renderer verification,
and `git diff --check`. The final alpha-release bundle digest is
`d5d8929eb7476a2ef0604332ac5923ea439963f9685daa862336f0f45c8be560`.

Four protected nonpublishing attempts ran and none has produced a candidate:

- Run `32590116895` stopped before protected access because the supplied
  private label was invalid (`task-32-…`; the strict private format is
  `task32-…`). No signing or builder job started.
- Run `32590192198` passed source-input and protected Ed25519 preflight. Linux
  installed the pinned CUDA 12.8.1 toolkit and the pinned
  `libnvidia-compute-595=595.84-0ubuntu0.24.04.1`, then failed because
  `lukka/get-cmake` exposes CMake/Ninja directories while the linker required
  executable paths. The run was cancelled before any runtime archive,
  application package, bundle, candidate, tag, release, or publication.
- Run `32591002895` ran against source
  `d093bb0415c49957695ee89ad2d88df3254e23f9`; input validation and protected
  Ed25519 preflight passed. Linux completed CMake/Ninja, CUDA 12.8.1, NVIDIA
  driver user-space, and source provisioning but rejected the absent
  `.cache/local-whisper/toolchains/ninja-1.12.1/COPYING` during deterministic
  construction. Windows completed MSVC 14.39 installation, CMake/Ninja, CUDA
  12.8.1, and MSVC 14.51 initialization but rejected the absent locked VC
  Runtime license before materialization. No archive, application package,
  bundle, candidate, tag, release, or publication was created.
- Run `32594163793` uses source
  `b78fb076481984433faa20cf54c856144de6f1b6`. Input validation and protected
  signing preflight passed. Linux successfully provisioned the canonical Ninja
  license and native sources, then Ubuntu 24.04 AppArmor rejected
  `unshare -Urn` while writing `/proc/self/uid_map`. The Windows builder remains
  independent and was still provisioning CUDA when this handoff was updated.
  The uncommitted repair enables the exact user-network namespace only on the
  ephemeral hosted runner, proves `unshare -Urn`, and restores the AppArmor
  restriction with an `always()` step before artifact upload.

Commit `d093bb04` resolves the documented action-output directories in
`scripts/local-whisper/native-build/link-hosted-production-toolchain.mjs`
to their exact expected executables before retaining name, regular-file, and
version checks. Its regression test is in
`tests/runtime/localWhisper/hostedToolchains/HostedProductionToolchainLinker.test.mjs`.
The uncommitted repair adds one bounded verified raw-file materializer and
dedicated Ninja/VC Runtime license provisioners. The production workflow now
fetches only exact reviewed HTTPS origins before disconnected construction;
redirects, unsafe destinations, failed downloads, changed sizes, and changed
SHA-256 bytes fail closed. Ninja is copied into a task-owned directory so its
commit-pinned `COPYING` can be materialized without trusting a symlink parent.
The canonical Ninja source is commit
`2daa09ba270b0a43e1929d29b073348aa985dfaa`, size `11358`, SHA-256
`eb7e9ab9690124c5c9f42bdc81383d886a3dede26345b6ed15bbad7caf81f7ea`.
The historical locked bytes were the same source with one extra terminal LF;
all three Linux profiles and qualification evidence were regenerated through
real network-isolated CPU, CUDA, and sanitizer builds rather than edited as
synthetic evidence. Hosted-toolchain and release-policy tests require both
provisioners.
Candidate verification still hashes large archives and installers with
descriptor-bound streams and sequential inventory admission, avoiding
whole-candidate memory amplification on hosted runners.

The current uncommitted revision adds schema `1.1.0` version-scoped Watch
authority, the `local-whisper-alpha-release` scenario, and a separate
class-based Node.js orchestrator. The release workflow now builds a versioned
candidate with `publish=false`; promotion names that prior run, skips the
construction graph, downloads the same private artifacts, retains protected
tag generation, streams public final-origin verification, and preserves
deployment evidence. Contract/unit tests cover ordinary-scenario denial,
binding forgery, multiple repairs, source invalidation, remote operation
reconciliation, shared deadline, authentication failure, preserving ancestry,
partial publication, and no Task 34/35 action. No Watch or release was launched.

Before Task 32 can be marked complete, commit and push the hosted-runner
namespace repair, then run the protected workflow on the selected GitHub-hosted
Linux and Windows runners with `publish=false`. The future exact
`local-whisper-alpha-release` invocation may own that dispatch, repair failures,
record Task 32 completion, and continue through Task 33 publication within its
remaining six-hour budget. Without that invocation, ordinary packet boundaries
and separate external gates still apply.

## Blockers And Manual Gates

- The immediate blocker is the pending namespace-repair commit/push and protected
  `publish=false` rerun. The current local repair is verified; no production
  candidate has yet been constructed from it.
- `local-whisper-production` now requires an approval from the sole maintainer
  and forbids admin bypass. Add a second reviewed collaborator and enable
  self-review prevention before any higher-assurance release process; this is
  not currently possible with only `swimmwatch` in the repository.
- The existing Task 32 commits and nonpublishing workflow runs above remain
  historical authorized evidence. This implementation does not launch the new
  Watch or grant external release state by itself. A later exact
  `$watch-process scenario=local-whisper-alpha-release timeout=6h` invocation
  grants only the version-scoped Task 32/33 sequence. Repository settings,
  destructive history, deploy, physical tests, feedback selection, support
  promotion, and every other release remain separate or forbidden. No tag,
  GitHub Release, public upload, publication, or physical platform test has
  been performed.
- Task 34 requires an authorized Linux RTX 50 host. Task 35 requires an
  authorized Windows RTX 50 host. Both consume only public same-tag alpha
  assets and keep private evidence outside the repository.
- A failed alpha smoke permits only a new sequential alpha planning iteration;
  final selection requires both passes and no accepted fix absent from the
  latest tested alpha.
