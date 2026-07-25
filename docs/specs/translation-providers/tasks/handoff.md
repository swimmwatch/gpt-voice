# Handoff: Translation Providers Task 01 Complete

Status: Task 01 is implemented and verified. Its green foundation commit is
authorized. Task 02 is authorized but has not started; Tasks 03–11 are not
authorized.

## Completed Packets

- [01 Shared contracts and inventories](01_define_translation_contracts_and_inventories.md)
  - Added the closed Google/Bing/Yandex provider contracts and fail-closed
    provider/language lookup helpers.
  - Added exact checked-in runtime inventories matching the reviewed
    2026-07-25 baselines: Google 249, Bing 179, and Yandex 118.
  - Added deterministic schema, invariant, source-only exclusion, DeepL
    absence, opaque-code, and TypeScript/YAML parity tests.

## Changed Files

- Added `src/shared/translationProvider.ts`.
- Added `src/shared/translationLanguages/google.ts`,
  `src/shared/translationLanguages/bing.ts`, and
  `src/shared/translationLanguages/yandex.ts`.
- Added `tests/shared/translationProvider.test.ts` and
  `tests/shared/translationLanguageBaselines.test.ts`.
- Updated `docs/specs/translation-providers/decisions.yaml`, `tasks/todo.md`,
  and this handoff for the Task 01 authorization and completion state.
- Preserved the pre-existing uncommitted specification, research baseline, and
  agent-reference changes.

## Checks

- `node --import tsx --test tests/shared/translationProvider.test.ts tests/shared/translationLanguageBaselines.test.ts`
  passed.
- `npm run typecheck` passed.
- `npm run test:types` passed.
- `npx eslint src/shared/translationProvider.ts src/shared/translationLanguages tests/shared`
  passed.
- `npx prettier --check "src/shared/translationProvider.ts" "src/shared/translationLanguages/**/*.ts" "tests/shared/**/*.ts"`
  passed.
- Production import inspection found no YAML parser or `docs/` import.
- `decisions.yaml` parses successfully and its latest
  `execution.task-01` decision is revision 3.

## Exact Next Packet

- Create the authorized Task 01 foundation commit, excluding the unrelated
  `.agents/references/specification-interview.md` edit, then execute
  [02 Base provider lifecycle](02_build_base_translate_provider_lifecycle.md).

## Blockers

- None.
