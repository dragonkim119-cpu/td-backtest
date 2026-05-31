"use client";

import { useState, useCallback } from "react";
import { fetchBacktest, type BacktestResult } from "@/lib/api";
import { useRealtimeCandle, type LiveCandle, type LiveCloseEvent } from "@/lib/useRealtimeCandle";
import { CandleChart } from "@/components/chart/CandleChart";
import { SignalList } from "@/components/backtest/SignalList";
import { StatsCard } from "@/components/backtest/StatsCard";
import { ScreenerPanel } from "@/components/screener/ScreenerPanel";
import { PnlPanel } from "@/components/pnl/PnlPanel";

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

type Tab = "chart" | "screener" | "pnl";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("chart");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState("4h");
  const [startMs, setStartMs] = useState(() => msAgo(365));
  const [endMs, setEndMs] = useState(() => Date.now());

  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusBarIndex, setFocusBarIndex] = useState<number | null>(null);

  const [liveCandle, setLiveCandle] = useState<LiveCandle | null>(null);
  const [liveClose, setLiveClose] = useState<LiveCloseEvent | null>(null);
  const [isLive, setIsLive] = useState(false);

  const [pnlRunTrigger, setPnlRunTrigger] = useState(0);

  useRealtimeCandle(symbol, interval, result !== null && activeTab === "chart", {
    onConnect: () => setIsLive(true),
    onDisconnect: () => setIsLive(false),
    onTick: (candle) => setLiveCandle(candle),
    onClose: (event) => {
      setLiveClose(event);
      setLiveCandle(null);
    },
  });

  const runBacktest = useCallback(async (sym: string, iv: string, start: number, end: number) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setFocusBarIndex(null);
    setLiveCandle(null);
    setLiveClose(null);
    setIsLive(false);
    try {
      const data = await fetchBacktest({ symbol: sym, interval: iv, start, end });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRun = useCallback(() => {
    const now = Date.now();
    setEndMs(now);
    runBacktest(symbol, interval, startMs, now);
  }, [symbol, interval, startMs, runBacktest]);

  const handlePreset = (days: number) => {
    setStartMs(msAgo(days));
    setEndMs(Date.now());
  };

  const handleSelectFromScreener = useCallback((sym: string, iv: string) => {
    const now = Date.now();
    setSymbol(sym);
    setInterval(iv);
    setEndMs(now);
    setActiveTab("chart");
    runBacktest(sym, iv, msAgo(365), now);
  }, [runBacktest]);

  const tradingSignals = result?.signals.filter(
    (s) => s.type !== "recycle" && s.type !== "cancel"
  ) ?? [];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#334155] flex-wrap">
        <span className="font-bold text-blue-400 text-lg">TD Sequential</span>

        {/* Tabs */}
        <div className="flex border border-[#334155] rounded overflow-hidden">
          {(["chart", "screener", "pnl"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-xs px-3 py-1 transition-colors ${
                activeTab === tab
                  ? "!bg-blue-600 !text-white"
                  : "!bg-[#0f172a] !text-[#64748b] hover:!text-[#94a3b8]"
              }`}
            >
              {tab === "pnl" ? "PnL" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab !== "screener" && (
          <>
            {/* Symbol input */}
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-28 font-mono text-sm uppercase"
              placeholder="BTCUSDT"
            />

            {/* LIVE badge — chart only */}
            {activeTab === "chart" && isLive && (
              <span className="flex items-center gap-1.5 text-xs border border-green-700 rounded px-1.5 py-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 font-medium">LIVE</span>
                {liveCandle && (
                  <>
                    <span className="text-[#334155]">|</span>
                    <span className={
                      result && liveCandle.close >= (result.candles.at(-1)?.close ?? liveCandle.close)
                        ? "text-green-400 font-mono font-bold"
                        : "text-red-400 font-mono font-bold"
                    }>
                      ${liveCandle.close.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </>
                )}
              </span>
            )}

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

            {activeTab === "chart" ? (
              <button onClick={handleRun} disabled={loading}>
                {loading ? "Loading…" : "Run"}
              </button>
            ) : (
              <button onClick={() => setPnlRunTrigger((t) => t + 1)}>
                Run PnL
              </button>
            )}

            {/* Chart-only stats */}
            {activeTab === "chart" && result && (
              <span className="text-xs text-[#64748b]">
                {result.candles.length} candles · {result.signals.length} signals
              </span>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-900/40 text-red-300 text-sm">{error}</div>
      )}

      {/* Main content */}
      {activeTab === "screener" ? (
        <div className="flex-1 overflow-auto">
          <ScreenerPanel onSelect={handleSelectFromScreener} />
        </div>
      ) : activeTab === "pnl" ? (
        <div className="flex-1 overflow-hidden">
          <PnlPanel
            symbol={symbol}
            interval={interval}
            startMs={startMs}
            endMs={endMs}
            runTrigger={pnlRunTrigger}
          />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Chart */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {result ? (
              <CandleChart
                data={result}
                focusBarIndex={focusBarIndex}
                liveCandle={liveCandle}
                liveClose={liveClose}
              />
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
      )}
    </div>
  );
}
