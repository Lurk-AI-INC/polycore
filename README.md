# PolyCore (v0.4)

PolyCore is the open-source, local-first utility layer for binary market workflows.

It is built to be useful on its own without stepping on Lurk's core product surface.

## What PolyCore is

- binary market calculator
- local watchlists
- local rules and threshold alerts
- terminal / CLI utilities
- venue adapters and raw market utilities
- import / export friendly workflows

## What PolyCore is not

PolyCore does **not** do any of the following:

- cross-platform market matching
- ranked opportunity feeds
- hosted signal generation
- discovery or prioritization of "what matters most"
- execution automation
- collaborative intelligence layers

That boundary is intentional.

PolyCore helps you **operate on markets you already care about**.
Lurk is where discovery, prioritization, and proprietary intelligence belong.

## Included modules

- **Calculator** — price, EV, edge, target entry, reverse pricing, and sizing
- **Watchlist** — local saved lists, filters, JSON import/export, calculator handoff
- **Monitor** — live board view for tracked markets
- **Rules** — local rule evaluation for price, spread, status, close-time, and EV conditions
- **CLI** — watch, monitor, and rules commands for terminal workflows

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
npm run cli -- monitor --file ./watchlists/default.json --refresh 8
npm run cli -- rules --file ./watchlists/rules.json --refresh 10
```

Or, after installing dependencies, run directly:

```bash
node ./cli/polycore.mjs watch --file ./watchlists/default.json --once
node ./cli/polycore.mjs monitor --tickers DEMO-GDP-2026,DEMO-CPI-2026 --refresh 8
node ./cli/polycore.mjs rules --file ./watchlists/rules.json --json --once
```

### CLI flags

- `--tickers` comma-separated ticker list
- `--file` path to a watchlist or rules file
- `--refresh` refresh interval in seconds
- `--once` run one cycle and exit
- `--json` emit machine-readable JSON instead of terminal tables
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

## Repo layout

```text
app/         Next.js UI surfaces
cli/         terminal entrypoint
lib/         shared math and market utilities
watchlists/  sample local data
examples/    extra sample files
docs/        product boundary docs
```

## Sample files

- `watchlists/default.json`
- `watchlists/rules.json`
- `examples/watchlists/starter.json`
- `examples/rules/starter.rules.json`

## Product boundary

Read `docs/BOUNDARY.md` for the sharp line between PolyCore and Lurk.

## License

MIT
