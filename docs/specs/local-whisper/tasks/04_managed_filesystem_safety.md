# 04 Managed Filesystem Safety

## Outcome

Windows and Linux receive one main-owned managed-storage boundary that resolves
the fixed non-roaming Local Whisper root and performs staging, verification,
promotion, locking, quarantine, manifest-owned deletion, and runtime-path
leasing through stable descriptor/handle-backed identities. Symlinks, hard
links, junctions, reparse points, volume/mount changes, rename races, unknown
entries, and duplicate application instances cannot escape or broaden an
operation.

## Prerequisites

- The Local Whisper plan is approved and Task 04 has separate execution
  authorization.
- Tasks 01 and 03 are complete:
  - Task 01 supplies canonical immutable artifact IDs and safe failures;
  - Task 03 supplies authenticated catalog/manifests and the inventory
    evidence port.
- `docs/specs/local-whisper/spec.md` remains `Status: Approved`.
- This packet begins with the platform-adapter feasibility design and available
  Linux proof below. Node's high-level path APIs are not presumed sufficient
  for Linux `openat2` or Windows reparse/file-ID guarantees; representative
  Windows execution is deferred to Task 20.
- macOS remains a typed path-resolver skeleton only and must not create or
  populate executable Local Whisper storage in this release.

## Owned Requirements

- `MODEL-006`, `SEC-004`, `SEC-007`, and filesystem portions of `RUN-004`
- Managed-removal portions of `MODEL-008`, `VRAM-003`, `FAIL-001`,
  `RUNTIME-004`, and `FAIL-004`
- Per-artifact cross-instance locking and anchored-identity portions of
  Sections 12.2, 13.2–13.3, and 14
- `AC-AUTO-041`
- Filesystem portions of `AC-AUTO-017`, `AC-AUTO-018`, `AC-AUTO-019`,
  `AC-AUTO-020`, `AC-AUTO-023`, `AC-AUTO-038`, and `AC-AUTO-040`

## In Scope

- Fixed Windows/Linux non-roaming root resolution and private directory/file
  creation.
- Platform-specific no-follow, beneath-root, same-volume/mount, stable-identity
  adapters.
- Immutable runtime/model/staging/quarantine namespaces and path derivation
  only from authenticated artifact IDs.
- Cross-process per-artifact locks with safe stale-owner classification.
- Descriptor/handle-backed read/verification and runtime spawn/load leases.
- Same-filesystem atomic promotion and exact-directory quarantine.
- Manifest-owned deletion that refuses unknown or identity-swapped entries.
- Race/adversarial tests on temporary synthetic roots.

## Out Of Scope

- HTTP transport, transfer queues, resume policy, hashing worker orchestration,
  or archive decoding; Task 05 owns those workflows.
- Catalog signing/settings persistence, hardware probing, worker protocol,
  inference, coordinator unload decisions, IPC, UI, or provider registration.
- Killing/adopting a process, Job Objects, Linux parent-death supervision, or
  worker termination; Task 07 owns process-tree semantics.
- Custom/imported paths, user-selected directories, removable-volume
  migration, secure SSD erasure, broad repair cleanup, or elevated service.
- Production artifact bytes or destructive tests against a user's real data
  root.

## Task Contract

### Mandatory platform feasibility checkpoint

1. Before implementing product-facing storage methods, establish a narrow
   adapter design that can enforce the complete contract on supported Windows
   x64 and Linux x64. Prove it through real Linux execution and Windows
   implementation/source-contract fixtures in this packet; Task 20 owns the
   representative Windows execution proof. Coverage includes open/create,
   component traversal, identity capture, rename/promotion, quarantine, exact
   unlink, lock ownership, and a held lease across check/use. Record the OS
   primitives and race guarantees in tests and source comments.
2. Linux must use descriptor-relative operations rooted at an already opened
   managed directory. Prefer `openat2` with the equivalent of
   `RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS | RESOLVE_NO_MAGICLINKS | RESOLVE_NO_XDEV`,
   no-follow opens, and `fstat` device/inode/type checks. A fallback is allowed
   only if it proves equivalent component-by-component semantics while parent
   descriptors remain open; `realpath`, `lstat`, or string-prefix checking
   followed by ordinary path I/O is not equivalent.
3. Windows must open each managed component using handle-relative/reparse-aware
   semantics, reject every unexpected reparse tag/junction, capture volume and
   file identity, prevent unexpected volume transitions, and hold handles
   through the protected operation. String normalization, `fs.realpath`, or a
   final-path comparison followed by a new unchecked path open is not enough.
4. If Node/Electron APIs cannot provide those guarantees, implement a minimal
   reviewed in-repository native adapter/helper with a narrow typed protocol
   and deterministic build/test entry point. Do not invoke a shell, general
   system utility, privileged/elevated service, or unreviewed third-party
   binary. A new external dependency requires its own explicit approval.
5. If implementation or source-contract review shows that neither direct
   bindings nor the reviewed helper can meet the contract on either platform,
   stop the packet and return to `/plan`. An unavailable representative
   Windows host defers execution to Task 20 and is not such a design failure.
   Do not weaken the approved requirements or mark the platform qualified based
   on mocked tests.

### Roots, layout, and authority

1. Resolve exactly one per-user non-roaming root in main:
   - Windows:
     `%LOCALAPPDATA%/<canonical-app-id>/local-whisper`;
   - Linux:
     `${XDG_DATA_HOME:-$HOME/.local/share}/<canonical-app-id>/local-whisper`.
     The canonical app ID is an application-owned constant, not a renderer or
     environment-provided path fragment. Reject an empty, relative, root-level,
     foreign-volume, or otherwise unprovable base.
2. The root contains separate `runtimes`, `models`, `staging`, `quarantine`,
   and lock namespaces. Runtime/model final directories are derived from an
   encoded canonical identity whose path segments are generated internally;
   no catalog string becomes a raw path segment without strict canonical
   encoding/round-trip validation.
3. Create directories/files owner-private: POSIX directories `0700`, files
   `0600` unless a verified executable needs the minimum reviewed execute bit;
   Windows uses current-user-only ACL intent without elevation. Reject a root
   or component with broader/unexpected ownership, type, reparse, mount, or
   volume identity rather than silently repairing it.
4. Expose only an opaque root handle/service and sanitized label/relative
   display data to other layers. Never put the absolute path or username in a
   renderer snapshot, settings file, routine log, or typed failure.
5. A macOS resolver may return typed Planned/unavailable metadata, but it does
   not create the root or accept a storage operation.

### Stable identities and locks

1. Represent every opened managed directory/file with a non-serializable
   main-owned lease containing its authenticated artifact ID, root-relative
   canonical name, platform file identity, volume/device identity, type,
   expected catalog digest, and held descriptor/handle lifetime. Renderer and
   worker messages never create such a lease.
2. Revalidate identity immediately before verification, promotion,
   quarantine, deletion, and process spawn/load handoff. If any file ID,
   directory ID, volume/device, type, link count, parent identity, size, mode,
   or expected digest evidence changed, close the lease and fail safely. Do
   not retry through a new path automatically.
3. Reject manifest files with unexpected hard-link count or identity shared
   outside the exact managed artifact. Reject Unix symlinks, magic links,
   FIFOs, sockets, devices, mount crossings, and Windows reparse
   points/junctions at every component and entry.
4. Acquire a cross-process lock per exact immutable artifact before staging,
   verification, promotion, integrity check, load lease, quarantine, or
   deletion. Lock creation/acquisition is atomic. Losing instances return a
   typed conflict; the same artifact is never promoted/deleted/loaded
   concurrently, while unrelated artifacts remain independent.
5. Lock metadata includes app-instance nonce, PID, OS process start identity,
   operation kind, and artifact ID. A PID alone never proves ownership.
   Recovery may declare a lock stale only after the full owner identity is
   absent/mismatched; it never kills the recorded PID. A malformed or
   unverifiable lock fails closed until safe recovery/manual guidance.

### Staging, promotion, and inventory evidence

1. Create a unique staging directory under `staging` on the same filesystem as
   the final namespace while holding the artifact lock. The returned staging
   lease, not a string path, is the only authority Task 05 may use.
2. All staged entry creation is descriptor/handle-relative and no-follow.
   Refuse absolute names, `..`, alternate data streams, reserved/ambiguous
   names, duplicate/case-fold-colliding names, unexpected separators, and any
   entry not declared by the authenticated expected-file manifest.
3. Promotion requires a completely verified staging tree, absent final
   immutable identity directory, unchanged root/parent/staging identities, and
   same-filesystem atomic rename. Never overwrite or merge an installed
   revision. A failed promotion leaves an older revision untouched and
   staging non-executable.
4. Produce inventory evidence only from the authenticated manifest plus held
   identity checks. Unknown directories/entries remain unmanaged evidence and
   cannot become `Installed`, executable, loadable, or deletable.
5. Runtime executable/library leases preserve enough identity evidence for
   Task 07 to revalidate immediately before spawn and for the handshake digest
   comparison. Model-file leases preserve enough evidence for full hash before
   first load in each process.

### Quarantine and exact deletion

1. Destructive removal accepts an authenticated artifact identity and
   manifest plus a coordinator-issued clearance that no conflicting use or
   resident worker remains. This storage layer does not decide when to unload.
2. While holding the exact artifact lock and stable parent/artifact handles,
   atomically rename the immutable identity directory into a unique app-owned
   quarantine directory on the same filesystem. A failed or identity-changed
   quarantine is `DELETE_FAILED`; do not fall back to recursive path deletion.
3. Delete only manifest-owned regular files/directories through anchored
   relative handles, checking identity/type/link/volume before each removal.
   Do not follow links and do not use a broad recursive delete primitive.
4. An unexpected entry, non-empty undeclared directory, identity swap,
   junction/reparse point, hard link, mount/volume change, or unlink failure
   stops removal. Keep the quarantine and exact revision unusable, return a
   sanitized `DELETE_FAILED`, and let inventory reconstruct it. Never broaden
   cleanup to the root, sibling revisions, or unknown files.
5. Only a completely emptied, still-proven quarantine directory may be
   removed. Ordinary unlinking is not secure erasure and no recovery guarantee
   is made.

## Contracts And Boundaries

- This adapter is the only component allowed to turn catalog identities into
  large-artifact filesystem authority. Task 03 supplies authenticated data;
  Tasks 05, 07, and 11 consume leases, not arbitrary paths. Task 06 may
  modularize this helper only while preserving the same lease contract.
- Validation and use must share a held OS identity. A check-then-use design
  that closes the descriptor/handle and later reopens by path violates this
  packet.
- Do not reuse diagnostics archive traversal: its trust/lifecycle and
  unbounded drain behavior do not meet large-artifact or destructive safety.
- Do not use `rm -rf`, `fs.rm(..., { recursive: true })`, shell deletion,
  path-prefix-only containment, PID-only stale-lock cleanup, or permissive
  repair behavior.
- All failure results expose safe codes, logical artifact identity, and state
  only. Native paths, usernames, file IDs, volume serials, ACL text, and
  exception messages remain private.
- Stateful adapters are constructed by the main-process composition root; no
  mutable module-level storage manager or lock registry.

## Expected Files Or Components

- Main modules under `src/main/localWhisper/filesystem/`, expected to include:
  - `ManagedArtifactStore.ts`;
  - `ManagedArtifactPathResolver.ts`;
  - `ManagedArtifactLockRepository.ts`;
  - `ManagedArtifactLease.ts`;
  - `LinuxManagedFilesystemAdapter.ts`;
  - `WindowsManagedFilesystemAdapter.ts`;
  - a Planned-only macOS resolver skeleton.
- If the feasibility checkpoint requires native code, a minimal owned helper
  under `runtime/local-whisper/fs-guard/` plus deterministic build/verification
  scripts under `scripts/local-whisper/`. Generated helper binaries remain
  ignored local artifacts; Task 15 later owns packaging.
- Tests under `tests/main/localWhisper/filesystem/`, including platform
  contract fakes, temporary-root integration tests, lock races, identity-swap
  hooks, and exact-deletion fixtures.
- Expected package scripts:
  - `test:local-whisper:filesystem` always runs the adapter contract;
  - `verify:local-whisper:filesystem` always records the platform feasibility
    proof and additionally verifies a native helper when one is required;
  - `build:local-whisper:fs-guard` is added only when owned native helper
    source is required.

## Acceptance Criteria

- Root resolution yields the exact non-roaming Windows/Linux layout and never
  accepts renderer/catalog/user path authority; macOS creates nothing.
- The available Linux feasibility suite and Windows source-contract coverage
  prove the designed held-identity no-follow behavior. Representative Windows
  execution remains a mandatory Task 20 release gate; high-level path/string
  checks alone cannot satisfy either platform contract.
- Synthetic symlink, hard-link, junction/reparse, mount/volume, case/alternate
  name, rename, parent-swap, and file-ID races all fail before execution or
  out-of-scope deletion (`AC-AUTO-041`).
- Two app instances cannot promote, delete, verify, or lease the same artifact
  concurrently; stale-lock recovery never kills or trusts a reused PID
  (`AC-AUTO-023`, filesystem portion of `AC-AUTO-040`).
- Only a fully verified staging identity atomically promotes. Unknown or
  partial staging never appears installed; prior immutable revisions remain
  unchanged.
- Selected/unselected/corrupt/blocked managed revisions can target only their
  exact proven identity. Missing, unknown, or unprovable data cannot trigger
  deletion (`AC-AUTO-019`, `020`, and `038` filesystem portions).
- Partial deletion leaves a quarantined unusable revision and exact safe
  failure without broad cleanup or fallback.
- No test touches the real Local Whisper data root or promises secure erasure.

## Verification

Run all destructive/race tests against a freshly created temporary root only:

```text
rtk npm run test:local-whisper:filesystem
rtk node --import tsx --test tests/main/localWhisper/filesystem/*.test.ts
rtk npm run verify:local-whisper:filesystem -- --fixture
rtk npm run typecheck
rtk npm run test:types
rtk npm run test:unit
rtk lint
rtk prettier --check
```

On Linux, run the real adapter contract on the supported kernel/filesystem in
addition to fakes and record kernel/filesystem details. Keep the Windows suite
checked in and deterministic/source-contract coverage green, but execute the
real suite only in Task 20 on representative Windows x64. Linux, mocks, Wine,
source inspection, or a cross-build cannot substitute for that final gate.

## Failure And Rollback

- Failure to prove the available Linux descriptor semantics or a discovered
  Windows design/source-contract defect blocks the packet. Unavailable real
  Windows execution is deferred to Task 20; a later failure there returns the
  defect to an authorized Task 04/06 repair. Do not silently downgrade to
  `realpath`, `lstat`, string containment, or recursive deletion.
- An unreviewed native dependency, elevated helper, driver, service, or
  installer change is not an implementation workaround and requires explicit
  authorization.
- A failed promotion/quarantine/deletion never overwrites an installed
  revision or expands its target. Preserve exact staging/quarantine evidence
  for safe inventory/manual recovery.
- Rollback removes only Task 04 adapters, tests, and locally generated helper
  outputs. Do not remove real settings/artifacts or invoke cleanup against a
  user's managed root.

## Manual Gates

- `MANUAL GATE — Windows handle semantics (Task 20 only)`: Task 20 runs and
  reviews the real Windows x64 reparse/junction/file-ID/volume/lock race suite
  before any Windows qualification or release claim. It is not a Task 04
  completion gate; mocked or Wine-only evidence is insufficient.
- `MANUAL GATE — Linux kernel/filesystem semantics`: review the real supported
  Linux `openat2`/descriptor-relative test result and any minimum kernel/filesystem
  prerequisite before release qualification.
- `MANUAL GATE — native dependency/helper`: adding an external native module,
  prebuilt binary, elevated component, or new packaging target requires
  separate approval and later redistribution review.
- `MANUAL GATE — real artifact removal`: the exact-delete slice of
  `AC-MAN-007` remains a Task 20 integration gate using a real allowlisted
  origin and coordinator unload; Task 04 temporary-root evidence cannot close
  it.
- Do not run destructive tests outside a validated temporary directory. No
  commit, push, publication, or Task 05 execution is authorized.

## References

- Mandatory task-local specification sections:
  - `../spec.md` Sections 9.1–9.2, 10.2, 12.2, 13.2–14, 15, 16, 17.2,
    and 19.1;
  - `../decisions.yaml` entries `models.storage-policy`,
    `models.delete-policy`, `operations.runtime-removal`, and
    `operations.concurrency-policy`.
- Dependency contracts:
  - `01_shared_domain_contracts.md`;
  - `03_trusted_catalog_settings_and_inventory.md`.
- Local constraints/precedents:
  - `src/main/config.ts` currently resolves roaming configuration paths and is
    not the large-artifact root;
  - `src/main/providers/claudeWebSettings.ts` demonstrates private modes but
    not anchored large-artifact operations;
  - `src/main/services/diagnosticsArchive.ts` is background context only and
    must not be copied as the deletion/streaming design.

## Completion And Handoff

- Mark Task 04 complete in `todo.md` only when both the implementation and all
  available mandatory platform evidence are recorded; otherwise leave it
  blocked with the exact missing gate.
- Update `handoff.md` with adapter primitives, minimum OS assumptions, final
  files, helper build outputs, race tests, exact commands, unresolved platform
  gates, and rollback state.
- Name Task 05 as the exact next packet only after Task 04 is complete.
- Present the Task 04 diff/evidence and stop. Do not commit or begin Task 05 in
  the same invocation.
