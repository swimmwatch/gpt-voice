# Command Dock Text Source QA

Date: 2026-07-11  
Scope: text-based design-source conversion only  
Reference: `/home/dmitry-vasiliev/Downloads/Generated image 1.png`

## Artifacts

- `docs/specs/ui-redesign/assets/command-dock-reference.svg`
- `docs/specs/ui-redesign/assets/command-dock-blueprint.svg`
- `docs/specs/ui-redesign/assets/command-dock-layout.json`

## Validation

- The reference and SVG render are both 1312x1199 pixels.
- The target mapping is 460x420 CSS pixels using separate X and Y scales recorded in the manifest.
- Section separators, primary action bounds, header actions, GPU action, and language selector align with measured reference coordinates.
- Typography uses the project's Linux system-font path (`Ubuntu Sans` / `Ubuntu`) with the cross-platform fallback stack recorded in the manifest.
- UI icons use vectors sourced from the installed `lucide-react` package. The flag is vector geometry rather than a platform-dependent emoji.
- FFmpeg decoded and rendered both SVG artifacts successfully.
- Node.js parsed the JSON manifest successfully.
- Reference-to-SVG structural similarity at the same viewport is `SSIM 0.910859`.

## Deliberate Differences

- The generated raster contains minor synthesis noise and soft anti-aliasing. The SVG intentionally keeps surfaces and edges crisp so implementation agents receive stable values instead of reproducing image noise.
- The generated gauge symbol is not tied to a known icon asset. The SVG uses the project's existing Lucide `Gauge` icon so Figma, SVG, and application code share a reproducible vector source.

## Result

final result: passed

The text-based design source is suitable as the blocking input for Task 24. This result does not approve the current Electron main-window implementation.
