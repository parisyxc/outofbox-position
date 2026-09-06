# 02 — Light Triage (all candidates)

Goal: score every screener name in ~1 web pull each, so selection is evidence-based but fast.

## Per-ticker data to capture (one quote/forecast page, e.g. stockanalysis.com/stocks/TICKER)
- price, 52-week low/high, % from high, beta, market cap
- revenue growth (ttm or latest quarter), net-income/EPS growth, margin direction
- **analyst consensus + average target → gap% = target/price − 1**
- last-quarter headline: beat/miss, guidance raised/cut
- one-line catalyst (product launch, buyback, contract, regulatory date) if visible

## Light score (skill rubric, 0 / 0.5 / 1 each)
- **Q** Quality — margins/profitability expanding? (biotech: runway ≥18 months?)
- **G** Growth — rate & driver; raised guidance or accelerating = 1.0; single-digit/decelerating = 0.5
- **P** Peer — leader/share-gainer in niche = 1.0; in-line = 0.5; laggard = 0

## Technical overlay (one word)
- **constructive** — below high with room, target > price
- **extended** — at/near 52-wk high **and** target ≈ price (gap < 3%)
- **euphoric** — price **above** avg target, or +200% 1-yr, or RSI > 80
- **oversold** — >30% below high, RSI < 30, fundamentals intact

## Output: `data/cards/DATE/TICKER.md` (use `templates/triage_card.md`) and one ranked table.
Sort by total score desc, then gap% desc. Names with price above every target are capped at WATCH.
