# Handoff: Current Branch Security Remediation

## Status

- Specification revision 3 is approved through Prompt MCP decision `approval.spec` revision 3.
- The revised plan is approved through Prompt MCP decision `approval.plan` revision 2.
- Packets 01–06 are committed; Packet 06 is `c6ca0dc0 fix(security): correct provider status presentation`.
- Packet 07 execution was authorized through Prompt MCP decision `execution.task-07` revision 2.
- Packet 07 is complete, verified, unstaged, and uncommitted for review.
- Packet 08 has not started and is not authorized.

## Packet 07 Changed Files

- Complete target-aware closure resolution:
  `scripts/dependency-policy/lockedProductionClosure.ts`.
- Class-owned Electron/Node runtime-condition, reachability, and packaging reconciliation:
  `scripts/dependency-policy/electronNodeArchiveRuntimePolicy.ts`.
- Mode-, metadata-, and signature-based artifact inspection:
  `scripts/dependency-policy/packageArtifactClassifier.ts`.
- Canonical lock/audit/security-row verification:
  `scripts/dependency-policy/productionAdvisoryPolicy.ts`.
- Repository integration composition:
  `scripts/verify-diagnostics-dependency-policy.ts`.
- Electron/Node package boundary:
  `package.json` and `scripts/packaged-runtime-policy.mjs`.
- Canonical moderate advisory exception:
  `SECURITY.md`.
- Deterministic closure, runtime-condition, artifact, advisory, package-policy, privacy, and real archive-creation
  coverage:
  `tests/scripts/productionAdvisoryPolicy.test.ts`,
  `tests/scripts/diagnosticsArchiveDependencyPolicy.test.ts`,
  `tests/scripts/packagedRuntimePolicy.test.ts`, and
  `tests/scripts/archiverNodeRuntimeBoundary.test.ts`.
- Packet state and approved boundary:
  `tasks/todo.md`, this handoff, `spec.md`, `decisions.yaml`, `tasks/plan.md`, and
  `tasks/07_verify_dependency_closure_advisory_policy.md`.

## Verification

- Focused Packet 07 and archive/skill suite passes: 42 tests across 6 files.
- Production and test TypeScript checks pass.
- Full ESLint and Prettier checks pass.
- Dependabot configuration validation passes.
- Live `verify:diagnostics-dependencies` passes for Linux x64 and Windows x64 lock/runtime graphs.
- Matching-host inspection verifies 48 Electron/Node runtime packages, records 42 Bare-only findings, and
  classifies one executable JavaScript CLI.
- Live `audit:prod` passes its configured threshold and reports only the canonical moderate
  `GHSA-r292-9mhp-454m` advisory for `cloakbrowser@0.4.12 -> tar@7.5.19`.
- `git diff --check` passes.
- `git diff --exit-code -- package-lock.json` passes; no dependency or lockfile changed.

## Evidence Tiers And Remaining Risk

1. Host-independent policy proves both Linux x64 and Windows x64 complete closures retain
   `archiver@8.0.0 -> tar-stream@3.2.0 -> bare-fs@4.7.4`.
   Removing only that verified Bare-condition edge derives exactly `bare-fs`, `bare-path`, `bare-stream`,
   `bare-url`, and `teex`; shared `bare-events` remains in the Node graph.
2. Matching-host installed inspection records `bare-fs` native metadata/prebuilds while finding no prohibited
   native/build/Wasm artifact in the Electron/Node package candidate. ZIP and tar.gz creation succeeds under a
   resolution hook that rejects every Bare-only module load. `crc-32/bin/crc32.njs` is classified as an executable
   JavaScript CLI and source tests prove it is not invoked.
3. Representative installed/package Linux and Windows verification remains Packet 10 `AC-MAN-006`; no native
   cross-platform package claim is made here.

- The production build/full cross-packet suite remains Packet 09 work.
- Installed package contents and packaged ZIP/tar.gz smoke remain Packet 10 work.

## Exact Next Packet

- Packet 08:
  [Reconcile documentation handoffs](08_reconcile_documentation_handoffs.md).
- Before Packet 08, review Packet 07 and obtain explicit authorization for its scoped commit and for Packet 08
  execution. Do not commit or begin Packet 08 from this handoff alone.
