from __future__ import annotations

from app.indicators.td_sequential import run
from tests.conftest import buy_setup_closes, sell_setup_closes, make_df


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
