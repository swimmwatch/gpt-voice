# Handoff: Provider Audit Task 20 Complete

## Status

- Tasks 01–19 are committed; Task 19 is
  `e735ee38 feat(audit): capture translation and prettify diagnostics`.
- Task 20 is implemented and verified. Its changes are unstaged and
  uncommitted for review.

## Completed Work

- Added schema-v1 archive, manifest, canonical JSON/JSONL, fixed-member,
  validation, size, count, and privacy contracts.
- Added oldest-first provider-audit extraction from retained main logs with
  canonical validation and `(operationId, sequence)` deduplication.
- Added serialized prune/read diagnostic snapshots with strict stored-row,
  byte-count, redactor-version, correlation, and category validation.
- Added ZIP and gzip-compressed tar creation and producer verification through
  the direct production dependency `archiver@8.0.0`.
- Added private sibling temporary output, atomic publication, failure cleanup,
  shutdown draining, and main-process composition-root ownership.

## Changed Files

- Dependency and packaging:
  `package.json`, `package-lock.json`, and
  `scripts/packaged-runtime-policy.mjs`.
- Archive and audit contracts:
  `src/shared/diagnosticsArchive.ts`,
  `src/main/providerAudit/recordCodec.ts`,
  `src/main/providerAudit/index.ts`, and
  `src/main/providerAudit/providerAudit.ts`.
- Main services and lifecycle:
  `src/main/services/diagnosticsArchive.ts`,
  `src/main/services/diagnosticsArchiveFormat.ts`,
  `src/main/services/diagnosticsManifest.ts`,
  `src/main/services/diagnosticCaptureStorage.ts`,
  `src/main/logger.ts`, `src/main/main.ts`,
  `src/main/mainProcessApplication.ts`,
  `src/main/di/mainProcessCompositionRoot.ts`,
  `src/main/di/mainProcessRuntimeFactory.ts`, and
  `src/main/di/mainProcessRuntimeGraph.ts`.
- Dependency typing:
  `src/types/archiver.d.ts`.
- Coverage:
  `tests/main/diagnosticsArchive.test.ts`,
  `tests/main/diagnosticsArchiveFormat.test.ts`,
  `tests/main/diagnosticsManifest.test.ts`,
  `tests/main/diagnosticCaptureStorage.test.ts`,
  `tests/main/loggerFactory.test.ts`,
  `tests/main/mainProcessApplication.test.ts`,
  `tests/main/mainProcessCompositionRoot.test.ts`, and
  `tests/scripts/packagedRuntimePolicy.test.ts`.

## Checks

- Focused archive, storage, logger, lifecycle, composition, and packaging-policy
  coverage passed: 57 tests.
- Full unit suite passed: 1,033 tests.
- `npm run typecheck`, `npm run test:types`, `npm run lint`,
  `npm run format:check`, `npm run build:prod`, and `git diff --check` passed.
- `npm run audit:prod` passed its high-severity gate and reports one existing
  moderate `tar` advisory.
- `npm run prepare:cloakbrowser`, `npm run pack`, and
  `npm run verify:packaged` passed with the reviewed Archiver dependency graph
  included in the packaged-runtime allowlist.
- Independent Linux tools accepted the synthetic native tar.gz and
  synthetic-on-Linux ZIP, listed only the three fixed regular-file members,
  and produced identical corresponding payload hashes.

## Risks And Manual Gaps

- The locked Archiver graph is pure JavaScript, has no install scripts, and
  uses permissive reviewed licenses. The existing moderate `tar` advisory
  remains visible in the production audit.
- Native Windows ZIP and native macOS tar.gz smoke checks are deferred until
  those platforms are available. Linux tar.gz and the Linux packaging gate are
  complete.
- No live providers, credentials, private diagnostic rows, browser profiles,
  external archive processes, or user-selected destinations were used.
- Packet 20 intentionally exposes no renderer, preload, IPC, or export UI.

## Next Packet

- [21 About diagnostics export](21_integrate_about_diagnostics_export.md)
- Task 20 must be reviewed before its commit boundary and Task 21 execution.
