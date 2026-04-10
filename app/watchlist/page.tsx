'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  formatCents,
  formatCompactNumber,
  SAMPLE_MARKETS,
  statusTone,
  type NormalizedMarket,
} from '@/lib/markets';

type SortKey = 'status-close' | 'widest-spread' | 'last-price';

function buildCalculatorHref(market: NormalizedMarket, fairYes: string, bankroll: string) {
  const params = new URLSearchParams({
    pricingMode: 'quote',
    yesBid: market.yesBidCents?.toString() ?? '',
    yesAsk: market.yesAskCents?.toString() ?? '',
    noBid: market.noBidCents?.toString() ?? '',
    noAsk: market.noAskCents?.toString() ?? '',
    fairYesProbability: fairYes,
    bankroll,
    feeMode: 'kalshi',
    sizingMode: 'quarter-kelly',
  });

  return `/calculator?${params.toString()}`;
}

function sortMarkets(markets: NormalizedMarket[], sortKey: SortKey): NormalizedMarket[] {
  const next = [...markets];

  if (sortKey === 'widest-spread') {
    return next.sort((a, b) => (b.yesSpreadCents ?? -1) - (a.yesSpreadCents ?? -1));
  }

  if (sortKey === 'last-price') {
    return next.sort((a, b) => (b.lastPriceCents ?? -1) - (a.lastPriceCents ?? -1));
  }

  return next.sort((a, b) => {
    const aOpen = a.status === 'open' ? 0 : 1;
    const bOpen = b.status === 'open' ? 0 : 1;
    if (aOpen !== bOpen) {
      return aOpen - bOpen;
    }
    return (new Date(a.closeTime ?? 0).getTime() || Number.MAX_SAFE_INTEGER) - (new Date(b.closeTime ?? 0).getTime() || Number.MAX_SAFE_INTEGER);
  });
}

export default function WatchlistPage() {
  const [tickerText, setTickerText] = useState('');
  const [tickers, setTickers] = useState('');
  const [refreshSeconds, setRefreshSeconds] = useState(15);
  const [fairYes, setFairYes] = useState('50');
  const [bankroll, setBankroll] = useState('1000');
  const [sortKey, setSortKey] = useState<SortKey>('status-close');
  const [markets, setMarkets] = useState<NormalizedMarket[]>(SAMPLE_MARKETS);
  const [isDemo, setIsDemo] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('Sample mode');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextTickers = params.get('tickers') ?? '';
    const nextRefresh = Number(params.get('refresh') ?? '15');
    const nextFair = params.get('fairYes') ?? '50';
    const nextBankroll = params.get('bankroll') ?? '1000';
    const nextSort = (params.get('sort') ?? 'status-close') as SortKey;

    setTickerText(nextTickers);
    setTickers(nextTickers);
    if (Number.isFinite(nextRefresh) && nextRefresh >= 5) {
      setRefreshSeconds(nextRefresh);
    }
    setFairYes(nextFair);
    setBankroll(nextBankroll);
    if (nextSort === 'status-close' || nextSort === 'widest-spread' || nextSort === 'last-price') {
      setSortKey(nextSort);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({
      tickers,
      refresh: String(refreshSeconds),
      fairYes,
      bankroll,
      sort: sortKey,
    });
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [tickers, refreshSeconds, fairYes, bankroll, sortKey]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!tickers.trim()) {
        setIsDemo(true);
        setMarkets(SAMPLE_MARKETS);
        setError('');
        setLastUpdated('Sample mode');
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/kalshi/markets?tickers=${encodeURIComponent(tickers)}`, { cache: 'no-store' });
        const payload = (await response.json()) as { markets?: NormalizedMarket[]; error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? 'Market request failed');
        }

        if (!cancelled) {
          setMarkets(Array.isArray(payload.markets) ? payload.markets : []);
          setError('');
          setIsDemo(false);
          setLastUpdated(new Date().toLocaleTimeString());
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    const interval = window.setInterval(load, refreshSeconds * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [tickers, refreshSeconds]);

  const sorted = useMemo(() => sortMarkets(markets, sortKey), [markets, sortKey]);
  const selected = sorted[0] ?? null;

  return (
    <main className="page-shell">
      <div className="page-frame">
        <div className="topbar panel-surface">
          <div className="brand-lockup">
            <div className="brand-mark">P</div>
            <div>
              <p className="eyebrow">Open source market toolkit by Lurk</p>
              <div className="brand-line">
                <strong>PolyCore / Watchlist</strong>
                <span>Track the markets that matter and hand them to the calculator.</span>
              </div>
            </div>
          </div>
          <div className="topbar-actions">
            <Link className="secondary-button" href="/">Overview</Link>
            <Link className="secondary-button" href="/calculator">Calculator</Link>
            <Link className="secondary-button" href="/monitor">Monitor</Link>
          </div>
        </div>

        <header className="hero panel-surface">
          <div className="hero-copy-wrap">
            <p className="eyebrow">Watchlist module</p>
            <h1>Load a list. Watch spread. Jump into math fast.</h1>
            <p className="hero-copy">
              Paste 5 to 20 Kalshi tickers, keep the board refreshing, and launch any row straight into the calculator with live bid / ask fields already filled.
            </p>
          </div>
          <div className="hero-rail">
            <div className="info-chip"><span>Source</span><strong>{isDemo ? 'Sample layout data' : 'Kalshi public market data'}</strong></div>
            <div className="info-chip"><span>Refresh</span><strong>Every {refreshSeconds}s</strong></div>
            <div className="info-chip"><span>Rows</span><strong>{sorted.length}</strong></div>
            <div className="info-chip"><span>Last update</span><strong>{lastUpdated}</strong></div>
          </div>
        </header>

        <section className="controls-layout controls-layout-watchlist">
          <section className="section-frame panel-surface">
            <div className="section-head">
              <div>
                <p className="eyebrow">Load</p>
                <h2>Watchlist configuration</h2>
                <p className="section-copy">Use comma-separated Kalshi tickers. Leave it empty to preview the product in sample mode.</p>
              </div>
              <div className="section-actions">
                <button className="secondary-button" type="button" onClick={() => setTickers(tickerText)}>Load watchlist</button>
              </div>
            </div>
            <div className="control-grid control-grid-2">
              <label className="field field-span-2">
                <span>Tickers</span>
                <input value={tickerText} onChange={(event) => setTickerText(event.target.value)} placeholder="KXHIGHNY-26APR10-T75, FED-26MAY-TGT525" />
              </label>
              <label className="field">
                <span>Refresh (seconds)</span>
                <input inputMode="numeric" value={String(refreshSeconds)} onChange={(event) => setRefreshSeconds(Math.max(5, Number(event.target.value) || 5))} />
              </label>
              <label className="field">
                <span>Sort</span>
                <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                  <option value="status-close">Open then close time</option>
                  <option value="widest-spread">Widest spread</option>
                  <option value="last-price">Highest last price</option>
                </select>
              </label>
              <label className="field">
                <span>Default fair YES (%)</span>
                <input value={fairYes} onChange={(event) => setFairYes(event.target.value)} />
              </label>
              <label className="field">
                <span>Default bankroll ($)</span>
                <input value={bankroll} onChange={(event) => setBankroll(event.target.value)} />
              </label>
            </div>
          </section>

          <section className="section-frame panel-surface">
            <div className="section-head">
              <div>
                <p className="eyebrow">Selection</p>
                <h2>{selected?.ticker ?? 'No market loaded'}</h2>
                <p className="section-copy">The first row in the current sort is pinned here so the watchlist feels like a tool, not a dead table.</p>
              </div>
              {selected ? <Link className="primary-button" href={buildCalculatorHref(selected, fairYes, bankroll)}>Open in calculator</Link> : null}
            </div>
            {selected ? (
              <div className="metrics-grid">
                <div className="metric-row"><span>Title</span><strong>{selected.title}</strong></div>
                <div className="metric-row"><span>Status</span><strong>{selected.status}</strong></div>
                <div className="metric-row"><span>YES bid / ask</span><strong>{formatCents(selected.yesBidCents)} / {formatCents(selected.yesAskCents)}</strong></div>
                <div className="metric-row"><span>NO bid / ask</span><strong>{formatCents(selected.noBidCents)} / {formatCents(selected.noAskCents)}</strong></div>
                <div className="metric-row"><span>Spread / midpoint</span><strong>{formatCents(selected.yesSpreadCents)} / {formatCents(selected.midpointCents, 1)}</strong></div>
                <div className="metric-row"><span>Close / time left</span><strong>{selected.closeTimeLabel} / {selected.timeToCloseLabel}</strong></div>
                <div className="metric-row"><span>24h volume</span><strong>{formatCompactNumber(selected.volume24h)}</strong></div>
              </div>
            ) : (
              <div className="empty-state">Load a live ticker list or stay in sample mode to preview the layout.</div>
            )}
          </section>
        </section>

        {error ? <div className="error-box"><p>{error}</p></div> : null}

        <section className="section-frame panel-surface">
          <div className="section-head">
            <div>
              <p className="eyebrow">Board</p>
              <h2>Live watchlist</h2>
              <p className="section-copy">Designed to be readable on desktop and still not suck on mobile.</p>
            </div>
            <div className="section-actions">
              <span className="precision-label">{isLoading ? 'Refreshing…' : isDemo ? 'Sample data' : 'Live data'}</span>
            </div>
          </div>
          <div className="table-wrap market-table-wrap">
            <table className="data-table market-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>YES bid</th>
                  <th>YES ask</th>
                  <th>NO bid</th>
                  <th>NO ask</th>
                  <th>Spread</th>
                  <th>Last</th>
                  <th>Close</th>
                  <th>Time left</th>
                  <th>Calc</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((market) => (
                  <tr key={market.ticker}>
                    <td className="ticker-cell">{market.ticker}</td>
                    <td className="title-cell">
                      <strong>{market.title}</strong>
                      <span>{market.subtitle || 'Kalshi market'}</span>
                    </td>
                    <td><span className={`status-pill status-${statusTone(market.status)}`}>{market.status}</span></td>
                    <td>{formatCents(market.yesBidCents)}</td>
                    <td>{formatCents(market.yesAskCents)}</td>
                    <td>{formatCents(market.noBidCents)}</td>
                    <td>{formatCents(market.noAskCents)}</td>
                    <td>{formatCents(market.yesSpreadCents)}</td>
                    <td>{formatCents(market.lastPriceCents)}</td>
                    <td>{market.closeTimeLabel}</td>
                    <td>{market.timeToCloseLabel}</td>
                    <td>
                      <Link className="table-link" href={buildCalculatorHref(market, fairYes, bankroll)}>
                        Price it
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>


        <footer className="footer panel-surface">
          <div className="footer-main">
            <div>
              <p className="eyebrow">PolyCore</p>
              <h2>Open-source binary market toolkit by Lurk.</h2>
              <p className="section-copy footer-copy">
                Calculator, watchlist, monitor, and CLI in one polished repo.
              </p>
            </div>
            <div className="footer-links">
              <Link href="/">Overview</Link>
              <Link href="/calculator">Calculator</Link>
              <Link href="/watchlist">Watchlist</Link>
              <Link href="/monitor">Monitor</Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

