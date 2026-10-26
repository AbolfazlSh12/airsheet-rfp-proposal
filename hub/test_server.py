"""Self-check for the proposal hub: python3 -I test_server.py  (no dependencies, uses a temporary data folder)."""
import base64
import http.client
import importlib.util
import json
import os
import pathlib
import tempfile
import threading
from http.server import ThreadingHTTPServer

tmp = pathlib.Path(tempfile.mkdtemp())
os.environ.update(DATA_DIR=str(tmp), ADMIN_PASSWORD="s3cret", TRUST_PROXY="1")
spec = importlib.util.spec_from_file_location("hub", pathlib.Path(__file__).with_name("server.py"))
hub = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hub)

(tmp / "proposals" / "demo-abc").mkdir(parents=True)
(tmp / "proposals" / "demo-abc" / "index.html").write_text("<p>صفحه</p>", encoding="utf-8")
srv = ThreadingHTTPServer(("127.0.0.1", 0), hub.Hub)
threading.Thread(target=srv.serve_forever, daemon=True).start()
PORT = srv.server_address[1]
AUTH = {"Authorization": "Basic " + base64.b64encode(b"admin:s3cret").decode()}


def req(method, path, body=None, headers=None):
    c = http.client.HTTPConnection("127.0.0.1", PORT)
    data = json.dumps(body).encode() if isinstance(body, (dict, list)) else body
    c.request(method, path, body=data, headers={"Content-Type": "application/json", **(headers or {})})
    r = c.getresponse()
    return r.status, r.read(), dict(r.getheaders())


good = {"name": "مریم احمدی", "role": "مدیر ESS", "mobile": "09120000000",
        "picks": [{"id": "m1", "n": "قیف تکمیل فرم", "c": "گزارش و سنجش", "h": 40}, {"id": "a3", "n": "پر کردن از روی سند", "c": "هوش مصنوعی", "h": "9999999"}],
        "comments": {"m1": "برای ما مهم است", "zz": "not picked, dropped"}, "general": "جلسه‌ی بعد"}

assert req("GET", "/")[0] == 404
assert req("GET", "/nope-123/")[0] == 404
assert req("GET", "/demo-abc")[0] == 301
st, body, hd = req("GET", "/demo-abc/")
assert st == 200 and "صفحه" in body.decode() and hd["X-Robots-Tag"].startswith("noindex"), (st, hd)
assert req("GET", "/demo-abc/../db/hub.sqlite3")[0] == 404
assert req("GET", "/demo-abc/%2e%2e/db/hub.sqlite3")[0] == 404
assert req("GET", "/ABC/")[0] == 404

st, body, _ = req("POST", "/api/demo-abc/submit", good, {"X-Real-IP": "1.1.1.1"})
assert st == 200 and json.loads(body)["ok"], body
assert req("POST", "/api/demo-abc/submit", {"picks": []}, {"X-Real-IP": "1.1.1.2"})[0] == 400
assert req("POST", "/api/nope-123/submit", good)[0] == 404
assert req("POST", "/api/demo-abc/submit", b"{" + b" " * 70000, {"X-Real-IP": "1.1.1.3"})[0] == 413
assert req("POST", "/api/demo-abc/submit", b"not json", {"X-Real-IP": "1.1.1.4"})[0] == 400

assert req("GET", "/admin/")[0] == 401
assert req("GET", "/admin/", headers={"Authorization": "Basic " + base64.b64encode(b"admin:wrong").decode()})[0] == 401
st, body, _ = req("GET", "/admin/", headers=AUTH)
assert st == 200 and "demo-abc" in body.decode()
st, body, _ = req("GET", "/admin/demo-abc", headers=AUTH)
page = body.decode()
assert st == 200 and "مریم احمدی" in page and "برای ما مهم است" in page and "not picked" not in page
assert "40 نفرساعت" in page and "جمع برآورد انتخاب‌ها: 40 نفرساعت" in page, "person-hours: valid kept, string dropped"
st, body, hd = req("GET", "/admin/demo-abc.csv", headers=AUTH)
csv_text = body.decode("utf-8")
assert st == 200 and csv_text.startswith("﻿") and csv_text.count("مریم احمدی") == 2 and "attachment" in hd["Content-Disposition"] and ",40," in csv_text

statuses = [req("POST", "/api/demo-abc/submit", good, {"X-Real-IP": "9.9.9.9"})[0] for _ in range(11)]
assert statuses[:10] == [200] * 10 and statuses[10] == 429, statuses

srv.shutdown()
print("hub ok")
