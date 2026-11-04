/* Sweet Drip — visitor customization panel (saved in this browser only) */
(() => {
  const KEY = "sweetdrip-look";
  const DEFAULTS = { accent: "#e60023", theme: "light", shape: "soft", density: "cozy", font: "modern", motion: "on", hearts: "hover" };
  const ACCENTS = [
    ["#e60023", "Cherry"], ["#111111", "Ink"], ["#d6336c", "Raspberry"], ["#f76707", "Mango"],
    ["#0b7285", "Lagoon"], ["#7048e8", "Grape"], ["#2b8a3e", "Pistachio"],
  ];
  const OPTIONS = [
    ["theme", "Mode", [["light", "Light"], ["dark", "Night"]]],
    ["shape", "Card shape", [["sharp", "Sharp"], ["soft", "Soft"], ["round", "Round"]]],
    ["density", "Grid size", [["compact", "Compact"], ["cozy", "Cozy"], ["roomy", "Roomy"]]],
    ["font", "Font", [["modern", "Modern"], ["classic", "Classic"], ["friendly", "Friendly"]]],
    ["motion", "Animations", [["on", "On"], ["off", "Off"]]],
    ["hearts", "Heart button", [["hover", "On hover"], ["always", "Always"]]],
  ];

  let st = { ...DEFAULTS };
  try { st = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

  const root = document.documentElement;
  function apply() {
    root.style.setProperty("--pink", st.accent);
    root.style.setProperty("--pink-3", st.accent);
    root.style.setProperty("--pink-2", `color-mix(in srgb, ${st.accent} 14%, white)`);
    root.style.setProperty("--blush", `color-mix(in srgb, ${st.accent} 10%, white)`);
    ["theme", "shape", "density", "font", "motion", "hearts"].forEach((k) => root.setAttribute("data-" + k, st[k]));
  }
  apply();

  function build() {
    const wrap = document.createElement("div");
    wrap.className = "cz";
    wrap.innerHTML = `
      <button class="cz-fab" aria-label="Customize the site" aria-expanded="false" title="Customize"><i class="ph ph-sliders-horizontal"></i></button>
      <aside class="cz-panel" aria-label="Customize" hidden>
        <div class="cz-head"><b>Make it yours</b><button class="cz-x" aria-label="Close"><i class="ph ph-x"></i></button></div>
        <div class="cz-group"><span>Accent colour</span>
          <div class="cz-swatches">${ACCENTS.map(([c, n]) => `<button class="cz-sw" data-accent="${c}" style="--c:${c}" title="${n}" aria-label="${n}"></button>`).join("")}
            <label class="cz-sw cz-custom" title="Pick any colour"><input type="color" value="${st.accent}" aria-label="Custom colour"><i class="ph ph-eyedropper"></i></label>
          </div>
        </div>
        ${OPTIONS.map(([k, label, opts]) => `<div class="cz-group"><span>${label}</span><div class="cz-seg" data-key="${k}">${opts.map(([v, t]) => `<button data-v="${v}">${t}</button>`).join("")}</div></div>`).join("")}
        <button class="cz-reset">Reset to default</button>
      </aside>`;
    document.body.appendChild(wrap);

    const panel = wrap.querySelector(".cz-panel"), fab = wrap.querySelector(".cz-fab");
    const picker = wrap.querySelector("input[type=color]");
    const toggle = (open) => { panel.hidden = !open; fab.setAttribute("aria-expanded", open); };
    const mark = () => {
      wrap.querySelectorAll(".cz-sw[data-accent]").forEach((b) => b.classList.toggle("on", b.dataset.accent.toLowerCase() === st.accent.toLowerCase()));
      wrap.querySelectorAll(".cz-seg").forEach((g) => g.querySelectorAll("button").forEach((b) => b.classList.toggle("on", st[g.dataset.key] === b.dataset.v)));
      if (/^#[0-9a-f]{6}$/i.test(st.accent)) picker.value = st.accent;
    };
    fab.addEventListener("click", () => toggle(panel.hidden));
    wrap.querySelector(".cz-x").addEventListener("click", () => toggle(false));
    document.addEventListener("keydown", (e) => e.key === "Escape" && toggle(false));
    wrap.addEventListener("click", (e) => {
      const a = e.target.closest("[data-accent]"), o = e.target.closest(".cz-seg button");
      if (a) st.accent = a.dataset.accent;
      else if (o) st[o.parentElement.dataset.key] = o.dataset.v;
      else if (e.target.closest(".cz-reset")) st = { ...DEFAULTS };
      else return;
      apply(); save(); mark();
    });
    picker.addEventListener("input", (e) => { st.accent = e.target.value; apply(); save(); mark(); });
    mark();
  }
  if (document.body) build(); else document.addEventListener("DOMContentLoaded", build);
})();
