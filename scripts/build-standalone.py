"""Build one offline HTML file from a customer page folder (index.html + data.js + app.js).

Adds doctype, charset and viewport, inlines data.js and app.js, replaces the SheetJS CDN script with the local copy and
the Google Fonts link with an inlined Vazirmatn @font-face, so the file opens from disk with no network.

    python3 -I build-standalone.py <catalog-folder> <out.html> \
        <workspace>/cloud-front/node_modules/xlsx/dist/xlsx.full.min.js \
        <workspace>/cloud-front/public/font/Vazirmatn-VF.woff2

Then zip the single HTML file for the user.
"""
import sys, pathlib, base64, re
src, out, xlsx, font = (pathlib.Path(a) for a in sys.argv[1:5])
page = (src / "index.html").read_text(encoding="utf-8")
read = lambda p: p.read_text(encoding="utf-8")
data, app, lib = read(src / "data.js"), read(src / "app.js"), read(xlsx)
for name, js in (("data", data), ("app", app), ("xlsx", lib)):
    assert "</script" not in js.lower(), name
# offline: the font and SheetJS ship inside the file
link = re.search(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^"]*">\n', page)
assert link
page = page.replace(link.group(0), "")
face = ('@font-face{font-family:"Vazirmatn";font-style:normal;font-weight:100 900;font-display:swap;'
        'src:url(data:font/woff2;base64,' + base64.b64encode(font.read_bytes()).decode() + ') format("woff2")}\n')
page = page.replace("<style>\n", "<style>\n" + face, 1)
cdn = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>'
local = '<script src="data.js"></script>\n<script src="app.js"></script>'
assert cdn in page and local in page
head, body = page.split("</style>", 1)
body = body.replace(cdn, f"<script>\n{lib}\n</script>").replace(local, f"<script>\n{data}\n</script>\n<script>\n{app}\n</script>")
doc = ('<!doctype html>\n<html lang="fa" dir="rtl">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       f'{head}</style>\n</head>\n<body>{body}</body>\n</html>\n')
out.write_text(doc, encoding="utf-8")
print(out, round(len(doc.encode()) / 1024), "KB")
