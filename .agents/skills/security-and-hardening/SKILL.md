---
name: security-and-hardening
description: Use only to audit or harden a concrete GPT-Voice trust boundary only when the user explicitly requests security work or identifies a security defect. Cover renderer input, preload and IPC, main-process privileges, sessions, keys, audio, transcripts, clipboard, browser data, provider networks, filesystem and process execution, dependencies, workflows, artifacts, and publishing; do not weaken checks to obtain a passing result.
---

# Security And Hardening

1. Read `AGENTS.md`, `SECURITY.md`, the affected implementation and tests, and
   the public contract. Define the protected asset, actor, trust boundary,
   capability, untrusted input, security property, and expected impact. Use the
   globally configured Prompt MCP for any unresolved material scope, contract,
   compatibility, or risk-acceptance decision.
2. Trace data and authority through the relevant boundaries:
   - microphone, selected text, renderer state, and other browser inputs;
   - `window.electronAPI`, preload exposure, IPC validation, and trusted sender;
   - privileged main-process filesystem, clipboard, notification, hotkey,
     browser, settings, and lifecycle behavior;
   - ChatGPT sessions/cookies, OpenAI and prettify API keys, `safeStorage`,
     provider requests, local Ollama/vLLM endpoints, and web automation;
   - local app data, transcription history, temporary audio, logs, packaged
     resources, child processes, and release workflows.
3. Validate identifiers, sizes, ranges, paths, URLs, message shapes, provider
   responses, and model/browser output at the owning boundary. Preserve least
   privilege, context isolation, cancellation, timeouts, cleanup, redaction,
   and safe failure behavior.
4. Check dependency provenance and lockfile changes, lifecycle scripts,
   Electron fuses, browser runtime discovery, GitHub workflow permissions,
   action/image pins as configured, installer contents, checksums, and
   publishing authorization where applicable.
5. Recommend or implement only the smallest effective mitigation within the
   authorized scope. Preserve public and compatibility contracts unless a
   contract change is explicitly approved. Never expose secrets or use private
   user data in tests or proof-of-concept output.
6. Run focused regression tests, `npm run lint`, `npm run typecheck`,
   `npm run test:types`, `npm test`, `npm run audit:prod`, and the matching
   build/browser/package checks for the affected boundary. A known
   vulnerability, failing security rule, or missing positive control must be
   resolved or explicitly reported; never suppress it merely to pass.

Report evidence, exploit or failure impact, mitigation, positive and negative
verification, skipped checks, and residual risk.
