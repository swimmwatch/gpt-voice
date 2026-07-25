---
name: project-release
description: Use only to prepare, publish, verify, or recover a GPT-Voice release only when the user explicitly requests release work and confirms a SemVer version. Follow the repository's tag-derived versioning, Linux and Windows artifact workflows, checksums, GitHub Release automation, and paused macOS policy; never change versions, tag, publish, upload, or delete a release without explicit authorization.
---

# Project Release

Require a confirmed `vMAJOR.MINOR.PATCH` or valid SemVer prerelease tag and a
stable-versus-prerelease decision before changing release state. Use the global
Prompt MCP for any missing material release decision, with a persistent
workspace interview and stable IDs.

## Evidence And Preconditions

1. Read `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`,
   `package.json`, `.github/workflows/release-builds.yml`, relevant release
   scripts, and the complete unreleased diff.
2. Confirm the target commit, tag, release state, intended assets, supported
   platforms, and rollback/recovery plan. Check that the tag and GitHub Release
   do not already conflict with the requested version.
3. Determine SemVer impact from user-visible behavior, IPC/provider contracts,
   settings and data compatibility, installers, and supported platforms. Do
   not infer or silently bump a version.
4. Scan the pinned SemVer, Keep a Changelog, and Conventional Commits
   specifications before applying them. Do not create a changelog or release
   notes mechanism if the repository still has none; ask before expanding
   scope.

## Preparation, Publishing, And Verification

1. Run the CI-equivalent quality set from `AGENTS.md`. For release artifacts,
   also run the applicable CloakBrowser, Fedora Linux, Windows, packaged
   runtime, and installer checks.
2. Preserve the repository's version flow: release jobs derive
   `package.json` and `package-lock.json` versions from the confirmed tag via
   `npm run apply:release-version`; generated metadata under `build/generated/`
   and files under `release/` or `release-artifacts/` are not committed.
3. Linux release output is AppImage, deb, rpm, and
   `SHA256SUMS-linux.txt`; Windows output is the NSIS installer and
   `SHA256SUMS-win32.txt`. macOS publishing remains paused until signing and
   notarization are configured.
4. `.github/workflows/release-builds.yml` supports manual artifact builds and
   builds/uploads supported installers when a GitHub Release is published.
   Publishing the release is therefore a consequential manual gate.
5. Obtain explicit authorization immediately before each commit, tag, push,
   GitHub Release publish, asset upload, overwrite, or other external mutation.
   Approval to prepare is not approval to publish.
6. After publication, verify workflow completion, attached filenames,
   checksums, install/uninstall behavior on supported platforms, bundled
   CloakBrowser, Electron fuses, license/metadata, and documented availability.

Never delete, retag, or overwrite an already consumed release as routine
recovery. Report published state and prepare a follow-up release unless the
user explicitly chooses another safe recovery. Finish with version, tag,
commit, release URL, assets, checksums, checks run, skipped platform checks, and
residual risks.
