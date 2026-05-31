# 01_SPEC.md — 프로젝트 스펙

## 목적

DeMark TD Sequential 인디케이터(9-13)를 비트코인 선물 차트에 적용해, **과거 데이터에서 시그널이 어디에 발생했는지** 검증하고 그 이후 가격이 어떻게 움직였는지 시각적으로 확인하기 위한 개인용 백테스팅 도구.

## 출처

- DeMark 공식 설명: https://demark.com/9-13/
- 참고 구현: https://github.com/txjohnny5/Tom-Demark-Indicator (Setup/Countdown 기본 로직)

## 사용 시나리오

1. 사용자가 심볼 (`BTCUSDT`), 타임프레임 (1h, 4h, 1d 등), 기간 선택
2. 백엔드가 Binance에서 캔들 수집 → Parquet 캐시 → TD 시그널 계산
3. 프론트가 캔들 차트 위에 다음을 오버레이:
   - Setup 1~9 숫자 (매수: 캔들 아래 녹색, 매도: 캔들 위 빨강)
   - Perfected Setup 화살표
   - TDST 수평선 (Support/Resistance)
   - Countdown 1~13 숫자
   - Countdown 완성 시 큰 화살표
   - Deferral (`+`) 표시
   - Recycling 발생 위치 마커
   - Cancellation 발생 시 해당 Countdown 제거 표시
4. 우측 패널에 시그널 목록과 시그널 이후 N봉(예: 5/10/20봉) 가격 변화율 통계

## 기능 범위 (Phase 1)

| 기능 | 포함 |
|---|---|
| Binance Futures 캔들 수집 (REST) | ✅ |
| Parquet 캐시 | ✅ |
| TD Setup (Buy/Sell, Perfected) | ✅ |
| TDST (Support/Resistance) | ✅ |
| TD Countdown (Buy/Sell) | ✅ |
| Countdown Deferral (13 vs 8, 8 vs 5) | ✅ |
| Recycling (22 카운트 / 100~200% 크기) | ✅ |
| Cancellation (반대 Setup / TDST 위반) | ✅ |
| Risk Level 계산 | ✅ |
| 12 Bar Metric 표시 | ✅ |
| 차트 오버레이 (숫자, 화살표, TDST 라인) | ✅ |
| 시그널 발생 후 N봉 통계 (수익률 분포, 승률) | ✅ |
| 실제 진입/청산 룰 기반 PnL | ❌ Phase 2 |
| 실시간 WebSocket | ❌ Phase 2 |
| 알림 (텔레그램) | ❌ Phase 2 |
| 다른 거래소 지원 | ❌ Phase 2 |

## 비기능 요구사항

- 1년치 1h 데이터(~8760봉) 처리에서 시그널 계산 1초 이하
- 차트 렌더링 부드러움 (Lightweight Charts 기본 성능 활용)
- Parquet 캐시로 같은 기간 재요청 시 즉시 응답
