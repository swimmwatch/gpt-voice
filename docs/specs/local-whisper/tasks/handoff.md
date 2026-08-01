# Handoff: Local Whisper Plan Revision 6 Approved

## Status

Approved plan revision 4 and completed Task 06 are committed as `9e65fea` and
`e294e8a`. Plan revision 6 is approved through `approval.plan` revision 6 after
the requested OpenWhispr reference review. It applies answered decision
`planning.worker-protocol-repair-ownership` revision 1 and extends Task 07
without renumbering downstream packets. Task 07 remains unchecked. Task 08,
commit, push, pull request, packaging, publication, and release are not
authorized.

## Completed Packets

- [01 Shared domain contracts](01_shared_domain_contracts.md), `d0083259`
- [02 Provider dispatch and cache](02_provider_dispatch_and_cache.md), `d516d034`
- [03 Trusted catalog, settings, and inventory](03_trusted_catalog_settings_and_inventory.md), `14749e88`
- [04 Managed filesystem safety](04_managed_filesystem_safety.md), `649ec3b9`
- [05 Streaming artifact lifecycle](05_streaming_artifact_lifecycle.md), `32440674`
- [06 Native C++ modularization](06_native_cpp_modularization.md), `e294e8a`

## Revision 5 Repair

- Task 07 now first owns the canonical shared worker protocol completion gate,
  including exact control/audio frame layouts, full handshake identity,
  distinct probe/load/warm-up/shutdown request/result pairs, legal sequencing,
  request-registry failure-stage attribution, and language-neutral version-1
  golden vectors.
- The same packet then owns the transport, supervisor, Windows/Linux launchers,
  deterministic conformance worker, privacy/deadline/cleanup behavior, and
  tests. Tasks 08/09 consume its shared contract and may not create private
  variants.
- Protocol version stays at 1 because no production peer/runtime has shipped.
  The incomplete Task 01 layout is replaced atomically with its tests/vectors.
- No Task 07 production source, native launcher, fixture, test, package script,
  dependency, or generated binary has been added.

## Revision 6 Reference Review

- Inspected user-supplied OpenWhispr application commit
  `bf8b7e0b4e1de0c9779c63f4752bd80bdd39ee2c` and OpenWhispr whisper.cpp fork
  commit `dd18d1107cf20feb58f11b2719d66a5bfeaff0dc`.
- Added a non-normative specification reference boundary and pinned source
  paths in Tasks 07/08. Reusable evidence is limited to persistent state
  ownership, serialized `whisper_context` lifecycle/abort/free, and separate
  CPU/CUDA/Vulkan build/packaging inputs.
- Explicitly rejected loopback HTTP/uploads, model/private argv and multipart
  transport, inherited environment, temporary audio conversion, raw/private
  logging, automatic GPU-to-CPU retry, mutable GitHub release lookup/shared
  bin, PID-file/`taskkill` cleanup, published binaries, and support claims.
- Completed Task 07's load contract with the structured shared residency
  identity and distinct cancel/target request IDs so Tasks 08/09 can consume
  the protocol without a private configuration dialect.

## Plan Validation

- Scoped Prettier: passed for the specification, decision ledger, plan, todo,
  handoff, and Tasks 07/08.
- Decision-ledger YAML parse: passed.
- Executability audit: 18 linked packets, all 14 required headings per packet,
  all 191 requirement/acceptance IDs mapped, and complete plan/todo links.
- `git diff --check`: passed.
- External reference review pinned exact commits and source paths; it did not
  import source, binaries, dependencies, support claims, or release evidence.

## Exact Continuation

- Review the approved revision 6 plan/reference diff. It remains uncommitted;
  this planning invocation does not authorize a commit.
- Resume Task 07 only through a new `incremental-implementation` invocation and
  a fresh execution authorization. The prior `execution.task-07` revision 1 was
  consumed by the feasibility checkpoint and does not cover the expanded
  packet.
- Do not commit the plan, implement Task 07, or start Task 08 in this planning
  invocation.
- Preserve the unrelated user-owned changes in
  `src/main/prettifyProfileChooserWindowController.ts`,
  `tests/main/mainProcessCompositionRoot.test.ts`, and
  `tests/main/prettifyProfileChooserWindowController.test.ts`.

## Deferred Platform Gate

Task 17 retains representative Windows 10/11 x64 Visual Studio 2022/MSVC
native/filesystem evidence for Task 06. Linux evidence cannot substitute and no
Windows support claim is made.
