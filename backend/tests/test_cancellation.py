from __future__ import annotations

from app.indicators.td_sequential import run
from tests.conftest import buy_setup_closes, sell_setup_closes, make_df


def test_cancel_by_tdst_violation():
    """Buy countdown cancelled when bar's True Low exceeds active TDST Resistance."""
    # Phase 1: sell setup 9 → active_resistance ≈ 45 (closes 40→43, highs +2)
    sell_closes = sell_setup_closes(pre=4, length=9, base=40)   # bars 0..12

    # Phase 2: buy setup 9 at high values (300→297)
    # During bars 13-16 (close≈300 > close[i-4]≈42) → sell count 1-4, not 9
    # During bars 17-25 (decreasing 299→297) → buy setup count 1-9 → fires at bar 25
    # buy setup 9 cancels sell_cd (opposite_setup), starts buy_cd
    buy_closes = buy_setup_closes(pre=4, length=9, base=300)   # bars 13..25

    all_closes = sell_closes + buy_closes

    # Phase 3: one bar with True Low >> active_resistance (45) → TDST violation
    all_closes.append(300.0)  # bar 26; True Low = min(low[26], close[25]) ≈ 297 > 45

    n = len(all_closes)
    highs = [c + 2.0 for c in all_closes]
    lows = [c - 1.0 for c in all_closes]

    df = make_df(all_closes, highs=highs, lows=lows)
    signals, _, _, _ = run(df)

    tdst_cancels = [
        s for s in signals
        if s.type == "cancel" and s.direction == "buy" and s.cancel_reason == "tdst_violation"
    ]
    assert len(tdst_cancels) >= 1, (
        f"Expected TDST violation cancel. "
        f"Got: {[(s.type, s.direction, getattr(s, 'cancel_reason', None)) for s in signals]}"
    )


def test_cancel_by_opposite_setup():
    """Buy countdown cancelled when Sell Setup 9 completes."""
    # Phase 1: Buy Setup 9 (bars 0..12) → buy_cd starts
    buy_closes = buy_setup_closes(pre=4, length=9)  # 13 bars

    # Phase 2: flat bars (no countdown progress, no setup)
    # Need close[i] == close[i-4] → neither condition
    flat_val = buy_closes[-1]
    flat = [flat_val] * 5   # 5 neutral bars

    # Phase 3: Sell Setup 9 while buy_cd is still active
    # Start from a value higher than flat_val
    sell_base = flat_val + 5.0
    sell_pre = [sell_base - 5.0] * 4   # pre bars for sell setup
    sell_closes_body = sell_setup_closes(pre=4, length=9, base=sell_base)[4:]

    all_closes = buy_closes + flat + sell_pre + sell_closes_body
    df = make_df(all_closes)
    signals, _, _, _ = run(df)

    cancel_sigs = [s for s in signals if s.type == "cancel" and s.direction == "buy"]
    assert len(cancel_sigs) >= 1, f"Expected cancel signal. Got signals: {[s.type for s in signals]}"
    assert cancel_sigs[0].cancel_reason == "opposite_setup"
