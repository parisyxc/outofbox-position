---
name: momentum-verify-fundamentals
description: >
  Produce a "Momentum Verification Analysis" report for any stock ticker — the
  "Identify with Momentum, Verify with Fundamentals" framework. Use whenever the
  user asks to run, verify, score, or analyze a ticker through this framework, or
  says things like "momentum verify <TICKER>", "run <TICKER>", "verify fundamentals
  on <TICKER>", "momentum check <TICKER>", or asks for a 3-part Quality/Growth/Peer
  score with a technical overlay and a verdict. Researches current financials,
  scores the 3-part rubric, and generates a branded .docx in the house format.
---

# Momentum Verification Analysis

A repeatable pipeline that turns a ticker into a consistent, branded research
report. The thesis: **momentum identifies candidates; fundamentals decide whether
to act.** A stock is scored **0–3** across three equally-weighted parts, then a
**technical overlay** is layered on top. The verdict comes from the *relationship*
between the fundamental score and the technical picture — especially when they
diverge.

## When to use

Trigger on any request to run / verify / score / analyze a ticker through this
framework (e.g. "momentum verify $NVDA", "run TSLA, focus on the robotaxi angle",
"verify fundamentals on $VSH especially the MLCC trend"). The user may name a
specific trend or catalyst to emphasize — fold it into the Peer Check and the
optional Catalyst section.

## Workflow (do these in order)

1. **Research first — never fabricate figures.** Use web search / fetch to gather,
   for the *most recent* reported period:
   - Latest quarter revenue, gross/operating margin, EPS, FCF, and guidance.
   - Segment / divisional growth, and whether growth is **price-** or **volume-**driven.
   - Order signals where relevant (book-to-bill, backlog).
   - The peer group and the company's relative position — especially in any
     trend/catalyst the user named (is it a leader or a follower?).
   - Technicals: price, 52-week range, 1-yr return, RSI, trend, support/resistance.
   - Analyst consensus rating and price target.
   See `references/sources-checklist.md` for the full checklist and good source types.

2. **Score the rubric.** Apply `references/scoring-rubric.md` to assign each part
   0 / 0.5 / 1.0, sum to a **/3.0** total, and characterize the **technical overlay**
   (bullish / bearish / euphoric-overbought / oversold). Derive the verdict from the
   divergence table in the rubric.

3. **Fill a config.** Copy `assets/config.example.json` (a complete worked example
   for $VSH) and replace the content with the researched, scored material for the new
   ticker. Field reference: `references/config.schema.md`. Every section except
   `verdict` and `parts` is optional — drop the `catalyst` block if there's no
   headline trend, etc.

4. **Generate the report.**
   ```bash
   # one-time: install the docx renderer
   npm install -g docx        # or: cd scripts && npm install docx
   node scripts/generate_report.js <your-config>.json <TICKER>_Momentum_Verification_Analysis.docx
   ```

5. **Verify, then deliver.** Validate the file (the docx skill's
   `scripts/office/validate.py`) and render a page or two to images to eyeball the
   layout. Sanity-check that the part scores sum to the headline total and that the
   numbers match the sources. Save to the user's folder and present it. Include a
   "Sources" list of the URLs used.

## The framework in one screen

| Part | Question | 1.0 | 0.5 | 0.0 |
|------|----------|-----|-----|-----|
| **1. Quality** (margins) | Is the price move backed by margin trends? | Margins clearly **expanding** off a healthy base | Expanding but **thin / early-cycle**, or flat | **Contracting** |
| **2. Growth** (divisional) | Which division drives growth; is it sustainable? | **Price/mix-driven** (more durable) or secular | **Volume/cyclical** or decelerating | **Stalling / one-off** |
| **3. Peer** (relative strength) | Leading or lagging its peer group / the named trend? | Clear **leader / share gainer** | **In-line / diversified beneficiary** (follower) | **Laggard / losing share** |

**Technical overlay** (not scored, layered on): falling channel & broken support =
bearish; oversold RSI = potential entry; euphoric / overbought RSI at highs = late-stage.

**Verdict logic** — read fundamentals against technicals:
- **Strong fundamentals + bearish/oversold technicals** → *Accumulate on weakness* (don't catch a falling knife; wait for stabilization).
- **Weak/neutral fundamentals + euphoric/overbought technicals** → *Trim / take profits, don't chase* (momentum ahead of fundamentals).
- **Strong fundamentals + bullish technicals** → *Buy / add* (alignment).
- **Weak fundamentals + bearish technicals** → *Avoid / sell*.

## House style (handled automatically by the generator)

Arial throughout; navy title & section rules; full-width colored banner boxes for
the verdict, divergence assessment, and scores; bordered data tables with a navy
header row. Colors are driven by a **tone** keyword per element — `bull` (green),
`bear` (red), `caution` (orange), `neutral` (navy/gray), `info` (teal) — so the
look stays consistent across every ticker without hand-styling.

## Files

- `scripts/generate_report.js` — config-driven .docx renderer.
- `assets/config.example.json` — complete $VSH example (use as the template).
- `references/scoring-rubric.md` — detailed thresholds and verdict logic.
- `references/sources-checklist.md` — what to research and where.
- `references/config.schema.md` — every config field explained.
