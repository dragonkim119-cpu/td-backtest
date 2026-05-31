"use client";

import { useState, useMemo } from "react";
import type { Signal } from "@/lib/api";
import { exportSignalsCsv } from "@/lib/csv";

interface Props {
  signals: Signal[];
  onSelect: (barIndex: number) => void;
}

const TYPE_LABEL: Record<string, string> = {
  buy_setup_9: "Buy Setup",
  sell_setup_9: "Sell Setup",
  buy_countdown_13: "Buy CD 13",
  sell_countdown_13: "Sell CD 13",
};

const DIR_COLOR: Record<string, string> = {
  buy: "#22c55e",
  sell: "#ef4444",
};

function pct(v: number | null | undefined): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
}

function pctColor(v: number | null | undefined): string {
  if (v == null) return "#64748b";
  return v >= 0 ? "#22c55e" : "#ef4444";
}

type Direction = "all" | "buy" | "sell";
type TypeFilter = "all" | "setup" | "countdown";

export function SignalList({ signals, onSelect }: Props) {
  const [direction, setDirection] = useState<Direction>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [perfectedOnly, setPerfectedOnly] = useState(false);
  const [deferralOnly, setDeferralOnly] = useState(false);

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      if (direction !== "all" && s.direction !== direction) return false;
      if (typeFilter === "setup" && !s.type.includes("setup")) return false;
      if (typeFilter === "countdown" && !s.type.includes("countdown")) return false;
      if (perfectedOnly && !s.perfected) return false;
      if (deferralOnly && !s.deferral_8v5) return false;
      return true;
    });
  }, [signals, direction, typeFilter, perfectedOnly, deferralOnly]);

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="px-2 py-1 border-b border-[#334155] space-y-1">
        <div className="flex gap-1 flex-wrap">
          {(["all", "buy", "sell"] as Direction[]).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`text-xs px-2 py-0.5 rounded border ${
                direction === d
                  ? "bg-blue-600 border-blue-600 !text-white"
                  : "!bg-transparent border-[#334155] !text-[#94a3b8]"
              }`}
            >
              {d === "all" ? "All" : d === "buy" ? "Buy" : "Sell"}
            </button>
          ))}
          <span className="text-[#334155]">|</span>
          {(["all", "setup", "countdown"] as TypeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`text-xs px-2 py-0.5 rounded border ${
                typeFilter === t
                  ? "bg-blue-600 border-blue-600 !text-white"
                  : "!bg-transparent border-[#334155] !text-[#94a3b8]"
              }`}
            >
              {t === "all" ? "All" : t === "setup" ? "Setup" : "CD13"}
            </button>
          ))}
        </div>
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-1 text-xs text-[#94a3b8] cursor-pointer">
            <input
              type="checkbox"
              checked={perfectedOnly}
              onChange={(e) => setPerfectedOnly(e.target.checked)}
              className="accent-blue-500"
            />
            Perfected
          </label>
          <label className="flex items-center gap-1 text-xs text-[#94a3b8] cursor-pointer">
            <input
              type="checkbox"
              checked={deferralOnly}
              onChange={(e) => setDeferralOnly(e.target.checked)}
              className="accent-blue-500"
            />
            8vs5 ✓
          </label>
          <button
            onClick={() => exportSignalsCsv(filtered)}
            className="ml-auto text-xs !bg-[#1e293b] !text-[#94a3b8] px-2 py-0.5 border border-[#334155] rounded hover:!border-blue-500"
          >
            CSV
          </button>
        </div>
        <div className="text-[10px] text-[#475569]">
          {filtered.length} / {signals.length} signals
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-[#64748b] text-sm">No signals match filters</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-[#1e293b] text-[#64748b]">
              <tr>
                <th className="text-left px-2 py-1">Type</th>
                <th className="text-right px-2 py-1">Price</th>
                <th className="text-right px-2 py-1">5b</th>
                <th className="text-right px-2 py-1">10b</th>
                <th className="text-right px-2 py-1">20b</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sig, idx) => (
                <tr
                  key={idx}
                  onClick={() => onSelect(sig.bar_index)}
                  className="cursor-pointer hover:bg-[#1e293b] border-b border-[#1e293b]"
                >
                  <td className="px-2 py-1">
                    <span style={{ color: DIR_COLOR[sig.direction] }}>
                      {TYPE_LABEL[sig.type] ?? sig.type}
                    </span>
                    {sig.perfected && (
                      <span className="ml-1 text-yellow-400">✓</span>
                    )}
                    {sig.deferral_8v5 && (
                      <span className="ml-1 text-blue-400">·</span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right text-[#94a3b8]">
                    {sig.entry_price.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td
                    className="px-2 py-1 text-right"
                    style={{ color: pctColor(sig.return_5) }}
                  >
                    {pct(sig.return_5)}
                  </td>
                  <td
                    className="px-2 py-1 text-right"
                    style={{ color: pctColor(sig.return_10) }}
                  >
                    {pct(sig.return_10)}
                  </td>
                  <td
                    className="px-2 py-1 text-right"
                    style={{ color: pctColor(sig.return_20) }}
                  >
                    {pct(sig.return_20)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
