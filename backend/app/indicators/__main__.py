"""CLI: python -m app.indicators.td_sequential <parquet_path>"""
from __future__ import annotations

import sys

import pandas as pd

from app.indicators.td_sequential import run


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python -m app.indicators <parquet_path>")
        sys.exit(1)

    path = sys.argv[1]
    df = pd.read_parquet(path)
    signals, tdst_lines, setup_counts, countdown_counts = run(df)

    print(f"Signals: {len(signals)}")
    for s in signals:
        print(f"  {s.type:25s} bar={s.bar_index:5d}  price={s.entry_price:.2f}")

    print(f"\nTDST lines: {len(tdst_lines)}")
    for t in tdst_lines:
        print(f"  {t.direction:12s} level={t.level:.2f}")


if __name__ == "__main__":
    main()
