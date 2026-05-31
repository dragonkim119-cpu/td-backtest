# 03_BACKTEST.md — 시그널 기록 룰

## 진입/청산 룰

**없음.** Phase 1에서는 실제 거래 시뮬레이션을 하지 않는다.

대신 시그널 발생 위치와 그 이후 가격 변화를 **기록만** 한다.

## 기록 대상 시그널

`docs/02_TD_LOGIC.md`의 시그널 메타데이터 스키마를 따른다. 다음 시그널 타입을 모두 기록:

- `buy_setup_9`, `sell_setup_9`
- `buy_perfected`, `sell_perfected` (Setup 시그널에 플래그로 합쳐도 됨)
- `buy_countdown_13`, `sell_countdown_13`
- `recycle`, `cancel` (이벤트 기록용)

## 시그널 이후 가격 변화 측정

각 시그널마다 다음을 계산해 함께 저장:

| 필드 | 정의 |
|---|---|
| `entry_price` | 시그널 봉 종가 |
| `price_after_5` | 5봉 후 종가 |
| `price_after_10` | 10봉 후 종가 |
| `price_after_20` | 20봉 후 종가 |
| `max_favorable_20` | 시그널 봉 이후 20봉 내 최대 유리 변동 (Buy면 high, Sell이면 low) |
| `max_adverse_20` | 시그널 봉 이후 20봉 내 최대 불리 변동 |
| `return_5`, `return_10`, `return_20` | 각 시점 수익률 (Buy: `(price − entry)/entry`, Sell: 반대 부호) |

데이터 끝부분 시그널은 N봉 부족하면 `null`.

## 집계 통계 (리포트용)

시그널 타입별로:
- 총 시그널 개수
- 양수 수익률 비율 (5봉/10봉/20봉)
- 평균 수익률, 중앙값, 표준편차
- 최대 유리/불리 변동 분포

Perfected Setup 여부, Deferral 여부 등 메타데이터로 그룹핑 가능하게.

## 저장

SQLite, 테이블 스키마 `docs/04_DATA_MODEL.md` 참조.

## 절대 금지

- ❌ 진입 후 청산 시뮬레이션 (스탑로스, 익절 등)
- ❌ 포지션 사이징, 자본 곡선
- ❌ 누적 PnL 계산

이런 것은 Phase 2에서 진입/청산 룰을 사용자가 명확히 정의한 후에 추가.
