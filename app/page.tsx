import Link from 'next/link';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const nav = [
    { href: '/calculator', label: 'Calculator' },
    { href: '/watchlist', label: 'Watchlist' },
    { href: '/monitor', label: 'Monitor' },
    { href: '/rules', label: 'Rules' },
    { href: 'https://github.com/Lurk-AI-INC/polycore', label: 'GitHub' },
  ];

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
          <div>
            <p className="eyebrow">PolyCore</p>
            <h2>Fast tooling for binary market workflows.</h2>
            <p className="section-copy footer-copy">Calculator, watchlists, monitor, rules, and CLI.</p>
          </div>
          <div className="footer-links">
            {nav.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
          </div>
        </div>
      </footer>
    </div>
  );
}

const modules = [
  { href: '/calculator', eyebrow: 'Analyze', title: 'Calculator', copy: 'YES / NO pricing with target entry, reverse pricing, fee presets, slippage, and sizing.' },
  { href: '/watchlist', eyebrow: 'Track', title: 'Watchlist', copy: 'Saved local watchlists, live Kalshi data, filter/sort, and one-click launch into the calculator.' },
  { href: '/monitor', eyebrow: 'Monitor', title: 'Monitor', copy: 'A live board for tracked markets with selection detail, pulse metrics, and event logs.' },
  { href: '/rules', eyebrow: 'Automate', title: 'Rules', copy: 'Saved alert rules that watch price, spread, status, time-to-close, and positive-EV conditions.' },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <Shell title="PolyCore (v0.4)" subtitle="Open-source tooling for binary markets.">
        <header className="hero panel-surface">
          <div className="hero-copy-wrap">
            <p className="eyebrow">Overview</p>
            <h1>Open-source market tools.</h1>
            <p className="hero-copy">Price contracts, track watchlists, monitor live markets, and run local rules from the browser or terminal.</p>
            <div className="hero-actions">
              <Link className="primary-button" href="/calculator">Open calculator</Link>
              <Link className="secondary-button" href="/watchlist">Open watchlist</Link>
              <Link className="secondary-button" href="/monitor">Open monitor</Link>
              <Link className="secondary-button" href="/rules">Open rules</Link>
            </div>
          </div>
          <div className="hero-rail">
            <div className="info-chip"><span>Calculator</span><strong>Edge, EV, Kelly, target entry, and reverse pricing.</strong></div>
            <div className="info-chip"><span>Watchlist</span><strong>Saved local watchlists, import/export, filters, and calculator handoff.</strong></div>
            <div className="info-chip"><span>Monitor</span><strong>Live board for the markets you are tracking right now.</strong></div>
            <div className="info-chip"><span>Rules</span><strong>Saved conditions for entry, spread, status, countdown, and EV.</strong></div>
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
