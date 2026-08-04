# Local Whisper Packaging

This folder documents the trust and package boundary implemented by
`scripts/local-whisper/packaging/`. The existing five-field Ed25519 catalog
envelope is the only catalog signature format. `catalog.sha256` is staging
metadata; it never replaces signature verification, and `catalog.sig` is
forbidden.

## Modes

- `disabled` stages a deferred-publication state and an empty keyring/origin
  set. Remote providers remain packageable, but Local Whisper has no catalog
  action.
- `fixture` accepts only a bounded, synthetic, non-inference bundle produced
  once with an ephemeral CI key. Only public output is transported. Release
  collection always rejects this mode.
- `production` accepts only an externally supplied frozen bundle whose
  catalog, app-owned public keyring, origins, runtime/model pack evidence, and
  production approval all validate. The approval is part of the manifest file
  set, and production staging requires its externally frozen manifest digest.
  The project never creates a production private key or silently falls back
  between modes.

## Package Boundary

The base application contains shared integration plus `catalog-state.json`,
`keyring.json`, and an authenticated catalog when enabled. Linux and Windows
stage exactly two app-owned executables outside ASAR: the filesystem authority
guard and operation-scoped launcher. Workers, models, accelerator libraries,
drivers, SDKs, source/build trees, and caches remain on-demand and are rejected
by the package allowlist. macOS stages only the non-actionable shared skeleton;
it has no Local Whisper executable helper or catalog action.

Runtime and model packs are separate immutable artifacts. Their signed
manifests bind platform, architecture, engine, backend, protocol/app/catalog
revisions, exact bytes and expected files, compatibility rows, approximate
memory estimates, source/build/toolchain identity, dynamic dependencies,
licenses, notices, SBOM, provenance, support tier, and redistribution review.
The installed application owns trust roots; downloaded artifacts cannot add a
key.

## CI And Operations

`local-whisper-packaging.yml` creates one public fixture artifact and passes its
declared bundle-manifest SHA-256 to the Linux consumer. The consumer verifies
that digest and packages without regenerating or resigning anything.
`local-whisper-packaging-windows.yml` is reusable only, requires the same
artifact and digest, and is gated for Task 21 representative Windows work.
Release collection accepts explicit disabled mode or a complete approved
production bundle; fixture-derived data fails closed.

Run the complete local contract with:

```bash
npm run verify:local-whisper:packaging
```

Production origins, signing authority, component redistribution approvals,
publication, and representative Windows execution remain manual gates.
