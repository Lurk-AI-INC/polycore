'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  calculate,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatPercentFromFraction,
  formatSignedCents,
  formatSignedCurrencyFromCents,
  type FeeMode,
  type Inputs,
  type PricingMode,
  type SideResult,
  type SizingMode,
} from '@/lib/calculator';

const DEFAULT_INPUTS: Inputs = {
  pricingMode: 'single',
  yesPrice: '54',
  noPrice: '48',
  yesBid: '53',
  yesAsk: '55',
  noBid: '47',
  noAsk: '49',
  fairYesProbability: '61',
  bankroll: '1000',
  feeMode: 'custom',
  fee: '1',
  kellyCapPercent: '25',
  sizingMode: 'quarter-kelly',
  fixedDollarSize: '100',
  fixedMaxLoss: '100',
  fixedBankrollRiskPercent: '2',
  reverseDesiredEv: '2',
  reverseDesiredRoi: '10',
  precision: 2,
};

const INPUT_KEYS: Array<keyof Inputs> = [
  'pricingMode',
  'yesPrice',
  'noPrice',
  'yesBid',
  'yesAsk',
  'noBid',
  'noAsk',
  'fairYesProbability',
  'bankroll',
  'feeMode',
  'fee',
  'kellyCapPercent',
  'sizingMode',
  'fixedDollarSize',
  'fixedMaxLoss',
  'fixedBankrollRiskPercent',
  'reverseDesiredEv',
  'reverseDesiredRoi',
  'precision',
];

function parseInputsFromUrl(search: string): Inputs {
  const params = new URLSearchParams(search);
  const next: Inputs = { ...DEFAULT_INPUTS };

  for (const key of INPUT_KEYS) {
    const value = params.get(key);
    if (value !== null) {
      if (key === 'precision') {
        next.precision = Number(value) === 4 ? 4 : 2;
      } else {
        next[key] = value as never;
      }
    }
  }

  return next;
}

function serializeInputsToUrl(inputs: Inputs): string {
  const params = new URLSearchParams();

  for (const key of INPUT_KEYS) {
    const value = String(inputs[key]);
    params.set(key, value);
  }

  return params.toString();
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string>>;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getVerdict(side: SideResult, bestSide: 'yes' | 'no' | null, recommendation: 'buy-yes' | 'buy-no' | 'pass') {
  if (!side.isAvailable) {
    return { label: 'Awaiting input', className: 'badge badge-muted' };
  }

  if (recommendation === 'pass') {
    return { label: 'Pass', className: 'badge badge-negative' };
  }

  if (bestSide === side.side && side.netEv > 0) {
    return { label: 'Best action', className: 'badge badge-best' };
  }

  if (side.netEv > 0) {
    return { label: 'Positive EV', className: 'badge badge-positive' };
  }

  return { label: 'Negative EV', className: 'badge badge-negative' };
}

function ResultCard({
  side,
  bestSide,
  recommendation,
  precision,
  pricingMode,
}: {
  side: SideResult;
  bestSide: 'yes' | 'no' | null;
  recommendation: 'buy-yes' | 'buy-no' | 'pass';
  precision: number;
  pricingMode: PricingMode;
}) {
  const verdict = getVerdict(side, bestSide, recommendation);

  return (
    <section className={`result-card ${bestSide === side.side && recommendation !== 'pass' ? 'result-card-best' : ''}`}>
      <div className="result-card-header">
        <div>
          <p className="eyebrow">Outcome</p>
          <h2>{side.label}</h2>
        </div>
        <span className={verdict.className}>{verdict.label}</span>
      </div>

      {!side.isAvailable ? (
        <div className="empty-state">Enter a price for this side to run the math.</div>
      ) : (
        <div className="stack-lg">
          <div className="subpanel">
            <div className="subpanel-header">
              <h3>Core</h3>
            </div>
            <div className="metrics-grid">
              <MetricRow label="Active entry price" value={`${formatNumber(side.price, precision)}¢`} />
              <MetricRow label="Fee / contract" value={`${formatNumber(side.feePerContract, precision)}¢`} />
              <MetricRow label="Break-even probability" value={formatPercentFromFraction(side.breakEvenProbability, precision)} />
              <MetricRow label="Min fair needed" value={formatPercentFromFraction(side.fairProbabilityNeeded, precision)} />
              <MetricRow label="Your fair probability" value={formatPercentFromFraction(side.fairProbability, precision)} />
              <MetricRow label="Gross edge" value={formatSignedCents(side.grossEdge, precision)} />
              <MetricRow label="Net edge" value={formatSignedCents(side.netEdge, precision)} />
              <MetricRow label="Gross EV / contract" value={formatSignedCents(side.grossEv, precision)} />
              <MetricRow label="Net EV / contract" value={formatSignedCents(side.netEv, precision)} />
              <MetricRow label="ROI on risk" value={formatPercent(side.roiOnRisk * 100, precision)} />
              <MetricRow label="Full Kelly" value={formatPercentFromFraction(side.fullKellyFraction, precision)} />
              <MetricRow label="Kelly cap" value={formatPercentFromFraction(side.cappedKellyFraction, precision)} />
              <MetricRow label="Risk / contract" value={formatCurrency(side.risk / 100, precision)} />
              <MetricRow label="Win / contract" value={formatCurrency(side.profit / 100, precision)} />
            </div>
          </div>

          <div className="subpanel">
            <div className="subpanel-header">
              <h3>Position sizing</h3>
            </div>
            <div className="metrics-grid">
              <MetricRow label="Mode" value={side.position.sizingModeLabel} />
              <MetricRow label="Suggested dollars" value={formatCurrency(side.position.suggestedDollars, precision)} />
              <MetricRow label="Suggested contracts" value={formatNumber(side.position.suggestedContracts, 0)} />
              <MetricRow label="Raw contracts" value={formatNumber(side.position.suggestedContractsRaw, precision)} />
              <MetricRow label="Max loss" value={formatCurrency(side.position.maxLossDollars, precision)} />
              <MetricRow label="Max win" value={formatCurrency(side.position.maxWinDollars, precision)} />
            </div>
          </div>

          {pricingMode === 'quote' && (
            <div className="subpanel">
              <div className="subpanel-header">
                <h3>Bid / ask / midpoint</h3>
              </div>
              <div className="metrics-grid">
                <MetricRow label="Bid" value={side.pricingReference.bid !== null ? `${formatNumber(side.pricingReference.bid, precision)}¢` : '--'} />
                <MetricRow label="Ask" value={side.pricingReference.ask !== null ? `${formatNumber(side.pricingReference.ask, precision)}¢` : '--'} />
                <MetricRow label="Midpoint" value={side.pricingReference.midpoint !== null ? `${formatNumber(side.pricingReference.midpoint, precision)}¢` : '--'} />
                <MetricRow label="Spread cost" value={side.pricingReference.spread !== null ? `${formatNumber(side.pricingReference.spread, precision)}¢` : '--'} />
                <MetricRow label="EV if buying ask" value={formatSignedCents(side.netEv, precision)} />
                <MetricRow label="EV at bid reference" value={side.pricingReference.bidReferenceEv !== null ? formatSignedCents(side.pricingReference.bidReferenceEv, precision) : '--'} />
                <MetricRow label="EV at midpoint" value={side.pricingReference.midpointEv !== null ? formatSignedCents(side.pricingReference.midpointEv, precision) : '--'} />
              </div>
            </div>
          )}

          <div className="subpanel">
            <div className="subpanel-header">
              <h3>Target entry prices</h3>
            </div>
            <DataTable
              headers={['Target', 'Price']}
              rows={[
                ['Max worth paying', `${formatNumber(side.entryTargets.maxWorthPaying, precision)}¢`],
                ['Price for 0 EV', `${formatNumber(side.entryTargets.zeroEvPrice, precision)}¢`],
                ['Price for 5% ROI', `${formatNumber(side.entryTargets.roi5Price, precision)}¢`],
                ['Price for 10% ROI', `${formatNumber(side.entryTargets.roi10Price, precision)}¢`],
                ['Price for 20% ROI', `${formatNumber(side.entryTargets.roi20Price, precision)}¢`],
              ]}
            />
          </div>

          <div className="subpanel">
            <div className="subpanel-header">
              <h3>Fair value ladder</h3>
            </div>
            <DataTable
              headers={['Scenario', 'Fair', 'Net EV', 'Net edge']}
              rows={side.scenarioRows.map((row) => [
                row.label,
                formatPercentFromFraction(row.fairProbability, precision),
                formatSignedCents(row.netEv, precision),
                formatSignedCents(row.edge, precision),
              ])}
            />
          </div>

          <div className="subpanel">
            <div className="subpanel-header">
              <h3>Slippage panel</h3>
            </div>
            <DataTable
              headers={['Fill', 'Price', 'Net EV', 'ROI']}
              rows={side.slippageRows.map((row) => [
                row.label,
                `${formatNumber(row.price, precision)}¢`,
                formatSignedCents(row.netEv, precision),
                formatPercent(row.roiOnRisk * 100, precision),
              ])}
            />
          </div>
        </div>
      )}
    </section>
  );
}

export default function HomePage() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);
  const [copied, setCopied] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const next = parseInputsFromUrl(window.location.search);
    setInputs(next);
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !hydratedRef.current) {
      return;
    }

    const query = serializeInputsToUrl(inputs);
    const nextUrl = `${window.location.pathname}?${query}`;
    window.history.replaceState(null, '', nextUrl);
  }, [inputs]);

  const state = useMemo(() => calculate(inputs), [inputs]);

  function updateField<K extends keyof Inputs>(key: K, value: Inputs[K]) {
    setInputs((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetDefaults() {
    setInputs(DEFAULT_INPUTS);
  }

  async function copyShareLink() {
    if (typeof window === 'undefined') {
      return;
    }

    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="page-shell">
      <div className="page-frame">
        <header className="hero">
          <div>
            <p className="eyebrow">Open-source utility by Lurk</p>
            <h1>PolyCalc</h1>
            <p className="hero-copy">Price. Edge. EV. Kelly. Entry targets. Slippage. Pass.</p>
          </div>
          <div className="hero-actions">
            <Link className="secondary-button" href="https://github.com/Lurk-AI-INC/polycalc" target="_blank">
              Contribute
            </Link>
            <Link className="secondary-button" href="https://lurk-ai.com" target="_blank">
              Lurk
            </Link>
          </div>
        </header>

        <section className="panel input-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Inputs</p>
              <h2>Advanced contract assumptions</h2>
            </div>
            <div className="header-controls">
              <button className="secondary-button" type="button" onClick={copyShareLink}>
                {copied ? 'Copied link' : 'Copy share link'}
              </button>
              <button className="secondary-button" type="button" onClick={resetDefaults}>
                Reset example
              </button>
            </div>
          </div>

          <div className="stack-lg">
            <div className="input-grid">
              <label>
                <span>Pricing mode</span>
                <select value={inputs.pricingMode} onChange={(event) => updateField('pricingMode', event.target.value as PricingMode)}>
                  <option value="single">Single price</option>
                  <option value="quote">Bid / ask mode</option>
                </select>
              </label>

              <label>
                <span>Fee mode</span>
                <select value={inputs.feeMode} onChange={(event) => updateField('feeMode', event.target.value as FeeMode)}>
                  <option value="no-fee">No fee</option>
                  <option value="polymarket">Polymarket-style</option>
                  <option value="kalshi">Kalshi-style</option>
                  <option value="custom">Custom</option>
                </select>
              </label>

              <label>
                <span>Sizing mode</span>
                <select value={inputs.sizingMode} onChange={(event) => updateField('sizingMode', event.target.value as SizingMode)}>
                  <option value="full-kelly">Full Kelly</option>
                  <option value="half-kelly">Half Kelly</option>
                  <option value="quarter-kelly">Quarter Kelly</option>
                  <option value="fixed-dollar">Fixed dollar size</option>
                  <option value="fixed-max-loss">Fixed max loss</option>
                  <option value="fixed-bankroll-risk">Fixed % bankroll risk</option>
                </select>
              </label>

              <label>
                <span>Fair YES probability (%)</span>
                <input inputMode="decimal" value={inputs.fairYesProbability} onChange={(event) => updateField('fairYesProbability', event.target.value)} />
              </label>

              <label>
                <span>Bankroll ($)</span>
                <input inputMode="decimal" value={inputs.bankroll} onChange={(event) => updateField('bankroll', event.target.value)} />
              </label>

              <label>
                <span>Kelly cap (%)</span>
                <input inputMode="decimal" value={inputs.kellyCapPercent} onChange={(event) => updateField('kellyCapPercent', event.target.value)} />
              </label>

              {inputs.pricingMode === 'single' ? (
                <>
                  <label>
                    <span>YES buy price (¢)</span>
                    <input inputMode="decimal" value={inputs.yesPrice} onChange={(event) => updateField('yesPrice', event.target.value)} />
                  </label>
                  <label>
                    <span>NO buy price (¢)</span>
                    <input inputMode="decimal" value={inputs.noPrice} onChange={(event) => updateField('noPrice', event.target.value)} />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    <span>YES bid (¢)</span>
                    <input inputMode="decimal" value={inputs.yesBid} onChange={(event) => updateField('yesBid', event.target.value)} />
                  </label>
                  <label>
                    <span>YES ask (¢)</span>
                    <input inputMode="decimal" value={inputs.yesAsk} onChange={(event) => updateField('yesAsk', event.target.value)} />
                  </label>
                  <label>
                    <span>NO bid (¢)</span>
                    <input inputMode="decimal" value={inputs.noBid} onChange={(event) => updateField('noBid', event.target.value)} />
                  </label>
                  <label>
                    <span>NO ask (¢)</span>
                    <input inputMode="decimal" value={inputs.noAsk} onChange={(event) => updateField('noAsk', event.target.value)} />
                  </label>
                </>
              )}

              <label>
                <span>Custom fee (¢)</span>
                <input inputMode="decimal" value={inputs.fee} onChange={(event) => updateField('fee', event.target.value)} />
              </label>

              <label>
                <span>Fixed dollar size ($)</span>
                <input inputMode="decimal" value={inputs.fixedDollarSize} onChange={(event) => updateField('fixedDollarSize', event.target.value)} />
              </label>

              <label>
                <span>Fixed max loss ($)</span>
                <input inputMode="decimal" value={inputs.fixedMaxLoss} onChange={(event) => updateField('fixedMaxLoss', event.target.value)} />
              </label>

              <label>
                <span>Fixed bankroll risk (%)</span>
                <input inputMode="decimal" value={inputs.fixedBankrollRiskPercent} onChange={(event) => updateField('fixedBankrollRiskPercent', event.target.value)} />
              </label>

              <label>
                <span>Reverse calc target EV (¢)</span>
                <input inputMode="decimal" value={inputs.reverseDesiredEv} onChange={(event) => updateField('reverseDesiredEv', event.target.value)} />
              </label>

              <label>
                <span>Reverse calc target ROI (%)</span>
                <input inputMode="decimal" value={inputs.reverseDesiredRoi} onChange={(event) => updateField('reverseDesiredRoi', event.target.value)} />
              </label>
            </div>

            <div className="toolbar">
              <div className="precision-group" role="group" aria-label="Precision">
                <span className="precision-label">Precision</span>
                <button type="button" className={inputs.precision === 2 ? 'precision-button active' : 'precision-button'} onClick={() => updateField('precision', 2)}>
                  2 decimals
                </button>
                <button type="button" className={inputs.precision === 4 ? 'precision-button active' : 'precision-button'} onClick={() => updateField('precision', 4)}>
                  4 decimals
                </button>
              </div>
              <div className="toolbar-note">
                Polymarket-style uses a 4% fee curve default. Kalshi-style uses the published taker curve rounded to the next cent for 1 contract.
              </div>
            </div>

            {state.errors.length > 0 ? (
              <div className="error-box" aria-live="polite">
                {state.errors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            ) : (
              <div className="recommendation-strip" aria-live="polite">
                <div>
                  <span className="eyebrow">Recommendation</span>
                  <div className="recommendation-main">{state.recommendationLabel}</div>
                </div>
                <div className="recommendation-meta">
                  <span>Compare YES vs NO vs pass with one clear action.</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="panel reverse-panel">
          <div className="subpanel-header">
            <div>
              <p className="eyebrow">Reverse calculator</p>
              <h2>Highest price you can pay</h2>
            </div>
          </div>
          {state.reverse ? (
            <DataTable
              headers={['Constraint', 'YES max', 'NO max']}
              rows={[
                ['Target EV', `${formatNumber(state.reverse.yesMaxForEv, inputs.precision)}¢`, `${formatNumber(state.reverse.noMaxForEv, inputs.precision)}¢`],
                [`Target ROI ${formatPercent(state.reverse.targetRoiFraction * 100, inputs.precision)}`, `${formatNumber(state.reverse.yesMaxForRoi, inputs.precision)}¢`, `${formatNumber(state.reverse.noMaxForRoi, inputs.precision)}¢`],
              ]}
            />
          ) : (
            <div className="empty-state">Reverse calculator appears when inputs validate.</div>
          )}
        </section>

        <section className="results-grid">
          <ResultCard
            side={state.yes}
            bestSide={state.bestSide}
            recommendation={state.recommendation}
            precision={inputs.precision}
            pricingMode={inputs.pricingMode}
          />
          <ResultCard
            side={state.no}
            bestSide={state.bestSide}
            recommendation={state.recommendation}
            precision={inputs.precision}
            pricingMode={inputs.pricingMode}
          />
        </section>

        <footer className="footer-note">
          Generic binary contract math. User-supplied fair value. URL state is shareable.
        </footer>
      </div>
    </main>
  );
}

