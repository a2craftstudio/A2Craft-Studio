/* =========================================================
   Sweet Drip — business tools
   Loaded on every page AFTER main.js, so it can use its helpers
   ($, $$, ico, store, toast, rupee, cart, BRANCHES, MENU …).

   Edit the BUSINESS block, COUPONS and REVIEWS below — no
   server is needed: orders and enquiries open a ready-made
   WhatsApp message and are also saved in the visitor's browser.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 1. Your business details (edit these) ---------- */
  const BUSINESS = {
    name: "Sweet Drip",
    legalName: "Sweet Drip Dessert Parlour",
    url: "https://www.sweetdrip.in",
    email: "hello@sweetdrip.in",
    phone: "+919876543210",
    whatsapp: typeof WHATSAPP === "string" ? WHATSAPP : "919876543210",
    fssai: "11234567890123",          // replace with your FSSAI licence number
    gst: "27ABCDE1234F1Z5",           // replace with your GSTIN (or remove)
    googleReviewUrl: "https://g.page/r/your-place-id/review",
    instagram: "https://instagram.com/sweetdrip",
    facebook: "https://facebook.com/sweetdrip",
    rating: 4.8,
    reviewCount: 1240,
    priceRange: "₹₹",
    orderEstimateDelivery: "25–35 min",
    orderEstimatePickup: "15 min",
  };

  const COUPONS = {
    DRIP10: { label: "10% off", min: 299, pct: 10 },
    FIRST50: { label: "₹50 off your first order", min: 399, flat: 50, firstOnly: true },
    PARTY15: { label: "15% off party orders", min: 1000, pct: 15 },
  };

  const REVIEWS = [
    { n: "Ananya Kapoor", t: "Birthday party", r: 5, d: "2 weeks ago", x: "We booked the gola counter for my son's 8th birthday. The kids queued for an hour and the parents did too. Setup was on time, the staff were lovely." },
    { n: "Rohit Verma", t: "Delivery", r: 5, d: "1 month ago", x: "Frozen kulfi and falooda arrived cold and perfect in 28 minutes. I have never had ice cream delivery that didn't melt. Ordering on WhatsApp was easy." },
    { n: "Sneha Iyer", t: "Dine-in · Juhu", r: 5, d: "1 month ago", x: "The Royal Rose Falooda is better than anything near my house. Clean parlour, quick service and the team remembered us from last time." },
    { n: "Imran Shaikh", t: "Corporate catering", r: 5, d: "2 months ago", x: "Ordered dessert boxes for 120 people for our office annual day. Everything arrived labelled and on schedule. Will book again." },
    { n: "Priya Nair", t: "Dine-in · Bandra", r: 4, d: "2 months ago", x: "Great shakes and lovely neon vibe. Saturday evening can be crowded, so go early or order for pickup." },
    { n: "Karan Mehra", t: "Delivery", r: 5, d: "3 months ago", x: "The chocolate gift box was a hit at my sister's wedding. Beautifully packed and not too sweet." },
    { n: "Divya Pillai", t: "Dine-in · Powai", r: 5, d: "3 months ago", x: "Pure vegetarian and lots of eggless options, which is rare. The kala khatta gola took me straight back to childhood." },
    { n: "Arjun Sethi", t: "Pickup", r: 4, d: "4 months ago", x: "Pickup order was ready in 12 minutes. Staff double-checked my order. Would love a few more sugar-free options." },
    { n: "Meera Joshi", t: "Birthday cake", r: 5, d: "4 months ago", x: "Custom ice-cream cake for my mother's 60th. They matched the design exactly and it tasted even better than it looked." },
    { n: "Faisal Khan", t: "Dine-in · Colaba", r: 5, d: "5 months ago", x: "Retro booths, friendly team and the brownie sizzler is a must. Good value for the quality." },
  ];

  const MORE_FAQS = [
    { c: "Orders", q: "How do I place an order?", a: "Add items to your cart, choose delivery or pickup, and tap Place order. Your order opens as a WhatsApp message to the parlour, which confirms it within a few minutes." },
    { c: "Orders", q: "What is the minimum order and delivery fee?", a: "There is no minimum order. Delivery is ₹40, and it is free on orders of ₹499 or more. Pickup is always free." },
    { c: "Orders", q: "Can I change or cancel my order?", a: "Message us on WhatsApp within 5 minutes of ordering and we will change or cancel it. After the kitchen starts, we can't cancel, but we will always try to help." },
    { c: "Orders", q: "Which payment methods do you accept?", a: "Cash and UPI on delivery or pickup, and cards at the parlour. We will share a UPI QR code in the WhatsApp chat." },
    { c: "Orders", q: "How far do you deliver?", a: "Up to 6 km from each parlour. If you are outside that, message us and we will try to arrange a courier." },
    { c: "Events", q: "How early should I book catering?", a: "Two weeks for events of 100+ guests, one week for smaller events. Last-minute bookings are possible when our team is free." },
    { c: "Events", q: "Do you travel outside Mumbai for events?", a: "Yes, across Maharashtra. Travel and staff stay are added to the quote." },
    { c: "Events", q: "Can you handle allergies and Jain or vegan needs?", a: "Tell us in the enquiry. We can prepare Jain, eggless, nut-free and dairy-free options, and we label everything." },
    { c: "Business", q: "Do you offer franchises?", a: "Yes. See our Franchise page for the investment, support and process, and send an enquiry." },
    { c: "Business", q: "How do I order for my office?", a: "Use the Catering page and choose Corporate. We invoice with GST and can deliver on a schedule." },
    { c: "Business", q: "Are you hiring?", a: "Often. See the Careers page for open roles and apply in two minutes." },
    { c: "Food safety", q: "Are you FSSAI licensed?", a: "Yes. Our licence number is shown in the footer of every page, and our kitchens are audited every quarter." },
  ];

  /* ---------- 2. Small helpers ---------- */
  const $q = (s, el = document) => el.querySelector(s);
  const $$q = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
  const waLink = (text, number) => `https://wa.me/${number || BUSINESS.whatsapp}?text=${encodeURIComponent(text)}`;
  const mailLink = (subject, body) => `mailto:${BUSINESS.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const makeRef = (prefix) => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${prefix}${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.floor(1000 + Math.random() * 9000)}`;
  };
  const save = (key, item, max = 50) => {
    const list = store.get(key, []);
    list.unshift(item);
    store.set(key, list.slice(0, max));
  };
  const validPhone = (v) => /^(?:\+?91)?[6-9]\d{9}$/.test(String(v).replace(/[\s()-]/g, ""));
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const tidyPhone = (v) => String(v).replace(/[^\d+]/g, "");
  const iconOf = (name, weight) => (typeof ico === "function" ? ico(name, weight) : "");

  /* ---------- 3. Enquiry forms (catering, franchise, careers, reviews …) ----------
     Any <form data-enquiry="catering" data-title="Catering enquiry"> works:
     it validates, saves the enquiry, opens a WhatsApp message and shows a thank-you.   */
  function labelOf(el) {
    const field = el.closest(".field");
    if (field) { const s = $q("span", field); if (s) return s.textContent.replace("*", "").trim(); }
    const fs = el.closest("fieldset");
    if (fs && $q("legend", fs)) return $q("legend", fs).textContent.trim();
    return el.name;
  }
  function validateForm(form) {
    let first = null;
    $$q(".field", form).forEach((f) => {
      const input = $q("input, select, textarea", f);
      if (!input || input.disabled) return;
      let msg = "";
      const v = input.value.trim();
      if (input.required && !v) msg = "Please fill this in.";
      else if (v && input.name === "phone" && !validPhone(v)) msg = "Enter a valid 10-digit mobile number.";
      else if (v && input.type === "email" && !validEmail(v)) msg = "Enter a valid email address.";
      else if (v && input.minLength > 0 && v.length < input.minLength) msg = `Please write at least ${input.minLength} characters.`;
      f.classList.toggle("invalid", !!msg);
      let err = f.nextElementSibling;
      if (!err || !err.classList.contains("field-error")) {
        err = document.createElement("p");
        err.className = "field-error";
        err.setAttribute("role", "alert");
        f.after(err);
      }
      err.textContent = msg;
      if (msg && !first) first = input;
    });
    $$q("fieldset[data-required]", form).forEach((fs) => {
      if (!$q("input:checked", fs)) { if (!first) first = $q("input", fs); toast("Please choose an option: " + labelOf($q("input", fs)), "warning-circle"); }
    });
    if (first) first.focus();
    return !first;
  }
  function collect(form) {
    const rows = [];
    const done = new Set();
    $$q("input, select, textarea", form).forEach((el) => {
      if (!el.name || el.disabled || el.classList.contains("form-hp") || el.type === "submit") return;
      if (el.type === "radio" || el.type === "checkbox") {
        const key = el.name + "|" + el.type;
        if (done.has(key)) return;
        done.add(key);
        const picked = $$q(`input[name="${el.name}"]:checked`, form).map((i) => i.value);
        if (picked.length) rows.push([labelOf(el), picked.join(", ")]);
        return;
      }
      if (el.value.trim()) rows.push([labelOf(el), el.value.trim()]);
    });
    return rows;
  }
  function successPanel(form, ref, text, title) {
    const panel = document.createElement("div");
    panel.className = "success";
    panel.setAttribute("role", "status");
    panel.innerHTML = `
      <div class="big">${iconOf("check", "fill")}</div>
      <h3>Thank you! We've got it.</h3>
      <p>${esc(title)} sent. A WhatsApp message with your details opened in a new tab — please press <b>Send</b> there so it reaches our team. We reply within a few hours.</p>
      <span class="ref">Reference ${esc(ref)}</span>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:6px">
        <a class="btn btn-primary btn-sm" href="${waLink(text)}" target="_blank" rel="noopener">${iconOf("whatsapp-logo", "fill")} Open WhatsApp again</a>
        <a class="btn btn-ghost btn-sm" href="${mailLink(title + " " + ref, text.replace(/\*/g, ""))}">${iconOf("envelope-simple")} Send by email</a>
        <button class="btn btn-ghost btn-sm" type="button" data-again>${iconOf("arrow-counter-clockwise")} New enquiry</button>
      </div>`;
    form.hidden = true;
    form.after(panel);
    $q("[data-again]", panel).addEventListener("click", () => { panel.remove(); form.reset(); form.hidden = false; $$q(".field.invalid", form).forEach((f) => f.classList.remove("invalid")); window.scrollTo({ top: form.getBoundingClientRect().top + scrollY - 120, behavior: "smooth" }); });
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function initEnquiryForms() {
    $$q("form[data-enquiry]").forEach((form) => {
      form.setAttribute("novalidate", "");
      form.insertAdjacentHTML("beforeend", '<input class="form-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">');
      form.addEventListener("input", (e) => { const f = e.target.closest(".field"); if (f) f.classList.remove("invalid"); });
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if ($q('input[name="website"]', form).value) return;   // a bot filled the hidden field
        if (!validateForm(form)) return;
        const type = form.dataset.enquiry;
        const title = form.dataset.title || "Enquiry";
        const ref = makeRef(type.slice(0, 2).toUpperCase());
        const rows = collect(form).filter(([k]) => k !== "website");
        const text = `*${title}* (${ref})\n` + rows.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\nSent from ${BUSINESS.name} website`;
        save("sweetdrip-enquiries", { ref, type, title, rows, at: Date.now() });
        if (type === "review") { form.dispatchEvent(new CustomEvent("enquiry:saved", { bubbles: true, detail: { rows } })); }
        form.classList.add("sending");
        window.open(waLink(text), "_blank", "noopener");
        form.classList.remove("sending");
        successPanel(form, ref, text, title);
      });
    });
  }

  /* ---------- 4. Real checkout (replaces the demo "Place order") ---------- */
  function cartTotals(couponCode) {
    const sub = cart.reduce((n, c) => n + c.qty * c.price, 0);
    const pickup = typeof orderMode !== "undefined" && orderMode === "pickup";
    const delivery = pickup || sub === 0 || sub >= FREE_DELIVERY ? 0 : 40;
    let discount = 0;
    let msg = "";
    const c = couponCode && COUPONS[couponCode];
    if (couponCode && !c) msg = "bad:That code isn't valid.";
    else if (c) {
      if (sub < c.min) msg = `bad:Add ${inr(c.min - sub)} more to use ${couponCode}.`;
      else if (c.firstOnly && store.get("sweetdrip-orders", []).length) msg = "bad:This code is only for first orders.";
      else { discount = c.pct ? Math.round((sub * c.pct) / 100) : c.flat; msg = `ok:${couponCode} applied: ${c.label}`; }
    }
    return { sub, delivery, discount, total: Math.max(0, sub + delivery - discount), pickup, msg };
  }
  function modal(html) {
    let m = $q("#bizModal");
    if (!m) {
      m = document.createElement("div");
      m.className = "biz-modal";
      m.id = "bizModal";
      m.setAttribute("role", "dialog");
      m.setAttribute("aria-modal", "true");
      document.body.appendChild(m);
      m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-close]")) closeModal(); });
      addEventListener("keydown", (e) => e.key === "Escape" && closeModal());
    }
    m.innerHTML = `<div class="biz-card">${html}</div>`;
    m.classList.add("open");
    document.body.classList.add("locked");
    const first = $q("input, button, select", m);
    if (first) setTimeout(() => first.focus(), 50);
    return m;
  }
  function closeModal() {
    const m = $q("#bizModal");
    if (m) m.classList.remove("open");
    document.body.classList.remove("locked");
  }
  function openCheckout() {
    if (!cart.length) return toast("Your cart is empty", "basket");
    const pickup = orderMode === "pickup";
    if (!pickup && !checkoutInfo.address.trim()) { const a = $q("#coAddress"); if (a) a.focus(); return toast("Add a delivery address first", "map-pin"); }
    const branch = BRANCHES.find((b) => b.id === checkoutInfo.branch) || BRANCHES[0];
    const prev = store.get("sweetdrip-customer", { name: "", phone: "" });
    let coupon = "";
    const m = modal(`
      <button class="icon-btn x" data-close aria-label="Close">${iconOf("x")}</button>
      <h3>Almost there</h3>
      <p class="biz-note">${pickup ? `Pickup from <b>${esc(branch.name)}</b> · ${esc(checkoutInfo.slot)}` : `Delivery to <b>${esc(checkoutInfo.address)}</b>`}</p>
      <form id="coForm" novalidate>
        <div class="form-grid" style="margin-top:14px">
          <label class="field"><input name="name" required autocomplete="name" placeholder=" " value="${esc(prev.name)}" /><span>Your name</span></label>
          <label class="field"><input name="phone" type="tel" required autocomplete="tel" placeholder=" " value="${esc(prev.phone)}" /><span>Mobile number</span></label>
          <label class="field full"><textarea name="notes" placeholder=" " style="min-height:80px"></textarea><span>Notes (less sugar, no nuts, candles…)</span></label>
        </div>
        <fieldset style="border:0;margin:6px 0"><legend class="biz-note" style="margin-bottom:6px">Pay by</legend>
          <div class="pay-row">
            ${["UPI", "Cash", "Card at parlour"].map((p, i) => `<label class="pick"><input type="radio" name="pay" value="${p}" ${i === 0 ? "checked" : ""}><span>${p}</span></label>`).join("")}
          </div>
        </fieldset>
        <div class="coupon"><input id="coCode" placeholder="Coupon code" aria-label="Coupon code" /><button class="btn btn-ghost btn-sm" type="button" id="coApply">Apply</button></div>
        <p class="coupon-msg" id="coMsg">Try DRIP10 for 10% off orders above ₹299.</p>
        <div class="sum" id="coSum"></div>
        <button class="btn btn-primary" type="submit" style="width:100%;justify-content:center">${iconOf("whatsapp-logo", "fill")} Send order on WhatsApp</button>
        <p class="biz-note" style="margin-top:10px;text-align:center">We confirm on WhatsApp and share a UPI QR. No payment is taken on this website.</p>
      </form>`);
    const form = $q("#coForm", m);
    const paint = () => {
      const t = cartTotals(coupon);
      $q("#coSum", m).innerHTML =
        cart.map((c) => `<div class="r"><span>${c.qty} × ${esc(c.name)}</span><span>${inr(c.qty * c.price)}</span></div>`).join("") +
        `<div class="r"><span>Subtotal</span><span>${inr(t.sub)}</span></div>` +
        `<div class="r"><span>${t.pickup ? "Pickup" : "Delivery"}</span><span>${t.delivery ? inr(t.delivery) : "Free"}</span></div>` +
        (t.discount ? `<div class="r disc"><span>Coupon ${esc(coupon)}</span><span>− ${inr(t.discount)}</span></div>` : "") +
        `<div class="r total"><span>Total</span><span>${inr(t.total)}</span></div>`;
      const [kind, text] = t.msg ? t.msg.split(/:(.*)/s) : ["", ""];
      const el = $q("#coMsg", m);
      if (coupon) { el.className = "coupon-msg " + kind; el.textContent = text; }
      if (kind === "bad") coupon = "";
      return t;
    };
    paint();
    $q("#coApply", m).addEventListener("click", () => {
      coupon = $q("#coCode", m).value.trim().toUpperCase();
      const t = paint();
      if (!t.discount && coupon) { /* message already shown */ }
    });
    $q("#coCode", m).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $q("#coApply", m).click(); } });
    form.addEventListener("input", (e) => { const f = e.target.closest(".field"); if (f) f.classList.remove("invalid"); });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validateForm(form)) return;
      const t = cartTotals(coupon);
      const name = form.name.value.trim();
      const phone = tidyPhone(form.phone.value);
      const pay = $q('input[name="pay"]:checked', form).value;
      const ref = makeRef("SD");
      const notes = form.notes.value.trim();
      const lines = [
        `*New order ${ref}* (${BUSINESS.name})`,
        `Name: ${name}`,
        `Phone: ${phone}`,
        pickup ? `Pickup: ${branch.name} · ${checkoutInfo.slot}` : `Delivery to: ${checkoutInfo.address}`,
        "", "*Items*",
        ...cart.map((c) => `• ${c.qty} × ${c.name} — ${inr(c.qty * c.price)}`),
        "", `Subtotal: ${inr(t.sub)}`, `${pickup ? "Pickup" : "Delivery"}: ${t.delivery ? inr(t.delivery) : "Free"}`,
        ...(t.discount ? [`Coupon ${coupon}: −${inr(t.discount)}`] : []),
        `*Total: ${inr(t.total)}*`, `Pay by: ${pay}`,
        ...(notes ? ["", `Notes: ${notes}`] : []),
      ];
      const text = lines.join("\n");
      const target = pickup && branch.phone ? branch.phone.replace(/\D/g, "") : BUSINESS.whatsapp;
      store.set("sweetdrip-customer", { name, phone });
      save("sweetdrip-orders", { ref, at: Date.now(), mode: pickup ? "pickup" : "delivery", branch: branch.name, address: checkoutInfo.address, slot: checkoutInfo.slot, items: cart.map((c) => ({ name: c.name, qty: c.qty, price: c.price })), total: t.total, name, phone, pay });
      window.open(waLink(text, target), "_blank", "noopener");
      cart = [];
      saveCart();
      renderCart();
      if (typeof closeCart === "function") closeCart();
      modal(`
        <div class="success">
          <div class="big">${iconOf("check", "fill")}</div>
          <h3>Order sent, ${esc(name.split(" ")[0])}!</h3>
          <p>A WhatsApp message with your order opened in a new tab. <b>Press Send there</b> so the parlour gets it. Estimated ${pickup ? "ready in " + BUSINESS.orderEstimatePickup : "delivery in " + BUSINESS.orderEstimateDelivery}.</p>
          <span class="ref">Order ${esc(ref)}</span>
          <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:6px">
            <a class="btn btn-primary btn-sm" href="${waLink(text, target)}" target="_blank" rel="noopener">${iconOf("whatsapp-logo", "fill")} Open WhatsApp again</a>
            <a class="btn btn-ghost btn-sm" href="order.html#my-orders">Track my order</a>
            <button class="btn btn-ghost btn-sm" data-close type="button">Close</button>
          </div>
        </div>`);
    });
  }
  function replaceCheckout() {
    const old = $q("#checkout");
    if (!old || typeof cart === "undefined") return;
    const fresh = old.cloneNode(true);
    old.replaceWith(fresh);
    fresh.addEventListener("click", openCheckout);
  }

  /* ---------- 5. "My orders" with simulated progress (order.html) ---------- */
  function renderOrders() {
    const box = $q("#myOrders");
    if (!box) return;
    const orders = store.get("sweetdrip-orders", []);
    if (!orders.length) {
      box.innerHTML = `<div class="success"><div class="big" style="background:var(--pink-2);color:var(--pink)">${iconOf("receipt", "duotone")}</div><h3>No orders yet</h3><p>When you place an order it will appear here with its progress.</p><a class="btn btn-primary btn-sm" href="menu.html">Browse the menu</a></div>`;
      return;
    }
    const stage = (o) => {
      const min = (Date.now() - o.at) / 60000;
      const steps = o.mode === "pickup" ? ["Received", "Preparing", "Ready", "Picked up"] : ["Received", "Preparing", "On the way", "Delivered"];
      const cut = o.mode === "pickup" ? [0, 3, 15, 40] : [0, 3, 12, 38];
      let idx = 0;
      cut.forEach((c, i) => { if (min >= c) idx = i; });
      return { steps, idx };
    };
    box.innerHTML = orders.slice(0, 6).map((o) => {
      const s = stage(o);
      return `<article class="order-card">
        <header><b>${esc(o.ref)}</b><span class="biz-note">${new Date(o.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · ${o.mode === "pickup" ? "Pickup · " + esc(o.branch) : "Delivery"}</span></header>
        <div class="progress-steps">${s.steps.map((n, i) => `<span class="${i <= s.idx ? "done" : ""}">${n}</span>`).join("")}</div>
        <ul>${o.items.map((i) => `<li>${i.qty} × ${esc(i.name)}</li>`).join("")}</ul>
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center"><b>${inr(o.total)}</b>
          <span style="display:flex;gap:8px"><button class="btn btn-ghost btn-sm" data-reorder="${esc(o.ref)}">${iconOf("arrow-counter-clockwise")} Order again</button>
          <a class="btn btn-ghost btn-sm" href="${waLink("Hi! Checking on my order " + o.ref)}" target="_blank" rel="noopener">${iconOf("whatsapp-logo", "fill")} Ask about it</a></span></div>
      </article>`;
    }).join("") + `<p class="biz-note">Progress is an estimate based on time. For the live status, tap "Ask about it".</p>`;
    box.onclick = (e) => {
      const b = e.target.closest("[data-reorder]");
      if (!b) return;
      const o = orders.find((x) => x.ref === b.dataset.reorder);
      if (!o) return;
      o.items.forEach((it) => {
        const menuItem = MENU.find((m) => m.name === it.name);
        const entry = { key: menuItem ? menuItem.id : it.name, name: it.name, price: it.price, img: menuItem ? menuItem.img : "" };
        const ex = cart.find((c) => c.key === entry.key);
        if (ex) ex.qty += it.qty; else cart.push({ ...entry, qty: it.qty });
      });
      saveCart(); renderCart(); toast("Added to your cart", "basket");
      if (typeof openCart === "function") openCart();
    };
  }
  function renderPopular() {
    const box = $q("#popular");
    if (!box || typeof MENU === "undefined") return;
    const picks = MENU.filter((m) => m.tag === "Bestseller" || m.tag === "Signature").slice(0, 8);
    box.innerHTML = picks.map((m) => `<article class="quick"><img src="${m.img}" alt="${esc(m.name)}" loading="lazy"><div><b>${esc(m.name)}</b><small class="biz-note">${esc(m.desc)}</small><div class="row"><span class="price">${rupee(m.price)}</span><button class="btn btn-primary btn-sm" data-quick="${m.id}">${iconOf("plus")} Add</button></div></div></article>`).join("");
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-quick]");
      if (!b) return;
      const m = findItem(b.dataset.quick);
      addToCart({ key: m.id, name: m.name, price: m.price, img: m.img }, b);
    });
  }

  /* ---------- 6. Catering estimate ---------- */
  function initCateringEstimate() {
    const form = $q("#cateringForm");
    if (!form) return;
    const PER_GUEST = { "Gola counter": 120, "Ice cream & kulfi buffet": 220, "Dessert table": 320, "Chocolate & mithai boxes": 260 };
    const ADDON = { "Live waffle station": 6000, "Custom ice-cream cake": 1800, "Extra server": 1500 };
    const paint = () => {
      const guests = Math.max(0, parseInt(form.guests.value, 10) || 0);
      const picks = $$q('input[name="service"]:checked', form).map((i) => i.value);
      const adds = $$q('input[name="addons"]:checked', form).map((i) => i.value);
      let total = 0;
      const rows = [];
      picks.forEach((p) => { const v = PER_GUEST[p] * guests; total += v; rows.push([`${p} × ${guests}`, v]); });
      adds.forEach((a) => { total += ADDON[a]; rows.push([a, ADDON[a]]); });
      const box = $q("#quoteBox");
      $q("#quoteAmt", box).textContent = total ? inr(total) : "₹0";
      $q("#quoteList", box).innerHTML = rows.length ? rows.map(([k, v]) => `<li><span>${esc(k)}</span><span>${inr(v)}</span></li>`).join("") : '<li><span>Choose a service to see your estimate</span></li>';
      const hidden = $q('input[name="estimate"]', form);
      if (hidden) hidden.value = total ? inr(total) + " (approx., excluding GST and travel)" : "";
    };
    form.addEventListener("input", paint);
    form.addEventListener("change", paint);
    const date = $q('input[name="date"]', form);
    if (date) date.min = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    paint();
  }

  /* ---------- 7. Reviews page ---------- */
  function initReviews() {
    const grid = $q("#reviewGrid");
    if (!grid) return;
    const mine = store.get("sweetdrip-my-reviews", []);
    const all = [...mine, ...REVIEWS];
    const starsOf = (n) => "★".repeat(n) + "☆".repeat(5 - n);
    grid.innerHTML = all.map((r, i) => `<article class="testi ${r.mine ? "mine" : ""}" data-reveal="up" style="--d:${(i % 6) * 0.05}s"><div class="stars" aria-label="${r.r} out of 5">${starsOf(r.r)}</div><p>${esc(r.x)}</p><footer><span class="avatar">${esc(r.n.split(" ").map((w) => w[0]).slice(0, 2).join(""))}</span><div><b>${esc(r.n)}</b><small>${esc(r.t)} · ${esc(r.d)}</small></div></footer></article>`).join("");
    const base = { 5: 1010, 4: 168, 3: 38, 2: 14, 1: 10 };
    mine.forEach((r) => (base[r.r] += 1));
    const total = Object.values(base).reduce((a, b) => a + b, 0);
    const avg = Object.entries(base).reduce((a, [k, v]) => a + k * v, 0) / total;
    $q("#ratingNum").textContent = avg.toFixed(1);
    $q("#ratingCount").textContent = total.toLocaleString("en-IN") + " reviews";
    $q("#ratingBars").innerHTML = [5, 4, 3, 2, 1].map((s) => `<div><span>${s}★</span><div class="track"><span style="width:${(base[s] / total) * 100}%"></span></div><span>${Math.round((base[s] / total) * 100)}%</span></div>`).join("");
    if (typeof observeReveals === "function") observeReveals(grid);
    const form = $q("#reviewForm");
    if (form) form.addEventListener("enquiry:saved", (e) => {
      const rows = Object.fromEntries(e.detail.rows);
      const r = { n: rows["Your name"] || "Guest", t: rows["What did you have?"] || "Visit", r: parseInt(rows["Rating"], 10) || 5, d: "just now", x: rows["Your review"] || "", mine: true };
      const list = store.get("sweetdrip-my-reviews", []);
      list.unshift(r);
      store.set("sweetdrip-my-reviews", list.slice(0, 5));
      setTimeout(initReviews, 50);
    });
  }

  /* ---------- 8. FAQ page ---------- */
  function initFaqPage() {
    const box = $q("#faqAll");
    if (!box) return;
    const all = [...(typeof FAQS !== "undefined" ? FAQS.map((f) => ({ ...f, c: "Food" })) : []), ...MORE_FAQS];
    const cats = ["All", ...new Set(all.map((f) => f.c))];
    $q("#faqCats").innerHTML = cats.map((c, i) => `<button class="chip ${i === 0 ? "on" : ""}" data-cat="${c}" type="button">${c}</button>`).join("");
    let cat = "All";
    const paint = () => {
      const q = ($q("#faqSearchAll").value || "").trim().toLowerCase();
      const items = all.filter((f) => (cat === "All" || f.c === cat) && (!q || (f.q + " " + f.a).toLowerCase().includes(q)));
      box.innerHTML = items.length
        ? items.map((f, i) => `<div class="faq-item ${i === 0 && !q ? "open" : ""}"><button class="faq-q" aria-expanded="${i === 0 && !q}">${esc(f.q)}<span class="pm"></span></button><div class="faq-a"><div><p>${esc(f.a)}</p></div></div></div>`).join("")
        : `<p class="biz-note" style="text-align:center;padding:30px">No answers match. <a href="contact.html#ask" style="color:var(--pink);font-weight:600">Ask us directly</a>.</p>`;
    };
    paint();
    $q("#faqCats").addEventListener("click", (e) => { const b = e.target.closest("[data-cat]"); if (!b) return; cat = b.dataset.cat; $$q("#faqCats .chip").forEach((c) => c.classList.toggle("on", c === b)); paint(); });
    $q("#faqSearchAll").addEventListener("input", paint);
    box.addEventListener("click", (e) => { const q = e.target.closest(".faq-q"); if (!q) return; const it = q.parentElement; const open = !it.classList.contains("open"); $$q(".faq-item", box).forEach((f) => { f.classList.remove("open"); $q(".faq-q", f).setAttribute("aria-expanded", "false"); }); it.classList.toggle("open", open); q.setAttribute("aria-expanded", open); });
  }

  /* ---------- 9. Newsletter band, cookie notice, call button ---------- */
  function addNewsletter() {
    const skip = ["privacy", "terms", "notfound"];
    const footer = $q(".footer");
    if (!footer || skip.includes(page)) return;
    footer.insertAdjacentHTML("beforebegin", `
      <section class="news-band" aria-labelledby="newsTitle"><div class="container"><div class="news-box">
        <div><span class="kicker">${iconOf("envelope-simple-open", "fill")} Sweet Drip club</span><h2 id="newsTitle" style="margin-top:12px">Get new flavours &amp; offers first</h2><p class="biz-note" style="margin-top:8px">One short message a week. Unsubscribe any time.</p></div>
        <form class="news-form" id="newsForm" novalidate><label class="sr-only" for="newsEmail">Email address</label><input id="newsEmail" name="email" type="email" required autocomplete="email" placeholder="you@example.com"><button class="btn btn-primary" type="submit">Join ${iconOf("paper-plane-tilt")}</button></form>
      </div></div></section>`);
    $q("#newsForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = $q("#newsEmail").value.trim();
      if (!validEmail(v)) { $q("#newsEmail").focus(); return toast("Please enter a valid email", "warning-circle"); }
      save("sweetdrip-subscribers", { email: v, at: Date.now() }, 200);
      e.target.reset();
      toast("You're in! Check your inbox soon.", "envelope-simple-open");
    });
  }
  function addCookieNotice() {
    if (store.get("sweetdrip-cookie-ok", false)) return;
    document.body.insertAdjacentHTML("beforeend", `<div class="cookie" id="cookie" role="dialog" aria-label="Privacy notice"><p>We use your browser's storage to remember your cart and saved treats. No ads, no tracking. <a href="privacy.html">Read our privacy notice</a>.</p><button class="btn btn-primary btn-sm" id="cookieOk" type="button">Got it</button></div>`);
    setTimeout(() => $q("#cookie").classList.add("show"), 1200);
    $q("#cookieOk").addEventListener("click", () => { store.set("sweetdrip-cookie-ok", true); $q("#cookie").classList.remove("show"); });
  }
  function addCallButton() {
    document.body.insertAdjacentHTML("beforeend", `<a class="call-fab" href="tel:${BUSINESS.phone}" aria-label="Call Sweet Drip">${iconOf("phone", "fill")}</a>`);
  }
  function addSkipLink() {
    const main = $q("main, section, .page-hero");
    if (!main) return;
    if (!main.id) main.id = "main";
    document.body.insertAdjacentHTML("afterbegin", `<a class="skip-link" href="#${main.id}">Skip to content</a>`);
  }
  function addFooterBusiness() {
    const bottom = $q(".footer-bottom");
    if (!bottom) return;
    bottom.insertAdjacentHTML("beforebegin", `<p class="biz-note" style="text-align:center;padding:10px 0;color:rgba(255,247,239,.6)">FSSAI Lic. No. ${BUSINESS.fssai} · GSTIN ${BUSINESS.gst} · <a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a></p>`);
  }

  /* ---------- 10. Search-engine data (JSON-LD + social tags) ---------- */
  function addStructuredData() {
    const set = (sel, make) => { if (!$q(sel)) { const el = make(); document.head.appendChild(el); } };
    const title = document.title, desc = ($q('meta[name="description"]') || {}).content || "";
    const meta = (prop, val, attr = "property") => set(`meta[${attr}="${prop}"]`, () => { const m = document.createElement("meta"); m.setAttribute(attr, prop); m.content = val; return m; });
    meta("og:title", title); meta("og:description", desc); meta("og:type", "website"); meta("og:site_name", BUSINESS.name);
    meta("og:image", BUSINESS.url + "/img/shop-front.jpg"); meta("twitter:card", "summary_large_image", "name");
    const data = [{
      "@context": "https://schema.org", "@type": "IceCreamShop", name: BUSINESS.legalName, url: BUSINESS.url,
      telephone: BUSINESS.phone, email: BUSINESS.email, priceRange: BUSINESS.priceRange, servesCuisine: ["Desserts", "Ice cream", "Indian sweets"],
      image: BUSINESS.url + "/img/shop-front.jpg", sameAs: [BUSINESS.instagram, BUSINESS.facebook],
      aggregateRating: { "@type": "AggregateRating", ratingValue: BUSINESS.rating, reviewCount: BUSINESS.reviewCount },
      openingHours: "Mo-Su 11:00-01:00",
      department: (typeof BRANCHES !== "undefined" ? BRANCHES : []).map((b) => ({ "@type": "IceCreamShop", name: BUSINESS.name + " " + b.name, address: { "@type": "PostalAddress", streetAddress: b.address, addressLocality: "Mumbai", addressCountry: "IN" }, geo: { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lng }, telephone: b.phone })),
    }];
    if ($q("#faqAll") && typeof FAQS !== "undefined") {
      data.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [...FAQS, ...MORE_FAQS].map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });
    }
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
  }

  /* ---------- go ---------- */
  initEnquiryForms();
  replaceCheckout();
  renderOrders();
  renderPopular();
  initCateringEstimate();
  initReviews();
  initFaqPage();
  addNewsletter();
  addCookieNotice();
  addCallButton();
  addSkipLink();
  addFooterBusiness();
  addStructuredData();
  if (window.enhanceControls) enhanceControls();
  window.SweetDrip = { BUSINESS, COUPONS, waLink };
})();
