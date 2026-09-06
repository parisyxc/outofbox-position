# Intake — adding a new Out-of-the-Box image

## Naming & location (the durable path)
Drop the screenshot in the project folder `Out-of-the-Box-Proprietary-Stock/` named **`YYYYMonDD-outofbox.jpg`**
— e.g. `2026Sep03-outofbox.jpg`, `2026Sep08-outofbox.jpg`. Then in Claude Code:

    /daily 2026-09-03

`/daily` reads it from that folder, vision-reads it,
echoes the parsed table for your check, and runs the pipeline.

## Alternative: paste the image in chat
Drag the image into the Claude Code prompt and type `/daily 2026-09-03`. The command accepts a pasted
image if the file isn't in the folder — but save it to the folder anyway so `data/inputs/DATE.csv` and the
archive stay complete.

## The chronology rule (important for the record)
The ledger is a published-before-outcome record, so **live runs must go in date order**.
`/daily` refuses a live run for a date earlier than `ledger.as_of`.

- **Just want to see what 09-03 would have picked?** → `/daily 2026-09-03 --no-ledger`
  (report + cards only; the ledger is untouched).
- **Want 09-03 IN the record (before the 09-04 seed)?** → replay in order:
      cp data/ledger.json data/ledger.bak.json
      python3 - <<'PY'
      import json; json.dump({"as_of":None,"positions":[],"alternates":[],"history":[]}, open("data/ledger.json","w"), indent=2)
      PY
      /daily 2026-09-03
      /daily 2026-09-04
  Each day's picks enter at that day's screener close; names picked on 09-03 that reappear on 09-04 become
  **Continuing** (auto-priced), not new.
- **Normal daily use (next trading day and onward):** just `/daily YYYY-MM-DD` after the close.

## Trading days with no image
Some sessions you will not have a screener image. Run `/daily YYYY-MM-DD` anyway — with no image it
switches to **reprice-only**: it skips triage, selection and the report, reprices every open position,
fires any stop-out, and prints the table. `./scripts/daily_reprice.sh` does the same thing directly.

Do this on every trading day you skip, not just when you remember. `reprice.py` tests the stop against
the **closing** price on the day it runs, so a position that breaks its stop on an unpriced session and
recovers before the next run never enters the record — and "entry and exit both disclosed" is the claim
the site is built on.

An exit found this way appears on `/position` and `/record` at the next site build, and in the next
session's report under Section III.

## What a run produces
`data/inputs/DATE.csv` · `data/cards/DATE/*.md` · `reports/DATE/DATE.md` · updated `data/ledger.json` (live only)
· optional `reports/DATE/*.docx`.
