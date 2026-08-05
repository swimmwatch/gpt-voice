# Local Whisper Settings prototype design QA

## Comparison target

- Source visual truth: `/home/dmitry-vasiliev/.codex/generated_images/019fce3b-5ec4-78b2-ac29-d16b9d7c058a/exec-92a7b838-3919-4ac6-a694-c28edca7ca15.png`
- Browser-rendered implementation: `http://127.0.0.1:4173/`
- Saved desktop capture: `prototype-912x1724.png`
- Saved responsive capture: `prototype-520x1200.png`
- Source pixels: 912 × 1724.
- Desktop implementation pixels: 912 × 1724.
- Desktop CSS viewport: 912 × 1724 at device pixel ratio 1.
- Responsive CSS viewport: 520 × 1200 at device pixel ratio 1.
- Density normalization: none required; source and desktop implementation are both 1× and pixel-aligned.
- Compared state: dark theme, Technical Details expanded, model unloaded from memory, engine/model transfers active, secondary disclosures collapsed.

## Full-view comparison evidence

The source and browser implementation were opened together at their original 912 × 1724 dimensions. The implementation preserves the source hierarchy and proportions: native-style title bar, compact heading, four-part readiness rail, offline provider banner, icon-led Technical Details, resource-safety bars, two compact lifecycle fields, simplified model list, secondary disclosures, and bottom actions. The final desktop page measures exactly one viewport high in the comparison state, without horizontal overflow or clipped controls.

The deliberate product corrections are retained: RAM and VRAM show available and safely reservable capacity rather than an unknown value; the model configuration uses an icon-only downloaded indicator to keep its single row compact; and the provider remains offline until the load workflow reaches memory residency.

## Focused-region evidence

A separate crop was not required because the original and implementation were inspected together at their native 912-pixel width and every dense region remained legible. Technical Details, Engine backend, the transfer fields, and the Model table were also checked in the browser accessibility snapshot to confirm the visible labels, control names, and content order.

## Required fidelity surfaces

- Fonts and typography: the system sans-serif stack closely matches the source desktop UI. Heading, body, label, metadata, and status scales preserve the source hierarchy. The implementation is slightly optically heavier at small sizes, classified as P3 because scanning and wrapping remain correct.
- Spacing and layout rhythm: 22-pixel desktop gutters, 10-pixel section rhythm, subtle 7-pixel radii, compact rows, and thin dividers match the selected direction. Desktop content fits the 1724-pixel comparison viewport exactly.
- Colors and visual tokens: charcoal surfaces, cool-gray dividers, blue actions, green readiness/safety, amber offline state, NVIDIA green, and restrained purple quantization accents match the source intent. No decorative gradients are used.
- Image quality and asset fidelity: the screen has no raster imagery. All visible marks use the React Icons library, including the official Simple Icons NVIDIA mark and a consistent Phosphor icon family. There are no emoji, placeholders, custom SVGs, or CSS-drawn icon substitutes.
- Copy and content: source copy is preserved where product-correct. Technical details include runtime, backend, device, model, quantization, and revision. Speed and Quality are absent; the model table contains only Model, RAM, VRAM, and row actions.
- Responsiveness: at 520 × 1200, technical details, resource meters, engine controls, transfer fields, and model rows stack without horizontal overflow. Measured document scroll width was 505 pixels inside the 520-pixel viewport, accounting for the vertical scrollbar.
- Accessibility: semantic buttons, disclosures, progress bars, tables, labels, focus rings, reduced-motion handling, and tooltip titles are present. The final browser console contains no warnings, errors, or accessibility issues.

## Interaction evidence

- Load model: exercised `Checking resources` → `Loading model` → `Connected`; the action changes to `Free model` only after residency completes.
- Free model: exercised; provider returned to `Not connected` immediately.
- Engine transfer: Pause and Resume states exercised.
- Engine lifecycle: overflow removal, removed state, and reinstall action exercised.
- Model lifecycle: overflow removal, not-downloaded state, and download action exercised.
- Technical Details, Transcription & advanced, and Storage disclosures exercised.
- Model selection, save-dirty state, and compact row actions are keyboard-addressable browser controls.
- Console check after a clean navigation: no messages.

## Findings

No actionable P0, P1, or P2 findings remain.

- [P3] Small browser-dependent typography weight difference
  - Location: compact labels and model metadata.
  - Evidence: the Linux system sans-serif fallback renders slightly heavier than the generated source font.
  - Impact: minor optical difference only; hierarchy and density remain intact.
  - Follow-up: bundle a matching font only if exact cross-platform font rasterization becomes a product requirement.

## Comparison history

1. Initial 912 × 1724 browser capture
   - [P2] The page measured 1813 pixels high, leaving bottom status text outside the intended viewport.
   - [P2] The selected-model configuration truncated early because its downloaded state repeated visible text.
   - Fixes: tightened section rhythm and row heights, reduced redundant vertical padding, shortened disclosure triggers, and changed the downloaded state to an icon with an accessible label and tooltip.
2. Post-fix 912 × 1724 browser capture
   - Page scroll height measured exactly 1724 pixels in the comparison state.
   - Selected model name and quantization remain readable without changing the compact two-column section.
   - Combined full-view comparison found no remaining P0/P1/P2 visual mismatch.
3. Responsive and interaction pass
   - 520-pixel reflow showed no horizontal overflow, clipping, or unusable controls.
   - Browser interaction checks passed; missing form-field names reported during the first console pass were added and the final console was clean.

## Implementation checklist

- [x] Match the selected desktop composition at 912 × 1724.
- [x] Preserve icon-led Technical Details and simplified model columns.
- [x] Keep transfer states compact and interactive.
- [x] Exercise removal, reinstall/download, memory load/free, and disclosure interactions.
- [x] Verify responsive reflow and console output.

## Follow-up polish

- P3: bundle a fixed UI font only if pixel-identical text rasterization is required across Linux and Windows.

final result: passed
