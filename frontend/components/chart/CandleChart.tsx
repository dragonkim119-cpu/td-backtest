"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  ColorType,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { BacktestResult } from "@/lib/api";
import type { LiveCandle, LiveCloseEvent } from "@/lib/useRealtimeCandle";
import {
  buildMarkers,
  buildSetupCountMarkers,
  buildCountdownCountMarkers,
} from "@/components/overlays/markers";

// Browser local timezone offset in seconds (e.g. KST = +32400)
const TZ_OFFSET_SEC = -new Date().getTimezoneOffset() * 60;

function toChartTime(ms: number): Time {
  return (ms / 1000 + TZ_OFFSET_SEC) as Time;
}

interface MarkersApi {
  markers(): readonly SeriesMarker<Time>[];
  setMarkers(markers: SeriesMarker<Time>[]): void;
}

interface Props {
  data: BacktestResult;
  focusBarIndex?: number | null;
  liveCandle?: LiveCandle | null;
  liveClose?: LiveCloseEvent | null;
  height?: number;
}

function fmtOhlcTime(chartTimeSec: number): string {
  // chartTimeSec is already TZ-adjusted; use UTC methods to read local values
  const d = new Date(chartTimeSec * 1000);
  const yy = String(d.getUTCFullYear()).slice(2);
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yy}년${m}월${day}일 ${hh}:${mm}`;
}

function fmtPrice(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CandleChart({
  data,
  focusBarIndex,
  liveCandle,
  liveClose,
  height = 560,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ohlcRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersApiRef = useRef<MarkersApi | null>(null);
  const liveZoomedRef = useRef(false);

  // Build chart once when data changes
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0f172a" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: "#334155", autoScale: true },
      timeScale: {
        borderColor: "#334155",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        tickMarkFormatter: (time: number, tickMarkType: TickMarkType) => {
          // time is already TZ-adjusted; use UTC methods
          const d = new Date(time * 1000);
          const yy = String(d.getUTCFullYear()).slice(2);
          const m = d.getUTCMonth() + 1;
          const day = d.getUTCDate();
          const hh = String(d.getUTCHours()).padStart(2, "0");
          const mm = String(d.getUTCMinutes()).padStart(2, "0");
          if (tickMarkType === TickMarkType.Year) return `${yy}년`;
          if (tickMarkType === TickMarkType.Month) return `${m}월`;
          if (tickMarkType === TickMarkType.DayOfMonth) return `${m}월${day}일`;
          return `${hh}:${mm}`;
        },
      },
      width: containerRef.current.clientWidth,
      height,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // OHLC + time tooltip
    chart.subscribeCrosshairMove((param) => {
      const el = ohlcRef.current;
      if (!el) return;
      if (param.time && param.seriesData.size > 0) {
        const bar = param.seriesData.get(series) as
          | { open: number; high: number; low: number; close: number }
          | undefined;
        if (bar) {
          const color = bar.close >= bar.open ? "#22c55e" : "#ef4444";
          const timeStr = fmtOhlcTime(param.time as number);
          el.innerHTML =
            `<span style="color:#64748b">${timeStr}</span>&nbsp;&nbsp;` +
            `<span style="color:${color}">` +
            `O <b>${fmtPrice(bar.open)}</b>&nbsp; ` +
            `H <b>${fmtPrice(bar.high)}</b>&nbsp; ` +
            `L <b>${fmtPrice(bar.low)}</b>&nbsp; ` +
            `C <b>${fmtPrice(bar.close)}</b>` +
            `</span>`;
          return;
        }
      }
      el.innerHTML = "";
    });

    // TZ-adjusted candles and signals for marker builders
    const adjCandles = data.candles.map((c) => ({
      ...c,
      open_time: c.open_time + TZ_OFFSET_SEC * 1000,
    }));
    const adjSignals = data.signals.map((s) => ({
      ...s,
      bar_time: s.bar_time + TZ_OFFSET_SEC * 1000,
    }));

    series.setData(
      adjCandles.map((c) => ({
        time: (c.open_time / 1000) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    const allMarkers = [
      ...buildSetupCountMarkers(data.setup_counts, adjCandles),
      ...buildCountdownCountMarkers(data.countdown_counts, adjCandles),
      ...buildMarkers(adjSignals),
    ].sort((a, b) => (a.time as number) - (b.time as number));

    markersApiRef.current = createSeriesMarkers(series, allMarkers) as MarkersApi;

    for (const tdst of data.tdst_lines) {
      series.createPriceLine({
        price: tdst.level,
        color: tdst.direction === "support" ? "#22c55e" : "#ef4444",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: tdst.direction === "support" ? "S" : "R",
      });
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    liveZoomedRef.current = false;

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersApiRef.current = null;
    };
  }, [data, height]);

  // Focus on signal bar
  useEffect(() => {
    if (focusBarIndex == null || !chartRef.current || !data.candles[focusBarIndex]) return;
    chartRef.current.timeScale().setVisibleRange({
      from: toChartTime(data.candles[Math.max(0, focusBarIndex - 30)].open_time),
      to: toChartTime(data.candles[Math.min(data.candles.length - 1, focusBarIndex + 30)].open_time),
    });
  }, [focusBarIndex, data.candles]);

  // Live tick: update open candle + zoom to last 200 bars on first tick
  useEffect(() => {
    if (!liveCandle || !seriesRef.current || !chartRef.current) return;
    seriesRef.current.update({
      time: toChartTime(liveCandle.open_time),
      open: liveCandle.open,
      high: liveCandle.high,
      low: liveCandle.low,
      close: liveCandle.close,
    });
    if (!liveZoomedRef.current) {
      liveZoomedRef.current = true;
      const candles = data.candles;
      if (candles.length >= 2) {
        chartRef.current.timeScale().setVisibleRange({
          from: toChartTime(candles[Math.max(0, candles.length - 200)].open_time),
          to: toChartTime(candles[candles.length - 1].open_time),
        });
      }
    } else {
      chartRef.current.timeScale().scrollToRealTime();
    }
  }, [liveCandle, data.candles]);

  // Candle close: finalise bar + add markers + TDST lines + scroll to latest
  useEffect(() => {
    if (!liveClose || !seriesRef.current || !markersApiRef.current) return;
    const { candle, new_signals, new_tdst_lines, setup_count, countdown_count } = liveClose;
    const time = toChartTime(candle.open_time);

    seriesRef.current.update({
      time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    });

    const extra: SeriesMarker<Time>[] = [];

    if (setup_count !== 0 && Math.abs(setup_count) !== 9) {
      extra.push({
        time,
        position: setup_count > 0 ? "belowBar" : "aboveBar",
        color: setup_count > 0 ? "#86efac" : "#fca5a5",
        shape: "circle",
        text: String(Math.abs(setup_count)),
        size: 0,
      });
    }
    if (countdown_count !== 0) {
      extra.push({
        time,
        position: countdown_count > 0 ? "belowBar" : "aboveBar",
        color: countdown_count > 0 ? "#4ade80" : "#f87171",
        shape: "circle",
        text: String(Math.abs(countdown_count)),
        size: 0,
      });
    }

    const adjNewSignals = new_signals.map((s) => ({
      ...s,
      bar_time: s.bar_time + TZ_OFFSET_SEC * 1000,
    }));
    extra.push(...buildMarkers(adjNewSignals));

    if (extra.length > 0) {
      const updated = [...markersApiRef.current.markers(), ...extra].sort(
        (a, b) => (a.time as number) - (b.time as number)
      );
      markersApiRef.current.setMarkers(updated);
    }

    for (const tdst of new_tdst_lines) {
      seriesRef.current.createPriceLine({
        price: tdst.level,
        color: tdst.direction === "support" ? "#22c55e" : "#ef4444",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: tdst.direction === "support" ? "S" : "R",
      });
    }

    chartRef.current?.timeScale().scrollToRealTime();
  }, [liveClose]);

  return (
    <div className="relative w-full flex-1" style={{ height }}>
      {/* OHLC + time tooltip */}
      <div
        ref={ohlcRef}
        className="absolute top-2 left-3 z-10 text-xs font-mono pointer-events-none select-none"
      />
      {/* Auto-scale button */}
      <button
        className="absolute top-2 right-16 z-10 w-6 h-6 text-xs font-bold
          bg-[#1e293b] border border-[#334155] text-[#64748b]
          hover:text-white hover:border-[#64748b] transition-colors"
        title="Auto scale (Y-axis)"
        onClick={() =>
          chartRef.current?.priceScale("right").applyOptions({ autoScale: true })
        }
      >
        A
      </button>
      {/* Chart canvas */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
