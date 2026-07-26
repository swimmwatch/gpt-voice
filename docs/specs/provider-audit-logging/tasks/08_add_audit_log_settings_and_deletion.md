# 08 Add Audit Log Settings And Deletion

## Outcome

Add a localized Audit Log App Settings section with independent default-off Translation and Prettify capture toggles, trusted typed IPC, confirmed disable-and-purge behavior, and confirmed per-category/all deletion without exposing captured rows to renderer.

## Prerequisites

- Packet 07 is complete and exposes tested prune and transactional category-purge operations.
- The approved specification remains `Status: Approved`.
- Packet 07’s storage failure results contain only closed causes and safe metadata.

## Owned Requirements

- `DATA-001`
- `DATA-004`
- `DATA-005`
- `UI-004`
- `UI-005`
- `SEC-006`
- `COMP-003`

## In Scope

- Shared settings/input/result types and default normalization.
- Main-owned config persistence for both capture booleans.
- Current-Settings-window-only IPC for get, mutation, and clear actions.
- Integration with the existing renderer transactional App Settings save flow.
- Explicit disable-and-purge and clear confirmations.
- Sensitive-storage/archive disclosures in the Audit Log section.
- Localization across every current locale.
- Settings, IPC trust, renderer state, confirmation, purge, and clear tests.

## Out Of Scope

- Provider/cache result capture.
- Reading or displaying captured rows or row text.
- Archive export.
- Changes to always-on provider audit events.
- Voice transcript/audio capture.
- A configurable retention period or size limit.
- General settings redesign or new dependencies.

## Task Contract

1. Add `src/shared/diagnosticCaptureSettings.ts` with renderer-safe contracts:
   - `DiagnosticCaptureSettings` contains exactly `captureTranslationDiagnostics: boolean` and `capturePrettifyDiagnostics: boolean`;
   - `DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS` sets both values to `false`;
   - strict unknown-input validation and normalization;
   - category type `translation | prettify`;
   - clear target type `translation | prettify | all`;
   - a mutation request carrying a complete candidate settings snapshot and exact confirmed purge categories;
   - a clear request carrying a closed target and literal explicit confirmation;
   - safe result/error codes that contain no row text, database path, or raw exception message.
2. Persist the two booleans through `src/main/config.ts`.
   - Store the exact keys `captureTranslationDiagnostics` and `capturePrettifyDiagnostics` in the config snapshot.
   - New, missing, legacy, wrong-type, array, null, or otherwise corrupt values normalize independently to `false`.
   - Loading must assign the explicit defaults rather than retain a previously mutable in-memory `true`.
   - Enabling affects only future actions and performs no cache scan or retroactive reconstruction.
   - Persist the candidate atomically before publishing it as the new in-memory snapshot.
3. Add `src/main/services/diagnosticCaptureSettings.ts` to coordinate settings and storage.
   - Validate the complete candidate before changing storage or config.
   - Detect every current `true` to candidate `false` transition.
   - Reject the transition unless the request confirms each exact category being disabled.
   - Confirmation for one category must not authorize purge of the other.
   - In one storage transaction, run required pruning and purge all confirmed disabled categories.
   - Only after that transaction succeeds, atomically persist the candidate config and update the in-memory snapshot.
   - If purge/prune fails, leave both persisted and in-memory settings unchanged and return a safe failure.
   - If config persistence fails after an authorized purge, keep the setting enabled, report a safe save failure, and never claim “disabled and purged.” The authorized row deletion may remain.
   - For an enable-only change, complete required pruning before persisting the new settings.
4. Add idempotent clear operations:
   - `Clear Translation` deletes only Translation rows;
   - `Clear Prettify` deletes only Prettify rows;
   - `Clear all` deletes both categories in one storage transaction;
   - all require a typed literal confirmation;
   - none changes either capture toggle;
   - repeated confirmed calls succeed without exposing whether specific text existed.
5. Add Settings-window-specific sender validation.
   - Extend `src/main/window.ts` with a helper that accepts only the current Settings window’s `webContents` identity and exact loaded URL.
   - `src/main/ipc.ts` must retain the existing generic trusted-window wrapper and additionally enforce this Settings-specific helper for the new channels.
   - A main, About, History, provider-settings, stale Settings, wrong-frame, or wrong-URL sender is rejected.
6. Add typed IPC channels and mirror their contracts in all three layers:
   - `get-diagnostic-capture-settings`;
   - `set-diagnostic-capture-settings`;
   - `clear-diagnostic-capture`;
   - update `src/main/ipc.ts`, `src/main/preload.ts`, and `src/renderer/types.d.ts` together.
   - Renderer receives only settings snapshots and closed success/failure status; it never receives row text, database handles, paths, SQL, or raw errors.
7. Extend the existing transactional App Settings flow.
   - Load diagnostic settings in the initial `Promise.all` and keep separate current/initial snapshots.
   - Add `auditLog` to `AppSettingsChangedGroup`, save input/dependencies/result, equality, dirty-state, and safe log summary.
   - Log summaries may include only the two booleans and changed category names.
   - Add the audit group as an independent save group after the existing non-destructive groups; reconcile its returned snapshot even when another group fails.
   - Do not close Settings unless the entire existing save operation succeeds.
8. Add `audit-log` to `APP_SETTINGS_SECTION_IDS`, its type guards/tests, and `SettingsNavigation`.
   - Add `src/renderer/components/settings/AuditLogSection.tsx`.
   - Render two controlled accessible switches, one for each capture setting.
   - The section must state that captured source/results are sensitive; stored as best-effort-redacted plaintext SQLite under per-user permissions, not encryption; arbitrary embedded secrets may evade redaction; enabled category data is automatically included in exported archives; and archives are not encrypted.
9. Implement disable confirmation before any save IPC begins.
   - Determine exact current-true/draft-false categories from the initial and draft snapshots.
   - Open a destructive confirmation naming the affected category or categories.
   - Confirming resumes one save with the exact purge-confirmation set.
   - Cancelling sends no save/clear IPC, retains stored data and persisted settings, restores affected toggle drafts to the initial enabled values, and leaves unrelated draft changes unsaved for later review.
   - Suppress duplicate confirmation/save requests while confirmation or save is active.
10. Implement confirmed Clear Translation, Clear Prettify, and Clear all actions.
    - Each action has a destructive dialog with target-specific localized text.
    - Confirm exactly once, disable competing clear/save controls while pending, and keep the dialog/section retryable on safe failure.
    - A successful clear updates no toggle state and does not close App Settings.
11. Add every new English-source key to all current locale dictionaries:
    - `en`, `ru`, `be`, `uk`, `es`, `pt-BR`, `zh`, `ja`, `de`, `fr`, and `hi`.
    - Preserve placeholder parity and the existing no-unapproved-English-duplicate tests.

## Contracts And Boundaries

- Main owns config, SQLite, pruning, purge, and validation.
- Renderer uses only `window.electronAPI` and never supplies a database path or SQL.
- The generic trusted-app predicate alone is insufficient for these channels; exact current Settings sender/URL validation is mandatory.
- Disable-and-purge is one explicit user intent. Clear actions are distinct destructive intents and do not mutate capture settings.
- Audit event logging remains always on and metadata-only regardless of toggles.
- UI copy must accurately disclose best-effort masking and unencrypted archives without claiming exhaustive secret detection.
- No setting, confirmation, or error log may contain captured text, config paths, credentials, or raw exceptions.

## Expected Files Or Components

- Add `src/shared/diagnosticCaptureSettings.ts`.
- Add `src/main/services/diagnosticCaptureSettings.ts`.
- Modify `src/main/config.ts`.
- Modify `src/main/window.ts`.
- Modify `src/main/ipc.ts`.
- Modify `src/main/preload.ts`.
- Modify `src/renderer/types.d.ts`.
- Modify `src/shared/appSettings.ts`.
- Modify `src/renderer/appSettingsUtils.ts`.
- Modify `src/renderer/AppSettingsWindow.tsx`.
- Modify `src/renderer/components/settings/SettingsNavigation.tsx`.
- Add `src/renderer/components/settings/AuditLogSection.tsx`.
- Modify all eleven files under `src/main/i18n/`.
- Add `tests/shared/diagnosticCaptureSettings.test.ts`.
- Add `tests/main/diagnosticCaptureSettings.test.ts`.
- Add `tests/main/diagnosticCaptureIpcContract.test.ts`.
- Add `tests/renderer/auditLogSettings.test.ts`.
- Modify `tests/shared/appSettings.test.ts`.
- Modify `tests/main/appSettingsSectionIpcContract.test.ts`.
- Modify `tests/renderer/appSettingsUtils.test.ts`.
- Modify `tests/main/i18n.test.ts` only where an explicit required-key set is appropriate.

## Acceptance Criteria

- Missing, legacy, and independently corrupt values always load as false.
- Toggles enable independently and affect only future capture eligibility.
- Main rejects an unconfirmed or partially confirmed true-to-false transition.
- Confirmed disable purges only the disabled categories and returns an updated false snapshot.
- Cancelled disable sends no IPC, deletes nothing, and restores the affected draft toggle.
- Purge failure leaves persisted/in-memory settings enabled and reports no false success.
- Clear Translation, Clear Prettify, and Clear all are confirmed, idempotent, and leave toggles unchanged.
- New methods are type-identical through main, preload, and renderer declarations.
- Every new channel rejects all senders except the exact live Settings window and URL.
- The new section is keyboard accessible, labels both switches/buttons, prevents duplicate destructive actions, and presents all required privacy/archive warnings.
- Every locale contains the new keys with placeholder parity.
- Existing App Settings, caches, history, provider results, and audit-on behavior remain unchanged.

## Verification

Run focused settings, trust, UI, and localization checks:

```bash
rtk node --import tsx --test tests/shared/diagnosticCaptureSettings.test.ts tests/main/diagnosticCaptureSettings.test.ts tests/main/diagnosticCaptureIpcContract.test.ts tests/shared/appSettings.test.ts tests/main/appSettingsSectionIpcContract.test.ts tests/renderer/appSettingsUtils.test.ts tests/renderer/auditLogSettings.test.ts tests/main/i18n.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
```

Then run the full unit suite because `config.ts`, the App Settings transaction, and the preload surface are shared:

```bash
rtk npm test
```

Record any sanitized keyboard/focus manual check in `tasks/handoff.md`.

## Failure And Rollback

- Revert the UI/IPC/config code without removing Packet 07’s additive schema.
- Unknown config keys are harmless to older code, but rollback does not erase already captured plaintext.
- Before an operational binary rollback, use the still-working confirmed disable/clear controls to purge retained categories; this is destructive and must remain explicit.
- Do not “fix” a purge failure by setting the toggle false, bypassing confirmation, broadening sender trust, or hiding the error.
- If localization or renderer state is incomplete, keep the packet unchecked and do not expose the partial Settings section.

## Manual Gates

- `MANUAL GATE`: Confirm destructive dialogs and keyboard/focus restoration with synthetic non-private rows only.
- `MANUAL GATE`: Purging real user diagnostic rows requires the user to trigger and confirm the product UI; automated implementation work must not do it.
- No commit, push, pull request, production profile access, dependency change, or release is authorized.

## References

- Approved specification: `docs/specs/provider-audit-logging/spec.md`, “Settings Contract”, “Deletion”, “Compatibility”, and “Result Capture and Settings” acceptance criteria.
- Decision ledger entries for default-off independent toggles, confirm-and-purge disable, per-category/all clear, plaintext best-effort redaction, and automatic archive inclusion.
- `AGENTS.md`.
- `.agents/references/task-packets.md`.
- `docs/agent-guides/project-conventions.md` sections “Electron And Providers” and “Tests And Documentation”.

## Completion And Handoff

- After verification, update only Packet 08’s checkbox in `tasks/todo.md` and compact continuation state in `tasks/handoff.md`.
- Record exact IPC names, settings service API, confirmation request shape, changed files, checks, and blockers.
- Hand off to Packet 09 with the authoritative main settings snapshot and best-effort storage API.
- Stop for review; do not begin Packet 09, commit, push, or open a pull request.
