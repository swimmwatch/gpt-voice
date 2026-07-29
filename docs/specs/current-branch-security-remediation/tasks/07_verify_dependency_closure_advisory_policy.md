# 07 Verify Dependency Closure, Packaged Runtime, And Advisory Policy

## Outcome

The repository computes target-aware locked production closures independently of the current installation,
classifies native and executable content without hiding Archiver's alternate Bare-runtime branch, excludes that
branch from the Electron/Node packaged archive runtime, verifies ZIP and tar.gz creation without it, and tracks the
existing `tar` advisory through one canonical fail-closed policy row.

## Prerequisites

- Packets 01 and 02 are complete, reviewed, and committed.
- Specification revision approved through Prompt MCP decision `approval.spec` revision 3.
- Architecture decision `architecture.archiver-runtime-boundary` revision 1 keeps Archiver and complete lock
  evidence while excluding Bare-only artifacts from Electron/Node packages.
- Packet 01 preserves `archiver@8.0.0` as the direct creation dependency.
- Packet 02 removes every executable diagnostics-analysis implementation dependency.
- The current approved exception is `GHSA-r292-9mhp-454m` for `tar@7.5.19` through
  `cloakbrowser@0.4.12`.
- Preserve `package-lock.json`, existing installed packages, and every unrelated worktree change.

## Owned Requirements

- `ARCH-002`, `ARCH-007`
- `DEP-001`, `DEP-002`, `DEP-003`
- `SEC-012`
- `OPS-001`
- `AC-AUTO-017`, `AC-AUTO-018`

## In Scope

- A reusable, class-owned lockfile-v3 production-closure policy with injected readers and explicit targets.
- Complete full-production and Archiver lock-closure evidence, including the native Bare-runtime branch.
- A separate class-owned Electron/Node Archiver runtime reconciliation that removes only the verified
  `tar-stream -> bare-fs` alternate-runtime edge.
- Removal of the five Bare-only package patterns from application packaging and packaged-runtime allowlists.
- Metadata-, permission-, and signature-based native/executable artifact classification.
- Deterministic ZIP and tar.gz archive creation tests with Bare-only module loading prohibited.
- A canonical known-production-advisory exception verifier against lockfile and production-audit evidence.
- Deterministic offline fixtures for every required edge and artifact type.

## Out Of Scope

- Adding, removing, upgrading, overriding, deduplicating, or reinstalling dependencies.
- Replacing Archiver, forcing a transitive resolution, running `npm audit fix`, or editing `package-lock.json`.
- Omitting `bare-fs` or its native findings from complete locked production or Archiver closure evidence.
- Treating a current-host installation scan as proof for another operating system or architecture.
- Adding an archive parser, inspector, extractor, Python package, launcher, process adapter, report writer, runtime
  dependency, or executable diagnostics-analysis implementation.
- A mandatory workflow/platform job, package build, installer, live provider, network service, commit, push, pull
  request, publication, release, or Packet 10 native manual gate `AC-MAN-006`.

## Task Contract

### Resolve Complete Locked Production Closures

1. Keep dependency-policy orchestration class-owned and constructor-injected. Inject lockfile, package-manifest,
   directory, stat/mode, file-prefix, and packaging-manifest readers as required. Do not add mutable module state or
   a free wrapper that only invokes a class.
2. Parse only lockfile version 3 and fail closed on malformed entries, ambiguous resolution, unresolved required
   edges, unsupported link state, or inconsistent package identity. Safe errors may identify only lock metadata
   package names/paths; they must not expose machine paths, usernames, environment data, or raw exceptions.
3. Resolve the root package's production `dependencies`. Reachability, not an entry's `dev` flag alone, determines
   production membership.
4. Traverse all applicable `dependencies`, `optionalDependencies`, present peer dependencies including optional
   peer metadata, nearest-ancestor nested/hoisted resolution, and package `os`/`cpu` allowlists and exclusions.
5. Compute host-independent closures for exactly:
   - `{ os: 'linux', cpu: 'x64' }`;
   - `{ os: 'win32', cpu: 'x64' }`.
     Do not derive these proofs from `process.platform`, `process.arch`, or current `node_modules`.
6. Permit an absent edge only when the lock contract makes it optional or target-inapplicable. Missing or
   inapplicable required edges fail. Handle cycles and repeated hoisted edges deterministically.
7. Produce distinct complete production and Archiver closures. Both Archiver closures must retain
   `archiver@8.0.0 -> tar-stream@3.2.0 -> bare-fs@4.7.4`; CloakBrowser's `tar` advisory remains outside the
   Archiver subclosure.

### Reconcile The Electron/Node Archive Runtime

8. Add a state-owning Electron/Node runtime-policy class with injected closure and manifest/package configuration
   readers. It must verify the exact current `tar-stream@3.2.0` runtime contract:
   - the Bare condition maps `fs` to `bare-fs`;
   - the default Electron/Node condition maps `fs` to Node's built-in `fs`;
   - `bare-fs` remains the locked dependency reached by that alternate edge.
     Missing, malformed, reordered-to-different-semantics, or changed mappings fail closed.
9. Derive the Node runtime graph by removing only the verified `tar-stream -> bare-fs` edge and recomputing
   reachability. For Linux x64 and Windows x64, the exact current Bare-only package set is:
   - `bare-fs@4.7.4`;
   - `bare-path@3.1.1`;
   - `bare-stream@2.13.3`;
   - `bare-url@2.4.6`;
   - `teex@1.0.1`.
     Use named canonical constants and fail if versions, paths, membership, or target parity changes. Keep shared
     packages such as `bare-events` in the Node runtime graph.
10. Remove only these five package patterns from `build.files` in `package.json` and from
    `APPROVED_RUNTIME_MODULES` in `scripts/packaged-runtime-policy.mjs`. The packaged-runtime policy must reject
    their module paths while continuing to accept every required shared JavaScript package.
11. Reconcile computed Node runtime packages with packaging configuration in both directions: every required
    Archiver Node-runtime package is allowed and no Bare-only package is allowed. This reconciliation is policy
    tooling only and does not alter runtime archive interfaces.
12. Add an isolated deterministic archive-creation regression that rejects any attempted load of the five
    Bare-only packages, then creates and verifies representative ZIP and tar.gz archives using
    `ArchiverDiagnosticsArchiveWriterFactory`. Restore any test-only module hook in `finally`; do not modify or
    rename installed packages. Preserve archive members, timestamps, permissions, limits, output bytes contract,
    and failure normalization.

### Detect Native And Executable Content

13. Inspect complete Archiver closure metadata for `hasInstallScript`, `gypfile`, install hooks, `binding.gyp`,
    node-gyp/node-pre-gyp/prebuild configuration, and equivalent native-build metadata.
14. Classify artifacts by bytes and mode as well as names. Positive controls cover PE, ELF, Mach-O 32/64 and
    universal/fat forms in both byte orders, WebAssembly, executable shebang scripts, and Node-native modules.
    Negative controls cover ordinary JavaScript/data, misleading extensions, suffix-free binaries, and partial
    magic prefixes.
15. Full closure evidence must report `bare-fs` native metadata and prebuilds without treating them as absent.
    The Electron/Node packaged runtime must fail on any Bare-only package, native binary, WebAssembly artifact, or
    native-build metadata. Executable JavaScript such as `crc-32/bin/crc32.njs` remains classified separately and
    is permitted only because no application or diagnostics-analysis source invokes it.
16. Scan installed artifacts only when the current host exactly matches one supported target. Host inspection
    cannot satisfy or simulate the other target.

### Track The Advisory Canonically

17. Add exactly one `SECURITY.md` table headed `Known production advisory exceptions`. Its single row contains:
    - advisory `GHSA-r292-9mhp-454m`;
    - locked path `cloakbrowser@0.4.12 -> tar@7.5.19`;
    - severity `moderate`;
    - the crafted-long-path tar-member stack-overflow denial-of-service impact;
    - why an unvalidated forced override can break CloakBrowser archive/runtime behavior;
    - responsible upstream dependency `cloakbrowser`;
    - last-reviewed date `2026-07-28`;
    - recheck triggers: CloakBrowser lockfile change, advisory update, or compatible upstream fix.
18. Keep the advisory verifier class-owned with injected lockfile, parsed `npm audit --json --omit=dev` evidence,
    security-policy text, and closure policy. Exact path, versions, advisory ID, severity, row, date, and triggers
    must match.
19. Unknown advisories, changed versions/paths/severity, malformed audit evidence, or a missing/changed canonical
    row fail. The verifier never edits `SECURITY.md`, lockfile, or audit output.
20. Keep the existing high-severity production-audit threshold. The documented moderate exception remains visible
    rather than silently suppressed.

## Contracts And Boundaries

- The complete lock closure and Electron/Node packaged-runtime closure are separate explicit evidence tiers.
- The runtime-policy class may use pure closed-schema helpers, but owns runtime-condition verification,
  reachability, exclusion invariants, and packaging reconciliation.
- Policy tooling remains under repository scripts and is never bundled, exposed through preload, or imported by
  production source.
- `package.json` adds only `verify:diagnostics-dependencies` and removes the five approved Bare-only `build.files`
  patterns. Dependencies and all other build behavior remain unchanged.
- `package-lock.json` must remain byte-identical.
- Existing archive result values, renderer/preload/IPC contracts, schema version, provider behavior, privacy
  boundaries, and application error normalization remain unchanged.
- Evidence tiers remain explicit:
  1. host-independent Linux x64 and Windows x64 lock/runtime graph proof;
  2. matching-host installed artifact inspection;
  3. Packet 10 native installed/package evidence.
- Mach-O/Wasm fixtures prove classifier behavior only. They do not claim supported macOS packaging.

## Expected Files Or Components

Add:

- `scripts/dependency-policy/lockedProductionClosure.ts`
- `scripts/dependency-policy/electronNodeArchiveRuntimePolicy.ts`
- `scripts/dependency-policy/packageArtifactClassifier.ts`
- `scripts/dependency-policy/productionAdvisoryPolicy.ts`
- `scripts/verify-diagnostics-dependency-policy.ts`
- `tests/scripts/productionAdvisoryPolicy.test.ts`

Update:

- `package.json`
- `SECURITY.md`
- `scripts/packaged-runtime-policy.mjs`
- `tests/scripts/diagnosticsArchiveDependencyPolicy.test.ts`
- `tests/scripts/packagedRuntimePolicy.test.ts`
- `tests/main/diagnosticsArchive.test.ts` or one isolated equivalent archive-runtime test

Do not add binary fixtures, executable fixtures, machine-specific paths, saved audit output, or package artifacts.

## Acceptance Criteria

- Lock fixtures cover nested, hoisted, optional, optional-peer, required-peer, OS-specific, CPU-specific, repeated,
  cyclic, unresolved-required, absent-optional, malformed, identity, and target-inapplicable cases on both targets.
- Complete production and Archiver closures are deterministic and distinct; Archiver retains
  `tar-stream -> bare-fs`, while CloakBrowser's `tar` advisory is not attributed to Archiver.
- Runtime-condition fixtures accept only the exact Bare/default mapping and fail malformed, missing, changed,
  ambiguous, or version-mismatched manifests.
- Both targets derive exactly the five Bare-only packages and keep `bare-events`. Changed reachability, version, or
  target parity fails.
- `package.json` and packaged-runtime policy omit and reject the five Bare-only modules while retaining every
  required Node runtime module.
- ZIP and tar.gz creation succeeds and verifies while attempted loading of any Bare-only package fails the test.
- Artifact fixtures detect every required signature and metadata case without suffix-only or prefix-loose
  classification.
- Complete installed Archiver evidence records `bare-fs` native content; the matching-host Node packaged-runtime
  candidate remains free of Bare-only native/build/Wasm findings.
- Existing static boundary remains: Archiver is a direct production dependency imported only by
  `src/main/services/diagnosticsArchiveFormat.ts`, whose adapter has no child-process, shell, network, provider, or
  browser access.
- The canonical advisory row matches locked path and synthetic production-audit evidence. Changed evidence and any
  new unlisted advisory fail without rewriting the exception.
- `package-lock.json` has no diff, no dependency is added, and Packet 02's no-executable-analysis assertions pass.

## Verification

Run deterministic focused checks first:

```bash
rtk proxy node --import tsx --test \
  tests/scripts/diagnosticsArchiveDependencyPolicy.test.ts \
  tests/scripts/productionAdvisoryPolicy.test.ts \
  tests/scripts/packagedRuntimePolicy.test.ts \
  tests/main/diagnosticsArchive.test.ts \
  tests/skills/analyzeDiagnosticsArchive.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run validate:dependabot
rtk npm run verify:diagnostics-dependencies
rtk npm run audit:prod
rtk git diff --check
rtk git diff --exit-code -- package-lock.json
```

The named verifier runs against the current lockfile, canonical `SECURITY.md` row, packaging configuration,
matching-host installed artifacts, and actual production-audit output after the offline suite. Network or registry
unavailability blocks live advisory comparison and must be recorded; it cannot be converted into a unit-test pass.

## Failure And Rollback

- Unresolved required edges, unknown runtime conditions, changed Bare-only membership, ambiguous target behavior,
  missing required Node modules, included Bare-only modules/artifacts, unknown signatures, or advisory mismatch
  block completion.
- Do not weaken traversal or classifiers, omit `bare-fs` from complete evidence, allow its packaged native
  artifacts, raise the audit threshold, force an override, reinstall dependencies, or auto-update the exception.
- If archive creation requires a removed package, restore the five packaging patterns and leave Packet 07
  incomplete; return the runtime-boundary decision to `/spec` rather than shipping an unverified package.
- Rollback is a scoped revert of policy classes, verifier composition, tests, `SECURITY.md` row, package script, and
  the five packaging/allowlist removals. No runtime data, migration, browser state, or user archive is involved.
  `package-lock.json` remains unchanged.

## Manual Gates

- Do not claim native cross-platform packaged-runtime proof in this packet.
- Packet 10 owns `AC-MAN-006`: representative Linux and Windows installed/package inspection plus packaged ZIP and
  tar.gz creation. Missing hosts or current-HEAD artifacts are blockers, not passes.
- Mocked `process.platform`, source inspection, and deterministic unit fixtures cannot satisfy the native gate.

## References

- Mandatory project guidance:
  - [Dependency Injection And Runtime Ownership](../../../agent-guides/project-conventions.md#dependency-injection-and-runtime-ownership)
  - [Desktop, Browser, And Packaging](../../../agent-guides/project-conventions.md#desktop-browser-and-packaging)
  - [Tests And Documentation](../../../agent-guides/project-conventions.md#tests-and-documentation)
- Specification anchors:
  - [Dependency And Advisory Policy](../spec.md#dependency-and-advisory-policy)
  - [Dependency And Project Verification](../spec.md#dependency-and-project-verification)
  - [Required Manual Platform Gates](../spec.md#required-manual-platform-gates)
- Approved decision:
  - `architecture.archiver-runtime-boundary` revision 1 in [decisions.yaml](../decisions.yaml)

## Completion And Handoff

After all automated checks pass:

1. mark only Packet 07 complete in [todo.md](todo.md);
2. update [handoff.md](handoff.md) with changed files, offline/live results, complete-lock versus packaged-runtime
   evidence, three evidence tiers, tracked advisory, residual native-platform risk, and Packet 08 as exact next;
3. leave Packet 07 unstaged and uncommitted for review;
4. stop without running native package inspection, forcing a dependency override, or beginning Packet 08.
