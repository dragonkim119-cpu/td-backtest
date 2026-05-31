from __future__ import annotations

import asyncio
import json
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._stream_tasks: dict[str, asyncio.Task] = {}

    def add(self, key: str, ws: WebSocket) -> None:
        self._connections[key].add(ws)

    def remove(self, key: str, ws: WebSocket) -> None:
        self._connections[key].discard(ws)

    def count(self, key: str) -> int:
        return len(self._connections[key])

    async def broadcast(self, key: str, payload: dict) -> None:
        dead: list[WebSocket] = []
        text = json.dumps(payload)
        for ws in list(self._connections[key]):
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections[key].discard(ws)

    def set_task(self, key: str, task: asyncio.Task) -> None:
        self._stream_tasks[key] = task

    def get_task(self, key: str) -> asyncio.Task | None:
        return self._stream_tasks.get(key)

    def clear_task(self, key: str) -> None:
        self._stream_tasks.pop(key, None)


manager = ConnectionManager()
