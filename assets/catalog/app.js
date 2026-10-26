(() => {
  "use strict";

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const FA = "۰۱۲۳۴۵۶۷۸۹";
  const fa = (v) => String(v ?? "").replace(/\d/g, (d) => FA[d]);
  const toEn = (v) =>
    String(v ?? "")
      .replace(/[۰-۹]/g, (d) => FA.indexOf(d))
      .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const num = (v) => {
    const s = toEn(v).replace(/[^\d.]/g, "");
    return s === "" ? NaN : Number(s);
  };
  const pad = (n) => String(n).padStart(2, "0");
  const group3 = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
  const money = (n) => (Number.isFinite(n) ? fa(group3(n)) : "—");
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // A customer build sets window.AFC_CONFIG = { mode: "customer", slug, submitUrl } (scripts/build-standalone.py --customer).
  const CFG = window.AFC_CONFIG || {};
  const CUSTOMER = CFG.mode === "customer";
  // every proposal on the hub shares one origin, so browser storage is kept per proposal
  const NS = "afc:" + (CFG.slug ? CFG.slug + ":" : "");
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(NS + k);
        return v == null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(NS + k, JSON.stringify(v));
      } catch {}
    },
    del(k) {
      try {
        localStorage.removeItem(NS + k);
      } catch {}
    },
  };
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clock = () => {
    const d = new Date();
    return fa(pad(d.getHours()) + ":" + pad(d.getMinutes()));
  };
  let toastTimer;
  const toast = (msg, action) => {
    const t = $("#toast");
    t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ""}`;
    if (action) t.querySelector("button").onclick = () => ((t.hidden = true), action.run());
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), action ? 7000 : 3200);
  };
  const later = (ms) => new Promise((r) => setTimeout(r, ms));
  const IN_FRAME = (() => {
    try {
      return window.top !== window;
    } catch {
      return true;
    }
  })();
  const ICON = {
    play: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 3.5l7 4.5-7 4.5z"/></svg>',
    edit: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 13l1-3.5L10.5 3 13 5.5 6.5 12z"/></svg>',
    del: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5"/></svg>',
    plus: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>',
    out: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M9 3h4v4M13 3L7.5 8.5M11 9.5V13H3V5h3.5"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M4 15v4h16v-4"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    clock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" width="16" height="16"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.2l2 1.3"/></svg>',
    sun: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/></svg>',
    moon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M13 9.6A5.5 5.5 0 0 1 6.4 3a5.5 5.5 0 1 0 6.6 6.6z"/></svg>',
  };

  // ---------- catalogue data store ----------
  // Defaults come from data.js; every edit lives in DB, which is kept in the browser and, when connected, in a JSON file.
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const freshDB = () => ({ format: "airsheet-forms-catalog", v: 1, srsGroups: clone(SRS_GROUPS), srs: clone(SRS), cats: clone(CATS), caps: clone(CAPS), picks: [] });
  const validDB = (d) =>
    !!d && d.format === "airsheet-forms-catalog" && ["srsGroups", "srs", "cats", "caps", "picks"].every((k) => Array.isArray(d[k])) && [...d.srs, ...d.caps].every((x) => x && x.id && typeof x.n === "string");
  let DB = (() => {
    // the customer always sees the build's own data; only their picks live in the browser
    if (CUSTOMER) return { ...freshDB(), picks: store.get("picks", []) };
    const saved = store.get("db", null);
    if (validDB(saved)) return saved;
    const d = freshDB();
    d.picks = store.get("picks", []);
    return d;
  })();
  let SRS_BY = {},
    CAP_BY = {},
    DEMO_ITEMS = {};
  const ALIAS = { "disp-percent": "b-display", "disp-time": "b-display" };
  function reindex() {
    SRS_BY = Object.fromEntries(DB.srs.map((s) => [s.id, s]));
    CAP_BY = Object.fromEntries(DB.caps.map((c) => [c.id, c]));
    DB.picks = DB.picks.filter((id) => CAP_BY[id]);
    DEMO_ITEMS = {};
    const add = (key, item) => {
      const k = ALIAS[key] || key;
      (DEMO_ITEMS[k] = DEMO_ITEMS[k] || []).some((x) => x.id === item.id) || DEMO_ITEMS[k].push(item);
    };
    DB.srs.forEach((s) => (s.ds || []).forEach(([k]) => add(k, { id: s.id, label: `بند ${s.no}، ${s.n}` })));
    DB.caps.forEach((c) => c.d && add(c.d, { id: c.id, label: c.n }));
  }
  reindex();
  const persist = () => (CUSTOMER ? store.set("picks", DB.picks) : store.set("db", DB));
  function commit() {
    DB.saved = new Date().toISOString();
    persist();
    reindex();
    FILE.schedule();
    renderCatalog();
    renderPicks();
  }
  function replaceDB(d) {
    DB = d;
    store.set("db", DB);
    reindex();
    renderCatalog();
    renderPicks();
  }
  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  // demo targets an item can point at, for the editor
  const DEMO_TARGETS = {
    progress: "صفحه‌ها و نوار مراحل", layout: "جانمایی بلوکی", intro: "متن ثابت و پیوند", image: "تصویر", piping: "متغیر در متن", prefill: "پر شدن از حساب کاربر",
    help: "راهنمای info", radio: "Radio Buttons", dep: "مقدار داینامیک", cond: "شرط غیرفعال و نمایش", people: "People Picker", date: "تقویم جلالی",
    errors: "پیام فیلدهای اجباری", cancel: "دکمه‌ی لغو", rows: "جدول ورود داده", excel: "بارگذاری Excel", api: "دریافت از قرارداد", aifill: "پر کردن از پیش‌فاکتور",
    catalog: "انتخاب از فهرست خدمات (Lookup)", linetotal: "فرمول مبلغ ردیف", daterule: "قاعده‌ی تاریخ", number: "Textbox Number", totals: "جمع به تفکیک ارز و Set Color",
    switch: "Switch", time: "Time Picker", files: "توضیحات فایل آپلود", sign: "امضای دستی", province: "استان و شهر", button: "Button و Set Value",
    review: "بررسی پیش از ثبت", dup: "درخواست تکراری", otp: "تأیید پیامکی", submit: "ثبت در جداول", receipt: "رسید", rating: "Rating",
    "b-rules": "قاعده‌های فرم", "b-display": "شکل‌های نمایش کنترل", "disp-percent": "Progress Bar", "disp-time": "قالب‌های ساعت", "b-table": "ساخت فرم از جدول",
    "b-map": "نقشه‌ی صفحه‌ها", "b-ai": "ساخت فرم از توضیح", "b-mobile": "پیش‌نمایش موبایل", "b-versions": "نسخه‌های فرم", "b-iran": "کد ملی، شبا، کدپستی",
    bale: "پر کردن در بله", inbox: "کارتابل", record: "صفحه‌ی رکورد", history: "سابقه‌ی تغییرات", pdf: "سند PDF", funnel: "قیف تکمیل",
  };

  // ---------- theme ----------
  // Airsheet's header toggle: one round button, a moon in light and a sun in dark. Until the viewer clicks it, the page
  // follows the host's data-theme (inside the artifact viewer) or the system.
  const hostTheme = document.documentElement.getAttribute("data-theme");
  const sysDark = matchMedia("(prefers-color-scheme: dark)");
  let theme = store.get("theme", "auto");
  const shownTheme = () => (theme !== "auto" ? theme : hostTheme || (sysDark.matches ? "dark" : "light"));
  function applyTheme(t) {
    theme = t;
    if (t === "auto") hostTheme ? document.documentElement.setAttribute("data-theme", hostTheme) : document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    const dark = shownTheme() === "dark";
    const b = $("#theme-btn");
    b.innerHTML = dark ? ICON.sun : ICON.moon;
    b.classList.toggle("dark", dark);
    b.title = dark ? "تم روشن" : "تم تیره";
    b.setAttribute("aria-label", b.title);
    store.set("theme", t);
  }
  sysDark.addEventListener("change", () => theme === "auto" && applyTheme("auto"));
  $("#theme-btn").addEventListener("click", () => {
    applyTheme(shownTheme() === "dark" ? "light" : "dark");
    if (F.step === 3 && !F.submitted) renderFill();
  });

  // ---------- views ----------
  const HASH = { catalog: ["catalog"], demo: ["demo", "fill"], designer: ["demo", "build"], after: ["demo", "after"], tour: ["tour"] };
  let view = "catalog";
  let pane = "fill";
  function setView(v) {
    view = v;
    $$("[data-viewpane]").forEach((s) => (s.hidden = s.dataset.viewpane !== v));
    $$(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
    syncHash();
  }
  function setPane(p) {
    pane = p;
    $$("[data-paneview]").forEach((s) => (s.hidden = s.dataset.paneview !== p));
    $$(".panes button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.pane === p)));
    if (p === "after") renderAfter();
    syncHash();
  }
  function syncHash() {
    const token = view === "demo" ? { fill: "demo", build: "designer", after: "after" }[pane] : view;
    try {
      history.replaceState(null, "", "#" + token);
    } catch {}
  }
  $$(".tab").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  $$(".panes button").forEach((b) => b.addEventListener("click", () => setPane(b.dataset.pane)));

  // ---------- popover & modal ----------
  let pop = null;
  function closePop() {
    if (pop) pop.remove();
    pop = null;
  }
  function openPop(anchor, html, width) {
    closePop();
    pop = document.createElement("div");
    pop.className = "pop";
    pop.dir = "rtl";
    if (width) pop.style.width = width + "px";
    pop.innerHTML = html;
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth;
    const left = Math.max(12, Math.min(r.right - w, innerWidth - w - 12));
    pop.style.left = left + scrollX + "px";
    pop.style.top = r.bottom + scrollY + 6 + "px";
    pop._anchor = anchor;
    return pop;
  }
  document.addEventListener("click", (e) => {
    // composedPath, because a picker redraws itself and detaches the clicked node before this runs
    const path = e.composedPath();
    if (pop && !path.includes(pop) && !(pop._anchor && path.includes(pop._anchor))) closePop();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (pop) closePop();
      else if (modal) closeModal();
    }
  });

  let modal = null;
  function openModal(title, bodyHtml, footHtml) {
    closeModal();
    closePop();
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" dir="rtl">
      <header><h2>${esc(title)}</h2><button class="btn sm" data-x>بستن</button></header>
      <div class="mb">${bodyHtml}</div>${footHtml ? `<footer>${footHtml}</footer>` : ""}</div>`;
    $("#modal-root").appendChild(bg);
    bg.addEventListener("click", (e) => {
      if (e.target === bg || e.target.closest("[data-x]")) closeModal();
    });
    modal = bg;
    decorate(bg);
    const first = bg.querySelector(".mb input:not([type=file]), .mb select, .mb textarea, .mb button");
    if (first) first.focus({ preventScroll: true });
    return bg;
  }
  function closeModal() {
    if (modal) modal.remove();
    modal = null;
  }

  // ---------- markers ----------
  function decorate(root = document) {
    $$("[data-demo]", root).forEach((el) => {
      if (el.querySelector(":scope > .mk")) return;
      const items = el.dataset.demo.split(" ").flatMap((k) => DEMO_ITEMS[k] || []);
      if (!items.length) return;
      if (el.matches("button, input, select, textarea")) {
        // a marker cannot sit inside a control, so the control gets a wrapper that carries the key
        const w = document.createElement("span");
        w.style.display = "inline-block";
        w.dataset.demo = el.dataset.demo;
        delete el.dataset.demo;
        el.replaceWith(w);
        w.appendChild(el);
        el = w;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mk";
      b.textContent = "i";
      b.setAttribute("aria-label", "بندهای این بخش: " + items.map((x) => x.label).join("، "));
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        // looked up on click, so items edited after the marker was drawn still show their current names
        const now = el.dataset.demo.split(" ").flatMap((k) => DEMO_ITEMS[k] || []);
        const p = openPop(
          b,
          `<div class="mk-pop"><h4>این بخش مربوط است به</h4><ul>${now
            .map((x) => `<li><span>${esc(x.label)}</span><button class="btn ghost sm" data-card="${x.id}">در فهرست</button></li>`)
            .join("")}</ul></div>`,
        );
        p.addEventListener("click", (ev) => {
          const id = ev.target.closest("[data-card]")?.dataset.card;
          if (id) openCard(id);
        });
      });
      el.prepend(b);
    });
  }
  const mkTgl = $("#mk-tgl");
  mkTgl.addEventListener("click", () => {
    const on = mkTgl.getAttribute("aria-checked") !== "true";
    mkTgl.setAttribute("aria-checked", String(on));
    document.body.classList.toggle("no-mk", !on);
  });

  // ---------- catalogue: rail + cards ----------
  const filt = { sec: "all", q: "" };
  const picked = (id) => DB.picks.includes(id);
  const hay = (x) => [x.n, x.fa, x.no, x.v, x.x, x.note, ...(x.pts || [])].join(" ");
  const inSec = (kind, x) => {
    const s = filt.sec;
    if (s === "all") return true;
    if (s === "picked") return kind === "b" && picked(x.id);
    if (s === "a" || s === "b") return s === kind;
    if (s.startsWith("g:")) return kind === "a" && x.g === s.slice(2);
    if (s.startsWith("c:")) return kind === "b" && x.c === s.slice(2);
    return true;
  };
  const demoLinks = (pairs) =>
    pairs
      .filter(([k]) => DEMO_TARGETS[k])
      .map(([k, label]) => `<button class="demo-link" data-demo-go="${k}">${ICON.play}${esc(label || "نمایش")}</button>`)
      .join("");
  const listHtml = (pts) =>
    !pts || !pts.length ? "" : pts.length <= 2 ? `<ul>${pts.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : `<details><summary>جزئیات (${fa(pts.length)} مورد)</summary><ul>${pts.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></details>`;
  const hiddenTag = (x) => (x.hide && !CUSTOMER ? `<span class="tag gray">پنهان از مشتری</span>` : "");
  // person-hours estimate (h, a positive integer): shown on the card, summed in the drawer, typed in edit mode
  const sumH = (list) => list.reduce((t, x) => t + (x.h > 0 ? x.h : 0), 0);
  const hTag = (x) => (x.h > 0 ? `<div class="c-h"><span>برآورد</span><b>${money(x.h)} نفرساعت</b></div>` : "");
  const hInput = (x) => (CUSTOMER ? "" : `<label class="ed c-hin">نفرساعت<input class="inp" inputmode="numeric" data-h="${x.id}" value="${x.h > 0 ? fa(x.h) : ""}" aria-label="نفرساعت ${esc(x.n)}"></label>`);
  const edBar = (kind, id) =>
    `<span class="ed ed-bar"><button class="icon-btn" data-edit-item="${kind}:${id}" aria-label="ویرایش">${ICON.edit}</button><button class="icon-btn" data-del-item="${kind}:${id}" aria-label="حذف">${ICON.del}</button></span>`;
  function srsCard(s) {
    return `<article class="card" id="it-${s.id}">
      <div class="c-top"><span class="c-no">بند ${esc(s.no || "")} ${hiddenTag(s)}</span>${edBar("a", s.id)}</div>
      <h3>${esc(s.n)}${s.fa ? `<small>${esc(s.fa)}</small>` : ""}</h3>
      ${s.v ? `<p class="c-v">${esc(s.v)}</p>` : ""}${listHtml(s.pts)}
      ${s.note ? `<div class="c-note"><b>یادداشت:</b> ${esc(s.note)}</div>` : ""}
      ${hTag(s)}<div class="c-foot"><div class="c-demos">${demoLinks(s.ds || [])}</div>${hInput(s)}</div></article>`;
  }
  function capCard(c, i) {
    return `<article class="card ${picked(c.id) ? "picked" : ""}" id="it-${c.id}">
      <div class="c-top"><span class="c-no">ب-${fa(i)} ${hiddenTag(c)}</span>${edBar("b", c.id)}</div>
      <h3>${esc(c.n)}</h3>
      ${c.v ? `<p class="c-v">${esc(c.v)}</p>` : ""}${c.x ? `<p class="c-x">${esc(c.x)}</p>` : ""}
      ${c.note ? `<div class="c-note"><b>یادداشت:</b> ${esc(c.note)}</div>` : ""}
      ${hTag(c)}<div class="c-foot"><div class="c-demos">${c.d ? demoLinks([[c.d, "نمایش"]]) : ""}</div>${hInput(c)}<label class="pick"><input type="checkbox" data-pick="${c.id}" ${picked(c.id) ? "checked" : ""}> نیاز داریم</label></div></article>`;
  }
  function renderRail() {
    const cnt = (kind, pred) => (kind === "a" ? DB.srs : DB.caps).filter(pred).length;
    const btn = (sec, label, n, cls = "") =>
      `<button class="rbtn ${cls}" data-sec="${sec}" aria-pressed="${filt.sec === sec}"><span>${label}</span><span class="c">${fa(n)}</span></button>`;
    $("#rail").innerHTML =
      btn("all", "همه‌ی موارد", DB.srs.length + DB.caps.length) +
      `<hr>` +
      btn("a", "الف. نیازمندی‌های سند", DB.srs.length, "h") +
      DB.srsGroups
        .map(
          (g) =>
            `<div class="rail-row">${btn("g:" + g.k, `<span class="gno">${esc(g.no || "")}</span>${esc(g.n)}`, cnt("a", (s) => s.g === g.k), "sub")}<button class="icon-btn ed" data-ren-grp="${g.k}" aria-label="تغییر نام">${ICON.edit}</button></div>`,
        )
        .join("") +
      btn("b", "ب. قابلیت‌های تکمیلی", DB.caps.length, "h") +
      DB.cats
        .map(
          (c) =>
            `<div class="rail-row">${btn("c:" + c.k, esc(c.n), cnt("b", (x) => x.c === c.k), "sub")}<button class="icon-btn ed" data-ren-cat="${c.k}" aria-label="تغییر نام">${ICON.edit}</button><button class="icon-btn ed" data-del-cat="${c.k}" aria-label="حذف دسته">${ICON.del}</button></div>`,
        )
        .join("") +
      `<button class="btn sm ghost ed" data-add-cat style="margin:4px 8px">${ICON.plus}دسته‌ی تازه</button>` +
      `<hr>` +
      btn("picked", "انتخاب‌شده‌ها", DB.picks.length);
  }
  function renderCatalog() {
    renderRail();
    const q = filt.q;
    const srs = DB.srs.filter((s) => inSec("a", s) && (!q || hay(s).includes(q)));
    const caps = DB.caps.map((c, i) => ({ c, i: i + 1 })).filter(({ c }) => inSec("b", c) && (!q || hay(c).includes(q)));
    $("#result").textContent = fa(srs.length + caps.length) + " مورد";
    const showGroupAdd = !q && filt.sec !== "picked";
    let html = "";
    if (srs.length || (showGroupAdd && (filt.sec === "a" || filt.sec.startsWith("g:")))) {
      html += `<div class="part-h"><h2>الف. نیازمندی‌های سند</h2><p>بندهای «سند نیازمندی‌های ماژول فرم‌ساز پیشرفته»، به ترتیب و با شماره‌ی سند.</p></div>`;
      DB.srsGroups
        .filter((g) => srs.some((s) => s.g === g.k) || (showGroupAdd && filt.sec === "g:" + g.k))
        .forEach((g) => {
          html += `<div class="grp"><h2><span class="gno">${esc(g.no || "")}</span>${esc(g.n)}</h2>${showGroupAdd ? `<button class="btn sm ed" data-add-item="a:${g.k}">${ICON.plus}افزودن بند</button>` : ""}</div><div class="cards">${srs
            .filter((s) => s.g === g.k)
            .map(srsCard)
            .join("")}</div>`;
        });
    }
    if (caps.length || (showGroupAdd && (filt.sec === "b" || filt.sec.startsWith("c:")))) {
      html += `<div class="part-h" style="margin-top:26px"><h2>ب. قابلیت‌های تکمیلی</h2><p>قابلیت‌هایی که می‌توانند همراه نیازمندی‌های سند پیاده‌سازی شوند. موارد مورد نیاز را با «نیاز داریم» علامت بزنید.</p></div>`;
      DB.cats
        .filter((cat) => caps.some(({ c }) => c.c === cat.k) || (showGroupAdd && (filt.sec === "c:" + cat.k || filt.sec === "b")))
        .forEach((cat) => {
          html += `<div class="grp"><h2>${esc(cat.n)}</h2>${showGroupAdd ? `<button class="btn sm ed" data-add-item="b:${cat.k}">${ICON.plus}افزودن قابلیت</button>` : ""}</div><div class="cards">${caps
            .filter(({ c }) => c.c === cat.k)
            .map(({ c, i }) => capCard(c, i))
            .join("")}</div>`;
        });
    }
    $("#catalog-list").innerHTML = html || `<p class="empty">${filt.sec === "picked" ? "هنوز قابلیتی انتخاب نشده است." : "موردی با این جستجو پیدا نشد."}</p>`;
    $("#pick-count").textContent = fa(DB.picks.length);
  }
  $("#rail").addEventListener("click", (e) => {
    const s = e.target.closest("[data-sec]")?.dataset.sec;
    if (s) {
      filt.sec = s;
      renderCatalog();
      if (innerWidth > 900) $("#catalog-list").scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
      return;
    }
    const rg = e.target.closest("[data-ren-grp]")?.dataset.renGrp;
    if (rg) return renameGroup("a", rg);
    const rc = e.target.closest("[data-ren-cat]")?.dataset.renCat;
    if (rc) return renameGroup("b", rc);
    const dc = e.target.closest("[data-del-cat]")?.dataset.delCat;
    if (dc) return deleteCategory(dc);
    if (e.target.closest("[data-add-cat]")) return renameGroup("b", null);
  });
  $("#catalog-list").addEventListener("click", (e) => {
    const k = e.target.closest("[data-demo-go]")?.dataset.demoGo;
    if (k) return showDemo(k);
    const ed = e.target.closest("[data-edit-item]")?.dataset.editItem;
    if (ed) {
      const [kind, id] = ed.split(":");
      return openItemEditor(kind, id);
    }
    const del = e.target.closest("[data-del-item]")?.dataset.delItem;
    if (del) {
      const [kind, id] = del.split(":");
      return deleteItem(kind, id);
    }
    const add = e.target.closest("[data-add-item]")?.dataset.addItem;
    if (add) {
      const [kind, grp] = add.split(":");
      return openItemEditor(kind, null, grp);
    }
  });
  $("#catalog-list").addEventListener("change", (e) => {
    const hid = e.target.dataset.h;
    if (hid) {
      // saved without a redraw, so focus stays put; Enter jumps to the next card's box (below)
      const it = SRS_BY[hid] || CAP_BY[hid];
      const v = parseInt(toEn(e.target.value).replace(/\D/g, ""), 10);
      if (v > 0) it.h = v;
      else delete it.h;
      e.target.value = it.h ? fa(it.h) : "";
      DB.saved = new Date().toISOString();
      persist();
      FILE.schedule();
      return;
    }
    const id = e.target.dataset.pick;
    if (!id) return;
    DB.picks = e.target.checked ? [...new Set([...DB.picks, id])] : DB.picks.filter((x) => x !== id);
    e.target.closest(".card").classList.toggle("picked", e.target.checked);
    persist();
    FILE.schedule();
    renderRail();
    renderPicks();
    $("#pick-count").textContent = fa(DB.picks.length);
  });
  $("#catalog-list").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !e.target.dataset.h) return;
    e.preventDefault();
    const all = $$("[data-h]");
    all[all.indexOf(e.target) + 1]?.focus();
  });
  $("#q").addEventListener("input", (e) => {
    filt.q = e.target.value.trim();
    renderCatalog();
  });
  function openCard(id) {
    closePop();
    closeModal();
    filt.q = "";
    $("#q").value = "";
    filt.sec = "all";
    setView("catalog");
    renderCatalog();
    const el = $("#it-" + id);
    if (el) highlight(el, "flash");
  }
  function highlight(el, cls = "flash") {
    el.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 1800);
  }

  // ---------- edit mode ----------
  function setEditing(on) {
    document.body.classList.toggle("editing", on);
    $("#edit-btn").classList.toggle("on", on);
    $("#edit-btn").setAttribute("aria-pressed", String(on));
    if (on) setView("catalog");
    renderCatalog();
  }
  $("#edit-btn").addEventListener("click", () => setEditing(!document.body.classList.contains("editing")));
  $("#edit-done").addEventListener("click", () => setEditing(false));

  function openItemEditor(kind, id, grp) {
    const isA = kind === "a";
    const list = isA ? DB.srs : DB.caps;
    const cur = id ? list.find((x) => x.id === id) : null;
    const it = cur ? clone(cur) : isA ? { id: uid("a"), g: grp || DB.srsGroups[0]?.k, no: "", n: "", fa: "", v: "", pts: [], ds: [] } : { id: uid("c"), c: grp || DB.cats[0]?.k, n: "", v: "", x: "", d: "" };
    const targetOpts = (sel) => `<option value="">بدون نمایش</option>${Object.entries(DEMO_TARGETS).map(([k, n]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(n)}</option>`).join("")}`;
    const dsRow = ([k, label] = ["", ""]) =>
      `<div class="ds-row"><select class="inp" data-ds-k aria-label="بخش نمایش">${targetOpts(k)}</select><input class="inp" data-ds-l value="${esc(label)}" placeholder="عنوان دکمه" aria-label="عنوان دکمه"><button type="button" class="icon-btn" data-ds-del aria-label="حذف">${ICON.del}</button></div>`;
    const body = isA
      ? `<div class="row">
          <div class="fld"><label for="e-no">شماره‌ی بند</label><input class="inp" id="e-no" value="${esc(it.no)}" placeholder="مثلاً ۱-۱-۱۴"></div>
          <div class="fld"><label for="e-g">بخش سند</label><select class="inp" id="e-g">${DB.srsGroups.map((g) => `<option value="${g.k}" ${g.k === it.g ? "selected" : ""}>${esc((g.no ? g.no + " " : "") + g.n)}</option>`).join("")}</select></div>
        </div>
        <div class="row">
          <div class="fld"><label for="e-n">عنوان <span class="req">*</span></label><input class="inp" id="e-n" value="${esc(it.n)}"></div>
          <div class="fld"><label for="e-fa">عنوان فارسی</label><input class="inp" id="e-fa" value="${esc(it.fa || "")}"></div>
        </div>
        <div class="fld"><label for="e-v">توضیح</label><textarea class="inp" id="e-v">${esc(it.v || "")}</textarea></div>
        <div class="fld"><label for="e-pts">جزئیات (هر سطر یک مورد)</label><textarea class="inp" id="e-pts">${esc((it.pts || []).join("\n"))}</textarea></div>
        <div class="fld"><span class="lbl">پیوند به نمایش فرم</span><div id="e-ds" style="display:grid;gap:6px">${(it.ds || []).map(dsRow).join("")}</div><div><button type="button" class="btn sm" id="e-ds-add">${ICON.plus}پیوند تازه</button></div></div>`
      : `<div class="row">
          <div class="fld"><label for="e-n">عنوان <span class="req">*</span></label><input class="inp" id="e-n" value="${esc(it.n)}"></div>
          <div class="fld"><label for="e-c">دسته</label><select class="inp" id="e-c">${DB.cats.map((c) => `<option value="${c.k}" ${c.k === it.c ? "selected" : ""}>${esc(c.n)}</option>`).join("")}</select></div>
        </div>
        <div class="fld"><label for="e-v">توضیح</label><textarea class="inp" id="e-v">${esc(it.v || "")}</textarea></div>
        <div class="fld"><label for="e-x">مثال در فرم مشتری</label><input class="inp" id="e-x" value="${esc(it.x || "")}"></div>
        <div class="fld"><label for="e-d">نمایش در فرم</label><select class="inp" id="e-d">${targetOpts(it.d || "")}</select></div>`;
    const m = openModal(
      cur ? "ویرایش " + (isA ? "بند" : "قابلیت") : isA ? "بند تازه" : "قابلیت تازه",
      body +
        `<label class="pick"><input type="checkbox" id="e-hide" ${it.hide ? "checked" : ""}> در نسخه‌ی مشتری نمایش داده نشود</label>` +
        `<div class="fld"><label for="e-note">یادداشت جلسه</label><textarea class="inp" id="e-note" style="min-height:60px" placeholder="نظر مشتری یا نکته‌ای که در جلسه گفته شد">${esc(it.note || "")}</textarea><span class="hint">روی کارت و در خروجی‌ها نمایش داده می‌شود.</span></div><span class="err" id="e-err"></span>`,
      `<button class="btn pri" data-save-item>ذخیره</button><button class="btn" data-x>انصراف</button>${cur ? `<button class="btn" data-del-here style="margin-inline-start:auto;color:var(--red)">${ICON.del}حذف</button>` : ""}`,
    );
    $("#e-ds-add", m)?.addEventListener("click", () => $("#e-ds", m).insertAdjacentHTML("beforeend", dsRow()));
    m.addEventListener("click", (e) => {
      if (e.target.closest("[data-ds-del]")) e.target.closest(".ds-row").remove();
      if (e.target.closest("[data-del-here]")) {
        closeModal();
        deleteItem(kind, it.id);
      }
      if (!e.target.closest("[data-save-item]")) return;
      const n = $("#e-n", m).value.trim();
      if (!n) return ($("#e-err", m).textContent = "عنوان را بنویسید.");
      it.n = n;
      it.v = $("#e-v", m).value.trim();
      it.note = $("#e-note", m).value.trim();
      if (!it.note) delete it.note;
      it.hide = $("#e-hide", m).checked;
      if (!it.hide) delete it.hide;
      if (isA) {
        it.no = $("#e-no", m).value.trim();
        it.g = $("#e-g", m).value;
        it.fa = $("#e-fa", m).value.trim();
        it.pts = $("#e-pts", m).value.split("\n").map((x) => x.trim()).filter(Boolean);
        if (!it.pts.length) delete it.pts;
        it.ds = $$(".ds-row", m).map((r) => [$("[data-ds-k]", r).value, $("[data-ds-l]", r).value.trim()]).filter(([k]) => k);
      } else {
        it.c = $("#e-c", m).value;
        it.x = $("#e-x", m).value.trim();
        it.d = $("#e-d", m).value;
        if (!it.x) delete it.x;
        if (!it.d) delete it.d;
      }
      if (cur) list[list.indexOf(cur)] = it;
      else list.push(it);
      closeModal();
      commit();
      toast(cur ? "تغییرها ذخیره شد." : "مورد تازه اضافه شد.");
      const el = $("#it-" + it.id);
      if (el) highlight(el);
    });
  }
  function deleteItem(kind, id) {
    const list = kind === "a" ? DB.srs : DB.caps;
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return;
    const [gone] = list.splice(i, 1);
    const wasPicked = picked(id);
    commit();
    toast(`«${gone.n}» حذف شد.`, {
      label: "بازگرداندن",
      run: () => {
        list.splice(Math.min(i, list.length), 0, gone);
        if (wasPicked) DB.picks.push(id);
        commit();
      },
    });
  }
  function renameGroup(kind, key) {
    const isA = kind === "a";
    const g = key ? (isA ? DB.srsGroups : DB.cats).find((x) => x.k === key) : null;
    const m = openModal(
      g ? "تغییر نام " + (isA ? "بخش" : "دسته") : "دسته‌ی تازه",
      `${isA ? `<div class="fld"><label for="g-no">شماره</label><input class="inp" id="g-no" value="${esc(g?.no || "")}"></div>` : ""}<div class="fld"><label for="g-n">نام <span class="req">*</span></label><input class="inp" id="g-n" value="${esc(g?.n || "")}"></div><span class="err" id="g-err"></span>`,
      `<button class="btn pri" data-save-g>ذخیره</button><button class="btn" data-x>انصراف</button>`,
    );
    $("[data-save-g]", m).addEventListener("click", () => {
      const n = $("#g-n", m).value.trim();
      if (!n) return ($("#g-err", m).textContent = "نام را بنویسید.");
      if (g) {
        g.n = n;
        if (isA) g.no = $("#g-no", m).value.trim();
      } else DB.cats.push({ k: uid("k"), n });
      closeModal();
      commit();
    });
  }
  function deleteCategory(key) {
    const cat = DB.cats.find((c) => c.k === key);
    if (!cat) return;
    if (DB.caps.some((c) => c.c === key)) return toast("اول قابلیت‌های این دسته را حذف کنید یا به دسته‌ی دیگری ببرید.");
    const i = DB.cats.indexOf(cat);
    DB.cats.splice(i, 1);
    if (filt.sec === "c:" + key) filt.sec = "b";
    commit();
    toast(`دسته‌ی «${cat.n}» حذف شد.`, { label: "بازگرداندن", run: () => (DB.cats.splice(i, 0, cat), commit()) });
  }

  // ---------- selections drawer ----------
  const chosenCaps = () => DB.caps.filter((c) => picked(c.id));
  // customer build: a comment per picked item, who they are, and a send button that posts to the proposal hub
  const COMMENTS = CUSTOMER ? store.get("comments", {}) : {};
  const WHO = { name: "", role: "", mobile: "", general: "", ...(CUSTOMER ? store.get("who", {}) : {}) };
  function renderPicks() {
    const chosen = chosenCaps();
    $("#pick-count").textContent = fa(chosen.length);
    const li = (c) =>
      `<li><span>${esc(c.n)}${c.h > 0 ? ` <span class="li-h">(${money(c.h)} نفرساعت)</span>` : ""}</span><button class="icon-btn" data-unpick="${c.id}" aria-label="حذف ${esc(c.n)}">${ICON.del}</button>` +
      (CUSTOMER
        ? `<textarea class="inp cmt" data-cmt="${c.id}" placeholder="توضیح شما درباره‌ی این مورد (اختیاری)" aria-label="توضیح ${esc(c.n)}">${esc(COMMENTS[c.id] || "")}</textarea>`
        : c.note
          ? `<span class="hint">یادداشت: ${esc(c.note)}</span>`
          : "") +
      `</li>`;
    $("#picks-body").innerHTML =
      `<p class="hint">همه‌ی ${fa(DB.srs.length)} بند سند نیازمندی${CUSTOMER ? " شما" : ""} در دامنه است. قابلیت‌های تکمیلی انتخاب‌شده:</p>` +
      (chosen.length
        ? DB.cats
            .filter((cat) => chosen.some((c) => c.c === cat.k))
            .map((cat) => `<h3>${esc(cat.n)}</h3><ul>${chosen.filter((c) => c.c === cat.k).map(li).join("")}</ul>`)
            .join("")
        : `<p class="empty">هنوز قابلیت تکمیلی انتخاب نشده است. روی کارت‌های بخش «ب» گزینه‌ی «نیاز داریم» را بزنید.</p>`) +
      hoursSum(chosen) +
      (CUSTOMER ? sendForm() : "");
    $("#xlsx-picks").hidden = IN_FRAME || !window.XLSX;
  }
  function hoursSum(chosen) {
    const a = sumH(DB.srs),
      b = sumH(chosen);
    if (!a && !b) return "";
    const row = (label, n, cls = "") => `<div class="${cls}"><span>${label}</span><b>${money(n)} نفرساعت</b></div>`;
    return `<div class="h-sum">${a ? row("برآورد بندهای سند", a) : ""}${b ? row("برآورد قابلیت‌های انتخاب‌شده", b) : ""}${a && b ? row("جمع برآورد", a + b, "tot") : ""}</div>`;
  }
  function sendForm() {
    const sent = store.get("sentAt", "");
    const f = (k, label, attrs = "") => `<div class="fld"><label for="w-${k}">${label}</label><input class="inp" id="w-${k}" data-who="${k}" value="${esc(WHO[k])}" ${attrs}></div>`;
    return `<div class="send"><h3>ارسال برای ما</h3>
      ${f("name", 'نام و نام خانوادگی <span class="req">*</span>', 'autocomplete="name"')}
      <div class="row">${f("role", "سمت")}${f("mobile", "شماره‌ی همراه", 'inputmode="tel" autocomplete="tel" placeholder="۰۹۱۲…"')}</div>
      <div class="fld"><label for="w-general">توضیح کلی</label><textarea class="inp" id="w-general" data-who="general">${esc(WHO.general)}</textarea></div>
      <div><button class="btn pri" id="send-picks">${sent ? "ارسال دوباره با تغییرها" : "ارسال انتخاب‌ها"}</button></div>
      <p class="hint" id="send-m" aria-live="polite">${sent ? `آخرین ارسال شما: ${esc(sent)}` : "پس از ارسال هم می‌توانید انتخاب‌ها را تغییر دهید و دوباره بفرستید."}</p></div>`;
  }
  async function sendPicks() {
    const m = $("#send-m");
    if (!WHO.name.trim()) {
      m.textContent = "نام خود را بنویسید.";
      return $("#w-name").focus();
    }
    const mobile = toEn(WHO.mobile).replace(/\D/g, "");
    if (mobile && !/^09\d{9}$/.test(mobile)) {
      m.textContent = "شماره‌ی همراه باید ۱۱ رقم و با ۰۹ باشد.";
      return $("#w-mobile").focus();
    }
    const chosen = chosenCaps();
    const payload = {
      name: WHO.name.trim(), role: WHO.role.trim(), mobile, general: WHO.general.trim(),
      picks: chosen.map((c) => ({ id: c.id, n: c.n, c: DB.cats.find((x) => x.k === c.c)?.n || "", ...(c.h > 0 ? { h: c.h } : {}) })),
      comments: Object.fromEntries(chosen.filter((c) => (COMMENTS[c.id] || "").trim()).map((c) => [c.id, COMMENTS[c.id].trim()])),
    };
    const btn = $("#send-picks");
    btn.disabled = true;
    m.innerHTML = `<span class="spin"></span> در حال ارسال…`;
    try {
      const r = await fetch(CFG.submitUrl || `/api/${CFG.slug}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429) throw new Error("چند ارسال پشت سر هم انجام شد؛ یک دقیقه بعد دوباره بفرستید.");
      if (!r.ok || !j.ok) throw new Error("ارسال انجام نشد. دوباره تلاش کنید.");
      let at;
      try {
        at = new Date().toLocaleString("fa-IR-u-ca-persian", { dateStyle: "medium", timeStyle: "short" });
      } catch {
        at = fa(j.at || clock());
      }
      store.set("sentAt", at);
      m.textContent = `انتخاب‌های شما ثبت شد (${at}). اگر چیزی را تغییر دادید، دوباره ارسال کنید.`;
      btn.textContent = "ارسال دوباره با تغییرها";
      toast("انتخاب‌های شما ثبت شد. سپاس.");
    } catch (e) {
      m.textContent = /[؀-ۿ]/.test(e.message || "") ? e.message : "ارسال انجام نشد. اتصال اینترنت را بررسی کنید و دوباره بفرستید.";
    }
    btn.disabled = false;
  }
  $("#picks-body").addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.cmt) {
      COMMENTS[t.dataset.cmt] = t.value;
      store.set("comments", COMMENTS);
    }
    if (t.dataset.who) {
      WHO[t.dataset.who] = t.value;
      store.set("who", WHO);
    }
  });
  $("#picks-body").addEventListener("click", (e) => {
    if (e.target.closest("#send-picks")) return sendPicks();
    const id = e.target.closest("[data-unpick]")?.dataset.unpick;
    if (!id) return;
    DB.picks = DB.picks.filter((x) => x !== id);
    commit();
  });
  $("#open-picks").addEventListener("click", () => {
    renderPicks();
    $("#drawer").hidden = false;
  });
  $("#close-picks").addEventListener("click", () => ($("#drawer").hidden = true));
  $("#clear-picks").addEventListener("click", () => {
    const before = DB.picks.slice();
    if (!before.length) return;
    DB.picks = [];
    commit();
    toast("فهرست انتخاب‌ها پاک شد.", { label: "بازگرداندن", run: () => ((DB.picks = before), commit()) });
  });
  $("#copy-picks").addEventListener("click", async () => {
    const chosen = chosenCaps();
    const text =
      `ماژول فرم‌ساز پیشرفته\nهمه‌ی ${fa(DB.srs.length)} بند سند نیازمندی، به‌اضافه‌ی ${fa(chosen.length)} قابلیت تکمیلی:\n` +
      DB.cats
        .filter((cat) => chosen.some((c) => c.c === cat.k))
        .map((cat) => `\n${cat.n}\n` + chosen.filter((c) => c.c === cat.k).map((c) => `- ${c.n}${c.h > 0 ? ` (${money(c.h)} نفرساعت)` : ""}${c.note ? ` (یادداشت: ${c.note})` : ""}`).join("\n"))
        .join("\n") +
      (sumH(chosen) ? `\n\nبرآورد قابلیت‌های انتخاب‌شده: ${money(sumH(chosen))} نفرساعت` : "");
    try {
      await navigator.clipboard.writeText(text);
      toast("فهرست کپی شد.");
    } catch {
      openModal("کپی فهرست", `<p class="hint">متن را انتخاب و کپی کنید.</p><textarea class="inp" style="min-height:260px" readonly>${esc(text)}</textarea>`);
      $("#modal-root textarea").select();
    }
  });
  function exportXlsx(onlyPicked) {
    const head = ["بخش", "دسته", "شماره", "عنوان", "عنوان فارسی", "توضیح", "جزئیات", "مثال", "برآورد (نفرساعت)", "نیاز داریم", "یادداشت جلسه"];
    const rows = [];
    if (!onlyPicked)
      DB.srs.forEach((s) => {
        const g = DB.srsGroups.find((x) => x.k === s.g);
        rows.push(["الف. نیازمندی‌های سند", g ? `${g.no || ""} ${g.n}`.trim() : "", s.no || "", s.n, s.fa || "", s.v || "", (s.pts || []).join("\n"), "", s.h || "", "در دامنه", s.note || ""]);
      });
    DB.caps.forEach((c, i) => {
      if (onlyPicked && !picked(c.id)) return;
      rows.push(["ب. قابلیت‌های تکمیلی", DB.cats.find((x) => x.k === c.c)?.n || "", "ب-" + fa(i + 1), c.n, "", c.v || "", "", c.x || "", c.h || "", picked(c.id) ? "بله" : "", c.note || ""]);
    });
    const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
    ws["!cols"] = [18, 22, 9, 30, 16, 60, 50, 30, 12, 10, 40].map((wch) => ({ wch }));
    ws["!views"] = [{ RTL: true }];
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, "قابلیت‌ها");
    XLSX.writeFile(wb, onlyPicked ? "قابلیت-های-انتخاب-شده.xlsx" : "فهرست-قابلیت-های-فرم-ساز.xlsx");
  }
  $("#xlsx-picks").addEventListener("click", () => exportXlsx(true));

  // ---------- save to a file on disk ----------
  // Chrome and Edge can keep a handle to a JSON file and rewrite it after every change (File System Access API).
  // Elsewhere the page offers import and export of the same JSON. Inside the hosted viewer neither picker nor download is allowed.
  const idb = (mode, fn) =>
    new Promise((res, rej) => {
      const r = indexedDB.open("afc", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onerror = () => rej(r.error);
      r.onsuccess = () => {
        // a put that cannot clone its value throws here, inside the event handler, so it must reject explicitly
        try {
          const tx = r.result.transaction("kv", mode);
          const q = fn(tx.objectStore("kv"));
          tx.oncomplete = () => res(q && q.result);
          tx.onerror = tx.onabort = () => rej(tx.error);
        } catch (e) {
          rej(e);
        }
      };
    });
  const kvGet = (k) => idb("readonly", (s) => s.get(k)).catch(() => null);
  const kvSet = (k, v) => idb("readwrite", (s) => s.put(v, k)).catch(() => {});
  const kvDel = (k) => idb("readwrite", (s) => s.delete(k)).catch(() => {});
  const JTYPES = [{ description: "فهرست قابلیت‌ها (JSON)", accept: { "application/json": [".json"] } }];
  const FILE = {
    can: !IN_FRAME && "showOpenFilePicker" in window && "showSaveFilePicker" in window,
    handle: null,
    state: "none", // none | on | ask | error
    savedAt: "",
    err: "",
    timer: 0,
    async boot() {
      if (!this.can) return fileUI();
      const h = await kvGet("file");
      if (h) {
        this.handle = h;
        try {
          const p = await h.queryPermission({ mode: "readwrite" });
          if (p === "granted") await this.read();
          else this.state = "ask";
        } catch {
          this.state = "ask";
        }
      }
      fileUI();
    },
    async open() {
      try {
        const [h] = await showOpenFilePicker({ types: JTYPES });
        await this.attach(h, true);
      } catch (e) {
        if (e.name !== "AbortError") this.fail(e);
      }
    },
    async create() {
      try {
        const h = await showSaveFilePicker({ suggestedName: "airsheet-forms-catalog.json", types: JTYPES });
        await this.attach(h, false);
      } catch (e) {
        if (e.name !== "AbortError") this.fail(e);
      }
    },
    async attach(h, read) {
      this.handle = h;
      try {
        if (read) await this.read();
        else await this.write();
        if (this.state === "on") {
          await kvSet("file", h);
          toast(read ? `از فایل «${h.name}» بارگذاری شد؛ تغییرها در همین فایل ذخیره می‌شوند.` : `فایل «${h.name}» ساخته شد؛ تغییرها در آن ذخیره می‌شوند.`);
        }
      } catch (e) {
        this.fail(e);
      }
      fileUI();
    },
    async again() {
      try {
        const p = await this.handle.requestPermission({ mode: "readwrite" });
        if (p === "granted") await this.read();
      } catch (e) {
        this.fail(e);
      }
      fileUI();
    },
    async read() {
      const text = (await (await this.handle.getFile()).text()).trim();
      if (!text) return this.write();
      let d = null;
      try {
        d = JSON.parse(text);
      } catch {}
      if (!validDB(d)) {
        // never overwrite a file that is not ours
        this.state = "error";
        this.err = `«${this.handle.name}» فایل فهرست قابلیت‌ها نیست و دست نخورد.`;
        this.handle = null;
        toast(this.err);
        return;
      }
      replaceDB(d);
      this.state = "on";
      this.savedAt = clock();
    },
    schedule() {
      if (this.state !== "on") return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.write(), 400);
    },
    async write() {
      try {
        const w = await this.handle.createWritable();
        await w.write(JSON.stringify(DB, null, 2));
        await w.close();
        this.state = "on";
        this.savedAt = clock();
      } catch (e) {
        this.fail(e);
      }
      fileUI();
    },
    disconnect() {
      this.handle = null;
      this.state = "none";
      kvDel("file");
      fileUI();
      toast("اتصال به فایل قطع شد. تغییرها فقط در همین مرورگر ذخیره می‌شوند.");
    },
    fail(e) {
      this.state = this.handle ? "error" : "none";
      this.err = "ذخیره در فایل انجام نشد" + (e && e.message ? ": " + e.message : ".");
      fileUI();
      toast(this.err);
    },
  };
  function fileUI() {
    const dot = $("#file-dot");
    const lbl = $("#file-lbl");
    dot.className = "fdot " + ({ on: "on", ask: "ask", error: "err" }[FILE.state] || "");
    lbl.textContent =
      FILE.state === "on" ? `${FILE.handle.name}، ذخیره شد ${FILE.savedAt}` : FILE.state === "ask" ? `اتصال دوباره به ${FILE.handle.name}` : FILE.state === "error" ? "خطای فایل" : "ذخیره در فایل";
  }
  function downloadJSON() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" }));
    a.download = "airsheet-forms-catalog.json";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1000);
  }
  $("#file-btn").addEventListener("click", () => {
    if (FILE.state === "ask") return FILE.again();
    const st =
      FILE.state === "on"
        ? `<div class="st"><b>${esc(FILE.handle.name)}</b>هر تغییر خودکار در این فایل ذخیره می‌شود. آخرین ذخیره: ${FILE.savedAt}</div>`
        : FILE.can
          ? `<div class="st">تغییرها در این مرورگر ذخیره می‌شوند. برای ذخیره‌ی خودکار در یک فایل روی سیستم، به فایل وصل شوید.</div>`
          : IN_FRAME
            ? `<div class="st">تغییرها در همین مرورگر ذخیره می‌شوند. برای ذخیره‌ی خودکار در فایل، نسخه‌ی تک‌فایلی را در Chrome یا Edge باز کنید.</div>`
            : `<div class="st">این مرورگر اتصال مستقیم به فایل ندارد (Chrome یا Edge دارند). از «دریافت فایل JSON» و «بارگذاری از فایل JSON» استفاده کنید.</div>`;
    const items = [];
    if (FILE.can && FILE.state !== "on") items.push(["open", "اتصال به فایل موجود…"], ["create", "ساخت فایل تازه…"]);
    if (FILE.state === "on") items.push(["reload", "بارگذاری دوباره از فایل"], ["disconnect", "قطع اتصال از فایل"]);
    items.push(["hr"]);
    if (!IN_FRAME) items.push(["download", "دریافت فایل JSON"]);
    items.push(["import", "بارگذاری از فایل JSON…"]);
    if (!IN_FRAME && window.XLSX) items.push(["xlsx", "خروجی Excel کل فهرست"]);
    if (!IN_FRAME) items.push(["print", "چاپ یا PDF فهرست"]);
    items.push(["hr"], ["reset", "بازگشت به فهرست اولیه"]);
    const p = openPop(
      $("#file-btn"),
      `<div class="menu">${st}${items.map(([a, l]) => (a === "hr" ? "<hr>" : `<button type="button" data-fa="${a}">${l}</button>`)).join("")}</div>`,
      300,
    );
    p.addEventListener("click", (e) => {
      const a = e.target.closest("[data-fa]")?.dataset.fa;
      if (!a) return;
      closePop();
      ({
        open: () => FILE.open(),
        create: () => FILE.create(),
        reload: () => FILE.read().then(fileUI, (err) => FILE.fail(err)),
        disconnect: () => FILE.disconnect(),
        download: downloadJSON,
        import: () => $("#json-in").click(),
        xlsx: () => exportXlsx(false),
        print: () => {
          setView("catalog");
          filt.sec = "all";
          filt.q = "";
          $("#q").value = "";
          renderCatalog();
          setTimeout(() => print(), 50);
        },
        reset: () => {
          const before = clone(DB);
          replaceDB(freshDB());
          FILE.schedule();
          toast("فهرست به حالت اولیه برگشت.", { label: "بازگرداندن", run: () => (replaceDB(before), FILE.schedule()) });
        },
      })[a]();
    });
  });
  $("#json-in").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    let d = null;
    try {
      d = JSON.parse(await f.text());
    } catch {}
    if (!validDB(d)) return toast("این فایل، فهرست قابلیت‌ها نیست.");
    const before = clone(DB);
    replaceDB(d);
    FILE.schedule();
    toast(`فهرست از «${f.name}» بارگذاری شد.`, { label: "بازگرداندن", run: () => (replaceDB(before), FILE.schedule()) });
  });

  // ---------- demo data ----------
  const TODAY = 14050803;
  const DEPUTIES = {
    it: { n: "معاونت فناوری اطلاعات", depts: ["اداره کل ESS", "اداره کل BSS"], people: [["مریم احمدی", "مدیر اداره کل ESS"], ["حمید کریمی", "مدیر اداره کل BSS"], ["سارا مرادی", "معاون فناوری اطلاعات"]] },
    fin: { n: "معاونت مالی", depts: ["اداره کل خزانه‌داری", "اداره کل حسابداری"], people: [["رضا نوری", "مدیر اداره کل خزانه‌داری"], ["لیلا صادقی", "مدیر اداره کل حسابداری"]] },
    tech: { n: "معاونت فنی", depts: ["اداره کل شبکه‌ی دسترسی", "اداره کل شبکه‌ی هسته"], people: [["کاوه رحیمی", "مدیر اداره کل شبکه‌ی دسترسی"], ["نرگس جعفری", "مدیر اداره کل شبکه‌ی هسته"]] },
    com: { n: "معاونت تجاری", depts: ["اداره کل فروش", "اداره کل بازاریابی"], people: [["امیر حسینی", "مدیر اداره کل فروش"], ["پریسا کاظمی", "مدیر اداره کل بازاریابی"]] },
  };
  const SERVICES = [
    { id: "c1", n: "پشتیبانی نرم‌افزار", unit: "نفرساعت", price: 4500000 },
    { id: "c2", n: "مهاجرت پایگاه داده", unit: "پروژه", price: 1850000000 },
    { id: "c3", n: "آموزش کاربران", unit: "نفرروز", price: 25000000 },
    { id: "c4", n: "نگهداری زیرساخت", unit: "ماه", price: 320000000 },
    { id: "c5", n: "مشاوره‌ی امنیت", unit: "نفرساعت", price: 6000000 },
  ];
  const CURR = ["ریال", "یورو", "دلار", "یوان", "درهم"];
  const PROV = {
    "تهران": ["تهران", "ری", "شمیرانات", "اسلامشهر"],
    "اصفهان": ["اصفهان", "کاشان", "نجف‌آباد"],
    "خراسان رضوی": ["مشهد", "نیشابور", "سبزوار"],
    "فارس": ["شیراز", "مرودشت", "جهرم"],
    "آذربایجان شرقی": ["تبریز", "مراغه", "مرند"],
  };
  const TYPES = { t1: "کالای تخصصی / خدمات", t2: "کالای عمومی(اثاثیه و اموال)", t3: "کالای عمومی(مکانیزاسیون)" };
  const RIAL_LIMIT = 5e9;
  let rid = 100;
  const row = (o) => ({ id: "r" + rid++, title: "", qty: 1, unit: "عدد", price: 0, cur: "ریال", ...o });
  const sampleRows = () => ({
    svc: [
      row({ catalogId: "c1", title: "پشتیبانی نرم‌افزار", qty: 900, unit: "نفرساعت", price: 4500000, start: "۱۴۰۵/۰۹/۰۱", end: "۱۴۰۵/۱۲/۲۹", country: "خیر", lead: 2, leadUnit: "هفته" }),
      row({ catalogId: "c2", title: "مهاجرت پایگاه داده", qty: 1, unit: "پروژه", price: 1850000000, start: "۱۴۰۵/۰۹/۱۵", end: "۱۴۰۵/۱۱/۳۰", country: "خیر", lead: 1, leadUnit: "ماه" }),
    ],
    spec: [row({ title: "سوییچ هسته ۴۸ پورت", qty: 2, unit: "دستگاه", price: 14500, cur: "یورو", auth: true, spare: true, nonOrig: false, eos: true, lead: 3, leadUnit: "ماه", note: "سازگار با تجهیزات فعلی" })],
    gen: [],
  });
  const fresh = () => ({
    step: 1, subject: "", type: "t1", deputy: "", dept: "", first: "علی", last: "رضایی", mobile: "۰۹۱۲۳۴۵۶۷۸۹", nid: "", approver: "", needDate: "",
    ...sampleRows(), desc: "", prov: "", city: "", recv: "", install: false, visitTime: "", installDate: "", files: [], signed: false,
    eosWhy: "", otp: "", dupOk: false, submitted: null, rating: 0,
  });
  let F = fresh();
  const fullName = () => `${F.first} ${F.last}`;
  const UI = { svc: { q: "", sort: null, page: 0 }, spec: { q: "", sort: null, page: 0 }, gen: { q: "", sort: null, page: 0 }, errors: {}, showErr: false };

  // ---------- validation helpers ----------
  const nidOk = (v) => {
    const s = toEn(v);
    if (!/^\d{10}$/.test(s) || /^(\d)\1{9}$/.test(s)) return false;
    let t = 0;
    for (let i = 0; i < 9; i++) t += +s[i] * (10 - i);
    const r = t % 11;
    return r < 2 ? +s[9] === r : +s[9] === 11 - r;
  };
  const jdate = (v) => {
    const m = toEn(v).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return null;
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    const max = mo <= 6 ? 31 : mo <= 11 ? 30 : 29;
    if (mo < 1 || mo > 12 || d < 1 || d > max) return null;
    return y * 10000 + mo * 100 + d;
  };
  const BANKS = { "017": "بانک ملی", "012": "بانک ملت", "018": "بانک تجارت", "019": "بانک صادرات", "015": "بانک سپه", "016": "بانک کشاورزی", "054": "بانک پارسیان", "055": "بانک اقتصاد نوین", "056": "بانک سامان", "057": "بانک پاسارگاد", "062": "بانک آینده", "013": "بانک رفاه", "021": "پست بانک", "014": "بانک مسکن" };
  const ibanCheck = (v) => {
    const s = toEn(v).toUpperCase().replace(/\s/g, "");
    if (!/^IR\d{24}$/.test(s)) return { ok: false, msg: "شبا باید IR و ۲۴ رقم باشد." };
    const re = s.slice(4) + "1827" + s.slice(2, 4);
    let r = 0;
    for (const ch of re) r = (r * 10 + +ch) % 97;
    if (r !== 1) return { ok: false, msg: "رقم کنترل شبا درست نیست." };
    return { ok: true, msg: BANKS[s.slice(4, 7)] || "بانک شناخته نشد" };
  };

  // ---------- data entry grids ----------
  const lineTotal = (r) => (num(r.qty) || 0) * (num(r.price) || 0);
  const yn = (b) => (b ? "بله" : "خیر");
  const lead = (r) => (r.lead ? fa(r.lead) : "—");
  const TABLES = {
    svc: {
      n: "خدمات", show: () => F.type === "t1", api: true, first: "توضیح خدمات",
      cols: [["توضیح خدمات", (r) => esc(r.title), "title"], ["زمان مطلوب تامین", lead, "lead"], ["تعداد", (r) => fa(r.qty), "qty"], ["واحد اندازه گیری", (r) => esc(r.unit), "unit"], ["قیمت براوردی(واحد)", (r) => money(num(r.price)), "price"], ["تاریخ شروع خدمات", (r) => esc(r.start || "—"), "start"], ["تاریخ پایان خدمات", (r) => esc(r.end || "—"), "end"], ["واحد زمان تامین", (r) => esc(r.leadUnit || "—"), "leadUnit"], ["نوع ارز", (r) => esc(r.cur), "cur"], ["مبلغ", (r) => money(lineTotal(r)), "total"]],
      excel: ["توضیح خدمات", "تعداد", "واحد اندازه گیری", "قیمت براوردی(واحد)", "نوع ارز", "تاریخ شروع خدمات", "تاریخ پایان خدمات"],
    },
    spec: {
      n: "کالای تخصصی", show: () => F.type === "t1", ai: true, first: "نام کالا",
      cols: [["نام کالا", (r) => esc(r.title), "title"], ["تعداد", (r) => fa(r.qty), "qty"], ["واحد اندازه گیری", (r) => esc(r.unit), "unit"], ["قیمت براوردی(واحد)", (r) => money(num(r.price)), "price"], ["توضیحات", (r) => esc(r.note || "—"), "note"], ["زمان مطلوب تامین", lead, "lead"], ["واحد زمان تامین", (r) => esc(r.leadUnit || "—"), "leadUnit"], ["نیاز به اصالت سنجی", (r) => yn(r.auth), "auth"], ["آیا تجهیزات یدکی مورد نیاز است", (r) => yn(r.spare), "spare"], ["پذیرش کالای غیر اصل", (r) => yn(r.nonOrig), "nonOrig"], ["آیا تجهیزات End of Sale است ؟", (r) => (r.eos ? `<span class="tag orange">بله</span>` : "خیر"), "eos"], ["نوع ارز", (r) => esc(r.cur), "cur"], ["مبلغ", (r) => money(lineTotal(r)), "total"]],
      excel: ["نام کالا", "تعداد", "واحد اندازه گیری", "قیمت براوردی(واحد)", "نوع ارز"],
    },
    gen: {
      n: "کالای عمومی", show: () => F.type !== "t1", first: "شرح کالا",
      cols: [["شرح کالا", (r) => esc(r.title), "title"], ["تعداد", (r) => fa(r.qty), "qty"], ["واحد اندازه گیری", (r) => esc(r.unit), "unit"], ["قیمت براوردی(واحد)", (r) => money(num(r.price)), "price"], ["نوع ارز", (r) => esc(r.cur), "cur"], ["مبلغ", (r) => money(lineTotal(r)), "total"]],
      excel: ["شرح کالا", "تعداد", "واحد اندازه گیری", "قیمت براوردی(واحد)", "نوع ارز"],
    },
  };
  const visibleTables = () => Object.keys(TABLES).filter((k) => TABLES[k].show());
  const allRows = () => visibleTables().flatMap((k) => F[k]);
  const totalsBy = (rows) => {
    const t = {};
    rows.forEach((r) => (t[r.cur] = (t[r.cur] || 0) + lineTotal(r)));
    return t;
  };

  // ---------- form: render ----------
  const STEPS = [
    { n: "اطلاعات درخواست", min: 2 },
    { n: "آیتم‌های اعلام نیاز خرید", min: 3 },
    { n: "اطلاعات تکمیلی اعلام نیاز خرید", min: 1 },
    { n: "بازبینی و ثبت", min: 1 },
  ];
  let savedAt = "";
  const fld = (id, label, inner, { req, help, hint, demo, lock } = {}) => {
    const e = UI.showErr ? UI.errors[id] : "";
    return `<div class="fld ${e ? "bad" : ""}" ${demo ? `data-demo="${demo}"` : ""} data-fld="${id}">
      <label for="f-${id}">${esc(label)}${req ? ' <span class="req" aria-hidden="true">*</span>' : ""}${lock ? ' <span class="lock">از حساب کاربری</span>' : ""}${help ? ` <button type="button" class="help" data-help="${help}" aria-label="راهنمای ${esc(label)}">i</button>` : ""}</label>
      ${inner}${hint ? `<span class="hint">${hint}</span>` : ""}<span class="err" id="e-${id}">${esc(e || "")}</span></div>`;
  };
  const sel = (id, opts, value, attrs = "") =>
    `<select class="inp" id="f-${id}" data-f="${id}" ${attrs}><option value="">انتخاب کنید</option>${opts
      .map(([v, l]) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(l)}</option>`)
      .join("")}</select>`;
  const txt = (id, value, attrs = "") => `<input class="inp" id="f-${id}" data-f="${id}" value="${esc(value)}" ${attrs}>`;
  const sw = (id, on, label) =>
    `<button type="button" class="swline" role="switch" aria-checked="${!!on}" id="f-${id}" data-sw="${id}"><span class="sw"></span>${esc(label)}</button>`;
  const dateInp = (id, value) =>
    `<div style="display:flex;gap:6px"><input class="inp" id="f-${id}" data-f="${id}" value="${esc(value)}" placeholder="۱۴۰۵/۰۸/۲۰" inputmode="numeric"><button type="button" class="btn sm" data-cal="${id}">تقویم</button></div>`;
  const PROCESS_SVG = `<svg viewBox="0 0 340 92" role="img" aria-label="مراحل درخواست خرید">
      <rect class="m-node k" x="236" y="22" width="92" height="44" rx="8"/><text class="m-txt" x="282" y="49" text-anchor="middle" font-size="12">اعلام نیاز</text>
      <rect class="m-node" x="124" y="22" width="92" height="44" rx="8"/><text class="m-txt" x="170" y="49" text-anchor="middle" font-size="12">تأیید مدیر</text>
      <rect class="m-node" x="12" y="22" width="92" height="44" rx="8"/><text class="m-txt" x="58" y="49" text-anchor="middle" font-size="12">تدارکات</text>
      <path class="m-edge" d="M236 44 L220 44"/><path class="m-arrow" d="M220 40 L214 44 L220 48 z"/>
      <path class="m-edge" d="M124 44 L108 44"/><path class="m-arrow" d="M108 40 L102 44 L108 48 z"/>
      <text class="m-lbl" x="170" y="84" text-anchor="middle" font-size="10.5">تصویر با اندازه‌ی ثابت ۳۴۰ پیکسل</text></svg>`;

  function renderFill() {
    const root = $("#fill");
    const focusId = document.activeElement?.id;
    if (F.submitted) {
      root.innerHTML = receiptHtml();
    } else {
      const remain = STEPS.slice(F.step - 1).reduce((a, s) => a + s.min, 0);
      root.innerHTML = `
      ${draftBanner()}
      <div class="frm">
        <div class="frm-head" data-demo="progress">
          <div class="frm-title"><h2>اعلام نیاز خرید</h2>
            <div class="saved" data-demo="draft"><span><span class="dot"></span> ${savedAt ? "پیش‌نویس ذخیره شد، " + savedAt : "پیش‌نویس خودکار ذخیره می‌شود"}</span><button class="btn ghost sm" data-act="later">ادامه در زمانی دیگر</button></div>
          </div>
          <div class="steps">${STEPS.map((s, i) => `<button type="button" class="stp ${i + 1 < F.step ? "done" : ""} ${i + 1 === F.step ? "cur" : ""}" data-goto="${i + 1}"><i></i>${fa(i + 1)}. ${esc(s.n)}</button>`).join("")}</div>
          <div class="eta">صفحه‌ی ${fa(F.step)} از ${fa(STEPS.length)}، حدود ${fa(remain)} دقیقه</div>
        </div>
        <div class="frm-body">${errSummary()}${[step1, step2, step3, step4][F.step - 1]()}</div>
        <div class="frm-foot">
          <div>${F.step > 1 ? `<button class="btn" data-act="prev">قبلی</button>` : `<button class="btn" data-act="cancel" data-demo="cancel">لغو</button>`}</div>
          <div>${F.step < 4 ? `<button class="btn pri" data-act="next">بعدی</button>` : ""}</div>
        </div>
      </div>`;
    }
    decorate(root);
    if (F.step === 3 && !F.submitted) bindSignature();
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el && root.contains(el)) el.focus({ preventScroll: true });
    }
  }
  function errSummary() {
    const list = Object.entries(UI.errors);
    if (!UI.showErr || !list.length) return "";
    return `<div class="err-sum" data-demo="errors" role="alert"><b>${fa(list.length)} مورد را اصلاح کنید:</b><ul>${list
      .map(([k, m]) => `<li><button type="button" data-focus="${k}">${esc(m)}</button></li>`)
      .join("")}</ul></div>`;
  }
  const bootDraft = store.get("draft", null);
  function draftBanner() {
    const d = bootDraft;
    if (!d || UI.draftSeen || d.submitted) return "";
    return `<div class="note" style="max-width:840px;margin:0 auto 12px"><b>پیش‌نویسی از ${esc(d._at || "قبل")} پیدا شد.</b><span>می‌توانید از همان‌جا ادامه دهید.</span><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm pri" data-act="resume">ادامه</button><button class="btn sm" data-act="discard">شروع از نو</button></div></div>`;
  }

  function step1() {
    const dep = DEPUTIES[F.deputy];
    const deptOpts = dep ? dep.depts.map((d) => [d, d]) : [];
    const person = dep && dep.people.find((p) => p[0] === F.approver);
    return `
      <div class="note" data-demo="intro link"><b>پیش از شروع</b><span>این فرم برای اعلام نیاز خرید کالا و خدمات است. هر قلم با قیمت براوردی و نوع ارز خودش ثبت می‌شود.</span>
        <span><button type="button" class="linkbtn" data-act="rules">${ICON.out}آیین‌نامه‌ی معاملات</button></span></div>
      <div class="figure" data-demo="image">${PROCESS_SVG}</div>
      <p class="pipe" data-demo="piping">${esc(fullName())} عزیز، این درخواست به نام <mark>${esc(F.dept || "اداره کل شما")}</mark>${F.deputy ? " در <mark>" + esc(DEPUTIES[F.deputy].n) + "</mark>" : ""} ثبت می‌شود.</p>
      <div class="sec" data-demo="layout"><h3>مشخصات درخواست</h3>
        ${fld("subject", "عنوان درخواست", txt("subject", F.subject, 'placeholder="مثلاً تأمین پشتیبانی سامانه‌ی صورتحساب"'), { req: true })}
        <div class="row" data-demo="prefill">
          ${fld("first", "نام", `<input class="inp locked" id="f-first" value="${esc(F.first)}" readonly>`, { lock: true })}
          ${fld("last", "نام خانوادگی", `<input class="inp locked" id="f-last" value="${esc(F.last)}" readonly>`, { lock: true })}
          ${fld("nid", "کد ملی", txt("nid", F.nid, 'inputmode="numeric" maxlength="10" placeholder="۱۰ رقم"'), { req: true })}
        </div>
      </div>
      <div class="sec"><h3>نوع و ارجاع</h3>
        ${fld("type", "نوع درخواست", `<div class="radios" role="radiogroup" aria-label="نوع درخواست">${Object.entries(TYPES)
          .map(([k, l]) => `<label><input type="radio" name="type" value="${k}" data-f="type" ${F.type === k ? "checked" : ""}> ${esc(l)}</label>`)
          .join("")}</div>`, { req: true, help: "type", demo: "radio help" })}
        <div class="row">
          ${fld("deputy", "معاونت", sel("deputy", Object.entries(DEPUTIES).map(([k, d]) => [k, d.n]), F.deputy), { req: true, demo: "dep" })}
          ${fld("dept", "اداره کل", sel("dept", deptOpts, F.dept, dep ? "" : "disabled"), { req: true, demo: "cond", hint: dep ? "ادارات کل همین معاونت" : "پس از انتخاب معاونت فعال می‌شود" })}
        </div>
        <div class="row">
          ${fld("approver", "تأییدکننده", `<button type="button" class="inp picker" id="f-approver" data-people ${dep ? "" : "disabled"}>${person ? `<span class="person"><span class="av">${esc(person[0][0])}</span>${esc(person[0])}، <span class="hint">${esc(person[1])}</span></span>` : `<span class="hint">${dep ? "از مدیران " + esc(dep.n) : "پس از انتخاب معاونت"}</span>`}<span aria-hidden="true">▾</span></button>`, { req: true, demo: "people" })}
          ${fld("needDate", "تاریخ نیاز", dateInp("needDate", F.needDate), { req: true, demo: "date", hint: "تقویم جلالی، با تاریخ میلادی کنار هر روز" })}
        </div>
      </div>`;
  }

  function tableHtml(k) {
    const T = TABLES[k];
    const ui = UI[k];
    let rows = F[k].slice();
    if (ui.q) rows = rows.filter((r) => (r.title || "").includes(ui.q));
    if (ui.sort) {
      const [key, dir] = ui.sort;
      const val = (r) => (key === "total" ? lineTotal(r) : ["qty", "price", "lead"].includes(key) ? num(r[key]) : String(r[key] ?? ""));
      rows.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * dir);
    }
    const per = 5;
    const pages = Math.max(1, Math.ceil(rows.length / per));
    ui.page = Math.min(ui.page, pages - 1);
    const shown = rows.slice(ui.page * per, ui.page * per + per);
    const tot = totalsBy(F[k]);
    const err = UI.showErr && UI.errors["tbl-" + k];
    return `<div class="tbl-card" ${k === "svc" ? 'data-demo="rows"' : ""} style="${err ? "border-color:var(--red)" : ""}">
      <div class="tbl-head"><h3>${esc(T.n)} <span class="hint">(${fa(F[k].length)} ردیف)</span></h3>
        <div class="tbl-tools">
          ${F[k].length > 3 ? `<input class="inp" style="min-height:28px;width:140px;padding:2px 8px" placeholder="جستجو" aria-label="جستجو در ${esc(T.n)}" data-tq="${k}" value="${esc(ui.q)}" id="tq-${k}">` : ""}
          ${T.api ? `<button class="btn sm" data-api="${k}" data-demo="api">دریافت از قرارداد</button>` : ""}
          ${T.ai ? `<button class="btn sm" data-ai="${k}" data-demo="aifill">از روی پیش‌فاکتور</button>` : ""}
          <button class="btn sm" data-excel="${k}" ${k === "svc" ? 'data-demo="excel"' : ""}>بارگذاری Excel</button>
          <button class="btn sm pri" data-add="${k}" aria-label="افزودن ردیف به ${esc(T.n)}">+</button>
        </div></div>
      <div class="tbl-scroll"><table><thead><tr>${T.cols
        .map(([h, , key]) => `<th><button data-sort="${k}:${key}">${esc(h)}${ui.sort && ui.sort[0] === key ? (ui.sort[1] > 0 ? " ▲" : " ▼") : ""}</button></th>`)
        .join("")}<th></th></tr></thead>
      <tbody>${shown.length ? shown.map((r) => `<tr>${T.cols.map(([, f, key]) => `<td class="${["qty", "price", "total", "lead"].includes(key) ? "n" : ""}">${f(r)}</td>`).join("")}<td><button class="icon-btn" data-edit="${k}:${r.id}" aria-label="ویرایش">${ICON.edit}</button><button class="icon-btn" data-del="${k}:${r.id}" aria-label="حذف">${ICON.del}</button></td></tr>`).join("") : `<tr><td colspan="${T.cols.length + 1}" class="tbl-empty">${ui.q ? "ردیفی با این جستجو نیست." : "داده‌ای برای نمایش وجود ندارد"}</td></tr>`}</tbody></table></div>
      <div class="tbl-foot"><span>جمع: ${Object.entries(tot).map(([c, v]) => `${money(v)} ${esc(c)}`).join("، ") || "—"}</span>
        ${pages > 1 ? `<span class="pager"><button class="icon-btn" data-page="${k}:-1" aria-label="صفحه‌ی قبل">‹</button>صفحه‌ی ${fa(ui.page + 1)} از ${fa(pages)}<button class="icon-btn" data-page="${k}:1" aria-label="صفحه‌ی بعد">›</button></span>` : ""}</div>
      ${err ? `<div class="err" style="padding:0 12px 8px">${esc(err)}</div>` : ""}
    </div>`;
  }
  function totalsHtml() {
    const t = totalsBy(allRows());
    const over = (t["ریال"] || 0) > RIAL_LIMIT;
    return `<div class="totals ${over ? "over" : ""}" data-demo="totals" aria-live="polite">
      <b>جمع براوردی درخواست، به تفکیک ارز</b>
      ${Object.entries(t).map(([c, v]) => `<div class="tot-line ${c === "ریال" ? "rial" : ""}"><span>${esc(c)}</span><b>${money(v)}</b></div>`).join("") || `<span class="hint">هنوز ردیفی نیست.</span>`}
      ${over ? `<span class="hint" style="color:var(--orange-ink)">جمع ریالی بیش از سقف اختیار مدیر اداره کل (۵ میلیارد ریال) است و درخواست به معاون هم ارجاع می‌شود.</span>` : ""}
    </div>`;
  }
  function step2() {
    return `<p class="hint">نوع درخواست: <b>${esc(TYPES[F.type])}</b></p>${visibleTables().map(tableHtml).join("")}${totalsHtml()}`;
  }
  function step3() {
    const cities = PROV[F.prov] || [];
    return `
      ${fld("desc", "شرح درخواست", `<textarea class="inp" id="f-desc" data-f="desc" maxlength="600">${esc(F.desc)}</textarea>`, { req: true, hint: `${fa(F.desc.length)} از ۶۰۰ نویسه` })}
      <div class="row" data-demo="province">
        ${fld("prov", "محل مصرف (استان)", sel("prov", Object.keys(PROV).map((p) => [p, p]), F.prov), { req: true })}
        ${fld("city", "محل مصرف (شهر)", sel("city", cities.map((c) => [c, c]), F.city, F.prov ? "" : "disabled"), { req: true })}
      </div>
      <div class="row">
        ${fld("recv", "محل دریافت", txt("recv", F.recv, 'placeholder="مثلاً انبار مرکزی، ساختمان شماره‌ی ۲"'), { req: true })}
        ${fld("mobile", "شماره تماس", txt("mobile", F.mobile, 'inputmode="numeric" maxlength="11"'), { req: true, lock: true })}
      </div>
      <div class="sec"><h3>نصب و راه‌اندازی</h3>
        <div data-demo="switch">${sw("install", F.install, "کالا یا خدمت نیاز به نصب و راه‌اندازی دارد")}</div>
        ${F.install ? `<div class="row">
          ${fld("visitTime", "ساعت مراجعه‌ی نصاب", `<button type="button" class="inp picker" id="f-visitTime" data-time="visitTime">${F.visitTime ? esc(F.visitTime) : '<span class="hint">ساعت:دقیقه</span>'}${ICON.clock}</button>`, { req: true, demo: "time" })}
          ${fld("installDate", "تاریخ نصب", dateInp("installDate", F.installDate))}
        </div>` : ""}
      </div>
      <div class="sec" data-demo="files"><h3>پیوست‌ها</h3>
        <label class="btn sm" style="justify-self:start">انتخاب فایل<input type="file" multiple data-files hidden></label>
        <span class="hint">برای هر فایل یک توضیح کوتاه بنویسید.</span>
        ${F.files.length ? `<div class="files"><ul>${F.files.map((f, i) => `<li><span>${esc(f.name)} <span class="hint">${fa(Math.max(1, Math.round(f.size / 1024)))} کیلوبایت</span></span><input class="inp" placeholder="توضیح فایل، مثلاً «مشخصات فنی پیشنهادی»" data-fdesc="${i}" value="${esc(f.desc)}" aria-label="توضیح ${esc(f.name)}" id="fd-${i}"><button class="icon-btn" data-frm="${i}" aria-label="حذف فایل">${ICON.del}</button></li>`).join("")}</ul></div>` : ""}
        ${UI.showErr && UI.errors.files ? `<span class="err">${esc(UI.errors.files)}</span>` : ""}
      </div>
      <div class="sec" data-demo="sign"><h3>امضای درخواست‌کننده</h3>
        <canvas class="sig" id="sig" aria-label="کادر امضا"></canvas>
        <div style="display:flex;gap:8px;align-items:center"><button class="btn sm" data-act="sigclear">پاک کردن</button><span class="hint">${F.signed ? "امضا ثبت شد." : "با ماوس یا انگشت امضا کنید."}</span></div>
      </div>
      <div data-demo="button"><button class="btn" data-act="copyprev">پر کردن از آخرین درخواست من</button></div>`;
  }
  function policyChecks() {
    const out = [];
    const t = totalsBy(allRows());
    const rial = t["ریال"] || 0;
    const eos = F.spec.filter((r) => r.eos);
    const foreign = Object.keys(t).filter((c) => c !== "ریال");
    out.push(["ok", "تاریخ پایان همه‌ی خدمات بعد از تاریخ شروع است."]);
    if (rial > RIAL_LIMIT) out.push(["warn", `جمع ریالی (${money(rial)} ریال) بیش از سقف اختیار مدیر اداره کل است. پس از تأیید مدیر، به معاون هم ارجاع می‌شود.`]);
    if (foreign.length) out.push(["warn", `اقلام ارزی (${foreign.join("، ")}) در درخواست هست. کارشناس بازرگانی خارجی به گردش تأیید اضافه می‌شود.`]);
    const nd = jdate(F.needDate);
    if (nd && nd - TODAY < 14) out.push(["warn", "تاریخ نیاز کمتر از دو هفته‌ی دیگر است. علت فوریت را در شرح درخواست بنویسید."]);
    if (F.type === "t1" && eos.length && !F.eosWhy.trim()) out.push(["bad", `${fa(eos.length)} کالا End of Sale است و توجیه فنی ندارد. توجیه را همین‌جا بنویسید:`, true]);
    out.push(["ok", "تأییدکننده از گروه مدیران همان معاونت است."]);
    return out;
  }
  function step4() {
    const checks = policyChecks();
    const blocking = checks.some((c) => c[0] === "bad");
    const dup = !F.dupOk && allRows().some((r) => (r.title || "").includes("پشتیبانی"));
    const t = totalsBy(allRows());
    const dep = DEPUTIES[F.deputy];
    const otpOk = toEn(F.otp) === "1234";
    return `
      <div class="sum-grid">
        <div class="sum"><b>اطلاعات درخواست <button class="linkbtn" data-goto="1">ویرایش</button></b>${esc(F.subject || "—")}<span>${esc(TYPES[F.type])}</span><span>${esc(F.dept || "—")}، ${esc(dep ? dep.n : "—")}</span><span>تأییدکننده: ${esc(F.approver || "—")}</span></div>
        <div class="sum"><b>آیتم‌ها <button class="linkbtn" data-goto="2">ویرایش</button></b>${visibleTables().map((k) => `${esc(TABLES[k].n)}: ${fa(F[k].length)} ردیف`).join("<br>")}<span>${Object.entries(t).map(([c, v]) => money(v) + " " + c).join("، ")}</span></div>
        <div class="sum"><b>اطلاعات تکمیلی <button class="linkbtn" data-goto="3">ویرایش</button></b>${esc(F.city || "—")}، ${esc(F.recv || "—")}<span>${fa(F.files.length)} پیوست${F.install ? "، نصب: " + esc(F.visitTime) : ""}</span></div>
      </div>
      <div class="sec" data-demo="review"><h3>بررسی با قواعد خرید</h3>
        <div class="checks">${checks
          .map(([s, m, fix]) => `<div class="chk ${s}"><span class="ic">${s === "ok" ? "✓" : s === "warn" ? "!" : "✕"}</span><div>${esc(m)}${fix ? `<textarea class="inp" style="margin-top:6px;min-height:60px" id="f-eosWhy" data-f="eosWhy" placeholder="مثلاً: سازگاری با تجهیزات موجود شبکه‌ی هسته">${esc(F.eosWhy)}</textarea><button class="btn sm" style="margin-top:6px" data-act="recheck">بررسی دوباره</button>` : ""}</div></div>`)
          .join("")}</div>
      </div>
      ${dup ? `<div class="note warn" data-demo="dup"><b>درخواست مشابه پیدا شد</b><span>اخ-۱۴۰۵-۰۴۱۲، ۲۹ مهر، همین اداره کل، قلم مشترک: «پشتیبانی نرم‌افزار».</span><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="seedup">دیدن درخواست</button><button class="btn sm" data-act="dupok">تکراری نیست، ادامه</button></div></div>` : `<div data-demo="dup" class="hint">درخواست مشابهی پیدا نشد.</div>`}
      <div class="sec" data-demo="otp"><h3>تأیید هویت</h3>
        <span>کد تأیید به ${esc(F.mobile.slice(0, 4))}•••${esc(F.mobile.slice(-4))} پیامک شد. <span class="hint">(در این نمایش: ۱۲۳۴)</span></span>
        <div class="otp"><input class="inp" id="f-otp" data-f="otp" inputmode="numeric" maxlength="4" value="${esc(F.otp)}" aria-label="کد تأیید"><span class="hint" id="otp-m">${otpOk ? "✓ شماره تأیید شد." : ""}</span></div>
        <span class="hint">${nidOk(F.nid) ? "✓ کد ملی و شماره‌ی همراه با سامانه‌ی شاهکار تطبیق داده شد." : "کد ملی در صفحه‌ی ۱ وارد نشده یا نادرست است."}</span>
      </div>
      <div data-demo="submit" style="display:grid;gap:6px">
        <button class="btn pri" id="submit-btn" data-act="submit" ${blocking || !otpOk ? "disabled" : ""}>ثبت درخواست</button>
        <span class="hint" id="submit-m">${blocking ? "ابتدا مورد قواعد خرید را رفع کنید." : !otpOk ? "کد تأیید را وارد کنید." : `درخواست و ${fa(allRows().length)} ردیف آیتم‌ها با هم در جدول‌ها ثبت می‌شوند.`}</span>
      </div>`;
  }
  function receiptHtml() {
    const s = F.submitted;
    return `<div class="frm"><div class="frm-body"><div class="receipt" data-demo="receipt">
      <div class="big-ok">${ICON.ok}</div><h2>درخواست شما ثبت شد</h2>
      <div class="track">${esc(s.no)} <button class="btn sm" data-act="copyno">کپی</button></div>
      <span>یک درخواست و ${s.parts.map(([n, c]) => fa(c) + " ردیف " + n).join(" و ")} ثبت شد.</span>
      <div class="chain" aria-label="وضعیت درخواست"><span class="done">ثبت شد</span>›<span class="cur">بررسی ${esc(F.approver || "مدیر")}</span>›<span>${s.toDeputy ? "تأیید معاون" : "تدارکات"}</span>›<span>خرید</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
        <button class="btn" data-act="editsub">ویرایش تا پیش از بررسی</button>
        <button class="btn" data-act="seepdf">سند PDF</button>
        <button class="btn" data-act="seeinbox">کارتابل تأییدکننده</button>
        <button class="btn pri" data-act="newreq">درخواست تازه</button>
      </div>
      <div class="sec" data-demo="rating" style="width:100%;justify-items:center"><h3 style="text-align:center">پر کردن این فرم چقدر ساده بود؟</h3>
        <div class="stars" role="radiogroup" aria-label="امتیاز">${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="${F.rating === n}" aria-label="${fa(n)} ستاره" class="${F.rating >= n ? "on" : ""}" data-rate="${n}">★</button>`).join("")}</div>
        <span class="hint">${F.rating ? `امتیاز ${fa(F.rating)} از ۵ ثبت شد.` : "امتیاز از ۱ تا ۵"}</span>
      </div>
    </div></div></div>`;
  }

  // ---------- form: validation ----------
  function validate(step) {
    const e = {};
    if (step === 1) {
      if (!F.subject.trim()) e.subject = "عنوان درخواست را بنویسید.";
      if (!nidOk(F.nid)) e.nid = F.nid ? "کد ملی معتبر نیست." : "کد ملی را وارد کنید.";
      if (!F.deputy) e.deputy = "معاونت را انتخاب کنید.";
      if (!F.dept) e.dept = "اداره کل را انتخاب کنید.";
      if (!F.approver) e.approver = "تأییدکننده را انتخاب کنید.";
      const d = jdate(F.needDate);
      if (!d) e.needDate = "تاریخ نیاز را به شکل ۱۴۰۵/۰۸/۲۰ وارد کنید.";
      else if (d <= TODAY) e.needDate = "تاریخ نیاز باید بعد از امروز (۱۴۰۵/۰۸/۰۳) باشد.";
    }
    if (step === 2) visibleTables().forEach((k) => !F[k].length && (e["tbl-" + k] = `جدول «${TABLES[k].n}» دست‌کم یک ردیف لازم دارد.`));
    if (step === 3) {
      if (F.desc.trim().length < 10) e.desc = "شرح درخواست را دست‌کم در ۱۰ نویسه بنویسید.";
      if (!F.prov) e.prov = "استان محل مصرف را انتخاب کنید.";
      if (!F.city) e.city = "شهر محل مصرف را انتخاب کنید.";
      if (!F.recv.trim()) e.recv = "محل دریافت را بنویسید.";
      if (!/^09\d{9}$/.test(toEn(F.mobile))) e.mobile = "شماره تماس باید ۱۱ رقم و با ۰۹ باشد.";
      if (F.install && !F.visitTime) e.visitTime = "ساعت مراجعه‌ی نصاب را انتخاب کنید.";
      if (F.files.some((f) => !f.desc.trim())) e.files = "برای هر پیوست توضیح بنویسید.";
    }
    return e;
  }
  function goStep(n, check = true) {
    if (check && n > F.step) {
      for (let s = F.step; s < n; s++) {
        const e = validate(s);
        if (Object.keys(e).length) {
          UI.errors = e;
          UI.showErr = true;
          F.step = s;
          renderFill();
          $("#fill .err-sum")?.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
          return false;
        }
      }
    }
    UI.errors = {};
    UI.showErr = false;
    F.step = n;
    renderFill();
    saveDraft();
    return true;
  }
  function liveRevalidate() {
    if (UI.showErr) UI.errors = validate(F.step);
  }

  // ---------- form: draft ----------
  let draftTimer;
  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      if (F.submitted) return;
      UI.draftSeen = true;
      savedAt = clock();
      store.set("draft", { ...F, files: F.files.map((f) => ({ name: f.name, size: f.size, desc: f.desc })), _at: savedAt });
      const s = $("#fill .saved span");
      if (s) s.innerHTML = `<span class="dot"></span> پیش‌نویس ذخیره شد، ${savedAt}`;
    }, 700);
  }

  // ---------- form: events ----------
  const fillRoot = $("#fill");
  const STRUCT = new Set(["type", "deputy", "dept", "prov", "city"]);
  const DIGITS_ONLY = new Set(["nid", "otp", "mobile"]);
  fillRoot.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.f && !STRUCT.has(t.dataset.f) && t.type !== "radio") {
      let v = t.value;
      if (DIGITS_ONLY.has(t.dataset.f)) {
        v = fa(toEn(v).replace(/\D/g, ""));
        t.value = v;
      }
      F[t.dataset.f] = v;
      if (t.dataset.f === "otp") {
        const ok = toEn(v) === "1234";
        $("#otp-m").textContent = ok ? "✓ شماره تأیید شد." : v.length === 4 ? "کد نادرست است." : "";
        const blocking = policyChecks().some((c) => c[0] === "bad");
        $("#submit-btn").disabled = !ok || blocking;
        $("#submit-m").textContent = blocking ? "ابتدا مورد قواعد خرید را رفع کنید." : ok ? `درخواست و ${fa(allRows().length)} ردیف آیتم‌ها با هم در جدول‌ها ثبت می‌شوند.` : "کد تأیید را وارد کنید.";
      }
      if (t.dataset.f === "desc") t.closest(".fld").querySelector(".hint").textContent = `${fa(v.length)} از ۶۰۰ نویسه`;
      if (UI.showErr) {
        UI.errors = validate(F.step);
        const er = $("#e-" + t.dataset.f);
        if (er) {
          er.textContent = UI.errors[t.dataset.f] || "";
          t.closest(".fld").classList.toggle("bad", !!UI.errors[t.dataset.f]);
        }
      }
      saveDraft();
    }
    if (t.dataset.tq) {
      UI[t.dataset.tq].q = t.value.trim();
      UI[t.dataset.tq].page = 0;
      renderFill();
    }
    const fi = t.dataset.fdesc;
    if (fi != null) {
      F.files[+fi].desc = t.value;
      saveDraft();
    }
  });
  fillRoot.addEventListener("change", (e) => {
    const t = e.target;
    const k = t.dataset.f;
    if (k && (STRUCT.has(k) || t.type === "radio")) {
      F[k] = t.value;
      if (k === "deputy") {
        F.dept = "";
        F.approver = "";
      }
      if (k === "prov") F.city = "";
      liveRevalidate();
      renderFill();
      saveDraft();
    }
    if (t.matches("[data-files]")) {
      [...t.files].forEach((f) => F.files.push({ name: f.name, size: f.size, desc: "" }));
      renderFill();
      saveDraft();
    }
  });
  fillRoot.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || t.classList.contains("mk")) return;
    const act = t.dataset.act;
    if (t.dataset.goto) return goStep(+t.dataset.goto, +t.dataset.goto > F.step);
    if (t.dataset.sw) {
      F[t.dataset.sw] = !F[t.dataset.sw];
      liveRevalidate();
      renderFill();
      saveDraft();
      return;
    }
    if (t.dataset.help) return openPop(t, HELP[t.dataset.help]);
    if (t.dataset.cal) return openCal(t, F[t.dataset.cal], (v) => setField(t.dataset.cal, v));
    if (t.dataset.time) return openClock(t, F[t.dataset.time], (v) => setField(t.dataset.time, v));
    if (t.hasAttribute("data-people")) return openPeople(t);
    if (t.dataset.focus) return $("#f-" + t.dataset.focus)?.focus();
    if (t.dataset.add) return openRowDialog(t.dataset.add);
    if (t.dataset.edit) {
      const [k, id] = t.dataset.edit.split(":");
      return openRowDialog(k, F[k].find((r) => r.id === id));
    }
    if (t.dataset.del) {
      const [k, id] = t.dataset.del.split(":");
      F[k] = F[k].filter((r) => r.id !== id);
      renderFill();
      saveDraft();
      return toast("ردیف حذف شد.");
    }
    if (t.dataset.sort) {
      const [k, key] = t.dataset.sort.split(":");
      const cur = UI[k].sort;
      UI[k].sort = cur && cur[0] === key ? (cur[1] > 0 ? [key, -1] : null) : [key, 1];
      return renderFill();
    }
    if (t.dataset.page) {
      const [k, d] = t.dataset.page.split(":");
      UI[k].page = Math.max(0, UI[k].page + +d);
      return renderFill();
    }
    if (t.dataset.excel) return openExcel(t.dataset.excel);
    if (t.dataset.api) return openApi(t.dataset.api);
    if (t.dataset.ai) return openAiFill(t.dataset.ai);
    if (t.dataset.frm != null) {
      F.files.splice(+t.dataset.frm, 1);
      return renderFill();
    }
    if (t.dataset.rate) {
      F.rating = +t.dataset.rate;
      return renderFill();
    }
    const A = {
      next: () => goStep(F.step + 1),
      prev: () => goStep(F.step - 1, false),
      cancel: () => openModal("لغو فرم", `<p>پاسخ‌ها به‌صورت پیش‌نویس ذخیره شده‌اند. با لغو، فرم بسته می‌شود و بعداً از همان‌جا ادامه پیدا می‌کند.</p><p class="hint">برای دکمه‌ی «لغو» هر فرم تعیین می‌شود پس از کلیک چه اتفاقی بیفتد: بستن فرم، برگشت به صفحه‌ی قبل یا رفتن به یک نشانی.</p>`, `<button class="btn" data-x>ماندن در فرم</button>`),
      later: () => {
        saveDraft();
        openModal("ادامه در زمانی دیگر", `<p>پیش‌نویس ذخیره شد. لینک ادامه به شماره‌ی ${esc(F.mobile)} پیامک شد و ۳۰ روز معتبر است.</p><p class="hint">در این نمایش، پیش‌نویس در همین مرورگر نگه داشته می‌شود؛ صفحه را دوباره باز کنید تا پیشنهاد ادامه را ببینید.</p>`);
      },
      resume: () => {
        const d = bootDraft;
        if (d) F = { ...fresh(), ...d, files: d.files || [] };
        UI.draftSeen = true;
        renderFill();
        toast("از همان‌جا که مانده بودید ادامه دهید.");
      },
      discard: () => {
        store.del("draft");
        UI.draftSeen = true;
        renderFill();
      },
      rules: () => toast("آیین‌نامه در زبانه‌ی تازه باز می‌شود."),
      sigclear: () => {
        F.signed = false;
        renderFill();
      },
      copyprev: () => {
        Object.assign(F, { desc: "تأمین خدمات پشتیبانی و نگهداری سامانه‌های صورتحساب برای سال ۱۴۰۶", prov: "تهران", city: "تهران", recv: "انبار مرکزی، ساختمان شماره‌ی ۲" });
        liveRevalidate();
        renderFill();
        saveDraft();
        toast("۴ فیلد از درخواست اخ-۱۴۰۵-۰۴۱۲ پر شد (Set Value).");
      },
      recheck: () => renderFill(),
      dupok: () => {
        F.dupOk = true;
        renderFill();
      },
      seedup: () => toast("درخواست اخ-۱۴۰۵-۰۴۱۲ در پنجره‌ی کناری باز می‌شود."),
      submit: () => doSubmit(),
      copyno: async () => {
        try {
          await navigator.clipboard.writeText(F.submitted.no);
          toast("شماره‌ی پیگیری کپی شد.");
        } catch {
          toast("شماره‌ی پیگیری: " + F.submitted.no);
        }
      },
      editsub: () => {
        F.submitted = null;
        F.step = 1;
        F.otp = "";
        renderFill();
        toast("درخواست تا پیش از بررسی مدیر قابل ویرایش است.");
      },
      seepdf: () => showDemo("pdf"),
      seeinbox: () => showDemo("inbox"),
      newreq: () => resetForm(),
    };
    if (A[act]) A[act]();
  });
  function setField(k, v) {
    F[k] = v;
    liveRevalidate();
    renderFill();
    saveDraft();
  }
  async function doSubmit() {
    const btn = $("#submit-btn");
    const m = $("#submit-m");
    btn.disabled = true;
    const n = allRows().length;
    const tables = visibleTables().filter((k) => F[k].length);
    for (const line of [`بررسی ${fa(n)} ردیف…`, "ثبت درخواست…", `ثبت ${fa(n)} ردیف در ${fa(tables.length)} جدول…`]) {
      m.innerHTML = `<span class="spin"></span> ${line}`;
      await later(calm ? 150 : 550);
    }
    finishSubmit();
  }
  function finishSubmit() {
    const no = "اخ-۱۴۰۵-" + fa(String(427 + SUBMITTED.length).padStart(4, "0"));
    F.submitted = {
      no,
      parts: visibleTables().filter((k) => F[k].length).map((k) => [TABLES[k].n, F[k].length]),
      toDeputy: (totalsBy(allRows())["ریال"] || 0) > RIAL_LIMIT,
    };
    SUBMITTED.unshift(snapshot());
    store.del("draft");
    renderFill();
  }
  function snapshot() {
    const dep = DEPUTIES[F.deputy];
    return {
      no: F.submitted.no, by: fullName(), dept: F.dept, deputy: dep ? dep.n : "", approver: F.approver, type: TYPES[F.type], date: "۱۴۰۵/۰۸/۰۳", subject: F.subject,
      rows: visibleTables().flatMap((k) => F[k].map((r) => ({ ...r, table: TABLES[k].n }))), totals: totalsBy(allRows()), desc: F.desc, city: F.city, recv: F.recv,
      chain: [["ثبت درخواست", "done", fullName()], ["بررسی مدیر", "cur", F.approver || "مدیر اداره کل"], ...(F.submitted.toDeputy ? [["تأیید معاون", "", dep ? dep.people.find((p) => p[1].startsWith("معاون"))?.[0] || "معاون" : "معاون"]] : []), ["تدارکات", "", "کارشناس خرید"]],
      log: [["ثبت شد", fullName(), "همین حالا"]], mine: true,
    };
  }
  function resetForm() {
    F = fresh();
    UI.errors = {};
    UI.showErr = false;
    UI.draftSeen = true;
    store.del("draft");
    savedAt = "";
    Object.keys(TABLES).forEach((k) => Object.assign(UI[k], { q: "", sort: null, page: 0 }));
    renderFill();
  }
  function fillSample() {
    Object.assign(F, {
      subject: "تأمین پشتیبانی سامانه‌ی صورتحساب", deputy: "it", dept: "اداره کل BSS", nid: "۰۰۷۸۴۰۲۱۹۰", approver: "حمید کریمی", needDate: "۱۴۰۵/۰۸/۲۵",
      desc: "تأمین خدمات پشتیبانی و نگهداری سامانه‌های صورتحساب برای سال ۱۴۰۶", prov: "تهران", city: "تهران", recv: "انبار مرکزی، ساختمان شماره‌ی ۲",
      install: true, visitTime: "۱۰:۳۰", installDate: "۱۴۰۵/۰۹/۰۵", files: [{ name: "مشخصات-فنی.pdf", size: 248000, desc: "مشخصات فنی پیشنهادی" }], signed: true,
    });
    if (!allRows().length) Object.assign(F, sampleRows());
  }
  $("#sample-btn").addEventListener("click", () => {
    if (F.submitted) resetForm();
    fillSample();
    UI.errors = {};
    UI.showErr = false;
    setView("demo");
    setPane("fill");
    renderFill();
    saveDraft();
    toast("فرم با داده‌ی نمونه پر شد.");
  });
  $("#reset-btn").addEventListener("click", () => {
    resetForm();
    toast("فرم از نو شروع شد.");
  });

  // ---------- pickers ----------
  const HELP = {
    type: `<b>نوع درخواست</b><ul><li><b>کالای تخصصی / خدمات:</b> تجهیزات شبکه، نرم‌افزار، پشتیبانی و مشاوره.</li><li><b>کالای عمومی(اثاثیه و اموال):</b> میز، صندلی و تجهیزات اداری.</li><li><b>کالای عمومی(مکانیزاسیون):</b> رایانه، چاپگر و لوازم جانبی.</li></ul>`,
  };
  function openPeople(anchor) {
    const dep = DEPUTIES[F.deputy];
    if (!dep) return;
    const p = openPop(anchor, `<div class="hint">گروه: مدیران ${esc(dep.n)}</div><input class="inp" placeholder="جستجوی نام" id="pp-q" style="margin:6px 0"><div class="pop-list" id="pp-list"></div>`);
    const draw = (q = "") =>
      ($("#pp-list", p).innerHTML =
        dep.people
          .filter((x) => x[0].includes(q))
          .map((x) => `<button type="button" data-pp="${esc(x[0])}" aria-selected="${F.approver === x[0]}"><span class="av">${esc(x[0][0])}</span><span>${esc(x[0])}<br><span class="hint">${esc(x[1])}</span></span></button>`)
          .join("") || `<span class="hint">کسی پیدا نشد.</span>`);
    draw();
    $("#pp-q", p).focus();
    $("#pp-q", p).addEventListener("input", (e) => draw(e.target.value.trim()));
    p.addEventListener("click", (e) => {
      const n = e.target.closest("[data-pp]")?.dataset.pp;
      if (n) {
        closePop();
        setField("approver", n);
      }
    });
  }
  const MONTHS = [
    { m: 8, n: "آبان", g: [2026, 9, 23], days: 30 },
    { m: 9, n: "آذر", g: [2026, 10, 22], days: 30 },
    { m: 10, n: "دی", g: [2026, 11, 22], days: 30 },
  ];
  function openCal(anchor, value, done) {
    let mi = 0;
    const cur = jdate(value ?? "");
    if (cur) mi = Math.max(0, MONTHS.findIndex((x) => x.m === Math.floor((cur % 10000) / 100)));
    const p = openPop(anchor, `<div id="cal-box"></div><span class="hint">عدد کوچک: تاریخ میلادی</span>`);
    const draw = () => {
      const M = MONTHS[mi];
      const first = new Date(M.g[0], M.g[1], M.g[2]);
      const leadDays = (first.getDay() + 1) % 7;
      let cells = "";
      for (let i = 0; i < leadDays; i++) cells += "<span></span>";
      for (let d = 1; d <= M.days; d++) {
        const g = new Date(M.g[0], M.g[1], M.g[2] + d - 1);
        const code = 14050000 + M.m * 100 + d;
        cells += `<button type="button" data-day="${d}" class="${code === TODAY ? "today" : ""}" aria-label="${fa(d)} ${M.n}">${fa(d)}<small>${g.getDate()}/${g.getMonth() + 1}</small></button>`;
      }
      $("#cal-box", p).innerHTML = `<div class="cal-h"><button type="button" class="icon-btn" data-mv="-1" ${mi === 0 ? "disabled" : ""} aria-label="ماه قبل">‹</button>${M.n} ۱۴۰۵<button type="button" class="icon-btn" data-mv="1" ${mi === MONTHS.length - 1 ? "disabled" : ""} aria-label="ماه بعد">›</button></div><div class="cal">${"شیدسچپج".split("").map((x) => `<b>${x}</b>`).join("")}${cells}</div>`;
    };
    draw();
    p.addEventListener("click", (e) => {
      const mv = e.target.closest("[data-mv]")?.dataset.mv;
      if (mv) {
        mi = Math.max(0, Math.min(MONTHS.length - 1, mi + +mv));
        return draw();
      }
      const d = e.target.closest("[data-day]")?.dataset.day;
      if (d) {
        closePop();
        done(`۱۴۰۵/${fa(pad(MONTHS[mi].m))}/${fa(pad(d))}`);
      }
    });
  }

  // circular clock: outer ring 1–12, inner ring 13–00, then minutes (and seconds) in steps of 5
  function openClock(anchor, value, done, { seconds = false } = {}) {
    const parts = toEn(value || "").split(":").map((x) => (x === "" ? null : +x));
    let h = Number.isFinite(parts[0]) ? parts[0] : null;
    let m = Number.isFinite(parts[1]) ? parts[1] : null;
    let s = seconds ? (Number.isFinite(parts[2]) ? parts[2] : 0) : null;
    let mode = "h";
    const R = 112,
      OUT = 88,
      IN = 58;
    const p = openPop(anchor, `<div class="clk" id="clk"></div>`, 264);
    const pos = (deg, r) => {
      const a = (deg * Math.PI) / 180;
      return [R + r * Math.sin(a), R - r * Math.cos(a)];
    };
    const draw = () => {
      const show = (v) => (v == null ? "--" : fa(pad(v)));
      let nums = "",
        handDeg = null,
        handLen = OUT;
      if (mode === "h") {
        for (let i = 1; i <= 12; i++) {
          const [x, y] = pos((i % 12) * 30, OUT);
          nums += `<button type="button" class="clk-n" style="left:${x}px;top:${y}px" data-v="${i}" aria-pressed="${h === i}">${fa(i)}</button>`;
        }
        for (let i = 13; i <= 24; i++) {
          const v = i % 24;
          const [x, y] = pos((i % 12) * 30, IN);
          nums += `<button type="button" class="clk-n in" style="left:${x}px;top:${y}px" data-v="${v}" aria-pressed="${h === v}">${fa(pad(v))}</button>`;
        }
        if (h != null) {
          handDeg = (h % 12) * 30;
          handLen = h === 0 || h > 12 ? IN : OUT;
        }
      } else {
        const val = mode === "m" ? m : s;
        for (let i = 0; i < 60; i += 5) {
          const [x, y] = pos(i * 6, OUT);
          nums += `<button type="button" class="clk-n" style="left:${x}px;top:${y}px" data-v="${i}" aria-pressed="${val === i}">${fa(pad(i))}</button>`;
        }
        if (val != null) handDeg = val * 6;
      }
      const hand = handDeg == null ? "" : `<i class="clk-hand" style="height:${handLen}px;transform:rotate(${handDeg}deg)"></i>`;
      $("#clk", p).innerHTML = `<div class="clk-head"><button type="button" data-mode="h" aria-pressed="${mode === "h"}" aria-label="ساعت">${show(h)}</button>:<button type="button" data-mode="m" aria-pressed="${mode === "m"}" aria-label="دقیقه">${show(m)}</button>${seconds ? `:<button type="button" data-mode="s" aria-pressed="${mode === "s"}" aria-label="ثانیه">${show(s)}</button>` : ""}</div>
        <div class="clk-face" id="clk-face">${nums}${hand}<i class="clk-c"></i></div>
        <div class="clk-foot"><span class="hint">${mode === "h" ? "ساعت را انتخاب کنید" : mode === "m" ? "دقیقه را انتخاب کنید" : "ثانیه را انتخاب کنید"}</span><span style="display:flex;gap:6px"><button type="button" class="btn sm" data-clk="cancel">انصراف</button><button type="button" class="btn sm pri" data-clk="ok" ${h == null || m == null ? "disabled" : ""}>تأیید</button></span></div>`;
    };
    const setFrom = (v) => {
      if (mode === "h") h = v;
      else if (mode === "m") m = v;
      else s = v;
    };
    const next = () => {
      mode = mode === "h" ? "m" : mode === "m" && seconds ? "s" : mode;
    };
    const fromPointer = (e) => {
      const face = $("#clk-face", p);
      const r = face.getBoundingClientRect();
      const dx = e.clientX - (r.left + R),
        dy = e.clientY - (r.top + R);
      const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
      const idx = Math.round(deg / 30) % 12;
      if (mode === "h") {
        const inner = Math.hypot(dx, dy) < (OUT + IN) / 2;
        h = inner ? (idx === 0 ? 0 : idx + 12) : idx === 0 ? 12 : idx;
      } else setFrom(idx * 5);
      draw();
    };
    let dragging = false;
    p.addEventListener("pointerdown", (e) => {
      if (!e.target.closest("#clk-face")) return;
      e.preventDefault();
      dragging = true;
      fromPointer(e);
    });
    p.addEventListener("pointermove", (e) => dragging && fromPointer(e));
    p.addEventListener("pointerup", () => {
      if (!dragging) return;
      dragging = false;
      // after the click that follows this pointerup has landed, move on to the next ring
      setTimeout(() => {
        next();
        draw();
      }, 0);
    });
    p.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.mode) {
        mode = b.dataset.mode;
        return draw();
      }
      if (b.dataset.v != null && e.detail === 0) {
        setFrom(+b.dataset.v);
        next();
        return draw();
      }
      if (b.dataset.clk === "cancel") return closePop();
      if (b.dataset.clk === "ok") {
        closePop();
        done(fa(pad(h) + ":" + pad(m) + (seconds ? ":" + pad(s ?? 0) : "")));
      }
    });
    draw();
  }

  // ---------- signature ----------
  function bindSignature() {
    const c = $("#sig");
    if (!c) return;
    const ratio = devicePixelRatio || 1;
    const ctx = c.getContext("2d");
    // sized lazily: the canvas has no width while the demo view is hidden
    const fit = () => {
      if (!c.clientWidth || c.width === Math.round(c.clientWidth * ratio)) return;
      c.width = Math.round(c.clientWidth * ratio);
      c.height = Math.round(c.clientHeight * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = getComputedStyle(document.body).color;
      if (F.signed) {
        ctx.beginPath();
        ctx.moveTo(30, 80);
        ctx.bezierCurveTo(60, 20, 90, 110, 120, 50);
        ctx.bezierCurveTo(140, 20, 170, 90, 210, 60);
        ctx.stroke();
      }
    };
    fit();
    c.addEventListener("pointerenter", fit);
    let down = false;
    const at = (e) => {
      const r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    c.addEventListener("pointerdown", (e) => {
      fit();
      down = true;
      c.setPointerCapture(e.pointerId);
      ctx.beginPath();
      ctx.moveTo(...at(e));
    });
    c.addEventListener("pointermove", (e) => {
      if (!down) return;
      ctx.lineTo(...at(e));
      ctx.stroke();
    });
    c.addEventListener("pointerup", () => {
      down = false;
      if (!F.signed) {
        F.signed = true;
        const hnt = c.parentElement.querySelector(".hint");
        if (hnt) hnt.textContent = "امضا ثبت شد.";
        saveDraft();
      }
    });
  }

  // ---------- row dialog ----------
  const UNITS = { svc: ["نفرساعت", "نفرروز", "ماه", "پروژه", "عدد"], spec: ["عدد", "دستگاه", "بسته", "متر"], gen: ["عدد", "دستگاه", "بسته", "متر"] };
  const LEAD = { k: "lead", n: "زمان مطلوب تامین", t: "num" };
  const LEADU = { k: "leadUnit", n: "واحد زمان تامین", t: "select", opts: ["روز", "هفته", "ماه"] };
  function rowFields(k) {
    const qty = { k: "qty", n: "تعداد", t: "num", req: true, demo: "number", hint: "فقط عدد صحیح" };
    const unit = { k: "unit", n: "واحد اندازه گیری", t: "select", opts: UNITS[k], req: true };
    const price = { k: "price", n: "قیمت براوردی(واحد)", t: "money", req: true };
    const cur = { k: "cur", n: "نوع ارز", t: "select", opts: CURR, req: true };
    if (k === "svc")
      return [
        { k: "catalogId", n: "خدمات", t: "catalog", req: true, show: (v) => !v.free, demo: "catalog", wide: true },
        { k: "free", n: "خدمات مورد نظر در لیست فوق وجود ندارد.", t: "switch" },
        { k: "title", n: "توضیح خدمات", t: "text", req: true, show: (v) => v.free, wide: true },
        { ...unit, show: (v) => v.free },
        { k: "start", n: "تاریخ شروع خدمات", t: "date", req: true },
        { k: "end", n: "تاریخ پایان خدمات", t: "date", req: true, demo: "daterule" },
        { k: "country", n: "آیا در خصوص کشور مبدا تامین کننده خدمات، ملاحظه ای وجود دارد؟", t: "select", opts: ["خیر", "بله"], wide: true },
        { k: "countryNote", n: "شرح ملاحظه", t: "textarea", req: true, show: (v) => v.country === "بله", wide: true },
        { t: "section", n: "ادامه سوالات" },
        qty, price, cur, LEAD, LEADU,
      ];
    if (k === "spec")
      return [
        { k: "title", n: "نام کالا", t: "text", req: true, wide: true },
        qty, unit, price, cur, LEAD, LEADU,
        { k: "note", n: "توضیحات", t: "textarea", wide: true },
        { t: "section", n: "ادامه سوالات" },
        { k: "auth", n: "نیاز به اصالت سنجی", t: "switch" },
        { k: "spare", n: "آیا تجهیزات یدکی مورد نیاز است", t: "switch" },
        { k: "nonOrig", n: "پذیرش کالای غیر اصل", t: "switch" },
        { k: "eos", n: "آیا تجهیزات End of Sale است ؟", t: "switch" },
      ];
    return [{ k: "title", n: "شرح کالا", t: "text", req: true, wide: true }, qty, unit, price, cur, { k: "note", n: "توضیحات", t: "textarea", wide: true }];
  }
  function rowRules(v, k) {
    const e = {};
    if (k === "svc") {
      const a = jdate(v.start),
        b = jdate(v.end);
      if (v.start && !a) e.start = "تاریخ را به شکل ۱۴۰۵/۰۹/۰۱ وارد کنید.";
      if (v.end && !b) e.end = "تاریخ را به شکل ۱۴۰۵/۰۹/۰۱ وارد کنید.";
      if (a && b && b < a) e.end = "تاریخ پایان خدمات باید بعد از تاریخ شروع خدمات باشد.";
    }
    const q = num(v.qty);
    if (v.qty !== "" && v.qty != null && (!Number.isInteger(q) || q < 1)) e.qty = "تعداد باید عدد صحیح و دست‌کم ۱ باشد.";
    if (v.price !== "" && v.price != null && !(num(v.price) > 0)) e.price = "قیمت باید بیشتر از صفر باشد.";
    return e;
  }
  function openRowDialog(k, existing, preset) {
    const v = existing ? { ...existing } : { qty: "", unit: UNITS[k][0], price: "", cur: "ریال", country: "خیر", leadUnit: "هفته", ...(preset || {}) };
    const fields = rowFields(k);
    let showErr = false;
    const fieldHtml = (f) => {
      if (f.t === "section") return `<div style="grid-column:1/-1;font-weight:700;color:var(--ink2);background:var(--soft);border:1px solid var(--line);border-radius:8px;padding:4px 10px">${esc(f.n)}</div>`;
      const id = "d-" + f.k;
      let inner;
      if (f.t === "text") inner = `<input class="inp" id="${id}" data-d="${f.k}" value="${esc(v[f.k] ?? "")}">`;
      if (f.t === "textarea") inner = `<textarea class="inp" id="${id}" data-d="${f.k}">${esc(v[f.k] ?? "")}</textarea>`;
      if (f.t === "num") inner = `<input class="inp" id="${id}" data-d="${f.k}" data-num inputmode="numeric" value="${esc(v[f.k] == null || v[f.k] === "" ? "" : fa(v[f.k]))}">`;
      if (f.t === "money") inner = `<input class="inp" id="${id}" data-d="${f.k}" data-money inputmode="numeric" value="${v.price ? money(num(v.price)) : ""}">`;
      if (f.t === "select") inner = `<select class="inp" id="${id}" data-d="${f.k}">${f.opts.map((o) => `<option ${o === v[f.k] ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
      if (f.t === "switch") inner = `<button type="button" class="swline" role="switch" aria-checked="${!!v[f.k]}" id="${id}" data-dsw="${f.k}"><span class="sw"></span>${esc(f.n)}</button>`;
      if (f.t === "date") inner = `<div style="display:flex;gap:6px"><input class="inp" id="${id}" data-d="${f.k}" value="${esc(v[f.k] ?? "")}" placeholder="۱۴۰۵/۰۹/۰۱" inputmode="numeric"><button type="button" class="btn sm" data-dcal="${f.k}">تقویم</button></div>`;
      if (f.t === "catalog")
        inner = `<select class="inp" id="${id}" data-d="catalogId"><option value="">انتخاب از فهرست خدمات</option>${SERVICES.map((s) => `<option value="${s.id}" ${s.id === v.catalogId ? "selected" : ""}>${esc(s.n)}</option>`).join("")}</select><span class="hint" id="d-lookup"></span>`;
      return `<div class="fld" data-dk="${f.k}" ${f.demo ? `data-demo="${f.demo}"` : ""} style="${f.wide || f.t === "switch" ? "grid-column:1/-1" : ""}">${f.t === "switch" ? "" : `<label for="${id}">${esc(f.n)}${f.req ? ' <span class="req">*</span>' : ""}</label>`}${inner}${f.hint ? `<span class="hint">${f.hint}</span>` : ""}<span class="err" data-de="${f.k}"></span></div>`;
    };
    const m = openModal(
      TABLES[k].n,
      `<div class="row" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">${fields.map(fieldHtml).join("")}</div><div class="calc" data-demo="linetotal" id="d-total" aria-live="polite"></div>`,
      `<button class="btn pri" data-save>تایید</button><button class="btn" data-x>انصراف</button>`,
    );
    const requiredErrs = () => {
      const e = {};
      fields.forEach((f) => {
        if (!f.req || (f.show && !f.show(v))) return;
        const val = v[f.k];
        if (val == null || String(val).trim() === "") e[f.k] = `«${f.n}» را پر کنید.`;
      });
      return e;
    };
    const refresh = () => {
      fields.forEach((f) => {
        if (!f.k) return;
        const w = $(`[data-dk="${f.k}"]`, m);
        if (w) w.hidden = f.show ? !f.show(v) : false;
      });
      const item = SERVICES.find((s) => s.id === v.catalogId);
      const lk = $("#d-lookup", m);
      if (lk) lk.textContent = item ? `واحد اندازه گیری: ${item.unit}، قیمت مرجع: ${money(item.price)} ریال` : "";
      const tot = lineTotal(v);
      $("#d-total", m).innerHTML = `<span>مبلغ براوردی این ردیف (تعداد × قیمت براوردی)</span><b>${num(v.qty) && num(v.price) ? `${fa(v.qty)} × ${money(num(v.price))} = ${money(tot)} ${esc(v.cur)}` : "—"}</b>`;
      const errs = showErr ? { ...requiredErrs(), ...rowRules(v, k) } : rowRules(v, k);
      $$("[data-de]", m).forEach((el) => {
        const msg = errs[el.dataset.de] || "";
        el.textContent = msg;
        el.closest(".fld").classList.toggle("bad", !!msg);
      });
    };
    m.addEventListener("input", (e) => {
      const t = e.target;
      const key = t.dataset.d;
      if (!key) return;
      if (t.hasAttribute("data-num")) {
        const raw = toEn(t.value).replace(/\D/g, "");
        if (raw !== toEn(t.value)) toast("این فیلد فقط عدد می‌پذیرد.");
        t.value = fa(raw);
        v[key] = raw === "" ? "" : +raw;
      } else if (t.hasAttribute("data-money")) {
        const raw = toEn(t.value).replace(/\D/g, "");
        t.value = raw ? money(+raw) : "";
        v[key] = raw === "" ? "" : +raw;
      } else v[key] = t.value;
      refresh();
    });
    m.addEventListener("change", (e) => {
      const key = e.target.dataset.d;
      if (!key) return;
      v[key] = e.target.value;
      if (key === "catalogId") {
        const item = SERVICES.find((s) => s.id === v.catalogId);
        if (item) {
          v.unit = item.unit;
          v.title = item.n;
          if (!v.price) {
            v.price = item.price;
            const p = $("#d-price", m);
            if (p) p.value = money(item.price);
          }
        }
      }
      refresh();
    });
    m.addEventListener("click", (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.dataset.dsw) {
        v[t.dataset.dsw] = !v[t.dataset.dsw];
        t.setAttribute("aria-checked", String(!!v[t.dataset.dsw]));
        refresh();
      }
      if (t.dataset.dcal) {
        openCal(t, v[t.dataset.dcal], (val) => {
          v[t.dataset.dcal] = val;
          $("#d-" + t.dataset.dcal, m).value = val;
          refresh();
        });
      }
      if (t.hasAttribute("data-save")) {
        showErr = true;
        const errs = { ...requiredErrs(), ...rowRules(v, k) };
        refresh();
        if (Object.keys(errs).length) return;
        const clean = { ...v, qty: num(v.qty), price: num(v.price), lead: v.lead === "" ? "" : v.lead };
        if (k === "svc" && !clean.free) clean.title = SERVICES.find((s) => s.id === clean.catalogId)?.n || clean.title;
        if (existing) F[k] = F[k].map((r) => (r.id === existing.id ? { ...clean } : r));
        else F[k].push(row(clean));
        closeModal();
        UI.errors = UI.showErr ? validate(F.step) : {};
        renderFill();
        saveDraft();
        toast(existing ? "ردیف ویرایش شد." : "ردیف به جدول اضافه شد.");
      }
    });
    refresh();
    return { m, v, refresh, forceErrors: () => ((showErr = true), refresh()) };
  }

  // ---------- Excel upload ----------
  const EXCEL_SAMPLE = {
    svc: [
      ["آموزش کاربران", "۱۰", "نفرروز", "25000000", "ریال", "۱۴۰۵/۰۹/۰۱", "۱۴۰۵/۰۹/۳۰"],
      ["نگهداری زیرساخت", "12", "ماه", "320000000", "ریال", "۱۴۰۶/۰۱/۰۱", "۱۴۰۶/۱۲/۲۹"],
      ["مشاوره‌ی امنیت", "ده", "نفرساعت", "6000000", "ریال", "۱۴۰۵/۱۰/۰۱", "۱۴۰۵/۱۰/۳۰"],
      ["پشتیبانی سامانه‌ی صورتحساب", "200", "نفرساعت", "4500000", "ریال", "۱۴۰۵/۱۲/۰۱", "۱۴۰۵/۱۱/۰۱"],
    ],
    spec: [["ماژول نوری ۱۰ گیگ", "24", "عدد", "180", "یورو"], ["کارت خط ۴۸ پورت", "4", "عدد", "نامشخص", "یورو"], ["کابل پچ فیبر", "100", "عدد", "12", "دلار"]],
    gen: [["صندلی اداری", "12", "عدد", "42000000", "ریال"], ["میز کار", "6", "عدد", "68000000", "روپیه"]],
  };
  const norm = (s) => toEn(s).replace(/\s+/g, "").replace(/[‌]/g, "");
  function checkRows(k, rows) {
    const head = TABLES[k].excel;
    if (rows.length && norm(rows[0][0]) === norm(head[0])) rows = rows.slice(1);
    return rows
      .filter((r) => r.some((c) => String(c).trim()))
      .map((c, i) => {
        const [title, qty, unit, price, cur, start, end] = c.map((x) => String(x ?? "").trim());
        const errs = [];
        if (!title) errs.push(`«${head[0]}» خالی است`);
        if (!/^\d+$/.test(toEn(qty)) || +toEn(qty) < 1) errs.push("تعداد باید عدد باشد");
        if (!(num(price) > 0) || /[^\d٬,.]/.test(toEn(price))) errs.push("قیمت باید عدد باشد");
        if (!CURR.includes(cur)) errs.push(`نوع ارز «${cur || "—"}» در فهرست نیست`);
        if (k === "svc") {
          const a = jdate(start),
            b = jdate(end);
          if (!a || !b) errs.push("تاریخ نادرست است");
          else if (b < a) errs.push("تاریخ پایان قبل از شروع است");
        }
        return { i: i + 1, errs, r: { title, qty: +toEn(qty), unit: unit || "عدد", price: num(price), cur, start, end, country: "خیر", free: true } };
      });
  }
  async function readSheet(file) {
    if (window.XLSX) {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
    }
    if (/\.csv$/i.test(file.name)) return (await file.text()).split(/\r?\n/).map((l) => l.split(/[,\t]/));
    throw new Error("xlsx-unavailable");
  }
  function sampleFile(k) {
    const aoa = [TABLES[k].excel, ...EXCEL_SAMPLE[k]];
    if (!window.XLSX) return { name: `نمونه-${TABLES[k].n}.xlsx`, rows: aoa };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "آیتم‌ها");
    const data = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const back = XLSX.read(data, { type: "array" });
    return { name: `نمونه-${TABLES[k].n}.xlsx`, rows: XLSX.utils.sheet_to_json(back.Sheets[back.SheetNames[0]], { header: 1, raw: false, defval: "" }) };
  }
  function openExcel(k, autoSample) {
    const cols = TABLES[k].excel;
    const canDownload = window.top === window && !!window.XLSX;
    const m = openModal(
      `بارگذاری Excel در جدول «${TABLES[k].n}»`,
      `<label class="drop" id="xl-drop">${ICON.up}<b>فایل Excel آیتم‌ها را این‌جا رها کنید</b><span class="hint">یا</span><span class="btn pri sm">انتخاب فایل<input type="file" id="xl-file" accept=".xlsx,.xls,.csv" hidden></span><span class="hint">ستون‌ها: ${cols.join("، ")}</span></label>
       <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" id="xl-sample">استفاده از فایل نمونه</button>${canDownload ? `<button class="btn sm" id="xl-tpl">دریافت قالب Excel</button>` : ""}</div>
       <div id="xl-out" aria-live="polite"></div>`,
      `<button class="btn pri" id="xl-add" disabled>افزودن ردیف‌های معتبر</button><button class="btn" data-x>انصراف</button>`,
    );
    let parsed = [];
    const show = (name, rows) => {
      parsed = checkRows(k, rows);
      const good = parsed.filter((p) => !p.errs.length);
      $("#xl-out", m).innerHTML = parsed.length
        ? `<p class="hint">فایل: ${esc(name)}، ${fa(parsed.length)} ردیف، ${fa(good.length)} معتبر</p><div class="tbl-scroll"><table><thead><tr><th>ردیف</th><th>${esc(cols[0])}</th><th>تعداد</th><th>قیمت</th><th>نوع ارز</th><th>نتیجه</th></tr></thead><tbody>${parsed
            .map((p) => `<tr><td class="n">${fa(p.i)}</td><td>${esc(p.r.title)}</td><td class="n">${fa(p.r.qty || "—")}</td><td class="n">${money(p.r.price)}</td><td>${esc(p.r.cur || "—")}</td><td>${p.errs.length ? `<span class="tag red">${esc(p.errs.join("، "))}</span>` : `<span class="tag green">معتبر</span>`}</td></tr>`)
            .join("")}</tbody></table></div>`
        : `<p class="hint">در فایل ردیفی پیدا نشد.</p>`;
      const add = $("#xl-add", m);
      add.disabled = !good.length;
      add.textContent = `افزودن ${fa(good.length)} ردیف معتبر`;
    };
    const load = async (file) => {
      if (!file) return;
      $("#xl-out", m).innerHTML = `<span class="spin"></span> در حال خواندن ${esc(file.name)}…`;
      try {
        show(file.name, await readSheet(file));
      } catch {
        $("#xl-out", m).innerHTML = `<p class="err">${window.XLSX ? "فایل خوانده نشد. یک فایل xlsx، xls یا csv انتخاب کنید." : "برای خواندن فایل Excel اتصال اینترنت لازم است. فایل csv بدون اینترنت هم خوانده می‌شود."}</p>`;
      }
    };
    $("#xl-file", m).addEventListener("change", (e) => load(e.target.files[0]));
    const drop = $("#xl-drop", m);
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.classList.add("over");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("over");
      load(e.dataTransfer.files[0]);
    });
    $("#xl-sample", m).addEventListener("click", () => {
      const f = sampleFile(k);
      show(f.name, f.rows);
    });
    $("#xl-tpl", m)?.addEventListener("click", () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cols]), "آیتم‌ها");
      XLSX.writeFile(wb, `قالب-${TABLES[k].n}.xlsx`);
    });
    $("#xl-add", m).addEventListener("click", () => {
      const good = parsed.filter((p) => !p.errs.length);
      good.forEach((p) => F[k].push(row(p.r)));
      closeModal();
      renderFill();
      saveDraft();
      toast(`${fa(good.length)} ردیف از Excel اضافه شد.`);
    });
    if (autoSample) $("#xl-sample", m).click();
  }

  // ---------- rows from contracts ----------
  const CONTRACTS = {
    "۱۴۰۴/۱۲۳": [["پشتیبانی سامانه‌ی صورتحساب", "نفرساعت", 4200000, 900], ["توسعه‌ی گزارش‌های مدیریتی", "نفرساعت", 5100000, 300], ["آموزش تیم عملیات", "نفرروز", 24000000, 20]],
    "۱۴۰۵/۰۴۱": [["نگهداری مرکز داده", "ماه", 310000000, 12], ["پایش امنیت", "ماه", 140000000, 12]],
  };
  function openApi(k) {
    const m = openModal(
      "دریافت از سامانه‌ی قراردادها",
      `<div class="fld"><label for="api-c">قرارداد</label><select class="inp" id="api-c"><option value="">انتخاب قرارداد</option>${Object.keys(CONTRACTS).map((c) => `<option>${c}</option>`).join("")}</select><span class="hint">با انتخاب قرارداد، اتوماسیون اقلام آن را از سامانه دریافت می‌کند (value change).</span></div><div id="api-out" aria-live="polite"></div>`,
      `<button class="btn pri" id="api-add" disabled>افزودن انتخاب‌شده‌ها</button><button class="btn" data-x>انصراف</button>`,
    );
    let list = [];
    $("#api-c", m).addEventListener("change", async (e) => {
      const c = e.target.value;
      if (!c) return;
      $("#api-out", m).innerHTML = `<span class="spin"></span> در حال دریافت از سامانه‌ی قراردادها…`;
      await later(calm ? 100 : 700);
      list = CONTRACTS[c];
      $("#api-out", m).innerHTML = `<div class="tbl-scroll"><table><thead><tr><th></th><th>قلم قرارداد</th><th>قیمت واحد</th><th>مانده</th><th>تعداد درخواستی</th></tr></thead><tbody>${list
        .map((x, i) => `<tr><td><input type="checkbox" data-apick="${i}" aria-label="انتخاب ${esc(x[0])}"></td><td>${esc(x[0])}</td><td class="n">${money(x[2])} ریال</td><td class="n">${fa(x[3])} ${esc(x[1])}</td><td><input class="inp" style="width:90px;min-height:28px" data-api-q="${i}" inputmode="numeric" value="${fa(Math.min(10, x[3]))}" aria-label="تعداد ${esc(x[0])}"></td></tr>`)
        .join("")}</tbody></table></div><span class="hint">تعداد بیشتر از مانده‌ی قرارداد پذیرفته نمی‌شود.</span>`;
    });
    m.addEventListener("change", (e) => {
      if (e.target.dataset.apick != null) $("#api-add", m).disabled = !$$("[data-apick]:checked", m).length;
    });
    $("#api-add", m).addEventListener("click", () => {
      let bad = false;
      $$("[data-apick]:checked", m).forEach((cb) => {
        const i = +cb.dataset.apick;
        const x = list[i];
        const q = num($(`[data-api-q="${i}"]`, m).value);
        if (!(q >= 1 && q <= x[3])) return (bad = true);
        F[k].push(row({ title: x[0], qty: q, unit: x[1], price: x[2], cur: "ریال", start: "۱۴۰۵/۰۹/۰۱", end: "۱۴۰۵/۱۲/۲۹", country: "خیر", free: true }));
      });
      if (bad) return toast("تعداد یک قلم بیشتر از مانده‌ی قرارداد است.");
      closeModal();
      renderFill();
      saveDraft();
      toast("اقلام قرارداد اضافه شدند.");
    });
  }

  // ---------- rows from an invoice ----------
  function openAiFill(k) {
    const m = openModal(
      "پر کردن از روی پیش‌فاکتور",
      `<div class="invoice" aria-label="پیش‌فاکتور نمونه"><b>پیش‌فاکتور شماره‌ی ۴۴۱۸، شرکت نمونه‌ی تجهیزات شبکه</b><span>۱) روتر لبه، مدل نمونه ۹۰۰ — ۲ دستگاه — ۲۲٬۵۰۰ یورو</span><span>۲) ماژول نوری ۱۰ گیگ — ۲۴ عدد — ۱۸۰ یورو</span><span>۳) قرارداد پشتیبانی سه‌ساله — ۱ — ۹٬۸۰۰ یورو (ناخوانا)</span></div>
       <div><button class="btn pri" id="ai-read">خواندن پیش‌فاکتور</button></div><div id="ai-res" aria-live="polite"></div>`,
      `<button class="btn pri" id="ai-add" disabled>افزودن به ${esc(TABLES[k].n)}</button><button class="btn" data-x>انصراف</button>`,
    );
    const items = [
      { title: "روتر لبه، مدل نمونه ۹۰۰", qty: 2, unit: "دستگاه", price: 22500, cur: "یورو", c: 98 },
      { title: "ماژول نوری ۱۰ گیگ", qty: 24, unit: "عدد", price: 180, cur: "یورو", c: 96 },
      { title: "قرارداد پشتیبانی سه‌ساله", qty: 1, unit: "بسته", price: 9800, cur: "یورو", c: 71 },
    ];
    $("#ai-read", m).addEventListener("click", async () => {
      $("#ai-res", m).innerHTML = `<span class="spin"></span> در حال خواندن…`;
      await later(calm ? 100 : 900);
      $("#ai-res", m).innerHTML = `<p class="hint">ردیف‌های پیشنهادی؛ پیش از افزودن بازبینی کنید.</p><div class="tbl-scroll"><table><thead><tr><th></th><th>نام کالا</th><th>تعداد</th><th>قیمت براوردی(واحد)</th><th>اطمینان</th></tr></thead><tbody>${items
        .map((x, i) => `<tr><td><input type="checkbox" data-aip="${i}" ${x.c > 90 ? "checked" : ""} aria-label="انتخاب ${esc(x.title)}"></td><td>${esc(x.title)}</td><td class="n">${fa(x.qty)} ${esc(x.unit)}</td><td class="n">${money(x.price)} ${esc(x.cur)}</td><td><span class="tag ${x.c > 90 ? "green" : "yellow"}">${fa(x.c)}٪${x.c > 90 ? "" : "، بازبینی کنید"}</span></td></tr>`)
        .join("")}</tbody></table></div>`;
      $("#ai-add", m).disabled = false;
    });
    $("#ai-add", m).addEventListener("click", () => {
      const chosen = $$("[data-aip]:checked", m).map((cb) => items[+cb.dataset.aip]);
      chosen.forEach((x) => F[k].push(row({ ...x, auth: true, eos: false })));
      closeModal();
      renderFill();
      saveDraft();
      toast(`${fa(chosen.length)} ردیف از پیش‌فاکتور اضافه شد.`);
    });
  }

  // ---------- designer pane ----------
  const BT = {
    pr: [["عنوان درخواست", "متن"], ["نوع درخواست", "تک‌انتخابی"], ["معاونت", "پیوند به جدول معاونت‌ها"], ["اداره کل", "پیوند به جدول ادارات کل"], ["تأییدکننده", "انتخاب افراد"], ["تاریخ نیاز", "تاریخ"], ["خدمات", "جدول ورود داده"], ["کالای تخصصی", "جدول ورود داده"], ["شرح درخواست", "متن بلند"], ["پیوست‌ها", "پیوست"]],
    sup: [["نام شرکت", "متن"], ["شناسه‌ی ملی", "متن"], ["شماره‌ی شبا", "شبا"], ["استان", "تک‌انتخابی"], ["حوزه‌ی فعالیت", "چندانتخابی"], ["رتبه", "Rating"], ["مدارک", "پیوست"]],
    lv: [["نوع مرخصی", "تک‌انتخابی"], ["تاریخ شروع", "تاریخ"], ["تاریخ پایان", "تاریخ"], ["جانشین", "انتخاب افراد"], ["توضیحات", "متن بلند"]],
  };
  $("#bt-go").addEventListener("click", async () => {
    const out = $("#bt-out");
    out.innerHTML = `<li><span class="spin"></span> در حال ساخت فرم…</li>`;
    await later(calm ? 50 : 500);
    const list = BT[$("#bt-table").value];
    out.innerHTML = list.map(([n, t]) => `<li><span>${esc(n)}</span><span class="tag gray">${esc(t)}</span></li>`).join("") + `<li><span>فرم با ${fa(list.length)} فیلد ساخته شد.</span><span class="tag green">آماده‌ی ویرایش</span></li>`;
  });
  const guessType = (s) =>
    /تاریخ/.test(s) ? "تاریخ" : /تعداد|مبلغ|قیمت|مدت/.test(s) ? "عدد" : /پیوست|فایل|گواهی|تصویر/.test(s) ? "پیوست" : /نوع|وضعیت|سطح/.test(s) ? "تک‌انتخابی" : /جانشین|همکار|تأییدکننده|مدیر/.test(s) ? "انتخاب افراد" : /توضیح|شرح/.test(s) ? "متن بلند" : "متن";
  $("#ai-go").addEventListener("click", async () => {
    const out = $("#ai-out");
    out.innerHTML = `<span class="spin"></span> در حال آماده کردن پیشنهاد…`;
    await later(calm ? 50 : 800);
    const text = $("#ai-prompt").value;
    const parts = (text.split(/[:：]/)[1] || text).split(/[،,]| و /).map((x) => x.trim()).filter(Boolean);
    const rules = [];
    if (/استعلاجی|پزشکی/.test(text)) rules.push("«پیوست گواهی پزشکی» فقط وقتی «نوع مرخصی» = استعلاجی، اجباری است.");
    if (/شروع/.test(text) && /پایان/.test(text)) rules.push("«تاریخ پایان» باید بعد از «تاریخ شروع» باشد.");
    out.innerHTML = `<ul class="flist">${parts.map((p) => `<li><span>${esc(p.replace(/ از .*/, ""))}</span><span class="tag gray">${guessType(p)}</span></li>`).join("")}</ul>${rules.length ? `<b style="font-size:13px">قاعده‌های پیشنهادی</b><ul class="flist">${rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}<p class="hint">طراح فرم پیش از ساخت، پیشنهاد را تأیید یا ویرایش می‌کند.</p>`;
  });
  $("#ai-paper").addEventListener("click", async () => {
    const out = $("#ai-out");
    out.innerHTML = `<div class="invoice"><b>فرم کاغذی «درخواست تعمیرات» (تصویر نمونه)</b><span>نام واحد: ______ تاریخ: __/__/____</span><span>شرح خرابی: ____________________</span><span>فوریت: □ عادی □ فوری □ بحرانی &nbsp; امضای مدیر: ______</span></div><span class="spin"></span> در حال خواندن…`;
    await later(calm ? 50 : 900);
    out.innerHTML = `<ul class="flist">${[["نام واحد", "پیوند به جدول واحدها"], ["تاریخ", "تاریخ"], ["شرح خرابی", "متن بلند"], ["فوریت", "Radio Buttons: عادی، فوری، بحرانی"], ["امضای مدیر", "امضا"]]
      .map(([a, b]) => `<li><span>${a}</span><span class="tag gray">${b}</span></li>`)
      .join("")}</ul><p class="hint">«نام واحد» به جدول «واحدها» پیوند داده شد.</p>`;
  });

  // rules editor
  const R_FIELDS = { type: "نوع درخواست", total: "جمع ریالی", country: "ملاحظه درباره‌ی کشور مبدا" };
  const R_ACTS = ["پنهان کن", "نمایش بده", "اجباری کن", "غیرفعال کن", "مقدار بده"];
  const R_TARGETS = ["جدول کالای تخصصی", "جدول کالای عمومی", "شرح ملاحظه", "سطح تأیید", "کارشناس بازرگانی خارجی"];
  let RULES = [
    { f: "type", op: "=", val: "کالای عمومی", act: "پنهان کن", tgt: "جدول کالای تخصصی", set: "" },
    { f: "total", op: ">", val: "۵٬۰۰۰٬۰۰۰٬۰۰۰", act: "مقدار بده", tgt: "سطح تأیید", set: "معاون" },
    { f: "country", op: "=", val: "بله", act: "اجباری کن", tgt: "شرح ملاحظه", set: "" },
  ];
  function renderRules() {
    $("#rules").innerHTML = RULES.map(
      (r, i) => `<div class="rule" data-ri="${i}"><span class="kw">وقتی</span>
        <select data-r="f" aria-label="فیلد">${Object.entries(R_FIELDS).map(([k, n]) => `<option value="${k}" ${r.f === k ? "selected" : ""}>${n}</option>`).join("")}</select>
        <select data-r="op" aria-label="عملگر">${["=", ">", "<"].map((o) => `<option ${r.op === o ? "selected" : ""}>${o}</option>`).join("")}</select>
        <input data-r="val" value="${esc(r.val)}" aria-label="مقدار" size="12">
        <span class="kw">آنگاه</span>
        <select data-r="act" aria-label="اقدام">${R_ACTS.map((a) => `<option ${r.act === a ? "selected" : ""}>${a}</option>`).join("")}</select>
        <select data-r="tgt" aria-label="هدف">${R_TARGETS.map((a) => `<option ${r.tgt === a ? "selected" : ""}>${a}</option>`).join("")}</select>
        ${r.act === "مقدار بده" ? `<span>=</span><input data-r="set" value="${esc(r.set)}" aria-label="مقدار تازه" size="8">` : ""}
        <button class="icon-btn" data-rdel="${i}" aria-label="حذف قاعده">${ICON.del}</button></div>`,
    ).join("");
    testRules();
  }
  function testRules() {
    const ctx = { type: $("#rt-type").value, total: num($("#rt-total").value), country: $("#rt-country").value };
    const fired = RULES.filter((r) => {
      const a = ctx[r.f];
      const b = r.f === "total" ? num(r.val) : r.val;
      if (r.op === "=") return r.f === "total" ? a === b : String(a).includes(String(b));
      if (r.op === ">") return num(a) > num(b);
      return num(a) < num(b);
    });
    $("#rt-out").innerHTML = fired.length
      ? fired.map((r) => `<div class="chk ok"><span class="ic">✓</span><span>${esc(r.tgt)}: <b>${esc(r.act)}${r.act === "مقدار بده" ? " «" + esc(r.set) + "»" : ""}</b></span></div>`).join("")
      : `<span class="hint">با این ورودی‌ها هیچ قاعده‌ای اجرا نمی‌شود.</span>`;
  }
  $("#rules").addEventListener("change", (e) => {
    const w = e.target.closest("[data-ri]");
    if (!w || !e.target.dataset.r) return;
    RULES[+w.dataset.ri][e.target.dataset.r] = e.target.value;
    renderRules();
  });
  $("#rules").addEventListener("input", (e) => {
    const w = e.target.closest("[data-ri]");
    if (!w || e.target.tagName !== "INPUT") return;
    RULES[+w.dataset.ri][e.target.dataset.r] = e.target.value;
    testRules();
  });
  $("#rules").addEventListener("click", (e) => {
    const i = e.target.closest("[data-rdel]")?.dataset.rdel;
    if (i == null) return;
    RULES.splice(+i, 1);
    renderRules();
  });
  $("#rule-add").addEventListener("click", () => {
    RULES.push({ f: "type", op: "=", val: "کالای تخصصی", act: "نمایش بده", tgt: "جدول کالای تخصصی", set: "" });
    renderRules();
  });
  ["rt-type", "rt-country"].forEach((id) => $("#" + id).addEventListener("change", testRules));
  $("#rt-total").addEventListener("input", (e) => {
    const raw = toEn(e.target.value).replace(/\D/g, "");
    e.target.value = raw ? money(+raw) : "";
    testRules();
  });

  // display modes
  const DP = {
    bool: [["checkbox", "چک‌باکس"], ["switch", "Switch"]],
    single: [["dropdown", "فهرست کشویی"], ["vertical", "Radio Buttons عمودی"], ["horizontal", "Radio Buttons افقی"]],
    num: [["plain", "عدد"], ["stars", "Rating (ستاره)"], ["percent", "Progress Bar"]],
    dur: [["time", "Time Picker با ساعت دایره‌ای"], ["duration", "مدت زمان"]],
  };
  const dpState = { on: true, stars: 4, pct: 20, time: "", fmt: "hm" };
  function renderDisplay() {
    const t = $("#dp-type").value;
    const mode = $("#dp-mode").value;
    const out = $("#dp-out");
    const opts = ["کالای تخصصی / خدمات", "کالای عمومی(اثاثیه و اموال)", "کالای عمومی(مکانیزاسیون)"];
    if (t === "bool")
      out.innerHTML =
        mode === "switch"
          ? `<button type="button" class="swline" role="switch" aria-checked="${dpState.on}" data-dp="on"><span class="sw"></span>خدمات مورد نظر در لیست فوق وجود ندارد.</button>`
          : `<label class="pick"><input type="checkbox" data-dp="on" ${dpState.on ? "checked" : ""}> خدمات مورد نظر در لیست فوق وجود ندارد.</label>`;
    if (t === "single") {
      if (mode === "dropdown") out.innerHTML = `<label class="lbl" for="dp-sel">نوع درخواست</label><select class="inp" id="dp-sel">${opts.map((o) => `<option>${o}</option>`).join("")}</select>`;
      else out.innerHTML = `<span class="lbl">نوع درخواست</span><div class="radios ${mode === "vertical" ? "v" : ""}">${opts.map((o, i) => `<label><input type="radio" name="dpr" ${i === 0 ? "checked" : ""}> ${o}</label>`).join("")}</div>`;
    }
    if (t === "num") {
      if (mode === "stars") out.innerHTML = `<span class="lbl">ارزیابی تأمین‌کننده</span><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="${dpState.stars >= n ? "on" : ""}" data-dpstar="${n}" aria-label="${fa(n)} ستاره">★</button>`).join("")}</div>`;
      else if (mode === "percent") out.innerHTML = `<label class="lbl" for="dp-pct">درصد پیشرفت کار</label><input class="inp" id="dp-pct" inputmode="numeric" value="${fa(dpState.pct)}"><div class="pbar" style="height:12px;border-radius:4px;background:var(--bg);overflow:hidden;border:1px solid var(--line)"><i style="display:block;height:100%;width:${dpState.pct}%;background:var(--bar-ok)"></i></div><span class="hint">${fa(dpState.pct)}%</span>`;
      else out.innerHTML = `<label class="lbl" for="dp-num">تعداد</label><input class="inp" id="dp-num" inputmode="numeric" value="۴۰۰">`;
    }
    if (t === "dur")
      out.innerHTML =
        mode === "time"
          ? `<div class="row"><div class="fld"><label for="dp-fmt">قالب</label><select class="inp" id="dp-fmt"><option value="hm" ${dpState.fmt === "hm" ? "selected" : ""}>hh:mm</option><option value="hms" ${dpState.fmt === "hms" ? "selected" : ""}>hh:mm:ss</option></select></div><div class="fld"><label for="dp-time">ساعت مراجعه</label><button type="button" class="inp picker" id="dp-time">${dpState.time || '<span class="hint">انتخاب ساعت</span>'}${ICON.clock}</button></div></div>`
          : `<label class="lbl" for="dp-dur">مدت جلسه</label><input class="inp" id="dp-dur" value="۰۲:۳۰"><span class="hint">مدت زمان، نه ساعت روز</span>`;
  }
  function fillModes(prefer) {
    const t = $("#dp-type").value;
    $("#dp-mode").innerHTML = DP[t].map(([v, n]) => `<option value="${v}">${n}</option>`).join("");
    $("#dp-mode").value = prefer || DP[t][1][0];
    renderDisplay();
  }
  $("#dp-type").addEventListener("change", () => fillModes());
  $("#dp-mode").addEventListener("change", renderDisplay);
  $("#dp-out").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.dp) {
      dpState.on = !dpState.on;
      renderDisplay();
    }
    if (b.dataset.dpstar) {
      dpState.stars = +b.dataset.dpstar;
      renderDisplay();
    }
    if (b.id === "dp-time") openClock(b, dpState.time, (v) => ((dpState.time = v), renderDisplay()), { seconds: dpState.fmt === "hms" });
  });
  $("#dp-out").addEventListener("change", (e) => {
    if (e.target.dataset.dp) dpState.on = e.target.checked;
    if (e.target.id === "dp-fmt") {
      dpState.fmt = e.target.value;
      dpState.time = "";
      renderDisplay();
    }
  });
  $("#dp-out").addEventListener("input", (e) => {
    if (e.target.id !== "dp-pct") return;
    const v = Math.min(100, num(e.target.value) || 0);
    e.target.value = fa(toEn(e.target.value).replace(/\D/g, ""));
    dpState.pct = v;
    $("#dp-out .pbar i").style.width = v + "%";
    $("#dp-out .hint").textContent = fa(v) + "%";
  });

  // versions
  const VERS = [
    { n: "نسخه‌ی ۴", s: "پیش‌نویس", c: "—", d: [["add", "فیلد «فوریت خرید» اضافه شد"], ["chg", "برچسب «قیمت براوردی» ← «قیمت براوردی(واحد)»"]] },
    { n: "نسخه‌ی ۳", s: "منتشرشده، ۱۲۸ پاسخ", c: "۳۰ مهر", d: [["add", "ستون «آیا تجهیزات End of Sale است ؟» به کالای تخصصی اضافه شد"], ["add", "قاعده‌ی «تاریخ پایان بعد از شروع»"]] },
    { n: "نسخه‌ی ۲", s: "۴۰۲ پاسخ", c: "۱۲ شهریور", d: [["del", "فیلد «کد بودجه» حذف شد"], ["chg", "«اداره کل» به «معاونت» وابسته شد"]] },
  ];
  let verSel = 0;
  function renderVersions() {
    $("#versions").innerHTML = VERS.map((v, i) => `<button type="button" class="ver" aria-pressed="${i === verSel}" data-ver="${i}"><span><b>${v.n}</b>، ${v.s}</span><span class="hint">${v.c}</span></button>`).join("");
    const v = VERS[verSel];
    $("#ver-diff").innerHTML = `<b>تغییرات ${v.n}</b>${v.d.map(([k, t]) => `<span class="${k}">${k === "add" ? "+" : k === "del" ? "−" : "~"} ${esc(t)}</span>`).join("")}${verSel > 0 ? `<div><button class="btn sm" data-restore>بازگرداندن این نسخه</button></div>` : ""}`;
  }
  $("#versions").addEventListener("click", (e) => {
    const i = e.target.closest("[data-ver]")?.dataset.ver;
    if (i == null) return;
    verSel = +i;
    renderVersions();
  });
  $("#ver-diff").addEventListener("click", (e) => {
    if (e.target.closest("[data-restore]")) toast(`${VERS[verSel].n} به‌عنوان پیش‌نویس تازه بازگردانده شد.`);
  });

  // national id, iban, postal code
  const irMsg = (id, ok, msg) => {
    const el = $("#" + id);
    el.textContent = msg;
    el.style.color = ok == null ? "" : ok ? "var(--ok)" : "var(--red)";
  };
  $("#ir-nid").addEventListener("input", (e) => {
    const v = toEn(e.target.value).replace(/\D/g, "").slice(0, 10);
    e.target.value = fa(v);
    irMsg("ir-nid-m", v.length < 10 ? null : nidOk(v), v.length < 10 ? `${fa(v.length)} از ۱۰ رقم` : nidOk(v) ? "✓ کد ملی معتبر است." : "رقم کنترل درست نیست.");
  });
  $("#ir-iban").addEventListener("input", (e) => {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9۰-۹]/g, "");
    e.target.value = toEn(v);
    if (toEn(v).length < 26) return irMsg("ir-iban-m", null, "IR و ۲۴ رقم");
    const r = ibanCheck(v);
    irMsg("ir-iban-m", r.ok, r.ok ? "✓ " + r.msg : r.msg);
  });
  $("#ir-post").addEventListener("input", (e) => {
    const v = toEn(e.target.value).replace(/\D/g, "").slice(0, 10);
    e.target.value = fa(v);
    const ok = /^[13-9]\d{9}$/.test(v);
    irMsg("ir-post-m", v.length < 10 ? null : ok, v.length < 10 ? `${fa(v.length)} از ۱۰ رقم` : ok ? "✓ قالب کدپستی درست است." : "کدپستی با ۰ یا ۲ شروع نمی‌شود.");
  });
  $("#ir-sample").addEventListener("click", () => {
    $("#ir-nid").value = "0078402190";
    $("#ir-iban").value = "IR110170000000123456789001";
    $("#ir-post").value = "1439813119";
    ["ir-nid", "ir-iban", "ir-post"].forEach((id) => $("#" + id).dispatchEvent(new Event("input")));
  });

  // Bale chat
  const CHAT = [
    ["سلام علی، کدام فرم را پر می‌کنید؟", ["اعلام نیاز خرید"]],
    ["نوع درخواست؟", ["کالای تخصصی / خدمات", "کالای عمومی(اثاثیه و اموال)"]],
    ["کدام خدمت؟", ["پشتیبانی نرم‌افزار", "آموزش کاربران"]],
    ["تعداد؟", ["۴۰۰ نفرساعت", "۱۰۰ نفرساعت"]],
    ["تأییدکننده از مدیران معاونت فناوری اطلاعات؟", ["حمید کریمی", "مریم احمدی"]],
    ["درخواست اخ-۱۴۰۵-۰۴۳۰ ثبت شد و به کارتابل تأییدکننده رفت.", []],
  ];
  let chatI = 0;
  const chatLog = [];
  function renderChat() {
    $("#chat").innerHTML = chatLog.map(([who, t]) => `<div class="msg ${who}">${esc(t)}</div>`).join("");
    $("#chat").scrollTop = 1e6;
    const q = CHAT[chatI];
    $("#chat-qr").innerHTML = q && q[1].length ? q[1].map((o) => `<button class="btn sm" data-qr="${esc(o)}">${esc(o)}</button>`).join("") : `<button class="btn sm" data-qr-restart>از نو</button>`;
  }
  function chatStart() {
    chatI = 0;
    chatLog.length = 0;
    chatLog.push(["", CHAT[0][0]]);
    renderChat();
  }
  $("#chat-qr").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-qr-restart")) return chatStart();
    chatLog.push(["me", b.dataset.qr]);
    chatI++;
    if (CHAT[chatI]) chatLog.push(["", CHAT[chatI][0]]);
    renderChat();
  });

  // ---------- after-submit pane ----------
  const SUBMITTED = [];
  const SAMPLE_REQS = [
    {
      no: "اخ-۱۴۰۵-۰۴۱۲", by: "نرگس جعفری", dept: "اداره کل شبکه‌ی هسته", deputy: "معاونت فنی", approver: "کاوه رحیمی", type: TYPES.t1, date: "۱۴۰۵/۰۷/۲۹", subject: "توسعه‌ی شبکه‌ی هسته",
      rows: [{ id: "x1", table: "خدمات", title: "پشتیبانی نرم‌افزار", qty: 120, unit: "نفرساعت", price: 4500000, cur: "ریال" }, { id: "x2", table: "کالای تخصصی", title: "ماژول نوری ۱۰ گیگ", qty: 48, unit: "عدد", price: 180, cur: "یورو" }],
      chain: [["ثبت درخواست", "done", "نرگس جعفری"], ["بررسی مدیر", "cur", "کاوه رحیمی"], ["تدارکات", "", "کارشناس خرید"]], log: [["ثبت شد", "نرگس جعفری", "۲۹ مهر ۰۹:۱۰"]],
      desc: "تأمین ماژول نوری برای توسعه‌ی شبکه‌ی هسته", city: "تهران", recv: "انبار فنی",
    },
    {
      no: "اخ-۱۴۰۵-۰۳۹۸", by: "پریسا کاظمی", dept: "اداره کل بازاریابی", deputy: "معاونت تجاری", approver: "امیر حسینی", type: TYPES.t2, date: "۱۴۰۵/۰۷/۲۱", subject: "تجهیز اتاق جلسات",
      rows: [{ id: "x3", table: "کالای عمومی", title: "صندلی اداری", qty: 12, unit: "عدد", price: 42000000, cur: "ریال" }],
      chain: [["ثبت درخواست", "done", "پریسا کاظمی"], ["بررسی مدیر", "done", "امیر حسینی"], ["تدارکات", "cur", "کارشناس خرید"]], log: [["ثبت شد", "پریسا کاظمی", "۲۱ مهر ۱۴:۰۲"], ["تأیید شد", "امیر حسینی", "۲۲ مهر ۰۸:۴۵، «موافقم»"]],
      desc: "تجهیز اتاق جلسات طبقه‌ی سوم", city: "تهران", recv: "ساختمان مرکزی",
    },
  ];
  SAMPLE_REQS.forEach((r) => (r.totals = r.rows.reduce((t, x) => ((t[x.cur] = (t[x.cur] || 0) + x.qty * x.price), t), {})));
  let inboxSel = 0;
  const reqs = () => [...SUBMITTED, ...SAMPLE_REQS];
  const statusOf = (r) => {
    if (r.final) return r.final;
    const cur = r.chain.find((c) => c[1] === "cur");
    return cur ? "در انتظار " + cur[0] : "تکمیل شد";
  };
  function renderAfter() {
    const list = reqs();
    inboxSel = Math.min(inboxSel, list.length - 1);
    $("#inbox-list").innerHTML = list
      .map(
        (r, i) => `<button type="button" class="req-item" aria-pressed="${i === inboxSel}" data-req="${i}"><span class="t"><b>${esc(r.no)}</b>${r.mine ? '<span class="tag green">ثبت شما</span>' : ""}</span><span>${esc(r.subject || r.desc)}</span><span class="hint">${esc(r.by)}، ${esc(r.dept)}</span><span class="tag gray" style="justify-self:start">${esc(statusOf(r))}</span></button>`,
      )
      .join("");
    const r = list[inboxSel];
    const canAct = !r.final && r.chain.some((c) => c[1] === "cur");
    $("#inbox-detail").innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${esc(r.no)}، ${esc(r.subject || "")}</b><span class="hint">${esc(r.date)}</span></div>
      <span>${esc(r.type)}، ${esc(r.desc || "—")}</span>
      <div class="chain" style="justify-content:flex-start">${r.chain.map((c) => `<span class="${c[1]}">${esc(c[0])}، ${esc(c[2])}</span>`).join("›")}</div>
      <div class="tbl-scroll"><table><thead><tr><th>ردیف</th><th>جدول</th><th>تعداد</th><th>مبلغ</th></tr></thead><tbody>${r.rows.map((x) => `<tr><td>${esc(x.title)}</td><td>${esc(x.table)}</td><td class="n">${fa(x.qty)} ${esc(x.unit)}</td><td class="n">${money(x.qty * x.price)} ${esc(x.cur)}</td></tr>`).join("")}</tbody></table></div>
      ${canAct ? `<textarea class="inp" id="ap-note" placeholder="توضیح (برای بازگشت یا رد لازم است)" style="min-height:60px"></textarea><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn pri" data-ap="ok">تأیید</button><button class="btn" data-ap="back">بازگشت برای اصلاح</button><button class="btn" data-ap="no">رد</button></div><span class="err" id="ap-err"></span>` : ""}
      <b>سابقه</b><ul class="tl">${r.log.map((l) => `<li>${esc(l[0])}، ${esc(l[1])}<br><span class="hint">${esc(l[2])}</span></li>`).join("")}</ul>`;
    renderRecord();
    renderPdf();
  }
  $("#inbox-list").addEventListener("click", (e) => {
    const i = e.target.closest("[data-req]")?.dataset.req;
    if (i == null) return;
    inboxSel = +i;
    renderAfter();
  });
  $("#inbox-detail").addEventListener("click", (e) => {
    const a = e.target.closest("[data-ap]")?.dataset.ap;
    if (!a) return;
    const r = reqs()[inboxSel];
    const note = $("#ap-note").value.trim();
    if (a !== "ok" && !note) return ($("#ap-err").textContent = "برای بازگشت یا رد، توضیح بنویسید.");
    const i = r.chain.findIndex((c) => c[1] === "cur");
    const who = r.chain[i][2];
    if (a === "ok") {
      r.chain[i][1] = "done";
      if (r.chain[i + 1]) r.chain[i + 1][1] = "cur";
      r.log.push(["تأیید شد", who, "همین حالا" + (note ? "، «" + note + "»" : "")]);
      toast("تأیید شد و به مرحله‌ی بعد رفت.");
    } else {
      r.final = a === "back" ? "بازگشت برای اصلاح" : "رد شد";
      r.log.push([r.final, who, "همین حالا، «" + note + "»"]);
      toast(a === "back" ? "درخواست برای اصلاح به ثبت‌کننده برگشت." : "درخواست رد شد.");
    }
    renderAfter();
  });
  function renderRecord() {
    const r = reqs()[0];
    let n = 1832;
    const byTable = {};
    r.rows.forEach((x) => (byTable[x.table] = byTable[x.table] || []).push(x));
    $("#record").innerHTML = `<div class="sum"><b>${esc(r.no)}</b>${esc(r.subject || "")}<span>${esc(r.by)}، ${esc(r.dept)}</span><span>وضعیت: ${esc(statusOf(r))}</span></div>
      ${Object.entries(byTable)
        .map(([t, rows]) => `<b style="font-size:13px">${esc(t)} (${fa(rows.length)} رکورد)</b><ul class="flist">${rows.map((x) => `<li><span>${esc(x.title)}</span><span class="tag gray">قلم-${fa(n++)}، ${esc(r.no)}</span></li>`).join("")}</ul>`)
        .join("")}`;
  }
  function renderPdf() {
    const r = reqs()[0];
    $("#pdf").innerHTML = `<div class="paper" aria-label="پیش‌نمایش سند">
      <div class="ph"><span class="logo">لوگوی سازمان</span><b style="font-size:15px">فرم اعلام نیاز خرید</b><span>شماره: ${esc(r.no)}<br>تاریخ: ${esc(r.date)}</span></div>
      <table><tbody><tr><th>عنوان درخواست</th><td colspan="3">${esc(r.subject || "—")}</td></tr><tr><th>درخواست‌کننده</th><td>${esc(r.by)}</td><th>واحد</th><td>${esc(r.dept)}</td></tr><tr><th>نوع درخواست</th><td>${esc(r.type)}</td><th>محل دریافت</th><td>${esc(r.recv || "—")}</td></tr><tr><th>شرح درخواست</th><td colspan="3">${esc(r.desc || "—")}</td></tr></tbody></table>
      <table><thead><tr><th>ردیف</th><th>شرح</th><th>تعداد</th><th>قیمت براوردی(واحد)</th><th>مبلغ</th></tr></thead><tbody>${r.rows.map((x, i) => `<tr><td>${fa(i + 1)}</td><td>${esc(x.title)}</td><td>${fa(x.qty)} ${esc(x.unit)}</td><td>${money(x.price)} ${esc(x.cur)}</td><td>${money(x.qty * x.price)} ${esc(x.cur)}</td></tr>`).join("")}</tbody></table>
      <div>جمع: ${Object.entries(r.totals).map(([c, v]) => `<b>${money(v)} ${esc(c)}</b>`).join("، ")}</div>
      <div class="signs">${r.chain.map((c) => `<div>${esc(c[0])}<br>${esc(c[2])}</div>`).join("")}</div>
    </div>`;
  }

  // ---------- show a demo target ----------
  const BUILD_KEYS = new Set(["b-table", "b-ai", "b-rules", "b-map", "b-display", "b-mobile", "b-versions", "b-iran", "bale"]);
  const AFTER_KEYS = new Set(["inbox", "record", "pdf", "history", "funnel"]);
  const STEP_OF = { intro: 1, image: 1, piping: 1, prefill: 1, layout: 1, help: 1, link: 1, radio: 1, dep: 1, cond: 1, people: 1, date: 1, errors: 1, cancel: 1, rows: 2, totals: 2, excel: 2, api: 2, aifill: 2, catalog: 2, linetotal: 2, daterule: 2, number: 2, switch: 3, time: 3, files: 3, sign: 3, province: 3, button: 3, review: 4, dup: 4, otp: 4, submit: 4 };
  const ensureFilled = () => {
    if (!F.deputy) fillSample();
    if (F.submitted) F.submitted = null;
  };
  const PREP = {
    catalog: () => openRowDialog("svc", null, { catalogId: "c1", title: "پشتیبانی نرم‌افزار", unit: "نفرساعت", price: 4500000, qty: 400, start: "۱۴۰۵/۰۹/۰۱", end: "۱۴۰۵/۱۲/۲۹" }),
    linetotal: () => PREP.catalog(),
    number: () => PREP.catalog(),
    daterule: () => openRowDialog("svc", null, { catalogId: "c3", title: "آموزش کاربران", unit: "نفرروز", price: 25000000, qty: 10, start: "۱۴۰۵/۰۹/۲۰", end: "۱۴۰۵/۰۹/۰۵" }).forceErrors(),
    excel: () => openExcel(F.type === "t1" ? "svc" : "gen", true),
    api: () => {
      if (F.type !== "t1") {
        F.type = "t1";
        renderFill();
      }
      openApi("svc");
    },
    aifill: () => {
      if (F.type !== "t1") {
        F.type = "t1";
        renderFill();
      }
      openAiFill("spec");
    },
    switch: () => {
      F.install = true;
      renderFill();
    },
    time: () => PREP.switch(),
    errors: () => {
      if (!Object.keys(validate(1)).length) F.nid = "۱۲۳۴۵۶۷۸۹۰";
      UI.errors = validate(1);
      UI.showErr = true;
      renderFill();
    },
    receipt: () => {
      ensureFilled();
      F.otp = "۱۲۳۴";
      F.eosWhy = F.eosWhy || "سازگاری با تجهیزات موجود";
      finishSubmit();
    },
    rating: () => PREP.receipt(),
    people: () => {
      if (!F.deputy) Object.assign(F, { deputy: "it", dept: "اداره کل ESS" });
      renderFill();
      openPeople($("#f-approver"));
    },
    "disp-percent": () => {
      $("#dp-type").value = "num";
      fillModes("percent");
    },
    "disp-time": () => {
      $("#dp-type").value = "dur";
      fillModes("time");
    },
  };
  ["review", "dup", "otp", "submit"].forEach(
    (k) =>
      (PREP[k] = () => {
        ensureFilled();
        if (k === "review" || k === "dup") F.dupOk = false;
        // past the review step the tour should not stall on the End of Sale rule it already showed
        if ((k === "otp" || k === "submit") && !F.eosWhy.trim()) F.eosWhy = "سازگاری با تجهیزات موجود شبکه‌ی هسته؛ جایگزین هم‌رده در بازار نیست.";
        F.step = 4;
        renderFill();
      }),
  );
  function showDemo(key) {
    closePop();
    closeModal();
    setView("demo");
    const target = ALIAS[key] || key;
    const p = BUILD_KEYS.has(target) ? "build" : AFTER_KEYS.has(target) ? "after" : "fill";
    setPane(p);
    if (p === "fill") {
      if (F.submitted && STEP_OF[key]) F.submitted = null;
      if (STEP_OF[key] && F.step !== STEP_OF[key]) {
        if (STEP_OF[key] > 1) ensureFilled();
        F.step = STEP_OF[key];
        UI.showErr = false;
        UI.errors = {};
      }
      renderFill();
    }
    if (PREP[key]) PREP[key]();
    setTimeout(() => {
      const el = (modal && $(`[data-demo~="${target}"]`, modal)) || $(`[data-demo~="${target}"]`);
      if (el) highlight(el, "flash");
    }, 30);
  }

  // ---------- tour ----------
  let tourI = -1;
  function renderTourList() {
    $("#tour-list").innerHTML = TOUR.map((s, i) => `<div class="t-item"><span class="no">${fa(i + 1)}</span><div><h3>${esc(s.t)}</h3><p>${esc(s.say)}</p></div><button class="btn sm" data-tour="${i}">نمایش</button></div>`).join("");
  }
  function tourGo(i) {
    tourI = i;
    const s = TOUR[i];
    const bar = $("#tourbar");
    bar.hidden = false;
    bar.innerHTML = `<div class="tt"><b>${fa(i + 1)} از ${fa(TOUR.length)}، ${esc(s.t)}</b><span style="display:flex;gap:6px"><button class="btn sm" data-tb="prev" ${i === 0 ? "disabled" : ""}>قبلی</button><button class="btn sm pri" data-tb="next">${i === TOUR.length - 1 ? "پایان" : "بعدی"}</button><button class="btn sm" data-tb="close" aria-label="بستن">✕</button></span></div><p>${esc(s.say)}</p>`;
    showDemo(s.go);
  }
  $("#tour-list").addEventListener("click", (e) => {
    const i = e.target.closest("[data-tour]")?.dataset.tour;
    if (i != null) tourGo(+i);
  });
  $("#tour-start").addEventListener("click", () => tourGo(0));
  $("#tourbar").addEventListener("click", (e) => {
    const a = e.target.closest("[data-tb]")?.dataset.tb;
    if (a === "prev") tourGo(tourI - 1);
    if (a === "next") tourI === TOUR.length - 1 ? ($("#tourbar").hidden = true) : tourGo(tourI + 1);
    if (a === "close") $("#tourbar").hidden = true;
  });

  // ---------- boot ----------
  applyTheme(theme);
  if (CUSTOMER) {
    // the customer never sees editing, file handling or internal notes
    ["#edit-btn", "#edit-bar", "#file-btn"].forEach((s) => $(s)?.remove());
    document.body.classList.add("customer");
    $("#open-picks .lbl-t").textContent = "انتخاب‌ها و ارسال";
  }
  renderCatalog();
  renderPicks();
  if (!CUSTOMER) FILE.boot();
  renderFill();
  renderRules();
  fillModes();
  renderVersions();
  chatStart();
  renderTourList();
  decorate(document);
  const start = (location.hash || "").slice(1);
  if (HASH[start]) {
    setView(HASH[start][0]);
    if (HASH[start][1]) setPane(HASH[start][1]);
  }
  window.__afc = { showDemo, openClock, FILE, get DB() { return DB; } };
})();
