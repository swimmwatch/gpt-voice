# Compact Provider Hotkey Demo — Design QA

## Comparison target

- Source visual truth: `/home/dmitry-vasiliev/PycharmProjects/open-source/chatgpt-web-voice/provider-hotkey-disabled-state.png` (the accepted 620 x 420 layout before the height-only change).
- Browser-rendered implementation: `/home/dmitry-vasiliev/PycharmProjects/open-source/chatgpt-web-voice/provider-hotkey-demo-compact-height.png`.
- Combined comparison: `/home/dmitry-vasiliev/PycharmProjects/open-source/chatgpt-web-voice/provider-hotkey-compact-height-comparison.png`.
- Browser route: `http://127.0.0.1:4173/provider-hotkey-demo.html`.
- State: default demo state; Voice and Translation enabled, Prettify disabled for Provider Lock.

## Viewport and normalization

- Source: 620 x 420 pixels and CSS pixels at device scale factor 1.
- Implementation: 620 x 292 pixels and CSS pixels at device scale factor 1.
- The combined comparison keeps both captures at 1:1 density and pads only the removed 128-pixel source-height region for direct side-by-side review.
- Browser measurement confirms viewport, main container, and document scroll size are all exactly 620 x 292 with no overflow.

## Full-view comparison evidence

The provider grid, three provider rows, dividers, hotkey column, status controls, and settings controls retain their established relationships. The status footer starts at y=238 in both states; only its height changes, from the formerly open-ended region to a compact 54 pixels. The resulting frame ends at y=292 immediately after the status content.

## Focused comparison evidence

A separate focused crop was unnecessary because the requested change affects one full-width region and all relevant edges and alignments are readable at 620 pixels. The browser accessibility snapshot supplies exact row and control bounds, including identical 114 x 32 hotkey buttons and the 54-pixel footer.

## Required fidelity surfaces

- Fonts and typography: labels, provider values, key legends, and status copy preserve their sizes, weights, line heights, wrapping, and tracking.
- Spacing and layout rhythm: the 620-pixel width and provider grid remain fixed; only the main frame and footer height are reduced to 292 and 54 pixels respectively.
- Colors and visual tokens: the existing graphite palette, borders, semantic green status treatment, and disabled-key treatment are unchanged.
- Image quality and assets: no image or icon assets were added, replaced, scaled, or rasterized.
- Copy and content: all provider names, hotkey combinations, labels, and status copy remain unchanged.

## Interaction and accessibility evidence

- Voice hotkey pointer activation, Enter, and Space complete without local demo errors.
- The Prettify hotkey remains natively disabled and inert.
- Enabled hotkeys remain keyboard-focusable semantic buttons.
- Current-page browser console check: zero errors and zero warnings.

## Comparison history

The compact-height pass produced no actionable P0, P1, or P2 mismatch. No visual correction loop was required after the height-only change.

## Findings

No actionable P0, P1, or P2 findings remain. The large empty status area is removed without changing the provider grid or adjacent controls.

## Implementation checklist

- [x] Main container is exactly 620 x 292.
- [x] Status footer is exactly 54 pixels high and begins at y=238.
- [x] No horizontal or vertical overflow.
- [x] Provider rows and 114 x 32 hotkey buttons remain aligned.
- [x] Enabled and disabled hotkey behavior remains intact.
- [x] Demo-only CSS remains isolated from the global stylesheet.

## Follow-up polish

No P3 polish is required for this height-only pass.

final result: passed
