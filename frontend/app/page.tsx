"use client";

import { useState, useCallback } from "react";
import { fetchBacktest, type BacktestResult } from "@/lib/api";
import { CandleChart } from "@/components/chart/CandleChart";
import { SignalList } from "@/components/backtest/SignalList";
import { StatsCard } from "@/components/backtest/StatsCard";

const INTERVALS = ["15m", "1h", "4h", "1d", "3d", "1w"];

const PRESETS: { label: string; days: number }[] = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "2Y", days: 730 },
];

function msAgo(days: number): number {
  return Date.now() - days * 86400 * 1000;
}

function toDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export default function Home() {
  const [symbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState("4h");
  const [startMs, setStartMs] = useState(() => msAgo(365));
  const [endMs, setEndMs] = useState(() => Date.now());

  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusBarIndex, setFocusBarIndex] = useState<number | null>(null);

  const handleRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setFocusBarIndex(null);
    try {
      const data = await fetchBacktest({ symbol, interval, start: startMs, end: endMs });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [symbol, interval, startMs, endMs]);

  const handlePreset = (days: number) => {
    setStartMs(msAgo(days));
    setEndMs(Date.now());
  };

  const tradingSignals = result?.signals.filter(
    (s) => s.type !== "recycle" && s.type !== "cancel"
  ) ?? [];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#334155] flex-wrap">
        <span className="font-bold text-blue-400 text-lg">TD Sequential</span>
        <span className="text-[#64748b] text-sm">{symbol}</span>

        <select value={interval} onChange={(e) => setInterval(e.target.value)}>
          {INTERVALS.map((iv) => (
            <option key={iv} value={iv}>{iv}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => handlePreset(p.days)}
              className="!bg-[#1e293b] !text-[#94a3b8] text-xs px-2 py-1 border border-[#334155] hover:!border-blue-500"
            >
              {p.label}
            </button>
          ))}
        </div>

        <input
          type="date"
          value={toDateString(startMs)}
          onChange={(e) => setStartMs(new Date(e.target.value).getTime())}
        />
        <span className="text-[#64748b]">→</span>
        <input
          type="date"
          value={toDateString(endMs)}
          onChange={(e) => setEndMs(new Date(e.target.value).getTime())}
        />

        <button onClick={handleRun} disabled={loading}>
          {loading ? "Loading…" : "Run"}
        </button>

        {result && (
          <span className="text-xs text-[#64748b]">
            {result.candles.length} candles · {result.signals.length} signals
          </span>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-900/40 text-red-300 text-sm">{error}</div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chart */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {result ? (
            <CandleChart data={result} focusBarIndex={focusBarIndex} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#334155] text-lg">
              {loading ? "Fetching data…" : "Select interval and click Run"}
            </div>
          )}
        </div>

        {/* Right panel */}
        {result && (
          <div className="w-80 flex flex-col border-l border-[#334155] overflow-hidden">
            <div className="p-2 border-b border-[#334155]">
              <StatsCard stats={result.stats} signals={tradingSignals} />
            </div>
            <div className="flex-1 overflow-y-auto">
              <SignalList
                signals={tradingSignals}
                onSelect={(barIndex) => setFocusBarIndex(barIndex)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
