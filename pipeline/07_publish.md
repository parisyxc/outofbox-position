# 07 — Publish
1. Full docx for the 7 picks: build `data/configs/TICKER.json` from `skill/assets/config.example.json`, run
   `node skill/scripts/generate_report.js data/configs/TICKER.json reports/DATE/TICKER_Momentum_Verification_Analysis.docx`, validate.
2. Copy `reports/DATE/DATE.md` → `site/src/content/daily/`, `data/ledger.json` → `site/src/data/`, docx → `site/public/reports/DATE/`.
3. `cd site && npm run build` → deploy (Vercel auto-deploy on push, or `gh-pages`).
4. Optional: post the header + focus line to X / Substack with a link to `/daily/DATE`.
