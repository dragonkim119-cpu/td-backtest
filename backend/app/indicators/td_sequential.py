from __future__ import annotations

import numpy as np
import pandas as pd

from app.indicators.td_setup import SetupResult, compute_setup, true_high, true_low
from app.indicators.td_countdown import CountdownState
from app.models.schemas import Signal, TDSTLine


def _true_range(high: float, low: float, prev_close: float) -> float:
    return max(high - low, abs(high - prev_close), abs(low - prev_close))


def _compute_risk_buy(
    bars: list[int],
    tl: np.ndarray,
    th: np.ndarray,
    high: np.ndarray,
    low: np.ndarray,
    close: np.ndarray,
) -> float:
    idx = int(np.argmin(tl[bars]))
    bar_i = bars[idx]
    prev_close = float(close[bar_i - 1]) if bar_i > 0 else float(close[bar_i])
    tr = _true_range(float(high[bar_i]), float(low[bar_i]), prev_close)
    return float(tl[bar_i]) - tr


def _compute_risk_sell(
    bars: list[int],
    tl: np.ndarray,
    th: np.ndarray,
    high: np.ndarray,
    low: np.ndarray,
    close: np.ndarray,
) -> float:
    idx = int(np.argmax(th[bars]))
    bar_i = bars[idx]
    prev_close = float(close[bar_i - 1]) if bar_i > 0 else float(close[bar_i])
    tr = _true_range(float(high[bar_i]), float(low[bar_i]), prev_close)
    return float(th[bar_i]) + tr


def _emit_buy_13(
    i: int,
    open_times: np.ndarray,
    close: np.ndarray,
    low: np.ndarray,
    high: np.ndarray,
    tl: np.ndarray,
    th: np.ndarray,
    state: CountdownState,
    signals: list[Signal],
    active_support: float | None,
    deferred: bool,
) -> None:
    risk = _compute_risk_buy(state.bars, tl, th, high, low, close) if state.bars else None
    signals.append(Signal(
        type="buy_countdown_13",
        direction="buy",
        bar_index=i,
        bar_time=int(open_times[i]),
        entry_price=float(close[i]),
        deferral=deferred,
        deferral_8v5=getattr(state, "deferral_8v5", False),
        risk_level=risk,
        tdst_level=active_support,
    ))


def _emit_sell_13(
    i: int,
    open_times: np.ndarray,
    close: np.ndarray,
    low: np.ndarray,
    high: np.ndarray,
    tl: np.ndarray,
    th: np.ndarray,
    state: CountdownState,
    signals: list[Signal],
    active_resistance: float | None,
    deferred: bool,
) -> None:
    risk = _compute_risk_sell(state.bars, tl, th, high, low, close) if state.bars else None
    signals.append(Signal(
        type="sell_countdown_13",
        direction="sell",
        bar_index=i,
        bar_time=int(open_times[i]),
        entry_price=float(close[i]),
        deferral=deferred,
        deferral_8v5=getattr(state, "deferral_8v5", False),
        risk_level=risk,
        tdst_level=active_resistance,
    ))


def run(df: pd.DataFrame) -> tuple[list[Signal], list[TDSTLine], list[int], list[int]]:
    """
    Full TD Sequential pipeline.

    Returns:
        signals, tdst_lines, setup_counts, countdown_counts
    """
    n = len(df)
    open_times = df["open_time"].values
    close = df["close"].values
    high = df["high"].values
    low = df["low"].values
    th = true_high(df)
    tl = true_low(df)

    setup = compute_setup(df)

    signals: list[Signal] = []
    tdst_lines: list[TDSTLine] = []

    buy_cd = CountdownState()
    sell_cd = CountdownState()

    active_support: float | None = None
    active_resistance: float | None = None
    tdst_support_start: int | None = None
    tdst_resistance_start: int | None = None

    last_buy_setup_size: float | None = None
    last_sell_setup_size: float | None = None

    setup_counts = [0] * n
    countdown_counts = [0] * n

    # Consecutive same-direction setup bar counter for extended-setup recycling
    ext_long = 0   # consecutive bars where setup_buy > 0
    ext_short = 0  # consecutive bars where setup_sell > 0

    for i in range(n):
        if i < 4:
            continue

        c_buy = setup.setup_buy[i]
        c_sell = setup.setup_sell[i]

        # Track extended setup counts (consecutive bars in same direction)
        if c_buy > 0:
            ext_long += 1
            ext_short = 0
        elif c_sell > 0:
            ext_short += 1
            ext_long = 0
        else:
            ext_long = 0
            ext_short = 0

        # Signed setup count for chart labels
        if c_buy > 0:
            setup_counts[i] = c_buy
        elif c_sell > 0:
            setup_counts[i] = -c_sell

        # ── Recycling: Extended Setup ──────────────────────────────────────
        # Same direction: buy setup extended 22+ → recycle BUY countdown
        if ext_long >= 22 and buy_cd.active:
            signals.append(Signal(
                type="recycle",
                direction="buy",
                bar_index=i,
                bar_time=int(open_times[i]),
                entry_price=float(close[i]),
                recycle_reason="extended",
            ))
            buy_cd = CountdownState()
            ext_long = 0

        # Same direction: sell setup extended 22+ → recycle SELL countdown
        if ext_short >= 22 and sell_cd.active:
            signals.append(Signal(
                type="recycle",
                direction="sell",
                bar_index=i,
                bar_time=int(open_times[i]),
                entry_price=float(close[i]),
                recycle_reason="extended",
            ))
            sell_cd = CountdownState()
            ext_short = 0

        # ── Buy Setup 9 ────────────────────────────────────────────────────
        if c_buy == 9:
            start9 = i - 8
            size = float(np.max(th[start9 : i + 1]) - np.min(tl[start9 : i + 1]))

            # Recycling: size match — new Buy Setup vs previous Buy Setup
            if buy_cd.active and last_buy_setup_size is not None and last_buy_setup_size > 0:
                ratio = size / last_buy_setup_size
                if 1.0 <= ratio <= 2.0:
                    signals.append(Signal(
                        type="recycle",
                        direction="buy",
                        bar_index=i,
                        bar_time=int(open_times[i]),
                        entry_price=float(close[i]),
                        recycle_reason="size_match",
                    ))
                    buy_cd = CountdownState()

            last_buy_setup_size = size

            # TDST Support = lowest True Low over 9-bar window
            support_val = float(np.min(tl[start9 : i + 1]))
            if tdst_support_start is not None and active_support is not None:
                tdst_lines.append(TDSTLine(
                    direction="support",
                    level=active_support,
                    start_bar_time=int(open_times[tdst_support_start]),
                    end_bar_time=int(open_times[i]),
                ))
            active_support = support_val
            tdst_support_start = i

            # Cancellation: opposite countdown (sell) → cancel it
            if sell_cd.active:
                signals.append(Signal(
                    type="cancel",
                    direction="sell",
                    bar_index=i,
                    bar_time=int(open_times[i]),
                    entry_price=float(close[i]),
                    cancel_reason="opposite_setup",
                ))
                sell_cd = CountdownState()

            # Start (or restart) buy countdown
            buy_cd = CountdownState(active=True, count=0)

            signals.append(Signal(
                type="buy_setup_9",
                direction="buy",
                bar_index=i,
                bar_time=int(open_times[i]),
                entry_price=float(close[i]),
                perfected=setup.perfected_buy[i],
                tdst_level=support_val,
            ))

        # ── Sell Setup 9 ───────────────────────────────────────────────────
        if c_sell == 9:
            start9 = i - 8
            size = float(np.max(th[start9 : i + 1]) - np.min(tl[start9 : i + 1]))

            # Recycling: size match — new Sell Setup vs previous Sell Setup
            if sell_cd.active and last_sell_setup_size is not None and last_sell_setup_size > 0:
                ratio = size / last_sell_setup_size
                if 1.0 <= ratio <= 2.0:
                    signals.append(Signal(
                        type="recycle",
                        direction="sell",
                        bar_index=i,
                        bar_time=int(open_times[i]),
                        entry_price=float(close[i]),
                        recycle_reason="size_match",
                    ))
                    sell_cd = CountdownState()

            last_sell_setup_size = size

            # TDST Resistance = highest True High over 9-bar window
            resistance_val = float(np.max(th[start9 : i + 1]))
            if tdst_resistance_start is not None and active_resistance is not None:
                tdst_lines.append(TDSTLine(
                    direction="resistance",
                    level=active_resistance,
                    start_bar_time=int(open_times[tdst_resistance_start]),
                    end_bar_time=int(open_times[i]),
                ))
            active_resistance = resistance_val
            tdst_resistance_start = i

            # Cancellation: opposite countdown (buy) → cancel it
            if buy_cd.active:
                signals.append(Signal(
                    type="cancel",
                    direction="buy",
                    bar_index=i,
                    bar_time=int(open_times[i]),
                    entry_price=float(close[i]),
                    cancel_reason="opposite_setup",
                ))
                buy_cd = CountdownState()

            # Start (or restart) sell countdown
            sell_cd = CountdownState(active=True, count=0)

            signals.append(Signal(
                type="sell_setup_9",
                direction="sell",
                bar_index=i,
                bar_time=int(open_times[i]),
                entry_price=float(close[i]),
                perfected=setup.perfected_sell[i],
                tdst_level=resistance_val,
            ))

        if i < 2:
            continue

        # ── Cancellation: TDST violation ──────────────────────────────────
        # Buy CD: price fully above TDST Resistance → market confirmed uptrend → cancel
        if buy_cd.active and active_resistance is not None:
            if tl[i] > active_resistance:
                signals.append(Signal(
                    type="cancel",
                    direction="buy",
                    bar_index=i,
                    bar_time=int(open_times[i]),
                    entry_price=float(close[i]),
                    cancel_reason="tdst_violation",
                ))
                buy_cd = CountdownState()

        # Sell CD: price fully below TDST Support → market confirmed downtrend → cancel
        if sell_cd.active and active_support is not None:
            if th[i] < active_support:
                signals.append(Signal(
                    type="cancel",
                    direction="sell",
                    bar_index=i,
                    bar_time=int(open_times[i]),
                    entry_price=float(close[i]),
                    cancel_reason="tdst_violation",
                ))
                sell_cd = CountdownState()

        # ── Buy Countdown progress ─────────────────────────────────────────
        if buy_cd.active:
            if buy_cd.deferred:
                # Waiting for 13 vs 8 to clear on a new qualifying bar
                if close[i] <= low[i - 2] and buy_cd.bar8_close is not None:
                    if low[i] <= buy_cd.bar8_close:
                        _emit_buy_13(i, open_times, close, low, high, tl, th,
                                     buy_cd, signals, active_support, deferred=True)
                        buy_cd = CountdownState()
            else:
                if close[i] <= low[i - 2]:
                    buy_cd.count += 1
                    buy_cd.bars.append(i)

                    if buy_cd.count == 5:
                        buy_cd.bar5_close = close[i]  # type: ignore[attr-defined]
                    if buy_cd.count == 8:
                        buy_cd.bar8_close = close[i]
                        if hasattr(buy_cd, "bar5_close") and low[i] <= buy_cd.bar5_close:  # type: ignore[attr-defined]
                            buy_cd.deferral_8v5 = True  # type: ignore[attr-defined]
                    if buy_cd.count == 13:
                        if buy_cd.bar8_close is not None and low[i] <= buy_cd.bar8_close:
                            _emit_buy_13(i, open_times, close, low, high, tl, th,
                                         buy_cd, signals, active_support, deferred=False)
                            buy_cd = CountdownState()
                        else:
                            buy_cd.deferred = True
                            buy_cd.count = 12

            if buy_cd.active:
                countdown_counts[i] = buy_cd.count

        # ── Sell Countdown progress ────────────────────────────────────────
        if sell_cd.active:
            if sell_cd.deferred:
                if close[i] >= high[i - 2] and sell_cd.bar8_close is not None:
                    if high[i] >= sell_cd.bar8_close:
                        _emit_sell_13(i, open_times, close, low, high, tl, th,
                                      sell_cd, signals, active_resistance, deferred=True)
                        sell_cd = CountdownState()
            else:
                if close[i] >= high[i - 2]:
                    sell_cd.count += 1
                    sell_cd.bars.append(i)

                    if sell_cd.count == 5:
                        sell_cd.bar5_close = close[i]  # type: ignore[attr-defined]
                    if sell_cd.count == 8:
                        sell_cd.bar8_close = close[i]
                        if hasattr(sell_cd, "bar5_close") and high[i] >= sell_cd.bar5_close:  # type: ignore[attr-defined]
                            sell_cd.deferral_8v5 = True  # type: ignore[attr-defined]
                    if sell_cd.count == 13:
                        if sell_cd.bar8_close is not None and high[i] >= sell_cd.bar8_close:
                            _emit_sell_13(i, open_times, close, low, high, tl, th,
                                          sell_cd, signals, active_resistance, deferred=False)
                            sell_cd = CountdownState()
                        else:
                            sell_cd.deferred = True
                            sell_cd.count = 12

            if sell_cd.active:
                countdown_counts[i] = -(sell_cd.count)

    # Close open TDST lines at last bar
    if tdst_support_start is not None and active_support is not None:
        tdst_lines.append(TDSTLine(
            direction="support",
            level=active_support,
            start_bar_time=int(open_times[tdst_support_start]),
            end_bar_time=None,
        ))
    if tdst_resistance_start is not None and active_resistance is not None:
        tdst_lines.append(TDSTLine(
            direction="resistance",
            level=active_resistance,
            start_bar_time=int(open_times[tdst_resistance_start]),
            end_bar_time=None,
        ))

    return signals, tdst_lines, setup_counts, countdown_counts
