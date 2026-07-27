# 17 Enforce Project DI Boundaries

## Outcome

Remove every transitional stateful global and enforce the final project-wide DI
architecture before provider-audit feature work resumes.

## Prerequisites

- Tasks 08–16 are complete.

## Owned Requirements

- All project-wide DI decisions and integrated compatibility/privacy coverage.

## In Scope

- Static architecture enforcement, residual singleton cleanup, documentation,
  full regression/build verification.

## Out Of Scope

- New features, behavior changes, providers, dependencies, packaging, or
  release work.

## Task Contract

1. Audit `src/main`, `src/main/preload.ts`, and `src/renderer`.
2. Remove remaining:
   - exported constructed service/controller instances;
   - module-level mutable runtime variables;
   - lazy singleton getters/setters;
   - stateful default dependency objects;
   - concrete construction outside composition roots;
   - service-locator/token lookup;
   - free pass-through wrappers.
3. Retain immutable constants, readonly lookup structures, regexes, type
   declarations, pure functions, and React context declarations.
4. Add source/architecture tests or lint restrictions enforcing the boundary.
5. Prove two process graphs are isolated and disposal releases all owned
   resources.
6. Update developer architecture guidance and the provider-audit handoff.

## Contracts And Boundaries

- Main, preload, and renderer retain separate roots and trust boundaries.
- No public behavior or stored data changes.

## Expected Files Or Components

- Architecture tests/lint configuration, residual runtime files, documentation,
  plan/todo/handoff.

## Acceptance Criteria

- Static scans report no prohibited stateful singleton/global pattern.
- All focused suites and the complete project quality/build set pass.
- Provider-audit Task 18 can consume injected services without reintroducing
  globals.

## Verification

```bash
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm test
rtk npm run build:prod
rtk git diff --check
```

## Failure And Rollback

- Do not whitelist a mutable singleton merely to pass enforcement.
- Roll back the owning packet if a required runtime cannot be instance-owned.

## Manual Gates

- Packaging, live providers, commits, pushes, PRs, and releases remain
  separately authorized.

## References

- `AGENTS.md`, project conventions, and Tasks 08–16 handoffs.

## Completion And Handoff

- Mark only Task 17 complete.
- Hand off to renumbered Task 18 and stop.
