# Verifying the customer page

Checks run in Playwright (`mcp__plugin_playwright_playwright__*`), because the in-app browser pane is narrow and
throttles hidden pages. Serve the folder over HTTP first; Playwright blocks `file://`, and Python's default server
sends no charset (the Persian then renders as mojibake):

```bash
python3 ~/.claude/skills/airsheet-rfp-proposal/scripts/serve.py <catalog-folder> 8765
```

Use a fresh query string per reload (`index.html?v=N`) to avoid the cache. Wrap long async checks with a timeout so a
hanging promise cannot stall the session:
`const guard=(p,ms=4000)=>Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),ms))]);`

## 1. Static checks

```bash
node --check app.js && node --check data.js
grep -n -E "موجود امروز|پیکربندی|بدون کد|بدون برنامه|قابل تنظیم|v1|v2" data.js index.html   # must be empty for customer text
```

## 2. Every demo key resolves (browser_evaluate)

```js
async () => {
  const w=(ms=60)=>new Promise(r=>setTimeout(r,ms)); const errs=[]; addEventListener('error',e=>errs.push(e.message));
  const DB=__afc.DB; const alias={'disp-percent':'b-display','disp-time':'b-display'};
  const keys=[...new Set([...DB.srs.flatMap(s=>(s.ds||[]).map(d=>d[0])), ...DB.caps.map(c=>c.d).filter(Boolean),
                          ...TOUR.map(t=>t.go)])];
  const missing=[];
  for (const k of keys){ __afc.showDemo(k); await w(); const t=alias[k]||k;
    const m=document.querySelector('#modal-root .modal-bg');
    const el=(m&&m.querySelector(`[data-demo~="${t}"]`))||document.querySelector(`[data-demo~="${t}"]`);
    if(!el||!el.getClientRects().length) missing.push(k); }
  document.querySelector('#modal-root').innerHTML='';
  return {keys:keys.length, missing, errs};
}
```

## 3. The main flow

Reset, press «بعدی» on page 1 (expect the error summary), «پر کردن نمونه», walk to the review page, fix any blocking
rule, enter the OTP (`1234` in the demo), submit, expect the receipt, open the inbox and approve. Assert on DOM text,
not on screenshots. Also: add a row through the dialog (required errors first, then a valid row), the Excel sample
(valid and invalid rows), the clock picker (dispatch `pointerdown` at a computed angle on `#clk-face`).

## 4. Edit mode and file sync

Edit an item and add a note; delete one and press «بازگرداندن» in the toast (it must return at the same index); add an
item to a category; add, rename and delete a category; try deleting a non-empty category (expect a refusal). Then the
file sync with a mock handle:

```js
const mk=(name,content)=>({name,content,writes:0,async getFile(){return new File([this.content],name)},
  async createWritable(){const s=this;let b='';return{async write(t){b+=t},async close(){s.content=b;s.writes++}}},
  async queryPermission(){return 'granted'},async requestPermission(){return 'granted'}});
// empty file gets the catalogue; an edit is written; a foreign JSON is never overwritten; a saved file loads
```

The real OS file dialog cannot be driven by automation: say so, and ask the user to try «ذخیره در فایل → ساخت فایل
تازه…» once in Chrome.

## 5. Contrast in both themes

Set `data-theme` to `light` then `dark`, visit catalogue, each form step, designer, after-submit and edit mode, and
measure every visible text node against its first opaque background (WCAG AA: 4.5, or 3 for large text). Skip
`.paper`. Fix by changing tokens, not single elements. The design hook's static contrast warnings are unreliable
(it pairs tokens across themes); trust the measured result and record any suppression.

## 6. Layout

At 1360 × 900 and 390 × 844: no element outside the viewport except inside `.tbl-scroll`, `.map-scroll`, `#pdf`,
`.tabs`, `.rail`; the top bar stays short on a phone. Take desktop screenshots of catalogue, a form step, the row
dialog and the clock, in both themes, and look at them.

## 7. The customer build and the hub

```bash
python3 -I hub/test_server.py                 # hub routes, traversal, validation, admin auth, CSV, rate limit
docker build -t proposals-hub-test hub/       # the image the server runs
```

Run the image (a launch config with `docker run --rm -p 127.0.0.1:8091:8080 -e ADMIN_PASSWORD=… -v <dist>:/data/proposals:ro
proposals-hub-test`), open `http://localhost:8091/<slug>/` and check: no `#edit-btn` or `#file-btn`, hidden items and
notes absent from the page source, picks survive a reload, sending without a name is refused, a valid send shows the
confirmation, and `/admin/<slug>` (fetch with an `Authorization: Basic` header) lists it. Never `fetch('/admin/')`
without credentials from a Playwright page: the browser's login prompt makes the call hang until the tool times out.
Stopping the preview does not stop the container: `docker stop proposals-hub-test`.

## 8. The offline file

Build, serve the dist folder with a plain server (`python3 -m http.server`, no charset), then check:
`document.characterSet === "UTF-8"`, `document.compatMode === "CSS1Compat"`, `!!window.XLSX`,
`document.fonts.check('14px Vazirmatn')`, no `performance` resource entries other than `data:` and the favicon, and
check 2 again.
