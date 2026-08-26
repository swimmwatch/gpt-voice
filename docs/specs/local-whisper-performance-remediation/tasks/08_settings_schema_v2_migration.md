# 08 Settings Schema-V2 Migration

## Outcome

Advance the Local Whisper document and nested settings schemas to version 2, add `gpuCpuThreads`, migrate legacy
GPU behavior to 4, default new/reset GPU settings to `auto`, and preserve independent CPU/GPU selection memory.

## Prerequisites

- Packet 01 is complete.
- Existing private atomic JSON storage, safe-unknown-field behavior, renderer-safe errors, and unsupported-newer
  schema handling remain authoritative.

## Owned Requirements

SCP-002, CMP-006, CFG-001, CFG-002, CFG-003, CFG-004, THR-002, THR-003, MIG-001, MIG-002, MIG-003, SEC-008,
OPS-002, AC-AUT-011.

## In Scope

- Shared settings types/validation, version constants, repository migration/save/load/reset, public settings
  projection, typed IPC validators, and dependent-selection memory.
- Deterministic migration fixtures for valid/invalid v1 documents and v2 documents.

## Out Of Scope

- Runtime resolution/residency behavior owned by Packet 09.
- Renderer presentation and interaction owned by Packet 10.
- Automatic downgrade, automatic backup creation, release publication, or changing unrelated settings.

## Task Contract

1. Set both `LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION` and the private document schema version to 2.
2. The execution union is exact: GPU has `target`, `backend`, `deviceId`, and `gpuCpuThreads`; CPU retains
   `target`, `backend: 'cpu'`, and `cpuThreads`. Neither target accepts the other's thread property.
3. Both thread fields accept exactly `auto` or a safe integer 1 through the current logical processor count.
   Fractional, zero, negative, malformed, unknown, or stale-above-host values fail shared validation and launch no
   worker.
4. Pure migration of a valid v1 GPU setting adds `gpuCpuThreads: 4`; valid CPU values remain unchanged. New/reset
   GPU settings use `auto`.
5. Replace the legacy shared thread memory with target-specific CPU and GPU entries. Migrate the legacy entry to
   CPU and initialize GPU from the v1 migration/default rule. Never copy one target's value over the other.
6. Preserve safe unknown fields according to the existing repository contract. Invalid/unsafe input returns the
   existing content-free error and is not partially saved.
7. A newer document returns `SETTINGS_VERSION_UNSUPPORTED` and is never overwritten. Older-build rollback requires
   explicit reset or restoration of a compatible v1 backup; do not promise an automatic backup.

## Contracts And Boundaries

- Settings remain private app data and grant no process, filesystem, model, or device authority.
- Main owns repository/migration; shared modules own exact types and pure validation; renderer receives only the
  existing typed public projection.
- Migration is bounded, deterministic, and side-effect-free until the existing atomic save boundary.

## Expected Files Or Components

- `src/shared/localWhisper/settings.ts`
- `src/shared/localWhisper/ipc.ts`
- `src/main/localWhisper/settings/LocalWhisperSettingsRepository.ts`
- `src/main/localWhisper/ipc/createDeferredLocalWhisperEnvironment.ts`
- `tests/main/localWhisper/settings/LocalWhisperSettingsRepository.test.ts`
- `tests/shared/localWhisper/ipc.test.ts` and migration fixtures

## Acceptance Criteria

- AC-AUT-011 covers valid/invalid v1 CPU/GPU documents, v2 documents, safe unknown fields, target memory, reset,
  and unsupported-newer behavior.
- Existing GPU becomes 4; new/reset GPU becomes `auto`; valid CPU stays unchanged; target memories remain independent.
- Invalid input never launches a worker or overwrites the settings file.

## Verification

- `npm run test:local-whisper:migration`
- `npm run test:local-whisper:ipc`
- `node --import tsx --test tests/main/localWhisper/settings/LocalWhisperSettingsRepository.test.ts`
- `npm run typecheck`
- `npm run test:types`
- `npm run format:check`

## Deferred Windows And CI Gate

- Run only the listed Verification commands on the Linux development host. Do not push or inspect CI in this packet.
- Packet 17 runs every deferred Windows migration and typed-IPC fixture; Packet 18 owns fixes and reruns.
- Record local results in `handoff.md` without claiming Windows coverage; the next numbered packet becomes
  executable after local review.

## Failure And Rollback

- Any lossy migration, target-field crossover, overwrite of a newer file, or partial save rejects the packet.
- Code rollback is allowed, but a generated v2 file must be recovered only through explicit reset or compatible v1
  backup; never silently down-convert it.

## Manual Gates

- `MANUAL GATE`: exercise rollback with disposable private data only. Do not use or delete real user settings.

## References

- Specification Sections 4, 9.1, 12, and 13; AC-AUT-011.
- `docs/agent-guides/project-conventions.md` Sections “Electron And Providers” and “Tests And Documentation.”

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with migration matrix results, schema versions, and Packet 09
as the next ordered packet, then stop for review.
