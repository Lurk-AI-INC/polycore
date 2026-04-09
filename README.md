# Binary Market Calculator

Single-page Next.js + TypeScript utility for binary market traders.

## What it does

Enter:
- YES buy price
- NO buy price
- fair YES probability
- bankroll
- estimated fee per contract
- Kelly cap

It returns:
- break-even probability
- gross and net edge
- gross and net EV per contract
- ROI on risk
- full Kelly and capped Kelly
- suggested size
- best side highlight

## Stack

- Next.js App Router
- TypeScript
- Zero backend
- No auth
- No persistence

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

## Deploy

Push to GitHub and import into Vercel as a standard Next.js project.

## Notes

- Uses generic binary contract math.
- Uses user-supplied fee assumptions.
- Does not force YES and NO prices to sum to 100.

## Repo structure

```text
app/
  globals.css
  layout.tsx
  page.tsx
lib/
  calculator.ts
```
