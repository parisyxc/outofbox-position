---
description: Run the full momentum-verify-fundamentals framework on one ticker and generate the 5-page docx
---

Run the full framework on **$ARGUMENTS**.

1. Read `skill/SKILL.md`, `skill/references/scoring-rubric.md` and `skill/references/sources-checklist.md`.
2. Research first (latest quarter, margins, guidance, segment drivers, peers, technicals, analyst targets). Cross-check the headline numbers across two sources.
3. Score the 3 parts, characterize the technical overlay, derive the verdict from the rubric's matrix.
4. Copy `skill/assets/config.example.json` → `data/configs/$ARGUMENTS.json` and fill it.
5. `node skill/scripts/generate_report.js data/configs/$ARGUMENTS.json reports/$ARGUMENTS_Momentum_Verification_Analysis.docx`
6. Validate, render page 1 to an image and check it, then summarize verdict + zones in 5 lines with a Sources list.
