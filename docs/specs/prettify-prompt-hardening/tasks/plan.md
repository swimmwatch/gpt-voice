# Implementation Plan: Prettify Prompt Hardening

Status: Complete
Specification: [`../spec.md`](../spec.md)

1. Preserve provider output and strengthen the default prompt/request framing; add focused provider tests.
2. Bound selected-text inference and cache retention; add selected-text/cache regression tests.
3. Validate provider URLs and prompt length at shared, renderer, and main boundaries; disclose remote transmission in Settings.
4. Run the complete quality and production-build gates, update the checklist, and commit each verified increment.
