# CloakBrowser Pruning Gate

Status: Blocked
Research date: 2026-07-11
Repository commit: `6e641ae`
Dependency examined: `cloakbrowser` `0.4.10`
Scope: Determine whether the guarded `.pak.info` and `chromedriver` pruning phase can proceed for the bundled JavaScript Playwright runtime.

## Executive Summary

Do not implement Tasks 16-18. CloakHQ's public Binary License prohibits redistributing or bundling the compiled binary without a separate license, while GPT-Voice packages that binary for end users. The published JavaScript documentation also provides no written statement that `.pak.info` files or `chromedriver` are unnecessary on Linux, Windows, and macOS.

This is an engineering gate record, not legal advice. A separate written OEM/SaaS or redistribution agreement and an explicit technical statement from CloakHQ are required before reconsidering this phase.

## Baseline

- GPT-Voice currently depends on `cloakbrowser` `0.4.10` and packages its runtime as part of the desktop application.
- The scoped build-size specification treats `.pak.info` and `chromedriver` pruning as disabled until written upstream confirmation and full platform validation are complete.
- The current safe scope defers macOS measurement but does not remove macOS product support; guarded pruning would still require its full supported-platform validation if the gate were ever opened.

## Findings

1. The official Binary License, Version 1.2 (July 2026), says the compiled binary is covered separately from the MIT wrapper source. It prohibits redistributing, repackaging, or including it in a third-party product or service without a separate license. It specifically says an OEM/SaaS license is required when the binary is bundled or embedded. [CloakBrowser Binary License](https://github.com/CloakHQ/CloakBrowser/blob/main/BINARY-LICENSE.md)
2. The official JavaScript README describes `cloakbrowser` as a Playwright/Puppeteer wrapper whose binary auto-downloads into the user's cache. That is a different delivery model from GPT-Voice's bundled runtime. [CloakBrowser JavaScript README](https://github.com/CloakHQ/CloakBrowser/tree/main/js)
3. The examined official JavaScript README contains no mention of `.pak.info` or `chromedriver`. Absence of documentation is not proof that either file is removable, so it cannot satisfy the required written technical confirmation.

## Alternatives and Tradeoffs

| Alternative                                                                                                | Tradeoff                                                                                                             |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Obtain a written OEM/SaaS or redistribution agreement plus explicit per-platform file-removal confirmation | May preserve the current bundling model, but requires external legal and technical approval.                         |
| Change to upstream's end-user binary-download model                                                        | May resolve bundling concerns, but is a separate product, privacy, offline-availability, and release-design project. |
| Keep the bundled runtime unchanged                                                                         | Preserves current behavior; leaves the guarded size reduction unavailable.                                           |

## Prioritized Recommendation

1. Keep Tasks 16-18 blocked and do not remove any CloakBrowser runtime files.
2. Obtain a written license determination for the existing bundled-binary distribution before making related packaging changes.
3. Request an explicit upstream statement covering `.pak.info` and `chromedriver` for the exact JavaScript Playwright distribution and every supported runtime platform.
4. Create a separate specification before considering an on-demand download or other runtime-delivery change.

## Validation Plan

Only after the gate has written approval:

1. Record the agreement and technical confirmation with the exact CloakBrowser version and supported platform layouts.
2. Implement a fail-closed runtime manifest policy.
3. Run the specification's headed/headless, persistent-profile, proxy, GeoIP, login, crash, shutdown, package, installer, size, and startup checks on every supported platform.
4. Obtain a human review before enabling pruning in a release workflow.

## Open Questions and Limitations

- Whether the project already has a separate agreement with CloakHQ is unknown and must be verified outside the repository.
- CloakHQ may provide a version-specific written technical statement privately; none was found in the examined public JavaScript documentation.
- This review did not alter runtime files, browser sessions, downloads, package artifacts, or licensing configuration.
