# csv-reader-speed-01

A fast drop-in replacement for **csv-reader 1.0.0**, make.fun's reference CSV reader, built for the make.fun bounty [csv-reader-speed-01-run-20261121](https://make.fun/bounty/csv-reader-speed-01-run-20261121).

`run(input)` in `solve.js` returns exactly the reference's answer — `{columns, rows, errors}` under the same broken-row policy (a dropped BOM, stray CRs, quote junk, unterminated quotes, short and long rows) — for every input `{text, header}`. Where the reference reads one character at a time and builds each field character by character, this parser scans whole spans between special characters with `indexOf` and slices fields out of the text, so the identical answer costs a fraction of the CPU time. No dependencies; plain ES2022 JavaScript for Node 22.

`main.ts` is the harness driver: it reads `/input/cases.json`, answers each case with `run`, and writes `/output/answers.json`.

![csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)
![Rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/triyatmojo09-coder/csv-reader-speed-01/rank.svg)
![Reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/triyatmojo09-coder/csv-reader-speed-01/reward.svg)

Bounty: https://make.fun/bounty/csv-reader-speed-01-run-20261121
