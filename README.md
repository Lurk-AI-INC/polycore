# PolyCalc

Open-source binary market calculator by Lurk.

## What is in this version

This build is no longer just a yes/no EV toy.

It now includes:
- target entry price calculator
- multi-scenario fair value ladder
- contract count output
- preset sizing modes
- venue fee modes
- bid / ask / midpoint mode
- reverse calculator
- slippage panel
- YES vs NO vs pass recommendation
- shareable URL state
- break-even fair probability by side

## Inputs

### Core
- fair YES probability
- bankroll
- precision
- pricing mode
- fee mode
- sizing mode

### Pricing mode
#### Single price
- YES buy price
- NO buy price

#### Bid / ask mode
- YES bid
- YES ask
- NO bid
- NO ask

### Fee modes
- no fee
- Polymarket-style
- Kalshi-style
- custom

### Sizing modes
- full Kelly
- half Kelly
- quarter Kelly
- fixed dollar size
- fixed max loss
- fixed % bankroll risk

## Panels

### For each side
- core metrics
- target entry prices
- fair value ladder
- slippage table
- position sizing output
- quote metrics in bid/ask mode

### Global
- reverse calculator
- recommendation strip
- shareable state via URL params

## Local dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run start
```

## Notes

- Polymarket-style fee mode uses a default 4% fee curve estimate.
- Kalshi-style fee mode uses the published taker fee curve rounded up to the next cent for one contract.
- URL state is shareable, so every setup can be copied directly from the address bar.

