export type FeeMode = 'no-fee' | 'polymarket' | 'kalshi' | 'custom';
export type SizingMode = 'full-kelly' | 'half-kelly' | 'quarter-kelly' | 'fixed-dollar' | 'fixed-max-loss' | 'fixed-bankroll-risk';

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
function feeForPriceCents(price: number, feeMode: FeeMode, customFeeCents: number): number {
  const p = price / 100;
  if (feeMode === 'no-fee') return 0;
  if (feeMode === 'custom') return customFeeCents;
  if (feeMode === 'polymarket') return 100 * (0.04 * p * (1 - p));
  return Math.ceil(100 * (0.07 * p * (1 - p)));
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
function makeSide(label: 'Buy YES' | 'Buy NO', price: number | null, fair: number, inputs: QuoteInputs): SideResult {
  if (price === null) return { label, price: null, fairProbability: fair, feePerContract: 0, netEv: 0, grossEv: 0, roiOnRisk: 0, breakEvenProbability: 0, fullKellyFraction: 0, cappedKellyFraction: 0, riskCents: 0, profitCents: 0, suggestedDollars: 0, suggestedContractsRaw: 0, suggestedContracts: 0, maxLossDollars: 0, maxWinDollars: 0, maxWorthPaying: 0, zeroEvPrice: 0, roi5Price: 0, roi10Price: 0, roi20Price: 0, breakEvenFair: 0, scenarios: [], slippage: [] };

  const fee = feeForPriceCents(price, inputs.feeMode, inputs.customFeeCents);
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
  const scenarios = [['Fair -5%', Math.max(0, fair - 0.05)], ['Fair -2%', Math.max(0, fair - 0.02)], ['Current fair', fair], ['Fair +2%', Math.min(1, fair + 0.02)], ['Fair +5%', Math.min(1, fair + 0.05)]].map(([labelText, scenarioFair]) => ({
    label: labelText as string, fair: scenarioFair as number, netEv: 100 * (scenarioFair as number) - price - feeForPriceCents(price, inputs.feeMode, inputs.customFeeCents),
  }));
  const slippage = [0, 1, 2, 3].map((step) => {
    const slippedPrice = Math.min(100, price + step);
    const slippedFee = feeForPriceCents(slippedPrice, inputs.feeMode, inputs.customFeeCents);
    const slippedNetEv = 100 * fair - slippedPrice - slippedFee;
    return { label: step === 0 ? 'Current fill' : `+${step}¢ worse`, price: slippedPrice, netEv: slippedNetEv, roiOnRisk: (slippedPrice + slippedFee) > 0 ? slippedNetEv / (slippedPrice + slippedFee) : 0 };
  });
  return {
    label, price, fairProbability: fair, feePerContract: fee, netEv, grossEv, roiOnRisk, breakEvenProbability: risk / 100, fullKellyFraction, cappedKellyFraction,
    riskCents: risk, profitCents: profit, suggestedDollars: dollars, suggestedContractsRaw: rawContracts, suggestedContracts: contracts,
    maxLossDollars: contracts * (risk / 100), maxWinDollars: contracts * (profit / 100),
    maxWorthPaying: clamp(100 * fair - fee, 0, 100), zeroEvPrice: clamp(100 * fair - fee, 0, 100),
    roi5Price: clamp((100 * fair / 1.05) - fee, 0, 100), roi10Price: clamp((100 * fair / 1.10) - fee, 0, 100), roi20Price: clamp((100 * fair / 1.20) - fee, 0, 100),
    breakEvenFair: risk / 100, scenarios, slippage,
  };
}
export function evaluateQuotes(inputs: QuoteInputs) {
  const fairYes = clamp(inputs.fairYesProbability / 100, 0, 1);
  const fairNo = 1 - fairYes;
  const yes = makeSide('Buy YES', inputs.yesAsk, fairYes, inputs);
  const no = makeSide('Buy NO', inputs.noAsk, fairNo, inputs);
  let recommendation: 'buy-yes' | 'buy-no' | 'pass' = 'pass';
  if ((yes.price !== null || no.price !== null) && (yes.netEv > 0 || no.netEv > 0)) recommendation = yes.netEv >= no.netEv ? 'buy-yes' : 'buy-no';
  return { yes, no, recommendation, reverse: { yesMaxForEv: Math.max(0, 100 * fairYes - 2), noMaxForEv: Math.max(0, 100 * fairNo - 2), yesMaxForRoi: Math.max(0, (100 * fairYes / 1.10) - 2), noMaxForRoi: Math.max(0, (100 * fairNo / 1.10) - 2) } };
}
export function formatCents(value: number | null, precision = 2): string { if (value === null || !Number.isFinite(value)) return '--'; return `${value.toFixed(precision)}¢`; }
export function formatPercent(value: number, precision = 2): string { return `${value.toFixed(precision)}%`; }
export function formatPercentFromFraction(value: number, precision = 2): string { return `${(value * 100).toFixed(precision)}%`; }
export function formatCurrency(value: number, precision = 2): string { return `$${value.toFixed(precision)}`; }
export function formatSignedCents(value: number, precision = 2): string { const sign = value > 0 ? '+' : value < 0 ? '-' : ''; return `${sign}${Math.abs(value).toFixed(precision)}¢`; }
