# Linux Packaged Qualification Evidence

Date: 2026-08-10

## Scope

| Field | Value |
| --- | --- |
| Platform | Linux 7.0.0-28-generic x86_64 |
| Application version | 1.4.0 |
| Provider contract versions | Google, Bing, and Yandex: `2026-08-09` |
| Baseline revision | `e1fe6865ea809ca0848958defff6f7d559ab79aa` |
| Candidate revision | `1251535c7e5f9e6eaf0777535e87cefb6455216c` |
| Windows packaged qualification | Deferred by explicit user instruction; not tested or claimed |

## Automated Quality Gate

| Check | Result |
| --- | --- |
| `npm run format:check` | Passed |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test:types` | Passed |
| `npm test` | Passed: 1,989 passed, 0 failed, 1 skipped |
| `npm run build:prod` | Passed; only existing webpack bundle-size recommendations were emitted |
| `git diff --check` for workstream changes | Passed |

## Linux Packaging And Runtime

| Check | Result |
| --- | --- |
| `npm run prepare:cloakbrowser -- --target=linux` | Passed; CloakBrowser `146.0.7680.177.5` prepared for linux-x64 |
| `npm run smoke:cloakbrowser` | Passed |
| `npm run dist:linux` | Passed; AppImage, RPM, and unpacked Linux runtime created |
| `npm run verify:packaged` | Passed |
| Isolated unpacked-package first-launch smoke | Passed; application stayed running for 20 seconds until the owned bounded test stop |
| Temporary profile and cache cleanup | Passed; only reviewed temporary test directories were removed |
| Sanitized public-entry navigation | Passed for Google, Bing, and Yandex; no text, URLs, cookies, account data, or page content retained |

## Limits And Disposition

The packaged verification, deterministic lifecycle/provider tests, runtime smoke, and
public-entry canary provide Linux evidence without credentials or personal data. The
direct TypeScript adapter canary was not used as evidence because `tsx` injects a
helper unavailable in Playwright page evaluation; this is a harness limitation, not a
packaged-runtime result. No translation text, result text, clipboard data, credentials,
cookies, screenshots, browser profile, or provider page content was retained.

The user-approved Linux-only scope completes Packet 06. Windows package/manual
qualification remains deferred and is not represented by this evidence.
