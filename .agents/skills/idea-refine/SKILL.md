---
name: idea-refine
description: Use only to explore and refine a GPT-Voice product, desktop workflow, provider, browser, UI, privacy, packaging, release, or developer-experience idea only when the user explicitly asks to ideate, compare directions, refine an idea, or stress-test a plan before specification. Do not turn exploration into a specification or implementation.
---

# Idea Refine

1. Establish the user or operator, problem, desired outcome, success signal,
   constraints, non-goals, and why the decision is needed now.
2. Inspect only the relevant repository evidence: current desktop flow,
   renderer/preload/main boundaries, provider abstraction, tests,
   documentation, packaging, and settled decisions.
3. Offer two to four materially different directions. Include the smallest
   useful experiment and a credible defer, remove, or reuse-existing option
   when appropriate.
4. Compare only material criteria: user value, desktop UX, implementation and
   maintenance cost, provider/browser reliability, privacy and security,
   testability, supported platforms, packaging impact, compatibility, and
   reversibility.
5. State assumptions and concrete failure cases. Give an evidence-backed
   recommendation when the evidence supports one, but never silently select a
   direction for the user.
6. Use the globally configured Prompt MCP for every material user decision.
   Inspect its callable schema, use stable semantic IDs, and use a persistent
   workspace interview when the exploration must survive interruption. Do not
   replace a callable Prompt MCP choice with a plain-chat multiple-choice
   question.

Finish with the chosen direction only after a committed user answer, plus the
smallest validation step, explicit non-goals, and unresolved risks. Stop before
`/spec`, `/plan`, code changes, commits, or external actions.
