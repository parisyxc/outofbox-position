# Site Structure — "Out-of-the-Box Position" (Astro · static · Vercel/GitHub Pages)

Modeled on balder-ai.com's information architecture, reduced to what your agent actually produces.
Balder's moat is **transparency + a scored record**; copy that, not the 10-product sprawl.

## Navigation (top bar)
`Home · Position · Daily · Screener · Method · Record · Reports · About · [X] [Substack] · Join`
+ a scrolling **ticker tape of currently-tracked names with P&L since entry** (balder's tape, but only names you own the record for).

## Pages

| Route | Balder analogue | Content source | What it shows |
|---|---|---|---|
| `/` | Home | ledger + latest report | Hero ("Identify with momentum, verify with fundamentals — every pick published on entry and exit"), **stats strip** (closed picks · win rate · avg trade · tickers covered · open now), "Best 4 entry-to-exit" cards, product grid, latest daily post |
| `/position` | Balder's Position (`/record`) | `data/ledger.json` | **Open book** (ticker, added date/price, plan, score, stop, target, P&L) + **closed history** (entry/exit/reason). Gold = entry disclosed, white = exit disclosed. |
| `/daily` · `/daily/YYYY-MM-DD` | Structure Read / posts | `reports/*/*.md` | Archive of daily reports; each day = the Balder's-Position-style post |
| `/screener` · `/screener/YYYY-MM-DD` | Structure Read (99 tickers) | `data/inputs/*.csv` + cards | Today's Out-of-the-Box list with triage score, overlay, target gap — sortable |
| `/method` | Research / Handbook | `skill/references/*` + `pipeline/*` | The 3-part rubric, verdict matrix, trading-plan rules, sources policy, what it does NOT do |
| `/record` | "Previous predictions, scored" | ledger history | Win rate, avg trade, avg hold, by plan type (stock / calls / watch) and by sector; equity-curve-style cumulative per-pick return |
| `/reports` | — | `reports/DATE/*.docx` | Library of full 5-page Momentum Verification Analyses (download) |
| `/alerts` | Event tracker | ledger `alert_level` fields | Live list of WATCH names and the level that triggers action |
| `/about` · `/join` | About / Join | static | Who, why, disclaimer; optional subscription later ($/mo like balder) |

## Astro layout
```
site/
  astro.config.mjs
  src/
    content/config.ts          # collections: daily (md), ledger (json), screener (csv→json)
    content/daily/             # symlink or copy of ../reports/*/*.md
    data/ledger.json           # copy of ../data/ledger.json at build
    layouts/Base.astro         # nav, ticker tape, footer w/ disclaimer
    components/
      StatsStrip.astro  PositionTable.astro  PickCard.astro  ScreenerTable.astro
      TickerTape.astro  RecordChart.astro (Chart.js)  DisclaimerBlock.astro
    pages/
      index.astro  position.astro  record.astro  method.astro  about.astro  join.astro
      daily/index.astro  daily/[date].astro
      screener/index.astro  screener/[date].astro
      reports/index.astro  alerts.astro
  public/reports/              # docx files
```

## Build & deploy
- `npm create astro@latest site` → content collections → `npm run build` → Vercel (auto on push) or GitHub Pages.
- The `/daily` command ends by copying `reports/DATE/DATE.md` → `site/src/content/daily/` and `data/ledger.json` → `site/src/data/`, then `git commit && git push` (v2 roadmap).

## Design notes (from balder)
- Dark, dense, numbers-first; one accent color for "entry", one for "exit".
- Every product page: **how it's built · what it found · what it says now.**
- Publish the losers with the winners — the record page is the credibility engine.
- Bilingual toggle is a v3 add; structure the content collection with a `lang` field now.
