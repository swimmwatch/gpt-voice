# Handoff: Claude Web Voice and CLI Prettify Providers

Status: Task 01 complete and approved. Task 02 is the next unchecked packet.

Completed:

- Mapped the existing ChatGPT Web, browser-session, transcription, and Prettify provider architecture.
- Sanitized and analyzed the supplied Claude HAR.
- Studied the authenticated Claude UI, current JavaScript/CSS, and a no-audio WebSocket canary through Chrome DevTools MCP.
- Inspected installed Claude Code and Codex CLI capabilities without running a model request.
- Wrote the Phase-1 specification.
- Resolved language, organization selection, executable path, fallback model, timeout, and Codex experimental-gate decisions.
- Mapped exact voice, browser-session, Prettify, renderer, IPC, packaging, test,
  localization, and documentation boundaries with CodeGraph.
- Created 20 dependency-ordered, independently verifiable task packets.
- Added hard review gates for buffered replay and Codex schema packaging.
- Created an empty isolated Claude research context through Chrome DevTools MCP.
- Verified that the new context is logged out and did not reuse the shared
  personal-profile Claude tab.
- Revalidated a user-authenticated isolated context using sanitized page-context
  results only: credentialed organization access passed, omitted credentials
  failed, and multiple organizations were present.
- Established a deterministic active-organization rule from one authenticated
  bootstrap-path candidate matching exactly one `uuid` field, never list order.
- Rechecked sanitized HAR endpoint metadata and completed a no-audio socket
  canary without `conversation_uuid`; it opened and closed cleanly.
- Created a separate persistent CloakBrowser research profile outside the
  repository, let the user sign in manually, closed it cleanly, and reopened it
  in a new process. Sanitized page-context authentication passed after restore.
- After a bounded wait, the restored page exposed exactly one active
  bootstrap-path candidate. It matched one `uuid` field, and the no-audio
  private-endpoint canary opened and closed cleanly without choosing by order.
- Added a narrow ignore rule for the local HAR capture. The capture remains
  local, untracked, and unreferenced by runtime code.
- Revised later packets to separate active-organization routing from private
  `personal | organization | unknown` account-scope classification.
- Added deferred Task 20 as the future research/spec gate for any
  personal-specific behavior or UI. It does not block Phase 1.

Changed files:

- `docs/specs/claude-web-voice-provider/spec.md`
- `docs/specs/claude-web-voice-provider/tasks/plan.md`
- `docs/specs/claude-web-voice-provider/tasks/todo.md`
- `docs/specs/claude-web-voice-provider/tasks/handoff.md`
- `docs/specs/claude-web-voice-provider/tasks/01_*.md` through
  `docs/specs/claude-web-voice-provider/tasks/20_*.md`
- `docs/researches/claude-web-voice-provider/main.md`
- `.gitignore`

Checks:

- All 20 task packets contain every required contract section.
- All 20 plan/todo packet links resolve.
- Prettier passes for the specification and all planning artifacts.
- Sensitive UUID/credential-value scans pass.
- Contradictory legacy task names/gates were not found.
- git diff --check passes.
- Isolated-context check passed: the new context reached Claude sign-in without
  authenticated state; no authentication, cookie-consent, or private-endpoint
  interaction was performed.
- Prettier, UUID/credential-value scans, and `git diff --check` pass for the
  current research update.

Next step:

- Commit the approved Task 01 packet, then execute
  `02_prove_buffered_replay_and_lifecycle.md` in one incremental invocation.

Blockers:

- Claude Web production tasks are gated on the Gate A decision in Task 02.
- Task 14 requires explicit approval to add the Codex schema to packaged
  runtime assets.
- Personal-specific behavior is gated on future Task 20 and an explicitly
  authorized account state; Phase 1 keeps scope `unknown` without blocking
  resolved routing.
