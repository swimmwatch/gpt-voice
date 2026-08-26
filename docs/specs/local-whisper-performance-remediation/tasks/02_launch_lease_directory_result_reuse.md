# 02 Launch-Lease Directory-Result Reuse

## Outcome

Remove exactly one immediately repeated acquisition-time `LIST` inspection while preserving every later
freshness, model-authority, preflight, and loader-consumption proof.

## Prerequisites

- Packet 01 is complete and its source baseline remains current.
- The current `ManagedArtifactStore.leaseInstalledModelForLaunch` still calls `leaseInstalledArtifact` and then
  immediately calls `inspectDirectory` again before returning the launch lease.

## Owned Requirements

SCP-004, SEC-001, SEC-002, SEC-003, SEC-004, PERF-002, PERF-006, PERF-007, SEC-006, AC-AUT-003, AC-AUT-004.

## In Scope

- Internal `ManagedArtifactStore` acquisition results and focused test adapters.
- Reuse of the validated entry map produced by the first acquisition-time directory inspection.
- Mutation and call-count tests for Linux and Windows adapter contracts.

## Out Of Scope

- Persistent or metadata-only digest caches.
- Removing the later `revalidate` inspection, pre-spawn/pre-load checks, Linux launch/authority proofs, worker
  preflight digest, loader-consumption digest, or either `ExactModelReader` pass.
- Changing public provider, renderer, IPC, model artifact, or managed-root contracts.

## Task Contract

1. Refactor the private artifact-lease acquisition path to return the held lease plus its already validated
   immutable entry map to the model-launch acquisition method.
2. Use the matching model entry from that map exactly once while constructing both runtime and model launch
   authority. Scope the retained map to that one acquisition; do not store it on the service or lease metadata.
3. Preserve the later `revalidate` closure's fresh `LIST`, identity comparison, SHA comparison, directory lease
   validation, and failure mapping.
4. On any mismatch or exception, release the lease and return the existing content-free `ARTIFACT_UNPROVABLE` or
   mapped failure. Never publish residency.
5. Tests must prove successful full-model hash counts move from 8 to 7 on Linux and 7 to 6 on Windows, with every
   other named proof still occurring.

## Contracts And Boundaries

- `ManagedArtifactStore` remains the state owner; do not add a pass-through service or module-level cache.
- Main retains filesystem authority through the platform adapter and opaque lease token.
- External same-user mutation at any retained proof point must still fail closed.

## Expected Files Or Components

- `src/main/localWhisper/filesystem/ManagedArtifactStore.ts`
- Focused store tests, adding `tests/main/localWhisper/filesystem/ManagedArtifactStore.test.ts` if needed
- `tests/main/localWhisper/filesystem/PlatformAdapterContract.test.ts`
- Linux/Windows managed-filesystem adapter fixtures used for inspection and hash counts

## Acceptance Criteria

- AC-AUT-003 proves only the immediate duplicate is removed and exact counts are 8/7 before and 7/6 after.
- AC-AUT-004 mutates identity, size, or content at each retained revalidation and leaves no residency or artifact.
- Lease release occurs exactly once on every success/failure cleanup path.

## Verification

- `node --import tsx --test "tests/main/localWhisper/filesystem/*.test.ts"`
- `npm run test:local-whisper:composition`
- `npm run typecheck`
- `npm run format:check`

## CI Gate And Commit Discipline

- Task-specific CI commands: `npm run test:local-whisper:filesystem`,
  `npm run test:local-whisper:composition`, and the Packet 01 qualification source-count/proof-retention fixtures.
  Both performance aggregates must execute the deterministic Linux and Windows adapter variants.
- Required checks for the exact pushed SHA: `Quality Gates`, `Local Whisper Performance (Linux)`, and
  `Local Whisper Performance (Windows)`.
- After local verification, stop for review and obtain explicit authorization for the implementation commit and
  push. Push the immutable implementation commit and wait until every required check reports `success`; every other
  conclusion is non-passing.
- Fix an actionable CI failure only in a later explicitly authorized invocation and a separate fix commit. Never
  amend or squash the implementation commit; push and rerun the same checks until green.
- Record implementation/fix SHAs, workflow run ID, check names, check-run URLs or IDs, and final results in
  `handoff.md`. Packet 03 remains blocked until the green result is reviewed.

## Failure And Rollback

- Any unexplained proof-count reduction, stale-map reuse, or lost mutation rejection fails the packet.
- Roll back the private acquisition-result refactor; no persisted data or schema migration is involved.

## Manual Gates

- None. Representative-host performance evidence is deferred to Packets 13 and 14.

## References

- Specification Sections 5.2 and 6; AC-AUT-003 and AC-AUT-004.
- `docs/agent-guides/project-conventions.md` Section “Dependency Injection And Runtime Ownership.”

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with exact proof counts and Packet 03 as the next ordered
packet, then stop for review.
