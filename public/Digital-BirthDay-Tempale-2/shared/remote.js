/* ============================================================
   ORDER DATA FROM AN API  (with the book's own data as the fallback)

   Every order can have its own name, photos, wishes, quotes and letter.
   The link carries the order id:  index.html?order=1234
   If an API address is set in config.js, this file fetches the order and
   merges it over the static content in pages.js BEFORE the 3D book is
   built. If the API is not set, has no order id, is slow (timeout), fails,
   or returns something that is not JSON, the static data in pages.js is used,
   so the book always opens. A picture that fails to load falls back to the
   static picture it replaces.

   Expected JSON (every field is optional; unknown fields are ignored):
   {
     "name": "Riya", "from": "Sam", "coil": "#f29bb8",
     "cover":   { "photo": "https://…/her.jpg", "top": "…", "foot": "…" },
     "photos":  [ "https://…/1.jpg", { "img": "https://…/2.jpg", "cap": "caption", "wish": "wish tag" } ],
     "wishes":  [ "may you …", "may you …" ],            // the strips on "my wishes for you"
     "quotes":  [ "quote one", "quote two" ],            // the strips on "birthday quotes"
     "letter":  "Dear …", "signature": "— with love",
     "pages":   { "6": { "texts": [ { "text": "…" } ], "photos": [ { "img": "…", "cap": "…" } ], "notes": [ { "text": "…", "secret": "…" } ] } }
   }
   "photos" fills every photo in the book in page order (the cover photo is "cover.photo").
   "pages" edits one page by its number, item by item. Pictures can be a full https:// address
   or a file name saved in src/photos/. The reply may also be wrapped as { "data": { … } }.
   ============================================================ */
(() => {
  const API = window.BOOK_API || {};
  const FALLBACK = (window.BOOK_FALLBACK = {});             // new picture address -> the static picture it replaced
  const clean = (v, n = 400) => typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n) : undefined;
  const picture = v => typeof v === "string" && (/^https?:\/\/\S+$/i.test(v) || /^[\w.\-\/]+\.(jpe?g|png|webp|gif)$/i.test(v)) ? v : undefined;
  const hex = v => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : undefined;

  function setPicture(obj, key, v) {
    const u = picture(v);
    if (u && obj && u !== obj[key]) { if (obj[key]) FALLBACK[u] = obj[key]; obj[key] = u; }
  }
  function setText(obj, key, v, n) { const t = clean(v, n); if (t !== undefined && t !== "" && obj) obj[key] = t; }

  // one photo entry: a picture address, or { img, cap, wish, back }
  function applyPhoto(slot, d) {
    if (!slot || d == null) return;
    if (typeof d === "string") return setPicture(slot, "img", d);
    setPicture(slot, "img", d.img); setText(slot, "cap", d.cap, 60); setText(slot, "wish", d.wish, 90); setText(slot, "back", d.back, 140);
  }
  // strips of writing on a page: the texts that sit on paper scraps
  function applyStrips(page, list) {
    if (!page || !Array.isArray(list)) return;
    const strips = (page.texts || []).filter(t => t.paper && t.kind !== "letter");
    list.forEach((v, i) => { if (strips[i]) setText(strips[i], "text", v, 90); });
  }
  const byTitle = word => B => B.pages.find(p => p.title && p.title.join("").toLowerCase().includes(word));

  function merge(B, d) {
    setText(B, "name", d.name, 24); setText(B, "from", d.from, 24);
    const c = hex(d.coil); if (c) B.coil = c;
    const first = B.pages[0], last = B.pages[B.pages.length - 1];
    if (d.cover && first.cover) {
      setPicture(first.cover, "photo", d.cover.photo); setText(first.cover, "top", d.cover.top, 40); setText(first.cover, "foot", d.cover.foot, 40);
      if (Array.isArray(d.cover.title) && d.cover.title.length === 2) first.cover.title = d.cover.title.map(t => clean(t, 20) || "");
    }
    if (d.backCover && last.cover) { setText(last.cover, "top", d.backCover.top, 40); setText(last.cover, "foot", d.backCover.foot, 40); }

    if (Array.isArray(d.photos)) {
      const slots = B.pages.flatMap(p => p.photos || []);
      d.photos.forEach((v, i) => applyPhoto(slots[i], v));
    }
    applyStrips(byTitle("my wishes")(B), d.wishes);
    applyStrips(byTitle("quotes")(B), d.quotes);
    if (typeof d.letter === "string") {
      for (const p of B.pages) for (const t of p.texts || []) if (t.kind === "letter") setText(t, "text", d.letter, 700);
    }
    if (typeof d.signature === "string") {
      for (const p of B.pages) if ((p.texts || []).some(t => t.kind === "letter")) {
        const sig = p.texts.find(t => t.kind === "hand" && t.align === "right"); if (sig) setText(sig, "text", d.signature, 40);
      }
    }
    if (d.pages && typeof d.pages === "object") {
      for (const key of Object.keys(d.pages)) {
        const page = B.pages[+key], e = d.pages[key];
        if (!page || !e) continue;
        (e.photos || []).forEach((v, i) => applyPhoto((page.photos || [])[i], v));
        (e.texts || []).forEach((v, i) => { const t = (page.texts || [])[i]; if (t) setText(t, "text", typeof v === "string" ? v : v && v.text, 200); });
        (e.notes || []).forEach((v, i) => { const n = (page.notes || [])[i]; if (n && v) { setText(n, "text", v.text, 30); setText(n, "secret", v.secret, 120); } });
        if (Array.isArray(e.title) && e.title.length === 2 && page.title) page.title = e.title.map(t => clean(t, 24) || "");
      }
    }
  }

  async function fetchOrder() {
    const order = new URLSearchParams(location.search).get(API.orderParam || "order");
    if (!API.url || !order) return null;
    const url = API.url.includes("{order}") ? API.url.replace("{order}", encodeURIComponent(order))
      : API.url + (API.url.includes("?") ? "&" : "?") + (API.orderParam || "order") + "=" + encodeURIComponent(order);
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), API.timeout || 4000);
    try {
      const res = await fetch(url, { headers: API.headers || {}, credentials: "omit", signal: ctl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = await res.json();
      return j && typeof j === "object" ? (j.data && typeof j.data === "object" ? j.data : j) : null;
    } finally { clearTimeout(timer); }
  }

  // the engine files load after the data is in place, in order
  // the engine files sit next to this one (the shared folder)
  const here = document.currentScript ? document.currentScript.src : "";
  const base = here.replace(/[^\/]*$/, "");
  const version = (here.match(/\?v=[\w.]+/) || [""])[0];
  function loadScripts(list) {
    const next = () => {
      const src = list.shift();
      if (!src) return;
      const s = document.createElement("script");
      s.src = src + version; s.onload = next; s.onerror = next;
      document.body.appendChild(s);
    };
    next();
  }

  (async () => {
    try {
      const data = await fetchOrder();
      if (data) { merge(window.BOOK, data); console.info("[book] order data loaded from the API"); }
      else console.info("[book] using the static data");
    } catch (e) {
      console.info("[book] API not available (" + (e && e.message || e) + "), using the static data");
    }
    loadScripts(["models.js", "extras.js", "sound.js", "polish.js", "main.js"].map(f => base + f));
  })();
})();
