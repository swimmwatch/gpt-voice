# Build, Packaging & CI Supply-Chain Review

**Verdict: CHANGES REQUESTED.** The packaging posture is unusually strong in the places that matter most — `files` is a strict allowlist, so no repo-root secret (including the untracked 104 KB `chatgpt-session.json`) can reach the asar, and the `electronFuses` block is close to best practice. The problems are on the *inputs* side: the CloakBrowser cache is copied into the shipped app wholesale with no filter (697 MB, unaudited contents), the download trust root can be silently downgraded by an unvalidated environment variable, and `ci-install.mjs` can exit `0` having installed nothing.

**Status: PARTIAL — interrupted mid-review; coverage limited to the files listed in Scope.** Roughly half the assigned surface was read. See §"Unreviewed / to resume" for the exact remainder.

- **Date:** 2026-08-08
- **Branch:** `feat/local-whisper-provider`
- **Reviewer focus:** Supply chain, packaging leaks, script security, build correctness
- **Method:** Static read of build scripts, the `electron-builder` configuration block, workflow triggers/permissions, and `.gitignore`; plus live verification against the working tree using `git check-ignore --no-index`, `git ls-files`, `du`, and direct inspection of the resolved `node_modules/cloakbrowser@0.5.3` download path. Every finding is tagged **VERIFIED** (confirmed by reading the exact lines and/or executing a check) or **INFERRED** (reasoned from partial evidence, needs confirmation).

---

## Scope

### Files actually read (this review's evidence base)

| File | Coverage |
| --- | --- |
| `scripts/prepare-cloakbrowser.mjs` | Full (54 lines) |
| `scripts/ci-install.mjs` | Full (82 lines) |
| `scripts/clean-dist.mjs` | Full (16 lines) |
| `scripts/apply-release-version.mjs` | Full (67 lines) |
| `package.json` → `scripts` | Full (lines 24–140) |
| `package.json` → `build` (electron-builder) | Full (line 183 → end of block) |
| `package.json` → `dependencies` | Full |
| `.gitignore` | Full (109 lines) |
| `.github/workflows/pr-checks.yml` | Partial — lines 1–120 only (triggers, `permissions`, `env`, `concurrency`, first job) |
| `node_modules/cloakbrowser/dist/{config,download}.js` | Targeted — env overrides and signature/checksum path |

### Explicitly out of scope

Native C++ CI checks — covered by `docs/reviews/2026-08-08-local-whisper-native-ci-security-checks.md`. Findings below deliberately avoid the native toolchain, source-object lockfiles, and the `local-whisper-packaging*.yml` workflows.

---

## Findings

### 1. CloakBrowser cache is copied into the shipped app unfiltered — HIGH

**VERIFIED** (mechanism), **INFERRED** (credential content).

`scripts/prepare-cloakbrowser.mjs:31,41`

```js
const sourceDir = info.cacheDir;
await cp(sourceDir, targetDir, { recursive: true, force: true, dereference: true });
```

and `package.json` (`build.extraResources`):

```json
{ "from": ".cache/cloakbrowser", "to": "cloakbrowser" }
```

**Mechanism.** `binaryInfo().cacheDir` is CloakBrowser's *shared, machine-level* cache directory (overridable via `CLOAKBROWSER_CACHE_DIR`, `node_modules/cloakbrowser/dist/config.js:108`). The script copies **the entire directory tree**, not the binary it just resolved — it computes `relativeBinaryPath`/`targetBinaryPath` only to *assert* the copy succeeded (lines 32–33, 43–45), never to narrow the copy. The `extraResources` entry then has **no `filter`**, so whatever landed in `.cache/cloakbrowser` is placed verbatim in the installed app's `resources/cloakbrowser`. Measured on this working tree: **697 MB**.

**Failure scenario.** A maintainer runs `cloakbrowser login` (the package advertises a free-tier license flow at `dist/cli.js:24-25`) or has previously downloaded other versions/channels/platform tarballs, a partial download, or the GeoIP database (`dist/geoip.js:18`). A subsequent local `npm run dist` bakes all of it — potentially including a license key or account-linked token — into a publicly distributed installer. Even absent credentials, this ships an unbounded, unaudited payload whose contents vary per build machine, which defeats reproducibility and inflates every artifact.

**Suggested fix.** Copy only what is needed, and assert it. In `prepare-cloakbrowser.mjs`, replace the whole-directory `cp` with a copy of the resolved binary plus an explicit, reviewed list of required runtime files; alternatively keep the `cp` but add a `filter` array to the `extraResources` entry. Additionally, fail the build if the staged tree contains any file matching a credential shape (`*.json` with `token`/`key`/`license`, `*.pem`, dotfiles). Log the staged byte count and gate it against a ceiling so this cannot silently regrow.

---

### 2. CloakBrowser download trust root is downgradable via unvalidated env — HIGH

**VERIFIED.**

`scripts/prepare-cloakbrowser.mjs:5,7`

```js
process.env.CLOAKBROWSER_AUTO_UPDATE = 'false';
const { binaryInfo, ensureBinary } = await import('cloakbrowser');
```

**Mechanism.** The script neutralizes exactly one environment variable. CloakBrowser reads five (`node_modules/cloakbrowser/dist/config.js`):

| Var | Line | Effect |
| --- | --- | --- |
| `CLOAKBROWSER_DOWNLOAD_URL` | 140 | Overrides the release origin |
| `CLOAKBROWSER_VERSION` | 67 | Overrides the binary version |
| `CLOAKBROWSER_RELEASE_CHANNEL` | 63 | Overrides the channel |
| `CLOAKBROWSER_CACHE_DIR` | 108 | Relocates the cache that §1 ships |
| `CLOAKBROWSER_BINARY_PATH` | 232 | Substitutes an arbitrary local executable |

The first is the dangerous one. `dist/download.js:329-360` documents two trust paths: the official origin gets a *"mandatory, non-bypassable Ed25519 signature check"*, but when a custom URL is set the code comments *"the pinned signature keys do not apply to a third-party server"*, falls back to same-origin `SHA256SUMS`, and — if that file is absent — logs `"SHA256SUMS not available from custom URL — skipping"` and proceeds. A custom origin therefore serves both the payload and its own checksums, i.e. no integrity guarantee at all.

**Failure scenario.** Any mechanism that sets `CLOAKBROWSER_DOWNLOAD_URL` in a build environment — a workflow-level `env:` added in a PR, a compromised self-hosted runner, a stray `.env` on a maintainer's machine, or a malicious dependency's install script — redirects the bundled browser binary to an attacker-controlled origin with signature verification disabled. The substituted binary is then embedded in `extraResources` and distributed inside an otherwise-trusted installer. `CLOAKBROWSER_BINARY_PATH` achieves the same with no network at all.

**Suggested fix.** At the top of `prepare-cloakbrowser.mjs`, **before** the dynamic `import('cloakbrowser')`, delete the four override vars and hard-fail if any was set:

```js
for (const key of ['CLOAKBROWSER_DOWNLOAD_URL', 'CLOAKBROWSER_BINARY_PATH',
                   'CLOAKBROWSER_VERSION', 'CLOAKBROWSER_RELEASE_CHANNEL']) {
  if (process.env[key]) throw new Error(`Refusing to prepare CloakBrowser with ${key} set`);
}
```

Then assert the outcome: after `ensureBinary()`, check `info.version` against the exact version pinned in `dependencies` (`0.5.3`) and abort on mismatch. The script currently *prints* `info.version` (line 51) but never checks it.

---

### 3. `ci-install.mjs` can exit 0 having installed nothing — MEDIUM

**VERIFIED.**

`scripts/ci-install.mjs:6,68`

```js
const attempts = Number.parseInt(process.env.CI_INSTALL_ATTEMPTS || '3', 10);
...
for (let attempt = 1; attempt <= attempts; attempt += 1) {
```

**Mechanism.** `attempts` is never validated. If `CI_INSTALL_ATTEMPTS` is non-numeric, `Number.parseInt` returns `NaN`; the loop guard `1 <= NaN` is `false`, the body never runs, and the script falls off the end and **exits 0**. `CI_INSTALL_ATTEMPTS=0` or a negative value produces the same silent success.

**Failure scenario.** A typo or a templating bug in a workflow (`CI_INSTALL_ATTEMPTS: ${{ inputs.retries }}` evaluating to empty-but-present, `"three"`, `"0"`) makes the "Install dependencies" step pass green with no install performed. Downstream steps then either fail with a confusing missing-module error, or — worse — proceed against a **stale or cache-restored `node_modules`** that was never validated against the lockfile, silently defeating `npm ci`'s integrity guarantee.

**Suggested fix.**

```js
const attempts = Number.parseInt(process.env.CI_INSTALL_ATTEMPTS || '3', 10);
if (!Number.isInteger(attempts) || attempts < 1) {
  throw new Error(`CI_INSTALL_ATTEMPTS must be a positive integer. Received: ${process.env.CI_INSTALL_ATTEMPTS}`);
}
```

---

### 4. `ci-install.mjs` deletes a CWD-relative `node_modules` on retry — MEDIUM

**VERIFIED.**

`scripts/ci-install.mjs:11,57-66`

```js
const nodeModulesPath = path.resolve('node_modules');
...
await rm(nodeModulesPath, { recursive: true, force: true, ... });
```

**Mechanism.** Every other script in this tree anchors on the repo root via `path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')` (`prepare-cloakbrowser.mjs:9`, `clean-dist.mjs:5`, `apply-release-version.mjs:5`). This one resolves against `process.cwd()` instead, then recursively force-deletes it.

**Failure scenario.** The script is invoked from outside the repo root — a composite action with a different `working-directory`, a monorepo wrapper, or a developer running `node path/to/repo/scripts/ci-install.mjs` from `$HOME` — and the first `npm ci` failure triggers a recursive delete of an unrelated `node_modules`. The blast radius is bounded (the spawned `npm ci` is equally CWD-relative, so install and delete stay consistent), which is why this is Medium rather than High, but a recursive `rm` should never be aimed by ambient state.

**Suggested fix.** Anchor on the module URL like every sibling script, and refuse to run if the resolved root lacks a `package-lock.json`.

---

### 5. Bare `build` rule in `.gitignore` masks the entire packaging input tree — MEDIUM

**VERIFIED** by execution:

```
$ git check-ignore -v --no-index build/entitlements.mac.plist
.gitignore:109:build	build/entitlements.mac.plist
$ git check-ignore -v --no-index build/foo.txt
.gitignore:109:build	build/foo.txt
```

**Mechanism.** `.gitignore:17-20` already scopes the generated output precisely (`build/generated/`, `build/github-pages/`). Line 109 then adds a bare, unanchored `build`, which matches *any* path segment named `build` at any depth — including the tracked electron-builder inputs. `git ls-files build/` confirms five files are tracked and therefore survive (git never un-tracks an already-tracked file), so today's builds work:

```
build/entitlements.mac.inherit.plist
build/entitlements.mac.plist
build/fedora-release/Dockerfile
build/fedora-release/fedora-release-entrypoint.mjs
build/size-baselines/v1.4.0-linux-x64.json
```

**Failure scenario.** A contributor adds a *new* required packaging input — a second entitlements plist for a login helper, a new fpm asset, a new size baseline for a new platform — and it never appears in `git status`, never gets staged, and never reaches CI. The local build passes; the release build fails at the electron-builder step, or (for entitlements) succeeds and ships a macOS binary missing a required entitlement. The symptom is maximally confusing because the file visibly exists on disk.

**Suggested fix.** Delete line 109. Lines 17–20 already cover the generated subtrees. If a broad rule is genuinely wanted, scope and re-include explicitly:

```gitignore
build/*
!build/entitlements.mac.plist
!build/entitlements.mac.inherit.plist
!build/fedora-release/
!build/size-baselines/
```

---

### 6. GitHub Actions pinned by mutable tag, not commit SHA — MEDIUM (pr-checks) / **unverified for release** — HIGH if release inherits

**VERIFIED for `pr-checks.yml`; INFERRED for `release-builds.yml` (not read).**

`.github/workflows/pr-checks.yml:45,48`

```yaml
- uses: actions/checkout@v7
- uses: actions/setup-node@v7
```

**Mechanism.** `@v7` is a mutable git tag in a third-party repository. Whoever controls that repo — or anyone who compromises it — can move the tag and execute arbitrary code inside the runner on the next build. Tag-pinning is the single most commonly exploited CI supply-chain vector.

**Failure scenario.** In `pr-checks.yml` the blast radius is contained: the top-level `permissions: contents: read` and the use of `pull_request` (not `pull_request_target`) mean a compromised action gets a read-scoped token and no secrets. In `release-builds.yml`, however, the same pattern would run alongside whatever signing material and write-scoped token the release needs, and could exfiltrate them or tamper with artifacts before upload. **This is the highest-priority item in the unreviewed set.**

**Suggested fix.** Pin every third-party action to a full 40-character commit SHA with a trailing `# vX.Y.Z` comment, and enable Dependabot for `github-actions` to keep the SHAs current. Prioritize `release-builds.yml`.

---

### 7. macOS artifacts are built unsigned (`identity: null`) — MEDIUM

**VERIFIED.** `package.json`, `build.mac.identity: null`, alongside `hardenedRuntime: true` and `entitlements: build/entitlements.mac.plist`.

**Mechanism.** `identity: null` instructs electron-builder to skip code signing entirely. The hardened-runtime and entitlements settings are then largely inert — entitlements are applied by the signature, so an unsigned bundle carries none of them.

**Failure scenario.** The published DMG cannot be verified by end users or by Gatekeeper; it is quarantined on download, and users are trained to right-click-open, which is exactly the habit that makes a substituted installer effective. There is no cryptographic link between the artifact and this repository. The Windows side declares `signAndEditExecutable: true` but no certificate configuration appears in the `build` block, suggesting the same gap there (**INFERRED** — the release workflow may inject it via `CSC_LINK`/`CSC_KEY_PASSWORD`, which I did not verify).

**Suggested fix.** Either wire signing + notarization from CI secrets, or — if unsigned distribution is a deliberate cost decision — document it prominently in the release notes and publish detached checksums/signatures so users have *some* verification path.

---

### 8. `apply-release-version.mjs` writes `$GITHUB_ENV` without the delimiter form — LOW

**VERIFIED** (mechanism); impact is limited.

`scripts/apply-release-version.mjs:10,47-48`

```js
const semverPattern = /^\d+\.\d+\.\d+(?:-[\d.a-z-]+)?(?:\+[\d.a-z-]+)?$/i;
...
const lines = Object.entries(values).map(([name, value]) => `${name}=${value}`);
await appendFile(process.env.GITHUB_ENV, `${lines.join('\n')}\n`, 'utf-8');
```

**Mechanism.** Two small things compound. First, the validation runs against `releaseVersion` (the tag minus a leading `v`), while the value written to `$GITHUB_ENV` is the *unstripped* `releaseTag`. Second, in JavaScript `$` without the `m` flag matches at end-of-input **or immediately before a final line terminator** — so `"v1.2.3\n"` passes `semverPattern.test()`. The `NAME=value` single-line form is the pattern GitHub explicitly warns against for values that could contain newlines; the documented-safe form is the heredoc delimiter.

**Failure scenario.** A tag with a trailing newline emits a stray blank line into the environment file. GitHub's parser ignores blank lines, so this is not currently exploitable — no second variable can be smuggled, because any content *after* the newline would fail the anchored pattern. It is filed as Low because the guard happens to hold by accident rather than by design; a future relaxation of the regex (or a switch to `multiline`) turns it into environment injection in a release-privileged context.

**Suggested fix.** Validate `releaseTag` itself, explicitly rejecting `\r` and `\n`, and switch to the delimiter form:

```js
const lines = Object.entries(values).map(([name, value]) => `${name}<<__EOF__\n${value}\n__EOF__`);
```

---

### 9. `--target=` guard rejects cross-compilation only after a full production build — LOW

**VERIFIED.** `scripts/prepare-cloakbrowser.mjs:11-18`; `package.json:41,43,44`.

**Mechanism.** `dist:win`, `dist:mac`, and `dist:linux` chain `npm run build:prod && npm run prepare:cloakbrowser -- --target=<platform> && ...`. The target check throws unless `targetPlatform === process.platform`, so the flag is a same-platform assertion, not a cross-compile switch. The throw fires *after* `clean:dist` has already wiped `dist/` and webpack has completed a full production build.

**Failure scenario.** A developer on Linux runs `npm run dist:win`, waits for the full production build, and is then told it cannot work — having also destroyed the previous `dist/` output. Harmless but wasteful and confusing.

**Suggested fix.** Move the platform assertion into a cheap preflight step at the head of each `dist:*` script, or have the script exit 0 with a clear "skipping, wrong host platform" message when the intent is a no-op.

---

## Verified sound

These were checked and are correct — recorded so a resumed review does not re-litigate them.

1. **`chatgpt-session.json` is properly ignored.** Confirmed present and untracked at the repo root (104.8 KB, mode 664), and `git check-ignore -v chatgpt-session.json` resolves to `.gitignore:48`. It is accompanied by matching rules for `access-token.json`, `openai-api-settings.json`, `config.json`, `browser-cache/`, `.env*` (with an `!.env.example` re-include), and the full credential-extension set (`*.key`, `*.pem`, `*.p12`, `*.pfx`, `*.cer`, `*.crt`, `*.mobileprovision`). `release/`, `release-artifacts/`, `dist/`, and every installer extension are ignored. **VERIFIED.**

2. **`files` is an allowlist, so no repo-root secret can reach the asar.** The `build.files` array enumerates `dist/**/*` plus ~45 specific `node_modules/<pkg>/**/*` entries. Because electron-builder treats a leading positive pattern set as an allowlist, `chatgpt-session.json`, `.env`, `docs/`, `tests/`, `scripts/`, and `runtime/` at the repo root are **not matched by any pattern** and cannot be packed. This is materially safer than the common `["**/*", "!secrets"]` denylist and is the single best decision in this configuration. **VERIFIED.**

3. **Defensive exclusions are layered on top anyway.** `!**/*.map`, `!**/*.d.ts`, `!**/*.d.mts`, `!**/*.d.cts`, `!**/{__test__,__tests__,fixture,fixtures,test,tests}/**`, plus targeted `!node_modules/bare-{fs,path,stream,url}` and `!node_modules/teex` exclusions. Source maps and test fixtures cannot ship. **VERIFIED.**

4. **Electron fuses are near-best-practice.** `runAsNode: false`, `enableNodeOptionsEnvironmentVariable: false`, `enableNodeCliInspectArguments: false`, `grantFileProtocolExtraPrivileges: false`, `onlyLoadAppFromAsar: true`, `enableEmbeddedAsarIntegrityValidation: true`, `enableCookieEncryption: true`. This closes the standard Electron local-escalation paths. **VERIFIED.**

5. **No `asarUnpack` anywhere.** Nothing is selectively unpacked out of the asar, so there is no unpacked-sensitive-path class of finding. Native executables live in `extraResources` by necessity. Note the residual, inherent limitation: `enableEmbeddedAsarIntegrityValidation` covers the asar, **not** `extraResources` — a local attacker with write access to the install directory can swap the CloakBrowser executable. Whether the main process hashes it before spawn is **INFERRED / unchecked**. **VERIFIED** for the config itself.

6. **`extraResources` asset copy is filtered.** The `assets` entry uses an explicit allowlist (`icon.png`, `icons/**/*.png`, five tray icons, one schema file) rather than a bare directory copy. **VERIFIED.** (The `.cache/cloakbrowser` and `build/generated/local-whisper/**` entries are *not* filtered — see §1 and the resume list.)

7. **`dist/` is wiped before every production build.** `clean-dist.mjs` is correctly root-anchored via `fileURLToPath(import.meta.url)`, and `build:prod` runs `clean:dist` first, so every `pack`/`dist`/`dist:*` script starts from an empty `dist/`. Stale artifacts cannot accumulate into the asar. The `import.meta.url` main-module guard (line 13) is correct. **VERIFIED.**

8. **CI installs are lockfile-enforced.** `ci-install.mjs` runs `npm ci` (never `npm install`), so the committed `package-lock.json` is authoritative and integrity hashes are checked. Retries only extend fetch timeouts; they never relax integrity. **VERIFIED.**

9. **No shell injection in the scripts read.** `ci-install.mjs` uses `spawn(cmd, argsArray, { stdio: 'inherit', windowsHide: true })` with **no `shell: true`** and no string interpolation into a command line. No `curl | bash` pattern exists in any script read. The Windows `.cmd`-avoidance approach (resolving `npm-cli.js` and invoking it through `process.execPath`) is the correct hardening against the `CVE-2024-27980` argument-injection class. **VERIFIED.**

10. **`prepare-cloakbrowser.mjs` has a correct path-traversal guard.** Lines 35–37 verify `relativeBinaryPath` neither starts with `..` nor is absolute, and — importantly — this check runs *before* the `rm`/`cp` at lines 39–41, not after. Ordering is right. **VERIFIED.** (The guard protects the binary path; it does not constrain the directory copy — see §1.)

11. **`pr-checks.yml` triggers and permissions are correct.** `on: pull_request` (branches: main), `push` (main), `workflow_dispatch` — **no `pull_request_target` anywhere in this file**, so fork PR code never runs with repository secrets or a privileged token. Top-level `permissions: contents: read` applies least privilege by default. `concurrency` with `cancel-in-progress: true` is set. `CLOAKBROWSER_AUTO_UPDATE: 'false'` is pinned at workflow level, defending §2's auto-update vector at the CI layer (though not the download-URL vector). **VERIFIED for lines 1–120.**

12. **Security-critical dependencies are exact-pinned.** `cloakbrowser: "0.5.3"` and `playwright-core: "1.62.1"` carry no range specifier. The remaining five production deps use caret ranges but are constrained by the committed lockfile under `npm ci`. `packageManager: "npm@11.9.0"` and `engines` (`node >=24`, `npm >=11`) are declared. **VERIFIED.**

13. **CloakBrowser's official download path does verify signatures.** `node_modules/cloakbrowser/dist/download.js:329,367-388,448-489` implements a detached Ed25519 signature check over the `SHA256SUMS` manifest against pinned public keys, then a per-tarball SHA-256 comparison, and the code comments describe it as *"mandatory, non-bypassable."* It also correctly guards against base64 malleability (`signature.toString("base64") !== sigText`). The default path is sound; §2 is exclusively about the *custom-origin escape hatch* not being closed off by the caller. **VERIFIED.**

---

## Unreviewed / to resume

Not opened at all. Listed in suggested priority order.

**High priority — likely to contain the most serious remaining findings:**

1. `.github/workflows/release-builds.yml` (8.2 KB) — the critical gap. Needs: `permissions:` blocks (top-level and per-job), trigger set (`pull_request_target`? `workflow_run`?), secrets referenced and which jobs can see them, action SHA pinning (see §6), artifact upload/attestation, and whether signing material is injected for Windows/macOS (bears on §7).
2. `.github/workflows/pr-checks.yml` **lines 120–560** — remaining jobs. Needs: per-job `permissions:` overrides, any `pull_request_target`, any use of `${{ github.event.pull_request.* }}` interpolated into `run:` blocks (script-injection class), and cache-poisoning risk from `actions/cache` keyed on PR-controlled input.
3. `scripts/collect-release-artifacts.mjs` (4.7 KB) — explicitly flagged in the brief for **path traversal in artifact collection**. Needs: how artifact names/globs are resolved, whether `..` in a downloaded artifact name can escape the destination, and symlink handling.
4. `scripts/build-fedora-release.mjs` (3.2 KB) + `build/fedora-release/{Dockerfile,fedora-release-entrypoint.mjs}` — container-based release path. Needs: base image pinning (tag vs digest), any `curl | bash`, volume mounts exposing the host, and whether `--privileged`/root is used.

**Medium priority:**

5. `scripts/generate-package-metadata.mjs` (7.4 KB) — writes `build/generated/**`, which ships via `extraResources` and the `deb`/`rpm`/`appImage` `fpm` entries. Needs: whether any environment/host data (paths, usernames, git remote URLs) leaks into generated metadata.
6. The unfiltered `extraResources` entry `build/generated/local-whisper/shared` → `local-whisper` with `filter: ["**/*"]`, and the per-platform `build/generated/local-whisper/native` entries. Contents are generated by `prepare:local-whisper:packaging`; **whatever that script emits ships verbatim.** Same class as §1.
7. `webpack.config.js` — needs: `devtool` setting under `NODE_ENV=production` (source maps are excluded from the package by `!**/*.map`, but inline maps would not be), `DefinePlugin` values that could bake secrets into the bundle, and `node`/`target` settings for the main process.
8. `tsconfig.json`, `tsconfig.test.json`, `scripts/tsconfig.json` — `strict` flags and whether test config leaks into the production build graph.
9. `scripts/verify-installers.mjs` (23.3 KB), `scripts/packaged-runtime-policy.mjs` (7.2 KB), `scripts/verify-packaged-runtime.mjs` (12.3 KB) — these are the *existing* packaging guardrails. Reading them may show that some findings above (notably §1) are already caught downstream, which would lower severity.
10. `scripts/smoke-cloakbrowser.mjs` (1.7 KB) — completes the CloakBrowser picture; may contain the runtime binary-integrity check whose absence is noted in "Verified sound" §5.

**Low priority:**

11. `.github/workflows/actionlint.yml` (774 B) — confirm it actually gates, and whether it runs `actionlint` with the shellcheck integration enabled.
12. `scripts/validate-dependabot-config.mjs` + `.github/dependabot.yml` — confirm whether the `github-actions` ecosystem is covered (directly relevant to §6's fix).
13. `scripts/build-size-metrics.mjs` / `build-size-cli.mjs` and `build/size-baselines/` — a size gate would independently catch §1's 697 MB; worth checking whether it covers `extraResources` or only the asar.
14. `apt-get install` in `pr-checks.yml:54-55` installs unpinned package versions, making the toolchain non-reproducible. Borderline in-scope (adjacent to the native CI review); noted, not filed.
