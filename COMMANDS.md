# Commands

Everything you can run, and what it does. Adding a new screener image is in [`INTAKE.md`](INTAKE.md);
the ledger's rules are in [`pipeline/06_track.md`](pipeline/06_track.md) and its shape in
[`pipeline/ledger.schema.md`](pipeline/ledger.schema.md).

## Slash commands — type these to Claude

| Command | What it does |
|---|---|
| `/daily 2026-09-08` | Full pipeline: ingest the image → triage every name → pick 7 → plan → reprice the ledger → write the report |
| `/daily 2026-09-08 --reprice-only` | Force reprice-only even when an image exists |
| `/daily 2026-09-03 --no-ledger` | Analyse a **past** date without touching the record — the only way to look backwards |
| `/verify LNG` | Full three-part verification on one ticker → five-page docx → appears on `/reports` |

### `/daily` picks its own mode

So on a day with no image you still just type `/daily DATE`. Checked in this order:

| # | Mode | Trigger | Does |
|---|---|---|---|
| 1 | **NO-LEDGER** | `--no-ledger` **and** an image exists | Report + cards; `data/ledger.json` untouched |
| 2 | **NOTHING TO DO** | `--no-ledger` **and** no image | Stops and says so — no session to analyse, and repricing is forbidden by the flag |
| 3 | **REPRICE-ONLY** | no image, **or** `--reprice-only` | Step 5R only: marks open positions, fires stops, prints the table |
| 4 | **LIVE** | otherwise | All eight steps; appends to the record |

`--no-ledger` outranks reprice-only deliberately: it is a promise not to write the record, and
repricing writes the record.

**Chronology guard.** A live run must be for a date on or after `ledger.as_of`. Earlier dates are
refused — use `--no-ledger`, or replay from an empty ledger (see `INTAKE.md`).

## Terminal — run these yourself

| Command | What it does |
|---|---|
| `./scripts/daily_reprice.sh` | Reprice on a no-image day. Derives the US session date from the local KST clock, logs to `logs/reprice.log`, and shouts if a position closed |
| `./scripts/daily_reprice.sh --dry-run` | The same, writing nothing |
| `python3 scripts/check_ledger.py` | 33 invariants on the record. Exit 0 or 1. **Run before committing any ledger change** |
| `python3 scripts/check_ledger.py FILE` | Check a preview or backup ledger instead |
| `python3 scripts/check_ledger.py --no-git` | Skip the git-history replay (faster) |
| `python3 scripts/reprice.py --date D --dry-run` | Reprice a specific date, raw, writing nothing |
| `node skill/scripts/generate_report.js data/configs/T.json out.docx` | Render a verification docx from a config |

### The site (from `site/`)

| Command | What it does |
|---|---|
| `npm run dev` | Local site at `http://localhost:4321/outofbox-position/` |
| `npm run build` | Static build into `site/dist/` |
| `npm run sync` | Re-read the repo's data into `src/generated/` without starting a server |
| `OUTOFBOX_LEDGER=/tmp/x.json npm run sync` | Render a hypothetical — a closed pick, a stop-out — on the real pages without touching the published record. Plain `npm run sync` restores it |

`npm run dev` and `npm run build` both run `sync` first, so the site can never render stale data.

## The routine

```bash
/daily 2026-09-08                     # or ./scripts/daily_reprice.sh when there is no image
python3 scripts/check_ledger.py       # must exit 0
git add -A && git commit && git push  # only after looking at what changed
```

## Three things that bite

- **Repricing writes the ledger but never commits.** A change sits in your working tree until you
  commit it deliberately. That is on purpose — the ledger is the published record.
- **The stop is tested against the closing price on the day the script runs.** A position that
  breaks its stop on a session nobody reprices, and recovers before the next run, never enters the
  record. Reprice every trading day, not only the days an image arrives.
- **Never pass `--screener` on a day with no screener.** It advances `screener_absent_days` for
  every name not on the list, and three of those fire an exit — closing a position on evidence that
  was never gathered. `daily_reprice.sh` omits it for you.

## Publishing

Nothing is published today: the repo is private and the GitHub Pages deploy job is gated on the
repo being public. CI still builds the site and runs `check_ledger.py` on every push, so a record
that violates its own invariants fails the build rather than reaching the web.

To go live on Vercel later, link the repo in Vercel and set **`BASE_PATH=/`** in the project's
environment — `site/astro.config.mjs` reads it, defaulting to `/outofbox-position` for the Pages
path. Vercel serves a private repo on the free tier. To use GitHub Pages instead, make the repo
public and set Settings → Pages → Source to "GitHub Actions".
