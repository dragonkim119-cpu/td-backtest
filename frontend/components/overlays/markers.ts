import type { SeriesMarker, Time } from "lightweight-charts";
import type { Signal } from "@/lib/api";

export function buildMarkers(signals: Signal[]): SeriesMarker<Time>[] {
  const markers: SeriesMarker<Time>[] = [];

  for (const sig of signals) {
    const time = (sig.bar_time / 1000) as Time;
    const isBuy = sig.direction === "buy";

    switch (sig.type) {
      case "buy_setup_9":
      case "sell_setup_9": {
        // Large setup 9 number + perfected indicator
        const label = sig.perfected ? "9✓" : "9";
        markers.push({
          time,
          position: isBuy ? "belowBar" : "aboveBar",
          color: isBuy ? "#22c55e" : "#ef4444",
          shape: "circle",
          text: label,
          size: 1,
        });
        break;
      }

      case "buy_countdown_13":
      case "sell_countdown_13": {
        const label = sig.deferral ? "13+" : "13▲";
        markers.push({
          time,
          position: isBuy ? "belowBar" : "aboveBar",
          color: isBuy ? "#16a34a" : "#dc2626",
          shape: "arrowUp",
          text: label,
          size: 2,
        });
        break;
      }

      case "recycle": {
        markers.push({
          time,
          position: isBuy ? "belowBar" : "aboveBar",
          color: "#f59e0b",
          shape: "circle",
          text: "R",
          size: 1,
        });
        break;
      }

      case "cancel": {
        markers.push({
          time,
          position: isBuy ? "belowBar" : "aboveBar",
          color: "#6b7280",
          shape: "circle",
          text: "✕",
          size: 1,
        });
        break;
      }
    }
  }

  // Lightweight Charts requires markers sorted by time
  markers.sort((a, b) => (a.time as number) - (b.time as number));
  return markers;
}

export function buildSetupCountMarkers(
  setupCounts: number[],
  candles: { open_time: number }[]
): SeriesMarker<Time>[] {
  const markers: SeriesMarker<Time>[] = [];
  for (let i = 0; i < setupCounts.length; i++) {
    const count = setupCounts[i];
    if (count === 0 || count === 9) continue; // 9 handled separately, 0 skip
    const time = (candles[i].open_time / 1000) as Time;
    const isBuy = count > 0;
    const num = Math.abs(count);
    markers.push({
      time,
      position: isBuy ? "belowBar" : "aboveBar",
      color: isBuy ? "#86efac" : "#fca5a5",
      shape: "circle",
      text: String(num),
      size: 0,
    });
  }
  markers.sort((a, b) => (a.time as number) - (b.time as number));
  return markers;
}

export function buildCountdownCountMarkers(
  countdownCounts: number[],
  candles: { open_time: number }[]
): SeriesMarker<Time>[] {
  const markers: SeriesMarker<Time>[] = [];
  for (let i = 0; i < countdownCounts.length; i++) {
    const count = countdownCounts[i];
    if (count === 0) continue;
    const time = (candles[i].open_time / 1000) as Time;
    const isBuy = count > 0;
    const num = Math.abs(count);
    markers.push({
      time,
      position: isBuy ? "belowBar" : "aboveBar",
      color: isBuy ? "#4ade80" : "#f87171",
      shape: "circle",
      text: String(num),
      size: 0,
    });
  }
  markers.sort((a, b) => (a.time as number) - (b.time as number));
  return markers;
}
