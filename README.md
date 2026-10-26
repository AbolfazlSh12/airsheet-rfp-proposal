# airsheet-rfp-proposal

A Claude Code skill that turns a customer's RFP, SRS or requirement list for [Airsheet](https://airsheet.ir) into:

1. **An internal analysis** — the real needs behind the solutions the customer wrote, what Airsheet already does
   (verified in the `cloud-back` / `cloud-front` code, with file:line), the best general capability for each need,
   phases, risks and bugs. Published as a private artifact for the team.
2. **A customer page** — every requirement in the customer's own numbering and words, a categorised catalogue of
   additional capabilities they can pick, a clickable prototype of their own example form or process, a guided demo
   tour, light/dark theme, an edit mode that saves to a JSON file (Chrome/Edge), Excel export and print. Published as
   an artifact and as an offline single-file zip.

`SKILL.md` is the entry point. `references/` holds the method (reading the document, checking the code, the internal
report, the customer page, verification, lessons). `assets/catalog/` is a complete reference build to copy for each new
customer, and `assets/examples/internal-report.html` a reference internal report. `scripts/` holds a UTF-8 static
server for local checks and the offline build (internal or `--customer`). `hub/` is the proposal hub: one
subdomain on the test server that serves every customer page and stores what each customer picked.

The reference build and the example report contain one customer's requirement content; keep this repository private.

## Install

```bash
git clone git@github.com:AbolfazlSh12/airsheet-rfp-proposal.git ~/.claude/skills/airsheet-rfp-proposal
```

Paths in the docs use `<workspace>` for the folder that holds the `cloud-back` / `cloud-front` checkouts. The offline
build reads SheetJS and the Vazirmatn font from `cloud-front`.

Related skill: `airsheet-base-redesign` builds a base by configuration from a requirement document; this one proposes
product capabilities and demos them.
