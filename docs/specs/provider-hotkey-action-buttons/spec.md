# Provider Hotkey Action Buttons And Compact Home Screen

Status: Approved

## Summary

Update the production GPT-Voice home screen and its development-only browser demo to a fixed 620 × 292 CSS-pixel content area. Preserve the existing Command Dock grid and visual language, add one equal 114 × 32 keyboard-style action button to each provider row, remove the large Start Recording / Stop primary control in every recording lifecycle state, and reduce the former open status region to a fixed 54-pixel footer. Preserve the approved provider hotkey-button design exactly; this revision changes only the separate display of contextual actions available while a provider is active.

Each provider button displays one complete configured accelerator as one label and invokes the corresponding guarded production action. Provider Lock derives button availability from the existing recording, selected-text, provider-transition, settings-window, and action-enablement authorities. The provider that owns active work keeps a persistent pressed presentation: Voice remains pressed for its complete active recording-through-transcription lifecycle, and Prettify or Translation remains pressed while its own selected-text operation holds Provider Lock. Incompatible peers and locks without an active provider owner retain the Disabled treatment.

The existing 54-pixel footer displays only the actions currently available for the active provider as compact, clickable icon-and-shortcut tiles. Voice can expose Pause or Resume, Stop, and Cancel according to lifecycle; Prettify and Translation each expose Cancel while their respective selected-text operation is cancellable. The selected timer remains, with no megabyte readout: it measures captured-audio time, freezes while paused, and yields to higher-priority processing, error, or recovery detail.

Visual sources of truth for the requested delta are:

- keyboard-key layout and alignment: `docs/design/provider-hotkey-buttons-left-aligned.png`;
- compact selected status treatment: `docs/design/status-area-options/01-compact-fixed-footer.png`;
- contextual action tiles, recording timer, and no megabyte readout: `docs/design/recording-hotkey-options/02-shortcut-action-tiles-no-megabytes.png`;
- exact browser implementation evidence: `provider-hotkey-demo-compact-height.png` at 620 × 292.

The deterministic demo is the visual source of truth for every provider
Hotkey button state. The production home screen must render that treatment
through the shared `HotkeyActionButton` owner; the demo may not fork or
override the provider-key visual rules.

This specification supersedes the earlier main-window requirements in `docs/specs/ui-redesign/spec.md` only where that contract requires a smaller or taller content size, a full-width Record/Stop primary command, or recording as a large visual CTA. Its design-system, supporting-window, accessibility, privacy, provider, history, and settings contracts remain applicable.

## Outcomes And Stakeholders

- **OUT-001:** A desktop user can associate Voice, Prettify, and Translation with their effective hotkeys at a glance.
- **OUT-002:** The same control can be activated by pointer, Enter, or Space without creating a second action implementation alongside the global shortcut.
- **OUT-003:** A user can distinguish available, momentarily pressed, persistently active, locking, locked, and busy action states while the application identifies the provider doing work and prevents duplicate or incompatible work.
- **OUT-004:** The main screen keeps the existing provider hierarchy and controls while eliminating the large empty status region and obsolete recording CTA.
- **OUT-005:** Maintainers retain one authoritative recording and selected-text lifecycle across renderer clicks, preload/main IPC, global shortcuts, tray state, notifications, and cleanup.
- **OUT-006:** Designers and testers have a deterministic, privileged-action-free browser demo at the exact production content size.
- **OUT-007:** A user can discover and invoke every currently available secondary action for the active Voice, Prettify, or Translation workflow without changing the provider hotkey buttons or memorizing an undisplayed shortcut.

## Scope

- **SCOPE-001:** Change the production Electron main screen and the development-only browser demo. Both are implementation deliverables.
- **SCOPE-002:** Cover the Voice, normal chooser-based Prettify, and Translation rows and actions only.
- **SCOPE-003:** Reuse the current homepage composition, provider-row components, design tokens, localization, recording hook, main-process selected-text services, and global-shortcut action gates.
- **SCOPE-004:** Keep the production main window fixed, content-sized, and non-resizable at 620 × 292 on every currently supported production platform.
- **SCOPE-005:** Preserve the status live region and replace the footer's icon-only Voice controls with compact contextual action tiles for every action currently available to the active Voice, Prettify, or Translation workflow.
- **SCOPE-006:** Include Provider Lock presentation, active-provider ownership, persistent pressed states, state transitions, action gating, recovery, and deterministic demo coverage.
- **SCOPE-007:** Define a provider-neutral contextual-action model that covers the current Voice, Prettify, and Translation actions and can accept a later typed provider action without redesigning provider rows or the footer.

## Current-State And Dependency Findings

- **CUR-001:** The production window still declares a 520 × 420 content area, while the compact demo already proves a 620 × 292 main container, 54-pixel footer, and no document overflow.
- **CUR-002:** The home screen composes the Voice toolbar, Prettify row, Translation row, and one recording component. Production does not yet inject the hotkey action controls that the demo renders.
- **CUR-003:** The recording component currently combines two responsibilities: the removable large Record/Stop/Busy primary command, and the retained status plus Pause/Resume/Cancel workspace.
- **CUR-004:** The recording view-state model currently describes primary Record, Stop, and Busy states together with retained lifecycle status and secondary actions. Tests assert that combined model.
- **CUR-005:** The renderer recording hook owns start, stop, pause, resume, cancel, retry, microphone, audio, transcription, notification, and cleanup behavior independently of the visible primary CTA.
- **CUR-006:** Global shortcuts still reach the renderer through toggle, stop, pause, resume, cancel, and retry event subscriptions. Removing the CTA does not make those subscriptions or recording actions obsolete.
- **CUR-007:** The configured Voice hotkey already initializes through a complete hotkey settings snapshot and change event. The same contract contains the normal Prettify and Translation hotkeys, but the home screen currently stores only the Voice value.
- **CUR-008:** Prettify and Translation enablement have an existing typed query contract, but the main renderer does not currently receive a change event when App Settings saves them.
- **CUR-009:** The process-wide main interaction lock disables the main renderer, provider/settings mutations, tray navigation, and registered global shortcuts while an App Settings or provider-settings owner window holds the lock.
- **CUR-010:** The renderer's provider-configuration lock and new-recording lock cover different concerns. Neither boolean is a complete substitute for per-button action eligibility.
- **CUR-011:** Current CSS allocates 93 pixels to the removable primary recording band and at least 142 pixels to the combined recording workspace. Existing renderer tests assert this layout, the old large button, and 520 × 420 window constants.
- **CUR-012:** The startup loader occupies the same main window before the provider screen renders; reducing the native content height therefore affects startup and retry states as well as the settled homepage.
- **CUR-013:** The renderer already distinguishes Voice lifecycle states and receives both an action-specific selected-text status and a process-wide selected-text activity signal. The activity signal alone can fail closed but cannot identify which non-Voice provider should look persistently pressed.
- **CUR-014:** The configured hotkey snapshot already contains separate effective values for record/pause/resume, Stop, and Cancel. `RecordingControls` currently receives only the record hotkey, so contextual tiles require the retained Stop and Cancel legends to reach the footer without hardcoded defaults.
- **CUR-015:** The current recording eligibility permits Cancel during `starting`, `recording`, and `paused`, but not `transcribing` or `retrying`. The selected-text Prettify and Translation services already expose cancellation, and the global Escape route selects recording cancellation first when eligible, then Prettify, then Translation.

## Home-Screen Interface Contract

- **UI-001:** Preserve the current graphite Command Dock design. Do not redesign unrelated selectors, provider summaries, status indicators, settings buttons, header actions, typography, colors, borders, dividers, or icons.
- **UI-002:** Production content size and browser-demo viewport are exactly 620 CSS pixels wide by 292 CSS pixels high at device scale factor 1. Native window chrome is outside this content-size contract.
- **UI-003:** Keep the established row grid: 60-pixel header, 57-pixel Voice row, 60-pixel Prettify row, 60-pixel Translation row, and 54-pixel recording/status footer, including existing one-pixel dividers and container border accounting.
- **UI-004:** Each provider row contains exactly one semantic action button representing exactly one action hotkey:
  - Voice record/pause/resume action;
  - normal Prettify profile-chooser action;
  - selected-text Translation action.
- **UI-005:** A multi-key combination is rendered as one string inside one button, never as separate buttons or individual keycaps. Visual formatting inserts readable spaces around `+`.
- **UI-006:** The three buttons are 114 × 32 CSS pixels, share one left edge and one right edge, and remain left aligned as a group in the provider-action column.
- **UI-007:** Provider status, runtime, login, and settings controls remain in their existing row and relative order to the right of the action key. Their vertical alignment and dimensions do not change.
- **UI-008:** The button label comes from the effective configured accelerator and updates after settings save without reopening the main window. The deterministic demo displays `F9`, `Ctrl + Shift + F12`, and `Ctrl + F11`.
- **UI-009:** Letter spacing within shortcut words remains normal. Spacing introduced around `+` may be tightened independently through word spacing so the longest valid label fits without compressing letters inside key names.
- **UI-010:** The large Start Recording / Stop / Busy primary command is absent while idle, starting, recording, paused, stopping, transcribing, retrying, failed, or cancelled. It is not conditionally retained behind a demo-only or active-state flag.
- **UI-011:** The recording/status area is a fixed 54-pixel footer with no flex growth. It starts immediately after the Translation row and ends at the bottom content border.
- **UI-012:** The footer preserves the current three-column relationship: lifecycle icon and label at the start, timer or prioritized live status detail in the center, and contextual action tiles at the end.
- **UI-013:** Long localized or failure status content cannot increase the window height, overlap secondary controls, or create scrolling. Visible text is bounded to the footer while the complete localized status remains available to assistive technology and any existing detail affordance.
- **UI-014:** The complete 620 × 292 home screen has no horizontal or vertical scrollbar, clipped provider/action/settings controls, overlap, or layout shift in any required state.
- **UI-015:** Demo-only sizing, fixture, and interaction overrides remain isolated from global production styles. Reusable production button behavior and appearance have one shared owner.
- **UI-016:** This contextual-action revision makes no visual or interaction-style change to the provider `HotkeyActionButton`: its 114 × 32 geometry, alignment, face, bevel, shadow, typography, spacing, colors, hover, focus, momentary press, persistent press, locking, Disabled, busy, and reduced-motion treatments remain the approved contract.
- **UI-017:** Contextual actions use the selected compact footer-tile treatment, visually subordinate to the provider hotkey buttons. A tile combines one action icon and one complete effective shortcut legend inside one control; it must not resemble or replace the three-dimensional provider key.
- **UI-018:** Contextual tiles are ordered by action priority: Voice uses Pause or Resume, then Stop, then Cancel; Prettify and Translation use Cancel. The group remains aligned to the footer end and fits three Voice tiles without changing the 54-pixel footer or provider grid.
- **UI-019:** No recording-byte or megabyte value is displayed in the footer, demo, accessible name, tooltip, or hidden visual placeholder.
- **UI-020:** Only currently available contextual actions render. Unavailable actions do not occupy Disabled placeholders, and idle, ownerless, or non-cancellable work renders no contextual tile.
- **UI-021:** The center region shows captured-audio elapsed time in `HH:MM:SS` while Voice is recording or paused and no higher-priority status detail exists. Processing, error, retry, or recovery detail replaces the timer for as long as that detail has priority; the timer never displaces required user-visible recovery information.
- **UI-022:** The demo and production home screen render the same shared provider-key markup and visual stylesheet for enabled, hover, focus-visible, momentary press, persistent active, locking, Disabled, busy, and reduced-motion states. Demo CSS may size the review surface or reveal fixture controls, but it must not restyle a provider key.

## Hotkey Action Behavior

- **FLOW-001:** Each displayed key is a real button supporting pointer click, Enter, and Space.
- **FLOW-002:** Voice activation enters the same lifecycle path as the configured record shortcut: start while idle, pause while recording, resume while paused, and no-op in any other lifecycle state. It never invokes the separately configured Stop action.
- **FLOW-003:** The Prettify key displays the normal Prettify shortcut and opens the existing profile chooser. It does not invoke quick default-profile Prettify.
- **FLOW-004:** The Translation key displays the configured Translation shortcut and runs the existing selected-text-to-clipboard Translation flow.
- **FLOW-005:** The first accepted click preserves the matching shortcut path's provider checks, action enablement, selected-text capture, clipboard restoration, single-flight ownership, lifecycle state, status, tray icon, notification, cancellation, timeout, and failure behavior.
- **FLOW-006:** A repeated click while Provider Lock is effective is intentionally rejected before dispatch. For Prettify, this means the locked homepage button does not refocus an already active chooser; the existing global shortcut's chooser-focus compatibility remains unchanged.
- **FLOW-007:** A disconnected or invalidly configured provider follows the existing action-specific failure or recovery presentation. Connection failure alone does not imply Provider Lock unless the canonical action authority declares the action unavailable.
- **FLOW-008:** Button activation never edits hotkey settings. Configured global shortcuts, including Stop, Cancel, quick Prettify, and retry, remain supported.
- **FLOW-009:** A conflicting or rejected hotkey save retains the last valid effective shortcut and therefore cannot leave the home button displaying an unregistered candidate value.
- **FLOW-010:** Active-provider presentation follows authoritative lifecycle/activity ownership, including operations started by global shortcut. A local click may initiate feedback but cannot remain the sole source of persistent active state.
- **FLOW-011:** Voice Cancel becomes valid during `starting`, `recording`, `paused`, `transcribing`, and `retrying`; it is unavailable during `idle` and `stopping`. Pointer, Enter, Space, and the configured Cancel shortcut use the same eligibility and cancellation path.
- **FLOW-012:** The captured-audio timer starts at zero for each accepted Voice session, advances only while audio capture is recording, freezes while paused, resumes without counting the paused interval, and resets after lifecycle settlement. It is presentation only and never controls lifecycle eligibility, timeout, cancellation, or persisted history.

## Contextual Provider Actions

- **ACTION-001:** Contextual actions are separate footer controls. They do not add actions to provider rows, alter the provider hotkey-button label, or change which primary action each provider hotkey button invokes.
- **ACTION-002:** Every rendered contextual tile is a real button supporting pointer click, Enter, and Space. Activation enters the same guarded action path as the configured shortcut printed in that tile.
- **ACTION-003:** The contextual action list is derived from the authoritative active provider owner and current action eligibility. The renderer does not infer availability from button color, elapsed time, connection status alone, or the last clicked element.
- **ACTION-004:** Voice contextual actions follow this exact matrix:

  | Voice lifecycle | Contextual tiles     |
  | --------------- | -------------------- |
  | `idle`          | None                 |
  | `starting`      | Cancel               |
  | `recording`     | Pause, Stop, Cancel  |
  | `paused`        | Resume, Stop, Cancel |
  | `stopping`      | None                 |
  | `transcribing`  | Cancel               |
  | `retrying`      | Cancel               |

- **ACTION-005:** Voice Pause and Resume display the effective record/pause/resume accelerator, Stop displays the effective Stop accelerator, and Cancel displays the effective Cancel accelerator. The labels follow settings changes and platform naming; `F9`, `F10`, and `Esc` are defaults or demo data, not hardcoded production authority.
- **ACTION-006:** While Prettify owns cancellable capture, chooser, generation, provider, delivery, or cleanup work, the footer renders one Cancel tile using the effective Cancel accelerator. It disappears as soon as the canonical Prettify cancellation authority reports that cancellation is no longer accepted or ownership settles.
- **ACTION-007:** While Translation owns cancellable capture, provider, clipboard-delivery, or cleanup work, the footer renders one Cancel tile using the effective Cancel accelerator. It disappears as soon as the canonical Translation cancellation authority reports that cancellation is no longer accepted or ownership settles.
- **ACTION-008:** Voice timer and contextual action tiles may coexist in the fixed footer. A higher-priority live status may replace the timer but must not hide a currently available action.
- **ACTION-009:** A tile activation is provider- and action-specific. Cancel dispatch targets the authoritative active Voice, Prettify, or Translation operation and never relies on an ambiguous renderer-supplied legend or races through a different provider's fallback cancellation path.
- **ACTION-010:** Repeated, stale, unavailable, owner-mismatched, or post-settlement tile activation is rejected without starting, stopping, pausing, resuming, or cancelling another operation. The tile disappears when its action ceases to be available.
- **ACTION-011:** The footer consumes a typed ordered list of contextual action descriptors containing a bounded provider owner, bounded action ID, localized label, effective accelerator, icon token, availability, and busy state. Adding another supported action for an existing or future provider extends that descriptor/matrix contract rather than adding provider-specific footer layout branches.

## Provider Lock Contract

### Definition And Authority

- **LOCK-001:** Provider Lock is a derived, non-persisted action-eligibility presentation. It does not replace provider connection status and does not introduce a new provider or settings schema.
- **LOCK-002:** The main process remains authoritative. Renderer state may prevent an unnecessary request, but a stale renderer request is rejected by the same main-process lifecycle, main-interaction, selected-text, enablement, and single-flight gates used by global shortcuts.
- **LOCK-003:** Lock is fail-closed while required provider, hotkey, text-action enablement, main-interaction, or activity state is unknown. A valid later snapshot may unlock the applicable button.
- **LOCK-004:** A connection-checking, disconnected, or recoverable configuration status does not by itself lock a button when the existing action is expected to expose its normal recovery or failure path.

### Lock Matrix

| Condition                                                                           | Voice key                                   | Prettify key                    | Translation key                 |
| ----------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------- | ------------------------------- |
| Main interaction lock held by App Settings or provider settings                     | Disabled                                    | Disabled                        | Disabled                        |
| Voice, Prettify, or Translation provider/settings change is being saved or switched | Disabled                                    | Disabled                        | Disabled                        |
| Prettify model load/free action is active                                           | Disabled                                    | Disabled                        | Disabled                        |
| Required action/enablement/activity snapshot is not yet known                       | Disabled when affected                      | Disabled when affected          | Disabled when affected          |
| No active Voice provider is selected                                                | Disabled                                    | Unchanged by this reason        | Unchanged by this reason        |
| Recording lifecycle is `idle` and no selected-text action is active                 | Raised and eligible                         | Raised if enabled               | Raised if enabled               |
| Recording lifecycle is `starting`, `stopping`, `transcribing`, or `retrying`        | Persistently pressed and locked             | Disabled                        | Disabled                        |
| Recording lifecycle is `recording`                                                  | Persistently pressed and enabled for Pause  | Disabled                        | Disabled                        |
| Recording lifecycle is `paused`                                                     | Persistently pressed and enabled for Resume | Disabled                        | Disabled                        |
| Prettify capture, chooser, generation, provider work, or cleanup is active          | Disabled                                    | Persistently pressed and locked | Disabled                        |
| Translation capture, provider work, clipboard delivery, or cleanup is active        | Disabled                                    | Disabled                        | Persistently pressed and locked |
| Selected-text activity is known active but its owner is unknown                     | Disabled                                    | Disabled                        | Disabled                        |
| Prettify is disabled in App Settings                                                | Unchanged by this reason                    | Disabled                        | Unchanged by this reason        |
| Translation is disabled in App Settings                                             | Unchanged by this reason                    | Unchanged by this reason        | Disabled                        |

- **LOCK-005:** The implementation derives eligibility and visual ownership explicitly. It must not pass the broad provider-configuration lock unchanged to all three action buttons, because Voice remains actionable for Pause and Resume while still looking persistently pressed.
- **LOCK-006:** Lock acquisition is immediate for behavior: once a lock signal is authoritative, pointer, Enter, Space, repeated click, and stale renderer dispatch cannot begin or enqueue another operation.
- **LOCK-007:** Lock release occurs only after the authoritative reason clears. Success, failure, cancellation, settings-window close, provider-switch settlement, and renderer recovery cannot leave a button stuck locked or prematurely unlock it while another reason remains.
- **LOCK-008:** Multiple simultaneous reasons compose with logical OR. Clearing one reason does not unlock a button if any other active reason still applies.
- **LOCK-009:** Persistent press identifies only the provider that owns active work. A peer disabled by that work, or a lock caused by settings ownership, provider switching, model management, unknown startup state, disabled configuration, or unknown action ownership, uses the Disabled presentation and never impersonates the active provider.
- **LOCK-010:** Voice owns active work throughout `starting`, `recording`, `paused`, `stopping`, `transcribing`, and `retrying`. It relinquishes visual ownership only after the lifecycle returns to `idle` or settles into a terminal state with no retained retry/transcription work.
- **LOCK-011:** Prettify or Translation owns active work from accepted action dispatch through its complete capture, chooser where applicable, provider execution, delivery, and cleanup lifecycle. Ownership ends only when the canonical selected-text activity authority settles that action.
- **LOCK-012:** When activity is known but its provider owner is unknown or contradictory, the presentation fails closed: all affected buttons are Disabled, none is persistently pressed, and a later authoritative snapshot reconciles the owner.
- **LOCK-013:** Provider Lock and contextual-action availability are related but distinct outputs. The active provider hotkey can remain persistently pressed and locked while its currently safe Cancel tile remains available; incompatible provider hotkeys remain Disabled and contribute no contextual tiles.

### Enabled-To-Disabled Transition

- **MOTION-001:** The enabled key has the selected low-profile three-dimensional keyboard appearance: raised face, edge, depth, and graphite shadow.
- **MOTION-002:** Pointer, Enter, and Space press visibly depress the face, reduce apparent depth, and restore it on release without changing surrounding layout.
- **MOTION-003:** Enabled, hover, focus-visible, momentarily pressed, persistently active, locking, locked/disabled, and busy states are visually distinguishable while keeping identical 114 × 32 outer geometry.
- **MOTION-004:** The locked state uses the approved darker graphite face, pressed-equivalent lowered geometry and depth, muted legend, no text shadow, and not-allowed cursor. It must not use an error or warning color and has no hover or click animation.
- **MOTION-005:** Repeated activation, lost pointer capture, blur, renderer state replacement, or an interrupted timer cannot leave the key visually pressed or halfway disabled.
- **MOTION-006:** When an already enabled peer or unowned button becomes locked, it first completes any current press/release feedback and retains the raised enabled appearance for a nominal 110 milliseconds. It then transitions through color, depth, shadow, and padding to the locked appearance and is fully visually disabled no later than 200 milliseconds after the authoritative lock signal. The active provider follows MOTION-011 through MOTION-014 instead of transitioning to Disabled.
- **MOTION-007:** The visual grace period does not preserve behavior. During it the control exposes immediate unavailable semantics and rejects activation even though it still looks clickable.
- **MOTION-008:** A button whose first trustworthy render is already locked without known active-provider ownership renders directly in the Disabled state; it does not fake a prior enabled state. A button whose first trustworthy render has known active ownership renders directly persistently pressed.
- **MOTION-009:** If the lock clears before the visual transition completes, the pending transition is cancelled and the key returns to the correct enabled appearance without flashing Disabled.
- **MOTION-010:** Under `prefers-reduced-motion: reduce`, positional movement and delayed depth motion are suppressed. Immediate semantic lock plus a short non-positional contrast/shadow change communicates the state.
- **MOTION-011:** Persistent active press reuses the same lowered face, compressed side bevel, overlapping base shadow, and legend position as the momentary pointer/keyboard pressed state. It does not resize the outer button or move adjacent controls.
- **MOTION-012:** Voice remains persistently pressed throughout `starting`, `recording`, `paused`, `stopping`, `transcribing`, and `retrying`. In `recording` and `paused`, the pressed button remains enabled for Pause and Resume respectively; in the other active states it is semantically unavailable while preserving the active pressed presentation.
- **MOTION-013:** During Prettify or Translation work, only the provider that owns the operation remains persistently pressed. Its incompatible peers use the Disabled presentation, even though the same Provider Lock contributes to all three eligibility results.
- **MOTION-014:** Persistent press releases only after authoritative ownership clears. Success, failure, cancellation, timeout, cleanup, renderer reconciliation, global-shortcut initiation, blur, and interrupted pointer/keyboard feedback cannot leave the wrong provider pressed or cause a brief raised/Disabled flash between contiguous active states.

## Recording-Control Dependency Contract

- **DEP-001:** Removing the primary CTA removes its rendered button, dedicated command band, hotkey hint, primary Record/Stop/Busy presentation state, and exclusive CSS/test assumptions only.
- **DEP-002:** The recording status model remains complete for `idle`, `starting`, `recording`, `paused`, `stopping`, `transcribing`, and `retrying`, including localized labels and live detail status.
- **DEP-003:** Pause, Resume, Stop, and Cancel remain clickable through the contextual footer tiles exactly when ACTION-004 permits them. Existing callbacks, shortcut subscriptions, accessible action names, and lifecycle guards remain authoritative even though the icon-only control presentation changes.
- **DEP-004:** Start, stop, pause, resume, cancel, retry, microphone failure recovery, media cleanup, streaming/batch behavior, retryable audio, transcription submission, notifications, and lifecycle publication remain owned by the existing recording orchestration.
- **DEP-005:** Global-shortcut renderer subscriptions for toggle/start, Stop, Pause, Resume, Cancel, and retry remain active. The absence of a large Stop CTA must not disable the configured Stop shortcut, the compact Stop tile, or their shared transition to `stopping`.
- **DEP-006:** The Voice provider key becomes the visible start/pause/resume entry point. It displays the record hotkey only; it does not display or invoke Stop.
- **DEP-007:** Existing idle footer guidance that names the record hotkey remains valid and updates with the effective Voice accelerator. Removing the large CTA does not erase unrelated status or error content.
- **DEP-008:** Primary-control localization keys may be removed only after all non-obsolete consumers are proven absent and locale key parity remains valid. Lifecycle, Stop, status, and error translations remain required.
- **DEP-009:** Legacy tests that assert the large button, primary view-state object, command-band CSS, or 520 × 420 dimensions must be replaced by behavior-preserving lifecycle, hotkey-button, footer, and 620 × 292 assertions rather than deleted without equivalent coverage.
- **DEP-010:** Startup loading, startup retry, and startup failure presentations fit within 620 × 292 without white flash, hidden retry action, content overflow, or a post-load native resize.
- **DEP-011:** Removing the primary CTA does not remove the recording lifecycle signal needed to hold the Voice provider key pressed through recording, pause, stop, transcription, retry, and cleanup. Batch and streaming transcription both obey the same persistent-active presentation boundary.
- **DEP-012:** The recording view-state replacement must own status, timer visibility, and contextual Voice action descriptors without retaining an obsolete primary-action object solely to recover Stop behavior.
- **DEP-013:** Expanding Cancel through `transcribing` and `retrying` requires the recording cancellation authority, shortcut eligibility, renderer controls, transcription/retry abort path, cleanup, notifications, and tests to agree. A visual Cancel tile must not be exposed until the underlying state can safely cancel and settle.
- **DEP-014:** Prettify and Translation Cancel tiles reuse their existing service-owned cancellation and cleanup paths. The footer adds no second cancellation controller and does not change Escape priority outside the explicit Voice eligibility expansion.
- **DEP-015:** Timer state is derived from the active recorder's capture intervals and lifecycle transitions. It must survive ordinary renderer re-renders without drifting, double-counting paused time, or keeping a scheduled update after settlement, reload, or shutdown.

## Accessibility And Localization

- **A11Y-001:** Every key exposes an accessible name containing the current action and complete accelerator, not only an unexplained shortcut string.
- **A11Y-002:** The accessible Voice action reflects Start, Pause, or Resume as lifecycle state changes even though the visible legend remains the configured hotkey.
- **A11Y-003:** Focus-visible treatment remains clear against the graphite surface and is not obscured by key depth or pressed/locking presentation.
- **A11Y-004:** The locking grace period sets semantic unavailability immediately. The final locked state uses native disabled behavior; busy state also exposes `aria-busy` where applicable.
- **A11Y-005:** Locked state is conveyed through semantics, depth, contrast, cursor, and optional localized description rather than color alone. A reason exposed to the user must be localized and actionable where recovery exists.
- **A11Y-006:** Long valid accelerators and localized status text do not clip silently. The full action, accelerator, and status remain accessible if visible presentation is compacted.
- **A11Y-007:** Shortcut tokens retain platform-appropriate names. Spacing and visual formatting do not alter the accelerator value used by Electron.
- **A11Y-008:** Reduced-motion behavior satisfies MOTION-010 without removing state feedback.
- **A11Y-009:** Persistent visual press does not turn the action into a toggle or falsely expose `aria-pressed`. Lifecycle-specific accessible action names, native disabled semantics, and `aria-busy` communicate the current action and availability; visual depth identifies active ownership without replacing those semantics.
- **A11Y-010:** Each contextual tile exposes a localized accessible name containing the action and complete effective accelerator, for example “Stop recording, F10” or “Cancel Translation, Escape.” Icon-only meaning or shortcut text alone is insufficient.
- **A11Y-011:** The timer is a non-interactive duration presentation, does not announce every tick, and has an accessible label identifying captured-audio elapsed time. Higher-priority status detail retains the existing polite live-region behavior.
- **A11Y-012:** Contextual tile insertion, removal, and provider-owner changes preserve a predictable focus order. If the focused tile disappears because its action settles, focus returns to the footer/status container or another deterministic safe target and never jumps to a provider hotkey or hidden control.

## Architecture, Interfaces, And Data

- **ARCH-001:** The reusable key component owns visual state, input semantics, and transition cleanup only. It does not own provider, recording, selected-text, clipboard, session, or filesystem behavior.
- **ARCH-002:** Prettify and Translation clicks cross typed renderer-to-preload-to-main action commands. Trusted main-frame validation, exact input decoding, and bounded action identifiers apply before dispatch.
- **ARCH-003:** Renderer code uses only the typed desktop API. It receives no clipboard content, selected text, transcript, audio, provider secret, browser session, filesystem, process, or raw Electron capability.
- **ARCH-004:** Voice click activation reuses the renderer recording lifecycle already used by shortcut events. It does not create a second recorder or lifecycle owner.
- **ARCH-005:** The existing complete hotkey settings snapshot/change contract initializes and updates Voice, normal Prettify, and Translation labels. No hardcoded demo value becomes production authority.
- **ARCH-006:** One main-process action dispatcher owns the canonical Prettify and Translation action entry points used by both renderer commands and global shortcuts. Shared gates and side effects cannot drift.
- **ARCH-007:** Provider Lock and persistent active ownership are derived from typed lifecycle, provider transition, action-specific text-action status, process-wide text-action activity, main interaction lock, and enablement data. Visual timers and the originating click never become action authority.
- **ARCH-008:** The main renderer receives current Prettify and Translation enablement plus subsequent saved changes through a typed, validated snapshot/change contract so disabled state updates without reload.
- **ARCH-009:** Main-interaction lock behavior remains process-wide: the main window becomes inert, privileged handlers reject non-owner actions, tray navigation is disabled, and global shortcuts are suspended until the lease releases.
- **ARCH-010:** The fixed production content size is owned by the main-window composition root and verified through content-size semantics. Supporting-window sizes are unchanged.
- **ARCH-011:** No new runtime dependency, provider interface, persisted setting, migration, external service, or background network request is required.
- **ARCH-012:** The renderer represents active ownership as Voice, Prettify, Translation, none, or unknown. Voice ownership comes from the canonical recording lifecycle; selected-text ownership must reconcile action-specific status with process-wide activity so global-shortcut work is visible and unknown or reordered state fails closed.
- **ARCH-013:** A pure contextual-action view-state owner maps canonical provider ownership, recording lifecycle, cancellation eligibility, action enablement, localized labels, and effective accelerators to the ordered ACTION-011 descriptor list. Footer rendering is provider-neutral.
- **ARCH-014:** The typed hotkey snapshot/change contract supplies effective record, Stop, and Cancel accelerators to the main renderer. Formatting for display is separate from the accelerator value used for registration and dispatch.
- **ARCH-015:** Contextual Prettify and Translation cancellation crosses a trusted typed renderer-to-preload-to-main command that identifies the bounded provider and Cancel action. Main revalidates current ownership and cancellability before invoking the existing service cancellation path.
- **ARCH-016:** Voice Stop, Pause, Resume, and Cancel tiles call the existing renderer recording orchestration. The new transcribing/retrying Cancel eligibility is implemented at the canonical recording lifecycle boundary rather than as a footer-only exception.
- **ARCH-017:** Timer scheduling and accumulated captured duration remain renderer-local, contain no audio or transcript data, and are disposed on lifecycle settlement, reload, and shutdown. Timer values are not persisted or sent across privileged IPC.

## Browser Demonstration

- **DEMO-001:** The development-only demo renders the complete resulting homepage at exactly 620 × 292 CSS pixels with a 54-pixel footer and no overflow.
- **DEMO-002:** Its default review data uses Local Whisper, Codex CLI with `gpt-5.6-luna`, Google Translation targeting English, and `F9`, `Ctrl + Shift + F12`, and `Ctrl + F11` labels.
- **DEMO-003:** Demo provider hotkey buttons retain their existing hover, focus, pointer press/release, Enter, Space, persistent Voice active states, persistent Prettify/Translation ownership, enabled-to-locked peer transition, final Disabled state, ownership release, and reduced-motion presentation without restyling.
- **DEMO-004:** Deterministic demo-only visual controls may select a Voice lifecycle or a Prettify/Translation active owner and trigger the corresponding pressed/Provider Lock presentation, contextual tile matrix, timer, and status-priority presentation, but they change no real provider, recording, selected-text, clipboard, or operational status state and report no simulated success or failure.
- **DEMO-005:** The demo performs no microphone/audio access, clipboard read/write, selected-text automation, provider request, browser session access, process execution, filesystem mutation, notification, or external network request.
- **DEMO-006:** The demo is excluded from packaged navigation and persists no data. Demo-specific styles remain separate from global production CSS.
- **DEMO-007:** After implementation, keep the demo open in the available browser at 620 × 292 for visual and interaction review.
- **DEMO-008:** Demo states cover idle; Voice starting, recording, paused, stopping, transcribing, and retrying; active cancellable Prettify; active cancellable Translation; ownerless lock; and higher-priority status detail. Each state renders the exact contextual action matrix and no megabyte value.
- **DEMO-009:** Demo contextual tiles accept pointer, Enter, and Space only as deterministic visual interaction. They settle locally, dispatch no production command, and may advance to a safe fixture state solely to demonstrate insertion/removal and focus recovery.

## Security And Privacy

- **SEC-001:** New production action commands reject untrusted windows, subframes, malformed targets, extra fields, and unknown action identifiers before they reach an action service.
- **SEC-002:** Renderer-provided legend text never selects the privileged action. The action target is a bounded typed command, and main reads current configuration and eligibility at dispatch.
- **SEC-003:** The visual locking delay cannot delay main-process exclusion, single-flight ownership, shortcut suspension, or IPC rejection.
- **SEC-004:** Contextual tile commands accept only bounded provider/action identifiers from the trusted main frame. Main validates current active ownership and action eligibility; renderer-provided icon, label, accelerator, timer, or visual state never grants cancellation or other privileged authority.
- **PRIV-001:** New IPC payloads, logs, tests, screenshots, and demo fixtures contain no selected text, transcript, audio, clipboard content, provider secret, browser cookie/session, API key, or user document content.
- **PRIV-002:** Existing cancellation, diagnostic redaction, clipboard restoration, logging, notification, and shutdown contracts remain unchanged.

## Failure And Recovery

- **FAIL-001:** Rejected, locked, disabled, busy, stale, or repeated activation starts no operation, enqueues no work, and leaves no key pressed or partially transitioned.
- **FAIL-002:** Mixed click and global-hotkey activation preserves selected-text and recording single-flight rules and cannot duplicate capture, provider requests, audio sessions, clipboard writes, or notifications.
- **FAIL-003:** Provider disconnection, disabled text action, missing selection, over-limit input, permission denial, cancellation, timeout, malformed output, network/process failure, renderer reload, and shutdown retain existing cleanup and user-visible presentation.
- **FAIL-004:** Until valid initial hotkey, enablement, and activity snapshots arrive, the applicable buttons show safe default legends only as presentation and remain locked. Later valid snapshots reconcile labels and eligibility.
- **FAIL-005:** A settings-window or provider-switch failure releases only its own lock reason. Other active lock reasons remain effective.
- **FAIL-006:** Lost or reordered lock events cannot unlock a button against current authoritative state. Resubscription or a fresh snapshot reconciles after renderer reload.
- **FAIL-007:** Browser-demo activation always settles its visual timer and never reports provider success or failure.
- **FAIL-008:** Missing, stale, reordered, or contradictory active-owner data may disable extra buttons but cannot falsely mark a provider active. Recovery or a fresh snapshot replaces the fail-closed Disabled presentation with the correct persistent pressed owner without dispatching work.
- **FAIL-009:** Missing, stale, or contradictory contextual-action inputs render no tiles until reconciled. This fail-closed state cannot cancel the wrong provider, leave an obsolete tile clickable, or hide a required high-priority status message.
- **FAIL-010:** Cancel during Voice transcription or retry aborts the active cancellable work, performs the same audio/transcript cleanup and terminal lifecycle publication as other recording cancellation, and cannot later publish a stale transcript, retry, clipboard write, notification, or success state.
- **FAIL-011:** Timer clock failure, renderer throttling, suspend/resume, or a missed interval cannot alter recording behavior. The displayed duration resynchronizes from accumulated capture intervals, remains monotonic within a session, freezes while paused, and clears on settlement.

## Compatibility And Specification Precedence

- **COMP-001:** Existing configurable Voice, Stop, Cancel, normal Prettify, quick Prettify, Translation, and retry shortcuts and persisted formats remain compatible. Default accelerators do not change.
- **COMP-002:** Provider selection, model selection, target language, connection presentation, settings access, recording lifecycle, selected-text behavior, status detail, tray, notifications, and global shortcuts remain compatible except for the explicitly removed primary Record/Stop CTA and repeated-click lock behavior.
- **COMP-003:** The single Prettify home key continues to represent normal chooser-based Prettify; quick Prettify remains global-shortcut/settings functionality only.
- **COMP-004:** The production main-window content contract changes from 520 × 420 to 620 × 292. It remains fixed and non-resizable; no persisted migration is needed.
- **COMP-005:** This specification is authoritative over conflicting main-window size and primary recording-command requirements in the earlier UI redesign specification. All unrelated earlier contracts remain active.
- **COMP-006:** Existing supported Windows and Linux behavior remains required. The paused macOS release policy is unchanged, while platform-appropriate shortcut naming remains supported in code.
- **COMP-007:** No installer target, packaging policy, release, publish, commit, push, or deployment action is part of specification work.
- **COMP-008:** The configured Cancel shortcut keeps its persisted format and Escape routing priority, but Voice cancellation eligibility intentionally expands to `transcribing` and `retrying`. Prettify and Translation cancellation remains available when Voice is not the eligible cancellation owner.
- **COMP-009:** Existing Pause, Resume, Cancel, and Stop behavior remains compatible; only their footer presentation changes from icon-only or removed-primary controls to contextual icon-and-shortcut tiles. Provider hotkey-button appearance and behavior remain unchanged.

## Operations, Diagnostics, And Rollback

- **OPS-001:** This change adds no migration or server-side rollout. Installing a prior compatible build restores its prior window/layout behavior while preserving existing hotkey, provider, history, and text-action settings.
- **OPS-002:** Provider Lock animation produces no routine log traffic. Existing sanitized lifecycle, rejected-action, provider, and IPC diagnostics remain sufficient; logs must not include shortcut-adjacent selected text, audio, transcript, clipboard, session, or secret data.
- **OPS-003:** A renderer reload or main-window recreation obtains fresh hotkey, enablement, main-interaction, provider-transition, recording-lifecycle, action-specific selected-text status, and text-action activity state before unlocking buttons or assigning persistent active ownership.
- **OPS-004:** A regression in action gating, lifecycle cleanup, fixed-size fit, startup usability, or trusted IPC is a rollback trigger. A purely subjective key-shadow polish issue is not a reason to weaken action or lock guards.
- **OPS-005:** User-facing setup documentation requires revision if it describes the removed primary Record/Stop control, omits the compact contextual controls, or claims Voice cannot be cancelled during transcription/retry. Shortcut configuration and provider setup instructions otherwise remain unchanged.

## Non-Goals

- **NON-001:** Do not redesign the homepage, provider selectors, statuses, settings controls, header, provider-row iconography, typography, or color system. Footer changes are limited to the selected contextual action tiles, timer/status priority, and removal of the megabyte readout.
- **NON-002:** Do not add several provider actions to one row or split one accelerator into multiple keycap buttons.
- **NON-003:** Do not add hotkey editing to the homepage.
- **NON-004:** Do not add a visible replacement for the removed large Record/Stop command.
- **NON-005:** Do not display the Stop hotkey in the Voice provider key or change the Voice key into a stop action.
- **NON-006:** Do not make the browser demo call or emulate privileged application, OS, or provider capabilities.
- **NON-007:** Do not weaken existing main-interaction, trusted-IPC, lifecycle, single-flight, privacy, or cleanup gates to accommodate visual timing.
- **NON-008:** Do not restyle, resize, restructure, or otherwise revise the provider hotkey buttons as part of contextual-action implementation.
- **NON-009:** Do not add a recording byte, kilobyte, megabyte, waveform, level meter, progress bar, or throughput indicator to the selected footer treatment.
- **NON-010:** Do not expose speculative actions for a provider that has no canonical action and eligibility contract. ACTION-011 is an extension seam, not permission to invent provider capabilities.

## Acceptance Criteria

### Automated

- **AC-AUTO-001:** Component tests prove that one semantic 114 × 32 button contains each entire accelerator and that all three controls share aligned edges.
- **AC-AUTO-002:** Accessible-name tests prove action plus accelerator output, lifecycle-specific Voice naming, immediate semantic lock, native final disabled state, busy state, and full long-label accessibility.
- **AC-AUTO-003:** Interaction tests with controlled time prove pointer, Enter, and Space press/release behavior; transition into persistent active press without release flicker; the nominal 110-millisecond locking grace for peers/unowned locks; full peer Disabled presentation by 200 milliseconds; ownership release; timer cancellation; blur cleanup; repeated-input rejection; and no layout shift.
- **AC-AUTO-004:** Reduced-motion tests prove positional motion and delay are suppressed while non-positional state feedback and immediate semantic lock remain.
- **AC-AUTO-005:** Pure eligibility/presentation tests cover every Provider Lock matrix row, combined reasons, initial unknown state, state reconciliation, full Voice active lifecycle ownership, Voice availability for Pause/Resume while pressed, active Prettify/Translation ownership, Disabled peers, and unknown-owner fail-closed behavior.
- **AC-AUTO-006:** Renderer tests prove all three effective hotkey labels and Prettify/Translation enablement initialize and update from typed snapshots/change events.
- **AC-AUTO-007:** Trusted IPC tests prove only the exact trusted main frame and valid bounded action target can dispatch production clicks; untrusted, subframe, malformed, unknown, and extra-field requests are rejected.
- **AC-AUTO-008:** Dispatcher tests prove Voice, normal chooser Prettify, and Translation initial click entry points use their existing gates and observable side effects, while locked repeated clicks do not dispatch.
- **AC-AUTO-009:** Concurrency and failure tests prove mixed clicks and hotkeys cannot duplicate operations, assign the wrong active provider, or leave persistent press stuck, and preserve cancellation, clipboard restoration, status, tray, notification, provider failure, and shutdown behavior.
- **AC-AUTO-010:** Recording lifecycle tests retain start, stop, pause, resume, cancel, retry, failure, cleanup, batch, and streaming coverage after primary view-state removal, including successful cancellation from `starting`, `recording`, `paused`, `transcribing`, and `retrying` and rejection from `idle` and `stopping`.
- **AC-AUTO-011:** Renderer structure tests prove no primary Record/Stop/Busy command is rendered in any lifecycle state while the required contextual Pause/Resume, Stop, and Cancel tiles remain available according to ACTION-004.
- **AC-AUTO-012:** Window tests prove production content is exactly 620 × 292, uses content-size semantics, remains non-resizable, and does not change supporting-window dimensions.
- **AC-AUTO-013:** Layout tests prove the established provider/header rows and 54-pixel footer total 292 pixels with no overflow, scrollbar, clipped action, or shifted status/settings control.
- **AC-AUTO-014:** Status tests cover no detail, short detail, longest supported locale text, representative bounded failure text, and maximum secondary controls while preserving the full accessible value.
- **AC-AUTO-015:** Startup tests prove loading, retry, and failure presentations fit 620 × 292 and settle into the home screen without native resize or white flash.
- **AC-AUTO-016:** Demo tests prove production components render deterministic data and visual lock transitions without Electron, microphone, clipboard, selected-text, provider, session, process, filesystem, notification, persistence, or external-network calls.
- **AC-AUTO-017:** Existing tests that assert the old primary CTA, primary view state, 93/142-pixel recording allocation, or 520 × 420 constants are replaced with equivalent new-contract assertions; unrelated coverage continues to pass.
- **AC-AUTO-018:** Focused renderer/main tests, strict TypeScript, lint, format, production build, and relevant recording, shortcut, selected-text, preload, window, startup, localization, and privacy checks pass.
- **AC-AUTO-019:** Source/style contract tests prove the provider `HotkeyActionButton` markup, public interface, fixed geometry, and approved production stylesheet are shared unchanged by production and demo rendering. Demo CSS contains no provider-key visual selector or override.
- **AC-AUTO-020:** Pure contextual-action tests cover every ACTION-004 row, cancellable and settled Prettify/Translation ownership, ownerless and contradictory activity, action ordering, effective shortcut updates, and omission rather than disabling of unavailable actions.
- **AC-AUTO-021:** Interaction tests prove every rendered contextual tile has action-plus-shortcut accessible naming, pointer/Enter/Space parity, existing guarded action dispatch, repeated/stale rejection, provider-specific Cancel routing, and deterministic focus recovery after tile removal.
- **AC-AUTO-022:** IPC and service tests prove Prettify and Translation Cancel commands reject untrusted, malformed, unknown, mismatched-owner, non-cancellable, extra-field, and post-settlement requests while preserving existing Escape cancellation and cleanup behavior.
- **AC-AUTO-023:** Timer tests with an injected clock prove zeroed session start, advance during recording, freeze during pause, resume without paused duration, status-detail priority, `HH:MM:SS` formatting, monotonic resynchronization, settlement reset, and interval cleanup after reload/shutdown.
- **AC-AUTO-024:** Layout tests render the maximum Voice action group—Pause or Resume, Stop, and Cancel—with longest supported localized labels/shortcut legends at 620 × 292 and prove the footer remains 54 pixels with no overlap, clipping, scrolling, or provider-grid movement.
- **AC-AUTO-025:** Demo tests cover the complete Voice/Prettify/Translation action matrix, timer/status priority, no-megabytes rejection, tile focus recovery, and privileged-action-free behavior while snapshot/structure evidence confirms the provider keys use the same shared visual owner as production.

### Browser And Desktop

- **AC-MAN-001:** Open the demo at exactly 620 × 292 and compare it against the selected compact-footer, aligned-hotkey, and `02-shortcut-action-tiles-no-megabytes.png` references. Confirm no overflow, clipping, unintended repositioning, provider-key visual change, or megabyte display.
- **AC-MAN-002:** Hover, focus, press, hold, release, Enter, and Space each key. Confirm convincing mechanical feedback without movement of adjacent content.
- **AC-MAN-003:** Trigger demo Provider Lock from an enabled state. Confirm the active provider remains persistently pressed, incompatible peers reject input immediately and transition into the approved Disabled design within one short cycle, and a lock with no active owner presses no provider.
- **AC-MAN-004:** Repeat AC-MAN-003 with reduced motion and confirm clear state feedback without positional movement or delayed behavior lock.
- **AC-MAN-005:** In Electron, confirm button labels follow saved Voice, normal Prettify, and Translation accelerators; their enabled, active, and Disabled visuals match the 620 × 292 demo; and enablement changes update without reopening the main window.
- **AC-MAN-006:** Confirm Voice starts while idle, remains pressed through starting, recording, paused, stopping, transcribing, and retrying, pauses while recording, and resumes while paused. Confirm normal Prettify and Translation each remain pressed only while their own selected-text operation is active, including when started by matching global shortcut.
- **AC-MAN-007:** Confirm Provider Lock for settings/provider windows, each provider switch/save, model action, selected-text work, disabled Prettify/Translation, every recording lifecycle state, unknown ownership, and combined reasons. Confirm inactive peers are Disabled, non-action locks press no provider, and recovery after success, failure, cancel, timeout, cleanup, and close releases the correct state.
- **AC-MAN-008:** Confirm the large Start/Stop CTA never appears. Verify Voice tiles show Pause/F9, Stop/F10, and Cancel/Esc while recording; Resume/F9, Stop/F10, and Cancel/Esc while paused; Cancel/Esc during starting, transcribing, and retrying; and no Voice tile while idle or stopping. Confirm clicks and configured shortcuts have parity.
- **AC-MAN-009:** Exercise disconnected, invalid, permission-denied, cancellation, timeout, and stale-state cases. Confirm no bypass, duplicate work, stuck key, lost cleanup, or false success.
- **AC-MAN-010:** Verify default, long-localized, long-status, active-recording, paused, processing, startup, and startup-retry screens at 620 × 292 on supported desktop platforms without scroll or clipping.
- **AC-MAN-011:** Start Prettify and Translation separately by both provider key and global shortcut. Confirm only the active provider key remains pressed, exactly one Cancel tile appears while cancellable, click and Escape cancel the correct operation, and the tile disappears on settlement without moving provider rows.
- **AC-MAN-012:** Confirm the timer advances only while recording, freezes while paused, resumes without counting the paused interval, yields to higher-priority status detail, resets after settlement, and is never announced on every tick.
- **AC-MAN-013:** Change the configured record, Stop, and Cancel accelerators, including a long multi-key combination and platform-specific names. Confirm every contextual tile updates without reload, stays within the footer, and dispatches by bounded action identity rather than displayed text.

## Explicit Rejection Cases

The implementation is unacceptable if any of the following occurs:

- the production or demo content area is not exactly 620 × 292;
- the 54-pixel footer expands, scrolls the window, hides lifecycle controls, or leaves the prior empty lower region;
- the provider hotkey buttons change appearance, dimensions, spacing, animation, semantics, or public interface as part of the contextual-action update;
- the demo and production provider keys diverge through a demo-only visual override or duplicate visual stylesheet;
- a multi-key shortcut is split across controls, several action buttons appear in one provider row, or action keys differ in size/alignment;
- provider status, runtime, settings, or header controls move from their established rows or relative order;
- the large Start Recording, Stop, or Busy primary control appears in any state;
- removal of that control breaks Stop, Pause, Resume, Cancel, retry, shortcut subscriptions, audio cleanup, streaming, notifications, or lifecycle publication;
- contextual actions are inserted into provider rows, rendered as provider-style three-dimensional keys, shown as disabled placeholders, or remain visible after their action becomes unavailable;
- Voice omits an available Pause, Resume, Stop, or Cancel tile, exposes one outside ACTION-004, or cannot cancel safely during `transcribing` and `retrying`;
- active cancellable Prettify or Translation work lacks its Cancel tile, routes Cancel to another provider, or adds a second cancellation owner;
- the footer displays recording megabytes or omits the selected timer without a higher-priority status detail;
- the timer counts paused time, controls lifecycle behavior, persists after settlement, announces every tick, or hides a required error/recovery message;
- a button is behaviorally active during its visual locking grace period;
- Provider Lock is derived only from connection color or the broad configuration-lock boolean and therefore blocks Voice Pause/Resume or permits incompatible work;
- Voice becomes raised or Disabled during any contiguous `starting`, `recording`, `paused`, `stopping`, `transcribing`, or `retrying` lifecycle state, or persistent press prevents its valid Pause/Resume action;
- active Prettify or Translation work leaves its own key raised/Disabled, makes a peer look persistently pressed, or cannot represent work initiated by the matching global shortcut;
- settings ownership, provider switching, model management, disabled configuration, initial unknown state, or unknown selected-text ownership falsely makes any provider look active;
- a button jumps directly from an established enabled state to Disabled without the required lock feedback, except initial locked render or reduced-motion behavior;
- a lock animation moves adjacent layout, becomes stuck, obscures focus, or delays authoritative main-process exclusion;
- a production click bypasses or duplicates the existing guarded action path;
- a contextual tile dispatches from its legend/icon rather than a bounded action identity, accepts an owner mismatch, or gives a stale renderer authority to cancel work;
- repeated locked activation focuses or starts another operation contrary to FLOW-006;
- renderer code gains privileged Electron, clipboard, selected-text, audio, filesystem, process, provider, or session capability;
- demo interaction performs or simulates provider, microphone, clipboard, selected-text, session, process, filesystem, notification, persistence, or network work;
- old tests are merely removed without equivalent coverage for retained recording behavior and the new layout/lock contract;
- the earlier UI redesign's obsolete primary-CTA requirement is left presented as the active main-window contract.
