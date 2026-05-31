from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import candles, backtest

app = FastAPI(title="TD Backtest API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(candles.router, prefix="/api")
app.include_router(backtest.router, prefix="/api")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
