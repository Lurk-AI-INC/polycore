export type MarketStatus = 'open' | 'paused' | 'closed' | 'settled' | 'unknown';
export type Market = {
  ticker: string;
  title: string;
  status: MarketStatus;
  yesBidCents: number | null;
  yesAskCents: number | null;
  noBidCents: number | null;
  noAskCents: number | null;
  lastPriceCents: number | null;
  midpointCents: number | null;
  yesSpreadCents: number | null;
  closeTime: string | null;
  closeTimeLabel: string;
  timeToCloseLabel: string;
  volume24h: number | null;
  updatedAt: string;
};

function makeSample(ticker: string, title: string, status: MarketStatus, yb: number, ya: number, nb: number, na: number, last: number, hours: number, vol: number): Market {
  const closeTime = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  return {
    ticker, title, status,
    yesBidCents: yb, yesAskCents: ya, noBidCents: nb, noAskCents: na,
    lastPriceCents: last, midpointCents: (yb + ya) / 2, yesSpreadCents: ya - yb,
    closeTime, closeTimeLabel: formatCloseTime(closeTime), timeToCloseLabel: formatTimeToClose(closeTime),
    volume24h: vol, updatedAt: new Date().toISOString(),
  };
}

export const SAMPLE_MARKETS: Market[] = [
  makeSample('DEMO-GDP-2026', 'Will US GDP beat consensus this quarter?', 'open', 47, 49, 51, 53, 48, 36, 18200),
  makeSample('DEMO-CPI-2026', 'Will CPI print above 0.3% this month?', 'open', 58, 61, 39, 42, 60, 8, 9200),
  makeSample('DEMO-RATE-2026', 'Will the Fed cut at the next meeting?', 'paused', 24, 27, 73, 76, 25, 288, 5400),
];

export function parseDollarStringToCents(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}
export function normalizeStatus(value: string | null | undefined): MarketStatus {
  if (value === 'open' || value === 'paused' || value === 'closed' || value === 'settled') return value;
  return 'unknown';
}
export function formatCloseTime(value: string | null): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function formatTimeToClose(value: string | null): string {
  if (!value) return '--';
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
export function normalizeMarket(raw: any): Market {
  const yesBidCents = parseDollarStringToCents(raw.yes_bid_dollars);
  const yesAskCents = parseDollarStringToCents(raw.yes_ask_dollars);
  const noBidCents = parseDollarStringToCents(raw.no_bid_dollars);
  const noAskCents = parseDollarStringToCents(raw.no_ask_dollars);
  const lastPriceCents = parseDollarStringToCents(raw.last_price_dollars);
  const midpointCents = yesBidCents !== null && yesAskCents !== null ? (yesBidCents + yesAskCents) / 2 : null;
  const yesSpreadCents = yesBidCents !== null && yesAskCents !== null ? yesAskCents - yesBidCents : null;
  const closeTime = raw.close_time ?? null;
  return {
    ticker: raw.ticker ?? 'UNKNOWN', title: raw.title ?? raw.ticker ?? 'Unknown market', status: normalizeStatus(raw.status),
    yesBidCents, yesAskCents, noBidCents, noAskCents, lastPriceCents, midpointCents, yesSpreadCents,
    closeTime, closeTimeLabel: formatCloseTime(closeTime), timeToCloseLabel: formatTimeToClose(closeTime),
    volume24h: raw.volume_24h_fp ? Number(raw.volume_24h_fp) : null, updatedAt: new Date().toISOString(),
  };
}
export function formatCents(value: number | null, precision = 0): string {
  if (value === null || !Number.isFinite(value)) return '--';
  return `${value.toFixed(precision)}¢`;
}
export function formatCompactNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '--';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
export function statusTone(status: MarketStatus): string {
  if (status === 'open') return 'positive';
  if (status === 'paused') return 'warn';
  return 'muted';
}
