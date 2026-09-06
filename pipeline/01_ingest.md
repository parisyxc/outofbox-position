# 01 — Ingest the screener image
1. Locate `Out-of-the-Box-Proprietary-Stock/YYYYMonDD-outofbox.jpg` for the requested date.
2. Read with vision. Extract every row: ticker, description, sector, last, net chg, % chg, volume.
3. Write `data/inputs/DATE.csv` (header: ticker,name,sector,last,chg,pct,volume).
4. **Echo the table back and pause** — a mis-read ticker poisons everything downstream.
5. Icon legend (best-effort): green circle / "24" / bell = screener flags; record as `flags` if legible, ignore otherwise.
