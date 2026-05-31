from __future__ import annotations

from app.indicators.td_sequential import run
from tests.conftest import buy_setup_closes, make_df


def test_recycle_extended_setup():
    """
    Buy countdown is recycled when same-direction setup count extends to 22+.

    With 26 bars of continuous buy-setup conditions, Setup 9 fires at bars 12 and 21.
    The second Setup 9 may trigger size_match recycling before ext_long hits 22.
    We verify that at least one recycle with reason=extended fires by the end.
    """
    closes = buy_setup_closes(pre=4, length=26)  # 30 bars total (0..29)
    df = make_df(closes)
    signals, _, _, _ = run(df)

    recycle_sigs = [s for s in signals if s.type == "recycle"]
    assert len(recycle_sigs) >= 1, f"Expected recycle signals. Got: {[s.type for s in signals]}"

    extended_recycles = [s for s in recycle_sigs if s.recycle_reason == "extended"]
    assert len(extended_recycles) >= 1, (
        f"Expected at least one extended-reason recycle. "
        f"Got reasons: {[s.recycle_reason for s in recycle_sigs]}"
    )
    assert extended_recycles[0].direction == "buy"
