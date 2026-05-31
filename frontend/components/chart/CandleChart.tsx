"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  ColorType,
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

export function CandleChart({
  data,
  focusBarIndex,
  liveCandle,
  liveClose,
  height = 560,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersApiRef = useRef<MarkersApi | null>(null);

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
      rightPriceScale: { borderColor: "#334155" },
      timeScale: {
        borderColor: "#334155",
        timeVisible: true,
        secondsVisible: false,
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

    series.setData(
      data.candles.map((c) => ({
        time: (c.open_time / 1000) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    const allMarkers = [
      ...buildSetupCountMarkers(data.setup_counts, data.candles),
      ...buildCountdownCountMarkers(data.countdown_counts, data.candles),
      ...buildMarkers(data.signals),
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
      from: (data.candles[Math.max(0, focusBarIndex - 30)].open_time / 1000) as Time,
      to: (data.candles[Math.min(data.candles.length - 1, focusBarIndex + 30)].open_time / 1000) as Time,
    });
  }, [focusBarIndex, data.candles]);

  // Live tick: update open candle
  useEffect(() => {
    if (!liveCandle || !seriesRef.current) return;
    seriesRef.current.update({
      time: (liveCandle.open_time / 1000) as Time,
      open: liveCandle.open,
      high: liveCandle.high,
      low: liveCandle.low,
      close: liveCandle.close,
    });
  }, [liveCandle]);

  // Candle close: finalise bar + add markers + TDST lines
  useEffect(() => {
    if (!liveClose || !seriesRef.current || !markersApiRef.current) return;
    const { candle, new_signals, new_tdst_lines, setup_count, countdown_count } = liveClose;
    const time = (candle.open_time / 1000) as Time;

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
    extra.push(...buildMarkers(new_signals));

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
  }, [liveClose]);

  return <div ref={containerRef} style={{ height }} className="w-full flex-1" />;
}
