---
name: project-release
description: Use only when the user explicitly requests GPT-Voice release preparation, recovery, packaging, or publishing.
---

# GPT-Voice Release

Use this workflow only for a confirmed `vMAJOR.MINOR.PATCH` release target. Do not change the app version without an explicit user request.

## Preparation

- Start from a clean worktree and current `main`.
- Inspect tags, commits, and any changelog before proposing a version. Ask the user to confirm the target version and whether it is a prerelease.
- Read the SemVer 2.0.0 and Keep a Changelog 1.1.0 specifications before editing release metadata.
- Generate package metadata with the existing scripts; do not hand-edit generated release files.

## Validation

Run the standard PR checks, then the affected packaging checks:

```bash
npm run prepare:cloakbrowser
npm run smoke:cloakbrowser
npm run generate:package-metadata
npm run pack
npm run verify:packaged
```

For release artifacts, use the matching target command. Linux releases should prefer the reproducible Fedora path:

```bash
npm run dist:fedora
```

Windows and macOS require their corresponding supported environments. macOS packaging remains blocked until signing and notarization are configured.

## Publish

1. Open and merge a release PR following `project-pull-request`.
2. Create an annotated `vMAJOR.MINOR.PATCH` tag from the merged `main` commit.
3. Publish the GitHub Release with platform artifacts and checksums from the release workflow.
4. Verify artifacts, signatures/checksums, desktop metadata, bundled CloakBrowser runtime, app icon, and license files.

## Safety

Never commit release artifacts, local app data, session files, logs, browser profiles, or credentials. Treat signed artifacts and release credentials as sensitive. If any artifact has already been published with a defect, publish a follow-up patch rather than moving or replacing the release tag.
