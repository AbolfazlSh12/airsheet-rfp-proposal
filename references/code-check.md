# Checking what Airsheet does today

Every "exists", "partly exists" or "bug" in the internal report must be true of `origin/develop` on the day of the
report, with a `file:line`. Develop moves fast (hundreds of commits a week at times), so an analysis from last week is
a starting point, not evidence.

## Snapshot without touching the checkouts

Other sessions commit in `cloud-back` / `cloud-front`, and the dev servers may run from either workspace. Read code
from an exported snapshot instead of checking out branches:

```bash
S=<scratchpad>
git -C <workspace>/cloud-back  fetch origin -q
git -C <workspace>/cloud-front fetch origin -q
mkdir -p $S/be $S/fe
git -C <workspace>/cloud-back  archive origin/develop src | tar -x -C $S/be
git -C <workspace>/cloud-front archive origin/develop src | tar -x -C $S/fe
git -C <workspace>/cloud-back  rev-parse --short origin/develop   # put both hashes in the report header
git -C <workspace>/cloud-front rev-parse --short origin/develop
```

When a previous analysis exists, diff only the areas it relied on:
`git diff --stat <old> origin/develop -- <paths>` and `git log --oneline <old>..origin/develop -- <paths>`. If those
files did not change, the old verified facts still hold; say so in the report.

## Inventory agent (breadth)

One read-only Explore agent, "very thorough", with this kind of brief (adapt the area):

> Goal: a complete, verified inventory of what Airsheet <area> can do TODAY, for a capability catalogue. Read-only.
> Code: <scratchpad>/fe/src and <scratchpad>/be/src (exported origin/develop). Starting points: <files>.
> Already known, no need to re-verify: <facts you have>.
> Report, grouped by area: one line per capability, which variant (v1/v2, portal/collaborator…), one file:line.
> Mark anything unsure as "unverified". List notable things that look ABSENT after searching, with the search terms.
> Keep it under ~900 words, no code dumps.

## Verify yourself (depth)

The agent locates; you verify the claims that decide a design:

- the path a submission takes on the server (who validates, who writes, what happens on failure, what is awaited);
- what the client sends and what the server re-checks (a client-only rule is not a rule);
- access paths: owner, collaborator, portal user, anonymous visitor;
- any per-customer gate in the product (a hard-coded base id) — flag it as debt.

For forms, the files that mattered last time: `cloud-back/src/modules/database/formSubmission.ts`,
`.../resolvers/record.ts` (form submit path), `.../resolvers/auth/formRecordWrite.ts`, `src/modules/formApi/`,
`src/modules/automation/application/triggerMatching.ts`; `cloud-front/src/components/organisms/views/ViewForm*.vue`,
`cells/the-records*.vue`, `notion/blocks/`, `utils/formFieldOptions.js`, `api/getForm.js`.

## Choosing the best solution

For each root need, prefer, in order:

1. what already works by configuration (internal report only — never tell the customer it already exists);
2. a small change to an existing capability, preferably at field level so it works everywhere the field appears;
3. a new general capability that reuses an existing server path;
4. a new subsystem, only when nothing above works.

Look for an existing entry point the customer already half-uses. In the MCI case the "Data Entry Grid" was best built
as a display mode of the link field, whose nested create forms already existed, instead of a new block: it worked in
both form versions, reused the form designer for the row pop-up, and fixed an orphan-record bug on the way.

Check every design against the server: if the client buffers rows, which server path validates each row before the
parent is written? If a write happens after the success reply, what does the user see when it fails?
