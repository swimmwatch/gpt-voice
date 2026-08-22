# Local Whisper Handoff

## Authoritative State

- Specification revision **25** is Approved.
- Plan revision **33** is Approved. Plan approval grants no packet execution or
  external-action authority.
- Tasks 01–20 and 23–25 are complete. Task 26 remains deferred and
  non-executable.
- Revision 33 preserves five one-shot packets: Task 32 completes/proves the
  production pipeline without release state; Task 33 builds and deploys
  alpha.1; Tasks 34 and 35 independently test its public Linux/Windows assets;
  a feedback gate seals the aggregate; Task 36 conditionally releases final
  without physical final testing.
- No complete production candidate, alpha/final deployment, platform-smoke
  result, aggregate, lineage root, release branch, tag, GitHub Release,
  publication, support promotion, or release currently exists.

## Preserved Implementation Evidence

- Task 27 hosted acquisition/materializer and network-boundary work remains in
  commits `429aadf3` and `1a672e61`.
- Former Task 32 static task-registry, lifecycle-policy, candidate/staging/
  deployment identity, workflow-shape, and focused test work remains reusable
  but is superseded by specification 25, plan 33, and Tasks 32–36.
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
  that a nonexecution boundary cannot delete a later packet's capability.
- `plan.md`, `todo.md`, and this handoff separate pipeline completion from
  irreversible publication while requiring Task 32 to preserve the guarded
  default-off path that Task 33 enables for the real public alpha.
- Current executable packets are
  `32_complete_production_release_pipeline.md`,
  `33_release_v2_4_0_alpha_1.md`,
  `34_test_v2_4_0_alpha_1_linux.md`,
  `35_test_v2_4_0_alpha_1_windows.md`, and `36_release_v2_4_0.md`.
- Planning validation covers YAML/Markdown formatting, links, packet headings,
  identifier traceability, and whitespace. Revision 33 also corrects workflow
  code and regression policy; package versions, dependencies, and external
  release state remain unchanged.

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

Local checks passed: focused hosted-toolchain, CI-build, release-preparation,
release-candidate, release-policy/delivery/lifecycle, acceptance-ownership,
implementation-readiness, packaging, workflow, Windows-reporting, security
workflow, unit, type, lint (existing warnings only), formatting, production
audit, production build, and `git diff --check`.

The local Task 32 implementation is complete. Candidate verification hashes
large archives and installers with descriptor-bound streams and sequential
inventory admission, avoiding whole-candidate memory amplification on hosted
runners. No protected builder, signing operation, workflow dispatch, tag,
publication, or physical smoke was attempted.

Before Task 32 can be marked complete, separately authorize and run the
protected workflow on the selected GitHub-hosted Linux and Windows runners with
`publish=false`. It must construct, sign, assemble, and verify the real complete
candidate. Stop before Task 33 enables the preserved publication path for alpha
source/tag/publication work.

## Blockers And Manual Gates

- The sole Task 32 completion blocker is the separately authorized protected
  `publish=false` run. It must confirm the pinned Ubuntu package, CUDA license
  files, MSVC 14.39 component, exact CMake/Ninja/CUDA/profile identities, and
  the real Windows CPU/CUDA capture. Do not replace a failed locked identity
  with an observed value merely to make the workflow pass.
- `local-whisper-production` now requires an approval from the sole maintainer
  and forbids admin bypass. Add a second reviewed collaborator and enable
  self-review prevention before any higher-assurance release process; this is
  not currently possible with only `swimmwatch` in the repository.
- Pushes, release-branch/pull-request work, workflow dispatch, repository
  settings, signing, preserving merge, tag, GitHub Release actions, uploads,
  publication, physical tests, feedback selection, support promotion, and
  release remain manual gates and have not been performed.
- Task 34 requires an authorized Linux RTX 50 host. Task 35 requires an
  authorized Windows RTX 50 host. Both consume only public same-tag alpha
  assets and keep private evidence outside the repository.
- A failed alpha smoke permits only a new sequential alpha planning iteration;
  final selection requires both passes and no accepted fix absent from the
  latest tested alpha.
