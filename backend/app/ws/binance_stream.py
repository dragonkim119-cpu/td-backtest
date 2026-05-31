from __future__ import annotations

import asyncio
import json
import logging
from typing import Callable, Awaitable

import pandas as pd
import websockets

from app.data.binance import _parquet_path, _load_parquet, _save_parquet
from app.indicators.td_sequential import run as td_run

logger = logging.getLogger(__name__)

BINANCE_WS_BASE = "wss://fstream.binance.com/ws"
CONTEXT_BARS = 300


def _parse_kline(kline: dict) -> dict:
    return {
        "open_time": int(kline["t"]),
        "open": float(kline["o"]),
        "high": float(kline["h"]),
        "low": float(kline["l"]),
        "close": float(kline["c"]),
        "volume": float(kline["v"]),
        "close_time": int(kline["T"]),
    }


def _append_to_parquet(symbol: str, interval: str, candle: dict) -> None:
    path = _parquet_path(symbol, interval)
    df = _load_parquet(path)
    new_row = pd.DataFrame([candle])
    if df is None or df.empty:
        combined = new_row
    else:
        combined = pd.concat([df, new_row], ignore_index=True)
        combined = combined.drop_duplicates(subset="open_time").sort_values("open_time")
    _save_parquet(combined, path)


def _signals_for_last_bar(symbol: str, interval: str) -> tuple[list[dict], list[dict], int, int]:
    path = _parquet_path(symbol, interval)
    df = _load_parquet(path)
    if df is None or df.empty:
        return [], [], 0, 0

    ctx = df.tail(CONTEXT_BARS).reset_index(drop=True)
    signals, tdst_lines, setup_counts, countdown_counts = td_run(ctx)
    last_idx = len(ctx) - 1

    new_signals = [s.model_dump() for s in signals if s.bar_index == last_idx]
    new_tdst = [t.model_dump() for t in tdst_lines if t.start_bar_time == int(ctx.iloc[-1]["open_time"])]
    return new_signals, new_tdst, setup_counts[last_idx], countdown_counts[last_idx]


async def run_stream(
    symbol: str,
    interval: str,
    broadcast_fn: Callable[[dict], Awaitable[None]],
) -> None:
    stream = f"{symbol.lower()}@kline_{interval}"
    url = f"{BINANCE_WS_BASE}/{stream}"

    while True:
        try:
            async with websockets.connect(url, ping_interval=20, ping_timeout=10) as ws:
                logger.info("Connected Binance WS: %s", stream)
                async for raw in ws:
                    try:
                        msg = json.loads(raw)
                        kline = msg.get("k", {})
                        is_final: bool = kline.get("x", False)
                        candle = _parse_kline(kline)
                        candle_out = {k: v for k, v in candle.items() if k != "close_time"}

                        if is_final:
                            _append_to_parquet(symbol, interval, candle)
                            new_signals, new_tdst, setup_count, countdown_count = (
                                _signals_for_last_bar(symbol, interval)
                            )
                            payload: dict = {
                                "type": "close",
                                "candle": candle_out,
                                "new_signals": new_signals,
                                "new_tdst_lines": new_tdst,
                                "setup_count": setup_count,
                                "countdown_count": countdown_count,
                            }
                        else:
                            payload = {"type": "tick", "candle": candle_out}

                        await broadcast_fn(payload)
                    except Exception as exc:
                        logger.warning("WS parse error: %s", exc)
        except asyncio.CancelledError:
            logger.info("Stream %s cancelled", stream)
            break
        except Exception as exc:
            logger.warning("Binance WS error (%s): %s — reconnect in 5s", stream, exc)
            await asyncio.sleep(5)
