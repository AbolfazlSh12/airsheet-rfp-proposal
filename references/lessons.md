# Lessons already paid for

## Reading

- Persian PDFs exported from Word often extract as broken letters. Render pages to PNG and read them; crop screenshots
  at 300 dpi.
- The same document may have been analysed before. Check memory and `documents/` first, then re-verify the code: in
  one week develop moved 359 commits.
- "Version 1 / version 2" in a customer document may mean "single page / multi page", not Airsheet's form versions.

## Customer reaction

- MCI objected to anything that said a capability "exists today" or "is configurable": they expect a tailored build.
  Statuses stay in the internal report.
- They also must not feel their requirements were immature. Mirror their document: their order, numbering, names,
  wording and spelling first; extras after.
- The first design looked machine-made (teal dark theme, status chips, stat tiles, ◆ markers). The version they liked
  copies Airsheet's own UI; the user then asked for cards and a side category menu back, a light/dark switch, an edit
  mode and saving to a file.

## Browser and tooling

- The in-app browser pane is narrow (≈260–390 px): use Playwright for desktop screenshots.
- A hidden pane does not fire `requestAnimationFrame`; use `setTimeout` in test scripts.
- Playwright blocks `file://`; the in-app pane shows local files as static snapshots without scripts. Serve over HTTP.
- `python3 -m http.server` sends no charset → mojibake; use `scripts/serve.py`. The artifact skeleton and the offline
  build add `<meta charset>` themselves.
- Downloaded Excel names with a zero-width non-joiner (نیم‌فاصله) come out with «_»; use hyphens in file names.

## Page code

- A rule like `.drawer{display:flex}` overrides the `hidden` attribute; keep `[hidden]{display:none!important}`.
- Grid children default to `min-width:auto`, so a wide table pushes the card out of the screen; set `min-width:0`.
- A marker placed inside a `<button>` makes a nested button; the template wraps controls instead.
- A picker that redraws itself detaches the clicked node before the document click handler runs; use
  `e.composedPath()` to decide "click outside".
- An IndexedDB `put` that cannot clone its value throws inside `onsuccess`; without try/catch the promise never settles
  and "connect to file" hangs forever. Fixed in the template.
- Inside the hosted artifact viewer there are no downloads, no `print()`, no file pickers: the template detects
  `window.top !== window` and hides those actions. The offline zip has all of them; File System Access needs Chrome or
  Edge.
- The calendar `MONTHS` and `TODAY` are hard-coded; update them for each meeting date.
- Light theme `#6b7280` text on `#f3f4f6` is 4.39:1; the template uses `#596170`, and darker green and red.
- An inline SVG with no width rule grows to its container: the old theme menu showed 300 px icons. Every place that
  shows an icon needs a size rule. Airsheet's orange-500 moon is 2.8:1 on white; the template uses orange-600.

## Hub

- A 401 with `WWW-Authenticate: Basic` makes the browser show a login prompt; a test `fetch` without credentials then
  hangs until the tool times out (30 minutes). Send the header or test with `curl`.
- The unit test did not start `main()`; a startup typo only showed when the Docker image ran. Always run the image
  once, not only `test_server.py`.
- A `docker run` started as a preview keeps running after the preview is stopped; stop the container yourself.
- Restarting a cron-run hub over SSH: `pkill -f "python3 -I server.py"` also matches the remote shell that runs it and
  kills your session. Anchor the pattern (`pkill -u <user> -f '^python3 -I server.py'`); cron starts it again within a
  minute.

## Packaging

- Inline SheetJS (`cloud-front/node_modules/xlsx/dist/xlsx.full.min.js`, 0.18.5) and Vazirmatn
  (`cloud-front/public/font/Vazirmatn-VF.woff2`, OFL) into the offline file. Do not inline IRANSansX: it is a
  commercial font and the file goes to the customer.
- Check that the inlined scripts contain no `</script`.
