# 13 Document The Feature And Run The Integration Gate

## Outcome

User-facing documentation accurately explains always-on metadata audit events,
default-off plaintext diagnostic capture, deletion and retention, private
archive export, and analysis-skill use. Cross-surface privacy/regression tests,
the complete project quality set, production dependency audit, and production
build pass without credentials, live providers, or private fixtures.

## Prerequisites

- Tasks 02–12 are complete and approved.
- Task 13 has separate execution authorization.
- The final archive, settings, IPC, and skill contracts are stable.

## Owned Requirements

- Integrated coverage for `SEC-001`–`SEC-009`
- Integrated coverage for `COMP-001`–`COMP-003`
- Integrated enforcement of `NONGOAL-001`–`NONGOAL-003`
- Remaining automated/project coverage for `AC-AUTO-001`

## In Scope

- `README.md` provider troubleshooting, diagnostics export/analysis, and
  privacy guidance.
- `SECURITY.md` disclosure of the explicit default-off plaintext diagnostic
  exception and private archive/report handling.
- Cross-family registry, lifecycle, privacy-canary, archive, settings,
  persistence, IPC, and skill fixture integration tests not cleanly owned by an
  earlier packet.
- Full unit/type/lint/format/dependency/build checks and packaged-runtime policy
  checks required by the `archiver` addition.
- Final automated requirement-coverage audit and handoff of manual gates.

## Out Of Scope

- New product behavior, telemetry, upload, issue creation, log viewer,
  compliance claims, provider fallback, storage encryption, release notes,
  version changes, installers, signing, publishing, or manual live-provider
  exercise.
- New translations invented by the agent. Locale implementation remains owned
  by Tasks 08 and 11.
- Completion of Windows/Linux packaged manual acceptance; Task 14 owns it.

## Task Contract

1. Update `README.md` so users can discover:
   - always-on metadata-only provider audit logging in the normal app log;
   - the three audited provider families and that cache hits are not provider
     operations;
   - the **Audit Log** settings section and independently default-off
     Translation/Prettify capture toggles;
   - successful provider and cache result capture only, never Voice
     audio/transcripts or raw provider responses;
   - best-effort `[REDACTED]` masking, plaintext SQLite, per-user permissions,
     the possibility of missed embedded secrets, and private-data handling;
   - 60-day retention, combined 100 MiB payload cap, 1 MiB row limit, confirmed
     disable/purge, and per-category/all clear actions;
   - About **Export diagnostics**, ZIP on Windows, tar.gz on Linux/macOS,
     automatic inclusion of enabled retained text, and lack of encryption;
   - the repository analysis skill’s required issue/expected/observed/time
     context and default ignored report path.
2. Update `SECURITY.md` only for the approved exception. State that known
   credentials are excluded/presence-only, arbitrary text redaction is not
   exhaustive, database/archive/report artifacts are private, and the app
   never uploads or opens them automatically.
3. Do not document internal free-form log wording as a contract. Document
   schema-versioned audit/archive behavior and user-visible controls only.
4. Add or extend an exhaustive registry test proving every current Voice,
   Prettify, and Translation provider has an audit mapping and safe manifest
   adapter.
5. Run an integrated privacy-canary matrix with unique synthetic markers in
   audio-adjacent data, selected source, prompt, transcript/result, model,
   credential/session/account data, URL, HTTP bodies, exceptions, argv,
   stdin/stdout/stderr, environment, paths, cache keys, and unrelated app logs.
   Assert:
   - audit logger arguments contain no marker;
   - manifest/events contain no marker;
   - diagnostic text contains only the intentionally enabled, redacted
     source/result fixture and none of the prohibited channels;
   - disabled categories and Voice never enter `text-actions.jsonl`;
   - reports never exceed the 200-character excerpt rule.
6. Add integration fixtures that run without Electron UI, network, providers,
   credentials, personal profiles, private audio/text, or user archives.
   Generate all archive fixtures in private temporary directories and remove
   them in teardown.
7. Prove provider results, localized errors, retry/recovery counts, renderer
   state, typed IPC outcomes, clipboard, notifications, cache behavior, and
   transcription history APIs remain unchanged.
8. Inspect the production lockfile/dependency tree for `archiver`. Verify it is
   pure JavaScript for the used path, has no native postinstall, and that
   archive creation code has no shell, external-process, network, or provider
   dependency. Keep the dependency direct and narrowly imported by the archive
   adapter.
9. Run the full project verification set. Treat any privacy, type, lint, unit,
   dependency-audit, or production-build failure as blocking; do not waive or
   suppress it.
10. Audit all 80 active specification IDs against `plan.md` and the task
    packets, and confirm `todo.md` is the sole completion checklist.

## Contracts And Boundaries

- Documentation must plainly describe the selected privacy tradeoff and never
  claim encryption or exhaustive secret detection.
- Automated fixtures contain synthetic public markers only. No test reads
  actual app data, logs, sessions, config, browser profiles, clipboard content,
  or user archives.
- Full checks do not authorize packaging, installers, signing, push, PR,
  release, or external service interaction.
- Distinct application/settings/infrastructure logs may remain but cannot enter
  diagnostics archives.

## Expected Files Or Components

- Update:
  - `README.md`;
  - `SECURITY.md`;
  - existing provider registry, settings, IPC, persistence, i18n, archive, and
    packaged-runtime policy tests where integration coverage belongs.
- Add focused integration tests only if existing owners cannot express the
  matrix cleanly, for example:
  - `tests/main/providerAuditPrivacy.test.ts`;
  - `tests/main/diagnosticsArchiveIntegration.test.ts`;
  - `tests/main/providerAuditRegistry.test.ts`.
- Update task artifacts only after checks complete.

## Acceptance Criteria

- Documentation covers every approved operational/privacy topic without
  promising encryption, exhaustive redaction, remote support, or compliance.
- Registry tests fail when any provider lacks audit or manifest mapping.
- Privacy canaries prove metadata-only audit/archive handling and tightly
  bounded default-off text capture across all three families.
- Disabled capture, Voice content, unrelated logs/config/session/database
  content, and raw provider output never enter an archive.
- Existing behavioral/regression tests remain unchanged in their public
  expectations and all pass.
- `archiver` is direct, audited, build-compatible, and reachable only from the
  main archive adapter.
- The full automated project verification set passes.

## Verification

Run focused integration tests first, then:

```text
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm test
rtk npm run audit:prod
rtk npm run build:prod
rtk npm run verify:packaged
rtk git diff --check
```

If `verify:packaged` requires a locally prepared package, record that as a
manual environment gate rather than changing package or release scope.

## Failure And Rollback

- A privacy canary, dependency audit, or behavior regression failure blocks the
  packet. Never remove the assertion or broaden an allowlist to obtain a pass.
- Documentation rollback reverts only the new guidance. Test rollback removes
  only new integration fixtures. Production feature rollback belongs to each
  earlier owning packet and must not delete user data without authorization.
- If retained plaintext exposure is discovered, leave export/capture disabled
  by normal code rollback and request separately authorized purge guidance;
  never silently delete user data.

## Manual Gates

- `npm run verify:packaged` is a manual environment gate when no prepared
  unpacked application exists.
- Dependency installation and lockfile update occurred in Task 10; no new
  install is authorized here.
- Do not run live providers, open user logs/data, request credentials, package
  installers, sign, commit, push, open a PR, or publish.

## References

- Mandatory:
  - `README.md`;
  - `SECURITY.md`;
  - `package.json`;
  - `scripts/packaged-runtime-policy.mjs`;
  - `docs/agent-guides/project-conventions.md`, “Project And Commands”, “Code
    And Logging”, “Desktop, Browser, And Packaging”, and “Tests And
    Documentation”.
- Traceability:
  - approved specification sections “Security and Privacy”, “Configuration and
    Operations”, “Compatibility”, and “Acceptance Criteria”.

## Completion And Handoff

- Mark Task 13 complete only after every automated check passes.
- Update `handoff.md` with documentation files, privacy-canary coverage,
  dependency/build evidence, exact checks, and Task 14 as the only next packet.
- Present evidence and stop. Do not begin manual/platform verification in the
  same invocation.
