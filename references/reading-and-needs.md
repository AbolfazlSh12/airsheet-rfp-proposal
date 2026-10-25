# Reading the document and finding the real needs

The goal of steps 1 and 2 is a short list of root needs that the customer would recognise as "yes, that is our
problem", each traced to the exact sentences and screenshots it came from. If `airsheet-base-redesign` is installed,
its `references/rfp-analysis.md` has the long form of the sentence ledger; this file is the part a proposal needs.

## 1. Read every page

1. Get the file into the scratchpad. Never run anything from inside a downloaded folder.
2. Try text first: `pdftotext -layout file.pdf out.txt`. If the Persian comes out as broken letters (common for PDFs
   exported from Word with embedded fonts), do not try to repair it. Render the pages instead:
   ```bash
   pdftoppm -r 110 -png file.pdf pg        # readable page images
   pdftoppm -r 300 -png -f 3 -l 4 file.pdf hi   # high resolution for screenshot crops
   ```
   Crop each screenshot with Pillow (`python3 -I`) and read the crops; at 110 dpi the small labels in a screenshot
   are not reliable.
3. Word files: `extract-inputs.py` from `airsheet-base-redesign` or `python-docx`; spreadsheets: every sheet, every
   column header, including hidden ones.
4. Read the whole document before writing anything. Then read it again with the ledger open.

## 2. The ledger

One row per numbered item, and one per extra sentence inside an item. Columns:

| Column | Content |
|---|---|
| no | the customer's number, exactly as printed (۱-۱-۱, ت‑۳, 2.4.1…) |
| name | the customer's name for it, in their language and spelling (Data Entry Grid, «مقدار داینامیک») |
| says | what the sentence asks for, close to their words |
| solution | the mechanism they prescribe, if any (a temp table, a button, a control type) |
| need | the problem the mechanism solves |
| root | R1…Rn |
| evidence | screenshot or sentence that supports the need |

Pay special attention to:

- **Screenshots.** Decode every element: field labels, required stars, column headers, buttons, switches, section
  titles, empty-state text. A switch "the service is not in the list above" means items come from a catalogue *and*
  are typed freely. A "currency" column per line means totals must be per currency. Two dates on a line mean a
  cross-field rule. Keep their spelling: it goes into the prototype verbatim.
- **Examples in the text.** "If deputy X is chosen, department shows only ESS and BSS" is both a requirement and a
  data model (an organisation hierarchy that belongs in tables, not in hard-coded options).
- **Version or section words.** "Form version 1 / version 2" in the customer's mouth may not mean Airsheet's v1 and
  v2. Find out what they mean from context (in the MCI case: "main form" vs "multi-page form").
- **What is missing.** Editing after submit, approval routing, numbering, printing, permissions are often absent from
  a solution list but required for the process to work. List them as inferred needs, marked as such, and ask.

## 3. Root needs

Group the ledger into 4–8 root needs. For each write:

- the need in one sentence, in the customer's terms ("one request with many lines, submitted once");
- the evidence (item numbers, screenshot);
- what goes wrong if it is not met ("users enter each line separately; lines without a parent stay behind");
- the priority: critical / high / medium / low.

Signals for priority: an item that repeats in several sections; a screenshot built around it; a failure the customer
already complained about in an earlier project; a need many other customers share.

Name the people involved. For a "module" or "builder" RFP the main audience is the customer's own team that will build
forms or processes with Airsheet. Their underlying need is to rebuild their current forms without asking us for code,
so the acceptance test of any proposal is "rebuild their real example by configuration only".

## 4. Questions, each with a default

Only questions whose answer changes the size or shape of the work. Each one gets a default you will proceed with, so
the analysis never waits for the customer:

| Question | Why it matters | Default |
|---|---|---|
| Which real forms must be built? | they are the acceptance test | the example in the document |
| How many lines per request, and in what Excel today? | paging, limits, import template | up to 200, template from the columns |

Keep this list in the internal report. Ask the customer only through the user.
