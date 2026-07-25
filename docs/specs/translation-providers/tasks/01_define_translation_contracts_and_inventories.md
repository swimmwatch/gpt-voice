# 01 Define Translation Contracts And Inventories

## Outcome

Shared, renderer-safe translation types and metadata define exactly Google,
Bing, and Yandex. Their checked-in TypeScript target inventories exactly match
the reviewed 2026-07-25 YAML baselines without adding a runtime YAML loader,
dependency, or generated packaged asset.

## Prerequisites

- The translation-providers plan is approved.
- Task 01 has separate execution authorization.
- The approved specification, decision ledger, and all three baseline YAML
  files remain present and parseable.

## Owned Requirements

- `LANG-001`–`LANG-006`
- Metadata and inventory portions of `GOOG-001`–`GOOG-003`
- Metadata and inventory portions of `BING-001`, `BING-003`, `BING-004`
- Metadata and inventory portions of `YNDX-001`, `YNDX-005`
- `SEC-008`
- Inventory and metadata portions of `AC-AUTO-004`

## In Scope

- Closed provider, language, provider-info, and settings types.
- Exact provider metadata and three complete runtime target inventories.
- Guards and pure lookup helpers that fail closed on unknown IDs and codes.
- Baseline schema, invariant, and TypeScript/YAML equality tests.
- Explicit DeepL absence tests.

## Out Of Scope

- Browser contexts, provider subclasses, factories, settings persistence, IPC,
  selected-text routing, UI rendering, live probes, workflows, or docs.
- Source-language controls, cross-provider code conversion, ISO normalization,
  new dependencies, code generation, or packaging changes.
- Editing a baseline to make a failing parity test pass. A baseline correction
  requires sanitized research and review outside this packet.

## Task Contract

1. Add the exact closed union:
   `TranslationProviderId = 'google' | 'bing' | 'yandex'`.
2. Define immutable `TranslationLanguage`, `TranslationProviderInfo`, and
   `TranslationSettings` contracts with the field shapes approved in the
   specification. `targetLanguageByProvider` is a complete
   `Record<TranslationProviderId, string>`, never a partial object.
3. Check in one typed language module per provider. Copy every exact code and
   fallback label from:
   - Google: 249 targets;
   - Bing: 179 targets;
   - Yandex: 118 targets.
4. Preserve case, scripts, regional variants, legacy/provider-specific values,
   and alpha/beta label suffixes. In particular, tests retain Yandex
   `pt-BR`, `sr-Latn`, `kazlat`, and `uzbcyr` as distinct opaque codes.
5. Exclude Google `auto`, Bing `auto-detect`, all source-only entries, hidden
   chooser copies, dynamic recently-used options, and exact duplicate codes.
6. Define metadata exactly:

   | ID       | Name     | Version      | Default | Max characters | Targets |
   | -------- | -------- | ------------ | ------- | -------------: | ------: |
   | `google` | `Google` | `2026-07-25` | `en`    |          5,000 |     249 |
   | `bing`   | `Bing`   | `2026-07-25` | `en`    |          1,000 |     179 |
   | `yandex` | `Yandex` | `2026-07-25` | `en`    |         10,000 |     118 |

7. Expose immutable provider metadata in an exhaustive typed record or tuple.
   A guard may accept `unknown`, but no API silently casts, defaults, or
   falls through for an unknown provider or language.
8. Parse the three research YAML files only from tests with the existing
   `yaml` dev dependency. Validate `schema_version`, provider ID, evidence date,
   declared count, unique nonblank codes, nonblank labels, source-only
   exclusions, and exact order-independent code-to-label equality with runtime
   metadata.
9. Keep runtime modules free of filesystem and `docs/` imports. No research
   path or YAML parser enters the production bundle.
10. Add an explicit test that no DeepL ID, metadata entry, target inventory, or
    factory placeholder exists in these shared contracts.

## Contracts And Boundaries

- The shared module contains public non-sensitive metadata only. It contains no
  URL, selector, cookie, storage, account, source text, result text, or
  credential field.
- Provider codes are exact equality keys. Do not lowercase, canonicalize,
  translate, or compare them through `Intl`.
- Language array order is not a behavior contract. UI sorting belongs to Task
  08; baseline parity compares normalized maps.
- A provider contract version must change when provider behavior or code
  mapping can change translation results. It later participates in the cache
  key.
- `yaml` remains a dev dependency; `package.json`, lockfiles, Webpack, and
  package assets must not change in this packet.

## Expected Files Or Components

- Add `src/shared/translationProvider.ts`.
- Add provider inventory modules under
  `src/shared/translationLanguages/`.
- Add focused shared tests, expected as:
  - `tests/shared/translationProvider.test.ts`;
  - `tests/shared/translationLanguageBaselines.test.ts`.
- Read without changing:
  - `docs/researches/translation-providers/baselines/google-2026-07-25.yaml`;
  - `docs/researches/translation-providers/baselines/bing-2026-07-25.yaml`;
  - `docs/researches/translation-providers/baselines/yandex-2026-07-25.yaml`.

Equivalent focused filenames are acceptable when ownership remains the same
and the handoff records them.

## Acceptance Criteria

- The provider union contains exactly three members in the required order or
  an explicitly order-independent exhaustive record.
- Exact target counts are 249, 179, and 118; all codes and labels are nonblank
  and codes are unique within each provider.
- Defaults and maximum lengths match the table above.
- Runtime maps equal the reviewed YAML code-to-label maps exactly.
- Source-only, hidden/recent duplicate, and DeepL values are absent.
- Provider-specific code variants remain distinct.
- Unknown provider and target lookups return a typed failure or `undefined`;
  they never choose Google or English implicitly.
- Production modules import no YAML parser or research file.

## Verification

Run:

```text
node --import tsx --test tests/shared/translationProvider.test.ts tests/shared/translationLanguageBaselines.test.ts
npm run typecheck
npm run test:types
npx eslint src/shared/translationProvider.ts src/shared/translationLanguages tests/shared
npx prettier --check "src/shared/translationProvider.ts" "src/shared/translationLanguages/**/*.ts" "tests/shared/**/*.ts"
```

Also inspect the production dependency graph or bundle inputs to confirm the
research YAML files and `yaml` package are not runtime imports.

## Failure And Rollback

- Any count, label, code, schema, or equality mismatch fails the packet. Do not
  edit observed evidence to satisfy code.
- Rollback removes only the new shared modules and tests; no production
  provider is enabled yet.
- If a baseline is malformed or conflicts with the approved specification,
  stop and return the conflict to specification/research repair.

## Manual Gates

- None. This packet uses reviewed public metadata and deterministic local
  tests only.
- No commit, push, pull request, baseline update, or live provider access is
  authorized.

## References

- Mandatory:
  - baseline YAML files listed above;
  - `docs/researches/translation-providers/main.md`, sections “Public
    Target-Language Baselines” and provider inventory findings;
  - existing shared closed-union and metadata patterns under `src/shared/`.
- Traceability:
  - approved specification sections “Provider Identity and Metadata” and
    “Language Inventory Requirements”;
  - decisions `research.google-language-inventory`,
    `research.bing-language-inventory`,
    `research.yandex-language-inventory`,
    `scope.language-ui-coverage`, and
    `architecture.no-new-dependencies`.

## Completion And Handoff

- Mark Task 01 complete in `todo.md`.
- Update `handoff.md` with changed files, exact checks, and Task 02 as the next
  packet.
- Present parity/count evidence and stop. Do not commit or begin Task 02 in the
  same invocation.
