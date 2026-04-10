'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatCents,
  formatCompactNumber,
  SAMPLE_MARKETS,
  statusTone,
  type NormalizedMarket,
} from '@/lib/markets';

type HistoryMap = Record<string, number[]>;
type LogEntry = { id: number; level: 'INFO' | 'WARN'; message: string; timestamp: string };

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <div className="sparkline-empty" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${24 - ((value - min) / range) * 24}`)
    .join(' ');

  return (
    <svg className="sparkline" viewBox="0 0 100 24" preserveAspectRatio="none">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
    </svg>
  );
}

function buildCalculatorHref(market: NormalizedMarket) {
  const params = new URLSearchParams({
    pricingMode: 'quote',
    yesBid: market.yesBidCents?.toString() ?? '',
    yesAsk: market.yesAskCents?.toString() ?? '',
    noBid: market.noBidCents?.toString() ?? '',
    noAsk: market.noAskCents?.toString() ?? '',
    fairYesProbability: '50',
    bankroll: '1000',
    feeMode: 'kalshi',
  });
  return `/calculator?${params.toString()}`;
}

export default function MonitorPage() {
  const [tickersText, setTickersText] = useState('');
  const [tickers, setTickers] = useState('');
  const [refreshSeconds, setRefreshSeconds] = useState(8);
  const [markets, setMarkets] = useState<NormalizedMarket[]>(SAMPLE_MARKETS);
  const [isDemo, setIsDemo] = useState(true);
  const [error, setError] = useState('');
  const [selectedTicker, setSelectedTicker] = useState<string>(SAMPLE_MARKETS[0].ticker);
  const [history, setHistory] = useState<HistoryMap>(() => Object.fromEntries(SAMPLE_MARKETS.map((market) => [market.ticker, [market.lastPriceCents ?? 0]])));
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 1, level: 'INFO', message: 'PolyCore monitor ready.', timestamp: new Date().toLocaleTimeString() },
  ]);
  const [latencyMs, setLatencyMs] = useState(0);
  const previousRef = useRef<Record<string, NormalizedMarket>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextTickers = params.get('tickers') ?? '';
    const nextRefresh = Number(params.get('refresh') ?? '8');
    setTickersText(nextTickers);
    setTickers(nextTickers);
    if (Number.isFinite(nextRefresh) && nextRefresh >= 5) {
      setRefreshSeconds(nextRefresh);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ tickers, refresh: String(refreshSeconds) });
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [tickers, refreshSeconds]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!tickers.trim()) {
        setIsDemo(true);
        setMarkets(SAMPLE_MARKETS);
        setError('');
        return;
      }

      const start = performance.now();
      try {
        const response = await fetch(`/api/kalshi/markets?tickers=${encodeURIComponent(tickers)}`, { cache: 'no-store' });
        const payload = (await response.json()) as { markets?: NormalizedMarket[]; error?: string };
        const nextLatency = Math.round(performance.now() - start);
        setLatencyMs(nextLatency);

        if (!response.ok) {
          throw new Error(payload.error ?? 'Market request failed');
        }

        const nextMarkets = Array.isArray(payload.markets) ? payload.markets : [];
        if (cancelled) return;

        setMarkets(nextMarkets);
        setIsDemo(false);
        setError('');

        setHistory((current) => {
          const next: HistoryMap = { ...current };
          for (const market of nextMarkets) {
            const currentHistory = next[market.ticker] ?? [];
            const nextPoint = market.lastPriceCents ?? market.midpointCents ?? 0;
            next[market.ticker] = [...currentHistory.slice(-11), nextPoint];
          }
          return next;
        });

        const previous = previousRef.current;
        const newLogs: LogEntry[] = [];
        for (const market of nextMarkets) {
          const before = previous[market.ticker];
          if (!before) {
            newLogs.push({ id: Date.now() + Math.random(), level: 'INFO', message: `${market.ticker} loaded into monitor.`, timestamp: new Date().toLocaleTimeString() });
            continue;
          }
          if (before.status !== market.status) {
            newLogs.push({ id: Date.now() + Math.random(), level: 'WARN', message: `${market.ticker} status changed ${before.status} → ${market.status}.`, timestamp: new Date().toLocaleTimeString() });
          }
          if (before.lastPriceCents !== market.lastPriceCents) {
            newLogs.push({ id: Date.now() + Math.random(), level: 'INFO', message: `${market.ticker} last traded ${formatCents(before.lastPriceCents)} → ${formatCents(market.lastPriceCents)}.`, timestamp: new Date().toLocaleTimeString() });
          }
        }
        previousRef.current = Object.fromEntries(nextMarkets.map((market) => [market.ticker, market]));
        if (newLogs.length > 0) {
          setLogs((current) => [...newLogs, ...current].slice(0, 16));
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unknown error');
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

  useEffect(() => {
    if (!markets.some((market) => market.ticker === selectedTicker) && markets[0]) {
      setSelectedTicker(markets[0].ticker);
    }
  }, [markets, selectedTicker]);

  const selected = markets.find((market) => market.ticker === selectedTicker) ?? markets[0] ?? null;
  const openCount = useMemo(() => markets.filter((market) => market.status === 'open').length, [markets]);
  const widestSpread = useMemo(() => [...markets].sort((a, b) => (b.yesSpreadCents ?? -1) - (a.yesSpreadCents ?? -1))[0] ?? null, [markets]);
  const soonestClose = useMemo(
    () => [...markets].sort((a, b) => (new Date(a.closeTime ?? 0).getTime() || Number.MAX_SAFE_INTEGER) - (new Date(b.closeTime ?? 0).getTime() || Number.MAX_SAFE_INTEGER))[0] ?? null,
    [markets],
  );

  return (
    <main className="page-shell page-shell-monitor">
      <div className="page-frame">
        <div className="topbar panel-surface monitor-topbar">
          <div className="brand-lockup">
            <div className="brand-mark">P</div>
            <div>
              <p className="eyebrow">Open source market toolkit by Lurk</p>
              <div className="brand-line">
                <strong>PolyCore / Monitor</strong>
                <span>Live board mode with watchlist DNA and terminal posture.</span>
              </div>
            </div>
          </div>
          <div className="topbar-actions">
            <Link className="secondary-button" href="/">Overview</Link>
            <Link className="secondary-button" href="/calculator">Calculator</Link>
            <Link className="secondary-button" href="/watchlist">Watchlist</Link>
          </div>
        </div>

        <section className="monitor-hud panel-surface">
          <div className="monitor-hud-main">
            <div>
              <p className="eyebrow">Monitor mode</p>
              <h1>Stay in the tape without sacrificing clarity.</h1>
              <p className="hero-copy">Use a tighter board, quicker cadence, and a selected-market detail pane that can fire straight into the calculator.</p>
            </div>
            <div className="monitor-hud-actions">
              <label className="field field-span-2">
                <span>Tickers</span>
                <input value={tickersText} onChange={(event) => setTickersText(event.target.value)} placeholder="Paste Kalshi tickers to replace the sample board" />
              </label>
              <label className="field">
                <span>Refresh (seconds)</span>
                <input inputMode="numeric" value={String(refreshSeconds)} onChange={(event) => setRefreshSeconds(Math.max(5, Number(event.target.value) || 5))} />
              </label>
              <button className="primary-button" type="button" onClick={() => setTickers(tickersText)}>Load board</button>
            </div>
          </div>
          <div className="monitor-stat-grid">
            <div className="info-chip"><span>Feed</span><strong>{isDemo ? 'Sample board' : 'Kalshi public data'}</strong></div>
            <div className="info-chip"><span>Latency</span><strong>{latencyMs ? `${latencyMs}ms` : '--'}</strong></div>
            <div className="info-chip"><span>Open markets</span><strong>{openCount}</strong></div>
            <div className="info-chip"><span>Widest spread</span><strong>{widestSpread ? `${widestSpread.ticker} ${formatCents(widestSpread.yesSpreadCents)}` : '--'}</strong></div>
            <div className="info-chip"><span>Soonest close</span><strong>{soonestClose ? `${soonestClose.ticker} ${soonestClose.timeToCloseLabel}` : '--'}</strong></div>
            <div className="info-chip"><span>Rows</span><strong>{markets.length}</strong></div>
          </div>
        </section>

        {error ? <div className="error-box"><p>{error}</p></div> : null}

        <section className="monitor-grid">
          <section className="monitor-board panel-surface">
            <div className="section-head compact-head">
              <div>
                <p className="eyebrow">Board</p>
                <h2>Compact live rows</h2>
              </div>
            </div>
            <div className="monitor-rows">
              {markets.map((market) => {
                const tone = statusTone(market.status);
                return (
                  <button key={market.ticker} type="button" className={`monitor-row ${selected?.ticker === market.ticker ? 'is-selected' : ''}`} onClick={() => setSelectedTicker(market.ticker)}>
                    <div className="monitor-row-main">
                      <div>
                        <div className="monitor-ticker">{market.ticker}</div>
                        <div className="monitor-title">{market.title}</div>
                      </div>
                      <span className={`status-pill status-${tone}`}>{market.status}</span>
                    </div>
                    <div className="monitor-row-metrics">
                      <span>YES {formatCents(market.yesAskCents)}</span>
                      <span>NO {formatCents(market.noAskCents)}</span>
                      <span>Spread {formatCents(market.yesSpreadCents)}</span>
                      <span>{market.timeToCloseLabel}</span>
                    </div>
                    <div className="monitor-row-spark"><Sparkline values={history[market.ticker] ?? []} /></div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="monitor-detail-stack">
            <section className="panel-surface monitor-detail-card">
              <div className="section-head compact-head">
                <div>
                  <p className="eyebrow">Selected</p>
                  <h2>{selected?.ticker ?? 'No market selected'}</h2>
                  <p className="section-copy">Selection detail is the bridge between the live board and the calculator.</p>
                </div>
                {selected ? <Link className="primary-button" href={buildCalculatorHref(selected)}>Open in calculator</Link> : null}
              </div>
              {selected ? (
                <div className="metrics-grid">
                  <div className="metric-row"><span>Title</span><strong>{selected.title}</strong></div>
                  <div className="metric-row"><span>YES bid / ask</span><strong>{formatCents(selected.yesBidCents)} / {formatCents(selected.yesAskCents)}</strong></div>
                  <div className="metric-row"><span>NO bid / ask</span><strong>{formatCents(selected.noBidCents)} / {formatCents(selected.noAskCents)}</strong></div>
                  <div className="metric-row"><span>Midpoint</span><strong>{formatCents(selected.midpointCents, 1)}</strong></div>
                  <div className="metric-row"><span>Last</span><strong>{formatCents(selected.lastPriceCents)}</strong></div>
                  <div className="metric-row"><span>Close / countdown</span><strong>{selected.closeTimeLabel} / {selected.timeToCloseLabel}</strong></div>
                  <div className="metric-row"><span>24h volume</span><strong>{formatCompactNumber(selected.volume24h)}</strong></div>
                </div>
              ) : (
                <div className="empty-state">Load a board and select a market.</div>
              )}
            </section>

            <section className="panel-surface monitor-detail-card">
              <div className="section-head compact-head">
                <div>
                  <p className="eyebrow">Feed log</p>
                  <h2>Recent board events</h2>
                </div>
              </div>
              <div className="log-list">
                {logs.map((log) => (
                  <div key={log.id} className="log-row">
                    <span className={`log-level log-${log.level.toLowerCase()}`}>{log.level}</span>
                    <span className="log-time">{log.timestamp}</span>
                    <span className="log-message">{log.message}</span>
                  </div>
                ))}
              </div>
            </section>
          </section>
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

