# Out-of-the-Box Daily Trading Agent

Daily pipeline: proprietary screener image → fundamentals verification (momentum-verify-fundamentals) → 7 picks → trading plan → Balder's-Position-style report → scored ledger → site.

Start here: `PLAN.md` (architecture) → `CLAUDE.md` (agent rules) → `.claude/commands/daily.md` (the run).
Sample run: `reports/2026-09-04/2026-09-04.md` · state: `data/ledger.json` · site IA: `site/SITE_STRUCTURE.md`.

Setup: `cd skill/scripts && npm install` (installs `docx` for the report generator).
Run in Claude Code from this folder: `/daily 2026-09-04` or `/verify GILD`.

## v1 quick start (Claude Code)
```bash
cd "outofbox-agent"
pip install -r scripts/requirements.txt        # yfinance for auto-pricing
cd skill/scripts && npm install && cd ../..    # docx generator
claude                                         # open Claude Code here
```
Then inside Claude Code:
- `/daily 2026-09-04` — full run on the sample image (ledger already seeded; reprice will price it)
- `python3 scripts/reprice.py` — anytime, to refresh P&L on the open book
- `/verify GILD` — full 5-page framework on one name
Entry price = screener close (locked). Never edit `entry_price` by hand.
