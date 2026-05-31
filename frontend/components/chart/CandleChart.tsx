"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import type { BacktestResult } from "@/lib/api";
import {
  buildMarkers,
  buildSetupCountMarkers,
  buildCountdownCountMarkers,
} from "@/components/overlays/markers";

interface Props {
  data: BacktestResult;
  focusBarIndex?: number | null;
  height?: number;
}

export function CandleChart({ data, focusBarIndex, height = 560 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

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

    // Merge all markers
    const allMarkers = [
      ...buildSetupCountMarkers(data.setup_counts, data.candles),
      ...buildCountdownCountMarkers(data.countdown_counts, data.candles),
      ...buildMarkers(data.signals),
    ].sort((a, b) => (a.time as number) - (b.time as number));

    createSeriesMarkers(series, allMarkers);

    // TDST price lines
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
    };
  }, [data, height]);

  // Scroll to focusBarIndex when it changes
  useEffect(() => {
    if (focusBarIndex == null || !chartRef.current || !data.candles[focusBarIndex]) return;
    const time = (data.candles[focusBarIndex].open_time / 1000) as Time;
    chartRef.current.timeScale().scrollToPosition(0, false);
    chartRef.current.timeScale().setVisibleRange({
      from: (data.candles[Math.max(0, focusBarIndex - 30)].open_time / 1000) as Time,
      to: (data.candles[Math.min(data.candles.length - 1, focusBarIndex + 30)].open_time / 1000) as Time,
    });
  }, [focusBarIndex, data.candles]);

  return <div ref={containerRef} style={{ height }} className="w-full flex-1" />;
}
