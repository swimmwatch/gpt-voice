# Task 25: RTX 50 Readiness Closure

## Outcome

Close the remaining cross-platform RTX 50-only inventory, applicability,
catalog, migration, and renderer-projection gaps on the completed Tasks
19/23/24 source. Leave one clean implementation-ready source identity for
hosted production-equivalent builders without freezing a release candidate or
creating Linux, Windows, or aggregate qualification evidence.

## Prerequisites

- Specification revision 20 and plan revision 26 are approved.
- Tasks 01–20, 23, and 24 are complete and committed; Task 26 is deferred and
  supplies no dependency or evidence.
- No `candidateInputDigest`, signed candidate set, platform branch, aggregate
  root, production secret, upload, tag, or release exists.
- Separate Task 25 execution authorization is recorded.

## Owned Requirements

- `CAP-018`, `COMP-013`, `DIST-003`, `PRIV-006`, `RUNTIME-005`, `UI-010`,
  `VAL-004`, `QUAL-005`–`QUAL-006`, and `OPS-004` implementation-readiness
  slices.
- Primary `AC-AUTO-078`, `AC-AUTO-079`, and `AC-AUTO-081`.
- Negative RTX 30/40 and unsupported-target behavior retained by revision 20.

## In Scope

- Add one main-owned bounded shell-free NVIDIA pre-install inventory boundary
  for Linux and Windows using existing platform adapter ownership.
- Resolve applicability from platform, architecture, selected physical device,
  driver, compute target, and stable resource prerequisites before exposing an
  explicit CUDA runtime action.
- Limit active authenticated production/qualification catalogs, runtime keys,
  settings migration, and renderer projection to one `sm_120a-real` CUDA row
  per supported platform plus the independent CPU path.
- Preserve incompatible saved selections as selected-but-unavailable without
  download, rewrite, fallback, launch, or qualification authority.
- Add deterministic fixtures for absent, stale, malformed, duplicate,
  ambiguous, spoofed-name, mixed-device, cross-platform, `sm_86`, `sm_89`, and
  every unlisted target.
- Add the two registered Task 25 commands and reconcile documentation and
  implementation-readiness checks affected by the narrowed catalog.

## Out Of Scope

- Hosted CI workflow/build-matrix delivery owned by Task 27.
- Production keys, native installer signing, release manifest, final candidate
  freeze, or candidate artifacts owned by Task 28.
- Linux or Windows representative qualification owned by Tasks 29 and 21.
- RTX 30/40 implementation, Task 26 execution, AMD promotion, macOS execution,
  commit, push, PR, upload, publication, support promotion, tag, or release.

## Task Contract

Main is the only authority that may obtain raw hardware records or decide
runtime applicability. Inventory adapters must use exact executable/API paths,
bounded output, no shell expansion, strict time/size/count limits, and typed
failure. Raw UUID, PCI topology, serial, driver output, paths, argv, or command
text never crosses IPC or enters routine diagnostics.

The resolver returns at most the exact platform `sm_120a-real` runtime for a
supported RTX 50 device. Zero, multiple, stale, malformed, driver-incompatible,
cross-platform, or unsupported matches produce a safe unavailable reason and
no transfer action. CPU remains independently explicit. There is no PTX JIT,
runtime/backend/device/model substitution, automatic download, selection
rewrite, or fallback.

Migration is idempotent and side-effect free. A valid existing `sm_120a`
selection is preserved; a legacy or forged `sm_86`/`sm_89` selection remains
visible but unavailable. Renderer snapshots contain only suitable actions,
opaque device identities, bounded resource facts, and localized safe reasons.

## Contracts And Boundaries

- Reuse existing settings, catalog, capability, inventory, IPC, and renderer
  contracts; do not create a second hardware or artifact authority.
- Production and qualification catalogs remain purpose-isolated and signed.
- Task 25 changes source only before candidate freeze. Task 27 consumes the
  clean result and may not repair this behavior inside build evidence.
- Task 26 remains deferred and has no active requirement or verification
  command.

## Expected Files Or Components

- Existing main Local Whisper inventory/capability/catalog/settings adapters
  and their Linux/Windows implementations.
- Existing renderer-safe Local Whisper projection and focused tests.
- Catalog/runtime/profile fixtures and migration tests.
- `package.json`, Task 25 verification scripts, `todo.md`, and `handoff.md`.

## Acceptance Criteria

- `AC-AUTO-078`, `AC-AUTO-079`, and `AC-AUTO-081` pass on deterministic Linux
  and Windows fixtures.
- Only the matching RTX 50 runtime action is exposed; RTX 30/40 and every
  unsupported target fail closed before transfer or process launch.
- No raw hardware identity, command output, path, URL, or renderer-selected
  authority crosses IPC.
- All existing CPU, explicit-download, no-fallback, provider, privacy, and
  migration behavior remains compatible.
- No candidate or qualification identity is created.

## Verification

```bash
rtk npm run test:local-whisper:rtx50-applicability
rtk npm run verify:local-whisper:rtx50-readiness
rtk npm run test:local-whisper:catalog
rtk npm run test:local-whisper:capability
rtk npm run test:local-whisper:migration
rtk npm run test:local-whisper:ipc
rtk npm run test:local-whisper:ui
rtk npm run verify:local-whisper:implementation-readiness
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check
```

Registered commands:

```bash
rtk npm run test:local-whisper:rtx50-applicability
rtk npm run verify:local-whisper:rtx50-readiness
```

## Failure And Rollback

- Keep Task 25 incomplete on any ambiguous or unsupported match that exposes an
  action, any raw identity leak, migration rewrite, fallback, or regression.
- Revert only Task 25 source/tests as one pre-freeze unit; preserve completed
  Tasks 01–24 and all user data.
- Do not work around a failed adapter by relaxing validation or hiding an
  applicable error.

## Manual Gates

- No physical GPU is required for deterministic Task 25 completion; optional
  host observation is diagnostic only and creates no qualification evidence.
- Commit, push, PR, hardware qualification, production secrets, signing,
  upload, publication, support promotion, tag, and release require separate
  authorization.

## References

- Specification revision 20 Sections 3.2, 6, 7.4, 8.2, 9.1, 12.1, 18.4,
  19.1, and 22.
- Completed Tasks 19, 23, and 24 handoffs and existing Local Whisper platform
  adapter precedents.

## Completion And Handoff

After verification, mark only Task 25 complete and update `todo.md` and
`handoff.md` with changed components and exact checks. Hand off the clean
implementation-ready source to Task 27. Stop before commit, Task 27, candidate
freeze, signing, hardware use, or external action.
