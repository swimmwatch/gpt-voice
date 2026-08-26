# Specification: Cross-app Modal Confirmation Consistency

**Status: Approved**

**Date:** 2026-08-08

## Outcome

**OUT-001:** GPT-Voice SHALL present clear, consistent, accessible modal actions across every renderer window. A user SHALL be able to distinguish dismissal, normal submission, and destructive confirmation without relying on a feature-specific implementation.

## Scope

**SCOPE-001:** This specification covers all current renderer `AlertDialog` confirmation flows and `Dialog` data-entry flows. It includes Local Whisper artifact removal and interruption; transcription-history clearing; provider-auth clearing; diagnostic capture actions; Settings discard; Prettify profile deletion, replacement, editor, import, and export; and Hotkey capture.

**SCOPE-002:** Existing workflow content, trusted data sources, window ownership, IPC, provider behavior, persistence, and modal size requirements remain unchanged unless this specification explicitly states otherwise.

## Shared UI Contract

**UI-001:** The renderer SHALL provide one internal shared `ConfirmationDialog` composition built solely from the existing `AlertDialog`, `Button`, spinner, and theme-token primitives. Feature code SHALL not assemble one-off raw Radix confirmation action layouts.

**UI-002:** `Dialog` and `AlertDialog` SHALL consume one shared internal surface/layout style contract for overlay, surface, border, foreground, shadow, header, and footer rules. Confirmations may remain compact while data-entry dialogs retain wider or scrollable layouts required by their content.

**UI-003:** Every modal footer SHALL place its dismissal action first, rendered with the existing outline Button variant. Labels SHALL accurately describe the safe result, including Cancel, Keep, Continue, and Close.

**UI-004:** A destructive confirmation SHALL render its final action with the existing destructive Button variant. Normal Save, Apply, Export, Import, and Hotkey submissions SHALL render with the existing primary Button variant. No new color token or button variant is permitted.

**UI-005:** A modal workflow with a footer dismissal action SHALL not add a redundant header close control. The Hotkey modal SHALL remove its header close button.

**UI-006:** The Local Whisper removal title SHALL name the target artifact type and its existing trusted catalog display label, for example `Remove model “Tiny · Full”?`. It SHALL not display a raw artifact ID.

## Confirmation Behavior

**FLOW-001:** `ConfirmationDialog` SHALL accept controlled visibility, localized title/description/action labels, a destructive-or-primary action tone, an optional action icon, and an asynchronous confirmation callback returning a success boolean.

**FLOW-002:** A successful confirmation callback SHALL close the dialog once. A callback returning failure or rejecting SHALL leave the dialog open; the feature owner SHALL retain or present its existing safe localized failure state.

**FLOW-003:** While any modal submission is pending, it SHALL disable its submit and dismissal controls, ignore escape/open-state dismissal requests, expose `aria-busy` on the submitted action, and show the existing spinner. It SHALL not issue a duplicate command.

**FLOW-004:** Each modal SHALL preserve its established focus-restoration behavior. A cancelled or successfully completed action SHALL restore focus to the initiating control when that control remains available. A failed confirmation that remains open SHALL keep focus inside the dialog on its safe error content or confirmation action.

## Accessibility And Localization

**A11Y-001:** Modal content, descriptions, controls, keyboard focus containment, visible focus rings, and logical footer action order SHALL remain accessible through the existing Radix semantics. Confirmation actions SHALL be reachable by keyboard and shall not be triggered accidentally by pending or dismissal interactions.

**I18N-001:** Changed Local Whisper removal copy SHALL be localized in every supported Local Whisper catalog. Existing application translation keys SHALL continue to supply the shared confirmation and data-entry labels; no raw internal errors, IDs, paths, URLs, sessions, or installer details may appear in a modal.

## Compatibility, Security, And Operations

**COMP-001:** The change is renderer-only and SHALL preserve existing Electron IPC, preload API, data schemas, provider contracts, supported platforms, and persisted settings.

**SAFE-001:** A modal failure SHALL expose only the feature’s existing safe localized error and SHALL never introduce raw exception text or private data.

**OPS-001:** This change SHALL add no dependency, service, network activity, runtime, package target, release workflow, or manual data migration.

**NONGOAL-001:** This work does not redesign non-modal screens or alter the domain semantics of delete, clear, save, export, import, Hotkey capture, or Local Whisper artifact lifecycle actions.

## Acceptance

1. Every confirmation flow uses the shared `ConfirmationDialog` and correct outline/destructive or outline/primary action hierarchy.
2. Local Whisper model and runtime removal render styled actions and a localized, friendly catalog-backed target title.
3. Every pending modal action locks dismissal and duplicate submission, reports progress on its action, closes only after success, and remains open after failure.
4. Data-entry dialogs share the common modal surface contract, use footer dismissal first, and have no redundant Hotkey header close action.
5. Automated renderer, accessibility, localization, type, lint, format, build, and diff checks pass. Linux and Windows dark-theme keyboard/focus visual checks are recorded as manual verification.
