/* =========================================================
   Sweet Drip — shared site script
   ========================================================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const page = document.body.dataset.page;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(pointer: fine)").matches;
const rupee = (n) => "₹" + n.toLocaleString("en-IN");
const ico = (name, weight = "") => `<i class="${weight ? "ph-" + weight : "ph"} ph-${name}" aria-hidden="true"></i>`;

// Safe localStorage helpers — the site works fine without storage
const store = {
  get(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};

/* ---------- Drip dividers ---------- */
function dripSVG(color) {
  const drips = [
    [1350, 60, 50], [1180, 40, 26], [1040, 70, 62], [860, 46, 34], [700, 60, 70],
    [540, 40, 24], [400, 70, 54], [240, 44, 38], [90, 60, 60],
  ];
  let d = "M0 0H1440V24";
  drips.forEach(([c, w, l]) => {
    const a = c + w / 2, b = c - w / 2;
    d += `H${a}C${a} ${24 + l} ${b} ${24 + l} ${b} 24`;
  });
  d += "H0Z";
  const drops = [[1040, 104], [700, 112], [90, 102]]
    .map(([x, y]) => `<ellipse class="drop" cx="${x}" cy="${y}" rx="8" ry="10"/>`)
    .join("");
  return `<svg class="drip" viewBox="0 0 1440 120" preserveAspectRatio="none" style="color:${color}"><path d="${d}"/>${drops}</svg>`;
}

$$("[data-drip]").forEach((el) => {
  el.outerHTML = dripSVG(el.dataset.color).replace('class="drip"', `class="drip ${el.dataset.drip}"`);
});

/* ---------- Header, footer & global UI ---------- */
const links = [
  ["index.html", "Home", "home"],
  ["menu.html", "Explore", "menu"],
  ["order.html", "Order", "order"],
  ["catering.html", "Catering", "catering"],
  ["about.html", "Our Story", "about"],
  ["reviews.html", "Reviews", "reviews"],
  ["contact.html", "Visit Us", "contact"],
];
// extra pages that live in the footer instead of the top menu
const moreLinks = [
  ["moments.html", "Moments"],
  ["faq.html", "FAQ"],
  ["franchise.html", "Franchise"],
  ["careers.html", "Careers"],
];
const WHATSAPP = "919876543210";

$("#site-header").outerHTML = `
<header class="header" id="header">
  <div class="container header-inner">
    <a href="index.html" class="logo"><span class="logo-mark">${ico("ice-cream", "fill")}</span><span>Sweet Drip<small>Dessert Parlour</small></span></a>
    <nav class="nav" id="nav">
      ${links.map(([href, label, id]) => `<a href="${href}" class="${id === page ? "active" : ""}">${label}</a>`).join("")}
    </nav>
    <form class="gsearch" id="gsearch" action="menu.html" role="search">
      <label>${ico("magnifying-glass")}<input name="q" id="gsearchInput" autocomplete="off" placeholder="Search falooda, gola, truffles…" aria-label="Search desserts" /></label>
      <div class="suggest" id="suggest"></div>
    </form>
    <div class="header-actions">
      <a href="saved.html" class="icon-btn" aria-label="Saved treats" title="Saved">${ico("heart")}<span class="saved-count" id="savedCount">0</span></a>
      <button class="icon-btn" id="cartBtn" aria-label="Open cart">${ico("basket")}<span class="cart-count" id="cartCount">0</span></button>
      <button class="icon-btn menu-btn" id="menuBtn" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>
<div class="progress" id="progress"></div>
<nav class="tabbar" aria-label="Quick navigation">
  <a href="index.html" class="${page === "home" ? "on" : ""}" aria-label="Home">${ico("house", page === "home" ? "fill" : "")}</a>
  <a href="menu.html" class="${page === "menu" ? "on" : ""}" aria-label="Explore">${ico("magnifying-glass")}</a>
  <a href="moments.html#share" class="plus" aria-label="Share a moment">${ico("plus")}</a>
  <a href="saved.html" class="${page === "saved" ? "on" : ""}" aria-label="Saved">${ico("heart", page === "saved" ? "fill" : "")}</a>
  <a href="about.html" class="${["about", "contact", "moments", "order", "catering", "reviews", "faq", "franchise", "careers"].includes(page) ? "on" : ""}" aria-label="Our story">${ico("storefront")}</a>
</nav>`;

$("#site-footer").outerHTML = `
<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div data-reveal="up">
        <a href="index.html" class="logo"><span class="logo-mark">${ico("ice-cream", "fill")}</span><span>Sweet Drip<small>Dessert Parlour</small></span></a>
        <p>Ice cream, falooda, ice gola, kulfi, chocolates and everything sweet — made fresh every day by the Mehta family since 1968.</p>
        <div class="socials">
          <a href="#" aria-label="Instagram">${ico("instagram-logo")}</a>
          <a href="#" aria-label="Facebook">${ico("facebook-logo")}</a>
          <a href="#" aria-label="YouTube">${ico("youtube-logo")}</a>
          <a href="https://wa.me/${WHATSAPP}" aria-label="WhatsApp">${ico("whatsapp-logo")}</a>
        </div>
      </div>
      <div class="footer-links" data-reveal="up" style="--d:.1s">
        <h4>Explore</h4>
        ${[...links, ...moreLinks].map(([href, label]) => `<a href="${href}">${label}</a>`).join("")}
      </div>
      <div class="footer-links" data-reveal="up" style="--d:.2s">
        <h4>Treats</h4>
        <a href="menu.html#icecream">Ice Cream</a><a href="menu.html#falooda">Falooda</a><a href="menu.html#gola">Ice Gola</a><a href="menu.html#chocolate">Chocolates</a><a href="menu.html#kulfi">Kulfi</a>
      </div>
      <div class="footer-links footer-contact" data-reveal="up" style="--d:.3s">
        <h4>Say hello</h4>
        <a href="tel:+919876543210">${ico("phone")} +91 98765 43210</a>
        <a href="mailto:hello@sweetdrip.in">${ico("envelope-simple")} hello@sweetdrip.in</a>
        <a href="contact.html">${ico("map-pin")} 6 parlours in Mumbai</a>
        <a href="contact.html">${ico("clock")} 11 AM – 1 AM daily</a>
      </div>
    </div>
    <div class="footer-big" data-reveal="fade">Sweet Drip</div>
    <div class="footer-bottom"><span>© ${new Date().getFullYear()} Sweet Drip. All rights reserved.</span><span>Made with ${ico("heart", "fill")} &amp; extra sprinkles</span></div>
  </div>
</footer>

<a class="wa-float" href="https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Hi Sweet Drip! I'd like to place an order.")}" target="_blank" rel="noopener">${ico("whatsapp-logo", "fill")}<span>Order on WhatsApp</span></a>

<div class="overlay" id="overlay"></div>
<aside class="drawer" id="drawer" aria-label="Your cart">
  <div class="drawer-head"><h3>Your cart</h3><button class="icon-btn" id="closeCart" aria-label="Close cart">${ico("x")}</button></div>
  <div class="drawer-body" id="cartBody"></div>
  <div class="drawer-foot" id="cartFoot">
    <div class="mode-switch" id="modeSwitch" role="tablist" aria-label="How do you want it?">
      <button data-mode="delivery" role="tab">${ico("moped")} Delivery</button>
      <button data-mode="pickup" role="tab">${ico("storefront")} Pickup</button>
    </div>
    <div class="mode-extra" id="modeExtra"></div>
    <p class="free-note" id="freeNote"></p>
    <div class="free-bar"><span id="freeBar"></span></div>
    <div class="row-between"><span>Subtotal</span><span id="subTotal">₹0</span></div>
    <div class="row-between"><span>Delivery</span><span id="delivery">₹0</span></div>
    <div class="row-between total"><span>Total</span><span id="grandTotal">₹0</span></div>
    <button class="btn btn-primary" id="checkout">Place order ${ico("arrow-right")}</button>
  </div>
</aside>

<div class="lightbox" id="lightbox"><button aria-label="Close">${ico("x")}</button><figure><img alt="" /><figcaption></figcaption></figure></div>
<button class="to-top" id="toTop" aria-label="Back to top">
  <svg class="ring" viewBox="0 0 56 56"><circle cx="28" cy="28" r="26" id="toTopRing"/></svg>
  ${ico("arrow-up")}
</button>
<div class="toast" id="toast" role="status"></div>`;

/* ---------- Toast & confetti ---------- */
let toastTimer;
function toast(msg, icon = "check-circle") {
  const t = $("#toast");
  t.innerHTML = `${ico(icon, "fill")}<span></span>`;
  $("span", t).textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

const confettiColors = ["#ff4f8b", "#ffb627", "#2ec4b6", "#9b5de5", "#5a3424", "#ff86ad"];
function confetti(x, y, count = 36) {
  if (reduceMotion) return;
  for (let i = 0; i < count; i++) {
    const c = document.createElement("span");
    c.className = "confetti";
    c.style.left = x + "px";
    c.style.top = y + "px";
    c.style.background = confettiColors[i % confettiColors.length];
    document.body.appendChild(c);
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 160;
    c.animate(
      [
        { transform: "translate(-50%,-50%) rotate(0)", opacity: 1 },
        { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist + 120}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 600, easing: "cubic-bezier(.2,.7,.3,1)" }
    ).onfinish = () => c.remove();
  }
}

const burstFrom = (el) => {
  const r = el.getBoundingClientRect();
  confetti(r.left + r.width / 2, r.top + r.height / 2);
};

/* ---------- Header behaviour ---------- */
const header = $("#header");
const nav = $("#nav");
const menuBtn = $("#menuBtn");

menuBtn.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuBtn.classList.toggle("open", open);
  menuBtn.setAttribute("aria-expanded", open);
});

/* ---------- Scroll effects ---------- */
const progress = $("#progress");
const toTop = $("#toTop");
const ring = $("#toTopRing");
const ringLen = 2 * Math.PI * 26;
ring.style.strokeDasharray = ringLen;
let lastY = 0;
let ticking = false;
const scrollHooks = [];

function onScroll() {
  const y = scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  const p = max > 0 ? y / max : 0;
  progress.style.transform = `scaleX(${p})`;
  ring.style.strokeDashoffset = ringLen * (1 - p);
  header.classList.toggle("scrolled", y > 30);
  header.classList.toggle("hidden", y > 500 && y > lastY && !nav.classList.contains("open"));
  toTop.classList.toggle("show", y > 600);
  lastY = y;

  if (!reduceMotion) {
    $$("[data-parallax]").forEach((el) => {
      const r = el.parentElement.getBoundingClientRect();
      const off = (r.top + r.height / 2 - innerHeight / 2) * parseFloat(el.dataset.parallax);
      const max = r.height * 0.08;
      el.style.translate = `0 ${Math.max(-max, Math.min(max, off))}px`;
    });
  }
  scrollHooks.forEach((fn) => fn());
  ticking = false;
}

addEventListener("scroll", () => {
  if (!ticking) {
    requestAnimationFrame(onScroll);
    ticking = true;
  }
}, { passive: true });

toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

/* ---------- Reveal on scroll & counters ---------- */
function countUp(el) {
  const target = Number(el.dataset.count);
  const suffix = el.dataset.suffix || "";
  const start = performance.now();
  const dur = 1800;
  const step = (t) => {
    const p = Math.min(1, (t - start) / dur);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4))).toLocaleString("en-IN") + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// squiggle underline under highlighted words
$$(".title .hl").forEach((hl) => {
  hl.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 200 20" preserveAspectRatio="none"><path d="M3 14 Q 30 3 55 12 T 105 11 T 155 10 T 197 8"/></svg>');
});

const revealIO = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      if (e.target.dataset.count !== undefined) countUp(e.target);
      revealIO.unobserve(e.target);
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);

let started = false;
function observeReveals(root = document) {
  if (!started) return;
  $$("[data-reveal]:not(.in), [data-count]", root).forEach((el) => revealIO.observe(el));
}

/* ---------- Page start (preloader) ---------- */
function startPage() {
  started = true;
  document.body.classList.add("ready");
  document.body.classList.remove("locked");
  observeReveals();
  onScroll();
}

const preloader = $("#preloader");
if (preloader) {
  const t0 = performance.now();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    setTimeout(() => {
      preloader.classList.add("hide");
      startPage();
    }, reduceMotion ? 0 : Math.max(0, 1700 - (performance.now() - t0)));
  };
  // don't hold visitors hostage to slow images — the page is usable once fonts are in
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(finish);
  setTimeout(finish, 2500);
} else {
  requestAnimationFrame(startPage);
}

/* ---------- Magnetic buttons & hero mouse parallax ---------- */
if (finePointer && !reduceMotion) {
  $$(".magnet").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.translate = `${(e.clientX - r.left - r.width / 2) * 0.25}px ${(e.clientY - r.top - r.height / 2) * 0.35}px`;
    });
    el.addEventListener("pointerleave", () => (el.style.translate = ""));
  });

  const hero = $(".hero, .page-hero");
  if (hero) {
    hero.addEventListener("pointermove", (e) => {
      const x = e.clientX / innerWidth - 0.5;
      const y = e.clientY / innerHeight - 0.5;
      $$(".deco", hero).forEach((el, i) => {
        const d = 16 + (i % 4) * 8;
        el.style.translate = `${x * d}px ${y * d}px`;
      });
      const vis = $(".hero-visual", hero);
      if (vis) vis.style.transform = `perspective(1000px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
    });
  }
}

/* ---------- Lightbox (any [data-zoom] element) ---------- */
const lightbox = $("#lightbox");
function closeLightbox() {
  lightbox.classList.remove("open");
}
lightbox.addEventListener("click", closeLightbox);
document.addEventListener("click", (e) => {
  const z = e.target.closest("[data-zoom]");
  if (!z || e.target.closest("a, button")) return;
  const img = z.tagName === "IMG" ? z : $("img", z);
  $("img", lightbox).src = img.src;
  $("figcaption", lightbox).textContent = z.dataset.caption || img.alt || "";
  lightbox.classList.add("open");
});

/* ---------- Product card markup ---------- */
function cardHTML(item, i = 0) {
  const cat = findCat(item.cat);
  return `
  <article class="p-card" style="--c:${cat.color}; --d:${(i % 4) * 0.08}s" data-reveal="up" data-id="${item.id}">
    <div class="media">
      ${item.tag ? `<span class="p-tag">${item.tag}</span>` : ""}
      <button class="p-like" aria-label="Save to favourites">${ico("heart")}</button>
      <img src="${item.img}" alt="${item.name}" loading="lazy" />
      <span class="p-rating">${ico("star", "fill")} ${item.rating}</span>
    </div>
    <div class="p-body">
      <span class="p-cat">${ico(cat.icon, "duotone")} ${cat.name}</span>
      <h3>${item.name}</h3>
      <p>${item.desc}</p>
      <div class="p-foot">
        <span class="price">${rupee(item.price)}</span>
        <button class="add-btn" data-add="${item.id}">${ico("plus")}Add</button>
      </div>
    </div>
  </article>`;
}

/* ---------- Cart ---------- */
const CART_KEY = "sweetdrip-cart";
let cart = store.get(CART_KEY, []);
const saveCart = () => store.set(CART_KEY, cart);

const FREE_DELIVERY = 499;
const cartBtn = $("#cartBtn");
const drawer = $("#drawer");
const overlay = $("#overlay");

function openCart() {
  drawer.classList.add("open");
  overlay.classList.add("show");
  document.body.classList.add("locked");
}

function closeCart() {
  drawer.classList.remove("open");
  overlay.classList.remove("show");
  document.body.classList.remove("locked");
}

cartBtn.addEventListener("click", openCart);
overlay.addEventListener("click", closeCart);
$("#closeCart").addEventListener("click", closeCart);
addEventListener("keydown", (e) => e.key === "Escape" && (closeCart(), closeLightbox()));

function renderCart() {
  const count = cart.reduce((n, c) => n + c.qty, 0);
  const sub = cart.reduce((n, c) => n + c.qty * c.price, 0);
  const pickup = orderMode === "pickup";
  const del = pickup || sub === 0 || sub >= FREE_DELIVERY ? 0 : 40;

  $("#cartCount").textContent = count;
  $("#cartCount").classList.toggle("show", count > 0);

  $("#cartBody").innerHTML = cart.length
    ? cart.map((c) => `
      <div class="cart-item" data-key="${c.key}">
        ${c.img ? `<img src="${c.img}" alt="" />` : `<div style="width:72px;height:72px;border-radius:18px;display:grid;place-items:center;font-size:34px;color:var(--mint);background:#d9f6f3">${ico("snowflake", "duotone")}</div>`}
        <div>
          <h4>${c.name}</h4>
          <div class="ci-price">${rupee(c.price)} each</div>
          <div class="qty"><button data-q="-1" aria-label="Less">${ico("minus")}</button><span>${c.qty}</span><button data-q="1" aria-label="More">${ico("plus")}</button></div>
        </div>
        <button class="ci-remove" aria-label="Remove">${ico("trash")}</button>
      </div>`).join("")
    : `<div class="cart-empty"><div class="big">${ico("ice-cream", "duotone")}</div><h3 style="margin-top:12px">Your cart is feeling empty</h3><p>Add a scoop (or three) to get started.</p><a href="menu.html" class="btn btn-dark btn-sm" style="margin-top:20px">Browse menu</a></div>`;

  $("#cartFoot").style.display = cart.length ? "" : "none";
  $("#subTotal").textContent = rupee(sub);
  $("#delivery").previousElementSibling.textContent = pickup ? "Pickup" : "Delivery";
  $("#delivery").textContent = del ? rupee(del) : "Free";
  $("#grandTotal").textContent = rupee(sub + del);
  $("#freeBar").parentElement.style.display = pickup ? "none" : "";
  $("#freeBar").style.width = Math.min(100, (sub / FREE_DELIVERY) * 100) + "%";
  $("#freeNote").textContent = pickup
    ? "Ready in about 15 minutes at your chosen parlour."
    : sub >= FREE_DELIVERY ? "You've unlocked free delivery!" : `Add ${rupee(FREE_DELIVERY - sub)} more for free delivery`;
  $("#checkout").innerHTML = `${pickup ? "Place pickup order" : "Place order"} · ${rupee(sub + del)} ${ico("arrow-right")}`;
}

/* ---------- Delivery or pickup ---------- */
let orderMode = store.get("sweetdrip-mode", "delivery");
const checkoutInfo = store.get("sweetdrip-checkout", { address: "", branch: BRANCHES[0].id, slot: "ASAP" });

function renderMode() {
  $("#modeSwitch").classList.toggle("pickup", orderMode === "pickup");
  $$("#modeSwitch button").forEach((b) => b.setAttribute("aria-selected", b.dataset.mode === orderMode));
  $("#modeExtra").innerHTML =
    orderMode === "delivery"
      ? `<input id="coAddress" autocomplete="street-address" placeholder="Delivery address (flat, building, area)" value="${escapeAttr(checkoutInfo.address)}" />
         <small>Frozen delivery in 25–35 min within 6 km of a parlour.</small>`
      : `<select id="coBranch" aria-label="Pickup parlour">${BRANCHES.map((b) => `<option value="${b.id}" ${b.id === checkoutInfo.branch ? "selected" : ""}>${b.name}</option>`).join("")}</select>
         <select id="coSlot" aria-label="Pickup time">${["ASAP", "In 30 minutes", "In 1 hour", "This evening, 7 PM"].map((s) => `<option ${s === checkoutInfo.slot ? "selected" : ""}>${s}</option>`).join("")}</select>`;
  if (window.enhanceControls) enhanceControls($("#modeExtra"));
  renderCart();
}
const escapeAttr = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

$("#modeSwitch").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mode]");
  if (!b) return;
  orderMode = b.dataset.mode;
  store.set("sweetdrip-mode", orderMode);
  renderMode();
});
["input", "change"].forEach((ev) => $("#modeExtra").addEventListener(ev, (e) => {
  if (e.target.id === "coAddress") checkoutInfo.address = e.target.value;
  if (e.target.id === "coBranch") checkoutInfo.branch = e.target.value;
  if (e.target.id === "coSlot") checkoutInfo.slot = e.target.value;
  store.set("sweetdrip-checkout", checkoutInfo);
}));

$("#cartBody").addEventListener("click", (e) => {
  const row = e.target.closest(".cart-item");
  if (!row) return;
  const entry = cart.find((c) => c.key === row.dataset.key);
  if (e.target.closest(".ci-remove")) cart = cart.filter((c) => c !== entry);
  const q = e.target.closest("[data-q]");
  if (q) {
    entry.qty += Number(q.dataset.q);
    if (entry.qty < 1) cart = cart.filter((c) => c !== entry);
  }
  saveCart();
  renderCart();
});

$("#checkout").addEventListener("click", (e) => {
  if (orderMode === "delivery" && !checkoutInfo.address.trim()) {
    $("#coAddress").focus();
    return toast("Add a delivery address first", "map-pin");
  }
  burstFrom(e.currentTarget);
  const branch = BRANCHES.find((b) => b.id === checkoutInfo.branch) || BRANCHES[0];
  toast(orderMode === "pickup" ? `Order placed! Pick it up at ${branch.name} (${checkoutInfo.slot}).` : "Order placed! Your treats are on the way.", orderMode === "pickup" ? "storefront" : "moped");
  cart = [];
  saveCart();
  renderCart();
  setTimeout(closeCart, 900);
});

function flyToCart(fromEl) {
  cartBtn.classList.remove("bump");
  void cartBtn.offsetWidth;
  if (reduceMotion || !fromEl) {
    cartBtn.classList.add("bump");
    return;
  }
  const a = fromEl.getBoundingClientRect();
  const b = cartBtn.getBoundingClientRect();
  const size = Math.min(a.width, a.height, 140);
  let fly;
  if (fromEl.tagName === "IMG") {
    fly = document.createElement("img");
    fly.src = fromEl.src;
  } else {
    fly = document.createElement("div");
    fly.innerHTML = ico("snowflake", "fill");
    Object.assign(fly.style, { display: "grid", placeItems: "center", background: "#22b8cf", color: "#fff", fontSize: size * 0.5 + "px" });
  }
  fly.className = "flyer";
  Object.assign(fly.style, {
    left: a.left + a.width / 2 - size / 2 + "px",
    top: a.top + a.height / 2 - size / 2 + "px",
    width: size + "px",
    height: size + "px",
  });
  document.body.appendChild(fly);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  fly.animate(
    [
      { transform: "translate(0,0) scale(1)" },
      { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 120}px) scale(.7) rotate(-15deg)`, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(.12) rotate(-30deg)`, opacity: 0.6 },
    ],
    { duration: 850, easing: "cubic-bezier(.5,0,.3,1)" }
  ).onfinish = () => {
    fly.remove();
    cartBtn.classList.add("bump");
  };
}

function addToCart(entry, fromEl, qty = 1) {
  const existing = cart.find((c) => c.key === entry.key);
  if (existing) existing.qty += qty;
  else cart.push({ ...entry, qty });
  saveCart();
  flyToCart(fromEl);
  setTimeout(renderCart, reduceMotion ? 0 : 800);
  toast(`${entry.name} added to cart`, "basket");
}

// Delegated "Add" + "Like" for every product card
document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (add) {
    e.stopPropagation();
    const item = findItem(add.dataset.add);
    const card = add.closest(".p-card, .pin");
    addToCart({ key: item.id, name: item.name, price: item.price, img: item.img }, card && $("img", card));
    const label = add.classList.contains("round") ? "" : "Added";
    const before = add.innerHTML;
    add.classList.add("added");
    add.innerHTML = `${ico("check")}${label}`;
    setTimeout(() => {
      add.classList.remove("added");
      add.innerHTML = before;
    }, 1400);
  }
  const like = e.target.closest(".p-like");
  if (like) {
    const on = like.classList.toggle("liked");
    like.innerHTML = ico("heart", on ? "fill" : "");
    if (on) toast("Saved to your favourites", "heart");
  }
});

renderMode();

/* ---------- Simple forms with a happy ending ---------- */
[["#subForm", "Welcome to the Sweet Club! Check your inbox.", "envelope-simple"], ["#contactForm", "Almost done — press Send in WhatsApp and we'll call you back within an hour.", "phone"]].forEach(([sel, msg, icon]) => {
  const form = $(sel);
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    burstFrom($("button[type=submit]", form));
    if (sel === "#contactForm") {
      // no server: send the booking to the parlour's WhatsApp so they can call the customer back
      const d = new FormData(form);
      const branch = (typeof BRANCHES !== "undefined" && BRANCHES.find((b) => b.id === d.get("branch"))) || null;
      const lines = [
        "New booking request – Sweet Drip",
        `Name: ${d.get("name")}`,
        `Phone: ${d.get("phone")}`,
        `Parlour: ${branch ? branch.name : d.get("branch")}`,
        `Plan: ${d.get("type")}`,
        `Date: ${d.get("date")} at ${d.get("time")}`,
        `Guests: ${d.get("guests")}`,
      ];
      if (d.get("msg")) lines.push(`Note: ${d.get("msg")}`);
      const to = branch && branch.phone ? branch.phone.replace(/\D/g, "") : WHATSAPP;
      window.open(`https://wa.me/${to}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener");
    }
    toast(msg, icon);
    form.reset();
  });
});

/* ---------- Open / closed status (11 AM – 1 AM) ---------- */
$$("[data-status]").forEach((el) => {
  const h = new Date().getHours();
  const open = h >= 11 || h < 1;
  el.classList.toggle("closed", !open);
  el.textContent = open ? "Open now · till 1 AM" : "Closed · opens 11 AM";
});

/* ---------- Generic segmented tabs with sliding indicator ---------- */
function setupTabs(wrap, onPick) {
  const ind = $(".tab-ind", wrap);
  const move = (btn) => {
    ind.style.left = btn.offsetLeft + "px";
    ind.style.top = btn.offsetTop + "px";
    ind.style.width = btn.offsetWidth + "px";
    ind.style.height = btn.offsetHeight + "px";
  };
  $$(".tab", wrap).forEach((btn) =>
    btn.addEventListener("click", () => {
      $$(".tab", wrap).forEach((t) => t.classList.toggle("active", t === btn));
      move(btn);
      onPick(btn.dataset.val);
    })
  );
  const sync = () => move($(".tab.active", wrap));
  requestAnimationFrame(sync);
  addEventListener("resize", sync);
  document.fonts && document.fonts.ready.then(sync);
}

/* ---------- Reviews slider (home) ---------- */
function setupSlider() {
  const track = $("#track");
  if (!track) return;
  const cards = $$(".t-card", track);
  const dotsWrap = $("#dots");
  let idx = 0;
  let perView = 3;
  const go = (i) => {
    const pages = cards.length - perView + 1;
    idx = (i + pages) % pages;
    const step = cards[0].offsetWidth + 24;
    track.style.transform = `translateX(${-idx * step}px)`;
    $$("button", dotsWrap).forEach((d, n) => d.classList.toggle("on", n === idx));
  };
  const layout = () => {
    perView = innerWidth <= 640 ? 1 : innerWidth <= 1100 ? 2 : 3;
    const pages = cards.length - perView + 1;
    dotsWrap.innerHTML = Array.from({ length: pages }, (_, i) => `<button aria-label="Slide ${i + 1}"></button>`).join("");
    $$("button", dotsWrap).forEach((d, i) => d.addEventListener("click", () => go(i)));
    go(Math.min(idx, pages - 1));
  };
  $("#prev").addEventListener("click", () => go(idx - 1));
  $("#next").addEventListener("click", () => go(idx + 1));
  let auto = setInterval(() => go(idx + 1), 4500);
  track.addEventListener("pointerenter", () => clearInterval(auto));
  track.addEventListener("pointerleave", () => (auto = setInterval(() => go(idx + 1), 4500)));
  addEventListener("resize", layout);
  layout();
}

/* =========================================================
   PINS — save, Pin it, live search, pin closeup
   ========================================================= */
const SAVED_KEY = "sweetdrip-saved";
const saved = new Set(store.get(SAVED_KEY, []));

function syncSaved() {
  store.set(SAVED_KEY, [...saved]);
  const c = $("#savedCount");
  c.textContent = saved.size;
  c.classList.toggle("show", saved.size > 0);
}
syncSaved();

const absUrl = (src) => new URL(src, location.href).href;

function pinHTML(item, i = 0) {
  const cat = findCat(item.cat);
  const on = saved.has(item.id);
  return `
  <article class="pin" data-pin="${item.id}" style="--pd:${(i % 10) * 0.04}s">
    <div class="pin-img" tabindex="0" role="button" aria-label="Open ${item.name}">
      <img src="${item.img}" alt="${item.name}" loading="lazy" ${IMG_SIZES[item.img] ? `width="${IMG_SIZES[item.img][0]}" height="${IMG_SIZES[item.img][1]}"` : ""} />
      <button class="heart-btn ${on ? "saved" : ""}" data-save="${item.id}" aria-label="Favourite">${ico("heart", on ? "fill" : "")}</button>
      <div class="pin-bottom">
        <span class="price-chip">${rupee(item.price)}</span>
        <div class="pin-acts">
          <button class="round add" data-add="${item.id}" aria-label="Add to cart" title="Add to cart">${ico("plus")}</button>
        </div>
      </div>
    </div>
    <div class="pin-meta">
      <h3>${item.name}</h3>
      <div class="by"><span class="av">${ico(cat.icon, "fill")}</span><b>Sweet Drip</b><span class="rate">${ico("star", "fill")} ${item.rating}</span></div>
    </div>
  </article>`;
}

// fade photos in once they have loaded (the shimmer shows until then)
function markLoaded(root = document) {
  $$(".pin-img img:not(.loaded)", root).forEach((img) => {
    if (img.complete && img.naturalWidth) {
      img.classList.add("loaded");
      img.parentElement.classList.add("done");
    }
  });
}
document.addEventListener(
  "load",
  (e) => {
    if (e.target.tagName === "IMG" && e.target.parentElement && e.target.parentElement.classList.contains("pin-img")) {
      e.target.classList.add("loaded");
      e.target.parentElement.classList.add("done");
    }
  },
  true
);

function popIn(grid) {
  markLoaded(grid);
  $$(".pin", grid).forEach((p) => {
    p.classList.remove("pop");
    void p.offsetWidth;
    p.classList.add("pop");
  });
}

function toggleSave(id) {
  const on = !saved.has(id);
  on ? saved.add(id) : saved.delete(id);
  syncSaved();
  $$(`[data-save="${id}"]`).forEach((b) => {
    b.classList.toggle("saved", on);
    if (b.classList.contains("heart-btn")) b.innerHTML = ico("heart", on ? "fill" : "");
    else b.textContent = on ? "Saved" : "Save";
  });
  toast(on ? "Added to favourites" : "Removed from favourites", on ? "heart" : "heart-break");
  if (page === "saved") renderSavedPage();
}

document.addEventListener("click", (e) => {
  const sv = e.target.closest("[data-save]");
  if (sv) {
    e.stopPropagation();
    toggleSave(sv.dataset.save);
    return;
  }
  if (e.target.closest(".pin-acts, .pm-body, .suggest-list a")) return;
  const pin = e.target.closest(".pin[data-pin] .pin-img");
  if (pin) {
    const grid = pin.closest(".pin-grid");
    pinQueue = grid ? $$(".pin[data-pin]", grid).map((p) => p.dataset.pin) : MENU.map((m) => m.id);
    openPin(pin.closest(".pin").dataset.pin);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches(".pin[data-pin] .pin-img")) openPin(e.target.closest(".pin").dataset.pin);
});

/* ---------- Pin closeup ---------- */
let pinQueue = MENU.map((m) => m.id);
let currentPin = null;
const RECENT_KEY = "sweetdrip-recent";
const recent = store.get(RECENT_KEY, []);
document.body.insertAdjacentHTML(
  "beforeend",
  `<div class="pin-modal" id="pinModal" role="dialog" aria-modal="true" aria-label="Dessert details">
    <button class="pm-close" id="pmClose" aria-label="Close">${ico("arrow-left")}</button>
    <button class="pm-nav prev" id="pmPrev" aria-label="Previous dessert">${ico("caret-left")}</button>
    <button class="pm-nav next" id="pmNext" aria-label="Next dessert">${ico("caret-right")}</button>
    <div class="pm-card" id="pmCard"></div>
    <div class="pm-more container"><h3>More like this</h3><div class="pin-grid" id="pmMore"></div></div>
  </div>`
);

const pinModal = $("#pinModal");
const COMMENTS_KEY = "sweetdrip-comments";
const comments = store.get(COMMENTS_KEY, {});
const sampleComments = [
  ["img/face-1.jpg", "Ritika", "Had this last Sunday — absolutely dreamy!"],
  ["img/face-2.jpg", "Arjun", "My kids fight over this every single time."],
  ["img/couple-laugh.jpg", "Rhea", "Perfect for date night, pinned!"],
  ["img/face-3.jpg", "Mr. Iyer", "Tastes just like the old days."],
];
const escapeHTML = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function renderComments(id) {
  const n = id.charCodeAt(id.length - 1);
  const base = [sampleComments[n % 4], sampleComments[(n + 1) % 4]];
  const mine = (comments[id] || []).map((t) => ["", "You", t]);
  $("#pmComments").innerHTML = [...base, ...mine]
    .map(([img, who, text]) => `<div class="pm-comment">${img ? `<img src="${img}" alt="" />` : `<span class="av" style="width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--chip)">${ico("user")}</span>`}<p><b>${who}</b>${escapeHTML(text)}</p></div>`)
    .join("");
}

function openPin(id) {
  const item = findItem(id);
  if (!item) return;
  currentPin = id;
  if (!pinQueue.includes(id)) pinQueue = MENU.map((m) => m.id);
  const ri = recent.indexOf(id);
  if (ri > -1) recent.splice(ri, 1);
  recent.unshift(id);
  recent.length = Math.min(recent.length, 12);
  store.set(RECENT_KEY, recent);
  if (typeof window.renderRecent === "function") window.renderRecent();
  const cat = findCat(item.cat);
  const on = saved.has(id);
  let qty = 1;
  $("#pmCard").innerHTML = `
    <div class="pm-media"><img src="${item.img}" alt="${item.name}" /></div>
    <div class="pm-body">
      <div class="pm-bar">
        <button class="icon-btn" id="pmShare" title="Share" aria-label="Share">${ico("export")}</button>
        <button class="icon-btn" id="pmCopy" title="Copy link" aria-label="Copy link">${ico("link")}</button>
      </div>
      <span class="p-cat" style="--c:${cat.color}">${ico(cat.icon, "duotone")} ${cat.name}</span>
      <h2>${item.name}</h2>
      <p>${item.desc}</p>
      <div class="pm-creator"><span class="av">${ico("ice-cream", "fill")}</span><div><b>Sweet Drip</b><span>12.4k followers · ${ico("star", "fill")} ${item.rating}</span></div><a class="btn btn-ghost btn-sm" href="about.html">Our story</a></div>
      <div class="pm-buy">
        <span class="price">${rupee(item.price)}</span>
        ${item.tag ? `<span class="kicker">${item.tag}</span>` : ""}
        <div class="qty"><button data-mq="-1" aria-label="Less">${ico("minus")}</button><span id="pmQty">1</span><button data-mq="1" aria-label="More">${ico("plus")}</button></div>
      </div>
      <button class="btn btn-primary add-big" id="pmAdd">${ico("basket")} Add to cart</button>
      <div class="pm-comments">
        <h4>Comments</h4>
        <div id="pmComments"></div>
        <form class="pm-say" id="pmSay"><input maxlength="120" required placeholder="Add a comment" aria-label="Add a comment" /><button class="btn btn-dark btn-sm" type="submit">Post</button></form>
      </div>
    </div>`;
  renderComments(id);

  $$("[data-mq]", pinModal).forEach((b) =>
    b.addEventListener("click", () => {
      qty = Math.max(1, Math.min(20, qty + Number(b.dataset.mq)));
      $("#pmQty").textContent = qty;
    })
  );
  $("#pmAdd").addEventListener("click", () => {
    addToCart({ key: item.id, name: item.name, price: item.price, img: item.img }, $(".pm-media img", pinModal), qty);
  });
  const link = new URL(`menu.html?pin=${id}`, location.href).href;
  $("#pmCopy").addEventListener("click", () => {
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(
      () => toast("Link copied", "link"),
      () => toast(link, "link")
    );
  });
  $("#pmShare").addEventListener("click", () => {
    if (navigator.share) navigator.share({ title: item.name, text: item.desc, url: link }).catch(() => {});
    else $("#pmCopy").click();
  });
  $("#pmSay").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("input", e.target);
    (comments[id] = comments[id] || []).push(input.value.trim());
    store.set(COMMENTS_KEY, comments);
    renderComments(id);
    input.value = "";
  });

  const more = [...MENU.filter((m) => m.cat === item.cat && m.id !== id), ...MENU.filter((m) => m.cat !== item.cat)].slice(0, 15);
  $("#pmMore").innerHTML = more.map(pinHTML).join("");
  popIn($("#pmMore"));

  pinModal.classList.add("open");
  pinModal.scrollTop = 0;
  document.body.classList.add("locked");
}

function closePin() {
  pinModal.classList.remove("open");
  if (!drawer.classList.contains("open")) document.body.classList.remove("locked");
}

$("#pmClose").addEventListener("click", closePin);

const stepPin = (dir) => {
  const i = pinQueue.indexOf(currentPin);
  openPin(pinQueue[(i + dir + pinQueue.length) % pinQueue.length]);
};
$("#pmPrev").addEventListener("click", () => stepPin(-1));
$("#pmNext").addEventListener("click", () => stepPin(1));
addEventListener("keydown", (e) => {
  if (!pinModal.classList.contains("open") || e.target.matches("input, textarea")) return;
  if (e.key === "ArrowLeft") stepPin(-1);
  if (e.key === "ArrowRight") stepPin(1);
});
pinModal.addEventListener("click", (e) => {
  if (e.target === pinModal || e.target.classList.contains("pm-more")) closePin();
});
addEventListener("keydown", (e) => e.key === "Escape" && closePin());

/* ---------- Header search with suggestions ---------- */
const gsearch = $("#gsearch");
const gInput = $("#gsearchInput");
const suggest = $("#suggest");

function renderSuggest() {
  const q = gInput.value.trim().toLowerCase();
  const items = q
    ? MENU.filter((m) => `${m.name} ${m.desc} ${findCat(m.cat).name}`.toLowerCase().includes(q)).slice(0, 8)
    : MENU.filter((m) => m.rating >= 4.9).slice(0, 8);
  suggest.innerHTML = `
    ${q ? "" : `<h5>Popular boards</h5><div class="suggest-chips">${CATEGORIES.map((c) => `<a href="menu.html?topic=${c.id}">${c.name}</a>`).join("")}</div>`}
    <h5>${q ? `Results for “${escapeHTML(gInput.value.trim())}”` : "Trending on Sweet Drip"}</h5>
    <div class="suggest-list">${
      items.map((m) => `<a href="menu.html?pin=${m.id}" data-open="${m.id}"><img src="${m.img}" alt="" /><div><b>${m.name}</b><span>${findCat(m.cat).name} · ${rupee(m.price)}</span></div></a>`).join("") ||
      `<p style="padding:8px;color:var(--choc-3)">No treats found — try “mango” or “chocolate”.</p>`
    }</div>`;
}

gInput.addEventListener("focus", () => {
  renderSuggest();
  gsearch.classList.add("open");
});
gInput.addEventListener("input", renderSuggest);
let sugHi = -1;
gInput.addEventListener("keydown", (e) => {
  const items = $$(".suggest-chips a, .suggest-list a", suggest);
  if (!items.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    gsearch.classList.add("open");
    sugHi = (sugHi + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items.forEach((a, i) => a.classList.toggle("hi", i === sugHi));
    items[sugHi].scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter" && sugHi > -1 && items[sugHi]) {
    e.preventDefault();
    items[sugHi].click();
  } else if (e.key === "Escape") {
    gsearch.classList.remove("open");
  }
});
gInput.addEventListener("input", () => (sugHi = -1));
document.addEventListener("click", (e) => {
  if (!gsearch.contains(e.target)) gsearch.classList.remove("open");
});
suggest.addEventListener("click", (e) => {
  const a = e.target.closest("[data-open]");
  if (!a) return;
  e.preventDefault();
  gsearch.classList.remove("open");
  openPin(a.dataset.open);
});

/* =========================================================
   HOME PAGE
   ========================================================= */
if (page === "home") {
  // Modern hero: the word changes and the photo columns wave in
  const themes = [
    { word: "falooda craving", color: "#c2185b", imgs: ["fa-royal-rose", "couple-share", "fa-kesar", "ing-saffron", "fa-strawberry", "ku-rose", "fa-classic", "ing-pistachio", "fa-duo", "couple-laugh", "shop-serving", "ing-milk", "fa-kesar", "su-funfetti"] },
    { word: "gola party", color: "#0a94a8", imgs: ["go-blue", "kid-blue-scoop", "go-rainbow", "moment-friends", "go-mango", "gola-base", "go-strawberry", "ing-mango", "go-malai", "kid-big-cone", "go-rainbow", "moment-truck", "go-blue", "kid-arch"] },
    { word: "chocolate fix", color: "#7a4330", imgs: ["ch-truffles", "ho-pour", "ch-gift-box", "ing-cocoa", "ch-assorted", "ba-choco-cake", "ch-dark-bar", "ba-fudge-brownie", "ch-sprinkle-truffles", "sh-freak", "ho-marshmallow", "ba-brownie-sizzler", "ic-chocolate-cone", "su-hot-fudge"] },
    { word: "kulfi break", color: "#d97706", imgs: ["ku-mango", "ing-mango", "ku-rose", "kid-pop", "ku-strawberry", "ing-strawberry", "ku-rocket", "ku-fruit", "in-gulab-jamun", "ing-milk", "ku-mango", "in-sweet-shop", "ku-rose", "ing-pistachio"] },
    { word: "date-night sundae", color: "#e60023", imgs: ["su-hot-fudge", "couple-counter", "su-funfetti", "couple-sunset", "su-caramel", "ic-party-cones", "su-choco-chip", "couple-steps", "sh-strawberry", "ba-strawberry-waffle", "ic-berry-cones", "couple-share", "sh-oreo", "ic-strawberry-cone"] },
  ];
  const hero = $("#phero");
  const words = $("#heroWords");
  const dotsWrap = $("#heroDots");
  const cols = $$("#cols .col");
  const colImgs = cols.map((col) => $$("img", col));

  words.innerHTML = themes.map((t, i) => `<span class="word ${i === 0 ? "on" : ""}" style="--wc:${t.color}">${t.word}</span>`).join("");
  dotsWrap.innerHTML = themes.map((t, i) => `<button class="${i === 0 ? "on" : ""}" aria-label="Show ${t.word}"></button>`).join("");
  // preload every hero photo so the waves never flash
  themes.forEach((t) => t.imgs.forEach((n) => (new Image().src = `img/${n}.jpg`)));

  let ti = 0;
  const paint = (t, first) => {
    colImgs.forEach((imgs, c) =>
      imgs.forEach((img, k) => {
        const src = `img/${t.imgs[(c * 2 + k) % t.imgs.length]}.jpg`;
        if (first) {
          img.src = src;
          requestAnimationFrame(() => img.classList.add("on"));
          return;
        }
        img.classList.replace("on", "off");
        setTimeout(() => {
          img.src = src;
          img.classList.remove("off");
          void img.offsetWidth;
          img.classList.add("on");
        }, 650 + c * 60);
      })
    );
  };
  const show = (i) => {
    const prev = ti;
    ti = (i + themes.length) % themes.length;
    if (prev === ti) return;
    const ws = $$(".word", words);
    ws[prev].classList.replace("on", "off");
    setTimeout(() => ws[prev].classList.remove("off"), 800);
    ws[ti].classList.add("on");
    $$("button", dotsWrap).forEach((d, n) => d.classList.toggle("on", n === ti));
    hero.style.setProperty("--wc", themes[ti].color);
    paint(themes[ti]);
  };
  hero.style.setProperty("--wc", themes[0].color);
  paint(themes[0], true);
  let heroTimer = setInterval(() => show(ti + 1), 4800);
  $$("button", dotsWrap).forEach((d, i) =>
    d.addEventListener("click", () => {
      clearInterval(heroTimer);
      show(i);
      heroTimer = setInterval(() => show(ti + 1), 4800);
    })
  );

  // Topic chips + masonry feed
  const feed = $("#feed");
  const topics = $("#topics");
  topics.innerHTML =
    `<button class="topic on" data-topic="all">${ico("sparkle", "fill")} All</button>` +
    CATEGORIES.map((c) => `<button class="topic" data-topic="${c.id}">${ico(c.icon, "duotone")} ${c.name}</button>`).join("");
  // mix categories so the feed feels like a real home feed
  const mixed = [...MENU].sort((a, b) => ((a.id.charCodeAt(1) * 7 + a.id.charCodeAt(2) * 13) % 17) - ((b.id.charCodeAt(1) * 7 + b.id.charCodeAt(2) * 13) % 17));
  const moreBtn = $("#feedMore");
  let feedList = [];
  let shown = 0;
  const showMore = () => {
    const next = feedList.slice(shown, shown + 20);
    feed.insertAdjacentHTML("beforeend", next.map(pinHTML).join(""));
    markLoaded(feed);
    $$(".pin:not(.pop)", feed).forEach((p) => p.classList.add("pop"));
    shown += next.length;
    moreBtn.style.display = shown < feedList.length ? "" : "none";
  };
  const showFeed = (topic) => {
    feedList = topic === "all" ? mixed : MENU.filter((m) => m.cat === topic);
    feed.innerHTML = "";
    shown = 0;
    showMore();
  };
  moreBtn.addEventListener("click", showMore);
  topics.addEventListener("click", (e) => {
    const t = e.target.closest(".topic");
    if (!t) return;
    $$(".topic", topics).forEach((x) => x.classList.toggle("on", x === t));
    showFeed(t.dataset.topic);
    const top = feed.getBoundingClientRect().top + scrollY - 150;
    if (scrollY > top) scrollTo({ top, behavior: "smooth" });
  });
  showFeed("all");

  // Recently viewed
  window.renderRecent = () => {
    const items = recent.map(findItem).filter(Boolean);
    $("#recentSec").hidden = items.length === 0;
    $("#recentRow").innerHTML = items
      .map((m) => `<button class="recent-card" data-open-recent="${m.id}"><img src="${m.img}" alt="" loading="lazy" /><span>${m.name}</span><small>${rupee(m.price)}</small></button>`)
      .join("");
  };
  $("#recentRow").addEventListener("click", (e) => {
    const b = e.target.closest("[data-open-recent]");
    if (!b) return;
    pinQueue = recent.slice();
    openPin(b.dataset.openRecent);
  });
  $("#recentClear").addEventListener("click", () => {
    recent.length = 0;
    store.set(RECENT_KEY, recent);
    window.renderRecent();
  });
  window.renderRecent();

  // Boards
  $("#boards").innerHTML = CATEGORIES.map((c) => {
    const imgs = MENU.filter((m) => m.cat === c.id).slice(0, 3).map((m) => m.img);
    while (imgs.length < 3) imgs.push(c.cover);
    return `<a class="board-card" href="menu.html?topic=${c.id}" style="--c:${c.color}" data-reveal="up">
      <div class="board-cover">${imgs.map((src) => `<img src="${src}" alt="" loading="lazy" />`).join("")}</div>
      <h3>${ico(c.icon, "fill")} ${c.name}</h3>
      <p>${MENU.filter((m) => m.cat === c.id).length} treats · ${c.blurb}</p>
    </a>`;
  }).join("");

  // Realistic gola builder: syrup is multiplied into a real shaved-ice photo
  const rg = $("#rgola");
  const layers = $$(".syrup-layer", rg);
  const syrups = [];
  const tops = new Set();
  const MOUND_TOP = 16;
  const MOUND_BOTTOM = 84;

  const paintGola = (changedName) => {
    const n = syrups.length;
    layers.forEach((l, i) => {
      const s = syrups[i];
      if (!s) {
        l.classList.remove("on");
        return;
      }
      const span = MOUND_BOTTOM - MOUND_TOP;
      const start = i === 0 ? 0 : MOUND_TOP + (span * i) / n;
      const end = i === n - 1 ? 100 : MOUND_TOP + (span * (i + 1)) / n;
      l.style.setProperty("--sc", s.color);
      l.style.setProperty("--a0", `${Math.max(0, start - 4)}%`);
      l.style.setProperty("--a1", `${i === 0 ? 0 : start + 4}%`);
      l.style.setProperty("--b0", `${i === n - 1 ? 100 : end - 4}%`);
      l.style.setProperty("--b1", `${i === n - 1 ? 100 : end + 4}%`);
      if (!l.classList.contains("on")) setTimeout(() => l.classList.add("on"), reduceMotion ? 0 : 120);
    });
    rg.classList.toggle("wet", n > 0);
    $$(".rtop", rg).forEach((t) => t.classList.toggle("on", tops.has(t.dataset.top)));
    rg.classList.toggle("has-scoop", tops.has("scoop"));
    const toppingCost = [...tops].reduce((sum, t) => sum + Number($(`#toppings [data-top="${t}"]`).dataset.price), 0);
    const price = 79 + Math.max(0, n - 1) * 10 + toppingCost;
    $("#golaPrice").textContent = rupee(price);
    $("#pourNote").textContent = changedName ? `Pouring ${changedName} syrup…` : n ? `${syrups.map((s) => s.name).join(" + ")} gola` : "Plain shaved ice — pick a syrup to pour";
    return price;
  };

  $$("#syrups .syrup").forEach((btn) =>
    btn.addEventListener("click", () => {
      const name = btn.dataset.name;
      const idx = syrups.findIndex((s) => s.name === name);
      let poured = null;
      if (idx > -1) syrups.splice(idx, 1);
      else if (syrups.length < 3) {
        syrups.push({ name, color: btn.dataset.color });
        poured = name;
      } else toast("Max 3 syrups — remove one first", "warning-circle");
      $$("#syrups .syrup").forEach((b) => b.classList.toggle("on", syrups.some((s) => s.name === b.dataset.name)));
      // re-pour every layer so bands re-settle when the mix changes
      layers.forEach((l) => l.classList.remove("on"));
      paintGola(poured);
      if (poured) setTimeout(() => paintGola(), 1400);
    })
  );

  $$("#toppings .chip").forEach((btn) =>
    btn.addEventListener("click", () => {
      const t = btn.dataset.top;
      tops.has(t) ? tops.delete(t) : tops.add(t);
      btn.classList.toggle("on", tops.has(t));
      paintGola();
    })
  );

  $("#golaAdd").addEventListener("click", (e) => {
    if (!syrups.length) return toast("Pick at least one syrup first", "warning-circle");
    const price = paintGola();
    const extras = [...tops].map((t) => $(`#toppings [data-top="${t}"]`).textContent.replace(/\+₹\d+/, "").trim());
    const name = `Custom Gola (${syrups.map((s) => s.name).join(" + ")}${extras.length ? " with " + extras.join(", ") : ""})`;
    addToCart({ key: "gola-" + syrups.map((s) => s.name).join("-") + [...tops].join("-"), name, price, img: "img/gola-base.jpg" }, $("img", rg));
    burstFrom(e.currentTarget);
  });

  // a pretty starting gola
  $('#syrups [data-name="Rose"]').click();
  setTimeout(() => $('#syrups [data-name="Blue Raspberry"]').click(), 900);

  // Countdown to the end of this Sunday
  const end = new Date();
  end.setDate(end.getDate() + ((7 - end.getDay()) % 7 || 7));
  end.setHours(23, 59, 59, 0);
  const units = { d: 86400, h: 3600, m: 60, s: 1 };
  const tickDown = () => {
    let left = Math.max(0, Math.floor((end - Date.now()) / 1000));
    Object.entries(units).forEach(([u, sec]) => {
      const v = String(Math.floor(left / sec)).padStart(2, "0");
      left %= sec;
      const el = $(`[data-unit="${u}"]`);
      if (el.textContent !== v) {
        el.textContent = v;
        el.classList.remove("tick");
        void el.offsetWidth;
        el.classList.add("tick");
      }
    });
  };
  tickDown();
  setInterval(tickDown, 1000);

  setupSlider();
}

/* =========================================================
   EXPLORE (menu) PAGE — search results
   ========================================================= */
if (page === "menu") {
  const params = new URLSearchParams(location.search);
  const grid = $("#exploreGrid");
  const topics = $("#topics");
  const input = $("#menuSearch");
  let topic = params.get("topic") || "all";

  topics.innerHTML =
    `<button class="topic" data-topic="all">${ico("sparkle", "fill")} All</button>` +
    CATEGORIES.map((c) => `<button class="topic" data-topic="${c.id}">${ico(c.icon, "duotone")} ${c.name}</button>`).join("");

  let price = "all";
  const sorters = {
    popular: (a, b) => (b.tag ? 1 : 0) - (a.tag ? 1 : 0) || b.rating - a.rating,
    rating: (a, b) => b.rating - a.rating,
    low: (a, b) => a.price - b.price,
    high: (a, b) => b.price - a.price,
  };
  const render = () => {
    const q = input.value.trim().toLowerCase();
    const [lo, hi] = price === "all" ? [0, Infinity] : price.split("-").map(Number);
    const list = MENU.filter(
      (m) =>
        (topic === "all" || m.cat === topic) &&
        m.price >= lo && m.price <= hi &&
        (!q || `${m.name} ${m.desc} ${findCat(m.cat).name}`.toLowerCase().includes(q))
    ).sort(sorters[$("#sortBy").value]);
    $$(".topic", topics).forEach((t) => t.classList.toggle("on", t.dataset.topic === topic));
    grid.innerHTML = list.map(pinHTML).join("");
    popIn(grid);
    $("#menuEmpty").classList.toggle("show", list.length === 0);
    const cat = findCat(topic);
    $("#exploreTitle").innerHTML = cat ? `${ico(cat.icon, "duotone")} ${cat.name}` : q ? `Results for “${escapeHTML(input.value.trim())}”` : "Explore every treat";
    $("#exploreCount").textContent = `${list.length} treats`;
  };

  topics.addEventListener("click", (e) => {
    const t = e.target.closest(".topic");
    if (!t) return;
    topic = t.dataset.topic;
    history.replaceState(null, "", topic === "all" ? "menu.html" : `menu.html?topic=${topic}`);
    render();
  });
  $("#priceChips").addEventListener("click", (e) => {
    const t = e.target.closest(".topic");
    if (!t) return;
    price = t.dataset.p;
    $$(".topic", e.currentTarget).forEach((x) => x.classList.toggle("on", x === t));
    render();
  });
  $("#sortBy").addEventListener("change", render);
  input.value = params.get("q") || "";
  gInput.value = input.value;
  input.addEventListener("input", render);
  render();
  if (params.get("pin")) openPin(params.get("pin"));
}

/* =========================================================
   SAVED PAGE — your board
   ========================================================= */
function renderSavedPage() {
  const items = MENU.filter((m) => saved.has(m.id));
  $("#savedGrid").innerHTML = items.map(pinHTML).join("");
  $("#savedEmpty").style.display = items.length ? "none" : "";
  $("#savedStats").textContent = `${items.length} favourite${items.length === 1 ? "" : "s"}`;
}

if (page === "saved") {
  renderSavedPage();
  popIn($("#savedGrid"));
}

/* =========================================================
   ABOUT PAGE — shop strip, memories, team, ingredients
   ========================================================= */
if (page === "about") {
  // Shop strip pinned while it scrolls sideways
  const strip = $("#shopStrip");
  const track = $("#shopTrack");
  const bar = $("#shopProgress");
  scrollHooks.push(() => {
    if (innerWidth <= 900 || reduceMotion) return;
    const r = strip.getBoundingClientRect();
    const total = strip.offsetHeight - innerHeight;
    const p = Math.min(1, Math.max(0, -r.top / total));
    const dist = track.scrollWidth - innerWidth + 80;
    track.style.transform = `translateX(${-p * dist}px)`;
    bar.style.width = p * 100 + "%";
  });

  $("#board").innerHTML = MEMORIES.map((m, i) => `
    <figure class="polaroid" data-reveal="zoom" style="--d:${(i % 4) * 0.1}s" data-zoom data-caption="${m.year} — ${m.caption}">
      <div class="photo"><img src="${m.img}" alt="${m.caption}" loading="lazy" /></div>
      <span class="year">${m.year}</span>
      <p>${m.caption}</p>
    </figure>`).join("");

  $("#team").innerHTML = TEAM.map((t, i) => `
    <article class="flip" data-reveal="up" style="--d:${(i % 4) * 0.1}s" tabindex="0" aria-label="${t.name}, ${t.role}">
      <div class="flip-inner">
        <div class="flip-front">
          <img src="${t.img}" alt="${t.name}" loading="lazy" />
          <span class="hint">${ico("arrows-clockwise")}</span>
          <div class="info"><h3>${t.name}</h3><span>${t.role}</span></div>
        </div>
        <div class="flip-back">
          <span class="qmark">${ico("quotes", "fill")}</span>
          <blockquote>${t.quote}</blockquote>
          <dl>
            <dt>${ico("ice-cream")} Favourite treat</dt><dd>${t.fav}</dd>
            <dt>${ico("calendar-check")} With us for</dt><dd>${t.years} years</dd>
          </dl>
        </div>
      </div>
    </article>`).join("");
  // tap to flip on touch screens
  $$(".flip").forEach((f) => f.addEventListener("click", () => f.classList.toggle("flipped")));

  $("#ingredients").innerHTML = INGREDIENTS.map((g, i) => `
    <article class="ing" data-reveal="up" style="--d:${(i % 3) * 0.1}s; --pct:${g.pct}%">
      <div class="ph-wrap"><img src="${g.img}" alt="${g.name}" loading="lazy" />${ico(g.icon, "fill")}</div>
      <div>
        <h3>${g.name}</h3>
        <div class="amt">${g.amount} <small>${g.per}</small></div>
        <p>${g.note}</p>
        <div class="meter" title="Used in ${g.pct}% of our recipes"><span></span></div>
        <p>In ${g.pct}% of our recipes</p>
      </div>
    </article>`).join("");

  // Timeline fills as you scroll
  scrollHooks.push(() => {
    const tl = $("#timeline");
    const r = tl.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * 0.7 - r.top) / r.height));
    $("#timelineFill").style.height = p * 100 + "%";
  });
}

/* =========================================================
   MOMENTS PAGE — love wall, likes and sharing
   ========================================================= */
if (page === "moments") {
  const LIKES_KEY = "sweetdrip-likes";
  const SHARED_KEY = "sweetdrip-moments";
  const liked = new Set(store.get(LIKES_KEY, []));
  const shared = store.get(SHARED_KEY, []);
  const tagIcon = { couples: "heart", family: "house", kids: "baby", friends: "users-three" };
  const wall = $("#wall");
  let filter = "all";

  const momentHTML = (m, fresh) => {
    const key = m.id || m.img;
    const isLiked = liked.has(key);
    return `
    <article class="pin moment ${fresh ? "fresh" : ""}" data-tag="${m.tag}" data-reveal="up">
      <div class="pin-img" data-zoom data-caption="${m.name} — ${m.caption}">
        <img src="${m.img}" alt="${m.caption}" loading="lazy" />
      </div>
      <div class="pin-meta">
        <h3>${m.caption}</h3>
        <div class="by">
          <span class="av">${ico(tagIcon[m.tag] || "heart", "fill")}</span><b>${m.name}</b>
          <button class="like-btn ${isLiked ? "liked" : ""}" data-key="${key}" data-base="${m.likes}" aria-label="Like">${ico("heart", isLiked ? "fill" : "")}<span>${m.likes + (isLiked ? 1 : 0)}</span></button>
        </div>
      </div>
    </article>`;
  };

  const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const renderWall = () => {
    wall.innerHTML = [...shared.map((m) => momentHTML(m, true)), ...MOMENTS.map((m) => momentHTML(m))].join("");
    applyFilter();
    observeReveals(wall);
  };

  const applyFilter = () => {
    $$(".moment", wall).forEach((m) => m.classList.toggle("hide", filter !== "all" && m.dataset.tag !== filter));
  };

  setupTabs($("#momentTabs"), (val) => {
    filter = val;
    applyFilter();
    $$(".moment:not(.hide)", wall).forEach((m, i) => {
      m.classList.remove("in");
      m.style.setProperty("--d", (i % 8) * 0.05 + "s");
      void m.offsetWidth;
      m.classList.add("in");
    });
  });

  wall.addEventListener("click", (e) => {
    const btn = e.target.closest(".like-btn");
    if (!btn) return;
    const key = btn.dataset.key;
    const on = !liked.has(key);
    on ? liked.add(key) : liked.delete(key);
    store.set(LIKES_KEY, [...liked]);
    btn.classList.toggle("liked", on);
    btn.innerHTML = `${ico("heart", on ? "fill" : "")}<span>${Number(btn.dataset.base) + (on ? 1 : 0)}</span>`;
    if (on) burstFrom(btn);
  });

  renderWall();

  // Share form: preview, downscale, add to the wall
  const form = $("#shareForm");
  const drop = $("#dropzone");
  const fileInput = $("#shareFile");
  let photoData = null;

  const loadFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return toast("Please choose a photo (JPG or PNG)", "warning-circle");
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // shrink to 700px so it fits comfortably in browser storage
        const scale = Math.min(1, 700 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        photoData = c.toDataURL("image/jpeg", 0.8);
        $(".preview", drop).src = photoData;
        drop.classList.add("has-img");
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => (e.preventDefault(), drop.classList.add("drag"))));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("drag")));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    loadFile(e.dataTransfer.files[0]);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!photoData) return toast("Add a photo first", "camera");
    const data = new FormData(form);
    const moment = {
      id: "u" + Date.now(),
      img: photoData,
      tag: data.get("tag"),
      name: escape(data.get("name").trim()),
      caption: escape(data.get("caption").trim()),
      likes: 0,
    };
    shared.unshift(moment);
    while (shared.length > 6) shared.pop();
    const saved = store.set(SHARED_KEY, shared);
    renderWall();
    burstFrom($("button[type=submit]", form));
    toast(saved ? "Your moment is on the wall!" : "Posted for this visit (storage is full)", "heart");
    form.reset();
    photoData = null;
    drop.classList.remove("has-img");
    $("#wallTop").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  });
}

/* =========================================================
   CONTACT PAGE — FAQ search & accordion, ask a question
   ========================================================= */
if (page === "contact") {
  const faq = $("#faq");
  faq.innerHTML = FAQS.map((f, i) => `
    <div class="faq-item ${i === 0 ? "open" : ""}" data-reveal="up" style="--d:${i * 0.05}s">
      <button class="faq-q">${f.q}<span class="pm"></span></button>
      <div class="faq-a"><div><p>${f.a}</p></div></div>
    </div>`).join("");

  faq.addEventListener("click", (e) => {
    const q = e.target.closest(".faq-q");
    if (!q) return;
    const item = q.parentElement;
    const open = !item.classList.contains("open");
    $$(".faq-item", faq).forEach((f) => f.classList.remove("open"));
    item.classList.toggle("open", open);
  });

  $("#faqSearch").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    $$(".faq-item", faq).forEach((item) => item.classList.toggle("hide", !!q && !item.textContent.toLowerCase().includes(q)));
  });

  // Ask a question — questions the visitor sends appear at the top as "awaiting reply"
  const QA_KEY = "sweetdrip-questions";
  const answered = [
    { name: "Kavya", q: "Is the falooda available in a takeaway jar?", a: "Yes! Every falooda comes in a sealed 500 ml jar for takeaway and delivery.", when: "2 days ago" },
    { name: "Imran", q: "Do you do eggless ice-cream cakes?", a: "All our ice-cream cakes are eggless. Order 48 hours ahead for custom designs.", when: "5 days ago" },
    { name: "Pooja", q: "Can kids make their own gola at the parlour?", a: "On weekends our Juhu parlour runs a 'Gola Lab' where kids pick syrups and shave the ice themselves.", when: "1 week ago" },
  ];
  const mine = store.get(QA_KEY, []);
  const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const renderQA = () => {
    $("#qaList").innerHTML = [
      ...mine.map((m) => `<div class="qa pending"><div class="q">${ico("question", "duotone")}<span>${m.q}</span></div><div class="a">${ico("hourglass-medium", "duotone")}<span>Thanks ${m.name}! Our team will reply within a few hours.</span></div><span class="meta">Asked just now · ${m.topic}</span></div>`),
      ...answered.map((m) => `<div class="qa"><div class="q">${ico("question", "duotone")}<span>${m.q}</span></div><div class="a">${ico("chat-circle-dots", "duotone")}<span>${m.a}</span></div><span class="meta">Asked by ${m.name} · ${m.when}</span></div>`),
    ].join("");
  };
  renderQA();

  $("#askForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    mine.unshift({ name: escape(data.get("name").trim()), q: escape(data.get("question").trim()), topic: escape(data.get("topic")) });
    while (mine.length > 5) mine.pop();
    store.set(QA_KEY, mine);
    renderQA();
    burstFrom($("button[type=submit]", e.target));
    toast("Question sent! We'll reply soon.", "chat-circle-dots");
    e.target.reset();
  });
}

/* =========================================================
   VISIT US — parlour finder with a live map
   ========================================================= */
if (page === "contact") {
  const list = $("#branchList");
  const hourNow = new Date().getHours() + new Date().getMinutes() / 60;
  const isOpen = (b) => {
    const h = hourNow < 5 ? hourNow + 24 : hourNow; // after midnight counts as "late last night"
    return h >= b.hours[0] && h < b.hours[1];
  };
  const fmtHour = (h) => {
    h %= 24;
    return `${h % 12 || 12} ${h >= 12 ? "PM" : "AM"}`;
  };
  const dirUrl = (b) => `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;
  const viewUrl = (b) => `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`;
  const km = (a, b) => {
    const R = 6371;
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };

  let userPos = null;
  let filter = "all";
  let activeId = null;

  $("#bookBranch").innerHTML = BRANCHES.map((b) => `<option>${b.name}</option>`).join("");
  $("#bookDate").min = new Date().toISOString().slice(0, 10);

  const statusHTML = (b) =>
    isOpen(b)
      ? `<span class="dot open"></span>Open · closes ${fmtHour(b.hours[1])}`
      : `<span class="dot closed"></span>Closed · opens ${fmtHour(b.hours[0])}`;

  const rowHTML = (b) => {
    const dist = userPos ? km(userPos, b) : null;
    return `
    <article class="branch-row ${activeId === b.id ? "active" : ""}" data-id="${b.id}" tabindex="0" aria-label="${b.name}">
      <img src="${b.img}" alt="${b.name} parlour" loading="lazy" />
      <div class="br-body">
        <div class="br-top"><h3>${b.name}</h3>${dist != null ? `<span class="br-dist">${dist.toFixed(1)} km</span>` : `<span class="br-tag">${b.tag}</span>`}</div>
        <p class="br-addr">${ico("map-pin")} ${b.address}</p>
        <p class="br-hours">${statusHTML(b)}</p>
        <div class="br-perks">${b.perks.map((p) => `<span>${p}</span>`).join("")}</div>
        <div class="br-actions">
          <a class="btn btn-primary btn-sm" href="${dirUrl(b)}" target="_blank" rel="noopener">${ico("navigation-arrow", "fill")} Directions</a>
          <a class="round-btn" href="tel:${b.phone}" title="Call" aria-label="Call ${b.name}">${ico("phone")}</a>
          <a class="round-btn" href="https://wa.me/${b.phone.replace("+", "")}" target="_blank" rel="noopener" title="WhatsApp" aria-label="WhatsApp ${b.name}">${ico("whatsapp-logo")}</a>
          <button class="round-btn" data-book="${b.name}" title="Book a table" aria-label="Book a table at ${b.name}">${ico("calendar-check")}</button>
        </div>
      </div>
    </article>`;
  };

  const renderList = () => {
    const q = $("#branchSearch").value.trim().toLowerCase();
    let items = BRANCHES.filter((b) => {
      if (q && !`${b.name} ${b.address} ${b.tag}`.toLowerCase().includes(q)) return false;
      if (filter === "open") return isOpen(b);
      if (filter !== "all") return b.perks.includes(filter);
      return true;
    });
    if (userPos) items = items.sort((a, b) => km(userPos, a) - km(userPos, b));
    list.innerHTML = items.length ? items.map(rowHTML).join("") : `<p class="finder-empty">No parlours match — try another area or filter.</p>`;
  };

  $("#branchSearch").addEventListener("input", renderList);
  $("#branchFilters").addEventListener("click", (e) => {
    const t = e.target.closest(".topic");
    if (!t) return;
    filter = t.dataset.f;
    $$(".topic", e.currentTarget).forEach((x) => x.classList.toggle("on", x === t));
    renderList();
  });

  // ---- Live map (Leaflet + OpenStreetMap). Falls back to a Google Maps embed if it can't load.
  let map = null;
  const markers = {};
  const markerIcon = (b, active) =>
    L.divIcon({
      className: "sd-marker" + (active ? " active" : ""),
      html: `<span class="mk-pin"><img src="${b.img}" alt="" /></span><span class="mk-label">${b.name}</span>`,
      iconSize: [34, 46],
      iconAnchor: [17, 40],
      popupAnchor: [0, -38],
    });
  const popupHTML = (b) => `
    <div class="pop">
      <img src="${b.img}" alt="" />
      <b>${b.name}</b>
      <span>${b.address}</span>
      <span class="pop-hours">${statusHTML(b)}</span>
      <div class="pop-acts">
        <a class="btn btn-primary btn-sm" href="${dirUrl(b)}" target="_blank" rel="noopener">${ico("navigation-arrow", "fill")} Directions</a>
        <a class="btn btn-ghost btn-sm" href="${viewUrl(b)}" target="_blank" rel="noopener">${ico("arrow-square-out")} Google Maps</a>
      </div>
    </div>`;

  if (window.L) {
    map = L.map("map", { scrollWheelZoom: false, zoomControl: false }).setView([19.06, 72.85], 12);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    [100, 500, 1500].forEach((t) => setTimeout(() => map.invalidateSize(), t));
    window.addEventListener("load", () => map.invalidateSize());
    window.addEventListener("resize", () => map.invalidateSize());
    BRANCHES.forEach((b) => {
      const m = L.marker([b.lat, b.lng], { icon: markerIcon(b, false), title: b.name, riseOnHover: true }).addTo(map);
      m.bindPopup(popupHTML(b), { maxWidth: 270, className: "sd-popup" });
      m.on("click", () => setActive(b.id, false));
      markers[b.id] = m;
    });
    map.fitBounds(L.latLngBounds(BRANCHES.map((b) => [b.lat, b.lng])), { padding: [50, 50] });
    // only grab the scroll wheel once the visitor interacts with the map
    map.once("click", () => map.scrollWheelZoom.enable());
  } else {
    $("#map").innerHTML = `<iframe title="Sweet Drip on Google Maps" src="https://maps.google.com/maps?q=${BRANCHES[0].lat},${BRANCHES[0].lng}&z=12&output=embed" loading="lazy" style="width:100%;height:100%;border:0"></iframe>`;
  }

  function setActive(id, fly) {
    activeId = id;
    const b = BRANCHES.find((x) => x.id === id);
    $$(".branch-row", list).forEach((r) => r.classList.toggle("active", r.dataset.id === id));
    if (map) {
      BRANCHES.forEach((x) => markers[x.id].setIcon(markerIcon(x, x.id === id)));
      if (fly) {
        map.flyTo([b.lat, b.lng], 15, { duration: reduceMotion ? 0 : 1.1 });
        setTimeout(() => markers[id].openPopup(), reduceMotion ? 0 : 1150);
      }
    }
    if (fly && innerWidth <= 900) $("#map").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }

  list.addEventListener("click", (e) => {
    const book = e.target.closest("[data-book]");
    if (book) {
      $("#bookBranch").value = book.dataset.book;
      $("#bookBranch").dispatchEvent(new Event("change"));
      $("#book").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      return;
    }
    if (e.target.closest("a")) return;
    const row = e.target.closest(".branch-row");
    if (row) setActive(row.dataset.id, true);
  });
  list.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("branch-row")) setActive(e.target.dataset.id, true);
  });

  // ---- "Find nearest to me"
  let youMarker = null;
  const locate = () => {
    if (!navigator.geolocation) return toast("Your browser can't share location", "warning-circle");
    $("#finderNote").textContent = "Finding you…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const nearest = [...BRANCHES].sort((a, b) => km(userPos, a) - km(userPos, b))[0];
        const d = km(userPos, nearest);
        $("#finderNote").innerHTML = `${ico("crosshair")} Nearest parlour: <b>${nearest.name}</b>, ${d.toFixed(1)} km away`;
        renderList();
        if (map) {
          if (youMarker) youMarker.remove();
          youMarker = L.marker([userPos.lat, userPos.lng], {
            icon: L.divIcon({ className: "you-marker", html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 11] }),
            title: "You are here",
          }).addTo(map);
          map.fitBounds(L.latLngBounds([[userPos.lat, userPos.lng], [nearest.lat, nearest.lng]]), { padding: [70, 70], maxZoom: 15 });
        }
        setActive(nearest.id, false);
        if (map) setTimeout(() => markers[nearest.id].openPopup(), 600);
        toast(`${nearest.name} is ${d.toFixed(1)} km from you`, "map-pin");
      },
      () => {
        $("#finderNote").textContent = "Location is off — search your area instead, or allow location access and try again.";
        toast("Couldn't get your location", "warning-circle");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };
  $("#mapLocate").addEventListener("click", locate);
  $("#nearMe").addEventListener("click", () => {
    $("#find").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    locate();
  });

  renderList();
}


/* ---------- Themed dropdowns & calendars everywhere ---------- */
if (window.enhanceControls) enhanceControls();
