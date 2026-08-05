# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Approved Local Whisper direction

- Use the dark, narrow readiness-dashboard composition from the approved Product Design mock.
- Keep one scroll owner and no in-page Close control.
- The provider is not connected until a model is actually memory-resident.
- Show RAM/VRAM availability, safe reservable capacity, and the pre-load safety verdict before loading.
- Use one compact current-status field for each engine/model transfer; do not render full lifecycle rails.
- Keep engine/model removal in restrained overflow menus.
- Put runtime, backend, device, model, quantization, and revision in an icon-led Technical Details disclosure; do not render Selected Stack.
- Model rows expose only Model, RAM, VRAM, and row actions; omit Speed and Quality.
