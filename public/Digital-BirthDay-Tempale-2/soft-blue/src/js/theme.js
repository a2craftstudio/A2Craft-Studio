/* ============================================================
   THEME: soft blue
   Everything that gives this book its look. The engine, the models, the sounds
   and the API loader are shared (../shared/); the pages and their text are in pages.js.
   ============================================================ */
(() => {
  const INK = "#4b5563";
    function boySticker(ctx, type, cx, cy, r, rot, col) {
      const NAVY = "#355c9a", WHITE = "#ffffff", DARK = "#2e3a55", YEL = "#f6c94a", RED = "#e76a5a";
      const poly = pts => () => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)); ctx.closePath(); };
      const circ = (x, y, rad) => () => { ctx.beginPath(); ctx.arc(x * r, y * r, rad * r, 0, Math.PI * 2); };
      const ell = (x, y, rx, ry) => () => { ctx.beginPath(); ctx.ellipse(x * r, y * r, rx * r, ry * r, 0, 0, Math.PI * 2); };
      let parts = [], extra = () => {};
      if (type === "star") parts = [[() => { ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? 0.5 : 1.1; ctx.lineTo(Math.cos(a) * q * r, Math.sin(a) * q * r); } ctx.closePath(); }, col || YEL]];
      else if (type === "bolt") parts = [[poly([[0.2, -1.1], [-0.7, 0.15], [-0.05, 0.15], [-0.3, 1.1], [0.75, -0.2], [0.1, -0.2]]), col || YEL]];
      else if (type === "crown") {
        parts = [[poly([[-1, 0.7], [-1, -0.5], [-0.5, 0], [0, -0.85], [0.5, 0], [1, -0.5], [1, 0.7]]), col || YEL]];
        extra = () => { ctx.fillStyle = WHITE; for (const x of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.arc(x * r, 0.35 * r, 0.12 * r, 0, Math.PI * 2); ctx.fill(); } };
      } else if (type === "balloon") {
        parts = [[ell(0, -0.2, 0.62, 0.8), col || NAVY], [poly([[-0.14, 0.62], [0.14, 0.62], [0, 0.78]]), col || NAVY]];
        extra = () => {
          ctx.strokeStyle = DARK; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.moveTo(0, 0.78 * r); ctx.bezierCurveTo(-0.3 * r, 1.0 * r, 0.3 * r, 1.2 * r, 0, 1.5 * r); ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.ellipse(-0.25 * r, -0.5 * r, 0.12 * r, 0.22 * r, 0.4, 0, Math.PI * 2); ctx.fill();
        };
      } else if (type === "football") {
        parts = [[circ(0, 0, 1), WHITE]];
        extra = () => {
          ctx.fillStyle = DARK; ctx.beginPath();
          for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; ctx.lineTo(Math.cos(a) * 0.36 * r, Math.sin(a) * 0.36 * r); }
          ctx.closePath(); ctx.fill();
          for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * 0.82 * r, Math.sin(a) * 0.82 * r, 0.2 * r, 0, Math.PI * 2); ctx.fill(); }
        };
      } else if (type === "rocket") {
        parts = [[poly([[0, -1.2], [0.5, -0.4], [0.5, 0.7], [-0.5, 0.7], [-0.5, -0.4]]), WHITE], [poly([[-0.5, 0.1], [-1, 0.9], [-0.5, 0.7]]), col || RED], [poly([[0.5, 0.1], [1, 0.9], [0.5, 0.7]]), col || RED], [poly([[-0.3, 0.7], [0.3, 0.7], [0, 1.2]]), YEL]];
        extra = () => {
          ctx.fillStyle = col || RED; ctx.beginPath(); ctx.moveTo(-0.5 * r, -0.4 * r); ctx.lineTo(0, -1.2 * r); ctx.lineTo(0.5 * r, -0.4 * r); ctx.closePath(); ctx.fill();
          ctx.fillStyle = NAVY; ctx.beginPath(); ctx.arc(0, -0.05 * r, 0.22 * r, 0, Math.PI * 2); ctx.fill();
        };
      } else if (type === "planet") {
        parts = [[circ(0, 0, 0.62), col || "#8fb4e3"]];
        extra = () => { ctx.strokeStyle = YEL; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.ellipse(0, 0, 1.05 * r, 0.3 * r, -0.4, 0, Math.PI * 2); ctx.stroke(); };
      } else if (type === "moon") {
        parts = [[() => { ctx.beginPath(); ctx.arc(0, 0, r, 0.984, Math.PI * 2 - 0.984, false); ctx.arc(0.44 * r, 0, 0.84 * r, Math.PI * 2 - 1.436, 1.436, true); ctx.closePath(); }, col || YEL]];
      } else if (type === "cake") {
        parts = [[poly([[-1, 0.1], [1, 0.1], [1, 0.9], [-1, 0.9]]), col || "#8fb4e3"], [poly([[-0.7, -0.5], [0.7, -0.5], [0.7, 0.1], [-0.7, 0.1]]), WHITE], [poly([[-0.08, -1], [0.08, -1], [0.08, -0.5], [-0.08, -0.5]]), RED]];
        extra = () => {
          ctx.fillStyle = YEL; ctx.beginPath(); ctx.ellipse(0, -1.18 * r, 0.14 * r, 0.22 * r, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = RED; for (const x of [-0.6, -0.2, 0.2, 0.6]) { ctx.beginPath(); ctx.arc(x * r, 0.1 * r, 0.14 * r, 0, Math.PI); ctx.fill(); }
        };
      }
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 180);
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.shadowColor = "rgba(50, 80, 130, .4)"; ctx.shadowBlur = r * 0.35; ctx.shadowOffsetY = r * 0.1;
      ctx.strokeStyle = WHITE; ctx.lineWidth = r * 0.42;
      for (const [d] of parts) { d(); ctx.stroke(); }
      ctx.shadowColor = "transparent";
      for (const [d, f] of parts) { d(); ctx.fillStyle = f; ctx.fill(); }
      extra();
      ctx.restore();
    }

  window.THEME = {
    ink: "#4b5563", blue: "#7f9cbf",          // text colour and accent
    emoji: "⭐",                           // in the page title and the wish message
    float: ["⭐", "🎈", "✨", "🪁"],             // emoji that drift down the page and burst from the splash
    stickers: ["cake", "rocket", "balloon", "star", "football", "crown"],   // cover stickers shown on the gift splash, drifting down the page and in the burst (the first is the big one)
    titleBg: false,                           // page titles sit on a taped label unless a page says otherwise
    // the named paper / sticky-note colours, and the paper clips (a little brighter than the paper)
    pastel: { blue: "#d4e4f7", butter: "#fff2bd", mint: "#d7f1e4", lilac: "#e6def8", peach: "#fde3d5", pink: "#f9d9e3" },
    clip: { blue: "#7fa8de", butter: "#f0c95a", mint: "#7fcca5", lilac: "#ad95e6", peach: "#f3a07c", pink: "#ef8fae" },
    fireworks: ["#6fa3e6", "#f2c13d", "#ee7fa0", "#5fc79a", "#a48ae6", "#f59b6c"],
    confetti: ["#a9c1dd", "#ffffff", "#e9dcc6", "#7f9cbf", "#f3e3d3", "#cfdcea"],

    // the cover and the back cover: the words, then small flat stickers around them
    cover: {
      backWords: ["#5d84b3", "#e58aa5"],
      words: [
        ["HAPPY", 37.0, "500 SIZE SANS", 11.0, "#355c9a", 70.0],
        ["BIRTHDAY", 44.5, "500 SIZE SANS", 14.5, "#e76a5a", 80.0],
      ],
      stickers: [
        ["balloon", 14, 10, 5.4, -10, "#355c9a"], ["balloon", 85, 11, 5.4, 10, "#e76a5a"],
        ["rocket", 82, 24, 5, 28, null], ["football", 11, 25, 4.4, 0, null],
        ["planet", 89, 31, 4.4, -15, "#b39ae8"], ["bolt", 27, 30, 3.6, 10, null], ["star", 7, 41, 2.6, -10, "#8fb4e3"],
        ["star", 93, 43, 2.8, 12, null], ["moon", 14, 70, 4.4, -12, null], ["cake", 80, 71, 5.6, 6, null],
        ["star", 48, 74, 3.2, 8, "#8fb4e3"], ["crown", 30, 80, 4.4, -8, "#e76a5a"], ["rocket", 12, 88, 5, -35, "#355c9a"],
        ["balloon", 68, 86, 4.8, 8, "#8fb4e3"], ["football", 88, 87, 4.2, 0, null], ["bolt", 50, 90, 3.4, -12, null],
        ["planet", 32, 93, 3.6, 0, "#7fcca5"], ["star", 92, 62, 2.8, 20, "#e76a5a"], ["star", 7, 60, 2.6, 5, null],
      ],
      backStickers: [["cake", 50, 68, 9, 0, null], ["balloon", 20, 18, 5, -10, "#355c9a"], ["balloon", 80, 20, 5, 10, "#e76a5a"], ["star", 14, 60, 4, 10, null], ["rocket", 84, 62, 6, 25, null], ["football", 22, 85, 5, 0, null], ["crown", 78, 88, 5, 8, null], ["bolt", 12, 72, 3.6, -10, null]],
    },
    sticker: boySticker,                      // draws one cover sticker

    // the 3D cake: its tiers, decorations and the colour of the candle stripes
    cake: {
      candle: ["#ffffff", "#9db8de"],
      body(g, k, { cyl, rim }) {
      const sky = k.gloss("#c3d6ec"), cream = k.gloss("#fffaf3"), plate = k.gloss("#ffffff");

      // a simple plate hardly wider than the cake, so it never covers the stickers around it
      cyl(0.175, 0.012, 0.006, plate);
      // two plain tiers with a soft cream rim
      cyl(0.145, 0.1, 0.062, sky);  rim(0.145, 0.112, cream); rim(0.145, 0.016, cream);
      cyl(0.095, 0.08, 0.152, cream); rim(0.095, 0.192, sky);
      const TOP = 0.192;
      return TOP;
      },
    },
  };
})();
