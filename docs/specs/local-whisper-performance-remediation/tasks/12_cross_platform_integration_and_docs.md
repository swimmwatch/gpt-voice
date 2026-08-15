# 12 Cross-Platform Integration And Documentation

## Outcome

Integrate Packets 02–11 as a coherent cross-platform candidate, run the complete Linux-host quality matrix, prepare
the deferred Windows matrix, and document user behavior, maintainer contracts, privacy, recovery, and rollback.

## Prerequisites

- Packets 02 through 11 are complete and individually reviewed.
- No affected source has drifted from the recorded handoffs without refreshed baseline and packet repair.
- Packet 01's performance CI lanes and preserved pre-existing runner-policy changes remain present; revision 5 does
  not execute them before Packet 17.

## Owned Requirements

SCP-005, SCP-006, CMP-001, CMP-002, CMP-003, ARC-001, ARC-002, PRIV-002, OPS-001, OPS-002, OPS-003,
AC-AUT-015, AC-MAN-005.

## In Scope

- Cross-component compatibility fixes needed to compose the approved packets without broadening behavior.
- Full affected TypeScript/native/build/package/privacy verification.
- User and maintainer documentation for settings, protocol, pipeline, measurement, profiles, logs, supported
  platforms, recovery, and exact rollback.
- Disposable mixed-peer and newer-settings rollback validation.

## Out Of Scope

- New feature behavior, network requests, browser/session work, microphone/clipboard/history changes, macOS Local
  Whisper support, dependencies, package targets, release publication, or catalog rollout.
- Weakening a gate, overwriting pre-existing runner-policy work, or committing generated packages/private evidence.

## Task Contract

1. Verify protocol-v2 app/guard peers ship as one set; worker protocol and native log schema remain version 1;
   settings document/nested schemas are version 2; runtime-pack identity still governs worker compatibility.
2. Confirm renderer uses only the typed desktop boundary and main/native owners retain filesystem, process, settings,
   model, device, and lifecycle privileges.
3. Exercise aggregate failure/retry paths so no stale pending request, staging token, lease, worker state, digest,
   WAV/PCM buffer, handle, or descriptor survives a terminal result.
4. Preserve Local Whisper unavailability on macOS, model bytes/layout/catalog identity, provider results, privacy,
   logging bounds, package targets, and dependency set.
5. Update `docs/local-whisper.md` with contextual CPU/GPU thread fields, `auto`, range, migration defaults,
   unsupported-newer recovery, and host/backend/model/cache performance dependence.
6. Add maintainer guidance for the protocol-v2 formula and 4,096-byte margin, newline/overflow behavior,
   candidate-window/serial-binding state and 32 MiB cap, Packet 18 final selection, phases/statistics, SHA fallback,
   profile parity, log schema v1, platform matrix, and exact reset/compatible-v1-backup rollback. Never publish
   private paths, device identities, or raw measurements.

## Contracts And Boundaries

- Integration may repair only conflicts inside approved packet contracts. A behavior/security/compatibility change
  returns to `/spec`; an implementation sequencing change returns to `/plan`.
- No commit or push occurs without the packet review authorization required below. Package publication, installer
  mutation outside CI's disposable build output, and external communication are not authorized.

## Expected Files Or Components

- All files changed by Packets 02–11
- `docs/local-whisper.md`
- Focused maintainer evidence documentation under this specification directory
- Existing package, privacy, native-quality, IPC, migration, UI, composition, and documentation tests

## Acceptance Criteria

- The Linux-executable portion of AC-AUT-015 passes without waiver; Packet 17 owns every supported Windows check and
  the final cross-platform AC-AUT-015 decision.
- AC-MAN-005 proves mixed guard peers and newer settings fail closed; explicit reset or compatible v1 backup
  recovers without deleting managed model/runtime artifacts.
- Documentation contains every OPS-003 item and no sensitive/raw evidence.

## Verification

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:types`
- `npm test`
- `npm run build:prod`
- `npm run test:local-whisper:native-sources`
- `npm run test:local-whisper:native-analysis`
- `npm run test:local-whisper:native-fuzz`
- `npm run test:local-whisper:worker-tsan`
- `npm run test:local-whisper:packaging`
- `npm run verify:local-whisper:migration-privacy`

## Deferred Windows And CI Gate

- Run only the listed Verification commands on the Linux development host. Do not push or inspect CI in this packet.
- Record the exact deferred Windows filesystem, worker, migration, UI, profile, package, and privacy checks for
  Packet 17; do not replace them with Linux simulations or mark AC-AUT-015 complete.
- Packet 18 owns each separate fix commit and the complete Linux/Windows rerun after the production window freeze.

## Failure And Rollback

- Any failed gate, compatibility mismatch, sensitive evidence, unsupported platform claim, or hidden resource/race
  regression blocks Packet 13.
- Rollback uses coherent peer/schema sets. Never downgrade a v2 settings file in place; use explicit reset or a
  compatible v1 backup in disposable data.

## Manual Gates

- Packet 17 owns mandatory MSVC analysis/ASan, deterministic Windows native tests, disposable mixed-peer/settings
  rollback, package checks, and complete Windows end-to-end behavior.
- `MANUAL GATE`: translation, accessibility, and documentation review.
- Generated binaries, packs, installers, and private diagnostic/qualification data must remain uncommitted.

## References

- Specification Sections 3, 4, 11–15; AC-AUT-015 and AC-MAN-005.
- `docs/agent-guides/project-conventions.md` Sections “Electron And Providers,” “Desktop, Browser, And Packaging,” and “Tests And Documentation.”

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with aggregate checks, manual gate results, and Packet 13 as
the exact next packet, then stop for review.
