from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from app.indicators.td_setup import SetupResult


@dataclass
class CountdownState:
    active: bool = False
    count: int = 0
    deferred: bool = False  # waiting for 13 vs 8 to clear
    bar8_close: float | None = None  # close at countdown bar 8
    bars: list[int] = field(default_factory=list)  # bar indices of counted bars


@dataclass
class CountdownResult:
    buy_cd: list[int] = field(default_factory=list)   # 0 or 1~13
    sell_cd: list[int] = field(default_factory=list)
    buy_cd_complete: list[bool] = field(default_factory=list)
    sell_cd_complete: list[bool] = field(default_factory=list)
    buy_cd_deferral: list[bool] = field(default_factory=list)   # + marker bars
    sell_cd_deferral: list[bool] = field(default_factory=list)
    buy_deferral_8v5: list[bool] = field(default_factory=list)
    sell_deferral_8v5: list[bool] = field(default_factory=list)
    # track active countdown count per bar for chart labels
    buy_cd_label: list[int] = field(default_factory=list)
    sell_cd_label: list[int] = field(default_factory=list)


def compute_countdown(df: pd.DataFrame, setup: SetupResult) -> CountdownResult:
    """
    Compute TD Countdown (13 count) with 13 vs 8 Deferral and 8 vs 5 meta.

    Rules from docs/02_TD_LOGIC.md:
    - Buy CD:  c[i] <= l[i-2]  (non-consecutive)
    - Sell CD: c[i] >= h[i-2]  (non-consecutive)
    - 13 vs 8: Buy  → bar13.low  <= bar8.close; Sell → bar13.high >= bar8.close
    - 8 vs 5:  Buy  → bar8.low   <= bar5.close; Sell → bar8.high  >= bar5.close
    """
    n = len(df)
    close = df["close"].values
    high = df["high"].values
    low = df["low"].values

    result = CountdownResult(
        buy_cd=[0] * n,
        sell_cd=[0] * n,
        buy_cd_complete=[False] * n,
        sell_cd_complete=[False] * n,
        buy_cd_deferral=[False] * n,
        sell_cd_deferral=[False] * n,
        buy_deferral_8v5=[False] * n,
        sell_deferral_8v5=[False] * n,
        buy_cd_label=[0] * n,
        sell_cd_label=[0] * n,
    )

    buy = CountdownState()
    sell = CountdownState()

    for i in range(n):
        # New Setup 9 → reset/start countdown
        if setup.setup_buy[i] == 9:
            buy = CountdownState(active=True, count=0)
        if setup.setup_sell[i] == 9:
            sell = CountdownState(active=True, count=0)

        if i < 2:
            continue

        # --- Buy Countdown ---
        if buy.active:
            if buy.deferred:
                # Waiting for 13 vs 8 condition + new qualifying bar
                if close[i] <= low[i - 2]:
                    if low[i] <= buy.bar8_close:  # type: ignore[operator]
                        result.buy_cd_complete[i] = True
                        result.buy_cd_deferral[i] = True
                        buy = CountdownState()
                    # else: still deferred
            else:
                if close[i] <= low[i - 2]:
                    buy.count += 1
                    buy.bars.append(i)

                    if buy.count == 5:
                        buy.bar5_close = close[i]  # type: ignore[attr-defined]
                    if buy.count == 8:
                        buy.bar8_close = close[i]
                        # 8 vs 5 check
                        if hasattr(buy, "bar5_close") and low[i] <= buy.bar5_close:  # type: ignore[attr-defined]
                            result.buy_deferral_8v5[i] = True

                    if buy.count == 13:
                        if buy.bar8_close is not None and low[i] <= buy.bar8_close:
                            result.buy_cd_complete[i] = True
                            buy = CountdownState()
                        else:
                            # Defer: mark + and stay at 12
                            buy.deferred = True
                            buy.count = 12
                            result.buy_cd_deferral[i] = True

            result.buy_cd_label[i] = buy.count if buy.active else 0

        # --- Sell Countdown ---
        if sell.active:
            if sell.deferred:
                if close[i] >= high[i - 2]:
                    if sell.bar8_close is not None and high[i] >= sell.bar8_close:
                        result.sell_cd_complete[i] = True
                        result.sell_cd_deferral[i] = True
                        sell = CountdownState()
            else:
                if close[i] >= high[i - 2]:
                    sell.count += 1
                    sell.bars.append(i)

                    if sell.count == 5:
                        sell.bar5_close = close[i]  # type: ignore[attr-defined]
                    if sell.count == 8:
                        sell.bar8_close = close[i]
                        if hasattr(sell, "bar5_close") and high[i] >= sell.bar5_close:  # type: ignore[attr-defined]
                            result.sell_deferral_8v5[i] = True

                    if sell.count == 13:
                        if sell.bar8_close is not None and high[i] >= sell.bar8_close:
                            result.sell_cd_complete[i] = True
                            sell = CountdownState()
                        else:
                            sell.deferred = True
                            sell.count = 12
                            result.sell_cd_deferral[i] = True

            result.sell_cd_label[i] = sell.count if sell.active else 0

    return result
