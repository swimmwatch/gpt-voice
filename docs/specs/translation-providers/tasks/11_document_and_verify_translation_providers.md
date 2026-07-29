# 11 Document And Verify Translation Providers

## Outcome

User-facing feature, architecture, privacy, and workflow documentation reflects
Google/Bing/Yandex selection and isolated translator contexts. Full quality,
build, privacy, and compatibility checks pass, and separately authorized
synthetic manual canaries validate provider reuse/separation, no-replay,
cleanup, full-inventory UI, and no-text monitoring before the feature is
declared complete.

## Prerequisites

- Tasks 01–10 are complete and approved.
- Task 11 has separate execution authorization.
- No earlier deterministic provider, settings, runtime, UI, or monitor check is
  failing.

## Owned Requirements

- `DOC-001`–`DOC-004`
- Final verification of `DOC-005`
- `COMP-005`
- `AC-AUTO-009`–`AC-AUTO-010`
- `AC-MAN-001`–`AC-MAN-004`
- `AC-MAN-006`
- Final review of `AC-MAN-005`; real issue writes remain a separate manual gate

## In Scope

- README architecture/feature/usage/privacy updates.
- General security-sensitive-area guidance.
- Final sanitized engineering research consistency update.
- Full project quality, build, workflow, privacy, and compatibility checks.
- Opt-in synthetic manual provider/UI/monitor canaries and sanitized evidence.
- Final rollback/revalidation readiness.

## Out Of Scope

- Yandex-specific warning, opt-in, badge, or special user privacy section.
- DeepL implementation or placeholder.
- Provider API/private endpoint use, challenge bypass, translation-quality
  comparison, release notes, version changes, packaging target changes,
  commits, pushes, pull requests, tags, publishing, or issue writes without
  separate authorization.

## Task Contract

1. Update README feature copy from Google-only translation to user-selected
   Google, Bing, or Yandex and describe provider and target selection before
   the translation hotkey.
2. Update the architecture flow so selected text routes through main-owned
   translation settings and the provider registry into one isolated
   nonpersistent provider context, not the persistent voice-provider session.
3. State generally that selected text is sent to the public translator chosen
   by the user, results return to the clipboard, and the provider determines
   network handling, quotas, availability, and retention.
4. State generally that GPT-Voice keeps separate reusable nonpersistent
   translation contexts until visible clear, invalidation, settings change, or
   app exit, and that visible clearing/context closure does not prove
   provider-side deletion.
5. Do not add a Yandex-specific warning, special privacy subsection, badge,
   acknowledgement, or opt-in. Keep provider-specific findings only in the
   sanitized engineering research record.
6. Add selected text/results and isolated translation browser state to the
   appropriate general security-sensitive areas in `SECURITY.md` without
   turning the vulnerability policy into provider setup documentation.
7. Ensure contributor/research guidance documents the daily 06:00 UTC monitor,
   manual dispatch, no-text probe, drift-versus-failure distinction,
   issue fingerprint reuse/reopen behavior, and reviewed baseline update
   process.
8. Reconcile `docs/researches/translation-providers/main.md` with implemented
   selectors/limits/origins and retain evidence dates, limitations, accepted
   Yandex risk, DeepL blocker, and revalidation triggers. Add only sanitized
   post-implementation observations obtained through an authorized canary.
9. Run the complete automated quality set and resolve failures without
   weakening strict types, tests, security checks, permissions, privacy
   redaction, or provider contracts.
10. Run an explicit repository/source/fixture/workflow scan confirming no
    selected text, translated result, source-bearing URL fixture, cookie,
    storage value, private response, account state, or credential was committed
    or placed in logs/issue fixtures.
11. Audit compatibility:
    - existing Google provider and legacy target migration;
    - record/translate/prettify/retry/tray/notification/clipboard behavior;
    - voice-provider persistent session behavior;
    - no automatic provider/target fallback;
    - one provider failure isolated from later manually selected providers;
    - DeepL-like stored ID repair without navigation;
    - localized safe failure on page volatility.
12. With separate live-browser authorization, use one short inert synthetic
    sample per provider and retain only provider ID, target, lengths, safe
    outcome, duration, and cleanup/context state:
    - first translation succeeds through Google, Bing, and Yandex;
    - a second operation proves same-provider context reuse;
    - switching proves distinct contexts and remembered targets;
    - no source/result/URL/DOM/browser storage is retained in evidence.
13. Verify each provider's over-limit input is rejected before source insertion
    and prior clipboard is preserved. Use synthetic generated lengths, never
    private selected text.
14. In a deterministic development fault harness, simulate post-submission
    timeout and prove zero replay, successful clear, clear failure with context
    close, and close failure with no cache/clipboard replacement.
15. Run the app locally at the unchanged 520×420 main-window content size and
    verify mouse/keyboard/typeahead/scroll/focus behavior for both Selects with
    all 249/179/118 entries. Do not resize or enlarge the product window to
    satisfy this gate.
16. With live-probe authorization, run a no-text manual probe and inspect only
    the sanitized report. A real issue create/reuse/reopen exercise remains
    gated by the separate repository-owner authorization in Task 10.
17. Inspect app logs, config, live browser lifecycle, report, and any authorized
    issue body for prohibited sensitive material. Confirm all provider
    contexts close on app exit.
18. Record platform-specific checks that could not run locally. Do not claim
    Windows/macOS live or packaged evidence from a Linux-only result.

## Contracts And Boundaries

- Documentation describes chosen-provider transmission plainly but does not
  claim identical provider retention or provider-side deletion.
- Synthetic samples are inert and non-private. Manual evidence is metadata
  only and never includes source/reference/result text.
- Live provider and GitHub actions are optional manual gates, never
  deterministic CI assertions.
- A failed provider can remain independently fail-closed; the feature gate
  cannot silently route to another provider.
- This packet changes no version, package target, installer, dependency, or
  release artifact.

## Expected Files Or Components

- Update:
  - `README.md`;
  - `SECURITY.md`;
  - `docs/researches/translation-providers/main.md` only for sanitized
    implementation/revalidation consistency;
  - `CONTRIBUTING.md` only if Task 10 guidance still has a documented gap.
- Update tests or code only to fix a verified gate failure within the approved
  feature contract; record every such file in the handoff.
- Do not create release notes or a new provider-specific privacy document.

## Acceptance Criteria

- README feature, architecture, usage, and general privacy text consistently
  names Google/Bing/Yandex and isolated nonpersistent contexts.
- DeepL remains explicitly deferred where relevant and absent from product UI.
- No Yandex-specific user warning/opt-in/special section exists.
- Monitor operations and review flow are documented accurately.
- Formatting, lint, app/test type checks, all unit tests, production audit,
  production build, applicable CloakBrowser smoke, and workflow lint pass or
  have an explicit platform/tool manual gate that does not hide a code failure.
- Privacy scan finds no prohibited source/result/browser/private material.
- Authorized manual evidence satisfies `AC-MAN-001`–`AC-MAN-004` and
  `AC-MAN-006`; `AC-MAN-005` stops before issue writes unless separately
  authorized.
- No GPT-Voice/CloakBrowser process or translation context remains after
  verification.
- Compatibility audit finds no regression outside the approved translation
  additions.

## Verification

Run:

```text
npm run format:check
npm run lint
npm run typecheck
npm run test:types
npm test
npm run audit:prod
npm run build:prod
npm run prepare:cloakbrowser
npm run smoke:cloakbrowser
actionlint -color
```

The last three commands may require network, a prepared browser binary, or
local actionlint. Treat unavailable external tooling as a recorded manual gate;
do not treat a command failure caused by code as unavailable.

Run targeted privacy searches over runtime logging calls, fixtures, research
artifacts, monitor reports, workflow issue fixtures, config serialization, and
the production bundle. Use only known inert test sentinels and prohibited field
names; do not search for or expose user clipboard/profile data.

## Failure And Rollback

- Any deterministic failure, sensitive-data leak, post-submit replay,
  cleanup/cache/clipboard violation, overbroad workflow permission, or
  provider-contract mismatch blocks completion.
- Revert documentation claims that are not supported by verified behavior.
- A reviewed runtime rollback may remove a broken provider from the registry;
  stale selected IDs then repair to Google under Task 06. Do not automatically
  fall back during an operation.
- DeepL re-entry or a changed provider contract requires focused specification
  revision and sanitized revalidation, not an ad hoc final-gate fix.

## Manual Gates

- `npm run prepare:cloakbrowser` may download a pinned browser and requires
  network authorization when not already prepared.
- Live Google/Bing/Yandex canaries require explicit authorization, isolated
  development state, and inert synthetic text.
- Local headed UI verification requires permission to run the Electron app.
- Workflow dispatch and issue create/update/reopen require separate explicit
  repository-owner authorization. Stop at mocked reconciliation otherwise.
- Platform-native packaging, commit, push, pull request, tag, release, or
  publication is not authorized by this packet.

## References

- Mandatory:
  - README translation feature/architecture/usage/privacy sections;
  - `SECURITY.md`;
  - `CONTRIBUTING.md` monitor guidance;
  - `src/main/window.ts` for the unchanged 520×420 manual UI gate;
  - sanitized translation-provider research record;
  - completed Tasks 01–10 and their handoff evidence;
  - `docs/agent-guides/project-conventions.md`, project commands, tests/docs,
    providers, browser, and logging sections.
- Traceability:
  - approved specification “Documentation Requirements”, “Compatibility and
    Failure Behavior”, “Acceptance Criteria”, and “Revalidation and Rollback”;
  - decisions `rollout.deepl`, `rollout.yandex`,
    `security.context-lifecycle`, and
    `security.yandex-disclosure`.

## Completion And Handoff

- Mark Task 11 complete only after all mandatory automated and authorized
  manual acceptance evidence is recorded.
- Update `handoff.md` with every changed file, exact checks, manual evidence,
  platform limitations, privacy scan, remaining gates, and no next
  implementation packet.
- Present final feature-gate evidence and stop. Do not commit, push, open a pull
  request, dispatch a workflow, write an issue, tag, or release in the same
  invocation.
