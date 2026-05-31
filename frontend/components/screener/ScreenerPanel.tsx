"use client";

import { useState } from "react";
import { fetchScreener, type ScreenerRow } from "@/lib/api";

const ALL_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT", "AVAXUSDT"];
const ALL_INTERVALS = ["15m", "1h", "4h", "1d"];

interface Props {
  onSelect: (symbol: string, interval: string) => void;
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function SignalBadge({ type, perfected }: { type: string | null | undefined; perfected?: boolean | null }) {
  if (!type) return <span className="text-[#334155]">—</span>;
  const isBuy = type.startsWith("buy");
  const isSetup = type.includes("setup");
  const label = isSetup
    ? `Setup 9${perfected ? "✓" : ""}`
    : `CD 13`;
  return (
    <span className={`text-xs font-medium ${isBuy ? "text-green-400" : "text-red-400"}`}>
      {isBuy ? "▲" : "▼"} {label}
    </span>
  );
}

function CountBadge({ count }: { count: number | null | undefined }) {
  if (!count) return <span className="text-[#334155]">—</span>;
  const isBuy = count > 0;
  const n = Math.abs(count);
  return (
    <span className={`text-xs font-mono ${isBuy ? "text-green-400" : "text-red-400"}`}>
      {isBuy ? "▲" : "▼"}{n}
    </span>
  );
}

export function ScreenerPanel({ onSelect }: Props) {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"]);
  const [selectedIntervals, setSelectedIntervals] = useState<string[]>(["1h", "4h"]);
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSymbol(s: string) {
    setSelectedSymbols((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  function toggleInterval(iv: string) {
    setSelectedIntervals((prev) =>
      prev.includes(iv) ? prev.filter((x) => x !== iv) : [...prev, iv]
    );
  }

  async function handleScan() {
    if (!selectedSymbols.length || !selectedIntervals.length) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchScreener({ symbols: selectedSymbols, intervals: selectedIntervals });
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Symbol selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[#64748b] w-16">Symbols</span>
        {ALL_SYMBOLS.map((s) => (
          <button
            key={s}
            onClick={() => toggleSymbol(s)}
            className={`text-xs px-2 py-0.5 border rounded transition-colors ${
              selectedSymbols.includes(s)
                ? "!bg-blue-600 !text-white border-blue-500"
                : "!bg-[#1e293b] !text-[#64748b] border-[#334155] hover:border-blue-500"
            }`}
          >
            {s.replace("USDT", "")}
          </button>
        ))}
      </div>

      {/* Interval selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#64748b] w-16">Intervals</span>
        {ALL_INTERVALS.map((iv) => (
          <button
            key={iv}
            onClick={() => toggleInterval(iv)}
            className={`text-xs px-2 py-0.5 border rounded transition-colors ${
              selectedIntervals.includes(iv)
                ? "!bg-blue-600 !text-white border-blue-500"
                : "!bg-[#1e293b] !text-[#64748b] border-[#334155] hover:border-blue-500"
            }`}
          >
            {iv}
          </button>
        ))}

        <button
          onClick={handleScan}
          disabled={loading || !selectedSymbols.length || !selectedIntervals.length}
          className="ml-4 px-4 py-1 text-xs font-semibold"
        >
          {loading ? "Scanning…" : "Scan"}
        </button>

        {rows.length > 0 && !loading && (
          <span className="text-xs text-[#64748b]">{rows.length} rows</span>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 px-3 py-2 rounded">{error}</div>
      )}

      {/* Results table */}
      {rows.length > 0 && (
        <div className="overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-[#64748b] text-xs border-b border-[#334155]">
                <th className="text-left py-2 px-3">Symbol</th>
                <th className="text-left py-2 px-2">TF</th>
                <th className="text-right py-2 px-3">Price</th>
                <th className="text-center py-2 px-2">Setup</th>
                <th className="text-center py-2 px-2">CD</th>
                <th className="text-left py-2 px-3">Last Signal</th>
                <th className="text-left py-2 px-2">Time</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.symbol}_${row.interval}`}
                  className="border-b border-[#1e293b] hover:bg-[#1e293b] cursor-pointer transition-colors"
                  onClick={() => onSelect(row.symbol, row.interval)}
                >
                  <td className="py-2 px-3 font-medium text-[#e2e8f0]">
                    {row.symbol.replace("USDT", "")}
                  </td>
                  <td className="py-2 px-2 text-[#64748b]">{row.interval}</td>
                  <td className="py-2 px-3 text-right font-mono text-[#94a3b8]">
                    {row.error
                      ? <span className="text-red-400 text-xs">error</span>
                      : row.last_close != null
                      ? `$${row.last_close.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      : "—"}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <CountBadge count={row.setup_count} />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <CountBadge count={row.countdown_count} />
                  </td>
                  <td className="py-2 px-3">
                    <SignalBadge type={row.last_signal_type} perfected={row.last_signal_perfected} />
                  </td>
                  <td className="py-2 px-2 text-xs text-[#64748b]">
                    {row.last_signal_time ? relativeTime(row.last_signal_time) : "—"}
                  </td>
                  <td className="py-2 px-2 text-[#64748b] text-xs">→</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 0 && !loading && (
        <div className="text-[#334155] text-sm py-8 text-center">
          Select symbols and intervals, then click Scan
        </div>
      )}
    </div>
  );
}
