---
name: project-pull-request
description: Create, update, or review a GPT-Voice pull request with the required Electron, browser-automation, privacy, and verification evidence. Use when the user asks to open a PR or prepare changes for review.
---

# GPT-Voice Pull Request

Use this workflow for pull requests in `swimmwatch/gpt-voice`.

## Before Staging

- Inspect `git status -sb`, the current branch, its upstream, and the diff against `origin/main`.
- Do not open a PR from `main`. Target `main` unless the user specifies another base.
- If the working tree contains unrelated changes, ask which files belong in the PR. Do not use `git add -A` without that confirmation.
- Read `.github/PULL_REQUEST_TEMPLATE.md` and `CONTRIBUTING.md` before drafting the body.
- Use Conventional Commit subjects. Keep one logical change per PR.

## Required Checks

Run after final edits and before the commit:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:types
npm test
npm run validate:dependabot
npm run audit:prod
npm run build:prod
```

For CloakBrowser, ChatGPT Web, or Google Translate changes, also run:

```bash
npm run prepare:cloakbrowser
npm run smoke:cloakbrowser
```

Record existing warnings separately from errors. Do not claim a skipped check passed.

## Security Review

State whether the PR changes Electron IPC, session/cookie handling, browser automation, local storage, clipboard/audio behavior, logging, or packaging. Confirm that no credentials, tokens, browser data, transcripts, prompts, audio, or generated artifacts are staged.

## Create Or Update

1. Stage only the confirmed files and inspect `git diff --staged`.
2. Commit with a Conventional Commit message.
3. Push the branch with tracking.
4. Create or update the PR through `gh`. If an open PR already uses the branch, update it instead of creating a duplicate.
5. Use the repository pull-request template without placeholder comments. Include the user-facing behavior, root cause where relevant, desktop impact, security notes, validation commands, and screenshots for UI changes when available.
6. Assign the authenticated GitHub user unless the user asks otherwise.

Create a ready-for-review PR by default. Use a draft only when the user requests one.
