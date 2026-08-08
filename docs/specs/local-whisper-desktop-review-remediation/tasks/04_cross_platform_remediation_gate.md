# 04 Cross-Platform Remediation Gate

## Outcome

The existing PR Checks workflow contains one focused Linux x64/Windows x64 matrix for the completed remediation, the unchanged dependency lockfile passes its production audit, compatibility and privacy invariants are confirmed, and targeted manual desktop smoke passes on both supported operating systems before merge.

## Prerequisites

- Packets 1 through 3 are complete, reviewed, and recorded in [todo.md](todo.md) and [handoff.md](handoff.md).
- This packet has a fresh explicit `incremental-implementation` invocation.
- Read the `Project And Commands`, `Code And Logging`, `Desktop, Browser, And Packaging`, `Tests And Documentation`, and `Git And Releases` sections of `docs/agent-guides/project-conventions.md`.
- The focused test paths introduced by packets 1 through 3 are stable and pass locally on the available host.

## Owned Requirements

- Requirements: OUT-001, GAT-001, SCP-001, SCP-002, SCP-003, CMP-001, CMP-002, CMP-003, ARC-001, ARC-002, SEC-001, SEC-002, SEC-003, PRV-001, OPS-001, OPS-002, TST-001, TST-002, TST-003, TST-004, TST-005.
- Acceptance: AC-AUT-001 through AC-AUT-010 and AC-MAN-001 through AC-MAN-002.
- Review selection: final combined gate for F1, F3, F4, F5, F6, and intermediate redirect-response ownership. No selected item may be deferred past merge.

## In Scope

- Add a dedicated Linux/Windows matrix job to `.github/workflows/pr-checks.yml`.
- Run every command required by TST-005 on both matrix runners, plus the focused production Node HTTPS/qualification-adapter tests needed for AC-AUT-004.
- Rely on the existing unchanged-lockfile `audit:prod` PR gate or run it once explicitly; do not weaken its severity.
- Audit the final diff for platform neutrality, public/persisted contract compatibility, dependency and generated-artifact cleanliness, and sanitized diagnostics.
- Record targeted Linux x64 and Windows x64 manual smoke outcomes before closing the checklist.

## Out Of Scope

- A new workflow, changes to the Linux or Windows native-quality jobs, package targets, installers, signing, release workflows, release notes, version changes, publishing, or a macOS claim.
- New dependencies, native components, services, credentials, live provider tests, telemetry, diagnostic fields, or qualification claims.
- F2 renderer memoization/performance work or any selected remediation deferred to follow-up.

## Task Contract

1. Add one dedicated job to `.github/workflows/pr-checks.yml` using a matrix with `ubuntu-latest` and `windows-latest`, Node.js 24, `npm run ci:install`, and runner-specific npm/Electron caches consistent with the existing workflow. Keep workflow permissions read-only and use no secrets.
2. On each matrix runner, execute these repository commands exactly: `npm run test:local-whisper:artifacts`, `npm run test:local-whisper:ipc`, `npm run test:local-whisper:composition`, `npm run verify:local-whisper:ui`, `npm run typecheck`, `npm run test:types`, `npm run lint`, `npm run format:check`, and `npm run build:prod`.
3. On each runner, also execute the deterministic loopback TLS and qualification HTTP-client tests selected in packet 1 when they are not already included by the artifact command. Do not access public model hosts or any external provider.
4. Ensure `npm run audit:prod` passes at least once against the unchanged `package-lock.json`. The existing `quality` job satisfies this only if it remains an unconditional gate for the same workflow revision.
5. Give the matrix job a bounded timeout appropriate for the nine required commands. Do not move the commands into native-quality jobs and do not create a separate workflow.
6. Before reporting automated completion, inspect the final diff and prove there is no change to public IPC channels, preload APIs, renderer DTOs, provider/settings/journal/artifact schemas, persisted user data, dependencies, package targets, generated artifacts, release procedures, or the Linux/Windows-only support matrix.
7. Inspect every new failure/log path. It may include bounded logical artifact ID, operation ID, phase, or cleanup outcome only; it must not include URLs, locations, headers, absolute paths, raw errors, audio, transcripts, prompts, credentials, device identifiers, or renderer-provided objects.
8. Automated matrix results are platform-specific evidence. Never report a command as passing on Linux or Windows unless that runner actually executed it successfully.
9. Complete both manual gates below using the same logical deterministic authenticated fixture/scenarios. Record only non-sensitive pass/fail evidence, OS/architecture, tested build identity, and any safe failure code. Do not record private paths, network headers, audio, transcript, profile, credential, or raw diagnostic content.
10. The workstream is complete only after all ten automated criteria and both manual criteria pass. Update `todo.md` and `handoff.md`; do not label partial Linux-only, Windows-build-only, or automated-only evidence as completion.

## Contracts And Boundaries

- Supported targets remain Linux x64 and Windows x64 only. Shared TypeScript remains platform-neutral unless an existing OS adapter requires a demonstrable local branch. macOS remains unavailable.
- Electron main retains HTTP, artifact, window, and IPC authority. Renderer behavior remains UI-local through the existing preload surface.
- The workflow uses deterministic local fixtures and repository dependencies only after installation. It receives no credential or privileged write permission.
- No persistence or migration is introduced. Rollback preserves journals, installed artifacts, settings, caches, and provider state.
- This packet does not authorize commits, pushes, pull requests, external qualification, packaging, release, or publishing. Those actions require their own explicit authority.

## Expected Files Or Components

- Modify `.github/workflows/pr-checks.yml`.
- Verify `package.json` and `package-lock.json`; no dependency or lockfile change is expected.
- Verify all production and test files changed by packets 1 through 3 for compatibility, privacy, logging, and generated-artifact cleanliness; modify them only to correct a gate failure within their already approved packet contracts.
- Update `docs/specs/local-whisper-desktop-review-remediation/tasks/todo.md` and `handoff.md` after all authorized automated and manual evidence is complete.

## Acceptance Criteria

- AC-AUT-001 through AC-AUT-009 pass through the focused deterministic suites on both supported runners wherever required by their platform traces.
- AC-AUT-010: every TST-005 command passes on both Linux x64 and Windows x64, production bundles build on both, production dependency audit passes at least once, and no dependency or generated artifact is added.
- AC-MAN-001 passes on a supported Linux x64 desktop.
- AC-MAN-002 repeats the same scenarios and outcomes on a supported Windows x64 desktop; build-only evidence is not substituted for runtime evidence.
- The final diff contains no F2 work, public/persisted contract change, migration, dependency, package/release change, macOS claim, sensitive diagnostic content, or deferred selected finding.

## Verification

The focused matrix must run these commands on both `ubuntu-latest` and `windows-latest`:

```bash
npm run test:local-whisper:artifacts
npm run test:local-whisper:ipc
npm run test:local-whisper:composition
npm run verify:local-whisper:ui
node --import tsx --test tests/scripts/localWhisper/qualification/QualificationArtifactHttpClient.test.ts tests/scripts/localWhisper/qualification/QualificationHttpsArtifactServer.test.ts
npm run typecheck
npm run test:types
npm run lint
npm run format:check
npm run build:prod
```

At least one unconditional PR job for the same revision must also run:

```bash
npm run audit:prod
```

For a local preflight on the available host, run the same commands that do not require an unavailable second operating system. The authoritative cross-platform result is the two-runner matrix, not a simulated platform environment.

## Failure And Rollback

- A failure on either runner leaves packet 4 and the workstream incomplete. Diagnose and correct only within the approved packet contracts; do not skip, conditionally disable, or weaken the check.
- A missing second-platform manual smoke leaves the merge gate open even when automation passes.
- If a fix would require a dependency, package target, migration, public contract, new support claim, or specification change, stop and return to specification/planning.
- Roll back the focused matrix job if the remediation is rolled back. Revert packets 1 through 3 coherently; never delete or rewrite user data and never ship a mixed internal response/stream interface.

## Manual Gates

- **MANUAL GATE — Linux x64 desktop (AC-MAN-001):** With a reviewed deterministic authenticated Local Whisper fixture and a supported Linux x64 application build, start and cancel a download; verify bounded cleanup/no orphan request; start a settings command and close the settings window while it is pending; verify no stale late UI result; reopen and verify the authoritative process-owned snapshot; trigger a same-document navigation attempt and verify the old subscription/capability is unusable; reload the canonical page and verify a fresh subscription works. Confirm no hang, crash, sensitive diagnostic output, or staging promotion.
- **MANUAL GATE — Windows x64 desktop (AC-MAN-002):** Repeat the exact Linux logical scenarios with the supported Windows x64 application build. Confirm equivalent runtime cleanup and capability behavior; do not substitute compilation or packaging evidence.
- **MANUAL GATE — external state:** Any GitHub Actions run, commit, push, pull request, public qualification, package, installer, release, or publication requires explicit user authorization. If unavailable, record the gate as pending rather than passed.

## References

- Mandatory contract anchors: `spec.md` sections 3, 4, 9, 10, 11, AC-AUT-001 through AC-AUT-010, and AC-MAN-001 through AC-MAN-002.
- Mandatory implementation context: `.github/workflows/pr-checks.yml`, `package.json`, the final packet 1–3 diff, and the named project-conventions sections.
- Optional background: `docs/reviews/2026-08-08-local-whisper-desktop-app-comments-to-address.md` and the complete source review.

## Completion And Handoff

- Mark packet 4 and the final completion item in [todo.md](todo.md) only after both automated runners and both manual gates pass.
- Update [handoff.md](handoff.md) with all completed packets, exact changed files, concise Linux/Windows command results, manual gate outcomes, and any remaining blocker. Include no sensitive evidence.
- Present packet 4 and the completed workstream for review and stop. Do not commit, push, open a pull request, qualify, package, publish, or release without separate authorization.
