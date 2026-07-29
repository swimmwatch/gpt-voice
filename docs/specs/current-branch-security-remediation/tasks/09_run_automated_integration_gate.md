# 09 Run The Automated Integration Gate

## Outcome

The complete remediated branch passes the focused security/readiness contracts, full project quality suite,
dependency and advisory policy, production build, skill-package contract, and packaged-runtime policy against one
recorded current `HEAD`. Failures are reported back to their owning packet; this gate does not hide, waive, or repair
them.

## Prerequisites

- Packets 01 through 08 are complete, reviewed, and committed so the recorded `HEAD` contains every remediation
  input under test.
- The approved specification remains `Status: Approved`.
- The locked dependency installation already exists and matches `package-lock.json`; this packet does not install,
  update, or download dependencies or browser runtimes.
- The execution host can build one unpacked application for its native platform from the current checkout. A missing
  cached CloakBrowser runtime or packaging prerequisite is a blocker, not permission to use an older artifact.
- Preserve every unrelated worktree change. The source/configuration tree under review must otherwise be clean before
  recording the gate `HEAD`.

## Owned Requirements

- `OUT-002`
- `ARCH-001`, `ARCH-002`, `ARCH-003`, `ARCH-007`
- `AC-AUTO-019`
- Integration verification for `AC-AUTO-001` through `AC-AUTO-018`, `AC-AUTO-020`, and `AC-AUTO-021`

## In Scope

- One focused cross-packet regression run.
- Production and test TypeScript checks, ESLint, Prettier, and the full unit suite.
- Dependabot configuration, complete production-dependency policy, and production advisory verification.
- Production Webpack build and packaged-runtime policy on a freshly built, native, unpacked artifact.
- Static diagnostics-skill/package and documentation-contract verification.
- A concise, non-sensitive evidence record in the task handoff.

## Out Of Scope

- Fixing a failed test, lint rule, build, policy, package, or documentation assertion. Return that failure to the
  packet that owns the affected behavior.
- Adding or changing dependencies, lockfile entries, provider behavior, archive schema, IPC, renderer behavior,
  settings, database state, or release configuration.
- Live providers, credentials, accounts, private archives, audio, selected text, retained diagnostic rows, or user
  application data.
- Installer creation, signing, notarization, publication, upload, push, pull request, release, or macOS packaging.
- Treating synthetic fixtures or static instructions as hostile-archive, prompt-injection, native-platform, or
  external-tool security proof.
- Native Linux/Windows manual acceptance; Packet 10 owns those gates.

## Task Contract

1. Record the full output of `git rev-parse HEAD`, the native operating system and architecture, and Node/npm versions
   before running the gate. Record only version and platform metadata, never usernames, home paths, environment
   variables, or unrelated worktree content.
2. Confirm that the reviewed source/configuration boundary is clean. Planning/task-state files already authorized for
   this workstream may remain untracked only until the planning bundle is committed; no application, test, script,
   dependency, workflow, or public-documentation change may be omitted from the reviewed `HEAD`.
3. Run the focused tests below once as an integration group. If Packets 01 through 08 add or rename a directly owned
   test file, use its final path in the same command and record that exact command; do not silently omit the test
   because this packet was authored before implementation.
4. Run every project-level command below from the repository root with the locked installed dependency graph.
   `npm run audit:prod` must still reject unknown advisories at the configured threshold. The only accepted current
   advisory is the canonical `GHSA-r292-9mhp-454m` path documented by Packet 07; a path, version, severity, output, or
   row mismatch fails the gate.
5. The repository skill-contract test is the required skill-package validation for this gate. An already-installed
   external skill validator may additionally be run and recorded, but it is not diagnostics-analysis infrastructure
   and must not install or introduce an interpreter, launcher, process adapter, archive reader, or project
   dependency.
6. Build the production bundle, then create a native unpacked application from the exact recorded `HEAD` and run the
   packaged-runtime verifier in the same gate session. Do not accept a pre-existing `release/*-unpacked` directory,
   an artifact copied from another checkout, or the artifact cited by the original review.
7. Before `npm run pack`, run the read-only cache preflight in Verification. It must prove that
   `scripts/prepare-cloakbrowser.mjs` disables auto-update before importing CloakBrowser and that
   `binaryInfo().binaryPath` already resolves to an accessible native binary without calling `ensureBinary()`.
   A missing/inaccessible cached binary or changed preparation script blocks packaging before `pack` starts; do not
   let `ensureBinary()` download a replacement. `npm run pack` is authorized only to create the local unpacked
   verification artifact and does not authorize an installer, package publication, signing, upload, release, or use
   of live provider data.
8. A packaged-runtime pass is valid only when:
   - the checkout was at the recorded full `HEAD` with no unrecorded source/configuration delta;
   - the packaging command completed after that `HEAD` was recorded;
   - `npm run verify:packaged` inspected the artifact produced by that command on the same native host; and
   - no application, dependency, build, workflow, or packaging input changed before verification completed.
9. Record each command as passed, failed, or blocked. Keep test counts and public advisory identifiers when available,
   but do not paste raw exceptions, host paths, environment dumps, provider values, archive values, or private
   content into `handoff.md`.
10. Warnings remain visible. Existing Webpack performance-size warnings may be recorded as non-blocking only when they
    are unchanged and no review finding assigns them higher severity. Any new warning requires review before this
    packet can complete.

## Contracts And Boundaries

- Verification is read-only with respect to application data. Generated `dist/`, `release/*-unpacked`, and package
  metadata are local ignored evidence and are never committed.
- Electron, provider, browser, filesystem, and IPC ownership remain unchanged. Do not launch Electron or a provider
  during this automated packet.
- The full suite uses deterministic synthetic fixtures only. No network-backed provider or archive analysis is
  permitted.
- Audit and failure output must preserve existing privacy canaries and closed error contracts.
- Host-independent lockfile evidence, current-host installed-artifact evidence, and native packaged evidence are
  distinct. A current-host pass must not be reported as proof for Windows, Linux, or another architecture that was
  not actually exercised.

## Expected Files Or Components

- `docs/specs/current-branch-security-remediation/tasks/todo.md`
- `docs/specs/current-branch-security-remediation/tasks/handoff.md`
- Local ignored outputs under `dist/`, `release/`, and generated package-metadata locations as produced by existing
  project commands

No production source, test, script, dependency, workflow, public documentation, or review report should change in
this packet. A required repair belongs to the packet that owns the failed contract.

## Acceptance Criteria

- Every focused test and every project command exits successfully against the same recorded application-source
  `HEAD`.
- The full unit suite includes every deterministic synthetic archive, provider, path, error, privacy, locale,
  dependency, and documentation fixture introduced by Packets 01 through 08.
- Static tests prove the removed executable diagnostics consumer and every replacement parser, launcher, extraction
  utility, report writer, Python requirement, archive-reading dependency, and executable analysis asset remain
  absent.
- Producer boundary tests prove the exact schema-v1 archive ceilings and atomic over-limit behavior; skill tests do
  not misrepresent them as hostile-consumer proof.
- Prettify timeout/contract, Voice/Translation startup, Translation reset, provider status/localization, dependency
  closure, advisory, and handoff-history assertions all pass.
- `SECURITY.md`, the locked production path, and audit output agree on the known advisory; no new blocking advisory is
  present.
- The production build passes. Any unchanged performance-size warning is explicitly recorded rather than suppressed.
- The packaged-runtime policy passes on the newly created current-`HEAD` native unpacked artifact. Stale-artifact
  evidence is rejected.
- `git diff --check` passes, and the only packet completion edits are the checklist and handoff.

## Verification

Record the gate commit and environment first:

```bash
rtk git rev-parse HEAD
rtk proxy node --version
rtk proxy npm --version
rtk proxy node -p "process.platform + ' ' + process.arch"
rtk git status --short
```

Run the focused cross-packet tests:

```bash
rtk proxy node --import tsx --test \
  tests/skills/analyzeDiagnosticsArchive.test.ts \
  tests/main/diagnosticsArchive.test.ts \
  tests/main/diagnosticsArchiveFormat.test.ts \
  tests/main/diagnosticsManifest.test.ts \
  tests/main/diagnosticsExportFlow.test.ts \
  tests/main/providerAuditPrivacy.test.ts \
  tests/main/prettifyProviders.test.ts \
  tests/main/prettifyConnectionCheckCoordinator.test.ts \
  tests/main/translationRuntime.test.ts \
  tests/main/translationRuntimeLifecycle.test.ts \
  tests/main/translationSettings.test.ts \
  tests/main/translationSettingsIpc.test.ts \
  tests/main/translationConnectionIpcContract.test.ts \
  tests/main/browserSessionStartup.test.ts \
  tests/main/backgroundBrowserLifecycle.test.ts \
  tests/renderer/providerState.test.ts \
  tests/renderer/providerSwitching.test.ts \
  tests/renderer/providerStartupState.test.ts \
  tests/renderer/windowStartupState.test.ts \
  tests/renderer/providerStatusIndicator.test.ts \
  tests/renderer/statusPresentation.test.ts \
  tests/renderer/appSettingsPrettifyModels.test.ts \
  tests/shared/appLocale.test.ts \
  tests/scripts/diagnosticsArchiveDependencyPolicy.test.ts \
  tests/scripts/productionAdvisoryPolicy.test.ts \
  tests/scripts/packagedRuntimePolicy.test.ts \
  tests/scripts/agentContextPolicy.test.ts \
  tests/docs/currentBranchRemediationDocumentation.test.ts
```

Run the complete automated project gate:

```bash
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm test
rtk npm run validate:dependabot
rtk npm run verify:diagnostics-dependencies
rtk npm run audit:prod
rtk npm run build:prod
rtk grep \"CLOAKBROWSER_AUTO_UPDATE = 'false'\" scripts/prepare-cloakbrowser.mjs
rtk proxy node --input-type=module -e \"import { access } from 'node:fs/promises'; import { binaryInfo } from 'cloakbrowser'; const info = binaryInfo(); if (typeof info.binaryPath !== 'string') throw new Error('cached CloakBrowser binary unavailable'); await access(info.binaryPath);\"
rtk npm run pack
rtk npm run verify:packaged
rtk git diff --check
```

`verify:diagnostics-dependencies` must evaluate the host-independent `linux-x64` and `win32-x64` locked production
closures, the current-host installed artifacts, the canonical `SECURITY.md` row, and actual
`npm audit --json --omit=dev` evidence through the checked-in policy. Do not substitute a host-only `node_modules`
scan for the target-aware locked-production-closure proof.

## Failure And Rollback

- Any failed or blocked required command leaves Packet 09 incomplete. Record the first useful sanitized failure and
  route it to the numbered packet that owns the contract; do not weaken a test, limit, timeout, trusted-sender check,
  privacy canary, policy threshold, or advisory assertion.
- A stale, missing, wrong-platform, or unverifiable packaged artifact is a failed/blocked packaged-runtime gate, not a
  pass.
- Generated build and unpacked-package outputs are disposable. Remove only exact known ignored outputs through the
  existing project cleanup/package workflow when safe, or leave them ignored; never delete broad paths or user data.
- This packet has no production rollback. If a repair is required, revert or amend only the owning implementation
  packet, rerun its focused checks, and then rerun Packet 09 in full against the new `HEAD`.
- Do not carry a partial pass forward after `HEAD` changes. A new application, dependency, build, workflow, or
  packaging input invalidates the entire recorded automated and packaged evidence.

## Manual Gates

- No provider, browser, archive-analysis, accessibility, installation, or platform-equivalence manual gate is
  performed here.
- Creating and verifying one local native unpacked artifact is an automated build-policy gate, not native Linux and
  Windows acceptance. Packet 10 must exercise both real operating systems and cannot infer a pass from this host,
  mocked `process.platform`, Wine, source inspection, unit fixtures, or a stale artifact.
- If the current host cannot create a current-`HEAD` unpacked artifact without installing or downloading a
  prerequisite, record Packet 09 as blocked and request the missing pre-provisioned environment.

## References

- Mandatory project guidance:
  [Project And Commands](../../../agent-guides/project-conventions.md#project-and-commands),
  [Desktop, Browser, And Packaging](../../../agent-guides/project-conventions.md#desktop-browser-and-packaging), and
  [Tests And Documentation](../../../agent-guides/project-conventions.md#tests-and-documentation).
- Specification anchors:
  [Acceptance Criteria](../spec.md#acceptance-criteria),
  [Dependency and Project Verification](../spec.md#dependency-and-project-verification),
  [Dependency and Advisory Policy](../spec.md#dependency-and-advisory-policy), and
  [Compatibility, Migration, and Rollback](../spec.md#compatibility-migration-and-rollback).
- The original review remains baseline evidence only:
  [Verification Evidence](../../../reviews/2026-07-28-current-branch-code-security-review.md#verification-evidence)
  and
  [Verification Gaps and Residual Risk](../../../reviews/2026-07-28-current-branch-code-security-review.md#verification-gaps-and-residual-risk).

## Completion And Handoff

After every required command passes:

1. mark only Packet 09 complete in [todo.md](todo.md);
2. update [handoff.md](handoff.md) with the full gate `HEAD`, host platform/architecture, concise command results,
   test count, build warnings, known-advisory result, and confirmation that the packaged artifact was built and
   verified after recording that same `HEAD`;
3. identify Packet 10 as the exact next packet and name any missing native host/environment as a blocker;
4. leave the checklist/handoff changes unstaged and uncommitted for review;
5. stop without starting Packet 10, launching Electron, or retaining any private input.
