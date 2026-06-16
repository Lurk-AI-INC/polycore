from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from .analytics import summarize_timeline_dir
from .diffing import diff_snapshots
from .io_utils import append_market_timelines, dump_json, load_rules, load_snapshot, load_watchlist_tickers, write_markets_csv, write_snapshot_json
from .market_data import fetch_markets
from .rules_engine import scan_rules


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog='polycore-py', description='Python companion utilities for PolyCore.')
    subparsers = parser.add_subparsers(dest='command', required=True)

    snapshot = subparsers.add_parser('snapshot', help='Fetch markets and write a snapshot file.')
    _add_market_source_args(snapshot)
    snapshot.add_argument('--out', default='data/snapshots/latest.json', help='Snapshot JSON output path.')
    snapshot.add_argument('--csv', default='', help='Optional CSV output path.')

    timeline = subparsers.add_parser('timeline', help='Fetch markets and append one jsonl line per ticker.')
    _add_market_source_args(timeline)
    timeline.add_argument('--dir', default='data/timelines', help='Directory for per-ticker jsonl files.')
    timeline.add_argument('--snapshot-out', default='', help='Optional JSON snapshot output path.')

    scan = subparsers.add_parser('scan', help='Evaluate PolyCore rules against current markets.')
    scan.add_argument('--file', required=True, help='Rules file path.')
    scan.add_argument('--watchlist', default='', help='Optional watchlist file. If omitted, tickers come from rules.')
    scan.add_argument('--tickers', default='', help='Comma-separated tickers to override watchlist/rule tickers.')
    scan.add_argument('--demo', action='store_true', help='Force demo markets.')
    scan.add_argument('--json', action='store_true', help='Emit JSON to stdout.')
    scan.add_argument('--out', default='', help='Optional JSON report path.')
    scan.add_argument('--alerts-out', default='', help='Optional triggered-events JSON output path.')

    analyze = subparsers.add_parser('analyze', help='Descriptive (backward-looking) stats over timeline files. Never forecasts.')
    analyze.add_argument('--dir', default='data/timelines', help='Directory of per-ticker jsonl timeline files.')
    analyze.add_argument('--tickers', default='', help='Comma-separated subset of tickers to summarize.')
    analyze.add_argument('--json', action='store_true', help='Emit JSON to stdout.')
    analyze.add_argument('--out', default='', help='Optional JSON report path.')

    diff = subparsers.add_parser('diff', help='Compare two snapshot JSON files.')
    diff.add_argument('--left', required=True, help='Earlier snapshot path.')
    diff.add_argument('--right', required=True, help='Later snapshot path.')
    diff.add_argument('--json', action='store_true', help='Emit JSON to stdout.')
    diff.add_argument('--out', default='', help='Optional JSON diff output path.')

    return parser


def _add_market_source_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument('--file', default='', help='Watchlist file path.')
    parser.add_argument('--tickers', default='', help='Comma-separated tickers to override watchlist file.')
    parser.add_argument('--demo', action='store_true', help='Force demo markets.')


def _parse_tickers_arg(value: str) -> list[str]:
    seen: set[str] = set()
    tickers: list[str] = []
    for raw in value.split(','):
        ticker = raw.strip().upper()
        if ticker and ticker not in seen:
            tickers.append(ticker)
            seen.add(ticker)
    return tickers


def _resolve_tickers(file_path: str, tickers_arg: str) -> list[str]:
    if tickers_arg.strip():
        return _parse_tickers_arg(tickers_arg)
    if file_path:
        return load_watchlist_tickers(file_path)
    return []


def _emit_json(payload: Any) -> None:
    print(json.dumps(payload, indent=2))


def _print_snapshot(snapshot_payload: dict[str, Any]) -> None:
    print(f"Snapshot {snapshot_payload['capturedAt']} | source {snapshot_payload['source']} | markets {len(snapshot_payload['markets'])}")
    if snapshot_payload.get('warning'):
        print(f"Warning: {snapshot_payload['warning']}")
    print('')
    for market in snapshot_payload['markets']:
        print(
            f"{market['ticker']:<20} {market['status']:<8} "
            f"YB {str(market['yes_bid_cents']):>4}  YA {str(market['yes_ask_cents']):>4}  "
            f"SP {str(market['yes_spread_cents']):>4}  LAST {str(market['last_price_cents']):>4}  "
            f"LEFT {market['time_to_close_label']}"
        )


def _print_scan(payload: dict[str, Any]) -> None:
    print(f"Scanned {payload['ruleCount']} rules across {payload['marketCount']} markets | triggered {payload['triggeredCount']}")
    print('')
    for row in payload['rules']:
        rule = row['rule']
        status = 'TRIGGERED' if row['triggered'] else 'idle'
        print(f"[{status:<9}] {rule['ticker']:<20} {rule['name']:<28} {row['message'] or '-'}")


def _fmt_opt(value: Any, suffix: str = '') -> str:
    if value is None:
        return '--'
    if isinstance(value, float):
        text = f'{value:.2f}'.rstrip('0').rstrip('.')
        return f'{text}{suffix}'
    return f'{value}{suffix}'


def _print_analyze(payload: dict[str, Any]) -> None:
    summaries = payload['timelines']
    print(f"Analyzed {len(summaries)} timeline(s) | descriptive only, no forecasts")
    print('')
    for row in summaries:
        move = row['realizedMoveCents']
        move_text = '--' if move is None else (f'+{move:g}' if move >= 0 else f'{move:g}')
        print(
            f"{row['ticker']:<20} n={row['samples']:<4} "
            f"last {_fmt_opt(row['lastPriceCents'], '¢'):>6}  "
            f"range {_fmt_opt(row['minPriceCents'], '¢')}-{_fmt_opt(row['maxPriceCents'], '¢')}  "
            f"move {move_text:>6}  twap {_fmt_opt(row['twapCents'], '¢'):>7}  "
            f"spread~{_fmt_opt(row['meanSpreadCents'], '¢')}  vol {row['volumeTrend']}"
        )
        for warning in row.get('warnings', []):
            print(f"    note: {warning}")


def _print_diff(payload: dict[str, Any]) -> None:
    print(
        f"Diff {payload['leftCapturedAt']} -> {payload['rightCapturedAt']} | "
        f"changed {payload['changedCount']} | added {len(payload['added'])} | removed {len(payload['removed'])}"
    )
    print('')
    for ticker in payload['added']:
        print(f"[ADDED]   {ticker}")
    for ticker in payload['removed']:
        print(f"[REMOVED] {ticker}")
    for row in payload['changed']:
        summaries = ', '.join(f"{key}: {change['before']} -> {change['after']}" for key, change in row['changes'].items())
        print(f"[CHANGED] {row['ticker']:<20} {summaries}")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == 'snapshot':
        tickers = _resolve_tickers(args.file, args.tickers)
        snapshot = fetch_markets(tickers, demo=args.demo)
        payload = snapshot.to_dict()
        write_snapshot_json(args.out, snapshot)
        if args.csv:
            write_markets_csv(args.csv, snapshot.markets)
        _print_snapshot(payload)
        return 0

    if args.command == 'timeline':
        tickers = _resolve_tickers(args.file, args.tickers)
        snapshot = fetch_markets(tickers, demo=args.demo)
        touched = append_market_timelines(args.dir, snapshot)
        if args.snapshot_out:
            write_snapshot_json(args.snapshot_out, snapshot)
        print(f"Appended {len(touched)} timeline files from snapshot {snapshot.captured_at}.")
        for path in touched:
            print(path)
        return 0

    if args.command == 'scan':
        rules = load_rules(args.file)
        tickers = _parse_tickers_arg(args.tickers) if args.tickers.strip() else load_watchlist_tickers(args.watchlist) if args.watchlist else sorted({rule.ticker for rule in rules})
        snapshot = fetch_markets(tickers, demo=args.demo)
        payload = scan_rules(rules, snapshot.markets)
        payload['snapshot'] = snapshot.to_dict()
        if args.out:
            dump_json(args.out, payload)
        if args.alerts_out:
            dump_json(args.alerts_out, payload['events'])
        if args.json:
            _emit_json(payload)
        else:
            _print_scan(payload)
        return 0

    if args.command == 'analyze':
        tickers = _parse_tickers_arg(args.tickers) if args.tickers.strip() else None
        summaries = summarize_timeline_dir(args.dir, tickers=tickers)
        payload = {
            'descriptiveOnly': True,
            'directory': args.dir,
            'timelineCount': len(summaries),
            'timelines': [item.to_dict() for item in summaries],
        }
        if args.out:
            dump_json(args.out, payload)
        if args.json:
            _emit_json(payload)
        else:
            _print_analyze(payload)
        return 0

    if args.command == 'diff':
        right = load_snapshot(args.right)
        payload = diff_snapshots(left, right)
        if args.out:
            dump_json(args.out, payload)
        if args.json:
            _emit_json(payload)
        else:
            _print_diff(payload)
        return 0

    parser.error(f'Unsupported command: {args.command}')
    return 2
