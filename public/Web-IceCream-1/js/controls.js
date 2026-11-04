/* =========================================================
   Themed form controls — replace the browser's grey dropdowns
   and date pickers with Modern ones. The original
   <select>/<input type="date"> stay in the form (hidden), so
   form data, validation and change events keep working.
   ========================================================= */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const ico = (name) => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const fire = (el) => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  function closeAll(except) {
    $$(".csel.open, .cdate.open").forEach((w) => {
      if (w === except) return;
      w.classList.remove("open");
      const b = $(".csel-btn, .cdate-btn", w);
      if (b) b.setAttribute("aria-expanded", "false");
    });
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".csel, .cdate")) closeAll();
  });
  addEventListener("keydown", (e) => e.key === "Escape" && closeAll());
  addEventListener("resize", () => closeAll());

  // open upwards when there's no room below (e.g. inside the cart drawer)
  const place = (wrap, btn) => {
    const r = btn.getBoundingClientRect();
    wrap.classList.toggle("up", innerHeight - r.bottom < 300 && r.top > 300);
  };

  /* ---------- Dropdown ---------- */
  function enhanceSelect(sel) {
    sel.dataset.enhanced = "1";
    const field = sel.closest(".field");
    const wrap = document.createElement("div");
    wrap.className = "csel" + (sel.closest(".select-pill") ? " pill" : "") + (field ? " in-field" : "");
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.tabIndex = -1;
    sel.setAttribute("aria-hidden", "true");
    const label = sel.getAttribute("aria-label") || (field && $("span", field) ? $("span", field).textContent : "Choose");
    wrap.insertAdjacentHTML(
      "beforeend",
      `<button type="button" class="csel-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="${label}"><span class="csel-val"></span>${ico("caret-down")}</button>
       <ul class="csel-list" role="listbox" aria-label="${label}"></ul>`
    );
    const btn = $(".csel-btn", wrap);
    const list = $(".csel-list", wrap);
    let hi = -1;

    const sync = () => {
      const o = sel.options[sel.selectedIndex];
      $(".csel-val", btn).textContent = o ? o.text : "";
    };
    const build = () => {
      list.innerHTML = [...sel.options]
        .map((o, i) => `<li role="option" data-i="${i}" aria-selected="${i === sel.selectedIndex}" class="${i === sel.selectedIndex ? "sel" : ""}"><span>${o.text}</span>${ico("check")}</li>`)
        .join("");
    };
    const highlight = (i) => {
      const items = $$("li", list);
      if (!items.length) return;
      hi = (i + items.length) % items.length;
      items.forEach((li, n) => li.classList.toggle("hi", n === hi));
      items[hi].scrollIntoView({ block: "nearest" });
    };
    const open = () => {
      closeAll(wrap);
      build();
      place(wrap, btn);
      wrap.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      highlight(Math.max(0, sel.selectedIndex));
    };
    const close = () => {
      wrap.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    };
    const pick = (i) => {
      if (i < 0) return;
      if (sel.selectedIndex !== i) {
        sel.selectedIndex = i;
        fire(sel);
      }
      sync();
      close();
      btn.focus();
    };

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      wrap.classList.contains("open") ? close() : open();
    });
    btn.addEventListener("keydown", (e) => {
      const isOpen = wrap.classList.contains("open");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        isOpen ? highlight(hi + (e.key === "ArrowDown" ? 1 : -1)) : open();
      } else if ((e.key === "Enter" || e.key === " ") && isOpen) {
        e.preventDefault();
        pick(hi);
      } else if (e.key === "Tab" && isOpen) {
        close();
      } else if (e.key.length === 1 && /\S/.test(e.key)) {
        // type a letter to jump to the first matching option
        const i = [...sel.options].findIndex((o) => o.text.toLowerCase().startsWith(e.key.toLowerCase()));
        if (i > -1) {
          if (!isOpen) open();
          highlight(i);
        }
      }
    });
    // keep clicks inside the <label class="field"> from re-focusing the hidden select
    list.addEventListener("mousedown", (e) => e.preventDefault());
    list.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const li = e.target.closest("li");
      if (li) pick(Number(li.dataset.i));
    });
    list.addEventListener("mousemove", (e) => {
      const li = e.target.closest("li");
      if (li && Number(li.dataset.i) !== hi) highlight(Number(li.dataset.i));
    });
    sel.addEventListener("change", sync);
    if (sel.form) sel.form.addEventListener("reset", () => setTimeout(sync));
    sync();
  }

  /* ---------- Calendar ---------- */
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parse = (v) => new Date(v + "T00:00");

  function enhanceDate(inp) {
    inp.dataset.enhanced = "1";
    const wrap = document.createElement("div");
    wrap.className = "cdate";
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    inp.classList.add("cdate-native");
    inp.tabIndex = -1;
    wrap.insertAdjacentHTML(
      "beforeend",
      `<button type="button" class="cdate-btn empty" aria-haspopup="dialog" aria-expanded="false"><span class="cdate-val">Pick a date</span>${ico("calendar-blank")}</button>
       <div class="cdate-pop" role="dialog" aria-label="Choose a date"></div>`
    );
    const btn = $(".cdate-btn", wrap);
    const pop = $(".cdate-pop", wrap);
    let view = inp.value ? parse(inp.value) : new Date();
    view.setDate(1);

    const minDate = () => (inp.min ? parse(inp.min) : null);
    const sync = () => {
      $(".cdate-val", btn).textContent = inp.value
        ? parse(inp.value).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
        : "Pick a date";
      btn.classList.toggle("empty", !inp.value);
    };
    const render = () => {
      const y = view.getFullYear();
      const m = view.getMonth();
      const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
      const days = new Date(y, m + 1, 0).getDate();
      const today = iso(new Date());
      const mn = minDate();
      let cells = "<span></span>".repeat(lead);
      for (let d = 1; d <= days; d++) {
        const dt = new Date(y, m, d);
        const v = iso(dt);
        const off = mn && dt < mn;
        cells += `<button type="button" data-v="${v}" class="${v === today ? "today" : ""} ${v === inp.value ? "on" : ""}" ${off ? "disabled" : ""} aria-label="${dt.toDateString()}">${d}</button>`;
      }
      const prevOff = mn && new Date(y, m, 0) < mn;
      pop.innerHTML = `
        <div class="cd-head">
          <button type="button" data-nav="-1" aria-label="Previous month" ${prevOff ? "disabled" : ""}>${ico("caret-left")}</button>
          <b>${view.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</b>
          <button type="button" data-nav="1" aria-label="Next month">${ico("caret-right")}</button>
        </div>
        <div class="cd-week">${["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((w) => `<span>${w}</span>`).join("")}</div>
        <div class="cd-grid">${cells}</div>
        <div class="cd-quick">
          <button type="button" data-q="0">Today</button>
          <button type="button" data-q="1">Tomorrow</button>
          <button type="button" data-q="sat">This weekend</button>
        </div>`;
    };
    const open = () => {
      closeAll(wrap);
      view = inp.value ? parse(inp.value) : new Date();
      view.setDate(1);
      render();
      place(wrap, btn);
      wrap.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
    };
    const close = () => {
      wrap.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    };
    const set = (d) => {
      const mn = minDate();
      if (mn && d < mn) return;
      inp.value = iso(d);
      fire(inp);
      sync();
      close();
      btn.focus();
    };

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      wrap.classList.contains("open") ? close() : open();
    });
    pop.addEventListener("mousedown", (e) => e.preventDefault());
    pop.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      if (b.dataset.nav) {
        view.setMonth(view.getMonth() + Number(b.dataset.nav));
        render();
      } else if (b.dataset.v) {
        set(parse(b.dataset.v));
      } else if (b.dataset.q) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        if (b.dataset.q === "1") d.setDate(d.getDate() + 1);
        if (b.dataset.q === "sat") d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
        set(d);
      }
    });
    if (inp.form) inp.form.addEventListener("reset", () => setTimeout(sync));
    inp.addEventListener("change", sync);
    sync();
  }

  window.enhanceControls = function (root = document) {
    $$("select:not([data-enhanced])", root).forEach(enhanceSelect);
    $$('input[type="date"]:not([data-enhanced])', root).forEach(enhanceDate);
  };
})();
