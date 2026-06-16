#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const VERSION = '0.7.0';
const API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';
const REQUEST_TIMEOUT_MS = 8000;

const SAMPLE_MARKETS = [
  makeSample('DEMO-GDP-2026', 'Will US GDP beat consensus this quarter?', 'open', 47, 49, 51, 53, 48, 36, 18200),
  makeSample('DEMO-CPI-2026', 'Will CPI print above 0.3% this month?', 'open', 58, 61, 39, 42, 60, 8, 9200),
  makeSample('DEMO-RATE-2026', 'Will the Fed cut at the next meeting?', 'paused', 24, 27, 73, 76, 25, 288, 5400),
];

function makeSample(ticker, title, status, yesBid, yesAsk, noBid, noAsk, last, hours, volume24h) {
  const closeTime = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  return {
    ticker,
    title,
    status,
    yesBid,
    yesAsk,
    noBid,
    noAsk,
    spread: yesAsk - yesBid,
    last,
    closeTime,
    countdown: closeCountdown(closeTime),
    volume24h,
  };
}

function usage() {
  process.stdout.write(`
PolyCore CLI v${VERSION}

Usage:
  polycore watch --file ./watchlists/default.json [--refresh 10] [--once] [--json] [--demo]
  polycore monitor --tickers T1,T2 [--refresh 8] [--json] [--sort close] [--status open]
  polycore rules --file ./watchlists/rules.json [--watchlist ./watchlists/default.json] [--refresh 10] [--once] [--json] [--demo] [--fail-on-trigger]

Flags:
  --tickers          Comma-separated tickers
  --file             Path to a watchlist or rules file
  --watchlist        Watchlist file supplying tickers for rules (else tickers come from the rules)
  --refresh          Refresh interval in seconds (minimum 5)
  --once             Run one cycle and exit
  --json             Emit JSON output instead of a terminal table
  --demo             Force sample fixture mode
  --role             Fee role for EV math: taker (default) | maker
  --fail-on-trigger  Exit with code 2 if any rule triggers (for cron / CI gates)
  --sort             close | spread | last | volume | ticker
  --status           all | open | paused | closed | settled | unknown
  --version, -v      Show version
  --help, -h         Show this help text
`);
}

function parseArgs(argv) {
  const args = {
    command: argv[2] ?? 'watch',
    tickers: '',
    file: '',
    watchlist: '',
    refresh: 10,
    once: false,
    json: false,
    demo: false,
    failOnTrigger: false,
    role: 'taker',
    sort: 'close',
    status: 'all',
  };

  for (let i = 3; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];

    if (current === '--tickers') {
      args.tickers = next ?? '';
      i += 1;
    } else if (current === '--file') {
      args.file = next ?? '';
      i += 1;
    } else if (current === '--watchlist') {
      args.watchlist = next ?? '';
      i += 1;
    } else if (current === '--refresh') {
      args.refresh = Math.max(5, Number(next) || 10);
      i += 1;
    } else if (current === '--sort') {
      args.sort = next ?? 'close';
      i += 1;
    } else if (current === '--status') {
      args.status = next ?? 'all';
      i += 1;
    } else if (current === '--role') {
      args.role = next === 'maker' ? 'maker' : 'taker';
      i += 1;
    } else if (current === '--once') {
      args.once = true;
    } else if (current === '--json') {
      args.json = true;
    } else if (current === '--demo') {
      args.demo = true;
    } else if (current === '--fail-on-trigger') {
      args.failOnTrigger = true;
    } else if (current === '--version' || current === '-v') {
      process.stdout.write(`PolyCore CLI v${VERSION}\n`);
      process.exit(0);
    } else if (current === '--help' || current === '-h') {
      usage();
      process.exit(0);
    }
  }

  return args;
}

function readJsonFile(relativeFilePath) {
  const filePath = path.resolve(process.cwd(), relativeFilePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseTickers(value) {
  return [...new Set(String(value)
    .split(/[\n,]/)
    .map((ticker) => ticker.trim().toUpperCase())
    .filter(Boolean))];
}

function parseTickersFromParsed(parsed) {
  if (Array.isArray(parsed)) return parseTickers(parsed.join(','));
  if (parsed && Array.isArray(parsed.tickers)) return parseTickers(parsed.tickers.join(','));
  throw new Error('Watchlist file must be a JSON array or an object with a tickers array.');
}

function readTickers(args) {
  if (args.tickers) {
    return parseTickers(args.tickers);
  }

  if (!args.file) {
    throw new Error('Provide --tickers or --file.');
  }

  const parsed = readJsonFile(args.file);

  if (Array.isArray(parsed)) {
    return parseTickers(parsed.join(','));
  }

  if (parsed && Array.isArray(parsed.tickers)) {
    return parseTickers(parsed.tickers.join(','));
  }

  throw new Error('Watchlist file must be a JSON array or an object with a tickers array.');
}

function readRules(args) {
  if (!args.file) {
    throw new Error('Provide --file for rules.');
  }

  const parsed = readJsonFile(args.file);

  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.rules)) return parsed.rules;

  throw new Error('Rules file must be a JSON array or an object with a rules array.');
}

function cents(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function closeCountdown(value) {
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

function fmtCents(value) {
  return value === null ? '--' : `${Math.round(value)}¢`;
}

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length);
}

function fmtTitle(value) {
  return String(value ?? '--').length > 34 ? `${String(value).slice(0, 31)}...` : String(value ?? '--');
}

// Fee coefficients verified against 2026 venue schedules. Kalshi taker 0.07,
// maker ~25%; Polymarket free on most markets (0.0625 fee-enabled subset).
const FEE_COEFFICIENTS = { 'kalshi': 0.07, 'kalshi-maker': 0.0175, 'polymarket': 0, 'polymarket-fee': 0.0625, 'no-fee': 0 };

// Per-contract fee in cents, UNROUNDED (the venue rounds the order total).
function feeForPriceCents(price, feeMode, customFeeCents, role = 'taker') {
  if (feeMode === 'no-fee') return 0;
  if (feeMode === 'custom') return Math.max(0, Number(customFeeCents) || 0);
  const key = feeMode === 'kalshi' && role === 'maker' ? 'kalshi-maker' : feeMode;
  const coef = FEE_COEFFICIENTS[key] ?? 0.07;
  const p = price / 100;
  return coef * p * (1 - p) * 100;
}

// Total fee in cents billed on an order: Kalshi/fee-enabled ceil the aggregate.
function orderFeeCents(price, contracts, feeMode, customFeeCents, role = 'taker') {
  const n = Math.max(0, Math.floor(contracts));
  if (n === 0 || feeMode === 'no-fee' || feeMode === 'polymarket') return feeMode === 'no-fee' || feeMode === 'polymarket' ? 0 : 0;
  if (feeMode === 'custom') return Math.max(0, Number(customFeeCents) || 0) * n;
  const key = feeMode === 'kalshi' && role === 'maker' ? 'kalshi-maker' : feeMode;
  const coef = FEE_COEFFICIENTS[key] ?? 0.07;
  const p = price / 100;
  return Math.ceil(coef * p * (1 - p) * 100 * n - 1e-9);
}

// Order-book lock: YES+NO bought below the 100c payout (after fees) is guaranteed profit.
function detectLock(yesAsk, noAsk, feeMode = 'no-fee', customFeeCents = 0) {
  if (yesAsk === null || noAsk === null) return null;
  const combined = yesAsk + noAsk;
  const fees = feeForPriceCents(yesAsk, feeMode, customFeeCents) + feeForPriceCents(noAsk, feeMode, customFeeCents);
  const profit = 100 - combined - fees;
  return { combined, fees, overround: combined - 100, profit, exists: profit > 0 };
}

async function fetchMarkets(tickers, { demo = false } = {}) {
  if (demo) {
    return { markets: SAMPLE_MARKETS.filter((market) => tickers.length === 0 || tickers.includes(market.ticker)), source: 'demo', warning: '' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/markets?tickers=${encodeURIComponent(tickers.join(','))}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Kalshi request failed with ${response.status}`);
    }

    const payload = await response.json();
    const markets = Array.isArray(payload.markets)
      ? payload.markets.map((market) => ({
          ticker: market.ticker,
          title: market.title,
          status: market.status,
          yesBid: cents(market.yes_bid_dollars),
          yesAsk: cents(market.yes_ask_dollars),
          noBid: cents(market.no_bid_dollars),
          noAsk: cents(market.no_ask_dollars),
          spread:
            cents(market.yes_ask_dollars) !== null && cents(market.yes_bid_dollars) !== null
              ? cents(market.yes_ask_dollars) - cents(market.yes_bid_dollars)
              : null,
          last: cents(market.last_price_dollars),
          closeTime: market.close_time,
          countdown: closeCountdown(market.close_time),
          volume24h: market.volume_24h_fp ? Number(market.volume_24h_fp) : null,
        }))
      : [];

    return { markets, source: 'live', warning: '' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      markets: SAMPLE_MARKETS.filter((market) => tickers.length === 0 || tickers.includes(market.ticker)),
      source: 'demo',
      warning: `Live request failed. Falling back to demo rows: ${message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function filterAndSortMarkets(markets, args) {
  let next = args.status === 'all' ? markets : markets.filter((market) => market.status === args.status);

  next = [...next].sort((left, right) => {
    if (args.sort === 'ticker') return left.ticker.localeCompare(right.ticker);
    if (args.sort === 'spread') return (right.spread ?? -1) - (left.spread ?? -1);
    if (args.sort === 'last') return (right.last ?? -1) - (left.last ?? -1);
    if (args.sort === 'volume') return (right.volume24h ?? -1) - (left.volume24h ?? -1);
    return new Date(left.closeTime ?? 0).getTime() - new Date(right.closeTime ?? 0).getTime();
  });

  return next;
}

function render(markets, refresh, mode, args, source, warning) {
  console.clear();
  console.log(`PolyCore ${mode} | refresh ${refresh}s | source ${source} | status ${args.status} | sort ${args.sort} | updated ${new Date().toLocaleTimeString()} | rows ${markets.length}`);
  if (warning) console.log(`Warning: ${warning}`);
  console.log('');
  console.log([pad('TICKER', 22), pad('TITLE', 34), pad('STATUS', 8), pad('YB', 6), pad('YA', 6), pad('NB', 6), pad('NA', 6), pad('SPRD', 6), pad('LAST', 6), pad('VOL', 8), pad('LEFT', 10)].join('  '));
  console.log('-'.repeat(140));
  for (const market of markets) {
    console.log([
      pad(market.ticker, 22),
      pad(fmtTitle(market.title), 34),
      pad(market.status ?? '--', 8),
      pad(fmtCents(market.yesBid), 6),
      pad(fmtCents(market.yesAsk), 6),
      pad(fmtCents(market.noBid), 6),
      pad(fmtCents(market.noAsk), 6),
      pad(fmtCents(market.spread), 6),
      pad(fmtCents(market.last), 6),
      pad(market.volume24h ?? '--', 8),
      pad(market.countdown, 10),
    ].join('  '));
  }
  const locks = markets
    .map((market) => ({ ticker: market.ticker, lock: detectLock(market.yesAsk, market.noAsk, 'no-fee', 0) }))
    .filter((entry) => entry.lock && entry.lock.exists);
  if (locks.length > 0) {
    console.log('');
    console.log('Locks (YES+NO < 100¢, pre-fee):');
    for (const entry of locks) {
      console.log(`  ${pad(entry.ticker, 22)} combined ${entry.lock.combined}¢  profit +${entry.lock.profit.toFixed(2)}¢/pair`);
    }
  }
}

function evaluateRule(rule, market, previousStatus) {
  const threshold = Number(rule.threshold) || 0;
  if (rule.type === 'yes-ask-lte') return market.yesAsk !== null && market.yesAsk <= threshold ? `YES ask ${fmtCents(market.yesAsk)} <= ${fmtCents(threshold)}` : null;
  if (rule.type === 'no-ask-lte') return market.noAsk !== null && market.noAsk <= threshold ? `NO ask ${fmtCents(market.noAsk)} <= ${fmtCents(threshold)}` : null;
  if (rule.type === 'spread-lte') return market.spread !== null && market.spread <= threshold ? `Spread ${fmtCents(market.spread)} <= ${fmtCents(threshold)}` : null;
  if (rule.type === 'spread-gte') return market.spread !== null && market.spread >= threshold ? `Spread ${fmtCents(market.spread)} >= ${fmtCents(threshold)}` : null;
  if (rule.type === 'time-to-close-lte') {
    if (!market.closeTime) return null;
    const diffMinutes = Math.floor((new Date(market.closeTime).getTime() - Date.now()) / 60000);
    return diffMinutes >= 0 && diffMinutes <= threshold ? `Time to close ${diffMinutes}m <= ${threshold}m` : null;
  }
  if (rule.type === 'status-change') return previousStatus !== null && previousStatus !== market.status ? `Status changed ${previousStatus} -> ${market.status}` : null;
  if (rule.type === 'yes-positive-ev') {
    if (market.yesAsk === null) return null;
    const fee = feeForPriceCents(market.yesAsk, rule.feeMode || 'kalshi', rule.customFeeCents || 0);
    // All terms in cents: fair payout (fairPct), price (yesAsk), fee.
    const netEv = Number(rule.fairYes || 50) - market.yesAsk - fee;
    return netEv > 0 ? `YES is positive EV at ${fmtCents(market.yesAsk)} (+${netEv.toFixed(2)}¢)` : null;
  }
  if (rule.type === 'no-positive-ev') {
    if (market.noAsk === null) return null;
    const fee = feeForPriceCents(market.noAsk, rule.feeMode || 'kalshi', rule.customFeeCents || 0);
    const netEv = (100 - Number(rule.fairYes || 50)) - market.noAsk - fee;
    return netEv > 0 ? `NO is positive EV at ${fmtCents(market.noAsk)} (+${netEv.toFixed(2)}¢)` : null;
  }
  return null;
}

function renderRules(events, refresh, source, warning) {
  console.clear();
  console.log(`PolyCore rules | refresh ${refresh}s | source ${source} | updated ${new Date().toLocaleTimeString()} | triggered ${events.length}`);
  if (warning) console.log(`Warning: ${warning}`);
  console.log('');
  console.log([pad('TIME', 12), pad('RULE', 28), pad('TICKER', 22), 'MESSAGE'].join('  '));
  console.log('-'.repeat(120));
  for (const event of events) {
    console.log([pad(event.triggeredAt, 12), pad(event.ruleName, 28), pad(event.ticker, 22), event.message].join('  '));
  }
}

function printJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function run() {
  const args = parseArgs(process.argv);
  if (!['watch', 'monitor', 'rules'].includes(args.command)) {
    usage();
    process.exit(1);
  }

  if (args.command === 'rules') {
    const rules = readRules(args);
    const tickers = args.watchlist
      ? parseTickersFromParsed(readJsonFile(args.watchlist))
      : args.tickers
        ? parseTickers(args.tickers)
        : [...new Set(rules.filter((rule) => rule.isEnabled !== false).map((rule) => rule.ticker).filter(Boolean))];
    let previousStatuses = {};
    let armed = {};

    const loop = async () => {
      const { markets, source, warning } = await fetchMarkets(tickers, { demo: args.demo });
      const filteredMarkets = filterAndSortMarkets(markets, args);
      const events = [];

      for (const market of filteredMarkets) {
        const matchingRules = rules.filter((rule) => rule.isEnabled !== false && rule.ticker === market.ticker);
        const previousStatus = previousStatuses[market.ticker] ?? null;

        for (const rule of matchingRules) {
          const message = evaluateRule(rule, market, previousStatus);
          const key = `${rule.id || rule.name}:${market.ticker}`;
          if (message) {
            if (!armed[key]) {
              events.push({
                triggeredAt: new Date().toLocaleTimeString(),
                ruleName: rule.name || rule.type,
                ticker: market.ticker,
                message,
              });
              armed[key] = true;
            }
          } else {
            armed[key] = false;
          }
        }

        previousStatuses[market.ticker] = market.status;
      }

      if (args.json) {
        printJson({
          mode: 'rules',
          refreshSeconds: args.refresh,
          updatedAt: new Date().toISOString(),
          trackedTickers: tickers,
          triggeredCount: events.length,
          source,
          warning,
          events,
        });
        return events;
      }

      renderRules(events, args.refresh, source, warning);
      return events;
    };

    if (args.once || args.json) {
      const events = await loop();
      if (args.failOnTrigger && events.length > 0) process.exit(2);
      return;
    }

    await loop();
    setInterval(loop, args.refresh * 1000);
    return;
  }

  const tickers = readTickers(args);

  const loop = async () => {
    const { markets, source, warning } = await fetchMarkets(tickers, { demo: args.demo });
    const filteredMarkets = filterAndSortMarkets(markets, args);

    if (args.json) {
      printJson({
        mode: args.command,
        refreshSeconds: args.refresh,
        updatedAt: new Date().toISOString(),
        tickers,
        rowCount: filteredMarkets.length,
        source,
        warning,
        markets: filteredMarkets.map((market) => ({
          ...market,
          lock: detectLock(market.yesAsk, market.noAsk, 'no-fee', 0),
        })),
      });
      return;
    }

    render(filteredMarkets, args.refresh, args.command, args, source, warning);
  };

  if (args.once || args.json) {
    await loop();
    return;
  }

  await loop();
  setInterval(loop, args.refresh * 1000);
}

run().catch((error) => {
  console.error(`PolyCore CLI error: ${error.message}`);
  process.exit(1);
});
