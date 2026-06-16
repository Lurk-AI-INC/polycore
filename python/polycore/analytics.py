"""Descriptive analytics over per-ticker timeline files.

WHAT THIS IS
------------
A read-only, backward-looking summarizer of the jsonl timelines that the
``timeline`` command appends to ``data/timelines/<TICKER>.jsonl``. It answers
questions of the form "what *has* happened to this market's quotes while we
were watching it" -- price range, realized move, time-weighted average price,
spread behavior, volume trend, and how long the market spent in each status.

WHAT THIS IS NOT (the Lurk boundary)
------------------------------------
This module is deliberately *descriptive only*. It never produces a forecast,
a fair-value probability, a directional call, or any signal that says where a
price is going. Every number here is a statement about observed history, not a
prediction about the future. Producing a probability or an edge-bearing view
is Lurk's job; PolyCore only does mechanical arithmetic on data the user
already has. Keeping forecasting out of PolyCore is intentional, not an
oversight -- see docs/BOUNDARY.md.

The output of this module is a fine *input* to a human (or to Lurk): "the
market traded between 41 and 58 cents and is currently at the top of that
range" is a fact, not advice.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .formatting import parse_iso


@dataclass(slots=True)
class PricePoint:
    """One observation pulled from a timeline line."""

    captured_at: str
    status: str
    last_price_cents: int | None
    midpoint_cents: float | None
    yes_spread_cents: int | None
    volume24h: float | None


@dataclass(slots=True)
class TimelineStats:
    """Purely descriptive summary of a single ticker's observed history.

    All fields describe the past. Nothing here is a prediction.
    """

    ticker: str
    title: str
    samples: int
    first_captured_at: str | None
    last_captured_at: str | None
    observation_minutes: float | None
    # price (uses last_price when present, else midpoint) in cents
    first_price_cents: float | None
    last_price_cents: float | None
    min_price_cents: float | None
    max_price_cents: float | None
    mean_price_cents: float | None
    # realized_move = last - first (cents). Descriptive, signed.
    realized_move_cents: float | None
    # where the last price sits inside the observed [min,max] band, 0..1
    range_position: float | None
    twap_cents: float | None
    mean_spread_cents: float | None
    max_spread_cents: int | None
    first_volume24h: float | None
    last_volume24h: float | None
    volume_trend: str
    status_counts: dict[str, int] = field(default_factory=dict)
    current_status: str | None = None
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            'ticker': self.ticker,
            'title': self.title,
            'samples': self.samples,
            'firstCapturedAt': self.first_captured_at,
            'lastCapturedAt': self.last_captured_at,
            'observationMinutes': self.observation_minutes,
            'firstPriceCents': self.first_price_cents,
            'lastPriceCents': self.last_price_cents,
            'minPriceCents': self.min_price_cents,
            'maxPriceCents': self.max_price_cents,
            'meanPriceCents': self.mean_price_cents,
            'realizedMoveCents': self.realized_move_cents,
            'rangePosition': self.range_position,
            'twapCents': self.twap_cents,
            'meanSpreadCents': self.mean_spread_cents,
            'maxSpreadCents': self.max_spread_cents,
            'firstVolume24h': self.first_volume24h,
            'lastVolume24h': self.last_volume24h,
            'volumeTrend': self.volume_trend,
            'statusCounts': self.status_counts,
            'currentStatus': self.current_status,
            'descriptiveOnly': True,
            'warnings': self.warnings,
        }


def _effective_price(point: PricePoint) -> float | None:
    """Price used for stats: prefer last traded, fall back to midpoint."""
    if point.last_price_cents is not None:
        return float(point.last_price_cents)
    if point.midpoint_cents is not None:
        return float(point.midpoint_cents)
    return None


def read_timeline_points(path: str | Path) -> list[PricePoint]:
    """Parse one ``<TICKER>.jsonl`` file into ordered PricePoints.

    Lines that fail to parse are skipped rather than aborting the whole read;
    timelines are append-only logs and a single torn write should not poison
    the summary.
    """
    points: list[PricePoint] = []
    file_path = Path(path)
    if not file_path.exists():
        return points
    with file_path.open('r', encoding='utf-8') as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            market = row.get('market') or {}
            points.append(
                PricePoint(
                    captured_at=str(row.get('capturedAt') or market.get('updated_at') or ''),
                    status=str(market.get('status') or 'unknown'),
                    last_price_cents=_as_int(market.get('last_price_cents')),
                    midpoint_cents=_as_float(market.get('midpoint_cents')),
                    yes_spread_cents=_as_int(market.get('yes_spread_cents')),
                    volume24h=_as_float(market.get('volume24h')),
                )
            )
    points.sort(key=lambda p: p.captured_at)
    return points


def _as_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _twap(points: list[PricePoint]) -> float | None:
    """Time-weighted average price across the observation window.

    Each price is weighted by the gap until the next observation (a step
    function held forward). With only one usable point, TWAP is just that
    price. Purely a descriptive average of what was observed -- not a model.
    """
    priced = [(p, _effective_price(p)) for p in points]
    priced = [(p, v) for p, v in priced if v is not None]
    if not priced:
        return None
    if len(priced) == 1:
        return priced[0][1]

    total_weight = 0.0
    weighted_sum = 0.0
    for idx in range(len(priced)):
        point, value = priced[idx]
        start = parse_iso(point.captured_at)
        if idx < len(priced) - 1:
            nxt = parse_iso(priced[idx + 1][0].captured_at)
            if start is not None and nxt is not None:
                weight = max((nxt - start).total_seconds(), 0.0)
            else:
                weight = 0.0
        else:
            weight = 0.0
        if weight <= 0.0:
            # zero-length or unparseable gap: give it a nominal equal weight so
            # the point still counts rather than vanishing.
            weight = 1.0
        weighted_sum += value * weight
        total_weight += weight

    if total_weight <= 0.0:
        return None
    return weighted_sum / total_weight


def summarize_timeline(path: str | Path, *, ticker: str | None = None) -> TimelineStats:
    """Compute a descriptive summary of one ticker's timeline file."""
    file_path = Path(path)
    resolved_ticker = ticker or file_path.stem
    points = read_timeline_points(file_path)

    title = ''
    # title is per-line in the market dict; grab the most recent non-empty one
    if file_path.exists():
        with file_path.open('r', encoding='utf-8') as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                candidate = str((row.get('market') or {}).get('title') or '')
                if candidate:
                    title = candidate

    if not points:
        return TimelineStats(
            ticker=resolved_ticker,
            title=title,
            samples=0,
            first_captured_at=None,
            last_captured_at=None,
            observation_minutes=None,
            first_price_cents=None,
            last_price_cents=None,
            min_price_cents=None,
            max_price_cents=None,
            mean_price_cents=None,
            realized_move_cents=None,
            range_position=None,
            twap_cents=None,
            mean_spread_cents=None,
            max_spread_cents=None,
            first_volume24h=None,
            last_volume24h=None,
            volume_trend='unknown',
            status_counts={},
            current_status=None,
            warnings=['No observations found in timeline.'],
        )

    prices = [v for v in (_effective_price(p) for p in points) if v is not None]
    spreads = [p.yes_spread_cents for p in points if p.yes_spread_cents is not None]
    volumes = [p.volume24h for p in points if p.volume24h is not None]

    first_capture = points[0].captured_at or None
    last_capture = points[-1].captured_at or None
    observation_minutes: float | None = None
    start_dt = parse_iso(first_capture)
    end_dt = parse_iso(last_capture)
    if start_dt is not None and end_dt is not None:
        observation_minutes = max((end_dt - start_dt).total_seconds() / 60.0, 0.0)

    min_price = min(prices) if prices else None
    max_price = max(prices) if prices else None
    first_price = prices[0] if prices else None
    last_price = prices[-1] if prices else None
    mean_price = sum(prices) / len(prices) if prices else None
    realized_move = (last_price - first_price) if (first_price is not None and last_price is not None) else None

    range_position: float | None = None
    if last_price is not None and min_price is not None and max_price is not None:
        band = max_price - min_price
        range_position = 0.5 if band == 0 else (last_price - min_price) / band

    first_volume = volumes[0] if volumes else None
    last_volume = volumes[-1] if volumes else None
    if first_volume is None or last_volume is None:
        volume_trend = 'unknown'
    elif last_volume > first_volume:
        volume_trend = 'rising'
    elif last_volume < first_volume:
        volume_trend = 'falling'
    else:
        volume_trend = 'flat'

    status_counts: dict[str, int] = {}
    for point in points:
        status_counts[point.status] = status_counts.get(point.status, 0) + 1

    warnings: list[str] = []
    if len(points) < 2:
        warnings.append('Only one observation; trend and move are not meaningful yet.')
    if not prices:
        warnings.append('No priced observations; market may have had no quotes.')

    return TimelineStats(
        ticker=resolved_ticker,
        title=title,
        samples=len(points),
        first_captured_at=first_capture,
        last_captured_at=last_capture,
        observation_minutes=round(observation_minutes, 2) if observation_minutes is not None else None,
        first_price_cents=first_price,
        last_price_cents=last_price,
        min_price_cents=min_price,
        max_price_cents=max_price,
        mean_price_cents=round(mean_price, 4) if mean_price is not None else None,
        realized_move_cents=realized_move,
        range_position=round(range_position, 4) if range_position is not None else None,
        twap_cents=round(_twap(points), 4) if prices else None,
        mean_spread_cents=round(sum(spreads) / len(spreads), 4) if spreads else None,
        max_spread_cents=max(spreads) if spreads else None,
        first_volume24h=first_volume,
        last_volume24h=last_volume,
        volume_trend=volume_trend,
        status_counts=status_counts,
        current_status=points[-1].status,
        warnings=warnings,
    )


def summarize_timeline_dir(directory: str | Path, *, tickers: list[str] | None = None) -> list[TimelineStats]:
    """Summarize every ``*.jsonl`` in a timelines directory (or a subset)."""
    base = Path(directory)
    if not base.exists():
        return []
    wanted = {t.upper() for t in tickers} if tickers else None
    results: list[TimelineStats] = []
    for path in sorted(base.glob('*.jsonl')):
        if wanted is not None and path.stem.upper() not in wanted:
            continue
        results.append(summarize_timeline(path))
    return results
