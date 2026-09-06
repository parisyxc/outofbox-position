# Ledger schema — `data/ledger.json`

The ledger **is** the product. The picks are marketing; a dated, checkable record of entries and
exits is the thing nobody else publishes. Everything here exists to keep that record honest, so the
rules about what may never be rewritten matter more than the field list.

Rules live in [`06_track.md`](06_track.md). This file is the reference for *shape* — every field,
its type, who writes it, and whether it may ever change.

## Who writes what

| Writer | Touches |
|---|---|
| **Claude, during `/daily`** | adds new picks to `positions` with the research fields; never edits market fields by hand |
| **`scripts/reprice.py`** | market fields + exit detection + `best_tracking`, `record`, `as_of` |
| **`site/scripts/sync.mjs`** | reads only — computes `stats` into `src/generated/ledger.json`, never writes back |
| **A human, deliberately** | corrections, always dated and appended (see *Corrections*) |

> `reprice.py` **cannot** rewrite `entry_price`, `entry_date`, `score`, `overlay`, `plan`, `stop`,
> `target`, `alert_level`, `catalyst`, `notes` or `sector`. There is no assignment to any of them in
> the script. It marks positions to market; it does not revise judgments.

## Top level

| Field | Type | Written by | Notes |
|---|---|---|---|
| `as_of` | `str` `YYYY-MM-DD` | reprice.py | The session the marks belong to. Advances on **every** run, even when nothing changed — that records "we looked, nothing had closed". |
| `positions` | `array` | Claude adds, reprice.py updates/removes | The open book. |
| `alternates` | `array` | Claude | Near-misses for the latest session. Replaced each run, not accumulated. |
| `history` | `array` | reprice.py appends | Closed positions. **Append-only.** |
| `best_tracking` | `object｜null` | reprice.py | `{ticker, pnl_pct, entry_date}` — best open name; the report's header line. |
| `record` | `object` | reprice.py | `{closed, win_rate_pct, avg_trade_pct, open_now}`. Excludes `bookkeeping` rows. `win_rate_pct` and `avg_trade_pct` are `null` when nothing has closed — **`null`, never `0`** (see *The zero trap*). |

## `positions[]`

**Research fields** — set once when the pick is added, never rewritten by any script:

| Field | Type | Notes |
|---|---|---|
| `ticker` | `str` | |
| `entry_date` | `str` | The screener date the pick was published. |
| `entry_price` | `float` | **The screener's `last` on `entry_date`.** Never a fill, never a later price. This single rule is what makes the record checkable — see *The entry-price rule*. |
| `sector` | `str` | Max 4 picks per sector per session. |
| `score` | `float` | 0–3.0 in 0.5 steps. The current best judgment; see `score_history`. |
| `overlay` | `str` | `constructive` ｜ `extended` ｜ `euphoric` ｜ `oversold`. Load-bearing: two exit rules read it. |
| `plan` | `str` | `LONG_STOCK` ｜ `LONG_STOCK+CALLS` ｜ `WATCH`. |
| `entry_zone` | `str` | Free text, e.g. `"282-292"`. |
| `stop` | `number` | **The exit trigger.** `last_price <= stop` closes the position. |
| `target` | `number` | Analyst average. |
| `street_high` | `number` | The stretch case. Never used as `target`. |
| `alert_level` | `number｜null` | For `WATCH` names: the level that would trigger action. `null` otherwise. |
| `catalyst` | `str` | Dated catalyst, or a note that none is visible. Gates whether calls are allowed. |
| `notes` | `str` | Evidence and dated corrections, appended with ` \| `. |
| `score_history` | `array?` | **Optional.** `[{date, score, basis}]`. Present only where a score changed after publication. Add it whenever you change `score` — see *Corrections*. |

**Market fields** — owned by `reprice.py`, never hand-edited:

| Field | Type | Notes |
|---|---|---|
| `status` | `str` | `new` on the day added → `tracking` on first reprice → `exited` when a rule fires. |
| `last_price` | `float` | Most recent close. |
| `last_price_date` | `str` | The bar's actual date, which can lag `as_of` (weekends, holidays). |
| `pnl_pct` | `float` | `(last_price / entry_price − 1) × 100`. |
| `days_held` | `int` | `entry_date` → `last_price_date`. |
| `screener_absent_days` | `int` | Consecutive sessions off the screener. **Only advances when `reprice.py` is given `--screener`.** Counting an absence from a screener that was never run would close a position on evidence that does not exist. |

## `history[]`

Every `positions[]` field, frozen at exit, plus:

| Field | Type | Notes |
|---|---|---|
| `exit_date` | `str` | |
| `exit_price` | `float` | |
| `reason` | `str` | `stop hit` ｜ `left screener + strength faded` ｜ `target reached (euphoric)` ｜ free text for a human decision. |
| `bookkeeping` | `bool?` | **Optional, and the most dangerous field to forget.** See below. |

### `bookkeeping: true`

Marks a row that left the book through a **correction to the research**, not through a stop or a
decision to sell. It was never a live trade with a real exit, so counting it would report a win rate
on something that never closed.

Three places honour it, and all three must agree:
- `scripts/reprice.py` — excluded from `record`
- `site/scripts/sync.mjs` — excluded from `stats`
- `/position` — listed separately, under its own disclosure, rather than deleted

The only row carrying it today is FLR, removed in the 2026-09-06 re-derivation. **Any future
non-trade removal must set it**, or a phantom trade enters the published win rate.

## `alternates[]`

`{ ticker: str, score: float, reason: str }` — cleared and rewritten each session.

## The entry-price rule

`entry_price` is **always the screener's `last` on `entry_date`**. Not a fill. Not a later price.
Not adjusted afterwards for any reason.

The record is a claim about a published method, not a brokerage statement. If entries could be
revised, nothing on `/record` would be checkable, because no reader could tell a good pick from a
tidied-up one. `reprice.py` never assigns it, and neither should you.

## The zero trap

With no closed trades, `win_rate_pct` and `avg_trade_pct` are `null`, **not `0`**.

A record with zero closed trades is not a 0% win rate. Publishing `0.0` would be a false claim of
total failure, and this exact bug shipped once already: `record` read `closed: 1, win_rate_pct: 0.0`
off the FLR bookkeeping row. Any consumer of this file must render `null` as "no closed picks yet"
and never as a percentage.

## Corrections

Corrections are **appended and dated, never overwritten**:

1. Change the field.
2. Add the dated reason to `notes` (and to `score_history` for a score).
3. Leave the originally published figure standing wherever it was published — the report and the
   triage card get a dated `Re-verified YYYY-MM-DD` line beside it, not an edit.

Worked example: the 2026-09-06 LNG re-score, 3.0 → 2.5. The ledger carries 2.5 with both readings in
`score_history`; `reports/2026-09-04` and `data/cards/2026-09-04/LNG.md` still show the published 3.0
with the correction dated beneath it. `site/scripts/sync.mjs` parses that card line so `/screener`
marks the score `3.0*` rather than silently disagreeing with `/position`.

## Invariants worth testing before publishing

- `entry_price` for a given `(ticker, entry_date)` never changes across git history.
- No row appears in both `positions` and `history`.
- `record.closed` equals `history` rows with `pnl_pct` and without `bookkeeping`.
- `win_rate_pct` is `null` or in `0..100`; never `0` when `closed` is `0`.
- Every `WATCH` plan has a non-null `alert_level`.
