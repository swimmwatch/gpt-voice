# MkDocs Interface Audit

## Scope

Audited the shared Material documentation interface at 1440px and 390px: overview, first-use navigation, CTA hover,
feature-card hover, language selection, keyboard skip link, text contrast, and local resource loading. The route sweep
covered all 19 public guide paths in all 11 locales (209 pages), rather than only the representative pages used for
visual interaction checks.

## Confirmed fixes

- Markdown places both overview CTA links in one paragraph, so the outer flex gap did not separate them. The paragraph
  now has its own wrapping `1.2rem` flex gap; the desktop and mobile CTA gap is 22px.
- Material's default card hover removes the border and uses a shadow that is too subtle on the graphite background.
  Cards now use a raised graphite surface, ring-blue border, and blue shadow on hover and keyboard focus within.

## Results

| Surface           | Result                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| Desktop overview  | CTA buttons are compact, 40.6px high, and 22px apart.                                                    |
| Feature cards     | Hover state is visibly distinct and text remains readable.                                               |
| Secondary CTA     | Hover switches to a readable blue surface with light text.                                               |
| Language selector | All 11 language routes are present; English-to-Russian navigation reached `/gpt-voice/docs/ru/`.         |
| CTA navigation    | `Get started` reached `/gpt-voice/docs/getting-started/`.                                                |
| Mobile layout     | No visual clipping of the overview CTA group, screenshot, or first-use content at 390px.                 |
| Keyboard entry    | The skip link is visible and focused on the first Tab press.                                             |
| Resources         | Current local documentation routes and assets returned HTTP 200; no new console errors were recorded.    |
| Full route sweep  | All 209 pages pass structural, asset, and page-level overflow checks in the live and production outputs. |

## Full route audit

Using CloakBrowser, the live MkDocs server was checked at 1440×1000 and 390×844 for every locale/path pair: 418
page-and-viewport checks passed. The production-style Pages build was then served from
`/gpt-voice/docs/` and checked at 390×844 using the normalized `pt-br` and `zh-cn` paths: all 209 checks passed.

Each route had to return HTTP 200, expose `main`, `article`, a non-empty `h1`, and substantive article text; load no
broken images; and avoid page-level horizontal overflow. A 6px tolerance remains for Material's closed language
selector geometry. Scrollable tables are evaluated by document overflow, so a contained table is not reported as a
viewport leak.

## Contrast checks

Computed foreground/background ratios meet the WCAG AA 4.5:1 threshold for normal-size text: body text 16.80:1,
muted headings 7.93:1, links 5.52:1, secondary CTA hover text 5.38:1, and card text on its hover surface 15.66:1.

## Evidence

- `screenshots/03-desktop-overview-cta-spacing.png`
- `screenshots/04-desktop-feature-card-hover.png`
- `screenshots/05-desktop-secondary-cta-hover.png`
- `screenshots/06-desktop-language-selector.png`
- `screenshots/07-mobile-overview-final.png`
- `screenshots/08-mobile-first-use.png`
- `screenshots/09-mobile-keyboard-skip-link.png`

## Limits

This is a rendered interface and route audit, not a claim of complete WCAG conformance. The shared UI received
interactive desktop/mobile checks, while every localized route received structural, asset, and overflow checks. The
translated copy itself was not linguistically re-reviewed in this visual pass.
