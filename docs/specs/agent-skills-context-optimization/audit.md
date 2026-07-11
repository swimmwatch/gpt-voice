# Agent Skills Context Audit

Date: 2026-07-12
Scope: project-local `.agents`, project/global `AGENTS.md`, and user Codex metadata. No credentials, histories, or session data are reproduced here.

## Findings

| Surface              |                                                  Before | Result                                                                                                         |
| -------------------- | ------------------------------------------------------: | -------------------------------------------------------------------------------------------------------------- |
| Project `AGENTS.md`  |                                230 lines / 14,047 bytes | Replaced with a 40-line / 3,013-byte router. Detailed project rules moved to an on-demand guide.               |
| `using-agent-skills` |               191 lines and a startup/lifecycle trigger | Removed after routing was reduced to the runtime catalog.                                                      |
| Local skill bodies   | 26 skills / 7,051 lines before the meta-skill reduction | 14 remain on demand after the user-selected removals; their catalog descriptions use explicit narrow triggers. |
| Persona definitions  |                                4 registered definitions | Retained for explicit persona/report requests; descriptions direct routine work to the equivalent skill.       |

After the user-selected removals, 14 local skills and five general references remain.

## Loading Model

- Always-on project text is the global 10-line CodeGraph instruction plus the project router. The user-level `default.rules` file has 46 tool-approval rules; it is not a skill catalog and was not changed because it affects unrelated projects.
- The runtime exposes a compact skill index (name, description, location). There is no evidence that the 14 remaining local `SKILL.md` bodies are injected into every request.
- Full skill text is intended to load only after a selected skill. No project-local meta-skill is a startup dependency.
- The system-provided prompt and plugin catalogs are platform-controlled and outside this repository's configuration scope.

## Broad-Trigger Risks Removed

Before this change, the meta-skill explicitly prescribed a chain from ideation through shipping, while descriptions activated workflows for any multi-file edit, behavior change, browser UI, input handling, commit, documentation, or unfamiliar code. That could combine several 200- to 460-line skills in one session.

The router now allows one primary skill and at most one essential supporting skill. Each local description begins with an explicit `Use only ...` condition. Routine regression testing remains allowed without loading the TDD workflow.

## Duplicates And Security Notes

- No global `agent-skills` plugin installation was found; the active catalog is project-local.
- Two cached versions of the GitHub plugin contain four duplicate GitHub skills. The current catalog exposes one version, so this is disk/cache ambiguity rather than ongoing prompt context. Do not delete cache directories without confirming the plugin manager's cleanup behavior.
- A user-level Codex configuration contains a hard-coded external-service credential. It is not included here. Rotate it and move the replacement to an environment variable in a separate approved security change.

## Remaining Decision

The user selected 12 skills for removal: `using-agent-skills`, `api-and-interface-design`, `browser-testing-with-devtools`, `ci-cd-and-automation`, `debugging-and-error-recovery`, `deprecation-and-migration`, `frontend-ui-engineering`, `git-workflow-and-versioning`, `observability-and-instrumentation`, `shipping-and-launch`, `source-driven-development`, and `test-driven-development`. Their dedicated `observability-checklist.md` and `testing-patterns.md` references were removed with them. The policy test prevents accidental restoration.
