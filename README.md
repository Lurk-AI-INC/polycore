# PolyCore

Open-source binary market toolkit by Lurk.

## V2 in this repo

- Calculator
- Watchlist with saved local watchlists and JSON import/export
- Monitor with pulse metrics, selected-market detail, and feed log
- CLI watch and monitor commands

## Routes

- `/`
- `/calculator`
- `/watchlist`
- `/monitor`

## Local development

```bash
npm install
npm run dev
```

## CLI

```bash
npm run cli:watch -- --file ./watchlists/default.json --once
npm run cli:monitor -- --file ./watchlists/default.json --refresh 8
```
