# About Window

## Objective

Provide a compact, localized About window for GPT-Voice from the main toolbar and tray menu. It presents only application metadata and does not expose external links, secrets, or runtime internals.

## Requirements

- Open one reusable, non-modal About window from the question-mark toolbar action and tray menu.
- Display the bundled logo, GPT-Voice name, runtime version, PolyForm-Noncommercial-1.0.0 license, and copyright.
- Use the existing sandboxed renderer, trusted IPC sender validation, `app://` navigation guard, and dark design system.
- Support native close controls, Escape, and a keyboard-accessible Close button.
- Leave the existing native OS About panel unchanged.

## Success Criteria

- Both requested entry points focus the same About window.
- App metadata matches the running application and renders in every supported locale.
- No Node or Electron internals are available to the About renderer.
- Type checks, unit tests, linting, production build, audit, and package validation pass.
