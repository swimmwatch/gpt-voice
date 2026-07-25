---
name: documentation-and-adrs
description: Use only to write or revise GPT-Voice technical documentation, public workflow documentation, or a durable architecture decision only when the user explicitly requests documentation or a settled change requires it. Use for Electron boundaries, providers, browser automation, IPC, privacy, packaging, compatibility, and release decisions; do not create routine implementation notes.
---

# Documentation And ADRs

1. Read `AGENTS.md`, the target document, related authoritative documentation,
   and the code, tests, configuration, or workflow that proves current
   behavior.
2. Select the narrowest existing owner:
   - `README.md` for user setup, providers, privacy, usage, packaging, and
     supported platforms;
   - `CONTRIBUTING.md` for contributor and pull-request workflow;
   - `SECURITY.md` for vulnerability reporting and security posture;
   - `.github/` for GitHub templates and automation;
   - `docs/specs/<slug>/` for proposed contracts, decisions, plans, and
     handoffs.
3. Separate verified current behavior, proposal, open question, experiment,
   and accepted decision. Never document planned behavior as shipped behavior
   or generated release data as a hand-maintained source.
4. Create an ADR only for a settled, expensive-to-reverse architectural
   decision whose rationale is not already owned by an approved specification.
   Include context, decision, alternatives, consequences, compatibility,
   security/privacy impact, rollback or reversal conditions, and evidence.
   If the first ADR needs a repository location or another material choice,
   confirm it through the globally configured Prompt MCP rather than inventing
   a parallel documentation hierarchy.
5. Document relevant inputs, defaults, validation, cancellation, failures,
   storage, redaction, platform limits, and manual gates. Never include session
   data, keys, cookies, transcripts, private audio, or local account details.
6. Run `git diff --check`, validate every changed link and command against the
   repository, and run the applicable project checks when documentation is
   coupled to code, scripts, configuration, or packaging. No Markdown linter is
   currently configured, so do not claim one ran.

Do not create release notes, translations, or an ADR unless they are in scope.
Report the canonical document updated and the evidence and checks used.
