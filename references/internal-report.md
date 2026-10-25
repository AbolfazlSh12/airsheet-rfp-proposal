# Internal analysis report

A single HTML page, published as a private artifact, for the user and the team. Model:
`assets/examples/internal-report.html`. Persian, RTL, plain and dense; no marketing tone. This is the only place where
statuses, sizes, file paths and bugs appear.

## Header

Title (a name, e.g. «نیاز واقعی فرم‌ساز پیشرفته»), one-line lead, then: date (Jalali), the document (name, date,
version, pages), the code checked (`cloud-back <hash>`, `cloud-front <hash>`, origin/develop), "no code was changed".
A small table of contents of the sections below.

## Sections

1. **Verdict.** Three to five sentences: what the document really asks for, how many root needs, which one is
   critical, how many items are met today / need a small change / need a new capability, rough total size.
2. **What changed since the last analysis** (when there was one): decisions reversed, facts found in code, scope
   dropped or added, details newly read from the screenshots.
3. **How the document was read.** Its nature (RFP, list of controls…), vocabulary and the tool it seems to come from
   (marked as inference), who the real audience is, repetition as priority, history with this customer.
4. **The example, decoded.** Table: element in the screenshot → content → need.
5. **Root needs.** One card each: need, evidence, what goes wrong if unmet, what Airsheet does today (with file:line),
   priority.
6. **Ledger of all items.** Table: item | the customer's solution | need | today | verdict (exists / small change /
   new) | best solution | capability and size. Wide: put it in its own horizontal scroll container.
7. **Capability designs** (C0…Cn). Per capability: size and covered items in the head line; behaviour; server side
   (validation, write order, failure handling, access); why this design and not the alternatives; what is reused
   (file:line); acceptance test (rebuild their example by configuration, with every access role it touches).
8. **Phases.** Table: phase, capabilities, demonstrable outcome, estimate. Phase zero is always a demo of what exists.
9. **What we do not build, and why.** Rejected solutions from the document, each with the reason and what covers the
   need instead.
10. **Questions for the customer**, each with why it matters and the default.
11. **Verified bugs and risks**, with file:line, and which were read in code today vs seen in an earlier test.

## Sizes

Per developer: XS under a day, S one to three days, M one to two weeks, L two to three weeks. Say that estimates are
initial and which one depends on a spike.

## After publishing

Save a memory note for the project (the root needs, the key decisions, the artifact URL, the code hashes), so the next
session starts from it.
