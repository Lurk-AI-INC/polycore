# PolyCore (v0.1)

Open-source market toolkit by Lurk.

## Current modules

- Calculator
- Watchlist with saved local watchlists and JSON import/export
- Monitor with pulse metrics, selected-market detail, and feed log
- Rules with saved local rules, live evaluation, and triggered event log
- CLI watch, monitor, and rules commands

## Routes

- `/`
- `/calculator`
- `/watchlist`
- `/monitor`
- `/rules`

## Local development

```bash
npm install
npm run dev

## CLI

npm run cli:watch -- --file ./watchlists/default.json --once
npm run cli:monitor -- --file ./watchlists/default.json --refresh 8
npm run cli:rules -- --file ./watchlists/rules.json --refresh 10
```
