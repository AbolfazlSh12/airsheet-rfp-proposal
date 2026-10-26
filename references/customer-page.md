# The customer page: catalogue, prototype and tour

The page has three views: **فهرست قابلیت‌ها** (catalogue), **نمایش فرم** (prototype, in three panes: پر کردن فرم,
طراحی فرم, پس از ثبت) and **سناریوی نمایش** (guided tour). `assets/catalog/` is a complete build for one customer.
Copy it and change what is customer-specific; keep the shell.

```bash
cp -r ~/.claude/skills/airsheet-rfp-proposal/assets/catalog <workspace>/documents/<Customer>-<Topic>/catalog
```

## Wording (read SKILL.md "Customer-facing rules" first)

- Part A title «الف. نیازمندی‌های سند»: every item, in the document's order, numbering and names. The description is
  close to the customer's own sentence. Sub-points ("pts") are their sub-sentences.
- Part B title «ب. قابلیت‌های تکمیلی»: what can be built along with their items. Phrase each as what the user gets, not
  as what exists. Avoid «امروز», «موجود», «پیکربندی», «بدون کد», «بدون برنامه‌نویس», «v1/v2», internal names.
- Tour texts cite their item numbers («بند ۱-۲-۹»), never our capability codes.
- Before publishing, search the three files for the forbidden words (see `verification.md`).

## `data.js` — the data model

```js
window.SRS_GROUPS = [{ k: "s11", no: "۱-۱", n: "افزودن کنترل‌های جدید" }, …];   // the document's sections
window.SRS = [{ id: "k1", g: "s11", no: "۱-۱-۱", n: "Data Entry Grid", fa: "جدول ورود داده",
                v: "…their sentence…", pts: ["…", "…"], ds: [["rows", "جدول و پنجره‌ی ردیف"], ["excel", "بارگذاری Excel"]] }, …];
window.CATS = [{ k: "build", n: "طراحی فرم" }, …];                                   // Part B categories
window.CAPS = [{ id: "b5", c: "build", n: "ساخت فرم از روی جدول", v: "…", x: "optional example", d: "b-table" }, …];
window.TOUR = [{ t: "step title", go: "<demo key>", say: "talking point" }, …];
```

- `ds` (Part A) is a list of `[demoKey, buttonLabel]`; `d` (Part B) is one demo key. Every key must exist (below).
- Ids must stay stable once the customer has seen a version: picks and notes in their JSON file refer to them.
- Part B for a forms RFP: the 70 capabilities in the reference `data.js` are a good base; drop what does not fit and
  add what the code inventory and the document suggest. For other areas (automations, portals, reports…) build the
  list from the inventory, 6–11 categories, 5–10 items each.

## `app.js` — what to keep and what to rewrite

Keep (generic shell):

| Section marker | What it does |
|---|---|
| helpers, `toast(msg, {label, run})` | digits, money, escaping, localStorage wrapper, toast with undo |
| catalogue data store | `DB` (format `airsheet-forms-catalog`, v1), `validDB`, `reindex`, `commit`, `freshDB` |
| `DEMO_TARGETS` | key → Persian label for every demo key; the item editor offers these |
| theme | auto / light / dark, stored per browser; respects the viewer's own `data-theme` when "auto" |
| views, popover & modal, markers | tabs, hash, one popover, one modal, the «i» markers that link demo parts to items |
| catalogue: rail + cards | category rail with counts and a «انتخاب‌شده‌ها» filter, card grid, search |
| edit mode | edit / delete (with undo) / add items; rename / add / delete categories; meeting notes |
| selections drawer, `exportXlsx` | picks with notes, copy as text, Excel export |
| save to a file on disk (`FILE`) | File System Access in Chrome/Edge (handle in IndexedDB), JSON import/export elsewhere |
| pickers | people picker, Jalali calendar, circular clock (hh:mm or hh:mm:ss) |
| data entry grid + row dialog, Excel upload, signature | reusable widgets for line items |
| show a demo target, tour, boot | `showDemo(key)`, `PREP`, `STEP_OF`, the tour bar |

Rewrite for the customer (everything under `// ---------- demo data ----------` that names their world):

- demo constants: organisation (`DEPUTIES`), catalogue items (`SERVICES`), currencies, provinces, request types,
  `TODAY`, the calendar `MONTHS` (hard-coded: update them to the months around the meeting date);
- the form steps `step1()`…`step4()`, `STEPS`, `validate()`, `fillSample()`;
- `TABLES` (grid columns with the customer's column labels) and `rowFields()` (the row pop-up with their labels);
- `policyChecks()`, the receipt, `SAMPLE_REQS`, the Bale `CHAT` script, `BT` tables, `RULES`, versions, the history
  list and funnel numbers in `index.html`, the logic map SVG labels.

If the customer's example is not a form (an approval process, a report, a portal), keep the three panes and rebuild
the "پر کردن فرم" pane around their example; the grid, row dialog and pickers are still useful.

## Customer mode and hidden items

- In edit mode every item has «در نسخه‌ی مشتری نمایش داده نشود» (`hide: true`); the internal page tags such cards
  «پنهان از مشتری». Notes (`note`) are internal too.
- `build-standalone.py --customer <slug> --db <master.json>` writes the curated data into the file without hidden
  items and notes (they are not in the source at all), and sets `window.AFC_CONFIG = {mode:"customer", slug, submitUrl}`.
- In customer mode the page removes the edit and file buttons, keeps picks, comments and the sender's details in
  browser storage under `afc:<slug>:`, and the drawer gets the send form. It posts
  `{name, role, mobile, general, picks:[{id,n,c}], comments:{id:text}}` to `/api/<slug>/submit` (see `hub.md`).

## The demo-key contract

A demo key ties a catalogue item to a place in the prototype.

1. Put `data-demo="<key>"` on the element (several keys: space-separated). Controls get a wrapper automatically.
2. Add the key to `DEMO_TARGETS` with a Persian label.
3. If the element lives in a form step, add it to `STEP_OF` (`{ key: stepNumber }`).
4. If showing it needs state (a dialog open, sample data, a switch on), add a `PREP[key]` function.
5. Keys in the designer or after-submit panes go into `BUILD_KEYS` / `AFTER_KEYS`; a key that points at another one
   (like `disp-percent` → `b-display`) goes into `ALIAS`, plus a `PREP` that sets the right mode.

`verification.md` has the check that every key in `data.js` resolves to a visible element.

## `index.html`

- Theme tokens: bare `:root` = Airsheet light (cloud-front `tailwind.config.js`, daisyUI light), the dark block =
  Airsheet dark (`base-100 #1d232a`, `base-200 #191e24`, `base-300 #15191e`, `base-content #dedede`). Keep every colour
  a token; the paper preview of an official document is the one deliberate white.
- Keep the structure; change texts and the designer / after-submit panels that are customer-specific.
- External scripts: SheetJS 0.18.5 from cdnjs only. Fonts: Vazirmatn from Google Fonts; the offline build inlines both.

## Design rules

- It should look like a screen of Airsheet, not a landing page: compact app bar, category rail, white cards with a
  1 px border, product form with the customer's labels, pastel tags in Airsheet's palette.
- Things that read as machine-made and must not appear: a thick accent bar on a rounded card, 1 px border plus a wide
  soft shadow, decorative ◆ markers, teal-on-dark themes, rows of big-number stat tiles, gradients, emoji.
- Persian typography: «·» next to Persian digits reads as a zero; separate with «،» or parentheses. Keep their
  spelling in demo labels even when it differs from ours.
- Edit mode is off by default so the customer never sees edit buttons in a meeting.
