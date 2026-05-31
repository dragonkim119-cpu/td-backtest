# 05_ROADMAP.md — 구현 로드맵

## Phase 1 (현재) — 4단계

### 단계 1: 백엔드 코어 (인디케이터 + 데이터)

**목표:** CLI에서 `python -m app.indicators.td_sequential <parquet_path>` 로 시그널 리스트를 출력할 수 있어야 함.

체크리스트:
- [ ] `backend/pyproject.toml` 셋업 (uv, fastapi, pandas, numpy, pyarrow, httpx, pydantic, pytest, ruff)
- [ ] `app/data/binance.py` — Binance Futures REST `/fapi/v1/klines` 호출, 1500봉 페이지네이션, Parquet 저장/로드
- [ ] `app/indicators/td_setup.py` — Buy/Sell Setup 9 카운트, Perfected
- [ ] `app/indicators/td_setup.py` — TDST Support/Resistance 계산
- [ ] `app/indicators/td_countdown.py` — Buy/Sell Countdown 13 카운트, 13 vs 8 Deferral, 8 vs 5 메타
- [ ] `app/indicators/td_sequential.py` — Cancellation (반대 Setup, TDST 위반) 통합
- [ ] `app/indicators/td_sequential.py` — Recycling (22 extended, size 100~200%) 통합
- [ ] `app/indicators/td_sequential.py` — Risk Level + 12 Bar Metric
- [ ] `app/backtest/engine.py` — 시그널마다 N봉 후 가격/수익률 계산
- [ ] `tests/test_setup.py`, `tests/test_countdown.py`, `tests/test_cancellation.py`, `tests/test_recycling.py`

**검증 기준:**
- 알려진 차트 예시(예: TradingView TD Sequential 공식 인디케이터 결과)와 Setup 9 위치 일치
- 단위 테스트 통과 (각 모듈 1개 이상)

---

### 단계 2: FastAPI 엔드포인트

**목표:** `GET /api/backtest?symbol=...&interval=...&start=...&end=...` 로 백테스트 결과 JSON 반환.

체크리스트:
- [ ] `app/main.py` — FastAPI 앱, CORS (`localhost:3000`)
- [ ] `app/api/candles.py` — 캔들 조회 엔드포인트
- [ ] `app/api/backtest.py` — 백테스트 실행 + 결과 반환
- [ ] `app/models/schemas.py` — `04_DATA_MODEL.md` 의 Pydantic 모델
- [ ] SQLite 시그널 저장/조회

**검증 기준:**
- `curl` 로 응답 JSON 수신 확인
- 같은 기간 재요청 시 Parquet 캐시 동작 확인

---

### 단계 3: 프론트 차트 + TD 오버레이

**목표:** Next.js 페이지에서 심볼/인터벌/기간 선택 → 캔들 + TD 시그널이 그려진 차트 표시.

체크리스트:
- [ ] `frontend/package.json` — Next.js 14, TS, Tailwind, shadcn/ui, lightweight-charts
- [ ] `components/chart/CandleChart.tsx` — Lightweight Charts 래퍼
- [ ] `components/overlays/SetupNumbers.tsx` — Setup 1~9 숫자 (Lightweight Charts `setMarkers`)
- [ ] `components/overlays/CountdownNumbers.tsx` — Countdown 1~13
- [ ] `components/overlays/PerfectArrow.tsx` — Perfected 화살표
- [ ] `components/overlays/TDSTLines.tsx` — Lightweight Charts `createPriceLine` 활용
- [ ] `components/overlays/CompletionArrow.tsx` — 13 완성 시 큰 화살표
- [ ] `app/page.tsx` — 메인 대시보드 (심볼·인터벌·기간 선택 폼 + 차트)
- [ ] `lib/api.ts` — 백엔드 호출 헬퍼

**검증 기준:**
- 차트 위에 TD 숫자와 화살표가 올바른 위치에 나타남
- TDST 라인이 Setup 완성 위치에 그어짐

---

### 단계 4: 시그널 리포트 UI

**목표:** 차트 우측에 시그널 목록과 시그널 이후 성과 통계 표시.

체크리스트:
- [ ] `components/backtest/SignalList.tsx` — 시그널 시간순 테이블 (클릭 시 차트 해당 봉으로 이동)
- [ ] `components/backtest/StatsCard.tsx` — 시그널 타입별 통계 (총 개수, 5/10/20봉 승률, 평균 수익률)
- [ ] `components/backtest/ReturnHistogram.tsx` — 시그널 이후 수익률 분포 히스토그램
- [ ] 필터: Perfected만, Deferral 만족만, 방향별
- [ ] CSV export 버튼

**검증 기준:**
- 시그널 클릭 시 차트가 해당 봉으로 스크롤
- 통계가 시그널 타입별로 올바르게 집계

---

## Phase 2 (이후 — 현재 범위 외)

- 실시간 WebSocket 캔들 업데이트 (Binance `wss://fstream.binance.com`)
- TD 시그널 발생 시 텔레그램/Discord 알림
- 실제 진입/청산 룰 기반 백테스트 엔진 (사용자가 룰을 명시한 후)
- 멀티 심볼 스크리너
- 다른 거래소 지원 (Bybit, OKX)

---

## 작업 시작 시

1. Claude Code CLI에서 이 프로젝트 디렉토리 열기
2. `CLAUDE.md` 읽기 명령
3. **단계 1부터 순서대로 진행** — 단계 건너뛰지 말 것
4. 각 단계 시작 전 해당 docs 파일 다시 읽기
5. 단계 종료 시 검증 기준 통과 확인 후 다음 단계로
