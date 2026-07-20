# 20 Research And Plan Claude Personal Scope State

## Outcome

Sanitized evidence determines whether Claude exposes a stable personal-scope
signal and whether personal scope needs behavior beyond the existing resolved
organization UUID routing. If distinct behavior is required, the specification
and focused follow-up task packets are revised before production implementation.

## Prerequisites

- Task 01 is complete and its privacy rules remain in force.
- The user explicitly authorizes an isolated test state that Claude presents as
  personal, optionally alongside a separate organizational state.
- Chrome DevTools MCP or a dedicated persistent CloakBrowser research profile
  can inspect the authorized page without importing a personal/shared browser
  profile into GPT-Voice.
- This task is deferred and does not block Phase 1.

## In Scope

- Identify stable field names, endpoint paths, and state transitions that
  distinguish personal, organization, and unknown scope.
- Compare personal-only, personal-active-among-multiple, and
  organization-active-among-multiple states when explicitly authorized.
- Confirm whether personal transcription still uses a validated
  `organization_uuid` query value or requires a different private contract.
- Decide whether personal scope is classification-only or requires distinct
  provider, error, settings, or UI behavior.
- Revise the durable specification and create focused implementation packets
  only when verified evidence requires them.

## Out Of Scope

- Production provider, session, IPC, renderer, localization, or documentation
  code.
- Organization chooser, account switcher, captured UUID persistence, or account
  metadata display.
- Reading or retaining names, identifiers, credentials, personal content, raw
  responses, screenshots, audio, transcripts, or browser profiles.
- Inferring personal scope from response count/order, display name,
  subscription/plan labels, or identifier shape.

## Task Contract

1. Record only endpoint/field names, counts, enum/category names, statuses,
   timing ranges, and pass/fail outcomes. Never record raw values or URLs that
   contain identifiers.
2. Accept `personal` as a production classification only when a stable explicit
   same-origin signal is observed across fresh and restored contexts. Otherwise
   retain `unknown`.
3. Keep organization routing and account scope independent. A uniquely resolved
   active UUID remains usable with `unknown` scope; classification alone never
   selects an organization.
4. Validate any personal-state WebSocket canary without audio first and without
   `conversation_uuid`. Do not proceed to audio/lifecycle experiments in this
   packet.
5. If personal and organization scopes share the same resolved UUID routing and
   failure behavior, record that no production branch is justified.
6. If behavior differs, revise `spec.md` with the verified state machine,
   privacy/UI boundary, failure handling, and acceptance criteria. Then create
   one self-contained numbered packet per affected subsystem through the
   planning workflow.
7. Do not implement those follow-up packets or alter Phase-1 production code in
   this invocation.

## Architecture And File Boundaries

- Update `docs/researches/claude-web-voice-provider/main.md` with sanitized
  evidence and the evidence date.
- Update `docs/specs/claude-web-voice-provider/spec.md` only if the verified
  durable contract changes.
- Update `tasks/plan.md`, `tasks/todo.md`, and `tasks/handoff.md`; add focused
  follow-up packets only when the evidence justifies implementation.
- Do not edit `src`, `tests`, package metadata, generated documentation, or
  packaging files.

## Acceptance Criteria

- A reviewer can distinguish routing resolution from account-scope
  classification without account identifiers or names.
- Fresh and restored personal-state outcomes are recorded separately when an
  authorized state is available.
- The research either identifies one stable explicit personal signal or
  explicitly retains `unknown`; no heuristic is accepted.
- The no-audio query contract is classified as shared or different for personal
  scope using sanitized evidence.
- The decision states whether production behavior should remain unchanged or
  lists focused follow-up packets with testable contracts.
- No credential, session, profile, screenshot, HAR, audio, transcript, or raw
  provider artifact is tracked.

## Verification

- Run Prettier over changed Markdown artifacts.
- Run the research-directory UUID and credential-value scans from Task 01.
- Confirm git status contains no HAR, browser profile, session, screenshot,
  audio, transcript, or raw response artifact.
- Manually review the specification/plan diff for forbidden inference rules and
  complete coverage of any new requirement or acceptance criteria.

## References

- Mandatory: the sanitized Task 01 research record and its data-handling rules.
- Mandatory: `spec.md` Claude Web Requirements 5-6 and 17, R2, Resolved Product
  Decisions 2 and 7, and Boundaries.
- Mandatory: `.agents/references/task-packets.md` if follow-up implementation
  packets are required.

## Completion And Handoff

- Mark Task 20 complete only after the sanitized evidence and resulting
  no-change or follow-up-plan decision receive human review.
- Update `handoff.md` with evidence date, decision, changed artifacts, checks,
  exact next packet if one was created, and blockers.
- Present the personal-scope decision for review and stop. Do not commit,
  implement a follow-up packet, or begin another task in the same invocation.
