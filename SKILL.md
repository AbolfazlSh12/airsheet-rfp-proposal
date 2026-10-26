---
name: airsheet-rfp-proposal
description: Turns a customer's RFP, SRS, requirement list or feature wish-list for Airsheet into two deliverables. (1) An internal analysis — the real needs behind the solutions the customer wrote, what Airsheet already does (verified in the cloud-back / cloud-front code), the best generic capability for each need, phases, risks and bugs. (2) A customer-facing interactive page — every requirement in the customer's own numbering and words, a categorised catalogue of additional capabilities they can pick, and a clickable prototype of their own example form or process with a guided demo tour, light/dark theme, an edit mode that saves to a JSON file, Excel export and print — published as an Artifact and as an offline single-file zip. Use whenever a customer sends an RFP, SRS, «سند نیازمندی», «درخواست پیشنهاد», feature list or meeting notes about Airsheet capabilities (forms, automations, portals, reports, approvals…) and the user wants it analysed, the exact needs found, a proposal of what to build, a demo or prototype for the customer meeting, or an update to such a catalogue — even if they only say «تحلیلش کن» or «یک خروجی مثل قبلی بده». To build an actual base by configuration from a requirement document, use airsheet-base-redesign instead.
---

# Airsheet RFP: real needs, proposal and demo

Customers rarely send problems. They send solutions: control names from the tool they used before ("Data Entry Grid",
"People Picker", "Set Value"), a temp table for multi-page forms, a button that runs an automation. This skill reads
such a document as the customer's critic, finds the need behind every solution, checks what Airsheet really does in the
code today, and produces two things that must never be confused:

| Deliverable | Audience | Says "exists today" / "configurable"? |
|---|---|---|
| **Internal analysis** (HTML report, artifact) | the user and the team | yes — status, size, file:line, bugs |
| **Customer page** (catalogue + prototype + tour, artifact and offline zip) | the customer | **never** |

Flow, with two approval gates:

**read every page → real needs → check the code → internal report → (gate) agree the customer page → build from the
template → verify → (gate) publish and package**

The reference build in `assets/catalog/` is a complete worked example (MCI «فرم‌ساز پیشرفته», Mehr 1405). Every new
customer page starts as a copy of it.

## Before you start

- Look for prior work on the same customer or topic: project memory, `<workspace>/documents/<Customer>-<Topic>/`,
  earlier artifacts. The same RFP has been analysed twice before; start from what exists and say what changed.
- Work folder: `<workspace>/documents/<Customer>-<Topic>/` (`<workspace>` holds the `cloud-back` / `cloud-front`
  checkouts). The customer page lives in a `catalog/` subfolder of it.
- This skill writes no product code and commits nothing to cloud-back or cloud-front. Features it proposes are
  general Airsheet capabilities that any base can use, never code for one customer (no customer ids, gates or
  vocabulary in the product).

## Step 1. Read every page

Read `references/reading-and-needs.md`. In short:

- Read the whole document, every page, before any analysis. Persian PDFs made in Word often extract as garbled text
  with `pdftotext`; render pages to images (`pdftoppm -r 110`) and read those, and crop screenshots at 300 dpi.
- Screenshots carry more than the text: decode every field, column, label, button and switch in them, with the
  customer's exact spelling («قیمت براوردی(واحد)», «ادامه سوالات»). These labels go verbatim into the prototype.
- Keep a ledger: one row per sentence or item, with the customer's own numbering.

## Step 2. Find the real needs

Same reference. Map each stated solution to the need behind it, group them into a handful of root needs (R1…Rn), and
rank them. Repetition across the document is the strongest priority signal. Name who suffers: the person filling in,
the approver, and — for "module" RFPs — the customer's own team that will build with Airsheet. Turn open questions
into questions with a default, so nothing blocks on the customer.

## Step 3. Check Airsheet in the code

Read `references/code-check.md`. Export `origin/develop` of both repos into the scratchpad with `git archive` (never
check out branches in the shared checkouts), run one inventory agent for breadth, and verify the claims that decide a
design yourself. Every "exists" or "bug" claim in the internal report carries a `file:line`.

## Step 4. Internal analysis report

Read `references/internal-report.md` and use `assets/examples/internal-report.html` as the model. Sections: verdict,
what changed since the last analysis, how the document was read, the decoded example, root needs, the per-item ledger
(solution → need → today → verdict → best solution → size), the capability designs, phases, what we do not build,
questions with defaults, verified bugs. Publish it as a private artifact. It is internal: statuses and sizes belong
here and nowhere else.

## Step 5. Agree the customer page (gate)

Present a short design in chat and wait for a yes: the customer's own example that the prototype will reproduce, the
Part B categories, which items get a live demo, and anything you will drop. The user knows the customer; they may veto
wording or scope.

## Step 6. Build the customer page from the template

Read `references/customer-page.md`. Copy `assets/catalog/` into the work folder, then:

- `data.js`: Part A = every requirement in the customer's order, numbering, names and wording; Part B = the
  additional capabilities, by category, without any status; the tour script.
- `app.js`: keep the shell (catalogue, rail, cards, theme, edit mode, file sync, exports, markers, pickers); rewrite
  the demo panes so they reproduce the customer's own example with their labels; register every demo key.
- `index.html`: keep the theme tokens and structure; change only the demo markup and the texts.

## Step 7. Verify

Read `references/verification.md`; it has the snippets. Serve the folder with `scripts/serve.py` (UTF-8 headers) and
check, in Playwright at 1360 px and 390 px: every demo key resolves to a visible element, the main flow runs to the
receipt without console errors, edit/delete/undo/add work, file sync works against a mock handle, text contrast passes
in light and dark, nothing overflows on a phone. Look at desktop screenshots of each view in both themes. Read
`references/lessons.md` before you debug anything — most traps are already there.

## Step 8. Publish and package (gate)

There are two builds of the same page:

- **Internal (for the user):** every edit tool, notes, the «در نسخه‌ی مشتری نمایش داده نشود» flag, file sync. Publish
  `catalog/index.html` as a private artifact (with `data.js` and `app.js` as files) and build the offline zip with
  `scripts/build-standalone.py`. In Chrome or Edge the zip saves every edit into a JSON file the user picks. Inside the
  hosted viewer the page cannot download, print or open file pickers; it hides those actions.
- **Customer:** `build-standalone.py … --customer <slug> --db <master.json>` leaves out hidden items, notes and the
  edit and file tools, and adds «انتخاب‌ها و ارسال», which posts the customer's picks and comments to the proposal hub.
  Read `references/hub.md`: one subdomain on the test server serves every proposal under its own unguessable slug,
  and the user reads all submissions at `/admin/`. Copying the folder to the server is the user's step.

Customers in Iran cannot open claude.ai, so the artifact is for the user and the team only.

## Customer-facing rules (always)

These come from a real customer reaction and apply to everything the customer sees: the page, the tour, the demo
texts, exports, any deck or message.

1. Never say or imply that a capability already exists, "is available today", or "is possible by configuration / no
   code". Customers who expect a tailored build hear "you get nothing new". No status chips, no S/M/L sizes.
   Person-hours appear only when the user enters them, so the customer can decide by cost, and never as 0.
2. Never let the material suggest the customer's document was incomplete, unclear or immature, or that we replaced
   their solutions with ours. Their items come first, in their own numbering, names, wording and even spelling, each
   with a demo. Our extras come after, as «قابلیت‌های تکمیلی» they may pick.
3. The prototype reproduces the customer's own example (their form, their columns, their labels), not a generic one.
4. The page must not look machine-made: use Airsheet's own UI tokens (cloud-front daisyUI light and dark), Vazirmatn,
   cards and a category rail, no accent bars on rounded cards, no wide soft shadows, no decorative diamonds or
   gradients, no dashboards of big numbers.

## Updating an existing proposal

Edit `data.js` (or let the user edit in the page and save to the JSON file), keep the demo keys valid, re-run the
checks in step 7, republish to the same artifact URL (same file path, or the artifact `url`), and rebuild the zip.
When the customer has seen a version, keep item ids stable so their picks and notes still load.

## Files

| Path | What |
|---|---|
| `references/reading-and-needs.md` | reading every page, the ledger, root needs, questions with defaults |
| `references/code-check.md` | code snapshot, inventory agent brief, what to verify, comparing with an earlier analysis |
| `references/internal-report.md` | sections and tables of the internal report |
| `references/customer-page.md` | the template's data model, demo-key contract, what to keep and what to rewrite, design rules |
| `references/verification.md` | copy-paste checks for Playwright |
| `references/lessons.md` | traps already hit, with fixes |
| `assets/catalog/` | reference build: `index.html`, `app.js`, `data.js` |
| `assets/examples/internal-report.html` | reference internal report |
| `scripts/serve.py` | static server with UTF-8 headers for local checks |
| `scripts/build-standalone.py` | single offline HTML with SheetJS and Vazirmatn inlined; `--customer` builds the customer version |
| `references/hub.md` | the proposal hub: setup once, publish each proposal, read submissions |
| `hub/` | the hub itself: `server.py`, `Dockerfile`, `docker-compose.yml`, `nginx-site.conf`, `test_server.py` |
