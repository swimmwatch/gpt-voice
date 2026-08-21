# Node.js And TypeScript CI Test Optimization

Status: Approved on 2026-08-21.

## Outcome

- **OUT-001:** Reduce repeatable Node.js and TypeScript quality-lane time without weakening correctness, privacy, required gates, or failure propagation.

## CI Contracts

- **CI-001:** CI runs the complete Node.js test inventory through an explicit runner that validates concurrency and optional shard arguments, honors an explicitly supplied concurrency, otherwise uses `os.availableParallelism()`, reports bounded timing telemetry, and never retries failures.
- **CI-002:** The required TypeScript CI check covers application source, tests, and TypeScript scripts once. The narrower source-only npm command remains available locally.
- **CI-003:** The Node.js unit suite does not perform a second production webpack compilation. Production renderer-output assertions run against the output of the existing production build.

## Conditional Optimizations

- **PERF-001:** Retain Node compile caching only when three alternating pairs show at least two cached wins and a lower cached median, and changed source is proven not to reuse stale compiled output.
- **PERF-002:** Retain four-way native Node test sharding only after repeated CI evidence shows at least 10% quality critical-path improvement and no more than 50% additional Node.js and TypeScript runner minutes. The stable `Quality / Tests and Production Build` check remains a fail-closed aggregate if sharding is retained.

## Compatibility And Boundaries

- **COMP-001:** Do not change C++, native workflows, dependencies, packaging, release automation, security policy, runtime application behavior, or unrelated CI lanes.
- **COMP-002:** Keep `npm test`, `npm run test:unit`, `npm run typecheck`, and `npm run test:types` available for local use.
- **COMP-003:** Telemetry contains only Node version, available parallelism, selected concurrency, shard selection, elapsed milliseconds, and bounded process outcome.

## Acceptance

- **QUAL-001:** Every one of the 2,472 baseline tests remains represented; intentional new tests increase the inventory, and retained shards sum to the unsharded inventory without duplication.
- **QUAL-002:** The renderer verifier preserves the production separation, demo exclusion, worklet, window-entry, extracted CSS, uniqueness, and minification assertions.
- **QUAL-003:** Invalid runner arguments fail before child-process execution, and test failures or terminating signals remain failures.
- **QUAL-004:** Formatting, lint, comprehensive test typecheck, Node tests, production build, renderer verification, workflow policy tests, and diff hygiene pass for the changed surface.
