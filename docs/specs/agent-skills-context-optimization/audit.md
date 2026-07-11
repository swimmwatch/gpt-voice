# Agent Skills Context Audit

Date: 2026-07-12
Scope: project-local `.agents`, project/global `AGENTS.md`, and user Codex metadata. No credentials, histories, or session data are reproduced here.

## Findings

| Surface              |                                                  Before | Result                                                                                                       |
| -------------------- | ------------------------------------------------------: | ------------------------------------------------------------------------------------------------------------ |
| Project `AGENTS.md`  |                                230 lines / 14,047 bytes | Replaced with a 40-line / 3,013-byte router. Detailed project rules moved to an on-demand guide.             |
| `using-agent-skills` |               191 lines and a startup/lifecycle trigger | Replaced with a 33-line manual selection helper. It no longer triggers at session start or chains workflows. |
| Local skill bodies   | 26 skills / 7,051 lines before the meta-skill reduction | They remain available on demand. Their catalog descriptions now use explicit narrow triggers.                |
| Persona definitions  |                                4 registered definitions | Retained for explicit persona/report requests; descriptions direct routine work to the equivalent skill.     |

## Loading Model

- Always-on project text is the global 10-line CodeGraph instruction plus the project router. The user-level `default.rules` file has 46 tool-approval rules; it is not a skill catalog and was not changed because it affects unrelated projects.
- The runtime exposes a compact skill index (name, description, location). There is no evidence that the 26 local `SKILL.md` bodies are injected into every request.
- Full skill text is now intended to load only after a selected skill. `using-agent-skills` is not a startup dependency.
- The system-provided prompt and plugin catalogs are platform-controlled and outside this repository's configuration scope.

## Broad-Trigger Risks Removed

Before this change, the meta-skill explicitly prescribed a chain from ideation through shipping, while descriptions activated workflows for any multi-file edit, behavior change, browser UI, input handling, commit, documentation, or unfamiliar code. That could combine several 200- to 460-line skills in one session.

The router now allows one primary skill and at most one essential supporting skill. Each local description begins with an explicit `Use only ...` condition. Routine regression testing remains allowed without loading the TDD workflow.

## Duplicates And Security Notes

- No global `agent-skills` plugin installation was found; the active catalog is project-local.
- Two cached versions of the GitHub plugin contain four duplicate GitHub skills. The current catalog exposes one version, so this is disk/cache ambiguity rather than ongoing prompt context. Do not delete cache directories without confirming the plugin manager's cleanup behavior.
- A user-level Codex configuration contains a hard-coded external-service credential. It is not included here. Rotate it and move the replacement to an environment variable in a separate approved security change.

## Remaining Decision

No skills were removed. Removal candidates require the user's choice because deletion changes manual availability. The compact router and regression test continue to permit removal without reintroducing broad activation.
