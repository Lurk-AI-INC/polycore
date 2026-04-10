'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { SAMPLE_MARKETS, formatCents, formatCompactNumber, statusTone, type Market } from '@/lib/markets';

type HistoryMap = Record<string, number[]>;
type LogEntry = { id: number; level: 'INFO' | 'WARN'; message: string; timestamp: string };

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return <div className="sparkline-empty" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${24 - ((value - min) / range) * 24}`).join(' ');
  return <svg className="sparkline" viewBox="0 0 100 24" preserveAspectRatio="none"><polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} /></svg>;
}

function calculatorHref(market: Market) {
  const params = new URLSearchParams({
    fairYesProbability: '50', bankroll: '1000', feeMode: 'kalshi', sizingMode: 'quarter-kelly',
    yesBid: String(market.yesBidCents ?? ''), yesAsk: String(market.yesAskCents ?? ''), noBid: String(market.noBidCents ?? ''), noAsk: String(market.noAskCents ?? ''),
  });
  return `/calculator?${params.toString()}`;
}

export default function MonitorPage() {
  const nav = [{ href: '/', label: 'Overview' }, { href: '/calculator', label: 'Calculator' }, { href: '/watchlist', label: 'Watchlist' }, { href: '/monitor', label: 'Monitor' }];
  const [markets, setMarkets] = useState<Market[]>(SAMPLE_MARKETS);
  const [selectedTicker, setSelectedTicker] = useState(SAMPLE_MARKETS[0].ticker);
  const [tickersText, setTickersText] = useState(SAMPLE_MARKETS.map((market) => market.ticker).join(', '));
  const [refreshSeconds, setRefreshSeconds] = useState(8);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('compact');
  const [history, setHistory] = useState<HistoryMap>(() => Object.fromEntries(SAMPLE_MARKETS.map((market) => [market.ticker, [market.lastPriceCents ?? 0]])));
  const [logs, setLogs] = useState<LogEntry[]>([{ id: 1, level: 'INFO', message: 'PolyCore monitor ready.', timestamp: new Date().toLocaleTimeString() }]);
  const [latencyMs, setLatencyMs] = useState(0);
  const [isDemo, setIsDemo] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const tickers = tickersText.split(',').map((ticker) => ticker.trim()).filter(Boolean);
      if (tickers.length === 0) { setMarkets(SAMPLE_MARKETS); setIsDemo(true); return; }
      const start = performance.now();
      try {
        const response = await fetch(`/api/kalshi/markets?tickers=${encodeURIComponent(tickers.join(','))}`, { cache: 'no-store' });
        const payload = await response.json() as { markets?: Market[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'Request failed');
        const nextMarkets = Array.isArray(payload.markets) && payload.markets.length > 0 ? payload.markets : SAMPLE_MARKETS;
        if (cancelled) return;
        setLatencyMs(Math.round(performance.now() - start));
        setMarkets(nextMarkets); setIsDemo(false); setError('');
        setHistory((current) => {
          const next = { ...current };
          for (const market of nextMarkets) {
            const point = market.lastPriceCents ?? market.midpointCents ?? 0;
            next[market.ticker] = [...(next[market.ticker] ?? []).slice(-11), point];
          }
          return next;
        });
        setLogs((current): LogEntry[] => [{ id: Date.now(), level: 'INFO' as const, message: `Board refreshed with ${nextMarkets.length} rows.`, timestamp: new Date().toLocaleTimeString() }, ...current].slice(0, 18));
      } catch (nextError) {
        if (!cancelled) { setError(nextError instanceof Error ? nextError.message : 'Unknown error'); setMarkets(SAMPLE_MARKETS); setIsDemo(true); }
      }
    }
    load();
    const timer = window.setInterval(load, refreshSeconds * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [tickersText, refreshSeconds]);

  const selected = markets.find((market) => market.ticker === selectedTicker) ?? markets[0] ?? null;
  const openCount = useMemo(() => markets.filter((market) => market.status === 'open').length, [markets]);
  const widest = useMemo(() => [...markets].sort((a, b) => (b.yesSpreadCents ?? -1) - (a.yesSpreadCents ?? -1))[0] ?? null, [markets]);
  const soonest = useMemo(() => [...markets].sort((a, b) => new Date(a.closeTime ?? 0).getTime() - new Date(b.closeTime ?? 0).getTime())[0] ?? null, [markets]);

  return (
    <main className="page-shell page-shell-monitor">
      <div className="page-frame">
        <div className="topbar panel-surface"><div className="brand-lockup"><div className="brand-mark">P</div><div><p className="eyebrow">Open-source binary market toolkit by Lurk</p><div className="brand-line"><strong>PolyCore / Monitor</strong><span>Live board mode with watchlist DNA</span></div></div></div><div className="topbar-actions">{nav.map((link) => <Link key={link.href} className="secondary-button" href={link.href}>{link.label}</Link>)}</div></div>

        <section className="monitor-hud panel-surface">
          <div className="monitor-hud-main">
            <div><p className="eyebrow">Monitor mode</p><h1>Stay in the tape without sacrificing clarity.</h1><p className="hero-copy">Use a denser board, tighter cadence, a pinned detail pane, and a feed log that feels closer to a workstation than a toy.</p></div>
            <div className="monitor-hud-actions">
              <label className="field field-span-2"><span>Tickers</span><input value={tickersText} onChange={(e) => setTickersText(e.target.value)} /></label>
              <label className="field"><span>Refresh (seconds)</span><input value={String(refreshSeconds)} onChange={(e) => setRefreshSeconds(Math.max(5, Number(e.target.value) || 5))} /></label>
              <label className="field"><span>Density</span><select value={density} onChange={(e) => setDensity(e.target.value as 'comfortable' | 'compact')}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label>
            </div>
          </div>
          <div className="monitor-stat-grid">
            <div className="info-chip"><span>Feed</span><strong>{isDemo ? 'Sample board' : 'Live board'}</strong></div>
            <div className="info-chip"><span>Latency</span><strong>{latencyMs ? `${latencyMs}ms` : '--'}</strong></div>
            <div className="info-chip"><span>Open markets</span><strong>{openCount}</strong></div>
            <div className="info-chip"><span>Widest spread</span><strong>{widest ? `${widest.ticker} ${formatCents(widest.yesSpreadCents)}` : '--'}</strong></div>
            <div className="info-chip"><span>Soonest close</span><strong>{soonest ? `${soonest.ticker} ${soonest.timeToCloseLabel}` : '--'}</strong></div>
            <div className="info-chip"><span>Rows</span><strong>{markets.length}</strong></div>
          </div>
        </section>

        {error ? <div className="error-box"><p>{error}</p></div> : null}

        <section className="monitor-grid">
          <section className="monitor-board panel-surface">
            <div className="section-head compact-head"><div><p className="eyebrow">Board</p><h2>Compact live rows</h2></div></div>
            <div className={`monitor-rows ${density === 'compact' ? 'is-compact' : ''}`}>
              {markets.map((market) => (
                <button key={market.ticker} type="button" className={`monitor-row ${selected?.ticker === market.ticker ? 'is-selected' : ''}`} onClick={() => setSelectedTicker(market.ticker)}>
                  <div className="monitor-row-main"><div><div className="monitor-ticker">{market.ticker}</div><div className="monitor-title">{market.title}</div></div><span className={`status-pill status-${statusTone(market.status)}`}>{market.status}</span></div>
                  <div className="monitor-row-metrics"><span>YES {formatCents(market.yesAskCents)}</span><span>NO {formatCents(market.noAskCents)}</span><span>Spread {formatCents(market.yesSpreadCents)}</span><span>{market.timeToCloseLabel}</span></div>
                  <div className="monitor-row-spark"><Sparkline values={history[market.ticker] ?? []} /></div>
                </button>
              ))}
            </div>
          </section>

          <section className="monitor-detail-stack">
            <section className="monitor-detail-card panel-surface">
              <div className="section-head compact-head"><div><p className="eyebrow">Selected</p><h2>{selected?.ticker ?? 'No market selected'}</h2></div>{selected ? <Link className="primary-button" href={calculatorHref(selected)}>Open in calculator</Link> : null}</div>
              {selected ? <div className="metrics-grid"><div className="metric-row"><span>Title</span><strong>{selected.title}</strong></div><div className="metric-row"><span>YES bid / ask</span><strong>{formatCents(selected.yesBidCents)} / {formatCents(selected.yesAskCents)}</strong></div><div className="metric-row"><span>NO bid / ask</span><strong>{formatCents(selected.noBidCents)} / {formatCents(selected.noAskCents)}</strong></div><div className="metric-row"><span>Midpoint / last</span><strong>{formatCents(selected.midpointCents, 1)} / {formatCents(selected.lastPriceCents)}</strong></div><div className="metric-row"><span>Close / countdown</span><strong>{selected.closeTimeLabel} / {selected.timeToCloseLabel}</strong></div><div className="metric-row"><span>24h volume</span><strong>{formatCompactNumber(selected.volume24h)}</strong></div></div> : <div className="empty-state">Load a board and select a market.</div>}
            </section>

            <section className="monitor-detail-card panel-surface">
              <div className="section-head compact-head"><div><p className="eyebrow">Feed log</p><h2>Recent board events</h2></div></div>
              <div className="log-list">
                {logs.map((log) => <div key={log.id} className="log-row"><span className={`log-level log-${log.level.toLowerCase()}`}>{log.level}</span><span className="log-time">{log.timestamp}</span><span className="log-message">{log.message}</span></div>)}
              </div>
            </section>
          </section>
        </section>

        <footer className="footer panel-surface"><div className="footer-main"><div><p className="eyebrow">PolyCore</p><h2>Monitor module inside the PolyCore toolkit by Lurk.</h2><p className="section-copy footer-copy">Bloomberg-lite live board, selected-market detail, feed log, and calculator launch in one surface.</p></div></div></footer>
      </div>
    </main>
  );
}
