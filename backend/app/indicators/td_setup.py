from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd


@dataclass
class SetupResult:
    setup_buy: list[int] = field(default_factory=list)   # 0 or 1~9
    setup_sell: list[int] = field(default_factory=list)  # 0 or 1~9
    perfected_buy: list[bool] = field(default_factory=list)
    perfected_sell: list[bool] = field(default_factory=list)
    tdst_support: list[float | None] = field(default_factory=list)    # active support at each bar
    tdst_resistance: list[float | None] = field(default_factory=list)


def true_high(df: pd.DataFrame) -> np.ndarray:
    """True High = max(high[i], close[i-1])."""
    th = df["high"].values.copy()
    close = df["close"].values
    th[1:] = np.maximum(df["high"].values[1:], close[:-1])
    return th


def true_low(df: pd.DataFrame) -> np.ndarray:
    """True Low = min(low[i], close[i-1])."""
    tl = df["low"].values.copy()
    close = df["close"].values
    tl[1:] = np.minimum(df["low"].values[1:], close[:-1])
    return tl


def compute_setup(df: pd.DataFrame) -> SetupResult:
    """
    Compute TD Setup counts, Perfected flags, and TDST levels per bar.

    Rules from docs/02_TD_LOGIC.md:
    - Buy Setup:  c[i] < c[i-4], 9 consecutive → complete
    - Sell Setup: c[i] > c[i-4], 9 consecutive → complete
    - Perfected Buy:  min(low[8th], low[9th]) <= min(low[6th], low[7th])
    - Perfected Sell: max(high[8th], high[9th]) >= max(high[6th], high[7th])
    - TDST Support:    lowest True Low over Setup 9-bar window (on Buy Setup 9)
    - TDST Resistance: highest True High over Setup 9-bar window (on Sell Setup 9)
    """
    n = len(df)
    close = df["close"].values
    high = df["high"].values
    low = df["low"].values
    th = true_high(df)
    tl = true_low(df)

    setup_buy = [0] * n
    setup_sell = [0] * n
    perfected_buy = [False] * n
    perfected_sell = [False] * n
    tdst_support: list[float | None] = [None] * n
    tdst_resistance: list[float | None] = [None] * n

    long_count = 0
    short_count = 0
    active_support: float | None = None
    active_resistance: float | None = None

    # Track start index of current setup for perfected check
    buy_setup_start: int | None = None
    sell_setup_start: int | None = None

    # Pending perfected: (setup_start, window bars) waiting for post-9 confirmation
    pending_buy_perfected: tuple[int, list[int]] | None = None
    pending_sell_perfected: tuple[int, list[int]] | None = None

    for i in range(n):
        if i < 4:
            long_count = 0
            short_count = 0
            tdst_support[i] = active_support
            tdst_resistance[i] = active_resistance
            continue

        # Reset over-9 (shouldn't happen normally, guard)
        if long_count >= 9:
            long_count = 0
        if short_count >= 9:
            short_count = 0

        if close[i] < close[i - 4]:
            long_count += 1
            short_count = 0
            if long_count == 1:
                buy_setup_start = i
        elif close[i] > close[i - 4]:
            short_count += 1
            long_count = 0
            if short_count == 1:
                sell_setup_start = i
        else:
            long_count = 0
            short_count = 0

        setup_buy[i] = long_count
        setup_sell[i] = short_count

        # --- Buy Setup 9 complete ---
        if long_count == 9 and buy_setup_start is not None:
            start = buy_setup_start
            bars = list(range(start, i + 1))  # 9 bars [start..i]
            # TDST Support: lowest True Low in window
            active_support = float(np.min(tl[start : i + 1]))

            # Perfected check: min(low[8th], low[9th]) <= min(low[6th], low[7th])
            # 8th = bars[7], 9th = bars[8], 6th = bars[5], 7th = bars[6]
            l8 = low[bars[7]]
            l9 = low[bars[8]]
            l6 = low[bars[5]]
            l7 = low[bars[6]]
            if min(l8, l9) <= min(l6, l7):
                perfected_buy[i] = True
                pending_buy_perfected = None
            else:
                # Imperfected — watch future bars for delayed perfection
                pending_buy_perfected = (i, bars)

            long_count = 0
            buy_setup_start = None

        # --- Sell Setup 9 complete ---
        if short_count == 9 and sell_setup_start is not None:
            start = sell_setup_start
            bars = list(range(start, i + 1))
            active_resistance = float(np.max(th[start : i + 1]))

            h8 = high[bars[7]]
            h9 = high[bars[8]]
            h6 = high[bars[5]]
            h7 = high[bars[6]]
            if max(h8, h9) >= max(h6, h7):
                perfected_sell[i] = True
                pending_sell_perfected = None
            else:
                pending_sell_perfected = (i, bars)

            short_count = 0
            sell_setup_start = None

        # --- Delayed Perfected check (post-9 bars) ---
        if pending_buy_perfected is not None:
            setup9_i, bars = pending_buy_perfected
            l6 = low[bars[5]]
            l7 = low[bars[6]]
            ref = min(l6, l7)
            if low[i] <= ref:
                perfected_buy[setup9_i] = True  # flag on setup bar, not this future bar
                pending_buy_perfected = None

        if pending_sell_perfected is not None:
            setup9_i, bars = pending_sell_perfected
            h6 = high[bars[5]]
            h7 = high[bars[6]]
            ref = max(h6, h7)
            if high[i] >= ref:
                perfected_sell[setup9_i] = True  # flag on setup bar, not this future bar
                pending_sell_perfected = None

        tdst_support[i] = active_support
        tdst_resistance[i] = active_resistance

    return SetupResult(
        setup_buy=setup_buy,
        setup_sell=setup_sell,
        perfected_buy=perfected_buy,
        perfected_sell=perfected_sell,
        tdst_support=tdst_support,
        tdst_resistance=tdst_resistance,
    )
