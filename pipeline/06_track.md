# 06 — Ledger rules (`data/ledger.json`)

**v1 mechanics:** `python3 scripts/reprice.py --screener data/inputs/DATE.csv` does all of the below automatically
(latest close via yfinance → Stooq fallback). Claude's job is to add today's *new* picks with `entry_price` =
the screener `last`, then run the script. **Entry price = screener close, always** (decided 2026-09-06).

## Status transitions
- **new** — first day selected → add to `positions` with `entry_date`, `entry_price` (screener last), `plan`, `score`, `stop`, `target`.
- **tracking** (Continuing) — still ≥2.0 on re-triage → update `last_price`, `pnl_pct = last/entry − 1`, `days_held`.
- **exited** — move to `history` with `exit_date`, `exit_price`, `pnl_pct`, `reason` when ANY of:
  1. `last_price ≤ stop` (stop hit)
  2. re-triage score ≤ 1.5
  3. absent from the screener **3 consecutive days** AND overlay no longer constructive
  4. target reached and overlay turns euphoric (take-profit)

## Report derivations
- Header line: the best-performing `tracking` name → `📈 TICKER tracking +X.XX% (added DATE)`.
- Section I (New) = status `new` today. Section II (Continuing) = `tracking`. Section III (Exited) = moved to history today.
- Stats block (for `site/record`): win rate = exited with pnl>0 / all exited; avg trade = mean pnl_pct; avg hold days.
