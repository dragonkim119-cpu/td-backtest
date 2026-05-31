"use client";

import type { Signal } from "@/lib/api";

interface Props {
  signals: Signal[];
  field: "return_5" | "return_10" | "return_20";
}

const BINS = 10;
const MIN_PCT = -0.15;
const MAX_PCT = 0.15;

export function ReturnHistogram({ signals, field }: Props) {
  const values = signals
    .map((s) => s[field])
    .filter((v): v is number => v != null);

  if (values.length === 0) {
    return <div className="text-xs text-[#64748b] px-2 py-1">No data</div>;
  }

  const step = (MAX_PCT - MIN_PCT) / BINS;
  const counts = Array(BINS).fill(0);
  const wins = Array(BINS).fill(0);

  for (const v of values) {
    const bi = Math.min(BINS - 1, Math.max(0, Math.floor((v - MIN_PCT) / step)));
    counts[bi]++;
    if (v > 0) wins[bi]++;
  }

  const maxCount = Math.max(...counts, 1);

  return (
    <div className="px-2 py-1">
      <div className="flex items-end gap-[2px] h-16">
        {counts.map((cnt, i) => {
          const pct = (MIN_PCT + i * step) * 100;
          const isPos = pct + step * 100 / 2 > 0;
          const heightPct = (cnt / maxCount) * 100;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col justify-end cursor-default group relative"
              title={`${pct.toFixed(0)}%~${(pct + step * 100).toFixed(0)}%: ${cnt} signals`}
            >
              <div
                style={{ height: `${heightPct}%` }}
                className={`w-full transition-opacity group-hover:opacity-70 ${
                  isPos ? "bg-green-500" : "bg-red-500"
                }`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-[#475569] mt-1">
        <span>{(MIN_PCT * 100).toFixed(0)}%</span>
        <span>0</span>
        <span>+{(MAX_PCT * 100).toFixed(0)}%</span>
      </div>
      <div className="text-[10px] text-[#64748b] mt-1">
        n={values.length} · win={((values.filter((v) => v > 0).length / values.length) * 100).toFixed(0)}%
        · avg={(values.reduce((a, b) => a + b, 0) / values.length * 100).toFixed(1)}%
      </div>
    </div>
  );
}
