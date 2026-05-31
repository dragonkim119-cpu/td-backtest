import { useEffect, useRef } from "react";
import type { Signal, TDSTLine } from "./api";

export interface LiveCandle {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LiveCloseEvent {
  candle: LiveCandle;
  new_signals: Signal[];
  new_tdst_lines: TDSTLine[];
  setup_count: number;
  countdown_count: number;
}

interface Handlers {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onTick: (candle: LiveCandle) => void;
  onClose: (event: LiveCloseEvent) => void;
}

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
  .replace(/^http/, "ws");

export function useRealtimeCandle(
  symbol: string,
  interval: string,
  enabled: boolean,
  handlers: Handlers,
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    const ws = new WebSocket(
      `${WS_BASE}/ws/candles?symbol=${symbol}&interval=${interval}`,
    );

    ws.onopen = () => {
      handlersRef.current.onConnect?.();
    };

    ws.onclose = () => {
      handlersRef.current.onDisconnect?.();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "tick") {
          handlersRef.current.onTick(msg.candle as LiveCandle);
        } else if (msg.type === "close") {
          handlersRef.current.onClose(msg as LiveCloseEvent);
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {
      // silent — reconnect not needed for personal tool
    };

    return () => {
      ws.close();
    };
  }, [symbol, interval, enabled]);
}
