---
name: project-pull-request
description: Use only to prepare, create, update, or assess a GPT-Voice GitHub pull request only when the user explicitly requests PR work. Follow the repository's main-branch, template, checks, desktop-impact, privacy, and review conventions; verify base and head, and never commit, push, or open or modify a PR without explicit authorization for that action.
---

# Project Pull Request

1. Read `AGENTS.md`, `CONTRIBUTING.md`,
   `.github/PULL_REQUEST_TEMPLATE.md`, the intended issue or specification, and
   the complete branch diff.
2. Inspect worktree status, current branch, upstream tracking, and available
   remotes. Confirm the intended base and head; the repository convention is a
   focused feature branch into `main`, but do not assume a different requested
   target is wrong.
3. Use the globally configured Prompt MCP for unresolved material choices such
   as base/head, draft state, included scope, compatibility posture, or a
   security-sensitive disclosure. Do not ask for credentials or infer a choice
   from a non-answered result.
4. Before proposing publication, run or accurately report the applicable
   checks from `AGENTS.md`. Include the matching CloakBrowser, Fedora/Windows
   package, installer, or manual desktop verification for affected surfaces.
   Never claim a platform check passed when it was skipped or unavailable.
5. Use the PR template. Explain motivation, user or developer impact, desktop
   areas affected, security/privacy implications, compatibility, documentation,
   tests, platforms, skipped checks, manual gates, and screenshots for UI
   changes.
6. Verify there is no existing PR for the same head branch before creating a
   duplicate. Use a concise Conventional-style title and keep one logical
   change per PR.

Committing, pushing, and opening or updating a PR are separate external-state
actions and each requires explicit authorization. Report the confirmed base,
head, title, draft state, URL if created, checks, skipped checks, and remaining
review risks.
