from __future__ import annotations

from app.indicators.td_sequential import run as td_run
from tests.conftest import buy_setup_closes, sell_setup_closes, make_df


def test_buy_countdown_activates_after_setup_9():
    """Buy countdown reaches 13 after a valid buy setup 9."""
    closes = buy_setup_closes(pre=4, length=9)  # 13 bars (0..12)
    highs = [c + 3.0 for c in closes]
    lows = [c - 1.0 for c in closes]

    # Override lows[11,12] so first two countdown bars qualify (c[i] <= l[i-2])
    lows[11] = 45.0
    lows[12] = 45.0

    # Add 20 countdown bars: close=40, low=38, lows[i-2]=45 so 40<=45 ✓
    # 13 vs 8: low[bar13] = 38 <= bar8_close = 40 ✓
    for _ in range(20):
        closes.append(40.0)
        highs.append(44.0)
        lows.append(38.0)

    # lows[i-2] for bars 15+ must be >= 40
    for j in range(13, len(lows) - 2):
        lows[j] = 45.0

    df = make_df(closes, highs=highs, lows=lows)
    signals, _, _, _ = td_run(df)
    assert any(s.type == "buy_countdown_13" for s in signals), (
        f"Expected buy_countdown_13 signal. Got: {[s.type for s in signals]}"
    )


def test_sell_countdown_activates_after_setup_9():
    """Sell countdown reaches 13 after a valid sell setup 9."""
    closes = sell_setup_closes(pre=4, length=9)  # 13 bars (0..12)
    highs = [c + 3.0 for c in closes]
    lows = [c - 3.0 for c in closes]

    # Override highs[11,12] so first two countdown bars qualify (c[i] >= h[i-2])
    highs[11] = 295.0
    highs[12] = 295.0

    # Add 20 countdown bars: close=300, high=302, highs[i-2]=298 so 300>=298 ✓
    # 13 vs 8: high[bar13] = 302 >= bar8_close = 300 ✓
    for _ in range(20):
        closes.append(300.0)
        highs.append(302.0)
        lows.append(298.0)

    # highs[i-2] for bars 15+ must be <= 300
    for j in range(13, len(highs) - 2):
        highs[j] = 298.0

    df = make_df(closes, highs=highs, lows=lows)
    signals, _, _, _ = td_run(df)
    assert any(s.type == "sell_countdown_13" for s in signals), (
        f"Expected sell_countdown_13 signal. Got: {[s.type for s in signals]}"
    )
