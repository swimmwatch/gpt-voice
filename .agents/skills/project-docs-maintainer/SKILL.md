---
name: project-docs-maintainer
description: Use only to maintain the GPT-Voice documentation set only when the user explicitly asks to audit, organize, reconcile, consolidate, or update project knowledge. Use for README, contribution and security guidance, provider and desktop workflows, privacy, packaging, release automation, and agent documentation; do not invent translations, release notes, or undocumented behavior.
---

# Project Docs Maintainer

1. Inventory only the documentation surfaces in scope and identify the
   canonical owner for each fact: `README.md`, `CONTRIBUTING.md`, `SECURITY.md`,
   `.github/`, `AGENTS.md`, `.agents/`, or an existing
   `docs/specs/<slug>/` bundle.
   Resolve any material scope or canonical-owner choice through the globally
   configured Prompt MCP according to `AGENTS.md`.
2. Verify each claim against current code, tests, `package.json`, scripts,
   workflows, packaging configuration, and supported-platform evidence.
   Distinguish current behavior from proposals and generated output.
3. Reconcile duplicated, stale, and contradictory statements by updating the
   narrowest authoritative source and linking to it. Do not copy the same
   provider, privacy, command, or release rule across several documents.
4. Preserve explicit privacy boundaries for sessions, API keys, browser data,
   audio, transcripts, history, clipboard contents, logs, and local app data.
   Keep Linux, Windows, and paused macOS release claims aligned with verified
   automation.
5. Do not create or modify translations, changelog entries, release notes,
   screenshots, or generated package metadata unless the user explicitly
   includes them.
6. Run `git diff --check`, verify links and command examples, and run any
   code/configuration checks coupled to the documentation change. Do not claim
   a Markdown linter exists.

Report canonical sources changed, contradictions removed, verification
evidence, and remaining documentation uncertainty.
