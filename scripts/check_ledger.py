#!/usr/bin/env python3
"""
check_ledger.py — assert the invariants in pipeline/ledger.schema.md against data/ledger.json.

  python3 scripts/check_ledger.py              # full check, including git history
  python3 scripts/check_ledger.py FILE         # check another ledger (a preview, a backup)
  python3 scripts/check_ledger.py --no-git     # skip the git-history replay (fast)
  python3 scripts/check_ledger.py --quiet      # only print failures

Exit code 0 = every invariant holds, 1 = at least one is broken. Run it before committing a
ledger change or publishing the site.

The point is not tidiness. The record's only value is that it was published before the outcome
and has not been quietly adjusted since, so the checks that matter most are the ones nobody
would notice failing: an entry price that moved, a phantom trade in the win rate, a 0% win
rate printed off zero closed trades.
"""
import argparse, csv, datetime as dt, json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "data" / "ledger.json"

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
OVERLAYS = {"constructive", "extended", "euphoric", "oversold"}
PLANS = {"LONG_STOCK", "LONG_STOCK+CALLS", "WATCH"}
RESEARCH = ("ticker", "entry_date", "entry_price", "sector", "score", "overlay", "plan", "stop", "target")

class Checker:
    def __init__(self, quiet=False):
        self.failures, self.checks, self.quiet = [], 0, quiet

    def ok(self, label, cond, detail=""):
        self.checks += 1
        if cond:
            if not self.quiet: print(f"  \033[32mPASS\033[0m  {label}")
        else:
            self.failures.append(label)
            print(f"  \033[31mFAIL\033[0m  {label}" + (f"\n          {detail}" if detail else ""))

    def section(self, name):
        if not self.quiet: print(f"\n{name}")


def is_date(s): return isinstance(s, str) and bool(DATE_RE.match(s))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-git", action="store_true", help="skip the git-history entry_price replay")
    ap.add_argument("--quiet", action="store_true", help="print failures only")
    ap.add_argument("ledger", nargs="?", help="ledger to check (default data/ledger.json)")
    a = ap.parse_args()

    target = Path(a.ledger) if a.ledger else LEDGER
    if a.ledger: a.no_git = True   # git history only means anything for the tracked ledger
    d = json.loads(target.read_text())
    pos, hist, alts = d.get("positions", []), d.get("history", []), d.get("alternates", [])
    c = Checker(a.quiet)

    # ---- structure -------------------------------------------------------------
    c.section("structure")
    for k in ("as_of", "positions", "alternates", "history", "best_tracking", "record"):
        c.ok(f"top-level `{k}` present", k in d)
    c.ok("as_of is a date or null", d.get("as_of") is None or is_date(d["as_of"]), repr(d.get("as_of")))
    dupes = set(p["ticker"] for p in pos) & set(h["ticker"] for h in hist)
    c.ok("no ticker in both positions and history", not dupes, f"in both: {sorted(dupes)}")
    c.ok("alternates have ticker/score/reason",
         all({"ticker", "score", "reason"} <= set(x) for x in alts))

    # ---- open positions --------------------------------------------------------
    c.section("positions[]")
    missing = [(p.get("ticker"), f) for p in pos for f in RESEARCH if f not in p]
    c.ok("every position has the research fields", not missing, str(missing))
    c.ok("status is new or tracking",
         all(p["status"] in ("new", "tracking") for p in pos),
         str([(p["ticker"], p["status"]) for p in pos if p["status"] not in ("new", "tracking")]))
    c.ok("overlay is a known value", all(p["overlay"] in OVERLAYS for p in pos),
         str([(p["ticker"], p["overlay"]) for p in pos if p["overlay"] not in OVERLAYS]))
    c.ok("plan is a known value", all(p["plan"] in PLANS for p in pos),
         str([(p["ticker"], p["plan"]) for p in pos if p["plan"] not in PLANS]))
    c.ok("score is 0..3 in 0.5 steps",
         all(0 <= p["score"] <= 3 and (p["score"] * 2) == int(p["score"] * 2) for p in pos),
         str([(p["ticker"], p["score"]) for p in pos if not (0 <= p["score"] <= 3)]))
    c.ok("entry_price and entry_date are sane",
         all(p["entry_price"] > 0 and is_date(p["entry_date"]) for p in pos))
    # a long book: the stop sits below the entry, or it is not a stop
    bad_stop = [(p["ticker"], p["stop"], p["entry_price"]) for p in pos
                if p.get("stop") is not None and p["stop"] >= p["entry_price"]]
    c.ok("stop is below entry_price on every long", not bad_stop, str(bad_stop))
    no_alert = [p["ticker"] for p in pos if p["plan"].startswith("WATCH") and p.get("alert_level") is None]
    c.ok("every WATCH has an alert_level", not no_alert, str(no_alert))

    # ---- derived market fields -------------------------------------------------
    c.section("derived fields")
    drift = [(p["ticker"], p["pnl_pct"], round((p["last_price"] / p["entry_price"] - 1) * 100, 2))
             for p in pos if p.get("last_price") is not None
             and abs(p["pnl_pct"] - (p["last_price"] / p["entry_price"] - 1) * 100) > 0.011]
    c.ok("pnl_pct == (last/entry - 1) * 100", not drift, str(drift))
    dh = [(p["ticker"], p["days_held"]) for p in pos
          if p.get("last_price_date") and p.get("days_held") is not None
          and p["days_held"] != (dt.date.fromisoformat(p["last_price_date"]) - dt.date.fromisoformat(p["entry_date"])).days]
    c.ok("days_held == entry_date -> last_price_date", not dh, str(dh))
    sh = [p["ticker"] for p in pos + hist
          if "score_history" in p and p["score_history"][-1]["score"] != p["score"]]
    c.ok("score_history ends at the current score", not sh, str(sh))
    sh_order = [p["ticker"] for p in pos + hist if "score_history" in p
                and [x["date"] for x in p["score_history"]] != sorted(x["date"] for x in p["score_history"])]
    c.ok("score_history is in date order", not sh_order, str(sh_order))

    # ---- closed trades ---------------------------------------------------------
    c.section("history[]")
    c.ok("every history row has exit_date/exit_price/reason",
         all({"exit_date", "exit_price", "reason"} <= set(h) for h in hist),
         str([h["ticker"] for h in hist if not {"exit_date", "exit_price", "reason"} <= set(h)]))
    c.ok("exit_date is on or after entry_date",
         all(h["exit_date"] >= h["entry_date"] for h in hist if h.get("exit_date")))
    c.ok("bookkeeping, where present, is a bool",
         all(isinstance(h["bookkeeping"], bool) for h in hist if "bookkeeping" in h))

    # ---- the published record --------------------------------------------------
    c.section("record  (what /record publishes)")
    closed = [h for h in hist if h.get("pnl_pct") is not None and not h.get("bookkeeping")]
    wins = [h for h in closed if h["pnl_pct"] > 0]
    r = d.get("record", {})
    c.ok("record.closed excludes bookkeeping rows", r.get("closed") == len(closed),
         f"record says {r.get('closed')}, real closed trades = {len(closed)}")
    c.ok("record.open_now == len(positions)", r.get("open_now") == len(pos))
    wr = r.get("win_rate_pct")
    c.ok("win_rate_pct is null or 0..100", wr is None or 0 <= wr <= 100, repr(wr))
    c.ok("win_rate_pct is NOT 0 when nothing has closed",
         not (len(closed) == 0 and wr == 0),
         "zero closed trades is not a 0% win rate — see ledger.schema.md, The zero trap")
    if closed:
        c.ok("win_rate_pct matches the closed rows",
             wr is not None and abs(wr - 100 * len(wins) / len(closed)) < 0.05)
        c.ok("avg_trade_pct matches the closed rows",
             r.get("avg_trade_pct") is not None
             and abs(r["avg_trade_pct"] - sum(h["pnl_pct"] for h in closed) / len(closed)) < 0.011)
    else:
        c.ok("win_rate_pct is null with nothing closed", wr is None, repr(wr))
    bt = d.get("best_tracking")
    if bt:
        live = {p["ticker"]: p for p in pos if p["status"] == "tracking" and p.get("pnl_pct") is not None}
        c.ok("best_tracking names a real tracking position", bt["ticker"] in live)
        if bt["ticker"] in live:
            c.ok("best_tracking is actually the best",
                 abs(bt["pnl_pct"] - max(p["pnl_pct"] for p in live.values())) < 0.011)

    # ---- entry price: the rule the whole record rests on ------------------------
    c.section("entry_price  (the rule the record rests on)")
    csv_mismatch = []
    for p in pos + hist:
        f = ROOT / "data" / "inputs" / f"{p['entry_date']}.csv"
        if not f.exists(): continue
        for row in csv.DictReader(f.open()):
            if row["ticker"] == p["ticker"] and abs(float(row["last"]) - p["entry_price"]) > 0.005:
                csv_mismatch.append((p["ticker"], p["entry_date"], p["entry_price"], row["last"]))
    c.ok("entry_price == the screener `last` on entry_date", not csv_mismatch,
         "ledger vs screener CSV: " + str(csv_mismatch))

    if not a.no_git:
        shas = subprocess.run(["git", "log", "--format=%H", "--", "data/ledger.json"],
                              cwd=ROOT, capture_output=True, text=True).stdout.split()
        seen, moved = {}, []
        for sha in shas:
            blob = subprocess.run(["git", "show", f"{sha}:data/ledger.json"],
                                  cwd=ROOT, capture_output=True, text=True).stdout
            if not blob: continue
            old = json.loads(blob)
            for row in old.get("positions", []) + old.get("history", []):
                k = (row["ticker"], row["entry_date"])
                if k in seen and abs(seen[k] - row["entry_price"]) > 0.005:
                    moved.append((k, seen[k], row["entry_price"]))
                seen[k] = row["entry_price"]
        c.ok(f"entry_price never changed across {len(shas)} ledger commit(s)", not moved, str(moved))

    # ---- verdict ---------------------------------------------------------------
    n = c.checks
    if c.failures:
        print(f"\n\033[31m{len(c.failures)} of {n} checks FAILED\033[0m — do not publish until these are fixed:")
        for f in c.failures: print(f"  · {f}")
        return 1
    print(f"\n\033[32mall {n} invariants hold\033[0m")
    return 0


if __name__ == "__main__":
    sys.exit(main())
