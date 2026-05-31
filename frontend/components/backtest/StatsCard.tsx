"use client";

import { useState } from "react";
import type { BacktestResult, Signal } from "@/lib/api";
import { ReturnHistogram } from "./ReturnHistogram";

interface Props {
  stats: BacktestResult["stats"];
  signals: Signal[];
}

const ORDER = [
  "buy_countdown_13",
  "sell_countdown_13",
  "buy_setup_9",
  "sell_setup_9",
];

const LABELS: Record<string, string> = {
  buy_setup_9: "Buy Setup 9",
  sell_setup_9: "Sell Setup 9",
  buy_countdown_13: "Buy CD 13",
  sell_countdown_13: "Sell CD 13",
};

const DIR_COLOR: Record<string, string> = {
  buy_setup_9: "#22c55e",
  sell_setup_9: "#ef4444",
  buy_countdown_13: "#4ade80",
  sell_countdown_13: "#f87171",
};

function pct(v: number | null | undefined): string {
  if (v == null) return "—";
  return (v * 100).toFixed(0) + "%";
}

function avgPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
}

type HorizonTab = "5b" | "10b" | "20b";

export function StatsCard({ stats, signals }: Props) {
  const [horizonTab, setHorizonTab] = useState<HorizonTab>("20b");
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const keys = ORDER.filter((k) => k in stats);

  if (keys.length === 0) {
    return <div className="text-xs text-[#64748b] px-2">No stats</div>;
  }

  const horizonField = horizonTab === "5b"
    ? "return_5"
    : horizonTab === "10b"
    ? "return_10"
    : "return_20" as "return_5" | "return_10" | "return_20";

  return (
    <div className="text-xs">
      {/* Horizon tabs */}
      <div className="flex gap-1 mb-2">
        {(["5b", "10b", "20b"] as HorizonTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setHorizonTab(t)}
            className={`text-xs px-2 py-0.5 rounded border ${
              horizonTab === t
                ? "bg-blue-600 border-blue-600 !text-white"
                : "!bg-transparent border-[#334155] !text-[#94a3b8]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {keys.map((key) => {
          const s = stats[key];
          const winRate =
            horizonTab === "5b" ? s.win_rate_5
            : horizonTab === "10b" ? s.win_rate_10
            : s.win_rate_20;
          const avgReturn =
            horizonTab === "5b" ? s.avg_return_5
            : horizonTab === "10b" ? s.avg_return_10
            : s.avg_return_20;
          const isExpanded = expandedType === key;
          const typeSignals = signals.filter((sg) => sg.type === key);

          return (
            <div key={key} className="border border-[#334155] rounded overflow-hidden">
              <button
                onClick={() => setExpandedType(isExpanded ? null : key)}
                className="w-full flex items-center justify-between !bg-transparent px-2 py-1 text-left hover:!bg-[#1e293b]"
              >
                <span style={{ color: DIR_COLOR[key] }} className="font-semibold">
                  {LABELS[key]}
                </span>
                <span className="text-[#64748b]">
                  n={s.count} · {pct(winRate)} win · {avgPct(avgReturn)}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-[#334155]">
                  <div className="grid grid-cols-3 gap-0 text-center py-1">
                    {(["5b", "10b", "20b"] as HorizonTab[]).map((t) => {
                      const wr =
                        t === "5b" ? s.win_rate_5
                        : t === "10b" ? s.win_rate_10
                        : s.win_rate_20;
                      const ar =
                        t === "5b" ? s.avg_return_5
                        : t === "10b" ? s.avg_return_10
                        : s.avg_return_20;
                      return (
                        <div key={t} className="border-r border-[#334155] last:border-0 px-1">
                          <div className="text-[#475569]">{t}</div>
                          <div className="text-[#e2e8f0]">{pct(wr)}</div>
                          <div style={{ color: ar != null && ar >= 0 ? "#22c55e" : "#ef4444" }}>
                            {avgPct(ar)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-[#334155]">
                    <div className="px-2 pt-1 text-[10px] text-[#64748b]">
                      Return dist ({horizonTab})
                    </div>
                    <ReturnHistogram signals={typeSignals} field={horizonField} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
