"""Proposal hub: one subdomain that serves every customer proposal page and keeps what each customer picked.

    /<slug>/                 the customer page, from <DATA_DIR>/proposals/<slug>/index.html (and its files)
    POST /api/<slug>/submit  stores one submission (name, role, mobile, picks, comments) in SQLite
    /admin/                  every proposal with its submissions count          (HTTP Basic: ADMIN_USER / ADMIN_PASSWORD)
    /admin/<slug>            the submissions of one proposal, newest first
    /admin/<slug>.csv        the same, one row per picked item, for Excel

Standard library only. Run behind a TLS reverse proxy (nginx):

    DATA_DIR=/data ADMIN_PASSWORD=... TRUST_PROXY=1 python3 server.py 8080

HOST (default 0.0.0.0) picks the listening address: without Docker, bind only the address the proxy reaches.

ponytail: ThreadingHTTPServer and one SQLite file are enough for a handful of customers a month; move to a real
framework and database only if this ever serves many concurrent users.
"""
from __future__ import annotations

import base64
import csv
import hmac
import io
import json
import os
import re
import sqlite3
import sys
import threading
import time
from contextlib import closing
from datetime import datetime, timedelta, timezone
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

DATA = Path(os.environ.get("DATA_DIR", "./data")).resolve()
PAGES = DATA / "proposals"
DB_FILE = DATA / "db" / "hub.sqlite3"
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
TRUST_PROXY = os.environ.get("TRUST_PROXY", "") == "1"
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{2,63}$")
MAX_BODY = 64 * 1024
RATE_LIMIT, RATE_WINDOW = 10, 60  # submissions per client per minute
TEHRAN = timezone(timedelta(hours=3, minutes=30))  # Iran has had no daylight saving since 2022
TYPES = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".pdf": "application/pdf",
}

_lock = threading.Lock()
_hits: dict[str, list[float]] = {}


def db() -> sqlite3.Connection:
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_FILE)
    con.execute(
        "CREATE TABLE IF NOT EXISTS submissions (id INTEGER PRIMARY KEY, slug TEXT NOT NULL, created_at TEXT NOT NULL,"
        " name TEXT, role TEXT, mobile TEXT, picks TEXT, comments TEXT, general TEXT, ip TEXT, ua TEXT)"
    )
    return con


def proposal_dir(slug: str) -> Path | None:
    if not SLUG.match(slug):
        return None
    d = PAGES / slug
    return d if d.is_dir() else None


def text(v, limit: int) -> str:
    return v.strip()[:limit] if isinstance(v, str) else ""


def clean_submission(body: dict) -> dict | None:
    """Keep only the fields the page sends, with length caps. None when required fields are missing."""
    name = text(body.get("name"), 100)
    picks_in = body.get("picks")
    if not name or not isinstance(picks_in, list):
        return None
    picks = []
    for p in picks_in[:300]:
        if isinstance(p, dict) and text(p.get("id"), 64):
            picks.append({"id": text(p.get("id"), 64), "n": text(p.get("n"), 200), "c": text(p.get("c"), 100)})
    raw = body.get("comments") if isinstance(body.get("comments"), dict) else {}
    ids = {p["id"] for p in picks}
    comments = {k[:64]: text(v, 1000) for k, v in list(raw.items())[:300] if k[:64] in ids and text(v, 1000)}
    return {
        "name": name, "role": text(body.get("role"), 100), "mobile": text(body.get("mobile"), 20),
        "picks": picks, "comments": comments, "general": text(body.get("general"), 2000),
    }


def limited(client: str) -> bool:
    now = time.time()
    with _lock:
        recent = [t for t in _hits.get(client, []) if now - t < RATE_WINDOW]
        if len(recent) >= RATE_LIMIT:
            _hits[client] = recent
            return True
        _hits[client] = recent + [now]
        return False


def fa_time(iso: str) -> str:
    return datetime.fromisoformat(iso).astimezone(TEHRAN).strftime("%Y-%m-%d %H:%M")


ADMIN_CSS = (
    "body{font-family:Vazirmatn,Tahoma,sans-serif;background:#f3f4f6;color:#333;margin:0;padding:20px 16px;font-size:14px}"
    "main{max-width:1100px;margin:0 auto}h1{font-size:18px}h2{font-size:15px;margin:0}a{color:#2563eb}"
    "table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #e5e7eb}"
    "th,td{padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top}"
    "th{color:#596170;font-weight:500;background:#f9fafb}.card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;"
    "padding:12px 14px;margin:12px 0}.muted{color:#596170;font-size:13px}ul{margin:6px 0;padding-right:18px}"
    "li small{color:#596170}.c{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:2px 8px;font-size:13px}"
)


def page(title: str, body: str) -> bytes:
    return (
        f'<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" '
        f'content="width=device-width,initial-scale=1"><title>{escape(title)}</title><style>{ADMIN_CSS}</style></head>'
        f"<body><main>{body}</main></body></html>"
    ).encode()


class Hub(BaseHTTPRequestHandler):
    server_version = "proposal-hub"
    sys_version = ""

    # ----- helpers -----
    def send(self, code: int, body: bytes = b"", ctype: str = "text/plain; charset=utf-8", cache: str = "no-store", extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Robots-Tag", "noindex, nofollow")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def json(self, code: int, obj: dict):
        self.send(code, json.dumps(obj, ensure_ascii=False).encode(), "application/json; charset=utf-8")

    def client(self) -> str:
        if TRUST_PROXY:
            real = self.headers.get("X-Real-IP") or (self.headers.get("X-Forwarded-For") or "").split(",")[0]
            if real.strip():
                return real.strip()
        return self.client_address[0]

    def admin_ok(self) -> bool:
        if not ADMIN_PASSWORD:
            self.send(404, b"not found")
            return False
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Basic "):
            try:
                user, _, pw = base64.b64decode(auth[6:]).decode().partition(":")
            except Exception:
                user, pw = "", ""
            if hmac.compare_digest(user, ADMIN_USER) and hmac.compare_digest(pw, ADMIN_PASSWORD):
                return True
        self.send(401, b"login required", extra={"WWW-Authenticate": 'Basic realm="proposals", charset="UTF-8"'})
        return False

    # ----- routes -----
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if path == "/healthz":
            return self.send(200, b"ok")
        if path == "/favicon.ico":
            return self.send(204, cache="max-age=86400")
        if path == "/admin" or path.startswith("/admin/"):
            return self.admin(path)
        parts = path.strip("/").split("/", 1)
        d = proposal_dir(parts[0]) if parts[0] else None
        if not d:
            return self.send(404, b"not found")
        if len(parts) == 1 and not path.endswith("/"):
            return self.send(301, extra={"Location": f"/{parts[0]}/"})
        rel = parts[1] if len(parts) > 1 and parts[1] else "index.html"
        f = (d / rel).resolve()
        if d.resolve() not in f.parents or not f.is_file() or f.name.startswith("."):
            return self.send(404, b"not found")
        self.send(200, f.read_bytes(), TYPES.get(f.suffix.lower(), "application/octet-stream"), cache="no-cache")

    def do_POST(self):
        m = re.fullmatch(r"/api/([^/]+)/submit", urlsplit(self.path).path)
        if not m or not proposal_dir(m.group(1)):
            return self.json(404, {"ok": False, "error": "not found"})
        try:
            size = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            size = 0
        if size <= 0 or size > MAX_BODY:
            return self.json(413, {"ok": False, "error": "too large"})
        if limited(self.client()):
            return self.json(429, {"ok": False, "error": "too many submissions, try again in a minute"})
        try:
            body = json.loads(self.rfile.read(size))
        except (ValueError, UnicodeDecodeError):
            return self.json(400, {"ok": False, "error": "invalid json"})
        sub = clean_submission(body) if isinstance(body, dict) else None
        if not sub:
            return self.json(400, {"ok": False, "error": "name and picks are required"})
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with _lock, closing(db()) as con, con:
            cur = con.execute(
                "INSERT INTO submissions (slug, created_at, name, role, mobile, picks, comments, general, ip, ua)"
                " VALUES (?,?,?,?,?,?,?,?,?,?)",
                (m.group(1), now, sub["name"], sub["role"], sub["mobile"], json.dumps(sub["picks"], ensure_ascii=False),
                 json.dumps(sub["comments"], ensure_ascii=False), sub["general"], self.client(),
                 (self.headers.get("User-Agent") or "")[:300]),
            )
        self.json(200, {"ok": True, "id": cur.lastrowid, "at": fa_time(now)})

    def admin(self, path: str):
        if not self.admin_ok():
            return
        rest = path[len("/admin"):].strip("/")
        with closing(db()) as con:
            if not rest:
                counts = dict(con.execute("SELECT slug, COUNT(*) FROM submissions GROUP BY slug").fetchall())
                last = dict(con.execute("SELECT slug, MAX(created_at) FROM submissions GROUP BY slug").fetchall())
                slugs = sorted(p.name for p in PAGES.iterdir() if p.is_dir() and SLUG.match(p.name)) if PAGES.is_dir() else []
                rows = "".join(
                    '<tr><td><a href="/admin/%s">%s</a></td><td>%s</td><td>%s</td><td><a href="/%s/">صفحه‌ی مشتری</a></td></tr>'
                    % (s, s, counts.get(s, 0), fa_time(last[s]) if last.get(s) else "—", s)
                    for s in slugs
                )
                return self.send(200, page("پیشنهادها", f"<h1>پیشنهادها</h1><table><tr><th>پیشنهاد</th><th>ارسال‌ها</th>"
                                           f"<th>آخرین ارسال (تهران)</th><th></th></tr>{rows}</table>"), "text/html; charset=utf-8")
            slug, csv_out = (rest[:-4], True) if rest.endswith(".csv") else (rest, False)
            if not SLUG.match(slug):
                return self.send(404, b"not found")
            subs = con.execute(
                "SELECT id, created_at, name, role, mobile, picks, comments, general, ip FROM submissions"
                " WHERE slug=? ORDER BY id DESC", (slug,)).fetchall()
        if csv_out:
            buf = io.StringIO()
            w = csv.writer(buf)
            w.writerow(["ارسال", "زمان (تهران)", "نام", "سمت", "موبایل", "شناسه", "قابلیت", "دسته", "توضیح", "توضیح کلی"])
            for sid, at, name, role, mobile, picks, comments, general, _ in subs:
                cm = json.loads(comments or "{}")
                for p in json.loads(picks or "[]") or [{"id": "", "n": "", "c": ""}]:
                    w.writerow([sid, fa_time(at), name, role, mobile, p["id"], p["n"], p["c"], cm.get(p["id"], ""), general])
            return self.send(200, ("﻿" + buf.getvalue()).encode(), "text/csv; charset=utf-8",
                             extra={"Content-Disposition": f'attachment; filename="{slug}.csv"'})
        cards = ""
        for sid, at, name, role, mobile, picks, comments, general, ip in subs:
            cm = json.loads(comments or "{}")
            items = ""
            for p in json.loads(picks or "[]"):
                note = "<div class=c>%s</div>" % escape(cm[p["id"]]) if cm.get(p["id"]) else ""
                items += "<li>%s <small>(%s)</small>%s</li>" % (escape(p["n"]), escape(p["c"]), note)
            who = escape(name) + ("، " + escape(role) if role else "")
            meta = "ارسال %s، %s، %s، %s" % (sid, fa_time(at), escape(mobile) or "بدون شماره", escape(ip or ""))
            gen = "<div class=c>توضیح کلی: %s</div>" % escape(general) if general else ""
            cards += '<div class="card"><h2>%s</h2><div class="muted">%s</div><ul>%s</ul>%s</div>' % (who, meta, items, gen)
        body = (f'<p><a href="/admin/">همه‌ی پیشنهادها</a></p><h1>{escape(slug)}</h1>'
                f'<p><a href="/admin/{slug}.csv">خروجی CSV برای Excel</a> ، <a href="/{slug}/">صفحه‌ی مشتری</a></p>'
                + (cards or '<p class="muted">هنوز ارسالی نیست.</p>'))
        self.send(200, page(slug, body), "text/html; charset=utf-8")


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    PAGES.mkdir(parents=True, exist_ok=True)
    db().close()
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"proposal hub on {host}:{port}, data in {DATA}, admin {'on' if ADMIN_PASSWORD else 'off (no ADMIN_PASSWORD)'}", flush=True)
    ThreadingHTTPServer((host, port), Hub).serve_forever()


if __name__ == "__main__":
    main()
