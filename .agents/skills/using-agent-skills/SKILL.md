---
name: using-agent-skills
description: Use only when the user explicitly asks for skill-selection help or the compact catalog is unavailable; never use at session start or to start a lifecycle.
---

# Using Agent Skills

Use the runtime catalog's name and description to choose a skill. Do not read any `SKILL.md` while deciding.

## Selection Rules

1. Prefer an explicitly named skill.
2. Otherwise choose one primary skill that directly matches the requested outcome.
3. Add one supporting skill only when the primary cannot complete the task safely without it.
4. Do not add spec, planning, TDD, review, simplification, documentation, or shipping steps by default.
5. Do not use a persona and an equivalent skill together. Personas require an explicit role or report-format request.
6. If no catalog entry clearly applies, continue without a skill or ask one focused question; do not load this skill again.

## Default Mapping

| Request                         | Primary skill                  |
| ------------------------------- | ------------------------------ |
| Small multi-file implementation | `incremental-implementation`   |
| Diagnose or fix broken behavior | `debugging-and-error-recovery` |
| Test-first workflow             | `test-driven-development`      |
| Code review                     | `code-review-and-quality`      |
| Task decomposition              | `planning-and-task-breakdown`  |

## After Selection

- State the selected primary skill and any essential supporting skill in one sentence.
- Read only the selected `SKILL.md` and only references it explicitly requires for the current task.
- Keep task state in the scoped `tasks/handoff.md`; start a new session after a major workstream switch.
