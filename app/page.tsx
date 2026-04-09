'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  calculate,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatPercentFromFraction,
  type Inputs,
  type SideResult,
} from '@/lib/calculator';
import {redirect} from "next/navigation";

const DEFAULT_INPUTS: Inputs = {
  yesPrice: '54',
  noPrice: '48',
  fairYesProbability: '61',
  bankroll: '1000',
  fee: '1',
  kellyCapPercent: '25',
  precision: 2,
};

type InputKey = keyof Inputs;

type MetricRowProps = {
  label: string;
  value: string;
};

function MetricRow({ label, value }: MetricRowProps) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getVerdict(side: SideResult, bestSide: 'yes' | 'no' | null, bothNegative: boolean) {
  if (!side.isAvailable) {
    return {
      label: 'Awaiting input',
      className: 'badge badge-muted',
    };
  }

  if (bothNegative) {
    return {
      label: 'No edge',
      className: 'badge badge-negative',
    };
  }

  if (bestSide === side.side && side.netEv > 0) {
    return {
      label: 'Best of the two',
      className: 'badge badge-best',
    };
  }

  if (side.netEv > 0) {
    return {
      label: 'Positive EV',
      className: 'badge badge-positive',
    };
  }

  return {
    label: 'Negative EV',
    className: 'badge badge-negative',
  };
}

function ResultCard({
  side,
  bestSide,
  bothNegative,
  precision,
}: {
  side: SideResult;
  bestSide: 'yes' | 'no' | null;
  bothNegative: boolean;
  precision: number;
}) {
  const verdict = getVerdict(side, bestSide, bothNegative);

  return (
    <section className={`result-card ${bestSide === side.side && side.netEv > 0 ? 'result-card-best' : ''}`}>
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
        <div className="metrics-grid">
          <MetricRow label="Market price" value={`${formatNumber(side.price, precision)}¢`} />
          <MetricRow
            label="Break-even probability"
            value={formatPercentFromFraction(side.breakEvenProbability, precision)}
          />
          <MetricRow
            label="User fair probability"
            value={formatPercentFromFraction(side.fairProbability, precision)}
          />
          <MetricRow label="Gross edge" value={`${formatNumber(side.grossEdge, precision)}¢`} />
          <MetricRow label="Net edge after fee" value={`${formatNumber(side.netEdge, precision)}¢`} />
          <MetricRow label="Gross EV / contract" value={`${formatNumber(side.grossEv, precision)}¢`} />
          <MetricRow label="Net EV / contract" value={`${formatNumber(side.netEv, precision)}¢`} />
          <MetricRow label="ROI on risk" value={formatPercent(side.roiOnRisk * 100, precision)} />
          <MetricRow
            label="Full Kelly fraction"
            value={formatPercentFromFraction(side.fullKellyFraction, precision)}
          />
          <MetricRow
            label="Capped Kelly fraction"
            value={formatPercentFromFraction(side.cappedKellyFraction, precision)}
          />
          <MetricRow label="Suggested size" value={formatCurrency(side.suggestedSize, precision)} />
          <MetricRow label="Risk per contract" value={`${formatNumber(side.risk, precision)}¢`} />
        </div>
      )}
    </section>
  );
}

export default function HomePage() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);

  const state = useMemo(() => calculate(inputs), [inputs]);

  function updateField(key: InputKey, value: string | number) {
    setInputs((current) => ({
      ...current,
      [key]: String(value),
    }));
  }

  function resetDefaults() {
    setInputs(DEFAULT_INPUTS);
  }

  return (
    <main className="page-shell">
      <div className="page-frame">
        <header className="hero">
          <div>
            <p className="eyebrow">Binary pricing utility</p>
            <h1>PolyCalc (v0.1)</h1>
            by
            <button className="lurk-cta" type="button" onClick={() => redirect('https://lurk-ai.com')}>
            Lurk
          </button>
          </div>

          <button className="header-button" type="button" onClick={() => redirect('https://github.com/Lurk-AI-INC/polycalc')}>
            Contribute
          </button>
        </header>

        <section className="panel input-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Inputs</p>
              <h2>Manual contract assumptions</h2>
            </div>
            <button className="secondary-button" type="button" onClick={resetDefaults}>
              Reset example
            </button>
          </div>

          <div className="input-grid">
            <label>
              <span>YES buy price (¢)</span>
              <input
                inputMode="decimal"
                value={inputs.yesPrice}
                onChange={(event) => updateField('yesPrice', event.target.value)}
                placeholder="54"
              />
            </label>

            <label>
              <span>NO buy price (¢)</span>
              <input
                inputMode="decimal"
                value={inputs.noPrice}
                onChange={(event) => updateField('noPrice', event.target.value)}
                placeholder="48"
              />
            </label>

            <label>
              <span>Fair YES probability (%)</span>
              <input
                inputMode="decimal"
                value={inputs.fairYesProbability}
                onChange={(event) => updateField('fairYesProbability', event.target.value)}
                placeholder="61"
              />
            </label>

            <label>
              <span>Bankroll ($)</span>
              <input
                inputMode="decimal"
                value={inputs.bankroll}
                onChange={(event) => updateField('bankroll', event.target.value)}
                placeholder="1000"
              />
            </label>

            <label>
              <span>Estimated fee per contract (¢)</span>
              <input
                inputMode="decimal"
                value={inputs.fee}
                onChange={(event) => updateField('fee', event.target.value)}
                placeholder="1"
              />
            </label>

            <label>
              <span>Kelly cap (%)</span>
              <input
                inputMode="decimal"
                value={inputs.kellyCapPercent}
                onChange={(event) => updateField('kellyCapPercent', event.target.value)}
                placeholder="25"
              />
            </label>
          </div>

          <div className="toolbar">
            <div className="precision-group" role="group" aria-label="Precision">
              <span className="precision-label">Precision</span>
              <button
                type="button"
                className={inputs.precision === 2 ? 'precision-button active' : 'precision-button'}
                onClick={() => setInputs((current) => ({ ...current, precision: 2 }))}
              >
                2 decimals
              </button>
              <button
                type="button"
                className={inputs.precision === 4 ? 'precision-button active' : 'precision-button'}
                onClick={() => setInputs((current) => ({ ...current, precision: 4 }))}
              >
                4 decimals
              </button>
            </div>

            {state.errors.length > 0 ? (
              <div className="error-box" aria-live="polite">
                {state.errors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            ) : (
              <div className="summary-strip" aria-live="polite">
                <span>
                  Best side:{' '}
                  <strong>
                    {state.bestSide === 'yes'
                      ? 'Buy YES'
                      : state.bestSide === 'no'
                        ? 'Buy NO'
                        : state.bothNegative
                          ? 'No edge'
                          : 'Waiting for valid inputs'}
                  </strong>
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="results-grid">
          <ResultCard
            side={state.yes}
            bestSide={state.bestSide}
            bothNegative={state.bothNegative}
            precision={inputs.precision}
          />
          <ResultCard
            side={state.no}
            bestSide={state.bestSide}
            bothNegative={state.bothNegative}
            precision={inputs.precision}
          />
        </section>

        <footer className="footer-note">
          Open source tool from <Link href="https://lurk-ai.com">Lurk</Link>. User-supplied fee assumptions.
        </footer>
      </div>
    </main>
  );
}

