from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class Candle(BaseModel):
    open_time: int
    open: float
    high: float
    low: float
    close: float
    volume: float


class Signal(BaseModel):
    type: Literal[
        "buy_setup_9",
        "sell_setup_9",
        "buy_countdown_13",
        "sell_countdown_13",
        "recycle",
        "cancel",
    ]
    direction: Literal["buy", "sell"]
    bar_index: int
    bar_time: int
    entry_price: float
    perfected: bool | None = None
    deferral: bool = False
    deferral_8v5: bool = False
    risk_level: float | None = None
    tdst_level: float | None = None
    recycle_reason: Literal["extended", "size_match"] | None = None
    cancel_reason: Literal["opposite_setup", "tdst_violation"] | None = None
    price_after_5: float | None = None
    price_after_10: float | None = None
    price_after_20: float | None = None
    return_5: float | None = None
    return_10: float | None = None
    return_20: float | None = None
    max_favorable_20: float | None = None
    max_adverse_20: float | None = None


class TDSTLine(BaseModel):
    direction: Literal["support", "resistance"]
    level: float
    start_bar_time: int
    end_bar_time: int | None = None


class PnlTrade(BaseModel):
    signal_type: Literal["buy_setup_9", "sell_setup_9"]
    direction: Literal["buy", "sell"]
    bar_time: int
    risk_level: float
    perfected: bool | None = None
    # Entry at signal bar close
    entry_close: float
    # Entry at next bar open
    entry_next_open: float | None = None
    # Exit (same bar logic for both entries)
    exit_price: float | None = None
    exit_time: int | None = None
    exit_bars: int | None = None
    exit_type: Literal["risk_level", "opposite_setup", "end_of_data"] = "end_of_data"
    # P&L
    pnl_close_pct: float | None = None
    pnl_next_open_pct: float | None = None


class PnlStats(BaseModel):
    total: int
    won: int
    lost: int
    unrealized: int
    win_rate_pct: float | None = None
    avg_pnl_pct: float | None = None
    avg_win_pct: float | None = None
    avg_loss_pct: float | None = None
    max_win_pct: float | None = None
    max_loss_pct: float | None = None
    avg_bars_held: float | None = None


class PnlBacktestResult(BaseModel):
    symbol: str
    interval: str
    start_time: int
    end_time: int
    trades: list[PnlTrade]
    stats_close: PnlStats
    stats_next_open: PnlStats


class BacktestResult(BaseModel):
    symbol: str
    interval: str
    start_time: int
    end_time: int
    candles: list[Candle]
    signals: list[Signal]
    tdst_lines: list[TDSTLine]
    setup_counts: list[int]
    countdown_counts: list[int]
    stats: dict[str, dict]
