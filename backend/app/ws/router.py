from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.ws.manager import manager
from app.ws.binance_stream import run_stream

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/candles")
async def ws_candles(
    ws: WebSocket,
    symbol: str = "BTCUSDT",
    interval: str = "1h",
) -> None:
    await ws.accept()
    key = f"{symbol}_{interval}"
    manager.add(key, ws)

    if manager.get_task(key) is None:
        task = asyncio.create_task(
            run_stream(symbol, interval, lambda p: manager.broadcast(key, p))
        )
        manager.set_task(key, task)
        logger.info("Started stream %s", key)

    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.remove(key, ws)
        if manager.count(key) == 0:
            task = manager.get_task(key)
            if task:
                task.cancel()
                manager.clear_task(key)
                logger.info("Stopped stream %s (no clients)", key)
