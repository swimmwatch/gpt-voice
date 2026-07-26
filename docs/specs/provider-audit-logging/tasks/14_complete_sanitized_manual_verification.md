# 14 Complete Sanitized Manual Verification

## Outcome

Authorized manual checks on representative Linux and Windows packaged builds
confirm correlated provider-family audit behavior, optional diagnostic capture
and deletion, native archive formats/About behavior, and safe analysis reports
using synthetic non-private content. The final handoff records evidence and any
unavailable platform/provider gate without copying private diagnostic data.

## Prerequisites

- Task 13 is complete and approved.
- Task 14 has separate execution authorization.
- A human operator controls the test machines and any locally configured
  provider accounts; no credentials or private app data are shared with the
  agent.
- Use disposable synthetic text/audio and a private temporary output location.

## Owned Requirements

- `AC-MAN-001`
- All bullets under “Sanitized Manual Verification”
- Platform/manual portions of the archive, settings, capture, and skill
  acceptance criteria

## In Scope

- One synthetic success and one controlled failure for each provider family.
- Audit timeline/cause/severity/privacy inspection through exported normalized
  events, not raw unrelated app logs.
- Default-off, independent enable, provider/cache capture, redaction, retention
  limit fixtures, confirmed purge, and clear controls.
- Windows ZIP and Linux tar.gz About export behavior.
- Analysis of both synthetic archive formats with the repository skill.
- Evidence-only handoff updates with no private excerpts or archives committed.

## Out Of Scope

- Real personal text/audio, credentials, session/cookie inspection, production
  accounts supplied to the agent, destructive deletion outside confirmed
  diagnostic controls, remote upload, automatic issue creation, source fixes,
  release/signing/publishing, or macOS release enablement.
- Testing every provider implementation. The approved manual criterion requires
  one representative success/failure per family; automated packets own the
  exhaustive provider matrix.
- Circumventing authentication, challenges, rate limits, provider policy, OS
  dialogs, or overwrite confirmation.

## Task Contract

1. Before testing, confirm both capture toggles are absent/false in a legacy or
   fresh configuration and that metadata-only audit remains active.
2. Use synthetic non-private content and operator-owned provider configuration
   to exercise one successful and one expected failed operation for Voice,
   Prettify, and Translation. Do not ask the operator to reveal credentials,
   cookies, sessions, account identifiers, or provider output unrelated to the
   fixture.
3. Export diagnostics and verify each operation’s normalized timeline contains
   one opaque operation ID, sequence starting at one, semantic phases,
   retry/recovery only when exercised, exactly one terminal, expected cause,
   duration/attempt metadata, and outcome-derived severity.
4. Search normalized audit events for the synthetic privacy markers and confirm
   no audio, source, prompt, transcript/result, credential/session/account,
   model, URL/path, body, CLI output, argv/environment, or cache marker appears.
5. Enable Translation capture only. Confirm:
   - future provider success stores source/result;
   - a cache-hit success stores a second row with `source_kind: cache` and null
     provider operation ID;
   - Prettify and earlier actions remain absent;
   - best-effort matches become exact `[REDACTED]`;
   - the warning states plaintext, possible missed secrets, automatic
     unencrypted export inclusion, and private handling.
6. Repeat independently for Prettify. Confirm one provider row and one cache
   row, correct provider correlation, and no Voice row.
7. Use synthetic storage fixtures or approved test controls—not private app
   data—to verify:
   - a row at the 1 MiB UTF-8 boundary is accepted and one byte above is
     skipped without changing action success;
   - rows older than 60 days are pruned;
   - oldest rows across both categories are removed before combined retained
     payload exceeds 100 MiB;
   - transcription history remains unchanged.
8. Cancel a true-to-false toggle confirmation and confirm setting/data remain.
   Then confirm and purge one category. Exercise Clear Translation, Clear
   Prettify, and Clear all and confirm toggles do not change. Inject or use the
   approved safe failure fixture to confirm purge failure leaves capture
   enabled.
9. On Windows:
   - open About and start export;
   - verify the unique
     `gpt-voice-diagnostics-<UTC-basic-timestamp>-<8-hex>.zip` default, filter,
     extension handling, parented dialog, duplicate-click suppression, and
     native overwrite confirmation;
   - verify cancel creates no file/notification and leaves About open;
   - verify success creates a valid ZIP, shows success notification, and closes
     About;
   - verify injected failure removes partial output, reports a safe failure,
     leaves About open, and permits retry.
10. On Linux repeat item 9 for
    `gpt-voice-diagnostics-<UTC-basic-timestamp>-<8-hex>.tar.gz`. Unit coverage
    owns Darwin selection; if a macOS machine is available, record the same
    tar.gz smoke without treating unavailable macOS as permission to alter the
    paused packaging policy.
11. Inspect both archives with safe tooling and confirm only:
    `manifest.json`, `provider-audit/events.jsonl`, and—when enabled rows
    exist—`diagnostics/text-actions.jsonl`. Confirm manifest hashes/lengths,
    valid/invalid/duplicate extraction counts, safe provider/runtime metadata,
    and absence of raw logs, database/config/session/profile/cache/crash data.
12. Run the repository `analyze-diagnostics-archive` skill separately against
    the synthetic ZIP and tar.gz. Provide archive path, issue description,
    expected behavior, observed behavior, and approximate time.
13. Confirm each ignored
    `.artifacts/diagnostics/<archive-id>/report.md` contains validation,
    environment/provider summary, chronological correlation, ranked root cause,
    evidence IDs/member lines, contradictions/uncertainty, and next checks.
    Excerpts must be best-effort-redacted and at most 200 characters; no full
    source/result or persistent extraction directory remains.
14. Record only sanitized pass/fail summaries, platform/app version, archive
    schema, and evidence IDs needed to establish coverage. Do not copy an
    archive, database, raw log, report excerpt, path, username, host, account
    detail, or credential into Git or `handoff.md`.

## Contracts And Boundaries

- Provider/account setup and OS dialog interaction are human-owned `MANUAL
GATE` actions. The agent never receives or types secrets.
- The archive is unencrypted and remains in a private operator-controlled
  location. Do not upload, attach, open externally, or commit it.
- Use only the About flow for destination selection; never invoke a hidden
  renderer filesystem path or modify trusted-sender validation.
- A failed platform or provider gate remains explicitly incomplete. Do not
  infer a pass from unit tests or another OS.

## Expected Files Or Components

- Update only:
  - `docs/specs/provider-audit-logging/tasks/todo.md`;
  - `docs/specs/provider-audit-logging/tasks/handoff.md`.
- Synthetic archives, reports, screenshots, logs, databases, and temporary
  fixtures remain untracked and are removed or retained privately by the
  operator according to their choice.

## Acceptance Criteria

- One success/failure per family has a privacy-safe correlated lifecycle and
  exactly one terminal event.
- Independent capture, cache/provider rows, redaction, limits, purge, clear,
  and failure behavior match the contract without changing user actions or
  history.
- Windows produces ZIP and Linux produces tar.gz with identical fixed internal
  schema and correct About cancel/success/failure behavior.
- Both formats pass the repository skill and yield evidence-linked reports with
  bounded excerpts and no persistent extraction.
- No credential, private content, archive, raw log, database, report content,
  or identifying path is committed or reproduced in the handoff.

## Verification

After manual evidence is recorded, run the non-mutating task-artifact checks:

```text
rtk npx prettier --check "docs/specs/provider-audit-logging/tasks/**/*.md"
rtk git diff --check
rtk git status --short
```

Record platform-specific commands and sanitized outcomes in `handoff.md`
without pasting logs.

## Failure And Rollback

- Any prohibited data, duplicate/missing terminal, partial archive, mismatched
  hash, wrong member, unbounded excerpt, or provider/action behavior change
  blocks completion and returns the defect to its owning packet.
- Manual checks mutate only test settings/diagnostic rows and private archive
  files. Use the confirmed clear controls to remove synthetic rows; delete
  private archives/reports only through the operator’s normal recoverable file
  workflow.
- Do not patch production code in this packet. A discovered defect requires a
  revised/authorized owning implementation packet.

## Manual Gates

- `MANUAL GATE`: operator-controlled Windows packaged application.
- `MANUAL GATE`: operator-controlled Linux packaged application.
- `MANUAL GATE`: any existing provider configuration or authentication.
- `MANUAL GATE`: OS save/overwrite dialogs, notifications, About close/retry,
  and private archive/report inspection.
- No commit, push, pull request, release, upload, signing, or publication is
  authorized.

## References

- Mandatory:
  - Task 13 handoff and exact completed checks;
  - the installed application’s About and App Settings flows;
  - `.agents/skills/analyze-diagnostics-archive/SKILL.md`;
  - `docs/agent-guides/project-conventions.md`, “Desktop, Browser, And
    Packaging”.
- Traceability:
  - approved specification “Sanitized Manual Verification” and the manual
    portions of “Acceptance Criteria”.

## Completion And Handoff

- Mark Task 14 complete only when every required Windows/Linux/provider gate
  has explicit sanitized evidence. Otherwise leave it unchecked and list the
  unavailable gate.
- Update `handoff.md` with completed platforms, sanitized result summary, final
  check names, and blockers only.
- Present final acceptance status and stop. Do not commit, publish, or begin a
  defect fix.
