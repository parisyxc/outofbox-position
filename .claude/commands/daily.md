---
description: v1 — run the Out-of-the-Box daily pipeline for a date (ingest → triage → select 7 → plan → ledger auto-priced → report). With no screener image, falls back to repricing open positions only.
---

Run the daily pipeline for **$ARGUMENTS** (YYYY-MM-DD). Read `CLAUDE.md` first. Do the steps in order; do not skip the echo-back in step 1.

0. **Mode** — decide this FIRST, announce which mode you are in, and say why.

   Check in this order — `--no-ledger` wins, because it is a promise not to write the record
   and repricing writes the record:

   | # | Mode | When | Do |
   |---|---|---|---|
   | 1 | **NO-LEDGER** | `$ARGUMENTS` contains `--no-ledger` **and** an image exists | steps 1–4 and 6; do NOT touch `data/ledger.json` |
   | 2 | **NOTHING TO DO** | `--no-ledger` **and** no image | say so and stop. There is no screener session to analyse, and repricing is forbidden by the flag. Offer `--dry-run` if I want to see what a reprice *would* do. |
   | 3 | **REPRICE-ONLY** | no image, **or** `$ARGUMENTS` contains `--reprice-only` | step 5R only |
   | 4 | **LIVE** | otherwise | all steps; appends to the record |

   Chronology guard, for LIVE and REPRICE-ONLY alike: refuse a run for a date **earlier** than
   `ledger.as_of` and tell me to use `--no-ledger` or replay (see INTAKE.md). Re-running the date
   that already equals `as_of` is fine — repricing is idempotent.

1. **Ingest (01)** — the image lives in the project folder `Out-of-the-Box-Proprietary-Stock/` as `<YYYYMonDD>-outofbox.jpg`, e.g. `2026Sep03-outofbox.jpg` for `2026-09-03`. If the file isn't there, also accept an image path I paste in chat.
   **If neither exists, do NOT invent a list.** Fall back per the step 0 table: REPRICE-ONLY (step 5R) normally, or NOTHING TO DO if `--no-ledger` was passed. Either way say plainly that no image was found, so no new picks were selected, and that re-running with the image will do the full pipeline.
   Otherwise read it with vision → write `data/inputs/<date>.csv` (`ticker,name,sector,last,chg,pct,volume`). **Print the parsed table** and ask me to confirm if any row looks wrong.
2. **Triage (02)** — for EVERY ticker in the CSV, fetch one quote/forecast page (stockanalysis.com/stocks/TICKER/ is preferred) and fill `templates/triage_card.md` → `data/cards/$ARGUMENTS/TICKER.md`. Score Q/G/P, overlay, price, avg target, gap%. Output one ranked table.
3. **Select (03)** — pick 7 + 2–3 alternates per `pipeline/03_select.md`; one-line reason per exclusion ≥2.0. Names already `tracking` in the ledger are re-scored and kept as Continuing if still ≥2.0.
4. **Plan (04)** — per pick: plan type, entry zone, stop, target, alert level, optional call structure, per `pipeline/04_plan.md`.
5. **Track (06)** — append today's NEW picks to `data/ledger.json` with `status:"new"`, `entry_date:$ARGUMENTS`, **`entry_price` = the screener `last`**, plus sector/score/overlay/plan/stop/target/alert/catalyst/notes. Then run:
   `python3 scripts/reprice.py --date $ARGUMENTS --screener data/inputs/$ARGUMENTS.csv`
   Paste its table into the report. Any name it moved to `history` goes in Section III.

   **5R. Track, reprice-only** — no picks are appended; there is no new screener session to select from.
   Run the helper, which derives the session date from the local clock and logs the run:

       ./scripts/daily_reprice.sh

   or, to reprice a specific date, `python3 scripts/reprice.py --date $ARGUMENTS`.

   **Pass `--screener` only if `data/inputs/$ARGUMENTS.csv` already exists.** Without a screener
   that day, omitting the flag is the correct behaviour, not a shortcut: `--screener` advances
   `screener_absent_days` for every name not on the list, and three of those fire the
   "left screener + strength faded" exit. Counting an absence from a screener that was never
   run would close a position on evidence that does not exist.

   Then stop. Do not run steps 2, 3, 4, 6 or 7, and do not write a report — a daily report
   describes a screener session, and there wasn't one.

   Print, and nothing more:
   - the reprice table exactly as the script emits it;
   - **any position moved to `history`**, with its exit price and reason, called out loudly — this
     is the whole point of repricing on a day with no image;
   - the `record →` line, and the new `ledger.as_of`;
   - if every row says `NO PRICE`, say the date was probably not a trading day and that the ledger
     was left unchanged — do not present it as a successful reprice.

   Note for me when an exit fires here: it will not appear in any daily report until the next
   session's Section III, but `/position` and `/record` on the site pick it up on the next build.

6. **Report (05)** — render `templates/daily_report.md` → `reports/$ARGUMENTS/$ARGUMENTS.md`. Header line = `ledger.best_tracking`. Sections I–III from the ledger. End with disclaimer + Sources.
7. **Full reports (07, optional today)** — for each of the 7: config from `skill/assets/config.example.json` → `node skill/scripts/generate_report.js data/configs/TICKER.json reports/$ARGUMENTS/TICKER_Momentum_Verification_Analysis.docx`. Skip if I say "light only".
8. Print: the 7-line summary (ticker · score · plan · entry · stop · target), the reprice table, and the report path. In REPRICE-ONLY mode, print only what 5R lists.
