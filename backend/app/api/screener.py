from __future__ import annotations

import asyncio
import time

import pandas as pd
from fastapi import APIRouter
from fastapi.responses import ORJSONResponse

from app.data.binance import get_candles, _parquet_path, _load_parquet
from app.indicators.td_sequential import run as td_run

router = APIRouter()

INTERVAL_MS: dict[str, int] = {
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
    "3d": 3 * 24 * 60 * 60 * 1000,
    "1w": 7 * 24 * 60 * 60 * 1000,
}

CONTEXT_BARS = 300

_TRADING_TYPES = {"buy_setup_9", "sell_setup_9", "buy_countdown_13", "sell_countdown_13"}


def _get_latest_bars(symbol: str, interval: str) -> pd.DataFrame:
    path = _parquet_path(symbol, interval)
    cached = _load_parquet(path)
    if cached is not None and len(cached) >= CONTEXT_BARS:
        return cached.tail(CONTEXT_BARS).reset_index(drop=True)
    iv_ms = INTERVAL_MS.get(interval, 3_600_000)
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - (CONTEXT_BARS + 10) * iv_ms
    df = get_candles(symbol, interval, start_ms, end_ms)
    return df.tail(CONTEXT_BARS).reset_index(drop=True)


def _scan_one(symbol: str, interval: str) -> dict:
    try:
        df = _get_latest_bars(symbol, interval)
        if df.empty:
            return {"symbol": symbol, "interval": interval, "error": "no data"}

        signals, _, setup_counts, countdown_counts = td_run(df)
        last_idx = len(df) - 1
        last_close = float(df.iloc[-1]["close"])
        setup_count = setup_counts[last_idx]
        countdown_count = countdown_counts[last_idx]

        trading = [s for s in signals if s.type in _TRADING_TYPES]
        last = trading[-1] if trading else None

        return {
            "symbol": symbol,
            "interval": interval,
            "last_close": last_close,
            "setup_count": setup_count,
            "countdown_count": countdown_count,
            "last_signal_type": last.type if last else None,
            "last_signal_time": last.bar_time if last else None,
            "last_signal_perfected": last.perfected if last else None,
            "last_signal_direction": last.direction if last else None,
            "error": None,
        }
    except Exception as exc:
        return {"symbol": symbol, "interval": interval, "error": str(exc)}


@router.get("/screener")
async def screener_endpoint(
    symbols: str = "BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT,XRPUSDT",
    intervals: str = "1h,4h",
) -> ORJSONResponse:
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    interval_list = [i.strip() for i in intervals.split(",") if i.strip()]
    combos = [(s, iv) for s in symbol_list for iv in interval_list]

    results = await asyncio.gather(*[
        asyncio.to_thread(_scan_one, s, iv) for s, iv in combos
    ])
    return ORJSONResponse(content=list(results))
