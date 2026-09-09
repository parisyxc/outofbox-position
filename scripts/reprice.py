#!/usr/bin/env python3
"""
reprice.py — auto-price the ledger (v1).

  python3 scripts/reprice.py                     # price as of latest close
  python3 scripts/reprice.py --date 2026-09-05   # price as of a specific close (backfill)
  python3 scripts/reprice.py --screener data/inputs/2026-09-05.csv   # also update screener-absence counter
  python3 scripts/reprice.py --dry-run           # print, don't write

Rules (see pipeline/06_track.md):
  * entry_price is ALWAYS the screener close on entry_date — this script never changes it.
  * new → tracking on first reprice after entry.
  * exit → history when last_price <= stop (reason "stop hit"), or screener_absent_days >= 3 and
    overlay != constructive (reason "left screener + strength faded"), or target reached & flagged euphoric.
  * best_tracking (report header) = highest pnl_pct among tracking names.
Prices: yfinance (Yahoo) with a Stooq CSV fallback. Both are free, delayed EOD — fine for a
close-to-close ledger.
"""
import argparse, csv, datetime as dt, io, json, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "data" / "ledger.json"

def load(): return json.loads(LEDGER.read_text())
def save(d): LEDGER.write_text(json.dumps(d, indent=2))

# ---------- price sources ----------
def price_yf(ticker, asof=None):
    try:
        import yfinance as yf
    except ImportError:
        return None
    try:
        end = (dt.date.fromisoformat(asof) + dt.timedelta(days=1)) if asof else None
        hist = yf.Ticker(ticker).history(period="10d", end=end, auto_adjust=False)
        if hist.empty: return None
        row = hist.iloc[-1]
        return float(row["Close"]), hist.index[-1].date().isoformat()
    except Exception:
        return None

def price_stooq(ticker, asof=None):
    # Stooq daily CSV: https://stooq.com/q/d/l/?s=gild.us&i=d
    try:
        url = f"https://stooq.com/q/d/l/?s={ticker.lower()}.us&i=d"
        raw = urllib.request.urlopen(url, timeout=15).read().decode()
        rows = list(csv.DictReader(io.StringIO(raw)))
        if not rows: return None
        if asof:
            rows = [r for r in rows if r["Date"] <= asof]
            if not rows: return None
        r = rows[-1]
        return float(r["Close"]), r["Date"]
    except Exception:
        return None

def get_price(ticker, asof=None):
    return price_yf(ticker, asof) or price_stooq(ticker, asof)

# ---------- ledger logic ----------
def days_between(a, b):
    return (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days

def reprice(ledger, asof=None, screener_tickers=None, dry=False):
    today = asof or dt.date.today().isoformat()
    exited, rows = [], []
    for p in ledger["positions"]:
        got = get_price(p["ticker"], asof)
        if not got:
            rows.append((p["ticker"], p["status"], p["entry_price"], None, None, "NO PRICE"))
            continue
        last, pdate = got
        p["last_price"], p["last_price_date"] = round(last, 2), pdate
        # compute P&L from the *stored* rounded price so check_ledger.py, which
        # recomputes from last_price, agrees by construction rather than by tolerance.
        p["pnl_pct"] = round((p["last_price"] / p["entry_price"] - 1) * 100, 2)
        p["days_held"] = days_between(p["entry_date"], pdate)
        if p["status"] == "new": p["status"] = "tracking"
        # screener-absence counter
        if screener_tickers is not None:
            if p["ticker"] in screener_tickers:
                p["screener_absent_days"] = 0
            else:
                p["screener_absent_days"] = p.get("screener_absent_days", 0) + 1
        # exit rules
        reason = None
        if p.get("stop") and last <= p["stop"]:
            reason = "stop hit"
        elif p.get("screener_absent_days", 0) >= 3 and p.get("overlay") != "constructive":
            reason = "left screener + strength faded"
        elif p.get("target") and last >= p["target"] and p.get("overlay") == "euphoric":
            reason = "target reached (euphoric)"
        if reason:
            p.update({"status": "exited", "exit_date": pdate, "exit_price": round(last, 2), "reason": reason})
            exited.append(p)
        rows.append((p["ticker"], p["status"], p["entry_price"], p["last_price"], p["pnl_pct"], reason or ""))
    # move exits to history
    ledger["positions"] = [p for p in ledger["positions"] if p["status"] != "exited"]
    ledger.setdefault("history", []).extend(exited)
    # header pick
    tracking = [p for p in ledger["positions"] if p["status"] == "tracking" and "pnl_pct" in p]
    ledger["best_tracking"] = (max(tracking, key=lambda p: p["pnl_pct"]) if tracking else None) and \
        {k: max(tracking, key=lambda p: p["pnl_pct"])[k] for k in ("ticker", "pnl_pct", "entry_date")}
    # record stats
    hist = ledger.get("history", [])
    closed = [h for h in hist if "pnl_pct" in h and not h.get("bookkeeping")]
    ledger["record"] = {
        "closed": len(closed),
        "win_rate_pct": round(100 * sum(1 for h in closed if h["pnl_pct"] > 0) / len(closed), 1) if closed else None,
        "avg_trade_pct": round(sum(h["pnl_pct"] for h in closed) / len(closed), 2) if closed else None,
        "open_now": len(ledger["positions"]),
    }
    ledger["as_of"] = today
    # print
    print(f"{'TICKER':7}{'STATUS':10}{'ENTRY':>9}{'LAST':>9}{'P&L%':>8}  NOTE")
    for t, s, e, l, pnl, note in rows:
        print(f"{t:7}{s:10}{e:>9}{'' if l is None else l:>9}{'' if pnl is None else pnl:>8}  {note}")
    if ledger["best_tracking"]:
        b = ledger["best_tracking"]; print(f"\nheader → 📈 {b['ticker']} tracking {b['pnl_pct']:+.2f}% (added {b['entry_date']})")
    print("record →", ledger["record"])
    if not dry: save(ledger); print(f"\nwrote {LEDGER}")
    return ledger

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="price as of this close (YYYY-MM-DD)")
    ap.add_argument("--screener", help="today's data/inputs/DATE.csv to update the absence counter")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    tickers = None
    if a.screener:
        with open(a.screener) as f: tickers = {r["ticker"] for r in csv.DictReader(f)}
    reprice(load(), a.date, tickers, a.dry_run)
