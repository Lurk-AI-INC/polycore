"""Mechanical pricing math for binary (0-100c) markets.

BOUNDARY: this module computes the consequences of a fair-value probability the
USER supplies (EV, edge, fees, locks, position P&L). It never estimates or
forecasts a probability. Producing the number is out of scope by design -- that
is Lurk's job, not PolyCore's. See docs/BOUNDARY.md. Kept to the standard library.
"""
from __future__ import annotations

import math
from dataclasses import dataclass


VALID_FEE_MODES = {'kalshi', 'polymarket', 'no-fee', 'custom'}
VALID_FEE_ROLES = {'taker', 'maker'}


@dataclass(frozen=True, slots=True)
class FeeSchedule:
    id: str
    label: str
    coefficient: float          # 0 for free venues
    flat_cents: float | None    # flat per-contract fee instead of the parabola
    round_order_up_to_cent: bool


# Verified against 2026 venue fee schedules. Kalshi taker = 0.07 * p * (1-p),
# order total ceiled to the cent; maker ~25% of taker. Polymarket is free on
# most markets, with a 0.0625 fee-enabled subset -- so default Polymarket = free.
FEE_SCHEDULES: dict[str, FeeSchedule] = {
    'no-fee': FeeSchedule('no-fee', 'No fee', 0.0, None, False),
    'kalshi': FeeSchedule('kalshi', 'Kalshi taker', 0.07, None, True),
    'kalshi-maker': FeeSchedule('kalshi-maker', 'Kalshi maker', 0.0175, None, True),
    'polymarket': FeeSchedule('polymarket', 'Polymarket (free markets)', 0.0, None, False),
    'polymarket-fee': FeeSchedule('polymarket-fee', 'Polymarket (fee-enabled taker)', 0.0625, None, True),
}


def resolve_fee_schedule(fee_mode: str, role: str = 'taker') -> FeeSchedule:
    if fee_mode == 'no-fee':
        return FEE_SCHEDULES['no-fee']
    if fee_mode == 'custom':
        return FeeSchedule('custom', 'Custom flat fee', 0.0, 0.0, False)
    if fee_mode == 'polymarket':
        return FEE_SCHEDULES['polymarket']
    return FEE_SCHEDULES['kalshi-maker'] if role == 'maker' else FEE_SCHEDULES['kalshi']


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(max(value, minimum), maximum)


def fee_for_price_cents(price_cents: int | float, fee_mode: str, custom_fee_cents: float, role: str = 'taker') -> float:
    """Per-contract fee in cents, UNROUNDED (the venue rounds the order total)."""
    if fee_mode == 'no-fee':
        return 0.0
    if fee_mode == 'custom':
        return max(0.0, float(custom_fee_cents))
    schedule = resolve_fee_schedule(fee_mode, role)
    p = float(price_cents) / 100.0
    return schedule.coefficient * p * (1.0 - p) * 100.0


def order_fee_cents(price_cents: int | float, contracts: int | float, fee_mode: str, custom_fee_cents: float, role: str = 'taker') -> float:
    """Total fee in cents actually billed on an order of `contracts` at price."""
    n = max(0, int(math.floor(contracts)))
    if n == 0:
        return 0.0
    if fee_mode == 'no-fee':
        return 0.0
    if fee_mode == 'custom':
        return max(0.0, float(custom_fee_cents)) * n
    schedule = resolve_fee_schedule(fee_mode, role)
    p = float(price_cents) / 100.0
    raw = schedule.coefficient * p * (1.0 - p) * 100.0 * n
    return float(math.ceil(raw - 1e-9)) if schedule.round_order_up_to_cent else raw


def evaluate_side_net_ev(price_cents: int | None, fair_probability_pct: float, fee_mode: str, custom_fee_cents: float, role: str = 'taker') -> float | None:
    if price_cents is None:
        return None
    fair = clamp(fair_probability_pct / 100.0, 0.0, 1.0)
    fee = fee_for_price_cents(price_cents, fee_mode, custom_fee_cents, role)
    return (100.0 * fair) - float(price_cents) - fee


def detect_lock(yes_ask: int | None, no_ask: int | None, fee_mode: str = 'no-fee', custom_fee_cents: float = 0.0, role: str = 'taker') -> dict:
    """Order-book arbitrage check: buying YES+NO below the 100c payout is a lock."""
    if yes_ask is None or no_ask is None:
        return {'exists': False, 'yesAsk': yes_ask, 'noAsk': no_ask, 'combinedCostCents': None,
                'feesCents': 0.0, 'overroundCents': None, 'guaranteedProfitCentsPerPair': None, 'roiOnRisk': None}
    combined = yes_ask + no_ask
    fees = fee_for_price_cents(yes_ask, fee_mode, custom_fee_cents, role) + fee_for_price_cents(no_ask, fee_mode, custom_fee_cents, role)
    profit = 100.0 - combined - fees
    risk = combined + fees
    return {
        'exists': profit > 0,
        'yesAsk': yes_ask,
        'noAsk': no_ask,
        'combinedCostCents': combined,
        'feesCents': fees,
        'overroundCents': combined - 100.0,
        'guaranteedProfitCentsPerPair': profit,
        'roiOnRisk': (profit / risk) if risk > 0 else None,
    }


def evaluate_position(side: str, entry_price_cents: float, contracts: int | float, current_bid_cents: int | None,
                      fee_mode: str, custom_fee_cents: float, role: str = 'taker') -> dict:
    """Mark-to-market and settlement outcomes for an already-open position."""
    n = max(0, int(math.floor(contracts)))
    entry_fee = order_fee_cents(entry_price_cents, n, fee_mode, custom_fee_cents, role)
    cost_basis_cents = n * entry_price_cents + entry_fee

    mark_value = exit_fee = unrealized = unrealized_pct = None
    if current_bid_cents is not None:
        ef = order_fee_cents(current_bid_cents, n, fee_mode, custom_fee_cents, role)
        proceeds = n * current_bid_cents - ef
        mark_value = proceeds / 100.0
        exit_fee = ef / 100.0
        unrealized = (proceeds - cost_basis_cents) / 100.0
        unrealized_pct = ((proceeds - cost_basis_cents) / cost_basis_cents) if cost_basis_cents > 0 else None

    return {
        'side': side,
        'contracts': n,
        'costBasisDollars': cost_basis_cents / 100.0,
        'entryFeeDollars': entry_fee / 100.0,
        'markValueDollars': mark_value,
        'exitFeeDollars': exit_fee,
        'unrealizedDollars': unrealized,
        'unrealizedPercent': unrealized_pct,
        'settleWinDollars': (n * 100 - cost_basis_cents) / 100.0,
        'settleLoseDollars': (0 - cost_basis_cents) / 100.0,
        'breakevenExitCents': (cost_basis_cents / n) if n > 0 else 0.0,
    }
