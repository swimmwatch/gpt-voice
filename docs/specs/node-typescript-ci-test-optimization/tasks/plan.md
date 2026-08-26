# Node.js And TypeScript CI Test Optimization — Plan

Status: Approved on 2026-08-21.

1. [`01_optimize_node_typescript_ci_tests.md`](./01_optimize_node_typescript_ci_tests.md) — add the explicit runner and telemetry, deduplicate TypeScript checking, reuse the production build for renderer verification, and retain compile caching or sharding only when their approved measurement gates pass. Covers OUT-001, CI-001 through CI-003, PERF-001 through PERF-002, COMP-001 through COMP-003, and QUAL-001 through QUAL-004.
