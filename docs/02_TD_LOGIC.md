# 02_TD_LOGIC.md — TD Sequential 알고리즘

> 이 문서는 **구현의 단일 진실 공급원(single source of truth)**. 코드와 모순이 생기면 이 문서를 먼저 갱신할 것.
>
> 출처: https://demark.com/9-13/

---

## 용어

- `c[i]` = i번째 봉의 close
- `h[i]` = high, `l[i]` = low
- `True High` = max(현재 봉 high, 직전 봉 close)
- `True Low` = min(현재 봉 low, 직전 봉 close)

---

## 1. Setup Phase (9 카운트)

### Buy Setup
- 조건: `c[i] < c[i-4]` 가 **9봉 연속** 성립
- 9번째 봉에서 Setup 완성
- 중간에 조건 깨지면 카운트 0으로 리셋

### Sell Setup
- 조건: `c[i] > c[i-4]` 가 **9봉 연속** 성립
- 동일하게 9봉째 완성

### 의사 코드

```
long_count = 0
short_count = 0
for i in range(len(candles)):
    if i < 4:
        long_count = 0
        short_count = 0
        continue
    if long_count > 9: long_count = 0
    if short_count > 9: short_count = 0

    if c[i] < c[i-4]:
        long_count += 1
        short_count = 0
    elif c[i] > c[i-4]:
        short_count += 1
        long_count = 0
    else:
        long_count = 0
        short_count = 0

    setup_buy[i]  = long_count   # 1~9
    setup_sell[i] = short_count  # 1~9
```

---

## 2. Perfected Setup

Setup이 9를 완성한 시점에서 추가 검증.

### Buy Perfected
- 8 또는 9번째 봉의 **low**가 6 또는 7번째 봉의 **low**보다 낮거나 같아야 함
- `min(l[8th], l[9th]) <= min(l[6th], l[7th])`
- 미충족이면 "Im-perfected", 이후 봉에서 충족되면 그때 Perfected 처리

### Sell Perfected
- 8 또는 9번째 봉의 **high**가 6 또는 7번째 봉의 **high**보다 높거나 같아야 함
- `max(h[8th], h[9th]) >= max(h[6th], h[7th])`

Perfected가 확정되는 봉 위치에 화살표 표시.

---

## 3. TDST (TD Setup Trend)

Setup 완성 시 다음 레벨 생성:

### TDST Support (Buy Setup 완성 시)
- Setup 9봉 구간의 **lowest True Low**
- 이후 추세 지지선 역할

### TDST Resistance (Sell Setup 완성 시)
- Setup 9봉 구간의 **highest True High**

새로운 Setup이 같은 방향으로 완성되면 TDST 갱신.

---

## 4. Countdown Phase (13 카운트)

Setup이 완성된 직후부터 시작. **비연속 카운트**.

### Buy Countdown
- 조건: `c[i] <= l[i-2]`
- 조건 만족할 때마다 카운트 +1, 만족 안 해도 카운트 유지 (리셋 X)
- 13봉째에 완성

### Sell Countdown
- 조건: `c[i] >= h[i-2]`
- 동일

### 의사 코드

```
buy_cd = 0
sell_cd = 0
buy_cd_active = False  # Buy Setup 완성 후 True
sell_cd_active = False

for i in range(len(candles)):
    if setup_buy[i] == 9:
        buy_cd_active = True
        buy_cd = 0
    if setup_sell[i] == 9:
        sell_cd_active = True
        sell_cd = 0

    if buy_cd_active and c[i] <= l[i-2]:
        buy_cd += 1
        # 13 vs 8 Deferral 검사 (아래 참조)
        if buy_cd == 13:
            if not deferral_ok_buy(i):
                buy_cd = 12  # 보류 (+)
                mark_deferral(i)
            else:
                signal_buy_13(i)
                buy_cd_active = False

    if sell_cd_active and c[i] >= h[i-2]:
        sell_cd += 1
        if sell_cd == 13:
            if not deferral_ok_sell(i):
                sell_cd = 12
                mark_deferral(i)
            else:
                signal_sell_13(i)
                sell_cd_active = False
```

---

## 5. Countdown Deferral

### 13 vs 8 룰 (필수)
- **Buy Countdown**: 13번 봉의 `low <= ` 8번 봉의 `close`
- **Sell Countdown**: 13번 봉의 `high >= ` 8번 봉의 `close`
- 미충족 시 13 확정 안 됨. 다음 봉에서 조건 만족 + 13 vs 8 만족할 때 확정. 보류 상태는 `+` 마커로 표시.

### 8 vs 5 룰 (선택, 강도 표시)
- **Buy**: 8번 봉의 `low <= ` 5번 봉의 `close`
- **Sell**: 8번 봉의 `high >= ` 5번 봉의 `close`
- 만족 시 시그널 품질 점수 가산 (시그널 메타데이터로 기록)

---

## 6. Recycling

Countdown 진행 중 같은 방향 새 Setup이 강하게 나타나면 Countdown을 **리셋**.

### 조건 1: Setup 연장 (Extended Setup)
- Countdown 활성 상태에서 같은 방향 Setup 카운트가 **22 이상** 도달
- → 진행 중 Countdown 캔슬, 시그널 메타에 `recycle_reason=extended` 기록

### 조건 2: 크기 비교 (Size Match)
- 새 Setup 크기 = (Setup 9봉의 highest true high − lowest true low)
- 새 Setup 크기가 **이전 Setup 크기의 100% ~ 200%** 사이
- → Countdown 리셋, `recycle_reason=size_match` 기록

---

## 7. Cancellation

Countdown이 13에 도달하기 전 다음 조건 발생 시 **차트에서 제거**:

### 조건 1: 반대 방향 Setup 완성
- Buy Countdown 진행 중 Sell Setup 9 완성 → Buy Countdown 캔슬
- 반대도 동일

### 조건 2: TDST 위반
- Buy Countdown 진행 중 봉의 **True High < TDST Resistance** (직전 추세의 저항선 아래로 내려옴)
  → 정확히는: 진행 중 Buy Countdown의 기준이 된 추세의 TDST Support가 깨졌을 때
- 구현 시 명확히: **Buy Countdown 진행 중, 어떤 봉의 True Low > 활성 TDST Upside** → 캔슬
- **Sell Countdown 진행 중, 어떤 봉의 True High < 활성 TDST Downside** → 캔슬
- ⚠️ 이 조건은 DeMark 공식 문서 문구가 다소 모호함. 구현 시 사용자에게 한 번 더 확인할 것.

---

## 8. Risk Level

### Countdown 13 Risk Level (원전 정의)

Countdown 13 완성 시 생성.

#### Buy 13 Risk Level
- Countdown 1~13 봉 구간에서 가장 낮은 True Low
- 그 봉의 True Range를 그 True Low에서 **아래로** 뺀 값
- `risk = lowest_true_low − true_range_at_that_bar`
- 의미: 이 가격 아래로 종가 마감 시 13 시그널 무효

#### Sell 13 Risk Level
- Countdown 1~13 봉 구간 highest True High
- True Range를 위로 더한 값
- `risk = highest_true_high + true_range_at_that_bar`

차트에 수평선으로 그림.

### Setup 9 Risk Level (PnL 백테스터용 확장)

> DeMark 원전에는 없는 정의. `buy_setup_9` / `sell_setup_9` 시그널 기준 손절선이 필요한
> PnL 백테스트(`/api/pnl-backtest`) 목적으로 동일 공식을 Setup 9-bar 윈도우에 적용.

#### Buy Setup 9 Risk Level
- Setup 9봉 구간(bar 1~9)에서 가장 낮은 True Low 봉 선택
- `risk = lowest_true_low − true_range_at_that_bar`

#### Sell Setup 9 Risk Level
- Setup 9봉 구간에서 가장 높은 True High 봉 선택
- `risk = highest_true_high + true_range_at_that_bar`

PnL 백테스터에서 이 값 아래(buy) / 위(sell)로 저가/고가가 닿으면 해당 봉에서 손절 처리.

---

## 9. 12 Bar Metric

- Countdown 13 완성 후 **12봉 이내**에 반전이 나타나야 시그널 유효
- 12봉 카운터를 시그널과 함께 저장, 차트에 카운터 표시 가능
- 12봉 경과 후 반전 없으면 시그널 만료 표시 (UI에서 회색 처리)

---

## 시그널 메타데이터 (출력 스키마)

각 시그널 객체:

```python
{
  "type": "buy_setup_9" | "sell_setup_9" |
          "buy_countdown_13" | "sell_countdown_13" |
          "buy_perfected" | "sell_perfected" |
          "recycle" | "cancel",
  "bar_index": int,
  "timestamp": int,         # ms epoch
  "price": float,           # 시그널 봉 close
  "perfected": bool | None, # setup 시그널만
  "deferral": bool,         # countdown 시그널만
  "deferral_8v5": bool,
  "risk_level": float | None,
  "tdst_level": float | None,
  "recycle_reason": "extended" | "size_match" | None,
  "cancel_reason": "opposite_setup" | "tdst_violation" | None,
}
```

---

## 구현 순서 (권장)

1. Setup (Buy/Sell) — 가장 단순
2. Perfected — Setup 위에 얹기
3. TDST — Setup 완성 시 계산
4. Countdown (Deferral 제외) — Setup 위에 얹기
5. Countdown Deferral (13 vs 8 필수, 8 vs 5 메타)
6. Cancellation (반대 Setup → TDST 위반 순)
7. Recycling (Extended → Size Match 순)
8. Risk Level + 12 Bar Metric

각 단계마다 단위 테스트 작성. DeMark 공식 차트 예시 또는 TradingView 공식 인디케이터와 결과 비교 권장.
