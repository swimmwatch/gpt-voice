# Controlled Translation Provider Performance Baseline

## Measurement Scope

- Baseline source revision: `3096f683`; the worktree was dirty at measurement time.
- Fixture version: `v1`.
- Host: Linux x64; Node.js `v24.18.0`.
- Providers and paths: Google, Bing, and Yandex; one cold and one warm run each.
- The fixture uses synthetic input and output lengths only: `16` and `12` characters.
- No provider page, network request, account, browser profile, cookie, screenshot,
  URL, DOM value, raw error, source text, or result text is included.

## Measurement Definition

Every page-adapter evaluation advances an injected virtual clock by `5` ms. Injected
sleeps advance the same clock by their requested duration. Context creation and new
page creation advance the clock but are not page-adapter evaluations. Queue duration
is `0` because each measured operation is dispatched after its harness is idle.

`Initial/navigation` and `readiness` are lifecycle-audit phase durations. `First
candidate`, `confirmation`, target verification, and visible clear are measured from
the deterministic operation markers. Totals contain only application-controlled fixture
time; external provider and network time are deliberately absent.

## Current Baseline

| Provider | Path |  Total | Queue | Initial/navigation | Readiness | First candidate | Confirmation | Target verification | Visible clear | Sleeps      | Evaluations | Contexts |
| -------- | ---- | -----: | ----: | -----------------: | --------: | --------------: | -----------: | ------------------: | ------------: | ----------- | ----------: | -------: |
| Google   | Cold | 585 ms |  0 ms |              20 ms |     10 ms |            5 ms |       505 ms |                5 ms |         10 ms | 500 ms      |          15 |        1 |
| Google   | Warm | 570 ms |  0 ms |               5 ms |     10 ms |            5 ms |       505 ms |                5 ms |         10 ms | 500 ms      |          14 |        0 |
| Bing     | Cold | 895 ms |  0 ms |              25 ms |    280 ms |           15 ms |       515 ms |               10 ms |         10 ms | 250, 500 ms |          27 |        1 |
| Bing     | Warm | 605 ms |  0 ms |              10 ms |      5 ms |           15 ms |       515 ms |               10 ms |         10 ms | 500 ms      |          21 |        0 |
| Yandex   | Cold | 650 ms |  0 ms |              25 ms |     10 ms |           10 ms |       510 ms |               10 ms |         10 ms | 500 ms      |          28 |        1 |
| Yandex   | Warm | 595 ms |  0 ms |              10 ms |     10 ms |           10 ms |       510 ms |               10 ms |         10 ms | 500 ms      |          19 |        0 |

## Interpretation

The fixed 500 ms stability confirmation appears on every successful path. Bing cold
also includes its existing 250 ms catalog-stability sleep. These values are immutable
pre-change evidence: a later packet may append comparable candidate results but may not
replace this table.
