import type { Signal } from "@/lib/api";

const FIELDS: (keyof Signal)[] = [
  "type", "direction", "bar_index", "bar_time", "entry_price",
  "perfected", "deferral", "deferral_8v5",
  "risk_level", "tdst_level",
  "price_after_5", "price_after_10", "price_after_20",
  "return_5", "return_10", "return_20",
  "max_favorable_20", "max_adverse_20",
];

export function exportSignalsCsv(signals: Signal[], filename = "td_signals.csv"): void {
  const header = FIELDS.join(",");
  const rows = signals.map((s) =>
    FIELDS.map((f) => {
      const v = s[f];
      if (v == null) return "";
      if (typeof v === "boolean") return v ? "1" : "0";
      if (f === "bar_time") return new Date(v as number).toISOString();
      if (typeof v === "number") return v.toFixed(8);
      return String(v);
    }).join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
