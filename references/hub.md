# The proposal hub: one subdomain for every customer

Customers open their page on our own test server, pick what they need, and send it. We read every submission on one
admin page. One subdomain serves all proposals, now and later; a new customer is a new folder, never a new subdomain or
a new deployment.

```
https://proposals.<domain>/<slug>/          the customer page (customer build of the catalogue)
https://proposals.<domain>/admin/           every proposal and its submission count      (HTTP Basic)
https://proposals.<domain>/admin/<slug>     the submissions, newest first: who, when, picks, comments
https://proposals.<domain>/admin/<slug>.csv one row per picked item, opens in Excel
```

Code: `hub/server.py` (Python standard library, SQLite), `hub/Dockerfile`, `hub/docker-compose.yml`,
`hub/nginx-site.conf`, `hub/.env.example`, and `hub/test_server.py` (run it after any change).

## One-time setup on the test server (the user does it, or approves each step)

1. DNS: an A record for the subdomain pointing at the test server.
2. Copy the `hub/` folder to the server, e.g. `/srv/proposals-hub/`, then:
   ```bash
   cd /srv/proposals-hub && cp .env.example .env    # set a long ADMIN_PASSWORD
   mkdir -p proposals && docker compose up -d --build
   curl -s http://127.0.0.1:8090/healthz             # ok
   ```
3. nginx: add `nginx-site.conf` with the real subdomain, get a certificate (certbot), reload nginx. If nginx runs in
   Docker, put both containers on one network and proxy to `http://proposals-hub:8080` instead of `127.0.0.1:8090`.
4. Open `https://proposals.<domain>/admin/`: the browser asks for the admin user and password.

## Publishing a proposal

1. In the internal page, curate the catalogue: edit wording, mark items «در نسخه‌ی مشتری نمایش داده نشود», remove
   notes you do not want to keep; save to a JSON file («ذخیره در فایل» or «دریافت فایل JSON»).
2. Pick a slug that cannot be guessed: `<customer>-<topic>-<8 hex>` (`python3 -c 'import secrets;print(secrets.token_hex(4))'`).
3. Build the customer file:
   ```bash
   python3 -I scripts/build-standalone.py <catalog-folder> dist/<slug>/index.html \
     <workspace>/cloud-front/node_modules/xlsx/dist/xlsx.full.min.js <workspace>/cloud-front/public/font/Vazirmatn-VF.woff2 \
     --customer <slug> --db <master.json>
   ```
   The build leaves out hidden items, notes and the edit and file tools, and adds the send button.
4. Copy the folder to the server: `scp -r dist/<slug> <server>:/srv/proposals-hub/proposals/`. No restart needed.
5. Send the customer `https://proposals.<domain>/<slug>/`.

Updating: rebuild with the same slug and copy again; keep item ids stable so the customer's picks still match. Taking a
proposal down: delete its folder (its submissions stay in the database).

## What the customer page does

- Customer picks and comments stay in their browser (per proposal), so they can come back and change them.
- «انتخاب‌ها و ارسال» opens the drawer: picked items with a comment box each, name (required), role, mobile, a general
  comment, and «ارسال انتخاب‌ها». Every send is a new submission; the admin page shows all of them, newest first.

## Safety

- The slug is the only secret of a page: do not reuse slugs, do not put them in public places. Pages carry
  `noindex`, and the hub has no listing outside `/admin/`.
- The admin pages need HTTP Basic over HTTPS; with no `ADMIN_PASSWORD` they do not exist.
- Submissions are open (no login) by design: the hub accepts only the fields the page sends, caps their size
  (64 KB body, 300 items), and rate-limits each client to 10 per minute.
- Back up the database now and then: `docker cp proposals-hub:/data/db/hub.sqlite3 ./hub-backup.sqlite3`.
