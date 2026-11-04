/* ============================================================
   THEME: rose pink
   Everything that gives this book its look. The engine, the models, the sounds
   and the API loader are shared (../shared/); the pages and their text are in pages.js.
   ============================================================ */
(() => {
  const INK = "#6b4a5c";
    function girlSticker(ctx, type, cx, cy, r, rot, col) {
      const WHITE = "#ffffff", PINK = "#f4a3bd", ROSE = "#e5799b", YEL = "#f6d88a", LIL = "#c9b3ee", DARK = "#7a4a63";
      const poly = pts => () => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)); ctx.closePath(); };
      const circ = (x, y, rad) => () => { ctx.beginPath(); ctx.arc(x * r, y * r, rad * r, 0, Math.PI * 2); };
      const ell = (x, y, rx, ry, a = 0) => () => { ctx.beginPath(); ctx.ellipse(x * r, y * r, rx * r, ry * r, a, 0, Math.PI * 2); };
      let parts = [], extra = () => {};
      if (type === "heart") parts = [[() => { ctx.beginPath(); ctx.moveTo(0, r * 0.9); ctx.bezierCurveTo(-r * 1.5, -r * 0.1, -r * 0.9, -r * 1.1, 0, -r * 0.35); ctx.bezierCurveTo(r * 0.9, -r * 1.1, r * 1.5, -r * 0.1, 0, r * 0.9); ctx.closePath(); }, col || ROSE]];
      else if (type === "star") parts = [[() => { ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? 0.5 : 1.1; ctx.lineTo(Math.cos(a) * q * r, Math.sin(a) * q * r); } ctx.closePath(); }, col || YEL]];
      else if (type === "sparkle") parts = [[() => { ctx.beginPath(); ctx.moveTo(0, -1.2 * r); ctx.quadraticCurveTo(0.12 * r, -0.12 * r, 1.2 * r, 0); ctx.quadraticCurveTo(0.12 * r, 0.12 * r, 0, 1.2 * r); ctx.quadraticCurveTo(-0.12 * r, 0.12 * r, -1.2 * r, 0); ctx.quadraticCurveTo(-0.12 * r, -0.12 * r, 0, -1.2 * r); ctx.closePath(); }, col || YEL]];
      else if (type === "bow") {
        parts = [[poly([[0, 0], [-1.1, -0.6], [-1.1, 0.6]]), col || PINK], [poly([[0, 0], [1.1, -0.6], [1.1, 0.6]]), col || PINK], [poly([[-0.1, 0.1], [-0.6, 1.1], [-0.2, 1.1]]), col || PINK], [poly([[0.1, 0.1], [0.6, 1.1], [0.2, 1.1]]), col || PINK], [circ(0, 0, 0.3), ROSE]];
      } else if (type === "flower") {
        for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 - Math.PI / 2; parts.push([circ(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.42), col || PINK]); }
        parts.push([circ(0, 0, 0.35), YEL]);
      } else if (type === "butterfly") {
        parts = [[ell(-0.62, -0.38, 0.62, 0.5, -0.4), col || LIL], [ell(0.62, -0.38, 0.62, 0.5, 0.4), col || LIL], [ell(-0.45, 0.45, 0.42, 0.34, 0.5), col || LIL], [ell(0.45, 0.45, 0.42, 0.34, -0.5), col || LIL], [ell(0, 0, 0.12, 0.7), DARK]];
        extra = () => { ctx.fillStyle = "rgba(255,255,255,.55)"; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 0.62 * r, -0.4 * r, 0.16 * r, 0, Math.PI * 2); ctx.fill(); } };
      } else if (type === "cherry") {
        parts = [[circ(-0.45, 0.45, 0.5), "#e24a68"], [circ(0.5, 0.55, 0.5), "#e24a68"]];
        extra = () => { ctx.strokeStyle = "#5c9a62"; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.moveTo(-0.4 * r, 0); ctx.quadraticCurveTo(-0.2 * r, -0.8 * r, 0.3 * r, -1.1 * r); ctx.moveTo(0.45 * r, 0.1); ctx.quadraticCurveTo(0.4 * r, -0.7 * r, 0.3 * r, -1.1 * r); ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.arc(-0.6 * r, 0.3 * r, 0.12 * r, 0, Math.PI * 2); ctx.arc(0.35 * r, 0.4 * r, 0.12 * r, 0, Math.PI * 2); ctx.fill(); };
      } else if (type === "cake") {
        parts = [[poly([[-1, 0.1], [1, 0.1], [1, 0.9], [-1, 0.9]]), col || PINK], [poly([[-0.7, -0.5], [0.7, -0.5], [0.7, 0.1], [-0.7, 0.1]]), WHITE], [poly([[-0.08, -1], [0.08, -1], [0.08, -0.5], [-0.08, -0.5]]), ROSE]];
        extra = () => { ctx.fillStyle = YEL; ctx.beginPath(); ctx.ellipse(0, -1.18 * r, 0.14 * r, 0.22 * r, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#e24a68"; for (const x of [-0.6, -0.2, 0.2, 0.6]) { ctx.beginPath(); ctx.arc(x * r, 0.1 * r, 0.14 * r, 0, Math.PI); ctx.fill(); } };
      } else if (type === "balloon") {
        parts = [[ell(0, -0.2, 0.62, 0.8), col || PINK], [poly([[-0.14, 0.62], [0.14, 0.62], [0, 0.78]]), col || PINK]];
        extra = () => { ctx.strokeStyle = DARK; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.moveTo(0, 0.78 * r); ctx.bezierCurveTo(-0.3 * r, 1.0 * r, 0.3 * r, 1.2 * r, 0, 1.5 * r); ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.ellipse(-0.25 * r, -0.5 * r, 0.12 * r, 0.22 * r, 0.4, 0, Math.PI * 2); ctx.fill(); };
      } else if (type === "crown") {
        parts = [[poly([[-1, 0.7], [-1, -0.5], [-0.5, 0], [0, -0.85], [0.5, 0], [1, -0.5], [1, 0.7]]), col || YEL]];
        extra = () => { ctx.fillStyle = WHITE; for (const x of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.arc(x * r, 0.35 * r, 0.12 * r, 0, Math.PI * 2); ctx.fill(); } };
      } else if (type === "moon") {
        parts = [[() => { ctx.beginPath(); ctx.arc(0, 0, r, 0.984, Math.PI * 2 - 0.984, false); ctx.arc(0.44 * r, 0, 0.84 * r, Math.PI * 2 - 1.436, 1.436, true); ctx.closePath(); }, col || YEL]];
      }
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 180);
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.shadowColor = "rgba(170, 90, 130, .4)"; ctx.shadowBlur = r * 0.35; ctx.shadowOffsetY = r * 0.1;
      ctx.strokeStyle = WHITE; ctx.lineWidth = r * 0.42;
      for (const [d] of parts) { d(); ctx.stroke(); }
      ctx.shadowColor = "transparent";
      for (const [d, f] of parts) { d(); ctx.fillStyle = f; ctx.fill(); }
      extra();
      ctx.restore();
    }

  window.THEME = {
    ink: "#6b4a5c", blue: "#d4809f",          // text colour and accent
    emoji: "🎀",                           // in the page title and the wish message
    float: ["🌸", "🎀", "💖", "✨"],             // emoji that drift down the page and burst from the splash
    stickers: ["cake", "bow", "butterfly", "heart", "cherry", "flower"],   // cover stickers shown on the gift splash, drifting down the page and in the burst (the first is the big one)
    titleBg: false,                           // page titles sit on a taped label unless a page says otherwise
    // the named paper / sticky-note colours, and the paper clips (a little brighter than the paper)
    pastel: { blue: "#dbe2f8", butter: "#fff0c9", mint: "#dff2e6", lilac: "#ecdcf8", peach: "#fde0d2", pink: "#fbcfde" },
    clip: { blue: "#8fa4e8", butter: "#f0c95a", mint: "#7fcca5", lilac: "#b29be8", peach: "#f3a07c", pink: "#ef7fa6" },
    fireworks: ["#f48fb1", "#f2c13d", "#ee7fa0", "#c9a3f0", "#ffffff", "#f59b6c"],
    confetti: ["#f4a3bd", "#ffffff", "#e5c8f0", "#f9d9e3", "#f6d88a", "#c9b3ee"],

    // the cover and the back cover: the words, then small flat stickers around them
    cover: {
      noteY: 61.0,
      shadow: "170, 90, 130",
      polaroidBg: "#f6dce6",
      noteTapes: ["rgba(246, 205, 220, 1)", "rgba(214, 200, 245, 1)"],
      polaroidTapes: ["rgba(246, 205, 220, 1)", "rgba(214, 200, 245, 1)"],
      words: [
        ["happy", 38.5, "500 SIZE HAND", 13.0, "#8a5a78", 70.0],
        ["birthday", 44.5, "italic 600 SIZE SERIF", 16.0, "#e5799b", 86.0],
      ],
      stickers: [
        ["bow", 14, 10, 5, -10, null], ["bow", 85, 11, 5, 10, "#c9b3ee"],
        ["sparkle", 30, 17, 3.2, 15, null], ["butterfly", 76, 21, 5, 18, null], ["flower", 11, 25, 4.4, 0, null],
        ["heart", 89, 31, 4.2, -15, null], ["cherry", 27, 30, 4, 10, null], ["star", 7, 41, 2.6, -10, "#c9b3ee"],
        ["sparkle", 93, 43, 3, 12, null], ["moon", 14, 70, 4.4, -12, null], ["cake", 80, 71, 5.6, 6, null],
        ["star", 48, 74, 3.2, 8, "#f4a3bd"], ["crown", 30, 80, 4.4, -8, null], ["butterfly", 12, 88, 5, -20, "#f4a3bd"],
        ["balloon", 68, 86, 4.8, 8, "#c9b3ee"], ["flower", 88, 87, 4.4, 0, "#c9b3ee"], ["heart", 50, 90, 3.4, -12, "#f4a3bd"],
        ["cherry", 32, 93, 3.6, 0, null], ["sparkle", 92, 62, 3, 20, null], ["star", 7, 60, 2.6, 5, null],
      ],
      backStickers: [["cake", 50, 68, 9, 0, null], ["bow", 20, 18, 5, -10, null], ["bow", 80, 20, 5, 10, "#c9b3ee"], ["flower", 14, 60, 4, 10, null], ["butterfly", 84, 62, 6, 25, null], ["cherry", 22, 85, 5, 0, null], ["crown", 78, 88, 5, 8, null], ["sparkle", 12, 72, 3.6, -10, null]],
    },
    sticker: girlSticker,                      // draws one cover sticker

    // the 3D cake: its tiers, decorations and the colour of the candle stripes
    cake: {
      candle: ["#ffffff", "#ee8fb0"],
      body(g, k, { cyl, rim }) {
      const rosy = k.gloss("#f8c3d4"), cream = k.gloss("#fffaf3"), plate = k.gloss("#ffffff"), deep = k.gloss("#ee8fb0");

      // a small plate hardly wider than the cake, so it never covers the stickers around it
      cyl(0.175, 0.012, 0.006, plate);
      // two soft pink tiers with a cream rim
      cyl(0.145, 0.1, 0.062, rosy);  rim(0.145, 0.112, cream); rim(0.145, 0.016, cream);
      cyl(0.095, 0.08, 0.152, cream); rim(0.095, 0.192, rosy);
      const TOP = 0.192;
      // a pink ribbon bow on the front of the bottom tier
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.1465, 0.1465, 0.016, 56, 1, true), deep); band.position.y = 0.075; g.add(band);
      for (const sx of [-1, 1]) {
        const loop = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0065, 8, 18), deep);
        loop.position.set(sx * 0.021, 0.08, 0.15); loop.rotation.set(0.1, sx * 0.5, sx * 0.4); g.add(loop);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.04, 0.003), deep);
        tail.position.set(sx * 0.013, 0.052, 0.15); tail.rotation.z = sx * 0.3; g.add(tail);
      }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), deep); knot.position.set(0, 0.08, 0.154); g.add(knot);
      // little cream hearts-as-pearls round the top tier, and strawberries on top
      const pearl = new THREE.SphereGeometry(0.008, 10, 8);
      for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, m = new THREE.Mesh(pearl, cream); m.position.set(Math.cos(a) * 0.095, 0.2, Math.sin(a) * 0.095); g.add(m); }
      const strawberry = k.gloss("#e64466"), leaf = k.gloss("#6bb37f");
      for (let n = 0; n < 4; n++) {
        const a = n / 4 * Math.PI * 2 + 0.4, x = Math.cos(a) * 0.055, z = Math.sin(a) * 0.055;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), strawberry); b.scale.set(1, 1.15, 1); b.position.set(x, TOP + 0.012, z); g.add(b);
        const lf = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), leaf); lf.scale.set(1.5, 0.3, 1.5); lf.position.set(x, TOP + 0.027, z); g.add(lf);
      }
      return TOP;
      },
    },
  };
})();
