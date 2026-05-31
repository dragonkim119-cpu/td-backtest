from __future__ import annotations

from app.indicators.td_setup import compute_setup
from app.indicators.td_countdown import compute_countdown
from tests.conftest import buy_setup_closes, sell_setup_closes, make_df


def test_buy_countdown_activates_after_setup_9():
    """Buy countdown starts after buy setup 9 and reaches 13."""
    closes = buy_setup_closes(pre=4, length=9)  # 13 bars (0..12)
    highs = [c + 3.0 for c in closes]
    lows = [c - 3.0 for c in closes]

    # Add 20 countdown bars: close=40, low=38
    # Condition: c[i] <= l[i-2]
    # - bars 13,14: l[i-2] = lows[11],lows[12] ≈ 193,192 → 40 <= 193 ✓
    # - bars 15+:   l[i-2] = 38 → 40 <= 38? NO! Need l[i-2] >= 40
    # Fix: set lows of countdown bars to 42 → l[i-2]=42, close=40 → 40<=42 ✓
    # 13 vs 8 check: low[13_bar] <= bar8_close
    # bar8_close = close at 8th qualifying countdown bar = 40
    # low at 13th bar = 42 → 42 <= 40? NO → deferral
    # Fix: set lows = 38 (< 40) so 38 <= 40 ✓
    # But then c[i]=40 <= l[i-2]=38 is 40<=38? NO
    # Need both: l[i-2] >= close[i] AND low[i] <= bar8_close
    # Solution: separate close from low:
    #   close[countdown] = 40
    #   low[countdown]   = 38  (< 40, satisfies 13vs8)
    #   lows[i-2]        = 45  (> 40, so c[i]=40 <= l[i-2]=45 ✓)
    # This requires setting lows of the PRE-countdown bars to 45.

    # Override lows for bars 11,12 (first two i-2 references after setup)
    lows[11] = 45.0
    lows[12] = 45.0

    for _ in range(20):
        closes.append(40.0)
        highs.append(44.0)
        lows.append(38.0)   # low < bar8_close(=40) → 13vs8 satisfied

    # Fix lows[i-2] for bars 13+ to be >= 40 so c[i]=40 qualifies
    # lows[11]=45 and lows[12]=45 already set above
    # lows[13..] = 38, so for bars 15+: l[i-2]=lows[13]=38 → close=40 <= 38? NO
    # Need lows[i-2] >= 40 for i=15..32
    # lows[13..30] = 45 (override them)
    for j in range(13, len(lows) - 2):
        lows[j] = 45.0

    df = make_df(closes, highs=highs, lows=lows)
    setup = compute_setup(df)
    assert setup.setup_buy[12] == 9, "Setup 9 must fire at bar 12"
    result = compute_countdown(df, setup)
    assert any(result.buy_cd_complete), f"Buy countdown should reach 13. labels={result.buy_cd_label}"


def test_sell_countdown_activates_after_setup_9():
    """Sell countdown starts after sell setup 9 and reaches 13."""
    closes = sell_setup_closes(pre=4, length=9)  # 13 bars (0..12)
    highs = [c + 3.0 for c in closes]
    lows = [c - 3.0 for c in closes]

    # Add 20 countdown bars: close=300, high=302
    # Condition: c[i] >= h[i-2]
    # - bars 13,14: h[i-2]=highs[11,12] ≈ 108,109 → 300>=108 ✓
    # - bars 15+: h[i-2]=302 → 300>=302? NO → need h[i-2] <= 300
    # Fix: set highs of countdown bars to 298
    # 13 vs 8 check: high[13th_bar] >= bar8_close
    # bar8_close = close at 8th qualifying bar = 300
    # high[13th] = 302 → 302 >= 300 ✓ → no deferral

    highs[11] = 295.0
    highs[12] = 295.0

    for _ in range(20):
        closes.append(300.0)
        highs.append(302.0)   # high > bar8_close(=300) → 13vs8 satisfied
        lows.append(298.0)

    # highs[i-2] for bars 15+: override to 298 (< 300) so c[i]=300 >= h[i-2]=298 ✓
    for j in range(13, len(highs) - 2):
        highs[j] = 298.0

    df = make_df(closes, highs=highs, lows=lows)
    setup = compute_setup(df)
    assert setup.setup_sell[12] == 9, "Sell setup 9 must fire at bar 12"
    result = compute_countdown(df, setup)
    assert any(result.sell_cd_complete), f"Sell countdown should reach 13. labels={result.sell_cd_label}"
