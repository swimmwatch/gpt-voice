# Linux main size baseline

Source: clean `main` commit `d0121e97b94b072d8a82c37fce9ef5ae71cd9511`.
The accompanying JSON was measured from this checkout, not from the dependency PR.
The historical `v1.4.0-linux-x64.json` is retained unchanged.
The existing regression rule still requires growth exceeding both 2 MiB and 2%.

## Environment

- Fedora builder from the repository's pinned Fedora 44 Dockerfile.
- Built image digest: `sha256:c4cc72983e3ac65d6f4b395571cd81117108bf4c996cb22230b86f3bef24a5d4`.
- Node v24.18.0; locked npm 12.0.2; installed electron-builder 26.16.1.
- Electron 43.2.0; CloakBrowser 0.5.10 / Chromium 146.0.7680.177.5.
- Production build, disabled Local Whisper packaging, release date fixture 2026-10-10.
- AppImage, DEB, RPM and unpacked package verified by the existing package and installer checks.

The container cannot resolve the host managed-worktree Git directory. The source
commit was recorded from the host's `git rev-parse HEAD`. The builder version was
recorded from the executed builder rather than the manifest's dependency range.
All measured byte counts are unchanged from `measure:size` output.

## Reproduction

Build the pinned source using `scripts/build-fedora-release.mjs --mode=release`
and the same fixture date and Fedora environment. Retain
`release-artifacts/size-linux-x64.json` even if the historical size gate rejects
the already-grown main build. Compare dependency branches against the accompanying
main report using `npm run verify:size`; never regenerate this baseline from a PR.

Local downloads required pre-seeding official Electron and builder archives into
their standard caches after validating upstream SHA-256 checksums. TLS validation,
archive verification and packaging security gates were not disabled.
