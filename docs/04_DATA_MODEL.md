# 04_DATA_MODEL.md — 데이터 모델

## 캔들 (Parquet)

파일 경로: `backend/data/{symbol}_{interval}.parquet`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `open_time` | int64 (ms) | 봉 시작 시각 |
| `open` | float64 | |
| `high` | float64 | |
| `low` | float64 | |
| `close` | float64 | |
| `volume` | float64 | |
| `close_time` | int64 (ms) | |

`open_time` 기준 정렬·유일. 동일 심볼·인터벌 재요청 시 파일 read → 부족한 기간만 추가 fetch.

## 시그널 (SQLite)

DB 파일: `backend/data/signals.db`

### `signals` 테이블

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | INTEGER PK | |
| `symbol` | TEXT | `BTCUSDT` |
| `interval` | TEXT | `1h`, `4h`, `1d` 등 |
| `bar_time` | INTEGER | 시그널 봉 `open_time` (ms) |
| `bar_index` | INTEGER | 백테스트 실행 시 캔들 배열 내 위치 |
| `type` | TEXT | `buy_setup_9`, `sell_setup_9`, `buy_countdown_13`, `sell_countdown_13`, `recycle`, `cancel` |
| `direction` | TEXT | `buy`, `sell` |
| `entry_price` | REAL | 시그널 봉 close |
| `perfected` | INTEGER | 0/1, Setup 시그널만 |
| `deferral` | INTEGER | 0/1, Countdown 시그널만 |
| `deferral_8v5` | INTEGER | 0/1 |
| `risk_level` | REAL | nullable |
| `tdst_level` | REAL | nullable |
| `recycle_reason` | TEXT | `extended`, `size_match`, nullable |
| `cancel_reason` | TEXT | `opposite_setup`, `tdst_violation`, nullable |
| `price_after_5` | REAL | nullable |
| `price_after_10` | REAL | nullable |
| `price_after_20` | REAL | nullable |
| `return_5` | REAL | nullable |
| `return_10` | REAL | nullable |
| `return_20` | REAL | nullable |
| `max_favorable_20` | REAL | nullable |
| `max_adverse_20` | REAL | nullable |
| `created_at` | INTEGER | 기록 시각 (ms) |

인덱스: `(symbol, interval, bar_time)`.

## Pydantic 모델 (백엔드 ↔ 프론트)

```python
class Candle(BaseModel):
    open_time: int
    open: float
    high: float
    low: float
    close: float
    volume: float

class Signal(BaseModel):
    type: Literal["buy_setup_9", "sell_setup_9",
                  "buy_countdown_13", "sell_countdown_13",
                  "recycle", "cancel"]
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
    end_bar_time: int | None = None  # 다음 같은 방향 Setup 완성까지

class BacktestResult(BaseModel):
    symbol: str
    interval: str
    start_time: int
    end_time: int
    signals: list[Signal]
    tdst_lines: list[TDSTLine]
    setup_counts: list[int]      # 각 봉의 setup count (음수=sell, 양수=buy, 차트 라벨용)
    countdown_counts: list[int]  # 각 봉의 countdown count
```

## API 응답 예시

`GET /api/backtest?symbol=BTCUSDT&interval=4h&start=...&end=...`

```json
{
  "symbol": "BTCUSDT",
  "interval": "4h",
  "candles": [...],
  "signals": [...],
  "tdst_lines": [...],
  "setup_counts": [...],
  "countdown_counts": [...],
  "stats": {
    "buy_setup_9": {"count": 12, "win_rate_20": 0.58, "avg_return_20": 0.024},
    "sell_setup_9": {...},
    "buy_countdown_13": {...},
    "sell_countdown_13": {...}
  }
}
```
