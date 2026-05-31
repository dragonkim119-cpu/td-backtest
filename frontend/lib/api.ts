const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Candle {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  type: string;
  direction: "buy" | "sell";
  bar_index: number;
  bar_time: number;
  entry_price: number;
  perfected?: boolean | null;
  deferral: boolean;
  deferral_8v5: boolean;
  risk_level?: number | null;
  tdst_level?: number | null;
  recycle_reason?: string | null;
  cancel_reason?: string | null;
  price_after_5?: number | null;
  price_after_10?: number | null;
  price_after_20?: number | null;
  return_5?: number | null;
  return_10?: number | null;
  return_20?: number | null;
  max_favorable_20?: number | null;
  max_adverse_20?: number | null;
}

export interface TDSTLine {
  direction: "support" | "resistance";
  level: number;
  start_bar_time: number;
  end_bar_time?: number | null;
}

export interface BacktestResult {
  symbol: string;
  interval: string;
  start_time: number;
  end_time: number;
  candles: Candle[];
  signals: Signal[];
  tdst_lines: TDSTLine[];
  setup_counts: number[];
  countdown_counts: number[];
  stats: Record<string, {
    count: number;
    win_rate_5?: number | null;
    win_rate_10?: number | null;
    win_rate_20?: number | null;
    avg_return_5?: number | null;
    avg_return_10?: number | null;
    avg_return_20?: number | null;
  }>;
}

export interface ScreenerRow {
  symbol: string;
  interval: string;
  last_close?: number | null;
  setup_count?: number | null;
  countdown_count?: number | null;
  last_signal_type?: string | null;
  last_signal_time?: number | null;
  last_signal_perfected?: boolean | null;
  last_signal_direction?: string | null;
  error?: string | null;
}

export async function fetchScreener(params: {
  symbols: string[];
  intervals: string[];
}): Promise<ScreenerRow[]> {
  const url = new URL(`${BASE}/api/screener`);
  url.searchParams.set("symbols", params.symbols.join(","));
  url.searchParams.set("intervals", params.intervals.join(","));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Screener API error ${res.status}`);
  return res.json() as Promise<ScreenerRow[]>;
}

export async function fetchBacktest(params: {
  symbol: string;
  interval: string;
  start: number;
  end: number;
}): Promise<BacktestResult> {
  const url = new URL(`${BASE}/api/backtest`);
  url.searchParams.set("symbol", params.symbol);
  url.searchParams.set("interval", params.interval);
  url.searchParams.set("start", String(params.start));
  url.searchParams.set("end", String(params.end));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Backtest API error ${res.status}: ${err}`);
  }
  return res.json() as Promise<BacktestResult>;
}
