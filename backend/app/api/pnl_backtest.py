from __future__ import annotations

import numpy as np
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import ORJSONResponse

from app.data.binance import get_candles
from app.indicators.td_sequential import run as td_run
from app.models.schemas import PnlTrade, PnlStats, PnlBacktestResult

router = APIRouter()


def _pnl_pct(direction: str, entry: float, exit_price: float) -> float:
    raw = (exit_price - entry) / entry
    return round((raw if direction == "buy" else -raw) * 100, 4)


def _build_stats(trades: list[PnlTrade], use_next_open: bool) -> PnlStats:
    pnls: list[float] = []
    unrealized = 0
    bars_list: list[int] = []

    for t in trades:
        if use_next_open:
            if t.entry_next_open is None:
                continue
            pnl = t.pnl_next_open_pct
        else:
            pnl = t.pnl_close_pct

        if pnl is None:
            unrealized += 1
        else:
            pnls.append(pnl)
            if t.exit_bars is not None:
                bars_list.append(t.exit_bars)

    won = [p for p in pnls if p > 0]
    lost = [p for p in pnls if p <= 0]
    total = len(pnls) + unrealized

    return PnlStats(
        total=total,
        won=len(won),
        lost=len(lost),
        unrealized=unrealized,
        win_rate_pct=round(len(won) / len(pnls) * 100, 1) if pnls else None,
        avg_pnl_pct=round(float(np.mean(pnls)), 2) if pnls else None,
        avg_win_pct=round(float(np.mean(won)), 2) if won else None,
        avg_loss_pct=round(float(np.mean(lost)), 2) if lost else None,
        max_win_pct=round(float(np.max(won)), 2) if won else None,
        max_loss_pct=round(float(np.min(lost)), 2) if lost else None,
        avg_bars_held=round(float(np.mean(bars_list)), 1) if bars_list else None,
    )


def _compute_trades(df) -> list[PnlTrade]:
    signals, _, _, _ = td_run(df)
    n = len(df)
    closes = df["close"].values
    opens = df["open"].values
    lows = df["low"].values
    highs = df["high"].values
    open_times = df["open_time"].values

    trades: list[PnlTrade] = []

    for sig in signals:
        if sig.type not in ("buy_setup_9", "sell_setup_9"):
            continue
        if sig.risk_level is None:
            continue

        i = sig.bar_index
        risk = sig.risk_level
        direction = sig.direction

        entry_close = float(closes[i])
        entry_next_open = float(opens[i + 1]) if i + 1 < n else None

        # Find exit bar: check intrabar low/high against risk level.
        # Exit price = risk level (assumes stop order fills at stop price).
        exit_price: float | None = None
        exit_time: int | None = None
        exit_bars: int | None = None
        exit_type = "end_of_data"

        for j in range(i + 1, n):
            hit = (direction == "buy" and float(lows[j]) < risk) or (
                direction == "sell" and float(highs[j]) > risk
            )
            if hit:
                exit_price = risk
                exit_time = int(open_times[j])
                exit_bars = j - i
                exit_type = "risk_level"
                break

        pnl_close = (
            _pnl_pct(direction, entry_close, exit_price) if exit_price is not None else None
        )
        pnl_next_open = (
            _pnl_pct(direction, entry_next_open, exit_price)
            if exit_price is not None and entry_next_open is not None
            else None
        )

        trades.append(PnlTrade(
            signal_type=sig.type,
            direction=direction,
            bar_time=sig.bar_time,
            risk_level=risk,
            perfected=sig.perfected,
            entry_close=entry_close,
            entry_next_open=entry_next_open,
            exit_price=exit_price,
            exit_time=exit_time,
            exit_bars=exit_bars,
            exit_type=exit_type,
            pnl_close_pct=pnl_close,
            pnl_next_open_pct=pnl_next_open,
        ))

    return trades


@router.get("/pnl-backtest")
def pnl_backtest_endpoint(
    symbol: str = Query("BTCUSDT"),
    interval: str = Query("4h"),
    start: int = Query(...),
    end: int = Query(...),
) -> ORJSONResponse:
    if start >= end:
        raise HTTPException(status_code=400, detail="start must be < end")
    df = get_candles(symbol, interval, start, end)
    if df.empty:
        raise HTTPException(status_code=404, detail="No candle data found")

    trades = _compute_trades(df)
    result = PnlBacktestResult(
        symbol=symbol,
        interval=interval,
        start_time=int(df["open_time"].iloc[0]),
        end_time=int(df["open_time"].iloc[-1]),
        trades=trades,
        stats_close=_build_stats(trades, use_next_open=False),
        stats_next_open=_build_stats(trades, use_next_open=True),
    )
    return ORJSONResponse(content=result.model_dump())
