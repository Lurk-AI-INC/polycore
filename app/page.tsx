import Link from 'next/link';
import { PolycoreShell } from '@/components/polycore-shell';

const modules = [
  {
    href: '/calculator',
    eyebrow: 'Analyze',
    title: 'Calculator',
    copy: 'YES / NO pricing with target entry, reverse pricing, fee presets, slippage, and sizing.',
  },
  {
    href: '/watchlist',
    eyebrow: 'Track',
    title: 'Watchlist',
    copy: 'Saved local watchlists, better JSON import/export, live rows, and calculator handoff.',
  },
  {
    href: '/monitor',
    eyebrow: 'Monitor',
    title: 'Monitor',
    copy: 'A live board for tracked markets with sorting, pause/resume, selection detail, and tape-style logs.',
  },
  {
    href: '/rules',
    eyebrow: 'Automate',
    title: 'Rules',
    copy: 'Saved alert rules with import/export, positive-EV evaluation, countdown, spread, and status triggers.',
  },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <PolycoreShell
        title="PolyCore (v0.7)"
        subtitle="Open-source tooling for binary markets."
      >
        <header className="hero panel-surface">
          <div className="hero-copy-wrap">
            <p className="eyebrow">Overview</p>
            <h1>Open-source market tools.</h1>
            <p className="hero-copy">
              Price contracts, track watchlists, monitor markets, and run rules from the browser or CLI.
            </p>
            <div className="hero-actions">
              <Link className="primary-button" href="/calculator">Open calculator</Link>
              <Link className="secondary-button" href="/watchlist">Open watchlist</Link>
              <Link className="secondary-button" href="/monitor">Open monitor</Link>
              <Link className="secondary-button" href="/rules">Open rules</Link>
            </div>
          </div>
          <div className="hero-rail">
            <div className="info-chip"><span>Calculator</span><strong>Edge, EV, Kelly, target entry, and reverse pricing.</strong></div>
            <div className="info-chip"><span>Watchlist</span><strong>Saved lists, import/export, selected market detail, and fast calculator launch.</strong></div>
            <div className="info-chip"><span>Monitor</span><strong>Sorting, pause/resume, sparkline history, and event logs.</strong></div>
            <div className="info-chip"><span>Rules</span><strong>Rule builder, rule import/export, and fee-aware EV triggers.</strong></div>
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
              <p className="section-copy">{module.copy}</p>
            </section>
          ))}
        </section>
      </PolycoreShell>
    </main>
  );
}
