const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Toast ----------
const toast = $("#toast");
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

// ---------- Preloader ----------
const preloader = $("#preloader");

function finishLoading() {
  preloader.classList.add("done");
  document.body.classList.remove("loading");
  startReveal();
}

window.addEventListener("load", () => setTimeout(finishLoading, reduceMotion ? 0 : 1500));

// ---------- Split hero title into words ----------
$$(".split").forEach((el) => {
  let n = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part.trim()) {
            frag.append(part);
            return;
          }
          const w = document.createElement("span");
          w.className = "w";
          const inner = document.createElement("span");
          inner.textContent = part;
          inner.style.setProperty("--wd", `${0.1 + n++ * 0.12}s`);
          w.append(inner);
          frag.append(w);
        });
        child.replaceWith(frag);
      }
    });
  };
  walk(el);
});

// ---------- Reveal on scroll ----------
function startReveal() {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        if (e.target.matches("[data-count]")) countUp(e.target);
        io.unobserve(e.target);
      });
    },
    { threshold: 0.15 }
  );
  $$("[data-reveal]").forEach((el) => io.observe(el));
  $$("[data-count]").forEach((el) => io.observe(el));
}

function countUp(el) {
  const target = Number(el.dataset.count);
  const suffix = el.dataset.suffix || "";
  const start = performance.now();
  const dur = 1600;
  const tick = (t) => {
    const p = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased).toLocaleString() + (p === 1 ? suffix : "");
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- Sprinkles ----------
const sprinkleBox = $("#sprinkles");
if (!reduceMotion) {
  const colors = ["#ff8fab", "#ffd166", "#8bd3dd", "#ffffff", "#b8f2a0", "#f7a1ff"];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement("span");
    s.className = "sprinkle";
    s.style.left = Math.random() * 100 + "%";
    s.style.background = colors[i % colors.length];
    s.style.animationDuration = 8 + Math.random() * 10 + "s";
    s.style.animationDelay = -Math.random() * 14 + "s";
    s.style.transform = `rotate(${Math.random() * 180}deg)`;
    sprinkleBox.append(s);
  }
}

// ---------- Mobile menu + active link ----------
const menuBtn = $("#menuBtn");
const nav = $("#nav");

function closeMenu() {
  nav.classList.remove("open");
  menuBtn.classList.remove("open");
  menuBtn.setAttribute("aria-expanded", "false");
}

menuBtn.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuBtn.classList.toggle("open", open);
  menuBtn.setAttribute("aria-expanded", String(open));
});

$$("a", nav).forEach((link) => link.addEventListener("click", closeMenu));

const navLinks = $$("a", nav);
const sectionIds = navLinks.map((a) => a.getAttribute("href"));

function setActiveLink() {
  const y = window.scrollY + window.innerHeight * 0.35;
  let current = sectionIds[0];
  sectionIds.forEach((id) => {
    const sec = $(id);
    if (sec && sec.offsetTop <= y) current = id;
  });
  navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === current));
}

// ---------- Scroll effects ----------
const header = $("#header");
const progress = $("#progress");
const toTop = $("#toTop");
const heroBg = $("#heroBg");
const parallaxBadges = $$("[data-speed]");
let ticking = false;

function onScroll() {
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  header.classList.toggle("scrolled", y > 40);
  progress.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
  toTop.classList.toggle("show", y > 600);
  setActiveLink();

  if (!reduceMotion) {
    if (y < window.innerHeight * 1.2) heroBg.style.transform = `translateY(${y * 0.25}px)`;
    parallaxBadges.forEach((b) => {
      const r = b.getBoundingClientRect();
      const offset = (r.top + r.height / 2 - window.innerHeight / 2) * Number(b.dataset.speed);
      b.style.transform = `translateY(${offset}px)`;
    });
  }
  ticking = false;
}

window.addEventListener("scroll", () => {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(onScroll);
  }
}, { passive: true });
onScroll();

toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

// ---------- Custom cursor ----------
const cursor = $("#cursor");
if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
  let cx = 0, cy = 0, tx = 0, ty = 0;
  window.addEventListener("mousemove", (e) => {
    tx = e.clientX;
    ty = e.clientY;
    cursor.classList.add("on");
  });
  document.addEventListener("mouseleave", () => cursor.classList.remove("on"));
  const loop = () => {
    cx += (tx - cx) * 0.2;
    cy += (ty - cy) * 0.2;
    cursor.style.transform = `translate(${cx}px, ${cy}px)`;
    requestAnimationFrame(loop);
  };
  loop();
  document.addEventListener("mouseover", (e) => {
    cursor.classList.toggle("hover", !!e.target.closest("a, button, .card, .flavour, input, select"));
  });
}

// ---------- Tilt + magnet ----------
if (matchMedia("(hover: hover) and (pointer: fine)").matches && !reduceMotion) {
  $$(".tilt").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transition = "transform 0.1s, background 0.3s, color 0.3s, box-shadow 0.3s, opacity 0.3s";
      el.style.transform = `perspective(900px) rotateX(${-py * 8}deg) rotateY(${px * 8}deg) translateY(-4px)`;
    });
    el.addEventListener("mouseleave", () => {
      el.style.transition = "";
      el.style.transform = "";
    });
  });

  $$(".magnet").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.25;
      const y = (e.clientY - r.top - r.height / 2) * 0.35;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    el.addEventListener("mouseleave", () => (el.style.transform = ""));
  });
}

// ---------- Hero review stack ----------
const reviews = $$(".review");
const dots = $$(".review-dots .dot");
let reviewIndex = 0;

function showReview(i) {
  reviewIndex = i;
  reviews.forEach((r, n) => r.classList.toggle("active", n === i));
  dots.forEach((d, n) => d.classList.toggle("active", n === i));
}

dots.forEach((dot, i) => dot.addEventListener("click", () => showReview(i)));
setInterval(() => showReview((reviewIndex + 1) % reviews.length), 4000);

// ---------- Cart ----------
const cartCount = $("#cartCount");
let cartItems = 0;
let cartTotal = 0;

function addToCart(name, qty, price) {
  cartItems += qty;
  cartTotal += qty * price;
  cartCount.textContent = cartItems;
  cartCount.classList.add("show");
  cartCount.classList.remove("bump");
  void cartCount.offsetWidth;
  cartCount.classList.add("bump");
  showToast(`${qty} × ${name} added · Rs. ${cartTotal} total`);
}

$("#cartBtn").addEventListener("click", () => {
  showToast(cartItems ? `Your cart: ${cartItems} item${cartItems > 1 ? "s" : ""} · Rs. ${cartTotal}` : "Your cart is empty");
});

$("#searchBtn").addEventListener("click", () => {
  $("#flavours").scrollIntoView({ behavior: "smooth" });
  showToast("Browse our flavours below 🍨");
});

// ---------- Hero product cards ----------
const types = $$(".type");
const cards = $$(".card");

types.forEach((btn) => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.type;
    if (type === "add") {
      showToast("Custom flavours coming soon!");
      return;
    }
    types.forEach((t) => t.classList.toggle("active", t === btn));
    cards.forEach((card) => card.classList.toggle("dimmed", type !== "all" && card.dataset.kind !== type));
  });
});

cards.forEach((card) => {
  const priceEl = $(".price b", card);
  const qtyEl = $(".qty span", card);
  const unit = Number(priceEl.dataset.price);
  let qty = 1;

  card.addEventListener("click", () => cards.forEach((c) => c.classList.toggle("selected", c === card)));

  $$(".chip", card).forEach((chip) =>
    chip.addEventListener("click", () => $$(".chip", card).forEach((c) => c.classList.toggle("active", c === chip)))
  );

  $$(".qty button", card).forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      qty = Math.min(99, Math.max(1, qty + Number(btn.dataset.step)));
      qtyEl.textContent = String(qty).padStart(2, "0");
      priceEl.textContent = unit * qty;
    })
  );

  $(".add-btn", card).addEventListener("click", (e) => {
    e.stopPropagation();
    addToCart(card.dataset.name, qty, unit);
  });
});

// ---------- Flavour tabs + grid ----------
const tabs = $$("#tabs .tab");
const indicator = $(".tab-indicator");
const flavours = $$(".flavour");

function moveIndicator(tab) {
  indicator.style.width = tab.offsetWidth + "px";
  indicator.style.transform = `translateX(${tab.offsetLeft - 5}px)`;
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.toggle("active", t === tab));
    moveIndicator(tab);
    const f = tab.dataset.filter;
    flavours.forEach((el) => {
      const show = f === "all" || el.dataset.kind === f;
      el.classList.toggle("hide", !show);
      if (show) {
        el.classList.remove("pop");
        void el.offsetWidth;
        el.classList.add("pop");
      }
    });
  });
});

const syncIndicator = () => moveIndicator($("#tabs .tab.active"));
window.addEventListener("resize", syncIndicator);
document.fonts && document.fonts.ready.then(syncIndicator);
syncIndicator();

flavours.forEach((el) => {
  const price = Number($(".price", el).textContent.replace(/\D/g, ""));
  $(".add-btn", el).addEventListener("click", () => addToCart(el.dataset.name, 1, price));
});

// ---------- Testimonials slider ----------
const slider = $(".slider");
const track = $("#track");
const sDots = $("#sDots");
const slides = $$(".t-card", track);
let slideIndex = 0;
let autoplay;

const perView = () => (innerWidth <= 768 ? 1 : innerWidth <= 1024 ? 2 : 3);
const maxIndex = () => slides.length - perView();

function buildDots() {
  sDots.innerHTML = "";
  for (let i = 0; i <= maxIndex(); i++) {
    const b = document.createElement("button");
    b.setAttribute("aria-label", `Go to review ${i + 1}`);
    b.addEventListener("click", () => {
      goTo(i);
      restartAuto();
    });
    sDots.append(b);
  }
}

function goTo(i) {
  slideIndex = Math.max(0, Math.min(maxIndex(), i));
  const step = slides[0].offsetWidth + 24;
  track.style.transform = `translateX(${-slideIndex * step}px)`;
  $$("button", sDots).forEach((d, n) => d.classList.toggle("active", n === slideIndex));
}

function restartAuto() {
  clearInterval(autoplay);
  autoplay = setInterval(() => goTo(slideIndex >= maxIndex() ? 0 : slideIndex + 1), 5000);
}

window.addEventListener("resize", () => {
  buildDots();
  goTo(slideIndex);
});

let dragX = null;
slider.addEventListener("pointerdown", (e) => {
  dragX = e.clientX;
  slider.classList.add("drag");
});
window.addEventListener("pointerup", (e) => {
  if (dragX === null) return;
  const dx = e.clientX - dragX;
  dragX = null;
  slider.classList.remove("drag");
  if (Math.abs(dx) > 50) goTo(slideIndex + (dx < 0 ? 1 : -1));
  restartAuto();
});
slider.addEventListener("dragstart", (e) => e.preventDefault());

buildDots();
goTo(0);
restartAuto();

// ---------- Booking form ----------
const form = $("#bookForm");
const dateInput = form.elements.date;
dateInput.min = new Date().toISOString().split("T")[0];

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = form.elements.name.value.trim().split(" ")[0] || "friend";
  showToast(`Table booked, ${name}! See you soon 🍨`);
  form.reset();
  form.elements.time.value = "18:00";
  form.elements.guests.selectedIndex = 1;
});


// ---------- About: timeline fill + sub-nav highlight ----------
(function () {
  const tl = $("#timeline");
  const fill = $("#timelineFill");
  const links = $$("#aboutNav a");
  const targets = links.map((a) => $(a.getAttribute("href")));
  if (!tl || !fill) return;
  let busy = false;
  function update() {
    busy = false;
    const r = tl.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.6 - r.top) / r.height));
    fill.style.height = p * 100 + "%";
    // highlight the sub-nav link of the block nearest the middle of the screen
    let current = 0;
    targets.forEach((t, i) => { if (t && t.getBoundingClientRect().top < vh * 0.45) current = i; });
    links.forEach((a, i) => a.classList.toggle("on", i === current));
  }
  window.addEventListener("scroll", () => { if (!busy) { busy = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener("resize", update);
  update();
})();
