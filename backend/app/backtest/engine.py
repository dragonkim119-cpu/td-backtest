from __future__ import annotations

import sqlite3
import threading
import time
from pathlib import Path

import numpy as np
import pandas as pd

from app.indicators.td_sequential import run as td_run
from app.models.schemas import BacktestResult, Candle, Signal

DB_PATH = Path(__file__).parent.parent.parent / "data" / "signals.db"


def _init_db(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS signals (
            id INTEGER PRIMARY KEY,
            symbol TEXT,
            interval TEXT,
            bar_time INTEGER,
            bar_index INTEGER,
            type TEXT,
            direction TEXT,
            entry_price REAL,
            perfected INTEGER,
            deferral INTEGER,
            deferral_8v5 INTEGER,
            risk_level REAL,
            tdst_level REAL,
            recycle_reason TEXT,
            cancel_reason TEXT,
            price_after_5 REAL,
            price_after_10 REAL,
            price_after_20 REAL,
            return_5 REAL,
            return_10 REAL,
            return_20 REAL,
            max_favorable_20 REAL,
            max_adverse_20 REAL,
            created_at INTEGER
        )
    """)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sib ON signals (symbol, interval, bar_time)"
    )
    conn.commit()


def _fill_returns(signals: list[Signal], df: pd.DataFrame) -> None:
    """Mutate signals to add price_after_N and return_N fields."""
    closes = df["close"].values
    highs = df["high"].values
    lows = df["low"].values
    n = len(closes)

    for sig in signals:
        if sig.type in ("recycle", "cancel"):
            continue
        idx = sig.bar_index
        entry = sig.entry_price
        direction = sig.direction

        def _price_after(offset: int) -> float | None:
            j = idx + offset
            return float(closes[j]) if j < n else None

        def _return(p: float | None) -> float | None:
            if p is None or entry == 0:
                return None
            raw = (p - entry) / entry
            return raw if direction == "buy" else -raw

        sig.price_after_5 = _price_after(5)
        sig.price_after_10 = _price_after(10)
        sig.price_after_20 = _price_after(20)
        sig.return_5 = _return(sig.price_after_5)
        sig.return_10 = _return(sig.price_after_10)
        sig.return_20 = _return(sig.price_after_20)

        end = min(idx + 21, n)
        if end > idx + 1:
            window_high = float(np.max(highs[idx + 1 : end]))
            window_low = float(np.min(lows[idx + 1 : end]))
            if direction == "buy":
                sig.max_favorable_20 = (window_high - entry) / entry if entry else None
                sig.max_adverse_20 = (window_low - entry) / entry if entry else None
            else:
                sig.max_favorable_20 = (entry - window_low) / entry if entry else None
                sig.max_adverse_20 = (entry - window_high) / entry if entry else None


def _compute_stats(signals: list[Signal]) -> dict[str, dict]:
    from collections import defaultdict
    groups: dict[str, list[Signal]] = defaultdict(list)
    for s in signals:
        if s.type not in ("recycle", "cancel"):
            groups[s.type].append(s)

    stats: dict[str, dict] = {}
    for sig_type, group in groups.items():
        def _win_rate(field: str) -> float | None:
            vals = [getattr(s, field) for s in group if getattr(s, field) is not None]
            if not vals:
                return None
            return sum(1 for v in vals if v > 0) / len(vals)

        def _avg(field: str) -> float | None:
            vals = [getattr(s, field) for s in group if getattr(s, field) is not None]
            return float(np.mean(vals)) if vals else None

        stats[sig_type] = {
            "count": len(group),
            "win_rate_5": _win_rate("return_5"),
            "win_rate_10": _win_rate("return_10"),
            "win_rate_20": _win_rate("return_20"),
            "avg_return_5": _avg("return_5"),
            "avg_return_10": _avg("return_10"),
            "avg_return_20": _avg("return_20"),
        }
    return stats


def _save_signals(
    conn: sqlite3.Connection,
    symbol: str,
    interval: str,
    signals: list[Signal],
) -> None:
    now = int(time.time() * 1000)
    conn.execute(
        "DELETE FROM signals WHERE symbol=? AND interval=?", (symbol, interval)
    )
    rows = []
    for s in signals:
        rows.append((
            symbol, interval, s.bar_time, s.bar_index,
            s.type, s.direction, s.entry_price,
            int(s.perfected) if s.perfected is not None else None,
            int(s.deferral), int(s.deferral_8v5),
            s.risk_level, s.tdst_level,
            s.recycle_reason, s.cancel_reason,
            s.price_after_5, s.price_after_10, s.price_after_20,
            s.return_5, s.return_10, s.return_20,
            s.max_favorable_20, s.max_adverse_20,
            now,
        ))
    conn.executemany("""
        INSERT INTO signals (
            symbol, interval, bar_time, bar_index, type, direction, entry_price,
            perfected, deferral, deferral_8v5, risk_level, tdst_level,
            recycle_reason, cancel_reason,
            price_after_5, price_after_10, price_after_20,
            return_5, return_10, return_20,
            max_favorable_20, max_adverse_20, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, rows)
    conn.commit()


def run_backtest(
    symbol: str,
    interval: str,
    df: pd.DataFrame,
    save_to_db: bool = True,
) -> BacktestResult:
    """Run full TD Sequential backtest on candle DataFrame."""
    signals, tdst_lines, setup_counts, countdown_counts = td_run(df)
    _fill_returns(signals, df)
    stats = _compute_stats(signals)

    if save_to_db:
        def _bg_save() -> None:
            DB_PATH.parent.mkdir(parents=True, exist_ok=True)
            with sqlite3.connect(DB_PATH) as conn:
                _init_db(conn)
                _save_signals(conn, symbol, interval, signals)
        threading.Thread(target=_bg_save, daemon=True).start()

    candles = [
        Candle.model_validate(r)
        for r in df[["open_time", "open", "high", "low", "close", "volume"]].to_dict("records")
    ]

    return BacktestResult(
        symbol=symbol,
        interval=interval,
        start_time=int(df["open_time"].iloc[0]),
        end_time=int(df["open_time"].iloc[-1]),
        candles=candles,
        signals=signals,
        tdst_lines=tdst_lines,
        setup_counts=setup_counts,
        countdown_counts=countdown_counts,
        stats=stats,
    )
