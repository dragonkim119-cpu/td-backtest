from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class CountdownState:
    active: bool = False
    count: int = 0
    deferred: bool = False  # waiting for 13 vs 8 to clear
    bar8_close: float | None = None  # close at countdown bar 8
    bars: list[int] = field(default_factory=list)  # bar indices of counted bars
