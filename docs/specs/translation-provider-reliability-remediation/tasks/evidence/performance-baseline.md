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

## Packet 04 Candidate Comparison

The Packet 04 deterministic fixture uses one coherent result observation per polling
cycle. It preserves the same 500 ms two-identical-read fallback for Google, Bing, and
Yandex because no provider-specific completion signal was enabled without the separate
live public-page inspection gate. The fixture proves that each candidate cell is strictly
faster than its immutable baseline, has no phase regression, and does not add browser
evaluations.

| Provider | Path | Candidate total | Baseline total | Candidate evaluations | Baseline evaluations | Result fallback | Target verification |
| -------- | ---- | --------------: | -------------: | --------------------: | -------------------: | --------------- | ------------------: |
| Google   | Cold |          580 ms |         585 ms |                    14 |                   15 | 500 ms          | 0 ms                |
| Google   | Warm |          565 ms |         570 ms |                    13 |                   14 | 500 ms          | 0 ms                |
| Bing     | Cold |          865 ms |         895 ms |                    21 |                   27 | 500 ms          | 0 ms                |
| Bing     | Warm |          575 ms |         605 ms |                    15 |                   21 | 500 ms          | 0 ms                |
| Yandex   | Cold |          630 ms |         650 ms |                    24 |                   28 | 500 ms          | 0 ms                |
| Yandex   | Warm |          575 ms |         595 ms |                    15 |                   19 | 500 ms          | 0 ms                |

The comparison is derived solely from injected clocks, fake adapter evaluations, and
sanitized audit counters. It contains no provider-page, network, account, URL, DOM, or
translation text data.
