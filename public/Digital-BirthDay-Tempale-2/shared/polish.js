/* ============================================================
   POLISH – the parts that make a book feel like a gift (and easy to share)

   - a gift splash: "a birthday gift for <name> – tap to open". The tap also starts the
     music-box song and lets the book glide in (the engine waits for it: window.BOOK_GATE)
   - a few themed emoji drifting across the page (THEME.float in theme.js)
   - a WhatsApp button next to share
   - at "the end": a link to make one for someone else (BOOK_API.brand in config.js; hidden when no url)
   Add ?splash=0 to the address to skip the splash.
   ============================================================ */
(() => {
  const THEME = window.THEME || {}, BOOK = window.BOOK || {}, API = window.BOOK_API || {};
  const params = new URLSearchParams(location.search);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NAME = (params.get("name") || BOOK.name || "").trim().slice(0, 24);
  const FROM = (params.get("from") || BOOK.from || "").trim().slice(0, 24);
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const emoji = THEME.emoji || "♡";
  const bits = (THEME.float && THEME.float.length ? THEME.float : [emoji, "✨"]);

  // the little pictures are the book's own cover stickers (die-cut, white edge), drawn from the theme; emoji only as a fallback
  const TYPES = THEME.sticker && THEME.stickers && THEME.stickers.length ? THEME.stickers : [];
  const urls = {};
  function stickerURL(type) {
    if (!(type in urls)) {
      urls[type] = null;
      try {
        const c = Object.assign(document.createElement("canvas"), { width: 220, height: 220 });
        THEME.sticker(c.getContext("2d"), type, 110, 108, 56, 0, null);
        urls[type] = c.toDataURL("image/png");
      } catch (e) { /* fall back to the emoji */ }
    }
    return urls[type];
  }
  // pic(i, class, size): sticker number i (or its emoji) as an element about `size` px wide
  function pic(i, cls, size) {
    const url = TYPES.length ? stickerURL(TYPES[i % TYPES.length]) : null;
    if (url) {
      const im = new Image();
      im.src = url; im.alt = ""; im.draggable = false; im.className = cls;
      im.style.width = im.style.height = size + "px";
      return im;
    }
    const e = el("span", cls, bits[i % bits.length]);
    e.style.fontSize = Math.round(size * 0.62) + "px";
    return e;
  }

  /* ---------- the gift splash ---------- */
  let openGate = () => {};
  if (params.get("splash") !== "0") {
    window.BOOK_GATE = new Promise(res => { openGate = res; });
    const pages = Math.max(0, (BOOK.pages || []).length - 2);
    const splash = el("div", "splash", `
      <div class="splash-blob b1"></div><div class="splash-blob b2"></div><div class="splash-blob b3"></div>
      <div class="splash-bunting"></div>
      <div class="splash-sky"></div>
      <div class="splash-card">
        <div class="splash-badge"></div>
        <p class="splash-kicker"><i>✦</i> happy birthday <i>✦</i></p>
        <h1 class="splash-name">${esc(NAME || "you")}</h1>
        <div class="splash-rule"><span></span><b aria-hidden="true"></b><span></span></div>
        <p class="splash-small">a little birthday book, made just for you${FROM ? `<br><em>with love, ${esc(FROM)}</em>` : ""}</p>
        <button class="splash-open" type="button" disabled><span>wrapping your gift…</span></button>
        <button class="splash-quiet" type="button" hidden>open without music</button>
        ${pages ? `<p class="splash-count">${pages} pages of wishes, photos &amp; little surprises</p>` : ""}
      </div>`);
    splash.querySelector(".splash-badge").appendChild(pic(0, "splash-icon", 88));
    splash.querySelector(".splash-rule b").appendChild(pic(1, "splash-mini", 26));
    const colours = (THEME.confetti && THEME.confetti.length ? THEME.confetti : ["#f4a3bd", "#ffd45a", "#9fe0ea"]).filter(c => c.toLowerCase() !== "#ffffff");

    // bunting: little flags hanging along a sagging string
    const bunting = splash.querySelector(".splash-bunting");
    let svg = '<svg viewBox="0 0 1000 150" preserveAspectRatio="none" aria-hidden="true"><path d="M-10 8 Q500 150 1010 8" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="2.4"/>';
    for (let i = 0; i < 15; i++) {
      const t = (i + 0.5) / 15, x = -10 + t * 1020, y = (1 - t) * (1 - t) * 8 + 2 * (1 - t) * t * 150 + t * t * 8;
      const tilt = (t - 0.5) * -30;
      svg += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tilt.toFixed(1)})"><path d="M-24 0 L24 0 L0 56 Z" fill="${colours[i % colours.length]}" stroke="rgba(255,255,255,.7)" stroke-width="2"/></g>`;
    }
    bunting.innerHTML = svg + "</svg>";

    // balloons rise from the bottom, a little confetti falls
    const sky = splash.querySelector(".splash-sky");
    for (let i = 0; i < 6; i++) {
      const bl = el("span", "splash-balloon");
      bl.style.left = (6 + i * 17 + Math.random() * 6) + "%";
      bl.style.setProperty("--c", colours[i % colours.length]);
      bl.style.animationDuration = (11 + Math.random() * 6) + "s"; bl.style.animationDelay = (-Math.random() * 12) + "s";
      bl.style.scale = String(0.8 + Math.random() * 0.5);
      sky.appendChild(bl);
    }
    for (let i = 0; i < 22; i++) {
      const c = el("span", "splash-bit");
      c.style.left = Math.random() * 100 + "%"; c.style.background = colours[i % colours.length];
      c.style.animationDuration = (6 + Math.random() * 6) + "s"; c.style.animationDelay = (-Math.random() * 10) + "s";
      c.style.setProperty("--w", (5 + Math.random() * 6) + "px");
      sky.appendChild(c);
    }
    const cs = getComputedStyle(document.body);
    splash.style.backgroundImage = cs.backgroundImage;
    splash.style.backgroundColor = cs.backgroundColor;
    document.body.appendChild(splash);
    const btn = splash.querySelector(".splash-open"), quiet = splash.querySelector(".splash-quiet");

    // sparkles around the icon
    for (let i = 0; i < 5; i++) {
      const s = pic(i + 1, "splash-spark", 28);
      s.style.setProperty("--a", (i / 5 * 360 + 36) + "deg"); s.style.animationDelay = (i * 0.35) + "s";
      splash.querySelector(".splash-badge").appendChild(s);
    }

    addEventListener("book-ready", () => {
      btn.disabled = false; btn.firstElementChild.textContent = "open my book ♡"; quiet.hidden = false; btn.focus({ preventScroll: true });
    }, { once: true });

    const open = withMusic => {
      if (splash.classList.contains("go")) return;
      splash.classList.add("go");
      if (withMusic && $("music") && !$("music").classList.contains("on")) $("music").click();
      const r = btn.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, 26);
      openGate();
      setTimeout(() => splash.remove(), 900);
      setTimeout(startFloaters, 1200);
      setTimeout(autoOpen, 3600);
    };
    btn.addEventListener("click", () => open(true));
    quiet.addEventListener("click", () => open(false));
  } else {
    setTimeout(startFloaters, 1500);
  }

  /* ---------- the cover opens by itself (unless they already did) ---------- */
  function autoOpen() {
    if ($("counter") && $("counter").textContent.trim() === "cover" && $("next") && !$("next").disabled) $("next").click();
  }

  /* ---------- emoji burst (DOM, so it also works over the splash) ---------- */
  function burst(x, y, n) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const s = pic(i, "pop", 26 + Math.random() * 20);
      const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 180;
      s.style.left = x + "px"; s.style.top = y + "px";
      s.style.setProperty("--dx", Math.cos(a) * d + "px"); s.style.setProperty("--dy", Math.sin(a) * d - 60 + "px");
      s.style.animationDelay = Math.random() * 0.15 + "s";
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1700);
    }
  }

  /* ---------- a few themed emoji drifting down the page ---------- */
  function startFloaters() {
    if (reduced) return;
    const layer = el("div", "floaters"); layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
    const spawn = () => {
      if (document.hidden || layer.children.length > 11) return;
      const s = pic(Math.floor(Math.random() * 12), "floater", 30 + Math.random() * 18);
      const dur = 11 + Math.random() * 9;
      s.style.left = Math.random() * 100 + "%";
      s.style.animationDuration = dur + "s";
      s.style.setProperty("--drift", (Math.random() * 120 - 60) + "px");
      layer.appendChild(s);
      setTimeout(() => s.remove(), dur * 1000);
    };
    for (let i = 0; i < 5; i++) setTimeout(spawn, i * 500);
    setInterval(spawn, 1700);
  }

  /* ---------- WhatsApp ---------- */
  const top = document.querySelector(".top-btns");
  if (top) {
    const wa = el("button", "round-btn");
    wa.appendChild(pic(0, "btn-ico", 28));
    wa.type = "button"; wa.id = "wa"; wa.setAttribute("aria-label", "Send this birthday book on WhatsApp");
    wa.addEventListener("click", () => {
      const url = location.href.split("#")[0];
      const text = `${NAME ? `Happy Birthday, ${NAME}` : "Happy Birthday"} ${emoji}\nI made you a little birthday book ♡\n${url}`;
      window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
    });
    top.insertBefore(wa, $("share"));
  }

  /* ---------- at "the end": send it on, read it again, make one for someone else ---------- */
  const brand = API.brand || {};
  if ($("counter")) {
    const url = () => location.href.split("#")[0];
    const wish = `${NAME ? `Happy Birthday, ${NAME}` : "Happy Birthday"} ${emoji}\nI made you a little birthday book ♡\n${url()}`;
    const panel = el("div", "endcard", `
      <p class="endcard-title">loved it? pass the joy on ♡</p>
      <div class="endcard-row">
        <button type="button" data-do="wa"><span>WhatsApp</span></button>
        <button type="button" data-do="copy"><span>copy link</span></button>
        <button type="button" data-do="again"><span>read again</span></button>
      </div>
      ${brand.url ? `<a class="endcard-make" href="${esc(brand.url)}" target="_blank" rel="noopener">${esc(brand.text || "make a birthday book for someone you love ♡")}</a>` : ""}`);
    ["wa", "copy", "again"].forEach((k, i) => {
      const b = panel.querySelector(`[data-do="${k}"]`); b.insertBefore(pic(i, "btn-ico", 22), b.firstChild);
    });
    document.body.appendChild(panel);
    const say = t => {
      const toast = $("toast"); if (!toast) return;
      toast.textContent = t; toast.classList.add("show");
      clearTimeout(say.t); say.t = setTimeout(() => toast.classList.remove("show"), 2200);
    };
    panel.addEventListener("click", async e => {
      const what = e.target.closest("button") && e.target.closest("button").dataset.do;
      if (what === "wa") window.open("https://wa.me/?text=" + encodeURIComponent(wish), "_blank", "noopener");
      if (what === "copy") { try { await navigator.clipboard.writeText(url()); say("link copied ♡ send it to someone you love!"); } catch (_) { say("copy the link from the address bar ♡"); } }
      if (what === "again") {
        const back = () => { if ($("counter").textContent.trim() !== "cover" && !$("prev").disabled) { $("prev").click(); setTimeout(back, 260); } };
        back();
      }
    });
    let shown;
    new MutationObserver(() => {
      const end = $("counter").textContent.trim() === "the end";
      clearTimeout(shown);
      if (end) shown = setTimeout(() => panel.classList.add("show"), 1600); else panel.classList.remove("show");
    }).observe($("counter"), { childList: true, characterData: true, subtree: true });
  }
})();
