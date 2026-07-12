# Spec: Agent Execution Efficiency

Status: Approved
Date: 2026-07-11
Scope owner: Agent workflow and repository instructions

## Objective

Reduce avoidable agent-context and tool-output consumption without reducing code quality, privacy safeguards, or required verification.

## Requirements

- Agents read only the scoped specification artifacts and source needed for the active increment.
- Agents use narrow symbol queries and bounded source reads before broad repository exploration.
- Routine command output is limited to actionable summaries; temporary verbose logs remain outside the repository.
- Each increment uses focused verification. The full quality gate runs once after the final relevant code change for a task.
- Packaging, browser, installer, and platform checks remain required when the task affects those surfaces or explicitly requires them.
- Agent progress messages remain concise and do not repeat plans or command output.

## Non-Goals

- Removing tests, type checks, linting, security audits, packaging verification, or runtime smoke checks.
- Changing product behavior, dependencies, build output, or CI behavior.
- Storing execution logs or private data in the repository.

## Acceptance Criteria

- `AGENTS.md` defines bounded reading, output, and verification practices.
- The incremental implementation skill applies the same rules during multi-file work.
- The changes preserve the existing task artifact structure and Definition of Done.

## Verification

- Review the updated instructions for consistency with the repository's verification and privacy rules.
- Run formatting checks for the edited Markdown files.
