from __future__ import annotations

from app.api.pnl_backtest import _compute_trades
from app.indicators.td_sequential import run as td_run
from tests.conftest import buy_setup_closes, make_df


def _get_buy_setup_risk(closes: list[float]) -> float:
    df = make_df(closes)
    signals, _, _, _ = td_run(df)
    sig = next(s for s in signals if s.type == "buy_setup_9")
    assert sig.risk_level is not None
    return sig.risk_level


def test_pnl_stop_hit_intrabar():
    """Buy trade created; exit at risk level when intrabar low breaches stop."""
    closes = buy_setup_closes(pre=4, length=9)
    risk = _get_buy_setup_risk(closes)

    # 3 bars well above risk (no stop), then a bar whose low < risk
    for _ in range(3):
        closes.append(risk + 20.0)
    closes.append(risk + 10.0)  # close stays above risk

    lows = [c - 2.0 for c in closes]
    highs = [c + 2.0 for c in closes]
    lows[-1] = risk - 1.0  # intrabar low crosses below risk → stop triggered

    df = make_df(closes, highs=highs, lows=lows)
    trades = _compute_trades(df)

    buy_trades = [t for t in trades if t.direction == "buy"]
    assert len(buy_trades) >= 1, "Expected at least one buy trade"
    assert buy_trades[0].exit_type == "risk_level", "Should exit at risk_level"
    assert buy_trades[0].exit_price == risk, f"exit_price should equal risk {risk}"
    assert buy_trades[0].pnl_close_pct is not None, "pnl_close_pct should be set"
    assert buy_trades[0].pnl_close_pct < 0, "Stop exit should produce negative PnL"


def test_pnl_end_of_data_no_stop():
    """Buy trade with no stop hit → exit_type=end_of_data, pnl=None."""
    closes = buy_setup_closes(pre=4, length=9)
    risk = _get_buy_setup_risk(closes)

    # All subsequent bars stay well above risk → no stop hit
    for _ in range(5):
        closes.append(risk + 100.0)

    df = make_df(closes)
    trades = _compute_trades(df)

    buy_trades = [t for t in trades if t.direction == "buy"]
    assert len(buy_trades) >= 1, "Expected at least one buy trade"
    assert buy_trades[0].exit_type == "end_of_data"
    assert buy_trades[0].pnl_close_pct is None, "Unrealized trade has no PnL"
    assert buy_trades[0].exit_bars is None
