---
name: doubt-driven-development
description: Use only to perform an adversarial, evidence-based challenge of a named high-risk GPT-Voice product or technical decision only when the user explicitly requests it. Use for Electron privilege boundaries, IPC, sensitive storage, browser automation, provider contracts, dependencies, packaging, publishing, or irreversible migrations; do not use for routine uncertainty or ordinary review.
---

# Doubt-Driven Development

Keep this workflow read-only unless implementation is separately authorized.

1. State the exact decision, intended outcome, constraints, alternatives,
   reversibility, and cost of being wrong.
2. Inspect the relevant code, tests, configuration, documentation, dependency
   data, packaging scripts, and GitHub workflows. Separate observed evidence
   from assumptions.
3. Challenge concrete failure modes: renderer privilege escalation, IPC sender
   spoofing, session or key disclosure, unsafe clipboard/audio/transcript
   handling, browser cleanup failures, provider drift, platform incompatibility,
   dependency compromise, broken installers, release corruption, and rollback
   failure as applicable.
4. For each material concern, provide the scenario, affected contract, impact,
   evidence, smallest resolving experiment, and safe fallback.
5. Use the globally configured Prompt MCP for every material user choice. Follow
   `AGENTS.md`, inspect the live tool schema, and never infer a decision from
   cancellation, timeout, unavailability, conflict, or failure.

End with a recommendation, accepted tradeoffs, unresolved risks, and explicit
conditions for proceeding or deferring. Do not invent benchmarks, provider
guarantees, threat actors, or supported platforms.
