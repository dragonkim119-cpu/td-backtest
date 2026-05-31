# CLAUDE.md — td-backtest

**작업 전 반드시 이 파일과 `docs/` 디렉토리의 모든 문서를 읽으세요.**

---

## 프로젝트 한 줄 요약

**개인용 DeMark TD Sequential 백테스팅 웹 대시보드** — 비트코인 선물(Binance Futures, BTCUSDT) 과거 데이터에서 TD Sequential 9-13 시그널(Setup, Countdown, TDST, Recycling, Cancellation 포함)을 자동 검출하고 시그널 발생 위치를 차트와 리포트로 시각화합니다.

---

## 현재 단계

**Phase 1 완료 (2026-05-31)** — 4단계 모두 구현·테스트·브라우저 동작 확인됨.

Phase 2 (실시간/알림/PnL) 는 아직 시작하지 않음.

---

## 서버 실행 방법

```powershell
# 백엔드 (포트 8000)
cd D:\invest_program\td-backtest\backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000

# 프론트엔드 (포트 3000)
cd D:\invest_program\td-backtest\frontend
.\node_modules\.bin\next dev --port 3000
```

브라우저: `http://localhost:3000`

---

## 실제 디렉토리 구조 (구현 완료 기준)

```
td-backtest/
├── CLAUDE.md
├── .gitignore
├── docs/
│   ├── 01_SPEC.md
│   ├── 02_TD_LOGIC.md        ← TD 알고리즘 단일 진실 공급원
│   ├── 03_BACKTEST.md
│   ├── 04_DATA_MODEL.md
│   └── 05_ROADMAP.md
├── backend/
│   ├── pyproject.toml         # uv 관리, orjson 포함
│   ├── .env.example
│   ├── app/
│   │   ├── main.py            # FastAPI + CORS(localhost:3000)
│   │   ├── api/
│   │   │   ├── backtest.py    # GET /api/backtest → ORJSONResponse
│   │   │   └── candles.py     # GET /api/candles
│   │   ├── data/
│   │   │   └── binance.py     # Binance REST + Parquet 캐시
│   │   ├── indicators/
│   │   │   ├── td_setup.py      # Buy/Sell Setup 9, Perfected, TDST
│   │   │   ├── td_countdown.py  # Countdown 13, 13vs8 Deferral, 8vs5
│   │   │   └── td_sequential.py # Cancellation, Recycling, Risk Level (통합)
│   │   ├── backtest/
│   │   │   └── engine.py      # N봉 수익률 + SQLite 저장(백그라운드 스레드)
│   │   └── models/
│   │       └── schemas.py     # Pydantic: Candle, Signal, TDSTLine, BacktestResult
│   ├── tests/
│   │   ├── conftest.py        # buy_setup_closes(), sell_setup_closes(), make_df()
│   │   ├── test_setup.py
│   │   ├── test_countdown.py
│   │   ├── test_cancellation.py
│   │   └── test_recycling.py
│   └── data/                  # Parquet·SQLite (gitignore됨, .gitkeep 있음)
└── frontend/
    ├── package.json           # Next.js 16, lightweight-charts 5.2.0
    ├── .env.local.example
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx           # 메인 대시보드 (폼 + 차트 + 우측 패널)
    │   └── globals.css        # 다크 트레이딩 테마
    ├── components/
    │   ├── chart/
    │   │   └── CandleChart.tsx      # Lightweight Charts v5 래퍼
    │   ├── overlays/
    │   │   └── markers.ts           # createSeriesMarkers() 데이터 생성
    │   └── backtest/
    │       ├── SignalList.tsx        # 필터 + CSV export + 시그널 테이블
    │       ├── StatsCard.tsx         # 타입별 통계 + 히스토그램 (클릭 펼침)
    │       └── ReturnHistogram.tsx   # 순수 CSS 수익률 분포 히스토그램
    └── lib/
        ├── api.ts             # fetchBacktest()
        └── csv.ts             # exportSignalsCsv()
```

---

## 핵심 기술 결정 (다음 세션에서 변경 금지)

| 항목 | 결정 | 이유 |
|---|---|---|
| `series.setMarkers()` | **사용 불가** — `createSeriesMarkers(series, markers)` 사용 | lightweight-charts v5 API 변경 |
| Candle 직렬화 | `df.to_dict("records")` + `Candle.model_validate()` | `iterrows()` 대비 7배 빠름 |
| SQLite write | 백그라운드 스레드 (`threading.Thread`) | API 응답 차단 방지 |
| JSON 직렬화 | `ORJSONResponse` + `result.model_dump()` | 기본 FastAPI 직렬화보다 빠름 |
| pnpm 설치 | `--ignore-scripts` 필수 | msw 빌드 스크립트 차단 문제 |

---

## 성능 기준 (달성됨)

- 1y 1h (8760봉) 캐시 히트: **~900ms** (스펙: 1s 이내 ✓)
- TD 계산 (8760봉): ~19ms
- Parquet read+filter: ~42ms

---

## 테스트 실행

```powershell
cd D:\invest_program\td-backtest\backend
uv run pytest tests/ -q
# → 10 passed
```

---

## 기술 스택 (확정)

| 레이어 | 선택 |
|---|---|
| 백엔드 | Python 3.14, FastAPI, pandas, numpy, pyarrow, orjson |
| 프론트 | Next.js 16 (App Router), TypeScript, Tailwind v4 |
| 차트 | TradingView Lightweight Charts **v5.2.0** |
| 데이터 저장 | Parquet (캔들), SQLite (시그널 기록) |
| 데이터 소스 | Binance Futures REST API (`/fapi/v1/klines`) |
| 패키지 매니저 | `uv` (Python), `pnpm` (JS, `--ignore-scripts` 필요) |

---

## 코딩 컨벤션

### Python (backend)
- 타입 힌트 필수 (`from __future__ import annotations` 사용)
- Pydantic 모델로 데이터 구조 정의 (`models/` 하위)
- TD 검출 함수는 순수 함수로 (입력 캔들 DataFrame → 출력 시그널 리스트)
- 인디케이터 모듈은 `tests/` 에 단위 테스트 1개 이상
- 포매터: `ruff format`, 린터: `ruff check`

### TypeScript (frontend)
- `strict: true`
- 컴포넌트는 함수형 + named export
- 상태관리는 React state만
- 스타일: Tailwind 유틸리티 우선

---

## 절대 금지 사항

- ❌ Phase 2 기능 (WebSocket / 실시간 / 텔레그램 / 알림)
- ❌ 인증/로그인/멀티 유저 기능 (개인용)
- ❌ 진입가/청산가 기반 PnL 계산 — **시그널 발생 위치만 기록**
- ❌ 사용자가 요청하지 않은 추상화
- ❌ TD 외 다른 인디케이터 추가 (RSI, MACD 등)
- ❌ Docker 컨테이너화 (미정)
- ❌ `docs/` 내용에 모순되는 구현 — 모순 발견 시 작업 멈추고 사용자에게 질문

---

## 작업 흐름

1. 새 모듈 작성 전: 관련 docs 파일 다시 읽기
2. TD 알고리즘 → **반드시 `docs/02_TD_LOGIC.md` 의사 코드 그대로**
3. 시그널 기록 룰 → **반드시 `docs/03_BACKTEST.md`**
4. 데이터 스키마 변경 → `docs/04_DATA_MODEL.md` 먼저 갱신 후 코드 반영
5. 불명확한 요구사항 → 구현 전 사용자에게 질문

---

## Phase 2 예정 항목 (현재 범위 외)

- 실시간 WebSocket 캔들 업데이트 (Binance `wss://fstream.binance.com`)
- TD 시그널 발생 시 텔레그램/Discord 알림
- 실제 진입/청산 룰 기반 백테스트 엔진
- 멀티 심볼 스크리너
