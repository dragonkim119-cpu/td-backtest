from __future__ import annotations

import time
from pathlib import Path

import httpx
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

DATA_DIR = Path(__file__).parent.parent.parent / "data"
BASE_URL = "https://fapi.binance.com"
KLINES_ENDPOINT = "/fapi/v1/klines"
LIMIT = 1500


def _parquet_path(symbol: str, interval: str) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return DATA_DIR / f"{symbol}_{interval}.parquet"


def _load_parquet(path: Path) -> pd.DataFrame | None:
    if not path.exists():
        return None
    return pd.read_parquet(path)


def _save_parquet(df: pd.DataFrame, path: Path) -> None:
    table = pa.Table.from_pandas(df, preserve_index=False)
    pq.write_table(table, path)


def _fetch_klines(
    symbol: str,
    interval: str,
    start_ms: int,
    end_ms: int,
) -> list[list]:
    rows: list[list] = []
    current_start = start_ms

    with httpx.Client(base_url=BASE_URL, timeout=30) as client:
        while current_start < end_ms:
            params = {
                "symbol": symbol,
                "interval": interval,
                "startTime": current_start,
                "endTime": end_ms,
                "limit": LIMIT,
            }
            resp = client.get(KLINES_ENDPOINT, params=params)
            resp.raise_for_status()
            data = resp.json()
            if not data:
                break
            rows.extend(data)
            last_open_time = data[-1][0]
            if len(data) < LIMIT:
                break
            current_start = last_open_time + 1
            time.sleep(0.1)

    return rows


def _rows_to_df(rows: list[list]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=[
        "open_time", "open", "high", "low", "close", "volume",
        "close_time", "quote_volume", "num_trades",
        "taker_buy_base", "taker_buy_quote", "ignore",
    ])
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = df[col].astype(float)
    df["open_time"] = df["open_time"].astype("int64")
    df["close_time"] = df["close_time"].astype("int64")
    return df[["open_time", "open", "high", "low", "close", "volume", "close_time"]]


def get_candles(
    symbol: str,
    interval: str,
    start_ms: int,
    end_ms: int,
) -> pd.DataFrame:
    """Return candles for (symbol, interval, start_ms..end_ms). Uses Parquet cache."""
    path = _parquet_path(symbol, interval)
    cached = _load_parquet(path)

    fetch_start = start_ms
    fetch_end = end_ms

    if cached is not None and not cached.empty:
        cached_min = int(cached["open_time"].min())
        cached_max = int(cached["open_time"].max())

        if cached_min <= start_ms and cached_max >= end_ms:
            mask = (cached["open_time"] >= start_ms) & (cached["open_time"] <= end_ms)
            return cached[mask].reset_index(drop=True)

        if cached_max < end_ms:
            fetch_start = cached_max + 1
        if cached_min > start_ms:
            fetch_end = cached_min - 1

    rows = _fetch_klines(symbol, interval, fetch_start, fetch_end)
    new_df = _rows_to_df(rows)

    if cached is not None and not cached.empty:
        combined = pd.concat([cached, new_df], ignore_index=True)
        combined = combined.drop_duplicates(subset="open_time").sort_values("open_time")
    else:
        combined = new_df.sort_values("open_time")

    _save_parquet(combined, path)

    mask = (combined["open_time"] >= start_ms) & (combined["open_time"] <= end_ms)
    return combined[mask].reset_index(drop=True)
