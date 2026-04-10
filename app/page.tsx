import Link from 'next/link';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const nav = [{ href: '/', label: 'Overview' }, { href: '/calculator', label: 'Calculator' }, { href: '/watchlist', label: 'Watchlist' }, { href: '/monitor', label: 'Monitor' }, { href: '/rules', label: 'Rules' }];
  return (
    <div className="page-frame">
      <div className="topbar panel-surface">
        <div className="brand-lockup">
          <div className="brand-mark">PC</div>
          <div>
            <p className="eyebrow">Open-source market toolkit by Lurk</p>
            <div className="brand-line"><strong>{title}</strong><span>{subtitle}</span></div>
          </div>
        </div>
        <div className="topbar-actions">
          {nav.map((link) => <Link key={link.href} className="secondary-button" href={link.href}>{link.label}</Link>)}
        </div>
      </div>
      {children}
      <footer className="footer panel-surface">
        <div className="footer-main">
          <div><p className="eyebrow">PolyCore</p><h2>Open-source market toolkit by Lurk.</h2><p className="section-copy footer-copy">Calculator, watchlist, monitor, rules, and CLI, all in one.</p></div>
          <div className="footer-links">
            {nav.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
          </div>
        </div>
      </footer>
    </div>
  );
}

const modules = [
  { href: '/calculator', eyebrow: 'Analyze', title: 'Calculator', copy: 'Quote-aware YES / NO pricing with target entry, reverse pricing, fee presets, slippage, and sizing.' },
  { href: '/watchlist', eyebrow: 'Track', title: 'Watchlist', copy: 'Saved watchlists, live Kalshi public data, filter/sort, and one-click launch into the calculator.' },
  { href: '/monitor', eyebrow: 'Operate', title: 'Monitor', copy: 'A live board with selection detail, pulse metrics, and event logs.' },
  { href: '/rules', eyebrow: 'Anchor', title: 'Rules', copy: 'Saved alert rules that watch prices, spread, status, time-to-close, and positive-EV conditions.' },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <Shell title="PolyCore (v0.1)" subtitle="Analyze. Track. Monitor. Rule.">
        <header className="hero panel-surface">
          <div className="hero-copy-wrap">
            <p className="eyebrow">Overview</p>
            <h1>Free market tools.</h1>
            <p className="hero-copy">PolyCore merges advanced math, locally saved watchlists, a live monitor, plus a CLI if you're into that.</p>
            <div className="hero-actions">
              <Link className="primary-button" href="/calculator">Open calculator</Link>
              <Link className="secondary-button" href="/watchlist">Open watchlist</Link>
              <Link className="secondary-button" href="/monitor">Open monitor</Link>
              <Link className="secondary-button" href="/rules">Open rules</Link>
            </div>
          </div>
          <div className="hero-rail">
            <div className="info-chip"><span>Calculator</span><strong>Edge, EV, Kelly, target entry, reverse pricing.</strong></div>
            <div className="info-chip"><span>Watchlist V2</span><strong>Saved local watchlists, import/export, filters, and calc handoff.</strong></div>
            <div className="info-chip"><span>Monitor V2</span><strong>Selection detail, pulse metrics, event logs, density, and live posture.</strong></div>
            <div className="info-chip"><span>Rules</span><strong>Saved conditions for entry, spread, status, countdown, and positive EV.</strong></div>
          </div>
        </header>

        <section className="results-grid">
          {modules.map((module) => (
            <section key={module.href} className="result-card panel-surface">
              <div className="result-card-header">
                <div><p className="eyebrow">{module.eyebrow}</p><h2>{module.title}</h2></div>
                <Link className="badge badge-best" href={module.href}>Open</Link>
              </div>
              <p className="section-copy">{module.copy}</p>
            </section>
          ))}
        </section>
      </Shell>
    </main>
  );
}
