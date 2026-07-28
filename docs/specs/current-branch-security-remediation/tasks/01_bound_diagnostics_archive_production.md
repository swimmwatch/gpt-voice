# 01 Bound Diagnostics Archive Production

## Outcome

App-generated schema-v1 ZIP and tar.gz diagnostics archives enforce the reduced producer envelope before publication,
fail atomically when complete retained evidence cannot fit, and preserve all existing renderer, settings, storage, and
archive-shape contracts.

## Prerequisites

- Approved specification decision `compatibility.export-envelope` revision 2.
- Approved specification decision `security.archive-resource-envelope` revision 2.
- No earlier remediation packet is required.
- Preserve the untracked review/specification bundle and every unrelated worktree change.

## Owned Requirements

- `ARCH-001`, `ARCH-002`, `ARCH-007`
- `SEC-003`
- `COMP-003`
- `EXPORT-001`
- `DEP-001`
- `AC-AUTO-007`
- `AC-AUTO-021`

## In Scope

- Canonical named producer-limit constants.
- Audit-event and diagnostic-row JSONL serialization limits.
- ZIP and tar.gz structure and outer-file limits.
- Fail-atomic archive creation and cleanup.
- Exact-boundary producer and export-flow tests.

## Out Of Scope

- Archive schema version or member-name changes.
- Diagnostics analysis, parser, validator, extractor, report writer, or skill changes; Packet 02 owns them.
- Diagnostic capture eligibility, redaction, retention, database schema, toggle, purge, cache, or provider behavior.
- IPC channel, preload, renderer result shape, Settings navigation, notification copy, or platform-format selection
  changes.
- Dependency or lockfile changes.
- Live/private archives, providers, browsers, packaging, commits, pushes, pull requests, or releases.

## Task Contract

1. Keep archive schema version `1` and this exact logical member table:
   - `manifest.json`;
   - `provider-audit/events.jsonl`;
   - optional `diagnostics/text-actions.jsonl`.
2. Replace the producer ceilings with named canonical constants owned by the shared diagnostics archive contract:
   - `64 * 1024 * 1024` inclusive uncompressed bytes per member;
   - `128 * 1024 * 1024` inclusive summed uncompressed payload bytes;
   - `8 * 1024 * 1024` inclusive UTF-8 bytes per JSONL line, excluding the line terminator;
   - `100_000` inclusive records per JSONL member;
   - `1 * 1024 * 1024` inclusive archive-structure bytes;
   - `130 * 1024 * 1024` inclusive outer archive bytes;
   - retain the existing `1000:1` compression-ratio rule for members to which it already applies.
3. Count serialized UTF-8 bytes, record terminators, and archive container bytes; do not use JavaScript character
   counts as byte counts.
4. Reject over-limit audit or diagnostic data before destination publication. A serializer, writer, verifier, hash,
   filesystem, or cleanup exception produces the existing internal archive failure and renderer-facing
   `{ status: 'failed' }` result.
5. Measure ZIP structure as directory, filename, extra, comment, and other container overhead. Measure tar.gz
   structure as tar headers, extension metadata, padding, trailer, and other non-payload bytes. Count every byte in
   the final outer archive.
6. Write only through the existing private temporary destination and rename/publication boundary. On any limit or
   verification failure, remove the exact owned temporary output, leave no destination, and do not delete or mutate
   retained diagnostic rows or capture settings.
7. Preserve current single-flight export ownership, localized failure notification, open Settings window, retry
   behavior, Windows ZIP selection, and Linux/macOS tar.gz selection.
8. Keep `archiver` direct, creation-only, and imported only by the existing main archive-format adapter. Do not add
   shell, process, browser, provider, or network access to that adapter.

## Contracts And Boundaries

- Electron main remains the sole archive and filesystem owner.
- The renderer receives only the existing closed `saved | cancelled | failed` result.
- Archive validation performed here is producer self-verification, not an untrusted-consumer security claim.
- Stateful serialization/archive orchestration remains class-owned and constructor-injected. Stateless byte-count
  guards may remain pure functions. Add no mutable module singleton or free service pass-through.
- Use deterministic injected filesystem, UUID, clock, storage, writer, and hash dependencies in tests.
- Never log or expose destination paths, retained text, provider content, credentials, raw errors, or archive bytes.

## Expected Files Or Components

- `src/shared/diagnosticsArchive.ts`
- `src/main/services/diagnosticsArchive.ts`
- `src/main/services/diagnosticsArchiveFormat.ts`
- `src/main/services/diagnosticsManifest.ts` only if manifest inventory validation needs the canonical limits
- `src/main/services/diagnosticsExport.ts` only for closed failure/notification invariants
- `tests/main/diagnosticsArchive.test.ts`
- `tests/main/diagnosticsArchiveFormat.test.ts`
- `tests/main/diagnosticsManifest.test.ts`
- `tests/main/diagnosticsExportFlow.test.ts`
- `tests/main/providerAuditPrivacy.test.ts`
- `tests/main/diagnosticCaptureStorage.test.ts`
- `tests/main/repositories/sqliteDiagnosticCaptureRepository.test.ts`
- A focused new producer-limit test file is allowed when it keeps the exact-boundary fixtures isolated.

Do not change `package.json`, `package-lock.json`, shared IPC types, preload, renderer declarations, or database
repositories in this packet.

## Acceptance Criteria

- Exact-limit and one-byte/one-record-over fixtures cover every producer ceiling.
- ZIP and tar.gz fixtures use incompressible data and prove the complete exact-boundary archive remains within
  `130 MiB`, including container bytes.
- Format tests cover exact/over `1 MiB` structure and detect over-limit outer output after writer completion but
  before destination publication.
- JSONL tests cover multibyte UTF-8, excluded line terminators, `100_000` records, and record `100_001`.
- A valid `100 MiB` retained-diagnostics state that exceeds the one-member ceiling returns the existing failed
  result, preserves all rows/settings, leaves no destination or private temporary file, keeps Settings open, and
  succeeds after user-controlled deletion reduces retained data.
- Throwing writer, verifier, hash, filesystem, cleanup, notification, and logger dependencies do not expose private
  content or change capture state.
- Producer validators retain field-specific closed schema version, contract, enum, integer, boolean, and `null`
  definitions; no generic safe-string or arbitrary-version fallback is introduced.
- Existing schema/member names, canonical serialization, manifest hashes, platform format selection, IPC results,
  and privacy canaries remain unchanged.

## Verification

Run the smallest focused checks first:

```bash
rtk proxy node --import tsx --test \
  tests/main/diagnosticsArchive.test.ts \
  tests/main/diagnosticsArchiveFormat.test.ts \
  tests/main/diagnosticsManifest.test.ts \
  tests/main/diagnosticsExportFlow.test.ts \
  tests/main/providerAuditPrivacy.test.ts \
  tests/main/diagnosticCaptureStorage.test.ts \
  tests/main/repositories/sqliteDiagnosticCaptureRepository.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check
```

If shared diagnostics contracts or the composition root change, also run:

```bash
rtk proxy node --import tsx --test \
  tests/main/diagnosticsExportIpc.test.ts \
  tests/main/mainProcessCompositionRoot.test.ts \
  tests/main/preloadApi.test.ts
```

Do not run Electron, package an application, create a private archive, or use live provider data.

## Failure And Rollback

- A failing boundary fixture blocks completion; do not relax a ceiling, skip format verification, truncate required
  evidence, or delete retained rows to obtain a pass.
- If exact-boundary fixtures exceed practical test resources, keep the packet incomplete and record the measured
  blocker. Do not replace them with scaled fixtures while claiming the real limits passed.
- Rollback is a scoped revert of limit, serializer, writer/verifier, and test changes. No migration or data repair is
  required because failed exports never publish an artifact or mutate retained evidence.

## Manual Gates

None in this packet. Native benign ZIP/tar.gz analysis and packaged-platform evidence belong to Packet 10 and must
not be inferred from mocked `process.platform`.

## References

- Mandatory project guidance:
  [Dependency Injection And Runtime Ownership](../../../agent-guides/project-conventions.md#dependency-injection-and-runtime-ownership)
  and [Tests And Documentation](../../../agent-guides/project-conventions.md#tests-and-documentation).
- Specification anchors:
  [Structural and Payload Budgets](../spec.md#structural-and-payload-budgets),
  [Compatibility, Migration, and Rollback](../spec.md#compatibility-migration-and-rollback), and
  [Automated Archive Export and Analysis-Contract Tests](../spec.md#automated-archive-export-and-analysis-contract-tests).
- Review evidence:
  [Finding 1](../../../reviews/2026-07-28-current-branch-code-security-review.md#1-untrusted-archives-can-exceed-the-advertised-resource-envelope).

## Completion And Handoff

After all automated checks pass:

1. mark only Packet 01 complete in [todo.md](todo.md);
2. update [handoff.md](handoff.md) with changed files, concise check results, residual risks, and Packet 02 as the
   exact next packet;
3. leave Packet 01 unstaged and uncommitted for review;
4. stop without starting Packet 02.
