# Agent Orchestration Patterns

Use this reference when changing GPT-Voice skill routing, adding a slash-command
route, or coordinating several independent review perspectives.

## Governing Rules

1. The user is the lifecycle orchestrator. Do not run specification, planning,
   implementation, review, pull-request, and release phases automatically.
2. Prefer one agent with the narrowest matching skill for one artifact.
3. Use multiple agents only when the user or applicable repository
   instructions explicitly request delegation or parallel agent work and the
   current client supports it.
4. Personas and skills do not recursively invoke other personas. Recommend a
   follow-up rather than hiding additional cost or authority.
5. Prompt MCP gathers material user decisions; it is not an agent orchestrator.
6. The only project-defined slash routes are `/spec` and `/plan`.

## Direct Skill Invocation

Use one skill when the task has one outcome and one perspective:

```text
user -> matching skill -> artifact or report -> user
```

Examples:

- explicit code review -> `code-review-and-quality`;
- explicit security audit -> `security-and-hardening`;
- documentation reconciliation -> `project-docs-maintainer`;
- pull-request work -> `project-pull-request`;
- release work -> `project-release`.

Do not add a router persona whose only job is to choose another skill.
`.agents/skills/using-agent-skills/SKILL.md` is the catalog.

## User-Driven Sequential Workflow

Substantial work follows explicit gates:

```text
user invokes /spec
  -> approved specification
user invokes /plan
  -> approved plan and separate execution authorization
user authorizes one task packet
  -> implementation and verification stop
user separately authorizes commit, PR, or release actions
```

Each stage reads repository-owned artifacts from `docs/specs/<slug>/` rather
than relying on a previous agent's conversation summary. `/spec` and `/plan`
must never call each other or start implementation.

## Independent Parallel Review

Parallel review is appropriate only when:

- the user explicitly requested delegation or parallel agents;
- subtasks are read-only or have disjoint file ownership;
- no subtask depends on another's result;
- each perspective produces a distinct kind of evidence;
- the root agent can reconcile results against the same contract.

Typical independent perspectives are correctness, security, tests, or
platform packaging. The root agent remains responsible for verifying findings
and reporting disagreements. Do not treat a subagent result as authoritative
without checking it against repository evidence.

## Research Isolation

When explicitly authorized parallel work is available, a read-only research
agent may inspect a bounded large surface and return a digest. Give it the
question, authority order, exact scope, and required evidence. It must not edit,
commit, push, or make material user decisions.

Do not use research isolation to avoid reading a skill's own `SKILL.md` or its
required references; the acting agent must read those instructions itself.

## Anti-Patterns

- **Router persona:** adds paraphrasing without domain value.
- **Persona calls persona:** hides cost, authority, and context loss.
- **Automatic lifecycle pipeline:** skips required human and Prompt MCP gates.
- **Deep delegation tree:** multiplies latency and loses contract detail.
- **Parallel writers in shared files:** creates races and overwrites.
- **Invented slash commands:** claims routing that the repository does not
  register.
- **Conversation-only handoff:** loses committed decisions after compaction.

When a workflow does not fit the existing catalog, prefer direct invocation and
document the gap. Add a new route only after the repository has a real repeated
need, one authoritative implementation, and an explicit registration
mechanism.
