from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import ORJSONResponse

from app.data.binance import get_candles
from app.backtest.engine import run_backtest
from app.models.schemas import BacktestResult

router = APIRouter()


@router.get("/backtest")
def run_backtest_endpoint(
    symbol: str = Query("BTCUSDT"),
    interval: str = Query("4h"),
    start: int = Query(..., description="Start time ms epoch"),
    end: int = Query(..., description="End time ms epoch"),
) -> ORJSONResponse:
    if start >= end:
        raise HTTPException(status_code=400, detail="start must be < end")
    df = get_candles(symbol, interval, start, end)
    if df.empty:
        raise HTTPException(status_code=404, detail="No candle data found")
    result = run_backtest(symbol, interval, df, save_to_db=True)
    return ORJSONResponse(content=result.model_dump())
