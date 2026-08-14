# Spec: Prettify Transformation Profiles

Status: Approved
Date: 2026-07-30
Scope owner: Prettify selected-text workflow

## Objective

- **OUT-001:** Optimize Prettify first for turning rough dictated or selected text into effective AI prompts, and second for polishing general voice-entered text.
- **OUT-002:** Replace the single undifferentiated transformation choice with explicit, reusable profiles while preserving the selected-text safety, provider, cancellation, and clipboard contracts.
- **OUT-003:** Let users persistently arrange all profiles in the order most useful to their workflow without changing profile content, the explicit default, or one-off selection behavior.

Success means a user can press F12, verify the captured source, choose a suitable profile, and send the first successful result to the clipboard; a user with one preferred profile can press Ctrl+F12 and obtain the same result without opening a chooser; and a user can save a mixed built-in/custom order in Settings and see that exact order on the next chooser open.

## Research Basis

- **EVID-001 — Telegram AI Editor:** The user-supplied screenshot and Telegram's official March 31, 2026 announcement show separate Fix, Style, and Translate operations, a source-text panel, explicit style selection, and styles such as Formal, Short, Corp, Zen, Tribal, Biblical, and Viking. Telegram's May 7, 2026 announcement adds prompt-defined custom styles with preview and sharing. GPT-Voice adopts the clear selection model, not Telegram's entertainment-oriented catalog or sharing service.
  - <https://telegram.org/blog/ai-editor-mighty-polls-and-more#ai-text-editor>
  - <https://telegram.org/blog/ai-bot-revolution-11-new-features#custom-ai-styles>
- **EVID-002 — Apple Writing Tools:** Apple's current Mac guide independently separates proofreading, rewriting, tone, free-form change descriptions, and organization, and exposes original comparison, retry, revert, copy, and replace. GPT-Voice uses this evidence to keep transformation purpose distinct from tone, while intentionally retaining immediate clipboard delivery instead of adding result review.
  - <https://support.apple.com/guide/mac-help/find-the-right-words-with-writing-tools-mchldcd6c260/mac>

Research was reviewed on 2026-07-30. External product behavior is evidence, not a compatibility dependency.

## Current Contract

Prettify currently:

- runs on desktop-selected text through a configurable F12 global shortcut;
- uses clipboard automation to capture source text and copies a successful result to the clipboard;
- shares one persisted prompt across Ollama, vLLM, Claude CLI, and Codex CLI;
- treats selected text as inert source data, preserves cancellation and single-flight behavior, and does not expose provider tools;
- limits source text to 16,000 characters and the persisted prompt to 4,000 characters;
- includes result-affecting provider settings and the prompt in a short-lived in-memory cache context;
- keeps provider settings, model controls, privacy notices, and connection behavior independent of the transformation instruction.

This specification changes profile selection and persistence. Untargeted invariants remain in force.

## Terminology

- **Transformation profile:** A complete reusable editorial instruction controlling purpose, tone, structure, length, and output constraints. A profile never selects a provider, model, generation setting, tool, or output destination.
- **Built-in profile:** An immutable product-owned profile with a stable ID, localized name and description, and versioned instruction.
- **Custom profile:** A locally persisted user-owned profile with a stable generated ID, name, optional description, and instruction.
- **Default profile:** The one profile explicitly assigned to Ctrl+F12.
- **Chooser order:** A local presentation preference containing the stable IDs of all built-in and custom profiles in their display order.
- **Chooser:** The transient trusted window opened by F12 before a provider request.
- **Quick apply:** The Ctrl+F12 path that applies the default profile without opening the chooser.

## Scope

- **SCOPE-001:** Profiles apply only to the existing selected-text Prettify workflow. Recording, transcription completion, retry transcription, transcription history, and automatic post-transcription processing remain unchanged.
- **SCOPE-002:** This version does not add result preview or diff, automatic paste or selection replacement, a main-window profile selector or indicator, new providers, provider-specific profiles, model or generation-setting profiles, shareable links, cloud profile storage, or a main-window redesign.
- **SCOPE-003:** Every built-in and custom profile preserves the source language. Translation remains the separate Translation action and hotkey.

## Design References

- Chooser implementation contract:
  [`design/chooser-design.md`](./design/chooser-design.md) and
  [`design/PrettifyProfileChooser.blueprint.tsx`](./design/PrettifyProfileChooser.blueprint.tsx).
- App Settings profile-management contract:
  [`design/profiles-settings-design.md`](./design/profiles-settings-design.md)
  and
  [`design/PrettifyProfilesSettings.blueprint.tsx`](./design/PrettifyProfilesSettings.blueprint.tsx).
- Rendered references:
  [`design/prettify-profile-chooser-preview.png`](./design/prettify-profile-chooser-preview.png)
  and
  [`design/prettify-profiles-settings-preview.png`](./design/prettify-profiles-settings-preview.png).

The specification owns behavior and data contracts. The design documents own
layout, component mapping, interaction presentation, accessibility treatment,
and responsive behavior.

## Built-In Profile Catalog

- **CAT-001:** Ship exactly four built-in profiles. Their canonical initial and repair order is `prompt-ready`, `polish`, `professional`, and `natural`; the persisted chooser order may place them elsewhere or interleave them with custom profiles.
- **CAT-002 — Prompt-ready:** Turn rough source into a clear AI instruction. Use goal, context, constraints, and expected-output structure only when the corresponding information exists in the source. Do not add facts, requirements, placeholders, assumptions, clarification questions, or instructions for the target AI to ask questions.
- **CAT-003 — Polish:** Continue the conservative editor behavior: correct grammar, remove filler and accidental repetition, clarify wording, and shorten when safe without materially restructuring the source.
- **CAT-004 — Professional:** Produce formal, precise, respectful workplace or technical prose without adding corporate jargon, changing the task, or weakening or strengthening requirements.
- **CAT-005 — Natural:** Remove dictation artifacts and produce clear conversational prose while preserving the speaker's voice, formality level, intent, and details.

Every built-in returns only transformed text, without commentary, wrappers, or an explanation. All preserve requests as requests, commands as commands, and source code, Markdown, URLs, identifiers, numbers, names, quotations, deliberate emphasis, and meaningful formatting unless a profile's stated transformation requires safe reorganization.

## Profile Contract

- **PROF-001:** A profile is provider-independent and represents a full transformation instruction rather than a small tone suffix.
- **PROF-002:** The chooser and Settings expose both built-in and custom profiles.
- **PROF-003:** A custom profile requires a name and non-empty instruction and may have a description. Settings supports Create, Edit, Duplicate, Delete, Set as default, Import, and Export, plus ordering of all built-in and custom profiles.
- **PROF-004:** Exactly one valid profile is the explicit default. New installations default to Prompt-ready. Choosing a profile in the F12 chooser is one-off and never changes the default. Deleting a default custom profile requires selecting a replacement in the same atomic operation.
- **PROF-005:** Built-ins can be selected, inspected, duplicated, and moved within the presentation-only chooser order but cannot be edited, hidden, replaced through import, or deleted. Duplicating a built-in creates an independent custom profile.
- **PROF-006:** Full profile management lives in App Settings > Prettify. The chooser includes a Manage profiles action that cancels the chooser, restores clipboard state, and opens Settings directly at profile management.
- **PROF-007:** App Settings > Prettify owns one persisted chooser order shared by built-in and custom profiles. Reordering never changes the explicit default, the last one-off chooser selection, profile instructions or metadata, provider settings, or cache identity.

## Data And Validation

- **DATA-001:** Enforce these limits before persistence, import preview, or provider execution:
  - custom profile name: 1–64 characters after trimming;
  - description: 0–240 characters after trimming;
  - instruction: 1–4,000 characters after trimming;
  - custom profiles: at most 200;
  - imported file: at most 4 MiB before parsing.
- **DATA-002:** Persist a versioned catalog containing the default profile ID, custom records, and one chooser-order array of stable profile IDs. Built-ins are reconstructed from stable product IDs and are not copied into mutable persisted records. Each custom record contains only a stable generated ID, name, optional description, and instruction; its display position exists only in the chooser-order array.
- **DATA-003:** Normalize custom names for uniqueness with trimmed, case-insensitive Unicode comparison. Reject empty or duplicate normalized names, duplicate IDs, unsupported schema versions, non-object records, unknown required shapes, non-string fields, over-limit fields, and catalogs exceeding capacity. Validation is strict at renderer and trusted main-process boundaries; main remains authoritative.
- **DATA-004:** A normalized chooser order contains every currently valid built-in and custom profile ID exactly once. On load or migration, main removes duplicate and unknown IDs and preserves the relative order of valid entries. With no prior order, initialize canonical built-ins followed by custom profiles in their existing order. With a partial prior order, append missing built-ins in canonical relative order and then missing custom profiles in catalog order. Creating, duplicating, or importing a new custom profile appends it to the end; replacing a custom profile preserves its position; deleting one removes its ID. Order repair persists atomically with the catalog.

Profile names, descriptions, and chooser order affect presentation only. Cache identity and provider execution use the effective instruction and its product contract version, not presentation metadata.

## F12 Chooser Flow

- **FLOW-001:** F12 captures the current desktop selection, validates it, restores the previous clipboard, and then opens the chooser. No provider readiness check or generation request occurs before Apply.
- **UI-001:** Open one compact, focused transient chooser on the OS-active display containing the cursor. If cursor geometry cannot resolve an active display, use the active nearest display, then the active primary display, then the first active display. Use nearest/primary best effort only when active-display enumeration is unavailable. Keep it within the display work area and do not move, resize, replace, or expand the fixed 520 by 420 main window.
- **UI-002:** Open with the configured default profile selected and keyboard-focused. Single-click and keyboard navigation select a profile. Apply remains disabled when filtering removes the current selection. Apply and Enter submit the selected profile; selection alone never spends provider quota.
- **UI-003:** Show the captured source in a bounded, scrollable, read-only region labeled as original text. It is not editable in this version.
- **UI-004:** Show profile name, description, built-in/custom identity, and default marker, plus the Manage profiles action.
- **UI-005:** Close the chooser immediately after Apply, return to the existing tray/main-window working state, and report the final generic success or failure through existing status and notification mechanisms. Do not show a transformed-result view.
- **UI-006:** Render one list in the persisted chooser order; built-in and custom profiles may be interleaved. Search matches visible name and description and preserves the relative persisted order of the filtered results so a 200-profile catalog remains predictable and usable.
- **UI-007:** Every chooser opening selects the configured default profile. One-off chooser selections are not remembered and never affect the default or Ctrl+F12.
- **UI-010:** Do not add profile content or controls to the main Prettify provider band.
- **UI-011:** The chooser is selection-only and exposes no drag handle or reorder mode. App Settings > Prettify provides localized, keyboard-operable controls for moving any built-in or custom profile and previews the resulting chooser order before Save.
- **UI-012:** App Settings > Prettify provides profile search with the same normalized multi-term name-and-description matching as the chooser while preserving persisted relative order. Any non-empty search query disables drag and keyboard/menu reorder controls until cleared so hidden profiles cannot move unexpectedly; all non-ordering profile actions remain available.

## Quick-Apply Flow

- **FLOW-002:** Add a configurable quick-apply hotkey target with Ctrl+F12 as its default. It captures valid selected text and runs the explicit default profile without opening the chooser.
- **FLOW-003:** Neither F12 nor Ctrl+F12 adds a result review step, retry UI, original/result comparison, or confirmation after generation.
- **FLOW-004:** On the first successful non-empty result, write the result to the clipboard and show the existing generic Prettify success notification. Do not expose a custom profile name or instruction in an operating-system notification.
- **FLOW-005:** F12 closes on submit and Ctrl+F12 remains windowless; both use the same provider, cache, audit, cancellation, and result-delivery path after resolving an effective profile.
- **FLOW-006:** Capture source into main-process memory and restore the previous clipboard before displaying the chooser or waiting for generation. Only a successful result overwrites the clipboard. Cancel, close, invalid input, provider failure, and shutdown leave the restored or subsequently user-modified clipboard intact.

The existing Prettify enabled setting gates both hotkeys. Existing conflict validation, configurable shortcut capture, platform normalization, registration failure reporting, and recording/selected-text gates apply to the new quick target.

## Profile Management Flow

1. Settings loads one authoritative catalog snapshot with the current default.
2. Built-ins render as inspectable content-immutable records that remain movable in the shared chooser order; Duplicate starts a custom draft.
3. Custom edits remain transactional with the existing Settings Save/Discard behavior.
4. Setting a default, replacing a default before deletion, changing chooser order, and applying an import commit atomically through Settings Save.
5. Invalid drafts identify the affected profile and field without modifying persisted state.
6. Closing Settings with unsaved profile changes follows the existing discard-confirmation contract.

## Import And Export

- **PORT-001:** Provide local JSON import and export in App Settings > Prettify. Main owns file dialogs and filesystem access; the renderer receives only validated typed data and user-visible results.
- **PORT-002:** Export begins with an explicit multi-select list of custom profiles and no preselected profile. Write only the chosen custom profiles; exclude built-ins and the local chooser order.
- **PORT-003:** Import validates the complete document before preview. For every conflict by stable ID or normalized name, require an explicit Rename, Replace, or Skip choice. Rename assigns a fresh ID and valid unique name. Replace can target only an existing custom profile and preserves its local chooser position. Apply all confirmed changes atomically or none; append newly created imported profiles to the end in file order and never reorder existing profiles.
- **PORT-004:** Import never changes the local default profile. The user may set an imported profile as default afterward.
- **PORT-005:** Use a versioned UTF-8 JSON document bounded to 4 MiB and the 200-profile post-import limit. Include only selected custom profile IDs, names, descriptions, instructions, and schema identity/version. Exclude the local chooser order, local default, built-ins, providers, models, generation settings, hotkeys, keys, paths, source/result text, diagnostics, account data, timestamps, and machine identifiers.

File-picker cancellation is a no-op. Parse, validation, capacity, conflict, permission, read, and write failures are localized, disclose no file contents in logs, and leave catalog/default state unchanged. Export uses an explicit plaintext warning because profile instructions may contain private text.

## Provider And Cache Contract

- The effective instruction is constructed from product-owned invariants and the selected profile instruction before provider preparation.
- All four current providers receive equivalent effective semantics. HTTP providers keep source text in a dedicated user message; CLI providers keep source text in their isolated stdin/request contract.
- A profile cannot alter provider selection, provider credentials, model selection, HTTP generation controls, CLI effort/verbosity, timeout, model lifecycle, or connection checks.
- Cache identity includes the provider's existing result-affecting context plus the effective profile instruction and its product contract version. Selecting a different effective instruction, changing a custom instruction, or changing a built-in instruction version produces a miss.
- Presentation-only profile edits and chooser reordering do not invalidate results when the effective instruction is unchanged.
- Cache keys and audit metadata do not retain raw source text or raw profile instructions.

## Architecture And IPC

- **ARCH-001:** Main owns global-shortcut dispatch, selected-text capture, clipboard restoration/output, profile and chooser-order persistence and migration, import/export filesystem access, effective-instruction composition, provider execution, cache identity, cancellation, and chooser-window lifecycle.
- **ARCH-002:** The chooser and Settings remain functional renderer UI and access desktop behavior only through `window.electronAPI`. They receive no Node, Electron, filesystem, provider secret, raw IPC, or process capability.
- **ARCH-003:** Every new preload/main/renderer channel is typed and sender-validated against the exact trusted chooser or Settings window. The chooser is single-instance and operation-scoped; closing it clears renderer source/profile state. Stateful services are process-owned through the composition root, and shutdown cancels work and disposes the chooser idempotently.

No profile instruction is interpreted by the renderer as markup or code. User text renders as plain text.

## Safety And Privacy

- **SAFE-001:** Every profile preserves the requested task, meaning, constraints, facts, code, identifiers, quoted content, and deliberate emphasis. A profile may only change wording, organization, verbosity, and tone within its declared purpose.
- **SAFE-002:** Product-owned instructions require preservation of the source language for built-in and custom profiles.
- **SAFE-003:** Product-owned source-data, fidelity, output-only, and language invariants have higher priority than profile instructions. Selected text remains inert source data even when it contains instructions, delimiters, or prompt-injection text.
- **SAFE-004:** Custom instructions cannot enable tools, execute selected content, choose a provider, weaken CLI/browser/process isolation, or override product-owned invariants. The editor explains these fixed boundaries.
- **PRIV-001:** The action sends only the captured source and effective transformation instruction to the already selected Prettify provider under the provider's existing privacy disclosure. No new network destination is introduced.
- **PRIV-002:** Source preview data exists only in operation-scoped memory and the trusted chooser renderer. It is cleared on close/submit/cancel and is not persisted as chooser state.
- **PRIV-003:** Profile names, descriptions, and instructions are local plaintext settings, not credentials. Settings and export disclose that instructions are sent to the selected provider and that exported JSON is plaintext.
- **PRIV-004:** Runtime logs, metadata-only audit, cache diagnostics, crash/error messages, and default diagnostics never include source, result, profile name, profile description, profile instruction, or import/export contents. Existing explicit local Prettify text capture remains independent, opt-in, and unchanged.
- **PRIV-005:** Chooser order is local settings data containing stable profile IDs only. It is never sent to a provider, included in profile export, or emitted as a complete ordered list in runtime logs or default diagnostics.

## Failure And Recovery

- **FAIL-001:** A default custom profile cannot be deleted until the user selects a valid replacement; both changes commit atomically.
- **FAIL-002:** If F12 or Ctrl+F12 is pressed while the chooser is open, focus the existing chooser, retain its original captured source, and start no second clipboard or provider operation.
- **FAIL-003:** Escape, chooser close, Manage profiles, provider cancellation, failure, and application shutdown preserve the restored or subsequently user-modified clipboard and clear operation-scoped source state.
- **FAIL-004:** Missing/whitespace-only selection and source over 16,000 characters fail before opening the chooser or preparing a provider and use existing localized notifications.
- **FAIL-005:** Preserve single-flight selected-text behavior. Prettify cannot start while translation or another Prettify operation is active or while recording lifecycle gates disallow it. Repeated quick hotkeys during generation remain non-destructive and do not duplicate provider requests.
- **FAIL-006:** Missing provider configuration, unavailable provider, malformed output, empty output, timeouts, process/network failures, and cancellation use existing localized provider errors and generic action status. They never fall back to a different provider or profile.

If persisted catalog, default, or chooser-order data is corrupt or references a missing profile, retain valid custom records and valid relative order where possible, recover the default to built-in Prompt-ready, normalize the order under DATA-004, persist the repair atomically, and show one bounded settings warning. Do not run a quick action against an unresolved profile.

## Compatibility And Migration

- **COMP-001:** Migration is idempotent:
  - map the unchanged current built-in prompt or any recognized legacy built-in equivalent to the immutable Polish profile and keep behavior as the upgraded installation's default;
  - preserve a customized legacy prompt byte-for-byte as the instruction of one valid local migrated custom profile and make it the default;
  - never create another migrated copy on later starts.
- **COMP-002:** New installations use Prompt-ready as default. Upgrades use the migrated Polish or custom default described by COMP-001.
- **COMP-003:** Continue storing a legacy prompt projection equal to the current default profile instruction. Update it atomically whenever the default or that default custom instruction changes so an older release has meaningful Prettify behavior after rollback. One-off chooser choices never alter the projection.
- **COMP-004:** Preserve existing provider, generation, privacy, capture, cache-expiry, text-size, notification, recording, Translation, and main-window settings. Unknown or partially corrupt profile data cannot reset unrelated settings.
- **COMP-005:** Preserve the configured F12 accelerator but change its action from immediate Prettify to chooser. Add Ctrl+F12 as a separately configurable, conflict-checked hotkey with localized Settings and README migration copy. Do not change any other default hotkey.
- **COMP-006:** Chooser-order migration is idempotent. A catalog without a chooser-order array initializes built-ins in canonical CAT-001 order followed by existing custom profiles in their prior order. Reordering does not modify legacy prompt projection or unrelated settings. Older releases may ignore the order; reopening the current release repairs any missing IDs without changing valid relative positions.

Older releases may ignore profile records and use the maintained legacy prompt projection. This feature does not promise that older releases can edit or preserve new profile records after they save settings; documentation must recommend backing up exported profiles before a downgrade that will modify Prettify settings.

## Accessibility And Localization

- **UI-008:** Chooser, search, source preview, profile list, Apply, Manage profiles, CRUD, chooser reordering, default replacement, import preview, conflict choices, plaintext warnings, and confirmations are fully keyboard operable with initial focus on the configured default profile, visible focus, focus containment, and focus restoration.
- **UI-009:** Provide screen-reader names, selection/default states, live working/error announcements where applicable, contrast-compliant states, reduced-motion behavior, and localized copy and built-in metadata for every supported application locale.
- **QUAL-001:** Long localized built-in names, 16,000-character source previews, long valid custom metadata, 200 custom profiles, and small active-display work areas remain usable without clipped actions or inaccessible content.

## Operations And Packaging

- **OPS-001:** Add no external service, provider, browser session, runtime dependency, installer target, or release workflow. The selected profile feature uses existing UI, validation, JSON, file-dialog, settings, and provider primitives.
- **OPS-002:** Production and packaged Windows and Linux builds include the trusted chooser renderer assets and preserve single-instance application shutdown/resource ownership. macOS release policy remains unchanged.

README and user-facing help must document the four profiles, F12 versus Ctrl+F12, default selection, chooser-order customization, custom-profile privacy, import/export plaintext, provider transmission, migration, and downgrade caveat.

## Acceptance Criteria

### Automated

- **QUAL-002 / AC-AUTO-001:** Shared tests prove the catalog schema, all bounds, normalized uniqueness, built-in content immutability, mixed built-in/custom chooser order, default invariant, corrupt-state recovery, order normalization, and strict rejection of malformed renderer and import data.
- **QUAL-002 / AC-AUTO-002:** Migration fixtures prove unchanged built-in-to-Polish mapping, exact custom-prompt preservation, idempotency, new-install Prompt-ready default, canonical initial chooser order, preservation of prior custom relative order, legacy projection synchronization, and unrelated-settings preservation.
- **QUAL-002 / AC-AUTO-003:** Deterministic instruction tests cover all four built-ins, fixed source-data/fidelity/language/output-only invariants, custom-instruction precedence, no Prompt-ready placeholders or clarification behavior, and source text as a separate inert payload.
- **QUAL-002 / AC-AUTO-004:** Ollama, vLLM, Claude CLI, and Codex CLI adapter tests prove equivalent effective profile propagation without changing provider/model/generation settings or process/tool isolation.
- **QUAL-002 / AC-AUTO-005:** Cache tests hit only for identical source, provider context, effective instruction, and contract version; profile/instruction/version changes miss; presentation-only edits and order changes neither miss nor retain raw profile content in cache identity.
- **QUAL-002 / AC-AUTO-006:** Shortcut tests cover F12 chooser, Ctrl+F12 quick apply, configurability, conflict detection, enabled gating, platform normalization, recording/translation gates, reentry focus, and duplicate-generation suppression.
- **QUAL-002 / AC-AUTO-007:** Selected-text tests prove early clipboard restoration, successful result delivery, no chooser on invalid source, cancellation/failure/shutdown preservation, Manage profiles cancellation, and no late-result overwrite.
- **QUAL-002 / AC-AUTO-008:** Window and IPC tests prove single-instance chooser ownership, active-display placement fallback, trusted sender rejection, typed payload validation, operation-state clearing, and no provider request before Apply.
- **QUAL-002 / AC-AUTO-009:** Renderer tests cover persisted mixed profile order, filtered relative order, default marker, source preview, explicit Apply, keyboard behavior, Settings reorder controls for both profile types, CRUD/duplicate/default replacement, dirty-state Save/Discard, and no chooser or main-window reorder control.
- **QUAL-002 / AC-AUTO-010:** Import/export tests cover explicit selection, plaintext warning, schema/version/file/count/field bounds, exclusion of chooser order, conflicts, Rename/Replace/Skip, replacement position preservation, new-profile append order, no existing-profile reordering, atomic commit, default preservation, file cancellation, and read/write failures.
- **QUAL-003 / AC-AUTO-011:** Privacy and logging tests prove source/profile/import content and complete chooser order are absent from runtime logs, metadata-only audit, default diagnostics, notifications, and IPC errors; chooser order is absent from provider requests and exports; existing explicit diagnostic capture behavior is unchanged.
- **QUAL-003 / AC-AUTO-012:** Locale-key parity, type checks, test types, focused and full unit tests, lint, format check, production audit, and production build pass.

Required project gates:

```text
npm run typecheck
npm run test:types
npm run test:unit
npm run lint
npm run format:check
npm run audit:prod
npm run build:prod
```

### Manual And Packaged

- **QUAL-004 / AC-MAN-001:** In representative packaged Windows and Linux builds, select text in another application, press F12, verify the chooser appears on the active display with the exact captured source and initial keyboard focus on the configured default profile, choose each built-in using mouse and keyboard, apply it, and verify generic status plus clipboard output.
- **QUAL-004 / AC-MAN-002:** Press Ctrl+F12 from another application and verify the explicit default runs without any chooser; change the default in Settings and verify the next quick action uses it without changing provider settings.
- **QUAL-004 / AC-MAN-003:** Verify Escape, window close, Manage profiles, no selection, over-limit selection, provider unavailable, timeout, cancellation, and application quit never leave captured source in the clipboard or a visible stale chooser.
- **QUAL-004 / AC-MAN-004:** Verify chooser placement and default-profile focus on a multi-display setup and a small work area, including an OS-unavailable display and fallback behavior where active-display enumeration is unavailable. A physical display input switch is detectable only when the OS removes that display from the desktop.
- **QUAL-004 / AC-MAN-005:** With 200 custom profiles and long localized metadata, interleave built-in and custom profiles in Settings, save, reopen the chooser, and verify persisted order, filtered relative order, keyboard navigation, scrolling, default marking, and accessible actions remain usable.
- **QUAL-004 / AC-MAN-006:** Export several custom profiles, inspect the plaintext warning and excluded order data, import into a second clean profile catalog, exercise Rename/Replace/Skip, and verify the local default and existing profile order are unchanged while new profiles append in file order.
- **QUAL-004 / AC-MAN-007:** Verify the fixed main window, recording/transcription, Translation, provider selection/readiness, model actions, diagnostics capture controls, and all unrelated hotkeys remain behaviorally unchanged.

## Explicit Rejection Cases

The implementation is not acceptable if any of the following occurs:

- selecting a profile starts a request before Apply;
- F12 still performs immediate Prettify or Ctrl+F12 opens the chooser;
- a chooser choice silently changes the explicit default;
- Prompt-ready invents missing context, adds placeholders, or adds clarification instructions;
- a built-in or custom profile translates source text or changes source meaning;
- a custom profile overrides source-data, fidelity, language, output-only, provider, or process-isolation invariants;
- failure or cancellation overwrites clipboard content restored or changed after source capture;
- import partially mutates state, replaces a built-in, or changes the default;
- import or export applies, leaks, or unexpectedly changes the local chooser order;
- an export contains provider settings, credentials, hotkeys, machine data, source/result text, or diagnostics;
- source text, custom metadata, instructions, or import contents appear in logs, metadata-only audit, default diagnostics, or operating-system notifications;
- profile controls alter the fixed main-window layout or voice/transcription behavior.
- chooser reordering changes profile content, the explicit default, one-off selection, provider settings, or cache identity.
- the chooser groups built-ins ahead of custom profiles or otherwise ignores the persisted mixed order.
