---
description: v1 — run the Out-of-the-Box daily pipeline end-to-end for a date (ingest → triage → select 7 → plan → ledger auto-priced → report)
---

Run the daily pipeline for **$ARGUMENTS** (YYYY-MM-DD). Read `CLAUDE.md` first. Do the steps in order; do not skip the echo-back in step 1.

0. **Mode** — if `$ARGUMENTS` contains `--no-ledger`, do steps 1–4 and 6 only (report + cards) and DO NOT touch `data/ledger.json`. Otherwise this is a live run that appends to the record. Dates must be run in chronological order for a live run; refuse a live run for a date earlier than `ledger.as_of` and tell me to use `--no-ledger` or replay (see INTAKE.md).
1. **Ingest (01)** — the image lives in the project folder `Out-of-the-Box-Proprietary-Stock/` as `<YYYYMonDD>-outofbox.jpg`, e.g. `2026Sep03-outofbox.jpg` for `2026-09-03`. If the file isn't there, also accept an image path I paste in chat. Read it with vision → write `data/inputs/<date>.csv` (`ticker,name,sector,last,chg,pct,volume`). **Print the parsed table** and ask me to confirm if any row looks wrong.
2. **Triage (02)** — for EVERY ticker in the CSV, fetch one quote/forecast page (stockanalysis.com/stocks/TICKER/ is preferred) and fill `templates/triage_card.md` → `data/cards/$ARGUMENTS/TICKER.md`. Score Q/G/P, overlay, price, avg target, gap%. Output one ranked table.
3. **Select (03)** — pick 7 + 2–3 alternates per `pipeline/03_select.md`; one-line reason per exclusion ≥2.0. Names already `tracking` in the ledger are re-scored and kept as Continuing if still ≥2.0.
4. **Plan (04)** — per pick: plan type, entry zone, stop, target, alert level, optional call structure, per `pipeline/04_plan.md`.
5. **Track (06)** — append today's NEW picks to `data/ledger.json` with `status:"new"`, `entry_date:$ARGUMENTS`, **`entry_price` = the screener `last`**, plus sector/score/overlay/plan/stop/target/alert/catalyst/notes. Then run:
   `python3 scripts/reprice.py --date $ARGUMENTS --screener data/inputs/$ARGUMENTS.csv`
   Paste its table into the report. Any name it moved to `history` goes in Section III.
6. **Report (05)** — render `templates/daily_report.md` → `reports/$ARGUMENTS/$ARGUMENTS.md`. Header line = `ledger.best_tracking`. Sections I–III from the ledger. End with disclaimer + Sources.
7. **Full reports (07, optional today)** — for each of the 7: config from `skill/assets/config.example.json` → `node skill/scripts/generate_report.js data/configs/TICKER.json reports/$ARGUMENTS/TICKER_Momentum_Verification_Analysis.docx`. Skip if I say "light only".
8. Print: the 7-line summary (ticker · score · plan · entry · stop · target), the reprice table, and the report path.
