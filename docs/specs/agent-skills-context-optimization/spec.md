# Spec: Agent Skills Context Optimization

Status: Complete
Date: 2026-07-12

## Objective

Reduce persistent agent context while preserving manual and narrow automatic use of the project-local `agent-skills` catalog.

## Requirements

- Keep the always-on project router below 80 lines and exclude full skill workflows, examples, and checklists.
- Make the skill catalog on-demand: full `SKILL.md` text is read only after a selected skill.
- Permit one primary skill per task and one essential supporting skill at most.
- Remove the user-selected skills and their dedicated reference material.
- Narrow local skill descriptions so routine implementation, test execution, commits, UI edits, and external integrations do not activate overlapping workflows.
- Retain personas for explicit requests only; routine work uses the equivalent skill instead.
- Keep detailed project conventions and compact task handoffs outside always-on instructions.

## Non-Goals

- Change platform-controlled system/developer prompts, delete plugin caches, or alter unrelated user-level approval rules.
- Rotate or reconfigure external-service credentials without explicit confirmation.

## Acceptance Criteria

- The router and meta-skill have automated policy checks for length and prohibited broad triggers.
- Each local skill description has an explicit narrow-use condition.
- The project contains a compact handoff artifact with status, files, checks, next work, and blockers.
- Focused policy tests, test TypeScript coverage, linting, and formatting checks pass.
- The user-selected skills and references no longer exist in the local catalog.
