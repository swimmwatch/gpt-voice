# 01 Revalidate Claude Authentication And Organization Discovery

## Outcome

A sanitized research record proves whether a fresh GPT-Voice Claude login and a
restored background context can authenticate the private speech endpoint and
derive one active organization deterministically. No production code is
changed.

## Prerequisites

- The task plan is approved.
- The user explicitly authorizes an isolated Claude test session for Chrome
  DevTools MCP research.
- Chrome DevTools MCP can inspect the authorized Claude page.
- The supplied HAR may be consulted as untrusted evidence but remains outside
  the repository.

## In Scope

- Reproduce the endpoint metadata found in the HAR and current frontend assets.
- Test a fresh GPT-Voice-style login context and a separately restored
  background context.
- Identify the minimum cookie/origin storage required for page-context access.
- Discover an authenticated active-organization signal and validate it against
  the organizations response.
- Exercise single- and multi-organization states when authorized.
- Create docs/researches/claude-web-voice-provider/main.md with sanitized
  findings, version/date markers, uncertainties, and repeatable steps.

## Out Of Scope

- Sending microphone or personal audio.
- Buffered replay, pacing, transcript finalization, or lifecycle experiments.
- Production provider, settings, IPC, or renderer changes.
- Persisting or exposing an organization chooser.
- Importing the user's external Chrome profile into GPT-Voice.

## Task Contract

1. Use only an explicitly authorized isolated test session. Chrome MCP and the
   HAR are evidence sources, never production dependencies.
2. Record endpoint path, query names, header names, status, event names, storage
   categories, and pass/fail results only. Do not retain header values, cookies,
   tokens, organization or account identifiers, URLs containing identifiers,
   personal page content, or raw response bodies.
3. Validate fresh-login and restored-context behavior independently. Do not
   infer restoration from the already authenticated research page.
4. Determine whether cookies are sufficient or whether localStorage or
   IndexedDB state is required. Record categories and behavior, not values.
5. Derive the active organization from authenticated bootstrap state or
   same-origin traffic, then validate membership against the organizations
   response.
6. Never select an organization by list order. If more than one eligible
   organization remains and active state cannot be proven, record a blocker and
   the required safe-failure behavior.
7. Confirm whether conversation_uuid may be omitted for standalone
   transcription without sending audio.
8. Treat generated DOM IDs, hashed asset filenames, account values, and current
   response ordering as volatile evidence rather than contracts.

## Architecture And File Boundaries

- Create only docs/researches/claude-web-voice-provider/main.md.
- Do not add credentials, session files, screenshots, HAR files, browser
  profiles, or captured application assets.
- Do not edit src, tests, package metadata, or packaging files.

## Acceptance Criteria

- The research record identifies the endpoint contract version/date and the
  tested browser/runtime context.
- Fresh and restored contexts have separate sanitized outcomes.
- The minimum required storage categories are stated without values.
- Active-organization discovery has a deterministic rule validated against the
  organizations response, or the task records a blocking ambiguity and stops.
- Single- and multi-organization evidence never includes identifiers or names.
- Standalone omission of conversation_uuid has a sanitized pass/fail result.
- A reviewer can repeat the investigation without access to captured secrets or
  personal content.

## Verification

- Review the research diff manually before any commit.
- Run a UUID-value scan against the research directory:

  ```bash
  rg -n -i '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}' docs/researches/claude-web-voice-provider
  ```

- Scan for captured credential headers and session values:

  ```bash
  rg -n -i '(coo[k]ie:|set-coo[k]ie:|authoriz[a]tion:|bea[r]er[[:space:]]+[[:alnum:]_.-]+|sess[i]on(key|token)[[:space:]]*[:=])' docs/researches/claude-web-voice-provider
  ```

- Confirm git status contains no HAR, profile, screenshot, audio, or session
  artifact.

## References

- Mandatory: AGENTS.md privacy and provider boundaries.
- Mandatory: docs/agent-guides/project-conventions.md sections Code And Logging,
  Electron And Providers, and Desktop, Browser, And Packaging.
- Optional traceability: spec headings Claude Web Provider Study, R1, R2,
  Boundaries, and Resolved Product Decisions 1-2.

## Completion And Handoff

- Mark this packet complete in todo.md only after the sanitized scans pass.
- Record the research file, evidence date, exact outcome, checks, and any
  blocker in handoff.md.
- Set 02_prove_buffered_replay_and_lifecycle.md as the exact next packet.
- Present the research decision for review and stop. Do not commit this packet
  or begin Task 02 in the same invocation.
