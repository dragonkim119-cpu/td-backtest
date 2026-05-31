"""Shared test helpers."""
from __future__ import annotations

import pandas as pd


def make_df(
    closes: list[float],
    highs: list[float] | None = None,
    lows: list[float] | None = None,
) -> pd.DataFrame:
    n = len(closes)
    if highs is None:
        highs = [c + 2.0 for c in closes]
    if lows is None:
        lows = [c - 2.0 for c in closes]
    return pd.DataFrame({
        "open_time": list(range(n)),
        "open": closes,
        "high": highs,
        "low": lows,
        "close": closes,
        "volume": [1.0] * n,
    })


def buy_setup_closes(pre: int = 4, length: int = 9, base: float = 200.0) -> list[float]:
    """
    Generate closes satisfying c[i] < c[i-4] for `length` consecutive bars.
    Each bar's close = c[i-4] - 1, guaranteeing strict decrease.
    """
    closes: list[float] = [base] * pre
    for _ in range(length):
        closes.append(closes[-4] - 1.0)
    return closes


def sell_setup_closes(pre: int = 4, length: int = 9, base: float = 100.0) -> list[float]:
    """
    Generate closes satisfying c[i] > c[i-4] for `length` consecutive bars.
    Each bar's close = c[i-4] + 1.
    """
    closes: list[float] = [base] * pre
    for _ in range(length):
        closes.append(closes[-4] + 1.0)
    return closes
