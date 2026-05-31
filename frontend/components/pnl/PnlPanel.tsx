"use client";

import { useState, useEffect } from "react";
import {
  fetchPnlBacktest,
  type PnlBacktestResult,
  type PnlStats,
  type PnlTrade,
  type PnlFilters,
  DEFAULT_PNL_FILTERS,
} from "@/lib/api";

interface Props {
  symbol: string;
  interval: string;
  startMs: number;
  endMs: number;
  runTrigger?: number;
}

const TZ_OFFSET_MS = -new Date().getTimezoneOffset() * 60 * 1000;

function fmtTime(ms: number): string {
  const d = new Date(ms + TZ_OFFSET_MS);
  const yy = String(d.getUTCFullYear()).slice(2);
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yy}년${m}월${day}일 ${hh}:${mm}`;
}

function pct(v: number | null | undefined, fallback = "—"): string {
  if (v == null) return fallback;
  const color = v > 0 ? "text-green-400" : v < 0 ? "text-red-400" : "text-[#94a3b8]";
  return `<span class="${color}">${v > 0 ? "+" : ""}${v.toFixed(2)}%</span>`;
}

function PnlCell({ v }: { v: number | null | undefined }) {
  if (v == null) return <span className="text-[#334155]">—</span>;
  const cls = v > 0 ? "text-green-400" : v < 0 ? "text-red-400" : "text-[#94a3b8]";
  return <span className={cls}>{v > 0 ? "+" : ""}{v.toFixed(2)}%</span>;
}

function StatsCard({ label, stats }: { label: string; stats: PnlStats }) {
  const rows: [string, string][] = [
    ["총 트레이드", `${stats.total}건 (미청산 ${stats.unrealized}건)`],
    ["승/패", `${stats.won}승 ${stats.lost}패`],
    ["승률", stats.win_rate_pct != null ? `${stats.win_rate_pct}%` : "—"],
    ["평균 P&L", stats.avg_pnl_pct != null ? `${stats.avg_pnl_pct > 0 ? "+" : ""}${stats.avg_pnl_pct.toFixed(2)}%` : "—"],
    ["평균 수익", stats.avg_win_pct != null ? `+${stats.avg_win_pct.toFixed(2)}%` : "—"],
    ["평균 손실", stats.avg_loss_pct != null ? `${stats.avg_loss_pct.toFixed(2)}%` : "—"],
    ["최대 수익", stats.max_win_pct != null ? `+${stats.max_win_pct.toFixed(2)}%` : "—"],
    ["최대 손실", stats.max_loss_pct != null ? `${stats.max_loss_pct.toFixed(2)}%` : "—"],
    ["평균 보유 봉", stats.avg_bars_held != null ? `${stats.avg_bars_held}봉` : "—"],
  ];

  const winColor = (stats.avg_pnl_pct ?? 0) > 0 ? "border-green-700" : (stats.avg_pnl_pct ?? 0) < 0 ? "border-red-700" : "border-[#334155]";

  return (
    <div className={`border ${winColor} rounded p-3 flex-1 min-w-[180px]`}>
      <div className="text-xs font-semibold text-[#94a3b8] mb-2">{label}</div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between text-xs py-0.5">
          <span className="text-[#64748b]">{k}</span>
          <span className={`font-mono ${
            k === "평균 P&L"
              ? (stats.avg_pnl_pct ?? 0) > 0 ? "text-green-400" : "text-red-400"
              : k === "평균 수익" || k === "최대 수익" ? "text-green-400"
              : k === "평균 손실" || k === "최대 손실" ? "text-red-400"
              : "text-[#e2e8f0]"
          }`}>{v}</span>
        </div>
      ))}
    </div>
  );
}

export function PnlPanel({ symbol, interval, startMs, endMs, runTrigger }: Props) {
  const [result, setResult] = useState<PnlBacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PnlFilters>({ ...DEFAULT_PNL_FILTERS });

  function setF<K extends keyof PnlFilters>(key: K, value: PnlFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPnlBacktest({ symbol, interval, start: startMs, end: endMs, filters });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (runTrigger && runTrigger > 0) handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runTrigger]);

  return (
    <div className="flex flex-col gap-4 p-4 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-[#64748b]">
          {symbol} {interval}
        </span>
        {loading && <span className="text-xs text-[#64748b]">Calculating…</span>}
        {result && !loading && (
          <span className="text-xs text-[#64748b]">{result.trades.length}개 트레이드</span>
        )}
      </div>

      {/* Filter panel */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 p-3 bg-[#0f172a] border border-[#1e293b] rounded text-xs">
        {/* Entry type toggle */}
        <div className="flex items-center gap-1">
          <span className="text-[#64748b] mr-1">진입</span>
          {(["setup9", "countdown13"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setF("entryType", t)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                filters.entryType === t
                  ? "!bg-blue-600 !text-white"
                  : "!bg-[#1e293b] !text-[#64748b] hover:!text-[#94a3b8]"
              }`}
            >
              {t === "setup9" ? "Setup 9" : "Countdown 13"}
            </button>
          ))}
        </div>

        {/* Perfected only */}
        <label className={`flex items-center gap-1.5 cursor-pointer ${
          filters.entryType === "countdown13" ? "opacity-30 pointer-events-none" : ""
        }`}>
          <input
            type="checkbox"
            checked={filters.perfectedOnly}
            onChange={(e) => setF("perfectedOnly", e.target.checked)}
            className="accent-blue-500"
          />
          <span className="text-[#94a3b8]">Perfected only</span>
        </label>

        {/* Min risk distance */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#64748b]">최소 스톱 거리</span>
          <input
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={filters.minRiskPct}
            onChange={(e) => setF("minRiskPct", parseFloat(e.target.value) || 0)}
            className="w-14 text-right font-mono"
          />
          <span className="text-[#64748b]">%</span>
        </div>

        {/* Skip post-recycle */}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.skipPostRecycle}
            onChange={(e) => setF("skipPostRecycle", e.target.checked)}
            className="accent-blue-500"
          />
          <span className="text-[#94a3b8]">리사이클 후 제외</span>
        </label>

        {/* Stop type toggle */}
        <div className="flex items-center gap-1">
          <span className="text-[#64748b] mr-1">손절</span>
          {(["intrabar", "close"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setF("stopType", t)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                filters.stopType === t
                  ? "!bg-blue-600 !text-white"
                  : "!bg-[#1e293b] !text-[#64748b] hover:!text-[#94a3b8]"
              }`}
            >
              {t === "intrabar" ? "봉내(저/고가)" : "종가"}
            </button>
          ))}
        </div>

        {/* Min R/R filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#64748b]">최소 R/R</span>
          <input
            type="number"
            min={0}
            max={5}
            step={0.5}
            value={filters.minRr}
            onChange={(e) => setF("minRr", parseFloat(e.target.value) || 0)}
            className="w-14 text-right font-mono"
          />
          <span className="text-[#64748b]">:1</span>
          <span className="text-[#475569] text-[10px]">(0=미적용, TDST 기준)</span>
        </div>

        {/* TDST take-profit */}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.tdstTakeprofit}
            onChange={(e) => setF("tdstTakeprofit", e.target.checked)}
            className="accent-blue-500"
          />
          <span className="text-[#94a3b8]">TDST 익절</span>
          <span className="text-[#475569] text-[10px]">(저항/지지선 도달 시)</span>
        </label>

        {/* Max bars */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#64748b]">최대 보유</span>
          <input
            type="number"
            min={0}
            max={200}
            step={1}
            value={filters.maxBars}
            onChange={(e) => setF("maxBars", parseInt(e.target.value) || 0)}
            className="w-14 text-right font-mono"
          />
          <span className="text-[#64748b]">봉</span>
          <span className="text-[#475569] text-[10px]">(0=무제한)</span>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 px-3 py-2 rounded">{error}</div>
      )}

      {result && (
        <>
          {/* Stats comparison */}
          <div className="flex gap-3 flex-wrap">
            <StatsCard label="진입: 시그널 봉 종가 (Close)" stats={result.stats_close} />
            <StatsCard label="진입: 다음 봉 시가 (Next Open)" stats={result.stats_next_open} />
          </div>

          {/* Trade table */}
          <div className="overflow-auto">
            <table className="w-full text-xs border-collapse min-w-[800px]">
              <thead>
                <tr className="text-[#64748b] border-b border-[#334155]">
                  <th className="text-left py-2 px-2">시각</th>
                  <th className="text-center py-2 px-2">방향</th>
                  <th className="text-right py-2 px-2">Risk</th>
                  <th className="text-right py-2 px-2">진입(Close)</th>
                  <th className="text-right py-2 px-2">진입(Next)</th>
                  <th className="text-right py-2 px-2">청산가</th>
                  <th className="text-center py-2 px-2">봉수</th>
                  <th className="text-center py-2 px-2">청산사유</th>
                  <th className="text-right py-2 px-2">PnL(C)</th>
                  <th className="text-right py-2 px-2">PnL(O)</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((t, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-[#1e293b] hover:bg-[#1e293b] transition-colors"
                  >
                    <td className="py-1.5 px-2 text-[#94a3b8] whitespace-nowrap">
                      {fmtTime(t.bar_time)}
                      {t.perfected && <span className="ml-1 text-yellow-400">✓</span>}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <span className={`font-semibold ${t.direction === "buy" ? "text-green-400" : "text-red-400"}`}>
                        {t.direction === "buy" ? "▲Buy" : "▼Sell"}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-[#64748b]">
                      {t.risk_level.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-[#94a3b8]">
                      {t.entry_close.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-[#94a3b8]">
                      {t.entry_next_open != null
                        ? t.entry_next_open.toLocaleString("en-US", { maximumFractionDigits: 2 })
                        : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-[#94a3b8]">
                      {t.exit_price != null
                        ? t.exit_price.toLocaleString("en-US", { maximumFractionDigits: 2 })
                        : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-center text-[#64748b]">
                      {t.exit_bars ?? "—"}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {t.exit_type === "risk_level" ? (
                        <span className="text-orange-400">Stop</span>
                      ) : t.exit_type === "opposite_setup" ? (
                        <span className="text-blue-400">Opp.9</span>
                      ) : t.exit_type === "tdst_target" ? (
                        <span className="text-green-400">TDST</span>
                      ) : t.exit_type === "max_bars" ? (
                        <span className="text-yellow-400">MaxB</span>
                      ) : (
                        <span className="text-[#475569]">미청산</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono">
                      <PnlCell v={t.pnl_close_pct} />
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono">
                      <PnlCell v={t.pnl_next_open_pct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="text-[#334155] text-sm py-8 text-center">
          심볼·인터벌·날짜 범위 설정 후 상단 Run PnL 버튼을 클릭하세요
        </div>
      )}
    </div>
  );
}
