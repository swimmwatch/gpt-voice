# Spec: Interactive Cursor Affordances

Status: Implemented
Date: 2026-07-11
Scope owner: Renderer UX and design system

## Objective

Make enabled interactive controls visibly actionable across the main, Settings, History, About, and provider-modal windows without changing their behavior, layout, keyboard support, or focus handling.

## Cursor Policy

- Click actions use `pointer`: buttons, switches, select triggers and items, dropdown triggers and items, tabs, and collapsible triggers.
- Drag controls use `grab` and `grabbing`: sliders and custom scrollbar thumbs.
- Text inputs and textareas retain native text-entry behavior; copyable transcription history retains `copy`.
- Disabled controls retain native disabled behavior and show `not-allowed`.

## Success Criteria

1. Every reusable enabled click control exposes a pointer cursor.
2. Drag and copy interactions use semantic cursors instead of a generic pointer.
3. Disabled controls do not become interactive.
4. No IPC, provider, recording, or data-flow behavior changes.
