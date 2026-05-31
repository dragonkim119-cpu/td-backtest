from __future__ import annotations

from app.indicators.td_setup import compute_setup
from tests.conftest import buy_setup_closes, sell_setup_closes, make_df


def test_buy_setup_9_count():
    """9 consecutive c[i] < c[i-4] → setup_buy reaches 9."""
    closes = buy_setup_closes(pre=4, length=9)  # 13 bars
    df = make_df(closes)
    result = compute_setup(df)
    assert result.setup_buy[12] == 9, f"Expected 9, got {result.setup_buy[12]}"


def test_sell_setup_9_count():
    """9 consecutive c[i] > c[i-4] → setup_sell reaches 9."""
    closes = sell_setup_closes(pre=4, length=9)
    df = make_df(closes)
    result = compute_setup(df)
    assert result.setup_sell[12] == 9


def test_setup_reset_on_break():
    """Count resets when condition breaks mid-sequence."""
    closes = buy_setup_closes(pre=4, length=5)   # 9 bars (indices 0-8), count=5 at bar 8
    # Insert a break bar: close == close[i-4] → neither buy nor sell
    break_val = closes[-4]
    closes.append(break_val)                      # bar 9: equal → reset
    df = make_df(closes)
    result = compute_setup(df)
    assert result.setup_buy[9] == 0, "Count should reset after break"


def test_no_buy_setup_without_4bar_lookback():
    """First 4 bars always produce count 0."""
    closes = buy_setup_closes()
    df = make_df(closes)
    result = compute_setup(df)
    for i in range(4):
        assert result.setup_buy[i] == 0


def test_perfected_buy():
    """Buy Setup is perfected when min(low8,low9) <= min(low6,low7)."""
    closes = buy_setup_closes(pre=4, length=9)
    lows = [c - 1.0 for c in closes]
    # Setup window: bars 4..12. 6th bar=index 9, 7th=10, 8th=11, 9th=12
    lows[4 + 5] = 150.0   # 6th bar of setup
    lows[4 + 6] = 150.0   # 7th bar of setup
    lows[4 + 7] = 148.0   # 8th bar of setup → min(148, lows[12]) < min(150,150) ✓
    highs = [c + 3.0 for c in closes]
    df = make_df(closes, highs=highs, lows=lows)
    result = compute_setup(df)
    assert result.perfected_buy[12] is True


def test_tdst_support_is_lowest_true_low():
    """TDST support after Buy Setup 9 = min True Low over 9-bar window."""
    closes = buy_setup_closes(pre=4, length=9)
    lows = [c - 1.0 for c in closes]
    lows[7] = 50.0   # bar 7 inside setup window (4..12): very low
    highs = [c + 3.0 for c in closes]
    df = make_df(closes, highs=highs, lows=lows)
    result = compute_setup(df)
    support = result.tdst_support[12]
    assert support is not None
    # True Low at bar 7 = min(low[7], close[6]) = min(50, closes[6])
    expected = min(50.0, closes[6])
    assert abs(support - expected) < 0.001, f"Got {support}, expected ~{expected}"
