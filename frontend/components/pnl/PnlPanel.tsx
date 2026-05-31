"use client";

import { useState } from "react";
import { fetchPnlBacktest, type PnlBacktestResult, type PnlStats, type PnlTrade } from "@/lib/api";

interface Props {
  symbol: string;
  interval: string;
  startMs: number;
  endMs: number;
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

export function PnlPanel({ symbol, interval, startMs, endMs }: Props) {
  const [result, setResult] = useState<PnlBacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPnlBacktest({ symbol, interval, start: startMs, end: endMs });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={handleRun} disabled={loading} className="px-4 py-1.5 text-sm font-semibold">
          {loading ? "Calculating…" : "Run PnL Backtest"}
        </button>
        <span className="text-xs text-[#64748b]">
          {symbol} {interval} · Setup 9 진입, Risk Level 청산
        </span>
        {result && (
          <span className="text-xs text-[#64748b]">{result.trades.length}개 트레이드</span>
        )}
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
          Run PnL Backtest 클릭 시 Chart 탭과 동일한 기간·심볼로 실행됩니다
        </div>
      )}
    </div>
  );
}
