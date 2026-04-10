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
    params.set(key, String(inputs[key]));
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
          {rows.map((row, rowIndex) => (
            <tr key={`${row[0]}-${rowIndex}`}>
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

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input inputMode="decimal" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SectionFrame({
  eyebrow,
  title,
  description,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="section-frame panel-surface">
      <div className="section-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {description ? <p className="section-copy">{description}</p> : null}
        </div>
        {actions ? <div className="section-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
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
  const highlighted = bestSide === side.side && recommendation !== 'pass';

  return (
    <section className={`result-card panel-surface ${highlighted ? 'result-card-best' : ''}`}>
      <div className="result-card-header">
        <div>
          <p className="eyebrow">Outcome</p>
          <h2>{side.label}</h2>
        </div>
        <span className={verdict.className}>{verdict.label}</span>
      </div>

      {!side.isAvailable ? (
        <div className="empty-state">Enter a valid price for this side to run the full stack of EV, sizing, target-entry, and slippage math.</div>
      ) : (
        <div className="stack-xl">
          <div className="subpanel surface-soft">
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

          <div className="subpanel surface-soft">
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

          {pricingMode === 'quote' ? (
            <div className="subpanel surface-soft">
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
          ) : null}

          <div className="subpanel surface-soft">
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

          <div className="subpanel surface-soft">
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

          <div className="subpanel surface-soft">
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
    window.history.replaceState(null, '', `${window.location.pathname}?${query}`);
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
        <div className="topbar panel-surface">
          <div className="brand-lockup">

            <div>
              <p className="eyebrow">Open-source market toolkit by Lurk</p>
              <div className="brand-line">
                <strong>PolyCore / Calculator</strong>
                <span>Analyze a live binary contract</span>
              </div>
            </div>
          </div>
          <div className="topbar-actions">
            <Link className="secondary-button" href="/">Overview</Link>
            <Link className="secondary-button" href="/watchlist">Watchlist</Link>
            <Link className="secondary-button" href="/monitor">Monitor</Link>
          </div>
        </div>

        <header className="hero panel-surface">
          <div className="hero-copy-wrap">
            <p className="eyebrow">Calculator module</p>
            <h1>Price the trade before you touch it.</h1>
            <p className="hero-copy">
              Target entry, reverse pricing, slippage, sizing, and pass discipline inside PolyCore.
            </p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={copyShareLink}>
                {copied ? 'Share link copied' : 'Copy share link'}
              </button>
              <button className="secondary-button" type="button" onClick={resetDefaults}>
                Reset example
              </button>
            </div>
          </div>

          <div className="hero-rail">
            <InfoChip label="Recommendation" value={state.recommendationLabel} />
            <InfoChip label="Pricing" value={inputs.pricingMode === 'quote' ? 'Bid / ask mode' : 'Single price'} />
            <InfoChip
              label="Fee mode"
              value={
                inputs.feeMode === 'no-fee'
                  ? 'No fee'
                  : inputs.feeMode === 'polymarket'
                    ? 'Polymarket-style'
                    : inputs.feeMode === 'kalshi'
                      ? 'Kalshi-style'
                      : 'Custom'
              }
            />
            <InfoChip
              label="Sizing"
              value={
                inputs.sizingMode === 'full-kelly'
                  ? 'Full Kelly'
                  : inputs.sizingMode === 'half-kelly'
                    ? 'Half Kelly'
                    : inputs.sizingMode === 'quarter-kelly'
                      ? 'Quarter Kelly'
                      : inputs.sizingMode === 'fixed-dollar'
                        ? 'Fixed dollars'
                        : inputs.sizingMode === 'fixed-max-loss'
                          ? 'Fixed max loss'
                          : 'Fixed bankroll risk'
              }
            />
          </div>
        </header>

        {state.errors.length > 0 ? (
          <div className="error-box" aria-live="polite">
            {state.errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : (
          <div className="recommendation-strip panel-surface" aria-live="polite">
            <div>
              <p className="eyebrow">Live recommendation</p>
              <div className="recommendation-main">{state.recommendationLabel}</div>
            </div>
            <div className="recommendation-meta">
              YES vs NO vs pass, with watchlist handoff, shareable state, and venue-aware fee presets.
            </div>
          </div>
        )}

        <div className="controls-layout">
          <SectionFrame
            eyebrow="Configuration"
            title="Market setup"
            description="Set pricing mode, venue-style fees, bankroll context, and fair value assumptions."
          >
            <div className="control-grid control-grid-3">
              <SelectField label="Pricing mode" value={inputs.pricingMode} onChange={(value) => updateField('pricingMode', value as PricingMode)}>
                <option value="single">Single price</option>
                <option value="quote">Bid / ask mode</option>
              </SelectField>

              <SelectField label="Fee mode" value={inputs.feeMode} onChange={(value) => updateField('feeMode', value as FeeMode)}>
                <option value="no-fee">No fee</option>
                <option value="polymarket">Polymarket-style</option>
                <option value="kalshi">Kalshi-style</option>
                <option value="custom">Custom</option>
              </SelectField>

              <SelectField label="Sizing mode" value={inputs.sizingMode} onChange={(value) => updateField('sizingMode', value as SizingMode)}>
                <option value="full-kelly">Full Kelly</option>
                <option value="half-kelly">Half Kelly</option>
                <option value="quarter-kelly">Quarter Kelly</option>
                <option value="fixed-dollar">Fixed dollar size</option>
                <option value="fixed-max-loss">Fixed max loss</option>
                <option value="fixed-bankroll-risk">Fixed % bankroll risk</option>
              </SelectField>

              <InputField label="Fair YES probability (%)" value={inputs.fairYesProbability} onChange={(value) => updateField('fairYesProbability', value)} />
              <InputField label="Bankroll ($)" value={inputs.bankroll} onChange={(value) => updateField('bankroll', value)} />
              <InputField label="Kelly cap (%)" value={inputs.kellyCapPercent} onChange={(value) => updateField('kellyCapPercent', value)} />
              <InputField label="Custom fee (¢)" value={inputs.fee} onChange={(value) => updateField('fee', value)} />
              <InputField label="Fixed dollar size ($)" value={inputs.fixedDollarSize} onChange={(value) => updateField('fixedDollarSize', value)} />
              <InputField label="Fixed max loss ($)" value={inputs.fixedMaxLoss} onChange={(value) => updateField('fixedMaxLoss', value)} />
              <InputField label="Fixed bankroll risk (%)" value={inputs.fixedBankrollRiskPercent} onChange={(value) => updateField('fixedBankrollRiskPercent', value)} />
              <InputField label="Reverse target EV (¢)" value={inputs.reverseDesiredEv} onChange={(value) => updateField('reverseDesiredEv', value)} />
              <InputField label="Reverse target ROI (%)" value={inputs.reverseDesiredRoi} onChange={(value) => updateField('reverseDesiredRoi', value)} />
            </div>
          </SectionFrame>

          <div className="controls-stack">
            <SectionFrame
              eyebrow="Pricing"
              title={inputs.pricingMode === 'quote' ? 'Bid / ask inputs' : 'Single-price entries'}
              description={
                inputs.pricingMode === 'quote'
                  ? 'Use live bid / ask quotes and let the app judge fills with spread-aware references.'
                  : 'Use direct entry prices when you already know the exact YES / NO fill you want to evaluate.'
              }
              actions={
                <div className="precision-group" role="group" aria-label="Precision">
                  <span className="precision-label">Precision</span>
                  <button type="button" className={inputs.precision === 2 ? 'precision-button active' : 'precision-button'} onClick={() => updateField('precision', 2)}>
                    2 decimals
                  </button>
                  <button type="button" className={inputs.precision === 4 ? 'precision-button active' : 'precision-button'} onClick={() => updateField('precision', 4)}>
                    4 decimals
                  </button>
                </div>
              }
            >
              {inputs.pricingMode === 'single' ? (
                <div className="control-grid control-grid-2">
                  <InputField label="YES buy price (¢)" value={inputs.yesPrice} onChange={(value) => updateField('yesPrice', value)} />
                  <InputField label="NO buy price (¢)" value={inputs.noPrice} onChange={(value) => updateField('noPrice', value)} />
                </div>
              ) : (
                <div className="control-grid control-grid-2">
                  <InputField label="YES bid (¢)" value={inputs.yesBid} onChange={(value) => updateField('yesBid', value)} />
                  <InputField label="YES ask (¢)" value={inputs.yesAsk} onChange={(value) => updateField('yesAsk', value)} />
                  <InputField label="NO bid (¢)" value={inputs.noBid} onChange={(value) => updateField('noBid', value)} />
                  <InputField label="NO ask (¢)" value={inputs.noAsk} onChange={(value) => updateField('noAsk', value)} />
                </div>
              )}
            </SectionFrame>

            <SectionFrame
              eyebrow="Reverse calculator"
              title="Highest price you can pay"
              description="Work backward from target EV and target ROI to get a maximum acceptable entry on both sides."
            >
              {state.reverse ? (
                <DataTable
                  headers={['Constraint', 'YES max', 'NO max']}
                  rows={[
                    ['Target EV', `${formatNumber(state.reverse.yesMaxForEv, inputs.precision)}¢`, `${formatNumber(state.reverse.noMaxForEv, inputs.precision)}¢`],
                    [
                      `Target ROI ${formatPercent(state.reverse.targetRoiFraction * 100, inputs.precision)}`,
                      `${formatNumber(state.reverse.yesMaxForRoi, inputs.precision)}¢`,
                      `${formatNumber(state.reverse.noMaxForRoi, inputs.precision)}¢`,
                    ],
                  ]}
                />
              ) : (
                <div className="empty-state">Reverse calculator appears once the current inputs validate.</div>
              )}
            </SectionFrame>
          </div>
        </div>

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

        <footer className="footer panel-surface">
          <div className="footer-main">
            <div>
              <p className="eyebrow">PolyCalc</p>
              <h2>Calculator module inside the PolyCore toolkit by Lurk.</h2>
              <p className="section-copy footer-copy">
                Live contract math, shareable state, venue-aware fee presets, and clean handoff from watchlist or monitor.
              </p>
            </div>
            <div className="footer-links">
              <Link href="/">Overview</Link>
              <Link href="/watchlist">Watchlist</Link>
              <Link href="/monitor">Monitor</Link>
              <button className="footer-link-button" type="button" onClick={copyShareLink}>
                {copied ? 'Copied' : 'Copy share link'}
              </button>
            </div>
          </div>
          <div className="footer-meta">
            <span>Generic binary contract math.</span>
            <span>User-supplied fair value.</span>
            <span>URL state is shareable.</span>
          </div>
        </footer>
      </div>
    </main>
  );
}


