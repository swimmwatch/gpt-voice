# 19 Document And Verify All New Providers

## Outcome

Canonical user documentation explains Claude Web and CLI setup/privacy/
limitations, all focused and full quality gates pass, packaged runtime contents
are verified, and sanitized manual evidence confirms the complete feature.

## Prerequisites

- Tasks 01-18 are complete and approved.
- Authorized isolated Claude Web, Claude CLI, and Codex CLI test accounts are
  available for optional manual canaries.
- No unresolved Gate B or Codex packaging/capability blocker remains.

## In Scope

- User-facing setup, prerequisites, privacy/quota, controls, troubleshooting,
  protocol volatility, and revalidation documentation.
- Focused regression, full quality, CloakBrowser, audit/build, packaging, and
  packaged-runtime checks.
- Sanitized manual Claude Web and CLI verification.
- Final privacy inspection of logs, configuration, package contents, and git
  status.

## Out Of Scope

- Release/version changes, publishing, pushing, installer target changes,
  dependency additions, live-provider CI, or storing screenshots/raw canary
  artifacts.

## Task Contract

1. Update the canonical README/user-guide navigation and provider setup page.
   Preserve unrelated user-guide work and do not edit generated site output.
2. Document Claude Web login/clear flow, explicit language, private endpoint
   volatility, deterministic organization behavior, supported PCM path,
   protocol-change recovery, and no external Chrome-profile dependency.
3. Document Claude/Codex CLI prerequisites, PATH versus absolute executable
   path, CLI-owned authentication, model/default/fallback, effort/verbosity,
   15-600 timeout with 120 default, cancellation, and sanitized troubleshooting.
4. State that selected text is sent through the user's provider account and may
   consume subscription/API quota. Do not imply GPT-Voice stores CLI auth.
5. State that Codex is experimental and unavailable when the no-tools/schema
   capability gate fails, with no bypass.
6. Document only supported controls; do not mention deferred cost ceilings,
   undocumented token/thinking variables, arbitrary arguments, or account
   metadata as available features.
7. Manually verify Claude with an isolated GPT-Voice session and synthetic/
   non-private audio: login, save/restart/restore, language, first and
   consecutive transcription, compressed fallback rejection, provider switch,
   clear auth, expiry, interruption, timeout/protocol-change error, and cleanup.
8. Manually verify each CLI with authorized synthetic inert text: PATH and
   configured path including spaces, restart persistence, installation/auth
   failures, default/custom model, Claude fallback/effort, Codex
   effort/verbosity/gate, cancellation, timeout, and quota disclosure.
9. Inspect logs and stored configuration for absence of account IDs, cookies,
   tokens, audio, selected text, transcript, stdout/output, raw stderr, browser
   URLs, environment, and full executable paths.
10. Record only pass/fail, versions, durations/ranges, platform, and safe error
    categories in handoff.md. Do not retain raw provider output or personal
    content.
11. If a check reveals a material contract defect, reopen the owning packet or
    create a focused follow-up packet; do not hide it in broad final cleanup.
12. Document that Phase 1 routes from one proven active organization, supports
    multi-organization accounts with deterministic active state, and does not
    infer or expose personal/organization scope. `unknown` scope is usable when
    routing is resolved; personal-specific behavior is a future research-gated
    follow-up rather than a current setting.

## Architecture And File Boundaries

- Update README.md and the canonical source files under docs/user-guide as
  required by current navigation.
- Update the sanitized research revalidation checklist only when observed
  contract evidence changed.
- Update task todo.md and handoff.md.
- Do not edit build/github-pages or other generated output.

## Acceptance Criteria

- Setup/privacy/troubleshooting documentation covers all three providers and
  matches current UI/behavior.
- Claude documentation distinguishes active routing from future account-scope
  classification and does not imply a personal-state chooser exists.
- Every focused and full automated gate passes.
- CloakBrowser preparation/smoke and production audit/build pass.
- Package and packaged-runtime verification include the schema and exclude CLI
  binaries, auth/config, tests, research artifacts, and generated sensitive
  data.
- Sanitized manual checks pass on required supported platforms or are recorded
  as explicit platform blockers.
- No sensitive or generated canary artifact is tracked.
- The human reviews the completed feature before merge.

## Verification

- npm run format:check
- npm run lint
- npm run typecheck
- npm run test:types
- npm test
- npm run prepare:cloakbrowser
- npm run smoke:cloakbrowser
- npm run audit:prod
- npm run build:prod
- npm run pack
- npm run verify:packaged
- Review git diff --check, scoped diff, status, package contents, logs, and
  persisted config.

## References

- Mandatory: completed task handoff and sanitized research record.
- Mandatory: docs/agent-guides/project-conventions.md sections Project And
  Commands, Desktop Browser And Packaging, Tests And Documentation, and Git And
  Releases.
- Optional traceability: Testing Strategy, Boundaries, all Success Criteria, and
  Quality Gate.

## Completion And Handoff

- Mark Task 19 complete only after all acceptance criteria and the project
  Definition of Done pass.
- Update handoff.md with completed packets, changed files, exact checks,
  sanitized manual outcomes, remaining platform blockers, and no next
  implementation packet.
- Present the finished feature for final human review and stop. Do not commit,
  push, publish, or release without an explicit subsequent request.
