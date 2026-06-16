// PolyCore calculator — mechanical pricing math for binary (0–100¢) markets.
//
// SCOPE / BOUNDARY: this module turns a fair-value probability that the USER
// supplies into the mechanical consequences of acting on it — expected value,
// edge, fees, Kelly sizing, target entry, slippage, locks, and position P&L.
// It never estimates or forecasts a probability itself. Producing the number is
// out of scope by design (that is Lurk's job, not PolyCore's). See docs/BOUNDARY.md.

export type FeeMode = 'no-fee' | 'polymarket' | 'kalshi' | 'custom';
export type FeeRole = 'taker' | 'maker';
export type SizingMode = 'full-kelly' | 'half-kelly' | 'quarter-kelly' | 'fixed-dollar' | 'fixed-max-loss' | 'fixed-bankroll-risk';

// A fee schedule is `coefficient * p * (1-p)` per contract (a parabola peaking
// at 50¢), summed across the order and rounded up to the cent — the model both
// Kalshi and fee-enabled Polymarket markets actually use. `flatCents` overrides
// the parabola with a flat per-contract fee (the legacy/custom path).
export type FeeSchedule = {
  id: string;
  label: string;
  coefficient: number; // 0 for free venues
  flatCents: number | null; // when set, a flat per-contract fee instead of the parabola
  roundOrderUpToCent: boolean; // venues bill the order total rounded up to the nearest cent
};

// Verified against 2026 venue fee schedules:
//  - Kalshi taker: 0.07 * p * (1-p), order total ceiled to the cent. Maker ~25% of taker.
//  - Polymarket: most markets (politics, econ, most sports) are 0-fee; a fee-enabled
//    subset uses 0.0625 with maker rebates. Default Polymarket here is therefore FREE.
export const FEE_SCHEDULES: Record<string, FeeSchedule> = {
  'no-fee': { id: 'no-fee', label: 'No fee', coefficient: 0, flatCents: null, roundOrderUpToCent: false },
  'kalshi': { id: 'kalshi', label: 'Kalshi taker', coefficient: 0.07, flatCents: null, roundOrderUpToCent: true },
  'kalshi-maker': { id: 'kalshi-maker', label: 'Kalshi maker', coefficient: 0.0175, flatCents: null, roundOrderUpToCent: true },
  'polymarket': { id: 'polymarket', label: 'Polymarket (free markets)', coefficient: 0, flatCents: null, roundOrderUpToCent: false },
  'polymarket-fee': { id: 'polymarket-fee', label: 'Polymarket (fee-enabled taker)', coefficient: 0.0625, flatCents: null, roundOrderUpToCent: true },
};

export function resolveFeeSchedule(feeMode: FeeMode, role: FeeRole = 'taker'): FeeSchedule {
  if (feeMode === 'no-fee') return FEE_SCHEDULES['no-fee'];
  if (feeMode === 'custom') return { id: 'custom', label: 'Custom flat fee', coefficient: 0, flatCents: 0, roundOrderUpToCent: false };
  if (feeMode === 'polymarket') return FEE_SCHEDULES['polymarket'];
  // kalshi
  return role === 'maker' ? FEE_SCHEDULES['kalshi-maker'] : FEE_SCHEDULES['kalshi'];
}

export type QuoteInputs = {
  fairYesProbability: number;
  bankroll: number;
  feeMode: FeeMode;
  customFeeCents: number;
  sizingMode: SizingMode;
  fixedDollarSize: number;
  fixedMaxLoss: number;
  fixedBankrollRiskPercent: number;
  kellyCapPercent: number;
  yesBid: number | null;
  yesAsk: number | null;
  noBid: number | null;
  noAsk: number | null;
  feeRole?: FeeRole; // optional; defaults to 'taker'
};

export type SideResult = {
  label: 'Buy YES' | 'Buy NO';
  price: number | null;
  fairProbability: number;
  feePerContract: number;
  netEv: number;
  grossEv: number;
  roiOnRisk: number;
  breakEvenProbability: number;
  fullKellyFraction: number;
  cappedKellyFraction: number;
  riskCents: number;
  profitCents: number;
  suggestedDollars: number;
  suggestedContractsRaw: number;
  suggestedContracts: number;
  maxLossDollars: number;
  maxWinDollars: number;
  orderFeeDollars: number;
  maxWorthPaying: number;
  zeroEvPrice: number;
  roi5Price: number;
  roi10Price: number;
  roi20Price: number;
  breakEvenFair: number;
  scenarios: Array<{ label: string; fair: number; netEv: number; }>;
  slippage: Array<{ label: string; price: number; netEv: number; roiOnRisk: number; }>;
};

function clamp(value: number, min: number, max: number): number { return Math.min(Math.max(value, min), max); }

// Per-contract fee in cents (UNROUNDED). The parabola each contract contributes;
// the venue rounds the *order total*, not each contract — see orderFeeCents.
export function feeForPriceCents(price: number, feeMode: FeeMode, customFeeCents: number, role: FeeRole = 'taker'): number {
  if (feeMode === 'no-fee') return 0;
  if (feeMode === 'custom') return Math.max(0, customFeeCents);
  const schedule = resolveFeeSchedule(feeMode, role);
  const p = price / 100;
  return schedule.coefficient * p * (1 - p) * 100;
}

// Total fee in cents actually billed on an order of `contracts` at `price`.
// Kalshi / fee-enabled venues ceil the aggregate to the nearest cent.
export function orderFeeCents(price: number, contracts: number, feeMode: FeeMode, customFeeCents: number, role: FeeRole = 'taker'): number {
  const n = Math.max(0, Math.floor(contracts));
  if (n === 0) return 0;
  if (feeMode === 'no-fee') return 0;
  if (feeMode === 'custom') return Math.max(0, customFeeCents) * n;
  const schedule = resolveFeeSchedule(feeMode, role);
  const p = price / 100;
  const raw = schedule.coefficient * p * (1 - p) * 100 * n;
  // Subtract a tiny epsilon so float artifacts (e.g. 175.0000000003) don't ceil up a cent.
  return schedule.roundOrderUpToCent ? Math.ceil(raw - 1e-9) : raw;
}

function kelly(fairProbability: number, price: number, fee: number): number {
  const risk = price + fee;
  const profit = 100 - price - fee;
  if (risk <= 0 || profit <= 0) return 0;
  const b = profit / risk;
  return Math.max(0, (b * fairProbability - (1 - fairProbability)) / b);
}

function suggestedDollars(bankroll: number, sizingMode: SizingMode, fullKellyFraction: number, fixedDollarSize: number, fixedMaxLoss: number, fixedBankrollRiskPercent: number, kellyCapPercent: number): number {
  const capped = Math.min(fullKellyFraction, kellyCapPercent / 100);
  if (sizingMode === 'full-kelly') return bankroll * fullKellyFraction;
  if (sizingMode === 'half-kelly') return bankroll * fullKellyFraction * 0.5;
  if (sizingMode === 'quarter-kelly') return bankroll * fullKellyFraction * 0.25;
  if (sizingMode === 'fixed-dollar') return fixedDollarSize;
  if (sizingMode === 'fixed-max-loss') return fixedMaxLoss;
  if (sizingMode === 'fixed-bankroll-risk') return bankroll * (fixedBankrollRiskPercent / 100);
  return bankroll * capped;
}

function emptySide(label: 'Buy YES' | 'Buy NO', fair: number): SideResult {
  return { label, price: null, fairProbability: fair, feePerContract: 0, netEv: 0, grossEv: 0, roiOnRisk: 0, breakEvenProbability: 0, fullKellyFraction: 0, cappedKellyFraction: 0, riskCents: 0, profitCents: 0, suggestedDollars: 0, suggestedContractsRaw: 0, suggestedContracts: 0, maxLossDollars: 0, maxWinDollars: 0, orderFeeDollars: 0, maxWorthPaying: 0, zeroEvPrice: 0, roi5Price: 0, roi10Price: 0, roi20Price: 0, breakEvenFair: 0, scenarios: [], slippage: [] };
}

function makeSide(label: 'Buy YES' | 'Buy NO', price: number | null, fair: number, inputs: QuoteInputs): SideResult {
  if (price === null) return emptySide(label, fair);
  const role = inputs.feeRole ?? 'taker';
  const fee = feeForPriceCents(price, inputs.feeMode, inputs.customFeeCents, role);
  const risk = price + fee;
  const profit = 100 - price - fee;
  const netEv = 100 * fair - price - fee;
  const grossEv = 100 * fair - price;
  const roiOnRisk = risk > 0 ? netEv / risk : 0;
  const fullKellyFraction = kelly(fair, price, fee);
  const cappedKellyFraction = Math.min(fullKellyFraction, inputs.kellyCapPercent / 100);
  const dollars = suggestedDollars(inputs.bankroll, inputs.sizingMode, fullKellyFraction, inputs.fixedDollarSize, inputs.fixedMaxLoss, inputs.fixedBankrollRiskPercent, inputs.kellyCapPercent);
  const rawContracts = risk > 0 ? dollars / (risk / 100) : 0;
  const contracts = Math.max(0, Math.floor(rawContracts));
  const orderFee = orderFeeCents(price, contracts, inputs.feeMode, inputs.customFeeCents, role);
  const scenarios = [['Fair -5%', Math.max(0, fair - 0.05)], ['Fair -2%', Math.max(0, fair - 0.02)], ['Current fair', fair], ['Fair +2%', Math.min(1, fair + 0.02)], ['Fair +5%', Math.min(1, fair + 0.05)]].map(([labelText, scenarioFair]) => ({
    label: labelText as string, fair: scenarioFair as number, netEv: 100 * (scenarioFair as number) - price - feeForPriceCents(price, inputs.feeMode, inputs.customFeeCents, role),
  }));
  const slippage = [0, 1, 2, 3].map((step) => {
    const slippedPrice = Math.min(100, price + step);
    const slippedFee = feeForPriceCents(slippedPrice, inputs.feeMode, inputs.customFeeCents, role);
    const slippedNetEv = 100 * fair - slippedPrice - slippedFee;
    return { label: step === 0 ? 'Current fill' : `+${step}¢ worse`, price: slippedPrice, netEv: slippedNetEv, roiOnRisk: (slippedPrice + slippedFee) > 0 ? slippedNetEv / (slippedPrice + slippedFee) : 0 };
  });
  return {
    label, price, fairProbability: fair, feePerContract: fee, netEv, grossEv, roiOnRisk, breakEvenProbability: risk / 100, fullKellyFraction, cappedKellyFraction,
    riskCents: risk, profitCents: profit, suggestedDollars: dollars, suggestedContractsRaw: rawContracts, suggestedContracts: contracts,
    maxLossDollars: (contracts * price + orderFee) / 100, maxWinDollars: (contracts * (100 - price) - orderFee) / 100, orderFeeDollars: orderFee / 100,
    maxWorthPaying: clamp(100 * fair - fee, 0, 100), zeroEvPrice: clamp(100 * fair - fee, 0, 100),
    roi5Price: clamp((100 * fair / 1.05) - fee, 0, 100), roi10Price: clamp((100 * fair / 1.10) - fee, 0, 100), roi20Price: clamp((100 * fair / 1.20) - fee, 0, 100),
    breakEvenFair: risk / 100, scenarios, slippage,
  };
}

// ── Lock / arbitrage detection ────────────────────────────────────────────
// Pure order-book arithmetic, no view required: if you can buy YES and NO for a
// combined cost (plus fees) below the 100¢ both-sides payout, the pair is a
// guaranteed-profit lock. `overroundCents` is the venue's vig (positive = the
// book takes a cut; negative = a lock exists).
export type LockResult = {
  exists: boolean;
  yesAsk: number | null;
  noAsk: number | null;
  combinedCostCents: number | null; // price-only, before fees
  feesCents: number; // per-1-contract-each-side fee total
  overroundCents: number | null; // yesAsk + noAsk - 100 (price-only)
  guaranteedProfitCentsPerPair: number | null; // 100 - combined - fees
  roiOnRisk: number | null;
};

export function detectLock(yesAsk: number | null, noAsk: number | null, feeMode: FeeMode = 'no-fee', customFeeCents = 0, role: FeeRole = 'taker'): LockResult {
  if (yesAsk === null || noAsk === null) {
    return { exists: false, yesAsk, noAsk, combinedCostCents: null, feesCents: 0, overroundCents: null, guaranteedProfitCentsPerPair: null, roiOnRisk: null };
  }
  const combined = yesAsk + noAsk;
  const fees = feeForPriceCents(yesAsk, feeMode, customFeeCents, role) + feeForPriceCents(noAsk, feeMode, customFeeCents, role);
  const profit = 100 - combined - fees;
  const risk = combined + fees;
  return {
    exists: profit > 0,
    yesAsk, noAsk,
    combinedCostCents: combined,
    feesCents: fees,
    overroundCents: combined - 100,
    guaranteedProfitCentsPerPair: profit,
    roiOnRisk: risk > 0 ? profit / risk : null,
  };
}

// ── Position / exit math ──────────────────────────────────────────────────
// Mechanical mark-to-market and settlement outcomes for an already-open
// position. No probability is assumed; outcomes are reported, not weighted.
export type PositionInputs = {
  side: 'yes' | 'no';
  entryPriceCents: number; // fill price paid, per contract
  contracts: number;
  currentBidCents: number | null; // best bid you could exit into now
  feeMode: FeeMode;
  customFeeCents: number;
  feeRole?: FeeRole;
};

export type PositionResult = {
  side: 'yes' | 'no';
  contracts: number;
  costBasisDollars: number; // contracts*entry + entry fee
  entryFeeDollars: number;
  markValueDollars: number | null; // value if exited at currentBid now, net of exit fee
  exitFeeDollars: number | null;
  unrealizedDollars: number | null; // mark - cost basis
  unrealizedPercent: number | null;
  settleWinDollars: number; // P&L if contract resolves in your favor (settles 100¢)
  settleLoseDollars: number; // P&L if it resolves against you (settles 0¢)
  breakevenExitCents: number; // bid you must exit into to net zero
};

export function evaluatePosition(input: PositionInputs): PositionResult {
  const role = input.feeRole ?? 'taker';
  const contracts = Math.max(0, Math.floor(input.contracts));
  const entryFee = orderFeeCents(input.entryPriceCents, contracts, input.feeMode, input.customFeeCents, role);
  const costBasisCents = contracts * input.entryPriceCents + entryFee;

  let markValueDollars: number | null = null;
  let exitFeeDollars: number | null = null;
  let unrealizedDollars: number | null = null;
  let unrealizedPercent: number | null = null;
  if (input.currentBidCents !== null) {
    const exitFee = orderFeeCents(input.currentBidCents, contracts, input.feeMode, input.customFeeCents, role);
    const proceeds = contracts * input.currentBidCents - exitFee;
    markValueDollars = proceeds / 100;
    exitFeeDollars = exitFee / 100;
    unrealizedDollars = (proceeds - costBasisCents) / 100;
    unrealizedPercent = costBasisCents > 0 ? (proceeds - costBasisCents) / costBasisCents : null;
  }

  // Settlement: a winning contract pays 100¢, no exit fee at settlement.
  const settleWinDollars = (contracts * 100 - costBasisCents) / 100;
  const settleLoseDollars = (0 - costBasisCents) / 100;
  // Exit bid that nets zero: proceeds (net of exit fee) == cost basis. Exit fees
  // are small and price-dependent; approximate breakeven with the price-only term.
  const breakevenExitCents = contracts > 0 ? costBasisCents / contracts : 0;

  return {
    side: input.side,
    contracts,
    costBasisDollars: costBasisCents / 100,
    entryFeeDollars: entryFee / 100,
    markValueDollars,
    exitFeeDollars,
    unrealizedDollars,
    unrealizedPercent,
    settleWinDollars,
    settleLoseDollars,
    breakevenExitCents,
  };
}

export function evaluateQuotes(inputs: QuoteInputs) {
  const fairYes = clamp(inputs.fairYesProbability / 100, 0, 1);
  const fairNo = 1 - fairYes;
  const role = inputs.feeRole ?? 'taker';
  const yes = makeSide('Buy YES', inputs.yesAsk, fairYes, inputs);
  const no = makeSide('Buy NO', inputs.noAsk, fairNo, inputs);
  let recommendation: 'buy-yes' | 'buy-no' | 'pass' = 'pass';
  if ((yes.price !== null || no.price !== null) && (yes.netEv > 0 || no.netEv > 0)) recommendation = yes.netEv >= no.netEv ? 'buy-yes' : 'buy-no';
  // Fee-aware reverse pricing: the most you can pay and still clear 0 / 10% ROI.
  const yesFeeAt = (px: number) => feeForPriceCents(px, inputs.feeMode, inputs.customFeeCents, role);
  const yesZero = clamp(100 * fairYes - yesFeeAt(inputs.yesAsk ?? 100 * fairYes), 0, 100);
  const noZero = clamp(100 * fairNo - yesFeeAt(inputs.noAsk ?? 100 * fairNo), 0, 100);
  const lock = detectLock(inputs.yesAsk, inputs.noAsk, inputs.feeMode, inputs.customFeeCents, role);
  return {
    yes, no, recommendation, lock,
    reverse: {
      yesMaxForEv: yesZero,
      noMaxForEv: noZero,
      yesMaxForRoi: clamp((100 * fairYes / 1.10) - yesFeeAt(inputs.yesAsk ?? 100 * fairYes), 0, 100),
      noMaxForRoi: clamp((100 * fairNo / 1.10) - yesFeeAt(inputs.noAsk ?? 100 * fairNo), 0, 100),
    },
  };
}

export function formatCents(value: number | null, precision = 2): string { if (value === null || !Number.isFinite(value)) return '--'; return `${value.toFixed(precision)}¢`; }
export function formatPercent(value: number, precision = 2): string { return `${value.toFixed(precision)}%`; }
export function formatPercentFromFraction(value: number, precision = 2): string { return `${(value * 100).toFixed(precision)}%`; }
export function formatCurrency(value: number, precision = 2): string { return `$${value.toFixed(precision)}`; }
export function formatSignedCents(value: number, precision = 2): string { const sign = value > 0 ? '+' : value < 0 ? '-' : ''; return `${sign}${Math.abs(value).toFixed(precision)}¢`; }
