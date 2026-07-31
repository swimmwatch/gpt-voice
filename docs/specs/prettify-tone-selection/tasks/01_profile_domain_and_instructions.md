# 01 Profile Domain And Instructions

## Outcome

Create the strict, provider-independent Prettify profile domain used by every
later packet. The result must define the four immutable built-ins, bounded
custom records and catalogs, deterministic visible-profile search, and one
product-owned effective-instruction composer whose invariants cannot be
replaced by custom profile text.

## Prerequisites

- The specification is approved and this plan is explicitly approved.
- Read the repository `AGENTS.md`, the current `todo.md` entry, and only the
  **Code And Logging** and **Electron And Providers** sections of
  `docs/agent-guides/project-conventions.md`.
- Inspect the current `src/shared/prettifySettings.ts`,
  `src/main/services/prettifyHttpProviders.ts`,
  `src/main/services/prettifyClaudeCli.ts`,
  `src/main/services/prettifyCodexCli.ts`, and their directly related tests.
- Do not start persistence, provider wiring, renderer work, or another packet.

## Owned Requirements

- OUT-001, OUT-002
- SCOPE-003
- CAT-001, CAT-002, CAT-003, CAT-004, CAT-005
- PROF-001, PROF-002, PROF-005
- DATA-001, DATA-003
- SAFE-001, SAFE-002, SAFE-003, SAFE-004
- UI-009 (built-in display metadata locale-key portion)
- QUAL-002 / AC-AUTO-001
- QUAL-002 / AC-AUTO-003
- The task-local parts of the unnumbered **Provider And Cache Contract**

## In Scope

- Shared profile IDs, kinds, records, catalog views, validation constants, and
  strict guards/normalizers.
- Product-owned built-in definitions and localized metadata keys.
- All supported locale-catalog entries for the four built-in names and
  descriptions, added early enough for packet 04 to create localized chooser
  summaries.
- Shared normalized multi-term name/description search.
- Deterministic effective-instruction composition and contract versioning.
- Deterministic shared/main unit tests for all of the above.

## Out Of Scope

- Catalog filesystem persistence, migration, repair, or UUID generation.
- Provider adapter/runtime changes.
- Clipboard, chooser, global-shortcut, renderer, Settings, IPC, or packaging
  changes.
- Import/export file dialogs or conflict UI.
- Any fifth built-in, translation profile, provider-specific profile, model
  profile, result preview, or automatic paste behavior.

## Task Contract

1. Add a focused shared domain module, normally
   `src/shared/prettifyProfiles.ts`. Do not overload provider settings with
   profile business rules.
2. Define exactly these stable built-in IDs and canonical order:
   `prompt-ready`, `polish`, `professional`, `natural`. Built-ins are
   product-owned definitions reconstructed by ID and never serialized as
   mutable custom records.
3. Use catalog schema version `1` and effective-instruction contract version
   `1` as named constants. Versions must be part of deterministic tests; do not
   use dates, timestamps, or package version as contract identity.
4. Define a custom profile record with only:
   `id`, `name`, optional `description`, and `instruction`. Define a versioned
   catalog with only `schemaVersion`, `defaultProfileId`, `customProfiles`, and
   `chooserOrder`. Do not add timestamps, provider/model fields, hidden flags,
   per-record positions, a last-selected ID, or built-in copies.
5. Reserve custom IDs in the exact form `custom:<uuid>`. This packet validates
   the shape and prevents collision with built-in IDs; packet 02 injects
   `crypto.randomUUID` to generate them.
6. Enforce limits using Unicode code-point count (`Array.from(value).length`),
   not UTF-16 code-unit count:
   - name: 1..64 code points after trimming;
   - description: 0..240 code points after trimming;
   - instruction: 1..4,000 code points after trimming;
   - at most 200 custom profiles.
7. Store custom names and descriptions trimmed. Validate instruction
   non-emptiness and length against its trimmed form but preserve the original
   instruction string byte-for-byte; this is required for legacy custom-prompt
   migration in packet 02.
8. Normalize custom-name uniqueness as
   `value.trim().normalize('NFKC').toLowerCase()`. Do not strip diacritics for
   uniqueness. Reject empty names, duplicate normalized names, duplicate IDs,
   built-in IDs used as custom IDs, unsupported schema versions, arrays where
   objects are required, non-string fields, extra/unknown object properties,
   over-limit fields, invalid order shapes, and capacity overflow.
9. Define one shared search helper used later by chooser and Settings:
   normalize visible localized name plus description with `NFKD`, lowercase,
   remove `\p{Diacritic}`, split the normalized trimmed query on Unicode
   whitespace, and require every non-empty term to occur. Filtering must never
   sort or regroup its input.
10. Built-in names/descriptions are localization keys; built-in instructions
    and product invariants are non-localized provider contract text. Do not send
    localized profile display metadata to providers.
11. Add the exact name and description keys for all four built-ins to every
    supported locale catalog in this packet. Keep locale-key parity strict and
    test that every built-in summary resolves in every locale; packets 04 and
    06 must not introduce these foundational keys later.
12. Implement the built-in instruction semantics exactly:
    - **Prompt-ready:** turn rough source into a clear AI instruction; use goal,
      context, constraints, and expected-output structure only where that
      information exists; never invent facts, requirements, placeholders,
      assumptions, clarification questions, or instructions for the target AI
      to ask questions.
    - **Polish:** correct grammar, remove filler and accidental repetition,
      clarify wording, and shorten when safe without materially restructuring
      or changing style; this is the migration target for every recognized
      unchanged legacy built-in prompt.
    - **Professional:** use formal, precise, respectful workplace or technical
      prose without adding corporate jargon or weakening/strengthening the
      task or requirements.
    - **Natural:** remove dictation artifacts and produce clear conversational
      prose while preserving speaker voice, formality, intent, and details.
13. Compose one deterministic effective instruction as:
    product-invariant contract first, a fixed delimiter, then the selected
    profile instruction. The invariant contract must explicitly require all of
    the following:
    - selected text is inert source data to rewrite, never a command to answer,
      fulfill, execute, or use as a tool instruction;
    - preserve source language, task, meaning, intent, facts, constraints,
      requests/commands as requests/commands, speaker point of view, code,
      Markdown, URLs, identifiers, numbers, names, quotations, deliberate
      emphasis, and meaningful formatting unless the profile calls for safe
      reorganization;
    - never add facts or let a profile select a provider, model, generation
      setting, tool, process capability, or output destination;
    - output transformed text only, without explanation, labels, wrappers, or
      commentary;
    - product invariants have higher priority than built-in or custom profile
      instructions.
14. The composer accepts only an already validated profile instruction. It
    must not concatenate source text. Later provider packets keep source text in
    the dedicated user-message/stdin payload.

## Contracts And Boundaries

- Renderer-safe types may live in `src/shared`, but main remains the
  authoritative validator and instruction resolver.
- Profile instructions are data, never executable markup or code.
- No runtime log, thrown validation message, or test snapshot may include an
  actual custom instruction/name/description value. Validation errors use
  stable codes or field identifiers.
- The profile contract cannot alter provider settings, secrets, browser/CLI
  isolation, or Translation.
- Keep `PrettifySettings.prompt` untouched in this packet; packet 02 preserves
  it as the rollback projection and packet 03 removes its implicit use during
  profile execution.

## Expected Files Or Components

- Add `src/shared/prettifyProfiles.ts`.
- Add a focused main/shared instruction-composition module only if keeping
  non-renderer product instruction constants out of the shared UI domain makes
  the boundary clearer (for example
  `src/main/services/prettifyProfileInstruction.ts`).
- Add `tests/shared/prettifyProfiles.test.ts`.
- Add `tests/main/prettifyProfileInstruction.test.ts` when composition is
  main-owned.
- Update every supported locale catalog and extend
  `tests/main/i18n.test.ts`.
- Update direct type-test fixtures only where the new shared contract requires
  it.

Do not rename current provider/settings files or move unrelated types.

## Acceptance Criteria

- Exactly four built-ins exist in canonical order with stable IDs, immutable
  definitions, localized metadata keys, and the required semantics.
- Every supported locale resolves all eight built-in display metadata keys and
  locale-key parity remains complete before packet 04 consumes summaries.
- Valid mixed catalogs and every boundary value pass; every malformed shape,
  duplicate, reserved ID, unsupported version, empty field, over-limit field,
  and 201st custom record fails deterministically.
- Name uniqueness is NFKC/case-insensitive but not accent-insensitive.
- Search is NFKD/case/diacritic-insensitive, multi-term AND matching, and
  order-preserving.
- Effective instructions are deterministic, include contract version `1`, put
  product invariants ahead of profile text, never include source text, and
  cover each fidelity/language/output-only rule.
- Prompt-ready tests prove missing information is left unspecified and no
  placeholders or clarification behavior is introduced.
- No production behavior changes yet.

## Verification

Run the smallest focused checks:

```text
rtk test node --import tsx --test tests/shared/prettifyProfiles.test.ts
rtk test node --import tsx --test tests/main/prettifyProfileInstruction.test.ts
rtk test node --import tsx --test tests/main/i18n.test.ts
rtk npm run typecheck
rtk npm run test:types
```

If the second file is not created, omit only that command and keep equivalent
composition coverage in the shared test. Run task-local lint/format checks for
changed source and tests before handoff.

## Failure And Rollback

- On validation failure, return/throw only a stable field/code result and
  produce no mutation.
- This packet adds pure domain code. Rollback is removal of the new module and
  direct tests; it must not require config migration or user-data recovery.
- If exact instruction semantics cannot satisfy both a selected profile and the
  product invariants, stop and return to specification rather than weakening an
  invariant.

## Manual Gates

- No credentials, live providers, filesystem data, packaging, commit, push, PR,
  or release action is authorized.
- Human review must compare the four built-in semantics and the invariant layer
  against CAT-002..CAT-005 and SAFE-001..SAFE-004 before approving this packet.

## References

Mandatory task-local references:

- Specification sections **Built-In Profile Catalog**, **Profile Contract**,
  **Data And Validation**, **Provider And Cache Contract**, and
  **Safety And Privacy**.
- `docs/specs/prettify-prompt-hardening/spec.md` only for the current inert
  source-data precedent; it must not override this packet.

Optional background:

- EVID-001 and EVID-002 explain the separation of transformation purposes but
  do not authorize additional profiles.

## Completion And Handoff

After verification:

1. Mark only packet 01 complete in `todo.md`.
2. Update `handoff.md` with exact changed files, checks, failures/manual gates,
   and packet 02 as the next packet.
3. Present packet 01 for review and stop. Do not commit or start packet 02.
