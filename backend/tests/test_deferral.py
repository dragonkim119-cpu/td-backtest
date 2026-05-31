from __future__ import annotations

from app.indicators.td_sequential import run as td_run
from tests.conftest import buy_setup_closes, sell_setup_closes, make_df


def test_buy_countdown_13_deferral():
    """bar13 low > bar8.close → deferred; resolves with deferral=True on next qualifying bar."""
    closes = buy_setup_closes(pre=4, length=9)   # bars 0..12
    highs = [c + 3.0 for c in closes]
    lows = [c - 1.0 for c in closes]

    # 13 countdown bars: close=40, low=42
    # close[i]=40 <= low[i-2]: for bars 13-14, low[i-2] is from setup (≥195) ✓
    #                           for bars 15+, low[i-2]=42 >= 40 ✓
    # 13vs8: bar8_close=40, low[bar13]=42 > 40 → deferred at bar 25
    for _ in range(13):
        closes.append(40.0)
        highs.append(44.0)
        lows.append(42.0)

    # Resolution bar: low=38 <= bar8_close=40 → fires with deferral=True
    closes.append(40.0)
    highs.append(44.0)
    lows.append(38.0)

    df = make_df(closes, highs=highs, lows=lows)
    signals, _, _, _ = td_run(df)

    cd13 = [s for s in signals if s.type == "buy_countdown_13"]
    assert len(cd13) >= 1, f"Expected buy_countdown_13. Got: {[s.type for s in signals]}"
    assert cd13[0].deferral is True, "Expected deferral=True on deferred signal"


def test_sell_countdown_13_deferral():
    """bar13 high < bar8.close → deferred; resolves with deferral=True on next qualifying bar."""
    closes = sell_setup_closes(pre=4, length=9)   # bars 0..12
    highs = [c + 3.0 for c in closes]
    lows = [c - 3.0 for c in closes]

    # 13 countdown bars: close=300, high=298
    # close[i]=300 >= high[i-2]: for bars 13-14, high[i-2] from setup (≤112) ✓
    #                             for bars 15+, high[i-2]=298 <= 300 ✓
    # 13vs8: bar8_close=300, high[bar13]=298 < 300 → deferred at bar 25
    for _ in range(13):
        closes.append(300.0)
        highs.append(298.0)
        lows.append(296.0)

    # Resolution bar: high=302 >= bar8_close=300 → fires with deferral=True
    closes.append(300.0)
    highs.append(302.0)
    lows.append(298.0)

    df = make_df(closes, highs=highs, lows=lows)
    signals, _, _, _ = td_run(df)

    cd13 = [s for s in signals if s.type == "sell_countdown_13"]
    assert len(cd13) >= 1, f"Expected sell_countdown_13. Got: {[s.type for s in signals]}"
    assert cd13[0].deferral is True, "Expected deferral=True"
