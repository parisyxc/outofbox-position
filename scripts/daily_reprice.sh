#!/bin/bash
# Manual daily reprice helper — run this on any trading day you do NOT run /daily.
#
#   ./scripts/daily_reprice.sh              # reprice the US session that just closed
#   ./scripts/daily_reprice.sh --dry-run    # show what it would do, write nothing
#
# Why it matters: reprice.py tests the stop against the CLOSING price on the day it runs.
# If a position closes below its stop on a day nobody runs it, and recovers before the
# next run, that exit is lost from the record permanently. The site claims exits are
# disclosed too, so a skipped session is a hole in that claim.
#
# What it adds over calling reprice.py directly:
#   · works out the US session date from the local KST clock (US close 16:00 ET = 05:00 KST,
#     so the session that just closed is yesterday's local date)
#   · appends a timestamped entry to logs/reprice.log and says loudly if a position closed
#
# It does NOT commit or push. The ledger is the published record; committing stays deliberate.
#
# NOTE: this cannot be run by launchd/cron while the repo lives under ~/Desktop — macOS TCC
# denies background agents read access there. See the 2026-09-06 session notes.

set -uo pipefail

# Any argument is passed straight to reprice.py — `daily_reprice.sh --dry-run` prints
# what it would do and writes nothing. Used to smoke-test the schedule.

REPO="/Users/parisyoung/Desktop/momentum stock/outofbox-agent"
PY="/usr/bin/python3"
LOG="$REPO/logs/reprice.log"

cd "$REPO" || { echo "$(date '+%F %T %Z') FATAL: repo not found at $REPO" >>"$LOG"; exit 1; }

# The machine is KST (UTC+9); the US session that just closed is yesterday's KST date.
SESSION="$(date -v-1d +%Y-%m-%d)"

{
  echo "──────────────────────────────────────────────────────────────"
  echo "$(date '+%F %T %Z')  repricing US session $SESSION"
  before=$("$PY" -c 'import json;d=json.load(open("data/ledger.json"));print(len(d["positions"]),len(d.get("history",[])))' 2>/dev/null)
  "$PY" scripts/reprice.py --date "$SESSION" "$@" 2>&1
  rc=$?
  after=$("$PY" -c 'import json;d=json.load(open("data/ledger.json"));print(len(d["positions"]),len(d.get("history",[])))' 2>/dev/null)
  if [ "$rc" -ne 0 ]; then
    echo "ERROR: reprice.py exited $rc — ledger NOT updated for $SESSION"
  elif [ "$before" != "$after" ]; then
    echo ">>> A POSITION CLOSED. open/history went ($before) -> ($after). Review and commit."
  else
    echo "no exits; $(echo "$after" | cut -d' ' -f1) position(s) still open"
  fi
} >>"$LOG" 2>&1

# keep the log from growing without bound
tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
