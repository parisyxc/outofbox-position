// Copies the pipeline's outputs into src/generated/ so the site has a single, typed
// source of truth inside src/. Run by `npm run dev` and `npm run build` (and by CI),
// so the site never reads across the project root at request time.
//
// Reads:  ../data/ledger.json · ../data/inputs/*.csv · ../data/cards/DATE/*.md · ../reports/DATE/DATE.md
// Writes: src/generated/{ledger.json, manifest.json, screener/DATE.json, daily/DATE.md}

import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(SITE, '..');
const OUT = path.join(SITE, 'src/generated');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const num = (s) => (s == null || s === '' ? null : Number(String(s).replace(/[$,%+\s]/g, '')));

// ── triage cards ────────────────────────────────────────────────────────────────
function parseCard(md) {
  const row = (label) =>
    md.match(new RegExp(`^\\|\\s*${label}\\s*\\|\\s*(.+?)\\s*\\|\\s*$`, 'm'))?.[1] ?? null;

  const head = md.match(/^#\s*(\S+)\s*—\s*(.+?)\s*·\s*(.+?)\s*·\s*(\d{4}-\d{2}-\d{2})/m);
  const price = row('Price / chg');
  const wk52 = row('52-wk');
  const analysts = row('Analysts');
  const growth = row('Growth');
  const caps = row('Cap / beta / PE');
  const score = md.match(/\*\*Score\*\*\s*Q\s*([\d.]+)\s*·\s*G\s*([\d.]+)\s*·\s*P\s*([\d.]+)\s*=\s*\*\*([\d.]+)\/3\.0\*\*\s*·\s*Overlay:\s*\*\*(\w+)\*\*/);

  return {
    ticker: head?.[1] ?? null,
    name: head?.[2] ?? null,
    sector: head?.[3] ?? null,
    last: num(price?.match(/\$([\d.,]+)/)?.[1]),
    pct: num(price?.match(/\(([-+]?[\d.]+)%\)/)?.[1]),
    volume: num(price?.match(/vol\s*([\d,]+)/)?.[1]),
    low52: num(wk52?.match(/\$([\d.,]+)/)?.[1]),
    high52: num(wk52?.match(/–\s*\$([\d.,]+)/)?.[1]),
    fromHighPct: num(wk52?.match(/([-+]?[\d.]+)%\s*from high/)?.[1]),
    revGrowthPct: num(growth?.match(/rev\s*([-+]?[\d.]+)%/)?.[1]),
    rating: analysts?.match(/^(Strong Buy|Buy|Hold|Sell)/)?.[1] ?? null,
    target: num(analysts?.match(/avg target\s*\$([\d.,]+)/)?.[1]),
    targetGapPct: num(analysts?.match(/gap\s*([-+]?[\d.]+)%/)?.[1]),
    marketCap: caps?.match(/^\$([\d.]+[BMT])/)?.[1] ?? null,
    catalyst: row('Catalyst'),
    q: score ? Number(score[1]) : null,
    g: score ? Number(score[2]) : null,
    p: score ? Number(score[3]) : null,
    score: score ? Number(score[4]) : null,
    overlay: score?.[5] ?? null,
    read: md.match(/\*\*One-line read:\*\*\s*(.+)$/m)?.[1] ?? null,
    source: md.match(/\*\*Source:\*\*\s*(\S+)/)?.[1] ?? null,
  };
}

// ── screener CSV ────────────────────────────────────────────────────────────────
function parseCsv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const cols = header.split(',');
  return lines.filter(Boolean).map((line) => {
    // no quoted fields in these files, but tolerate them anyway
    const cells = line.match(/("([^"]*)"|[^,]*)(,|$)/g).slice(0, cols.length)
      .map((c) => c.replace(/,$/, '').replace(/^"|"$/g, ''));
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']));
  });
}

// ── daily reports ───────────────────────────────────────────────────────────────
function parseReport(date, md) {
  const lines = md.split(/\r?\n/);
  const headline = lines.find((l) => l.startsWith('📈'))?.trim() ?? null;
  const focusLine = lines.find((l) => l.includes('Out-of-the-Box Position ·')) ?? '';
  const focus = (focusLine.match(/Focus:\s*([A-Z\s]+?)(?:\s*·|\*\*)/)?.[1] ?? '').trim().split(/\s+/).filter(Boolean);
  const watch = (focusLine.match(/Watch:\s*([A-Z\s]+?)(?:\s*·|\*\*)/)?.[1] ?? '').trim().split(/\s+/).filter(Boolean);

  const picks = [...md.matchAll(/^###\s+(\S+)\s+—\s+\$([\d.,]+)\s*·\s*Score\s*([\d.]+)\/3\.0\s*·\s*Plan:\s*(.+)$/gm)]
    .map((m) => ({ ticker: m[1], price: num(m[2]), score: Number(m[3]), plan: m[4].trim() }));

  // lead paragraph: first non-heading, non-quote, non-bold-only block after the focus line
  const body = lines.slice(lines.indexOf(focusLine) + 1);
  let summary = '';
  for (let i = 0; i < body.length; i++) {
    const l = body[i].trim();
    if (!l || l.startsWith('>') || l.startsWith('#') || l === '---') continue;
    const block = [];
    for (let j = i; j < body.length && body[j].trim(); j++) block.push(body[j].trim());
    summary = block.join(' ').replace(/\*\*/g, '');
    break;
  }

  // strip the headline + focus line from the body; they become frontmatter
  const content = lines
    .filter((l) => l !== headline && l !== focusLine)
    .join('\n')
    .replace(/^\s+/, '');

  return { headline, focus, watch, picks, summary, content };
}

const fm = (v) =>
  typeof v === 'string' ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(fm).join(', ')}]` : JSON.stringify(v);

// ── run ─────────────────────────────────────────────────────────────────────────
await rm(OUT, { recursive: true, force: true });
await mkdir(path.join(OUT, 'screener'), { recursive: true });
await mkdir(path.join(OUT, 'daily'), { recursive: true });

// ledger
const ledger = JSON.parse(await readFile(path.join(ROOT, 'data/ledger.json'), 'utf8'));
// A "bookkeeping" exit is a re-derivation artefact, not a trade that was ever live.
// Counting it would publish a real win rate off a position that never closed. See CLAUDE.md.
const closed = (ledger.history ?? []).filter((h) => h.pnl_pct != null && !h.bookkeeping);
const wins = closed.filter((h) => h.pnl_pct > 0);
ledger.stats = {
  closed: closed.length,
  wins: wins.length,
  winRatePct: closed.length ? Math.round((1000 * wins.length) / closed.length) / 10 : null,
  avgTradePct: closed.length ? Math.round((100 * closed.reduce((a, h) => a + h.pnl_pct, 0)) / closed.length) / 100 : null,
  openNow: (ledger.positions ?? []).length,
  excludedBookkeeping: (ledger.history ?? []).filter((h) => h.bookkeeping).length,
};
await writeFile(path.join(OUT, 'ledger.json'), JSON.stringify(ledger, null, 2));

// screener days = every data/inputs/DATE.csv, enriched with that day's triage cards
const inputs = existsSync(path.join(ROOT, 'data/inputs')) ? await readdir(path.join(ROOT, 'data/inputs')) : [];
const screenerDates = [];
for (const file of inputs.filter((f) => f.endsWith('.csv') && DATE_RE.test(f.slice(0, 10)))) {
  const date = file.slice(0, 10);
  const rows = parseCsv(await readFile(path.join(ROOT, 'data/inputs', file), 'utf8'));
  const cardDir = path.join(ROOT, 'data/cards', date);
  const cards = {};
  if (existsSync(cardDir)) {
    for (const c of (await readdir(cardDir)).filter((f) => f.endsWith('.md'))) {
      const parsed = parseCard(await readFile(path.join(cardDir, c), 'utf8'));
      if (parsed.ticker) cards[parsed.ticker] = parsed;
    }
  }
  const merged = rows.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    sector: r.sector,
    last: num(r.last),
    chg: num(r.chg),
    pct: num(r.pct),
    volume: num(r.volume),
    ...(cards[r.ticker] ?? {}),
  }));
  await writeFile(path.join(OUT, 'screener', `${date}.json`), JSON.stringify(merged, null, 2));
  screenerDates.push({ date, count: merged.length, scored: merged.filter((m) => m.score != null).length });
}

// daily reports — reports/DATE/DATE.md only. The `????-??-??.md` shape deliberately
// excludes archived variants like `2026-09-04.published.bak.md`, which would otherwise
// render as a second, competing post for the same day.
const reportDirs = existsSync(path.join(ROOT, 'reports')) ? await readdir(path.join(ROOT, 'reports')) : [];
const dailyDates = [];
for (const dir of reportDirs.filter((d) => DATE_RE.test(d))) {
  const src = path.join(ROOT, 'reports', dir, `${dir}.md`);
  if (!existsSync(src)) continue;
  const r = parseReport(dir, await readFile(src, 'utf8'));
  const docx = (await readdir(path.join(ROOT, 'reports', dir))).filter((f) => f.endsWith('.docx'));
  const front = [
    '---',
    `date: ${dir}`,
    `headline: ${fm(r.headline ?? '')}`,
    `summary: ${fm(r.summary)}`,
    `focus: ${fm(r.focus)}`,
    `watch: ${fm(r.watch)}`,
    `picks: ${JSON.stringify(r.picks)}`,
    `docx: ${fm(docx)}`,
    'lang: en',
    '---',
    '',
  ].join('\n');
  await writeFile(path.join(OUT, 'daily', `${dir}.md`), front + r.content);
  dailyDates.push({ date: dir, picks: r.picks.length, docx: docx.length });
}

const manifest = {
  generatedAt: new Date().toISOString(),
  screener: screenerDates.sort((a, b) => b.date.localeCompare(a.date)),
  daily: dailyDates.sort((a, b) => b.date.localeCompare(a.date)),
};
await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(
  `sync → ${manifest.daily.length} daily report(s), ${manifest.screener.length} screener day(s), ` +
  `${ledger.stats.openNow} open position(s), ${ledger.stats.closed} closed` +
  (ledger.stats.excludedBookkeeping ? ` (${ledger.stats.excludedBookkeeping} bookkeeping exit excluded)` : '')
);
