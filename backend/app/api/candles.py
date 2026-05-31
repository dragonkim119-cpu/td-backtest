from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.data.binance import get_candles
from app.models.schemas import Candle

router = APIRouter()


@router.get("/candles", response_model=list[Candle])
def get_candles_endpoint(
    symbol: str = Query("BTCUSDT"),
    interval: str = Query("4h"),
    start: int = Query(..., description="Start time ms epoch"),
    end: int = Query(..., description="End time ms epoch"),
) -> list[Candle]:
    if start >= end:
        raise HTTPException(status_code=400, detail="start must be < end")
    df = get_candles(symbol, interval, start, end)
    return [
        Candle(
            open_time=int(row["open_time"]),
            open=float(row["open"]),
            high=float(row["high"]),
            low=float(row["low"]),
            close=float(row["close"]),
            volume=float(row["volume"]),
        )
        for _, row in df.iterrows()
    ]
