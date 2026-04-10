import Link from 'next/link';

const modules = [
  {
    href: '/calculator',
    eyebrow: 'Analyze',
    title: 'Calculator',
    copy: 'Price YES or NO with target entry, reverse pricing, fee presets, slippage, and sizing discipline.',
  },
  {
    href: '/watchlist',
    eyebrow: 'Track',
    title: 'Watchlist',
    copy: 'Load a focused list of Kalshi tickers, monitor spreads, close times, and jump straight into the calculator.',
  },
  {
    href: '/monitor',
    eyebrow: 'Operate',
    title: 'Monitor',
    copy: 'A denser live board with selection detail, pulse metrics, micro-history, and terminal-style posture.',
  },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <div className="page-frame">
        <div className="topbar panel-surface">
          <div className="brand-lockup">
            <div className="brand-mark">PC</div>
            <div>
              <p className="eyebrow">Open source market toolkit by Lurk</p>
              <div className="brand-line">
                <strong>PolyCore (v0.1)</strong>
                <span>Analyze. Track. Monitor.</span>
              </div>
            </div>
          </div>
          <div className="topbar-actions">
            <Link className="secondary-button" href="/calculator">Calculator</Link>
            <Link className="secondary-button" href="/watchlist">Watchlist</Link>
            <Link className="secondary-button" href="/monitor">Monitor</Link>
          </div>
        </div>

        <header className="hero panel-surface">
          <div className="hero-copy-wrap">
            <p className="eyebrow">Overview</p>
            <h1>Free market tools.</h1>
            <p className="hero-copy">
              PolyCore merges the advanced PolyCalc math with a real watchlist and a live monitor surface,
              plus a CLI in the same repo for terminal-native usage.
            </p>
            <div className="hero-actions">
              <Link className="primary-button" href="/calculator">Open calculator</Link>
              <Link className="secondary-button" href="/watchlist">Open watchlist</Link>
              <Link className="secondary-button" href="/monitor">Open monitor</Link>
            </div>
          </div>

          <div className="hero-rail">
            <div className="info-chip">
              <span>Calculator</span>
              <strong>Edge, EV, Kelly, target entry, reverse pricing.</strong>
            </div>
            <div className="info-chip">
              <span>Watchlist</span>
              <strong>Ticker-based market tracking with live Kalshi public data.</strong>
            </div>
            <div className="info-chip">
              <span>Monitor</span>
              <strong>Bloomberg-lite live board with selection detail and pulse metrics.</strong>
            </div>
            <div className="info-chip">
              <span>CLI</span>
              <strong>Headless watch and monitor commands in the same repo.</strong>
            </div>
          </div>
        </header>

        <section className="results-grid">
          {modules.map((module) => (
            <section key={module.href} className="result-card panel-surface">
              <div className="result-card-header">
                <div>
                  <p className="eyebrow">{module.eyebrow}</p>
                  <h2>{module.title}</h2>
                </div>
                <Link className="badge badge-best" href={module.href}>Open</Link>
              </div>
              <div className="stack-md">
                <p className="section-copy">{module.copy}</p>
              </div>
            </section>
          ))}
        </section>

        <section className="section-frame panel-surface">
          <div className="section-head">
            <div>
              <p className="eyebrow">Product shape</p>
              <h2>How the pieces fit</h2>
              <p className="section-copy">
                Calculator is the analysis module. Watchlist is the tracking module. Monitor is the live operating mode.
              </p>
            </div>
          </div>
          <div className="flow-grid">
            <div className="subpanel surface-soft">
              <div className="subpanel-header"><h3>Analyze</h3></div>
              <p className="section-copy">Launch pricing math from scratch or jump in from a watched market with bid / ask prefilled.</p>
            </div>
            <div className="subpanel surface-soft">
              <div className="subpanel-header"><h3>Track</h3></div>
              <p className="section-copy">Load 5 to 20 markets, watch spread and close timing, then click straight into the calculator.</p>
            </div>
            <div className="subpanel surface-soft">
              <div className="subpanel-header"><h3>Operate</h3></div>
              <p className="section-copy">Leave the monitor open during the session with compact rows, pulse metrics, logs, and selection detail.</p>
            </div>
          </div>
        </section>

        <footer className="footer panel-surface">
          <div className="footer-main">
            <div>
              <p className="eyebrow">PolyCore</p>
              <h2>Open-source binary market toolkit by Lurk.</h2>
              <p className="section-copy footer-copy">
                One brand, one repo, one polished shell across calculator, watchlist, monitor, and CLI.
              </p>
            </div>
            <div className="footer-links">
              <Link href="/calculator">Calculator</Link>
              <Link href="/watchlist">Watchlist</Link>
              <Link href="/monitor">Monitor</Link>
            </div>
          </div>
          <div className="footer-meta">
            <span>Kalshi public market data.</span>
            <span>Shareable calculator state.</span>
            <span>Web + CLI in one repo.</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
