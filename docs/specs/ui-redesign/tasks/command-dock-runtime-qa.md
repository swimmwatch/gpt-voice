# Command Dock Runtime QA

Date: 2026-07-11  
Task: 24 - Reimplement The Main Window Against The Visual Contract

## Evidence

- Supplied reference: `/home/dmitry-vasiliev/Downloads/Generated image 1.png`
- Text-based reference: `docs/specs/ui-redesign/assets/command-dock-reference.svg`
- Runtime capture: `.artifacts/command-dock-runtime-final.png`
- Same-state side-by-side comparison: `.artifacts/command-dock-reference-comparison-final.png`
- Minimum-size capture: `.artifacts/command-dock-minimum.png`

The Electron app ran with an isolated `HOME` and `XDG_CONFIG_HOME`. The comparison state used ChatGPT Web connected, `gemma4:e2b-it-qat` loaded, 1.4 GB VRAM, idle recording, and English as the target language. The connected state was emitted only into the isolated renderer for visual verification; no user session data was read or changed.

## Geometry

At the required 460x420 renderer content size:

| Region             | Runtime bounds              |
| ------------------ | --------------------------- |
| Main toolbar       | `x=1, y=1, w=458, h=117`    |
| Model memory       | `x=1, y=118, w=458, h=60`   |
| Recording controls | `x=1, y=178, w=458, h=142`  |
| Target language    | `x=1, y=320, w=458, h=99`   |
| Record icon        | `x=133, y=212, w=23, h=25`  |
| Model action       | `x=355, y=134, w=92, h=27`  |
| Language selector  | `x=144, y=334, w=134, h=29` |

The renderer reported `innerWidth=460`, `innerHeight=420`, `scrollWidth=460`, and `scrollHeight=420`. The final side-by-side review found no remaining P0, P1, or P2 visual discrepancy. Residual differences are limited to normal rasterization and the supplied image's generated blur compared with live text and Lucide vectors.

## Responsive And Interaction Checks

- At 400x360, the model row uses its two-line responsive layout and the main surface reports no horizontal overflow.
- History and App Settings open their existing separate Electron windows.
- Clicking the connected provider status opens provider configuration.
- The target-language selector opens and contains English, Russian, Ukrainian, and Belarusian choices with local vector assets.
- The GPU action remained unclicked during QA so the check could not unload the user's running Ollama model.
- Focusable actions retain native button/select semantics, visible focus rings, accessible labels, and tooltips where required.

## Automated Verification

- `npm run format:check`: passed
- `npm run lint`: passed with the existing warning baseline and no errors
- `npm run typecheck`: passed
- `npm run test:types`: passed
- `npm test`: passed, 225 tests across 45 suites
- `npm run validate:dependabot`: passed
- `npm run audit:prod`: passed, 0 vulnerabilities
- `npm run build:prod`: passed with the existing Webpack bundle-size advisory

## Result

final result: passed

Implementation and automated visual acceptance are complete. Human approval of the corrected runtime screenshot remains the final specification gate.
