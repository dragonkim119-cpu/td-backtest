from __future__ import annotations

from app.indicators.td_sequential import run as td_run
from tests.conftest import buy_setup_closes, sell_setup_closes, make_df


def test_buy_setup9_risk_level_below_entry():
    """buy_setup_9: risk_level is set and strictly below entry_price."""
    closes = buy_setup_closes(pre=4, length=9)
    df = make_df(closes)
    signals, _, _, _ = td_run(df)

    sig = next((s for s in signals if s.type == "buy_setup_9"), None)
    assert sig is not None, "Expected buy_setup_9 signal"
    assert sig.risk_level is not None, "risk_level must not be None"
    assert sig.risk_level < sig.entry_price, (
        f"Buy risk_level {sig.risk_level:.4f} must be < entry {sig.entry_price:.4f}"
    )


def test_sell_setup9_risk_level_above_entry():
    """sell_setup_9: risk_level is set and strictly above entry_price."""
    closes = sell_setup_closes(pre=4, length=9)
    df = make_df(closes)
    signals, _, _, _ = td_run(df)

    sig = next((s for s in signals if s.type == "sell_setup_9"), None)
    assert sig is not None, "Expected sell_setup_9 signal"
    assert sig.risk_level is not None, "risk_level must not be None"
    assert sig.risk_level > sig.entry_price, (
        f"Sell risk_level {sig.risk_level:.4f} must be > entry {sig.entry_price:.4f}"
    )


def test_buy_countdown13_risk_level_below_entry():
    """buy_countdown_13: risk_level is set and strictly below entry_price."""
    closes = buy_setup_closes(pre=4, length=9)
    highs = [c + 3.0 for c in closes]
    lows = [c - 1.0 for c in closes]
    lows[11] = 45.0
    lows[12] = 45.0

    for _ in range(20):
        closes.append(40.0)
        highs.append(44.0)
        lows.append(38.0)
    for j in range(13, len(lows) - 2):
        lows[j] = 45.0

    df = make_df(closes, highs=highs, lows=lows)
    signals, _, _, _ = td_run(df)

    sig = next((s for s in signals if s.type == "buy_countdown_13"), None)
    assert sig is not None, "Expected buy_countdown_13"
    assert sig.risk_level is not None, "risk_level must not be None"
    assert sig.risk_level < sig.entry_price, (
        f"Countdown risk_level {sig.risk_level:.4f} must be < entry {sig.entry_price:.4f}"
    )
