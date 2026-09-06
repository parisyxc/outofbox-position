# 06 — Ledger rules (`data/ledger.json`)

Field-by-field shape is in [`ledger.schema.md`](ledger.schema.md). This file is the rules.

**v1 mechanics:** `python3 scripts/reprice.py --screener data/inputs/DATE.csv` does the market side
automatically (latest close via yfinance → Stooq fallback). Claude's job is to add today's *new* picks
with `entry_price` = the screener `last`, then run the script. **Entry price = screener close, always**
(decided 2026-09-06).

On a trading day with **no screener image**, still reprice — `/daily DATE` falls back to reprice-only,
or run `./scripts/daily_reprice.sh`. Omit `--screener` on those days; see the absence rule below.

## Status transitions
- **new** — first day selected → add to `positions` with `entry_date`, `entry_price` (screener last), `plan`, `score`, `stop`, `target`.
- **tracking** (Continuing) — still ≥2.0 on re-triage → update `last_price`, `pnl_pct = last/entry − 1`, `days_held`.
- **exited** — move to `history` with `exit_date`, `exit_price`, `pnl_pct`, `reason`.

## Exit rules — and which are automatic

`reprice.py` fires only the three that can be decided from price and the screener list. **Rule 2
requires a re-triage and therefore only ever fires inside `/daily`** — never on a reprice-only day.
Rule 5 is a human decision and must be asked for.

| # | Condition | `reason` | Who fires it |
|---|---|---|---|
| 1 | `last_price <= stop` | `stop hit` | **reprice.py** (automatic) |
| 2 | re-triage score ≤ 1.5 | free text | Claude, during `/daily` step 3 only |
| 3 | absent from the screener **3 consecutive `--screener` runs** AND overlay no longer `constructive` | `left screener + strength faded` | **reprice.py** (automatic) |
| 4 | `last_price >= target` AND overlay is `euphoric` | `target reached (euphoric)` | **reprice.py** (automatic) |
| 5 | discretionary — thesis change, better idea, or target hit on a name that is *not* euphoric | free text, dated | a human, on request |

Two traps in the automatic rules:

- **Rule 1 is close-only.** The stop is tested against the *closing* price on the day the script runs.
  A position that breaks its stop intraday and recovers by the bell does not exit — and one that
  breaks it on a session nobody reprices, then recovers, never enters the record at all. That is why
  the reprice has to happen on every trading day, not only the days a screener image arrives.
- **Rule 3 counts `--screener` runs, not calendar days.** `screener_absent_days` advances only when
  `reprice.py` is given `--screener`. Run `/daily` twice a week and "3 days" takes a week and a half.
  Never pass `--screener` on a day with no screener: it would count absences from a list that was
  never pulled, and three of those close a position on evidence that does not exist.

## Removals that are not trades

A position taken off the book by a **correction to the research** — not a stop, not a decision to
sell — goes to `history` with **`bookkeeping: true`**. It was never a live trade with a real exit, so
counting it would publish a win rate on something that never closed.

`reprice.py`, `site/scripts/sync.mjs` and `/position` all honour the flag; all three must agree.
Forgetting it puts a phantom trade into the published record — which has already happened once, with
FLR on 2026-09-06.

## Corrections

Change the field, append the dated reason to `notes`, and record a score change in `score_history`
(`[{date, score, basis}]`). Leave the originally published figure standing where it was published,
with a dated `Re-verified YYYY-MM-DD` line beside it — appended and labelled, never overwritten.

## Before committing a ledger change

`python3 scripts/check_ledger.py` — 33 invariants from [`ledger.schema.md`](ledger.schema.md),
exit 0 or 1. It also runs in CI before the site builds. The checks that matter are the ones
nobody would notice failing: an entry price that moved, a phantom trade in the win rate, a
0% win rate printed off zero closed trades.

## Report derivations
- Header line: the best-performing `tracking` name → `📈 TICKER tracking +X.XX% (added DATE)`.
- Section I (New) = status `new` today. Section II (Continuing) = `tracking`. Section III (Exited) = moved to history today.
- An exit found on a reprice-only day reaches no report until the next session's Section III, but
  `/position` and `/record` show it at the next site build.
- Stats block (for `site/record`): over closed trades **excluding `bookkeeping` rows** — win rate =
  exited with `pnl_pct > 0` / all such exits; avg trade = mean `pnl_pct`; avg hold days.
  **With nothing closed these are `null`, not `0`.** A record with zero closed trades is not a 0%
  win rate, and `/record` must say so rather than print a percentage.
