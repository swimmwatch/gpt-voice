---
name: performance-optimization
description: Use only to diagnose or improve GPT-Voice performance only when the user explicitly requests optimization or provides a measured regression. Use for Electron startup, renderer responsiveness, recording, provider or browser latency, memory, bundle or installer size, build time, and CI packaging time; never optimize from source inspection or guesswork alone.
---

# Performance Optimization

1. Define the metric, representative input, platform and hardware, provider or
   browser state, acceptable tradeoffs, success threshold, and correctness
   invariant. Resolve any missing material target or tradeoff through the
   globally configured Prompt MCP according to `AGENTS.md`.
2. Capture a reproducible baseline at a named revision. Use the matching real
   surface:
   - Electron/Chrome DevTools traces for renderer work and UI responsiveness;
   - Node.js or Electron CPU/heap profiling for main-process work;
   - scoped timestamps around redacted provider/browser phases for latency;
   - artifact sizes after `npm run build:prod`, `npm run pack`, or the affected
     platform packaging command;
   - `time npm run build:prod`, `time npm run smoke:fedora`, or the exact CI job
     timing for build and packaging regressions.
3. Preserve sensitive data while measuring. Never capture or report keys,
   cookies, prompts, audio, transcripts, clipboard contents, account
   identifiers, or full provider responses.
4. Trace the measured bottleneck through renderer recording and state, preload
   IPC, main-process orchestration, provider/network/browser work, filesystem,
   Webpack output, CloakBrowser preparation, or electron-builder packaging as
   applicable.
5. Change one justified factor at a time and rerun the same measurement.
   Preserve correctness, privacy, compatibility, cleanup, and platform safety.
6. Run focused tests plus the applicable quality commands from `AGENTS.md`.
   For browser or packaging changes, run the matching CloakBrowser, package,
   and installer checks on the affected platform.

Report baseline and result with units, environment, variance or uncertainty,
correctness evidence, safeguards, and rollback conditions. Do not substitute
web Core Web Vitals for desktop measurements unless the measured surface is
actually a browser page where they apply.
