# PolyCore (v0.7)

PolyCore is the open-source, local-first utility layer for binary market workflows,
published by Lurk. It does mechanical arithmetic on numbers you already have — it
never forecasts or decides what those numbers should be. That boundary is
deliberate; see [docs/BOUNDARY.md](./docs/BOUNDARY.md).

## What PolyCore is

- binary market calculator (EV, edge, sizing, fees)
- venue-correct fee math (Kalshi taker/maker, Polymarket free + fee-enabled)
- lock / arbitrage detection (pure orderbook arithmetic)
- mechanical position P&L (cost basis, mark-to-market, settlement)
- local watchlists
- local rules and threshold alerts
- terminal / CLI utilities (Node and Python)
- descriptive, backward-looking timeline analytics
- venue adapters and raw market utilities
- import / export friendly workflows

## Included modules

- **Calculator** — price, EV, edge, target entry, reverse pricing, sizing, venue-correct fees, lock detection, and mechanical position P&L
- **Watchlist** — local saved lists, duplicate/delete flows, robust JSON import/export, selected-market detail, calculator handoff
- **Monitor** — live board view for tracked markets with sorting, pause/resume, event logs, and a per-market lock footer
- **Rules** — local rule evaluation for price, spread, status, close-time, and fee-aware EV conditions plus import/export
- **CLI (Node)** — watch, monitor, and rules commands for terminal workflows, with watchlist-sourced rules and CI-friendly exit codes
- **Python companion** — snapshot, timeline, scan, diff, and `analyze` (descriptive history); stdlib-only, no third-party dependencies

## Quick start

```bash
npm install
npm run dev
```

Open:

- `/`
- `/calculator`
- `/watchlist`
- `/monitor`
- `/rules`

## CLI

Run through npm:

```bash
npm run cli -- watch --file ./watchlists/default.json --once
npm run cli -- monitor --file ./watchlists/default.json --refresh 8 --sort spread
npm run cli -- rules --file ./watchlists/rules.json --refresh 10
```

Or, after installing dependencies, run directly:

```bash
node ./cli/polycore.mjs watch --file ./watchlists/default.json --once
node ./cli/polycore.mjs monitor --tickers DEMO-GDP-2026,DEMO-CPI-2026 --refresh 8 --sort spread
node ./cli/polycore.mjs rules --file ./watchlists/rules.json --json --once
node ./cli/polycore.mjs watch --file ./watchlists/default.json --demo --once
```

### CLI flags

- `--tickers` comma-separated ticker list
- `--file` path to a watchlist or rules file
- `--refresh` refresh interval in seconds
- `--once` run one cycle and exit
- `--json` emit machine-readable JSON instead of terminal tables
- `--demo` force sample fixture mode
- `--sort` close, spread, last, volume, or ticker
- `--status` all, open, paused, closed, settled, or unknown
- `--watchlist` source rule tickers from a watchlist file (rules command)
- `--role` taker or maker, for fee-aware calculations (default taker)
- `--fail-on-trigger` exit with code 2 when a rule triggers (CI / cron use)
- `--version` / `-v` print the CLI version
- `--help` show command help

### Accepted watchlist file formats

Array form:

```json
["TICKER_A", "TICKER_B"]
```

Object form:

```json
{
  "tickers": ["TICKER_A", "TICKER_B"]
}
```

### Accepted rules file formats

Array form:

```json
[
  {
    "id": "yes-ev-demo",
    "name": "YES becomes +EV",
    "ticker": "TICKER_A",
    "type": "yes-positive-ev",
    "fairYes": "54",
    "isEnabled": true
  }
]
```

Object form:

```json
{
  "rules": [
    {
      "id": "spread-tight-demo",
      "name": "Spread tightens",
      "ticker": "TICKER_A",
      "type": "spread-lte",
      "threshold": "2",
      "isEnabled": true
    }
  ]
}
```

## Python companion

A dependency-free (stdlib-only) companion lives in `python/`. It mirrors the
TypeScript fee and EV math exactly, and adds local snapshot/timeline/diff tools
plus a descriptive `analyze` command.

```bash
# append one jsonl line per ticker to data/timelines/
python3 python/run_polycore.py timeline --tickers DEMO-GDP-2026,DEMO-CPI-2026 --demo

# evaluate rules (exit code 2 on trigger is available via the Node CLI)
python3 python/run_polycore.py scan --file ./watchlists/rules.json --demo

# compare two snapshots
python3 python/run_polycore.py diff --left a.json --right b.json

# descriptive, backward-looking stats over the timelines (never a forecast)
python3 python/run_polycore.py analyze --dir data/timelines
```

`analyze` reports, per ticker: sample count, observation window, price range,
realized move, time-weighted average price (TWAP), mean/max spread, and volume
trend. Every figure describes observed history. PolyCore does not predict where a
price is going — that is Lurk's lane. See [docs/BOUNDARY.md](./docs/BOUNDARY.md)
and [docs/CALCULATIONS.md](./docs/CALCULATIONS.md).

## Tests

The TypeScript, Node CLI, and Python surfaces share a single golden-vector oracle
(`tests/golden/calculator-vectors.json`) so their math can never silently drift.

```bash
npm test          # runs both suites
npm run test:ts   # TypeScript (node:test via tsx)
npm run test:py   # Python (stdlib unittest)
```

## Repo layout

```text
app/         Next.js UI surfaces
cli/         Node terminal entrypoint
lib/         shared math and market utilities
python/      stdlib-only Python companion package
tests/       TypeScript + Python suites and the shared golden oracle
watchlists/  sample local data
examples/    extra sample files
docs/        product boundary and calculation references
```

## Sample files

- `watchlists/default.json`
- `watchlists/rules.json`
- `examples/watchlists/starter.json`
- `examples/rules/starter.rules.json`

## License

MIT
