# CLAUDE.md — td-backtest

**작업 전 반드시 이 파일과 `docs/` 디렉토리의 모든 문서를 읽으세요.**

---

## 프로젝트 한 줄 요약

**개인용 DeMark TD Sequential 백테스팅 웹 대시보드** — 비트코인 선물(Binance Futures, BTCUSDT) 과거 데이터에서 TD Sequential 9-13 시그널(Setup, Countdown, TDST, Recycling, Cancellation 포함)을 자동 검출하고 시그널 발생 위치를 차트와 리포트로 시각화합니다.

## 현재 단계

**Phase 1 (시그널 검출 + 백테스트 시각화)** — 실시간/알림/실제 진입 룰 기반 PnL 계산은 **구현하지 마세요**. Phase 2 작업입니다.

## 핵심 우선순위 (절대 순서)

1. 데이터 파이프라인 (Binance kline 수집 → Parquet 저장)
2. TD 인디케이터 엔진 (Setup → Perfected → TDST → Countdown → Deferral → Recycling → Cancellation 순)
3. 차트 렌더링 + TD 오버레이 (숫자, 화살표, TDST 라인)
4. 시그널 리포트 UI (시그널 목록, 통계, 시그널 이후 N봉 가격 변화)

## 기술 스택 (확정)

| 레이어 | 선택 |
|---|---|
| 백엔드 | Python 3.11+, FastAPI, pandas, numpy, pyarrow |
| 프론트 | Next.js 14+ (App Router), TypeScript, Tailwind, shadcn/ui |
| 차트 | TradingView Lightweight Charts (v4+) |
| 데이터 저장 | Parquet (캔들), SQLite (시그널 기록) |
| 데이터 소스 | Binance Futures REST API (`/fapi/v1/klines`) |
| 패키지 매니저 | `uv` (Python), `pnpm` (JS) |

## 디렉토리 구조 (기대값)

```
td-backtest/
├── CLAUDE.md                # 이 파일
├── README.md
├── docs/                    # 스펙 문서 (작업 시 반드시 참조)
│   ├── 01_SPEC.md
│   ├── 02_TD_LOGIC.md       # TD Sequential 알고리즘 (핵심)
│   ├── 03_BACKTEST.md       # 시그널 기록 룰
│   ├── 04_DATA_MODEL.md
│   └── 05_ROADMAP.md
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py          # FastAPI 엔트리
│   │   ├── api/             # 라우터
│   │   ├── data/            # Binance 수집 + Parquet I/O
│   │   ├── indicators/      # TD Setup, Countdown, TDST, Recycling 검출
│   │   ├── backtest/        # 시그널 수집 + 통계
│   │   └── models/          # Pydantic 스키마
│   ├── tests/
│   └── data/                # Parquet 파일 저장 디렉토리
└── frontend/
    ├── package.json
    ├── app/
    │   ├── page.tsx
    │   └── api/
    ├── components/
    │   ├── chart/           # Lightweight Charts 래퍼
    │   ├── overlays/        # TD 숫자/화살표/TDST 라인 오버레이
    │   └── backtest/        # 시그널 리포트 UI
    └── lib/
```

## 코딩 컨벤션

### Python (backend)
- 타입 힌트 필수 (`from __future__ import annotations` 사용)
- Pydantic 모델로 데이터 구조 정의 (`models/` 하위)
- TD 검출 함수는 순수 함수로 (입력 캔들 DataFrame → 출력 시그널 리스트)
- 인디케이터 모듈은 `tests/` 에 단위 테스트 1개 이상 (특히 Setup/Countdown 카운팅)
- 포매터: `ruff format`, 린터: `ruff check`

### TypeScript (frontend)
- `strict: true`
- 컴포넌트는 함수형 + named export
- 상태관리는 일단 React state로만
- 스타일: Tailwind 유틸리티 우선

## 절대 금지 사항

- ❌ Phase 1에서 WebSocket / 실시간 데이터 / 텔레그램 / 알림 시스템 구현
- ❌ 인증/로그인/멀티 유저 기능 (개인용)
- ❌ 진입가/청산가 기반 PnL 계산 — **시그널 발생 위치만 기록**
- ❌ 사용자가 요청하지 않은 추상화 (예: 거래소 abstract base class — Binance만 쓸 거임)
- ❌ TD 외 다른 인디케이터 추가 (RSI, MACD, 이동평균 등)
- ❌ Docker 컨테이너화 (Phase 1 종료 후 검토)
- ❌ `docs/` 내용에 모순되는 구현 — 모순 발견 시 작업 멈추고 사용자에게 질문

## 작업 흐름

1. 새 모듈 작성 전: 관련 docs 파일 다시 읽기
2. TD 검출 알고리즘은 **반드시 `docs/02_TD_LOGIC.md`의 의사 코드와 규칙 그대로** 구현
3. 시그널 기록 룰은 **반드시 `docs/03_BACKTEST.md`** 따르기
4. 데이터 스키마 변경 필요 시 → `docs/04_DATA_MODEL.md` 먼저 갱신 후 코드 반영
5. 불명확한 요구사항은 구현 전에 사용자에게 질문 (특히 Recycling/Cancellation 경계 조건)
