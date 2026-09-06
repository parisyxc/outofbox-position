# Config schema — generate_report.js

The generator renders one `.docx` from a single JSON config. **Only `verdict` and
`parts` are required; every other top-level section is optional** and is skipped if
the key is absent. Copy `assets/config.example.json` and edit it.

## Tone keyword (drives all color)
Most elements take a `tone`. It maps to a consistent color set:

| tone | meaning | banner bg | light bg | text |
|------|---------|-----------|----------|------|
| `bull` | positive / strong | green | light green | green |
| `bear` | negative / risk | red | light red | red |
| `caution` | mixed / watch | orange | light orange | orange |
| `neutral` / `navy` | factual | navy | light gray | navy |
| `info` | commentary | teal | light purple | purple |

## Cell format (tables)
A table cell is **either a plain string** or an object:
```json
{ "t": "text", "tone": "bull", "bold": true, "fill": "feebc8", "color": "1a365d" }
```
- `tone` sets the text color (unless `color` overrides). `fill` sets the cell
  background (or use `cellTone` to derive a light fill from a tone).

## Top-level fields

| Field | Required | Notes |
|-------|----------|-------|
| `ticker`, `company`, `sector`, `date` | ticker/company yes | Title block. |
| `philosophy` | no | Tagline; defaults to "Identify with Momentum, Verify with Fundamentals". |
| `verdict` | **yes** | `{ headline, score, tone, subhead?, summary? }` — top banner. |
| `zones` | no | Array (usually 3) of `{ label, value, note?, tone }` — the accumulate/stop/target boxes. |
| `divergence` | no | `{ title?, tech:{title,tone,bullets[]}, fund:{...}, assessment:{heading?,text,tone} }`. |
| `catalyst` | no | Trend section: `{ title, left, right, verdict:{text,tone} }`. `left`/`right` are boxes (see below). |
| `earnings` | no | `{ title?, headers[], widths?, rows[[cell,…]] }`. |
| `parts` | **yes** | Array of part objects (see below). Normally 3. |
| `technicals` | no | `{ title?, headers[], widths?, rows[[…]] }`. |
| `summary` | no | `{ headers?, widths?, rows[[component,score]], total?, overlay?, overlayTone? }`. `total` and `overlay` rows are appended automatically. |
| `finalVerdict` | no | `{ headline?, tone?, lines:[{label,text}], reasoning? }`. |
| `disclaimer` | no | Defaults to a standard "not investment advice" line dated to `date`. |

## Box object (used by divergence, catalyst, part `boxes`)
```json
{ "title": "HEADING", "tone": "bull",
  "bullets": ["line", "line"] }
```
or, for grouped sub-points:
```json
{ "title": "HEADING", "tone": "caution",
  "blocks": [ { "heading": "1. Point", "bullets": ["detail"] }, … ] }
```

## Part object
```json
{
  "title": "Part 1 — Quality Check (Margins & Profitability)",
  "question": "Is the price move supported by margin trends?",
  "headers": ["Factor","Read"],          // optional; default 2-col Factor/Read
  "widths":  [2600,6760],                // optional; must sum to 9360
  "rows": [ [ {"t":"Margin Trend","bold":true}, {"t":"…","tone":"bull"} ], … ],
  "boxes": [ box, box ],                  // optional two-column boxes under the table
  "scoreLabel": "QUALITY SCORE",          // optional; default "SCORE"
  "score": "0.5 / 1.0 — EXPANDING but THIN",
  "scoreTone": "caution"
}
```

## Table widths
All `widths` arrays are in DXA and **must sum to 9360** (US-Letter content width).
Omit `widths` to get equal columns. Two-column part tables default to `[2600,6760]`.

## Run
```bash
node scripts/generate_report.js config.json OUTPUT.docx
```
