# Local Whisper Handoff

## Authoritative State

- Specification revision **21** is Approved.
- Plan revision **29** is Approved. Plan approval grants no packet execution or
  external-action authority.
- Tasks 01–20 and 23–25 are complete. Task 26 remains deferred and
  non-executable.
- Revision 29 supersedes Tasks 21, 22, and 27–31 and makes only Tasks
  32–35 executable in the order `32 → 33 → 34 → 35`.
- No alpha or final candidate, evidence root, branch, tag, GitHub Release,
  publication, support promotion, or release currently exists.

## Task 32 Local Progress

- The user explicitly authorized Task 32 only through the incremental-implementation invocation recorded as `execution.task-32-revision-29`.
- The stale plan-28 validator and implementation-readiness registry consumer now enforce specification revision 21, plan revision 29, all 35 packets, deferred Task 26, superseded Tasks 21/22/27–31, the four-packet executable sequence, 90 automated owners, and the explicit cross-task `AC-AUTO-091` lifecycle check.
- Focused verification passed: acceptance-ownership validation; implementation-readiness tests and verifier; hosted-toolchain tests and verifier; `test:types`; targeted Prettier; and `git diff --check` for the Task 32 local files.
- The authorized public acquisition verified the Microsoft VC Runtime installer against its existing 18,731,856-byte SHA-256 `843068991daaa1f73ad9f6239bce4d0f6a07a51f18c37ea2a867e9beca71295c` lock. Its versioned license page instead returned 245,273 bytes, SHA-256 `5604aff95a9f5ef0cdcd1e26fcc97afb54d36070ca148a163f0bea4d18952581`, rather than the locked 244,255-byte `3d82deb7524f289e804f40ed209b776832354096bc701dc620c819796b183db2`. The temporary files were removed; no observed replacement hash, lock update, candidate, or provenance claim was created.
- No candidate, hosted workflow run, signed artifact, private evidence, smoke result, branch, pull request, tag, GitHub Release, upload, publication, or support claim was created.

## Preserved Inputs

- Task 27 local hosted acquisition/materializer and network-boundary work is
  present in commits `429aadf3` and `1a672e61`; production locks, closed active
  profiles, and actual hosted preparation/build rows remain Task 32 gates.
- Linux and Windows native-quality jobs passed for `1a672e61`. Unrelated dirty
  Node/TypeScript CI work remains outside this specification bundle.
- Task 17 fixture digest remains
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- Representative hardware remains Linux RTX 50 and Windows RTX 5090. RTX 30/40
  remain excluded; AMD and macOS support boundaries are unchanged.

## Exact Next Packet

Task 32 `32_build_v2_4_0_alpha_1.md` remains incomplete and is the only packet
that may resume. It absorbs all unfinished hosted input/builder, release
preparation, protected signing, six-output alpha candidate, and bounded
two-platform alpha smoke work. Do not start Task 33.

## Blockers And Manual Gates

- The current Task 32 authorization excludes manual gates. Official input
  acquisition, immutable workflow source, hosted rows,
  protected reviewers, signing/legal/provenance inputs, physical Linux/Windows
  smoke or qualification, release branches/PRs, repository settings, commits,
  pushes, merges, tags, GitHub Release actions, publication, support promotion,
  and release each require their own authority.
- The existing Microsoft VC Runtime license lock is no longer reproducible from its exact official URL. Task 32 is blocked until an explicitly reviewed replacement license/provenance lock is supplied; the observed size and digest above are failure evidence only and must not be adopted automatically.
- Planning approval must not be treated as packet or external-action approval.
