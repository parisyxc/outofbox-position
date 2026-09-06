# Out-of-the-Box Daily Trading Agent — Architecture Plan

> **Thesis:** your proprietary "Out of the Box" screener is the *Identify with Momentum* layer.
> The `momentum-verify-fundamentals` skill is the *Verify with Fundamentals* layer.
> The agent's job is to run the second on the first, every day, pick 7, publish a
> ParisYoung's-Position-style report with a trading plan, and keep a scored ledger.

## 0. The structural assets you are building (Owner Layer)

| Asset | Why it compounds |
|---|---|
| **Scored ledger** (`data/ledger.json`) | Every pick with entry date/price, exit, P&L → a public *track record*. This is the product, not the picks. |
| **Report archive** (`reports/YYYY-MM-DD.md`) | Daily dated posts = SEO + credibility; the moat is "entry and exit both disclosed". |
| **Rubric-as-code** (skill + `pipeline/*.md`) | The method is written down → replicable, auditable, improvable. |
| **Distribution surface** (`site/`) | Your own domain, your own data. X/Substack become feeders, not the home. |

## 1. Pipeline (runs once per trading day, after the close)

```
 image (2026Sep04-outofbox.jpg)
   │  01 INGEST  — vision-read the screener → tickers, last, %chg, volume, sector → data/inputs/DATE.csv
   ▼
 45 candidates
   │  02 TRIAGE  — LIGHT pass on all: 3-pillar rubric (0/0.5/1) + technical overlay + target-vs-price
   │              1 web pull per name (quote page) → templates/triage_card.md per ticker
   ▼
 ranked list (score, overlay, target gap)
   │  03 SELECT  — pick 7: score ≥2.0, diversify sectors (max 4 per sector), prefer target>price,
   │              flag "extended" names as WATCH not BUY; name 2–3 alternates
   ▼
 7 picks
   │  04 PLAN    — map (score × overlay × catalyst) → WATCH / LONG STOCK / LONG CALLS
   │              conservative rules: ≤5% per name, hard stop, calls only ≥2.5 + dated catalyst
   ▼
   │  05 REPORT  — render templates/daily_report.md (English, ParisYoung's-Position structure)
   │  06 TRACK   — update ledger: 新增 (new) / 持续 (continuing) / 结束 (exited); compute P&L since entry
   │  07 PUBLISH — full docx (skill generator) for the 7 picks only; build site; post
   ▼
 reports/DATE/DATE.md · reports/DATE/*.docx · site deploy
```

**Depth rule (your decision):** light cards for all 45; full 5-page docx only for the 7 picks.

## 2. Scoring & selection rules (from the skill's rubric)

- **Part 1 Quality** — margins/profitability trend (biotech: balance sheet & runway)
- **Part 2 Growth** — growth rate & driver; price/mix > volume; raised guidance = bull
- **Part 3 Peer** — leader / share-gainer in its niche
- **Technical overlay** — constructive / extended / euphoric / oversold, and **analyst target vs price** (the single best tell: price *above* every target = don't chase)

**Verdict matrix (fundamentals × technicals):**

| Score | Overlay | Plan |
|---|---|---|
| ≥2.5 | constructive, target > price | **LONG STOCK** (+ **LONG CALLS** if dated catalyst) |
| ≥2.5 | extended / target ≈ price | **WATCH** + alert at pullback level |
| 2.0 | any | **WATCH** |
| ≤1.5 | any | drop (or speculative-tiny only if flagged) |

## 3. Trading-plan rules (conservative, your decision)

- Instruments: **long stock**; **long calls** only when score ≥2.5 **and** a dated catalyst inside the expiry (earnings, FDA, guidance event); 60–90 DTE, strike near-the-money, size ≤1% of account per call position.
- Sizing: ≤5% of account per name; ≤20% per sector.
- Risk: every position has a **hard stop** (below the breakout base / recent swing low); every WATCH has an **alert level** (pullback entry or breakout confirmation).
- Exit rule for the ledger: exit when (a) stop hit, (b) score drops ≤1.5 on re-verify, or (c) name leaves the screener for 3 consecutive days *and* relative strength fades (an "α信号转弱" / alpha-signal-weakening exit).

## 4. Ledger (state) — `data/ledger.json`

```json
{ "positions": [ { "ticker":"GILD", "status":"tracking", "entry_date":"2026-09-04",
    "entry_price":151.22, "plan":"LONG_STOCK+CALLS", "score":3.0, "stop":138, "target":158,
    "notes":"HIV +12%, Yeztugo +40% QoQ, FY guide raised" } ],
  "history": [ { "ticker":"NET", "entry_date":"2026-09-01","entry_price":287.01,
    "exit_date":"2026-09-04","exit_price":279.24,"pnl_pct":-2.71,"reason":"signal weakened" } ] }
```
The report's header line (`📈 SMTC tracking +10.44% (added 2026-08-31)`) and the three sections
(New / Continuing / Exited) are generated **from the ledger**, never hand-written.

## 5. Daily report template — English, ParisYoung's-Position structure

Header → market context → **I. New tracking** (per pick: *Signal · Logic · Key levels · Plan · Verdict*) →
**II. Continuing** → **III. Exited** → alternates → disclaimer. See `templates/daily_report.md`.

## 6. Site (Astro, static, Vercel/GitHub Pages) — modeled on a public entry-and-exit track-record site

See `site/SITE_STRUCTURE.md`. Core pages: **Position** (the ledger, entry & exit disclosed),
**Daily** (archive), **Method** (the rubric), **Record** (scored stats), **Reports** (docx library).

## 7. Scheduling

- Trigger: you drop `YYYYMonDD-outofbox.jpg` into `Out-of-the-Box-Proprietary-Stock/` after the close.
- Run: `/daily 2026-09-04` in Claude Code (or a Cowork scheduled task at 17:30 ET on weekdays that
  looks for today's image and runs the pipeline).
- Output: `reports/DATE/DATE.md` + docx for the 7 + ledger updated + site rebuilt.

## 8. Roadmap

1. **v0 (today):** scaffold + Sep-04 sample run (this folder).
2. **v1:** Claude Code `/daily` command runs 01→06 end-to-end; ledger P&L auto-priced.
3. **v2:** Astro site live; `/daily` also commits `reports/` and triggers deploy.
4. **v3:** scoring: weekly "Record" stats (win rate, avg trade, hold time).
5. **v4:** alerts — price-level alerts pushed (email/Discord) when a WATCH level is hit.

## 9. Risks / honesty notes

- The screener image must be read by vision; an OCR error = a wrong ticker. Ingest step must echo the parsed list back for a 5-second human check.
- Light triage uses one quote page per name; numbers are point-in-time and can lag. Full docx for the 7 re-verifies from primary sources.
- Nothing here is investment advice; the agent produces a research process and a track record, not recommendations.
