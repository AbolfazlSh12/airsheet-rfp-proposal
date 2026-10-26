"""Build one offline HTML file from a customer page folder (index.html + data.js + app.js).

Adds doctype, charset and viewport, inlines data.js and app.js, replaces the SheetJS CDN script with the local copy and
the Google Fonts link with an inlined Vazirmatn @font-face, so the file opens from disk with no network.

Internal (master) build, with every edit tool:

    python3 -I build-standalone.py <catalog-folder> <out.html> <xlsx.full.min.js> <Vazirmatn-VF.woff2>

Customer build for the proposal hub (no edit mode, no file menu, no internal notes, hidden items left out, and a
"send" button that posts the picks to /api/<slug>/submit):

    python3 -I build-standalone.py <catalog-folder> dist/<slug>/index.html <xlsx> <font> \
        --customer <slug> --db <master.json>

<master.json> is the catalogue saved from the internal page («ذخیره در فایل» or «دریافت فایل JSON»). Without --db the
customer build uses data.js as it is. The xlsx and font files come from cloud-front:
<workspace>/cloud-front/node_modules/xlsx/dist/xlsx.full.min.js and <workspace>/cloud-front/public/font/Vazirmatn-VF.woff2.
"""
import argparse
import base64
import json
import pathlib
import re
import sys

ap = argparse.ArgumentParser()
ap.add_argument("src", type=pathlib.Path)
ap.add_argument("out", type=pathlib.Path)
ap.add_argument("xlsx", type=pathlib.Path)
ap.add_argument("font", type=pathlib.Path)
ap.add_argument("--customer", metavar="SLUG", help="build the customer version for this hub slug")
ap.add_argument("--db", type=pathlib.Path, help="catalogue JSON saved from the internal page")
ap.add_argument("--submit", help="submit URL (default /api/<slug>/submit)")
a = ap.parse_args()

if a.customer and not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,63}", a.customer):
    sys.exit("slug: 3-64 characters, lowercase letters, digits and dashes")

read = lambda p: p.read_text(encoding="utf-8")
page, data, app, lib = read(a.src / "index.html"), read(a.src / "data.js"), read(a.src / "app.js"), read(a.xlsx)
js_json = lambda v: json.dumps(v, ensure_ascii=False).replace("</", "<\\/")

data_js = data
if a.db:
    db = json.loads(read(a.db))
    if db.get("format") != "airsheet-forms-catalog":
        sys.exit(f"{a.db} is not a catalogue saved from the page")
    if a.customer:
        # leave out what the customer must not see: hidden items and internal notes
        strip = lambda items: [{k: v for k, v in x.items() if k not in ("note", "hide")} for x in items if not x.get("hide")]
        db["srs"], db["caps"] = strip(db["srs"]), strip(db["caps"])
        used = {c["c"] for c in db["caps"]}
        db["cats"] = [c for c in db["cats"] if c["k"] in used]
    tour = re.search(r"window\.TOUR\s*=\s*\[.*?\];", data, re.S)
    if not tour:
        sys.exit("data.js has no window.TOUR")
    data_js = "".join(f"window.{g} = {js_json(db[k])};\n" for g, k in
                      (("SRS_GROUPS", "srsGroups"), ("SRS", "srs"), ("CATS", "cats"), ("CAPS", "caps"))) + tour.group(0) + "\n"
elif a.customer:
    print("warning: no --db, the customer build uses data.js as it is (no hidden items removed)", file=sys.stderr)

config = ""
if a.customer:
    config = "window.AFC_CONFIG = " + js_json({"mode": "customer", "slug": a.customer, "submitUrl": a.submit or f"/api/{a.customer}/submit"}) + ";\n"

for name, js in (("data", data_js), ("app", app), ("xlsx", lib), ("config", config)):
    assert "</script" not in js.lower(), name
link = re.search(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^"]*">\n', page)
assert link, "Google Fonts link not found"
page = page.replace(link.group(0), "")
face = ('@font-face{font-family:"Vazirmatn";font-style:normal;font-weight:100 900;font-display:swap;'
        'src:url(data:font/woff2;base64,' + base64.b64encode(a.font.read_bytes()).decode() + ') format("woff2")}\n')
page = page.replace("<style>\n", "<style>\n" + face, 1)
cdn = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>'
local = '<script src="data.js"></script>\n<script src="app.js"></script>'
assert cdn in page and local in page, "script tags not found"
head, body = page.split("</style>", 1)
body = body.replace(cdn, f"<script>\n{lib}\n</script>").replace(
    local, f"<script>\n{data_js}\n</script>\n<script>\n{config}{app}\n</script>")
robots = '<meta name="robots" content="noindex, nofollow">\n' if a.customer else ""
doc = ('<!doctype html>\n<html lang="fa" dir="rtl">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       f'{robots}{head}</style>\n</head>\n<body>{body}</body>\n</html>\n')
a.out.parent.mkdir(parents=True, exist_ok=True)
a.out.write_text(doc, encoding="utf-8")
print(a.out, round(len(doc.encode()) / 1024), "KB", "(customer: " + a.customer + ")" if a.customer else "(internal)")
