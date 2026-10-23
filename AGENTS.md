# GPT-Voice Agent Router

This file is the always-on router. Keep it concise; load detailed guidance only when the task needs it.

## Skill Selection

- The runtime skill catalog is an index, not permission to read every `SKILL.md`.
- Select at most one primary skill per task. Add one supporting skill only when it is essential to the requested outcome.
- Read the full text of a selected skill only after selection. Do not read unrelated skills or their references.
- Use an explicitly named skill. Otherwise, apply the narrow catalog descriptions; do not infer a full development lifecycle.
- Do not use a meta-skill at session start; use the compact runtime catalog only when selection help is necessary.
- Do not activate personas for routine work. Use a persona only when the user explicitly requests that role or its report format; never combine it with its equivalent skill.
- Do not add spec, planning, TDD, review, simplification, documentation, or shipping skills merely because code is changing. Use each only when explicitly requested or when its narrow trigger is indispensable.

## Focused Context

- If `.codegraph/` exists, use CodeGraph before broad code search.
- Before work, read only the target file, directly related tests/types, one local precedent, and the relevant spec section.
- For planned work, read the current `tasks/todo.md` entry and its linked numbered task packet. Do not read the full specification, full plan, or unrelated packets by default.
- Read a targeted specification section only for an unresolved conditional detail or conflict identified by the packet. Repair an incomplete packet through planning instead of reconstructing it during implementation.
- Keep command output to relevant failures or concise pass/fail summaries. Do not reread unchanged files or repeat successful checks.
- Load the relevant section of [`docs/agent-guides/project-conventions.md`](docs/agent-guides/project-conventions.md) for runtime, provider, packaging, documentation, or commit rules.

## Project Boundaries

- Keep TypeScript strict, repository text in English, and secrets, sessions, audio, transcripts, clipboard data, and logs private.
- Renderer code uses only `window.electronAPI`; main owns privileged Electron, filesystem, provider, browser, clipboard, and lifecycle operations.
- Preserve trusted IPC sender validation and typed preload/main/renderer contracts.
- Do not add dependencies, alter releases, package targets, or generated artifacts without explicit scope.
- Use non-destructive git commands. Do not push, publish, or contact external parties without authorization.

## Code Style

- Prefer class-based OOP for business logic and stateful orchestration whenever practical. Classes should own related state, invariants, lifecycle behavior, and dependency injection; keep truly stateless transformations as pure functions when a class would add no meaningful ownership.
- Do not add free pass-through wrappers that accept or capture a class or service instance only to call one of its methods or repackage its result. Call the method directly, add behavior to the state-owning class, or introduce a class with constructor-injected dependencies.
- Use functional components, hooks, composition, and functional state updates for React and other UI, interface-layer, or front-end code.
- Do not hardcode reusable or domain-significant constants inline. Define them at the narrowest shared owner as named `const` values or enums, and reuse the canonical definition.
- Stateful business services access external sources through domain repository interfaces; concrete SQLite, HTTP, browser, CLI, and filesystem adapters have focused integration tests.
- Do not create module-level containers or constructed mutable runtime instances. A process-owned composition root transfers them to the application lifecycle; immutable constants, pure functions, readonly lookups, and React contexts remain allowed.

### TypeScript Expressions And Object Reuse

Apply these rules to new and modified TypeScript, including TSX, tests, migrations, and scripts. Mass refactoring of existing code requires a separate task.

- Extract an expression into a meaningfully named variable when its result is reused, the name explains its purpose, it combines multiple processing stages, or evaluation order, side effects, or resource ownership need to be explicit. Use `const` unless reassignment is required.
- Keep short, clear expressions inline in function arguments: property access, indexing, optional chaining, simple calculations and conversions, and small object or array literals. Do not introduce intermediate variables that add no meaning; preserve the existing rule for reusable or domain-significant constants.
- Separate multi-stage processing into named steps, such as fetching, parsing, validating, normalizing, and saving. A line break alone does not clarify a nested expression. Short `map`, `filter`, and other collection chains are acceptable when their purpose and intermediate transformations are clear.
- An inexpensive value object used for a single transformation may be created and used inline. Create configuration objects, clients, and objects with substantial initialization, state, or resources explicitly. Reuse one logical instance within its lifecycle, but keep independent instances when needed. Do not introduce a global instance, cache, or longer lifecycle solely for reuse.
- Allow standard declarative library constructs: validation schemas, decorators, dependency injection configuration, route definitions, simple query predicates, and JSX. Complex computations inside them follow the same readability rules.
- Allow Builder API chains. Before passing the built result to another function, assign it a meaningful name.
- Allow simple arrow functions inline in arguments. Put multi-stage callback logic in a separate named function. Preserve deferred execution, captured values, and `this` behavior; do not replace an arrow function with an ordinary function without checking these differences.
- When extracting variables, preserve evaluation order, conditional and lazy execution, side effects, and object lifecycles. Account for short-circuiting in `&&`, `||`, `??`, and optional chaining. Keep computations inside the appropriate branch, loop, or callback.
- In asynchronous code, preserve operation start times, `await` order, parallelism, and error handling. Do not serialize parallel operations or start a deferred operation earlier merely to extract a variable.
- In React and other reactive libraries, respect execution scope and object and function identity. Do not move state or resources outside a component or request for reuse. Do not add `useMemo`, `useCallback`, or equivalents solely to satisfy these rules. Follow the rules of hooks.

### C++

- Write modular C++20 with high cohesion, low coupling, and clear ownership; optimize for cognitive clarity before cleverness.
- Use OOP for state, lifecycle, and resource ownership, and pure functions for genuinely stateless transformations. Inject dependencies through narrow testable interfaces.
- Apply every SOLID principle, DRY only for stable shared behavior, and YAGNI; do not add speculative layers or pass-through abstractions.
- Use RAII for every native resource, deterministic non-throwing cleanup, explicit safe error contracts, and no mutable global runtime state or raw resource ownership.
- Isolate platform APIs behind Linux/Windows backends and preserve shared contract tests. Integration tests use validated temporary roots only and never broad recursive actions against user data.
- Treat warnings as errors; require clang-format, clang-tidy, Linux sanitizers, native unit/integration tests, and equivalent Windows MSVC tests for changed native code.
- Preserve filesystem/process trust boundaries and privacy: no unchecked path traversal, shell execution, sensitive stdout/logging, or generated build artifacts in commits.

## State And Handoffs

- For a global task, use one `docs/specs/<slug>/` directory with `spec.md`, `tasks/plan.md`, `tasks/todo.md`, `tasks/handoff.md`, and one `tasks/NN_<slug>.md` packet per executable task.
- `spec.md` owns the durable contract. `plan.md` is a compact ordered index, `todo.md` contains linked checklist state, and each numbered packet is a self-contained implementation contract.
- Follow [`.agents/references/task-packets.md`](.agents/references/task-packets.md) when planning, revising, or executing a substantial workstream.
- During implementation, execute one packet per explicit incremental-implementation invocation, update `todo.md` and `handoff.md`, then stop for review before continuing.
- Keep plan, todo, and handoff compact. `handoff.md` records completed work, changed files, checks, exact next packet, and blockers only.
- Convert a legacy bundle without numbered packets through planning before resuming implementation; do not execute a monolithic task list directly.
- When switching major workstreams or context becomes stale, update `handoff.md` and begin a fresh session from it.

## Prompt MCP Workflow Decisions

- `/spec` routes to `spec-driven-development`; `/plan` routes to `planning-and-task-breakdown`. Do not create parallel implementations.
- For substantial specifications, add `docs/specs/<slug>/decisions.yaml` before the first material question; it owns normalized decisions and revision history.
- Use Prompt MCP for material workflow decisions with the absolute `workspace_path`, workspace persistence, stable semantic IDs, and inspected live schemas.
- Do not substitute plain-chat choices while Prompt MCP is callable. Only a committed answer is a decision; other states are not answers.
- Never request credentials, tokens, passwords, session data, private audio or
  transcripts, or unrelated personal information.

## Verification

- Run the smallest relevant check after a change; run the project quality set only when the completed task warrants it.
- Record required manual or platform-specific verification in the task artifact instead of pasting logs into chat.
