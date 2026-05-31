from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

_API_BASE = "https://api.telegram.org"

_SIGNAL_EMOJI: dict[str, str] = {
    "buy_setup_9": "📈",
    "sell_setup_9": "📉",
    "buy_countdown_13": "🟢",
    "sell_countdown_13": "🔴",
    "recycle": "🔄",
    "cancel": "❌",
}

_SIGNAL_LABEL: dict[str, str] = {
    "buy_setup_9": "Buy Setup 9",
    "sell_setup_9": "Sell Setup 9",
    "buy_countdown_13": "Buy Countdown 13",
    "sell_countdown_13": "Sell Countdown 13",
    "recycle": "Recycle",
    "cancel": "Cancel",
}


def _format_price(price: float | None) -> str:
    if price is None:
        return "—"
    return f"${price:,.2f}"


def format_signal_message(sig: dict, symbol: str, interval: str) -> str:
    sig_type: str = sig.get("type", "")
    emoji = _SIGNAL_EMOJI.get(sig_type, "📌")
    label = _SIGNAL_LABEL.get(sig_type, sig_type)

    suffix_parts: list[str] = []
    if sig.get("perfected"):
        suffix_parts.append("Perfected✓")
    if sig.get("deferral"):
        suffix_parts.append("Deferred")
    if sig.get("recycle_reason"):
        suffix_parts.append(sig["recycle_reason"])
    if sig.get("cancel_reason"):
        suffix_parts.append(sig["cancel_reason"])
    suffix = f" ({', '.join(suffix_parts)})" if suffix_parts else ""

    bar_time_ms: int = sig.get("bar_time", 0)
    dt = datetime.fromtimestamp(bar_time_ms / 1000, tz=timezone.utc)
    time_str = dt.strftime("%Y-%m-%d %H:%M UTC")

    entry = _format_price(sig.get("entry_price"))
    lines = [
        f"{emoji} <b>{label}{suffix}</b> | {symbol} {interval}",
        f"💰 {entry}",
        f"🕐 {time_str}",
    ]
    if sig.get("tdst_level") is not None:
        direction = "Support" if sig.get("direction") == "buy" else "Resistance"
        lines.append(f"📏 TDST {direction}: {_format_price(sig['tdst_level'])}")
    if sig.get("risk_level") is not None:
        lines.append(f"⚠️ Risk: {_format_price(sig['risk_level'])}")

    return "\n".join(lines)


async def send_message(text: str) -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        return
    url = f"{_API_BASE}/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                url,
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            )
            resp.raise_for_status()
    except Exception as exc:
        logger.warning("Telegram send failed: %s", exc)
