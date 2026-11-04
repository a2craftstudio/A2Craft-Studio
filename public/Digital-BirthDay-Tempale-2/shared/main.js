/* ============================================================
   3D spiral-bound birthday album – Three.js
   The pages are drawn on canvases from src/js/pages.js and
   hung on a metal spiral coil. Pages swing over the coil when
   they turn; the camera can be rotated and zoomed.
   ============================================================ */
(() => {
  const PAGES = BOOK.pages;
  const N = PAGES.length / 2;                 // sheets (each has a front and a back page)

  const PW = 1024, PH = 1411;                 // page canvas size (450 x 620 ratio)
  const W = 1, H = PH / PW;                   // page size in 3D units
  const COVER_GROW = 1.03;                    // covers are a little bigger than the pages
  const CORNER_R = 0.045;                     // how round the book's corners are (3D units)
  const COVER_T = 0.018;                      // cover board thickness
  const LEAF_T = 0.011;                       // thickness of each bundle of paper
  const SEG = 36;                             // how smoothly a page bends
  const FLIP_MS = 1200;

  // spiral coil
  const TOTAL_T = 2 * COVER_T + (N - 2) * LEAF_T;
  const RING_R = TOTAL_T / 2 + 0.014;         // coil radius
  const RING_Y = RING_R + 0.001;              // the coil rests on the table
  const HOLE_IN = 0.018;                      // distance from a page's inner edge to its holes
  const HOLE_R = 0.0075;                      // half width of a punched slot
  const RING_GAP = 0.05;                      // distance between hole pairs
  const WIRE = 0.0036;                        // wire thickness
  const PAIR = 0.006;                         // each hole holds two loops, PAIR apart from its centre

  const THEME = window.THEME;                 // the look: colours, cover stickers, cake (see the theme.js of each template)
  const INK = THEME.ink, BLUE = THEME.blue;
  // the back cover's words and name: backWords [colour, colour] in theme.js, else the cover's own word colours
  const CV = Object.assign({ backWords: THEME.cover.words.slice(0, 2).map(w => w[4]), noteY: 59, shadow: "60, 80, 110", polaroidBg: "#dfe9f5",
    noteTapes: ["rgba(188, 213, 242, 1)", "rgba(246, 221, 138, 1)"], polaroidTapes: ["rgba(246, 205, 220, 1)", "rgba(188, 213, 242, 1)"] }, THEME.cover);
  const SERIF = '"Cormorant Garamond", Georgia, serif';
  const HAND = '"Caveat", cursive';
  const fontOf = f => f.replace("SANS", SANS).replace("HAND", HAND).replace("SERIF", SERIF);   // "500 SIZE HAND" in theme.js
  const SANS = '"DM Sans", system-ui, sans-serif';

  /* pictures live in the theme's src folder, so nothing needs the internet except the fonts and Three.js:
       src/photos = the couple's photos (photo-01.jpg ...), src/layers = the page papers (paper-*.jpg).
       A full https:// address still works online. */
  const imageUrl = p => {
    if (!p.startsWith("http")) {
      const file = p.split("/").pop();
      return `src/${file.startsWith("paper-") ? "layers" : "photos"}/${file}`;
    }
    if (window.BOOK_API && window.BOOK_API.direct) return p;           // the picture server allows CORS
    return `https://wsrv.nl/?url=${encodeURIComponent(p.replace(/^https?:\/\//, ""))}&w=900`;
  };

  const $ = id => document.getElementById(id);
  const state = { current: 0, side: "right", wished: false, celebrated: false };

  // personal link: index.html?name=xyz&from=xyz  ({name} and {from} in pages.js are replaced)
  const params = new URLSearchParams(location.search);
  const NAME = (params.get("name") || BOOK.name || "").trim().slice(0, 24);
  const FROM = (params.get("from") || BOOK.from || "").trim().slice(0, 24);
  const fill = text => text.replace(/\{name\}/g, NAME).replace(/\{from\}/g, FROM);
  if (NAME) document.title = `Happy Birthday, ${NAME} ${THEME.emoji}`;
  const isPortrait = () => innerWidth / innerHeight < 0.85;

  // positions of the coil loops along the binding
  const RINGS = [];
  {
    const span = H * COVER_GROW - 0.12;
    const n = Math.floor(span / RING_GAP);
    for (let k = 0; k <= n; k++) RINGS.push(-span / 2 + k * (span / n));
  }

  /* ============ page drawing ============ */
  const imgCache = new Map();
  let loaded = 0, toLoad = 0;
  function loadImg(p) {
    if (!p) return Promise.resolve(null);
    if (!imgCache.has(p)) {
      imgCache.set(p, new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => { tick(); resolve(img); };
        img.onerror = () => {
          // a picture from the API that fails falls back to the static picture it replaced
          const fb = (window.BOOK_FALLBACK || {})[p];
          if (fb && fb !== p) loadImg(fb).then(resolve);
          else { tick(); resolve(null); }
        };
        img.src = imageUrl(p);
      }));
    }
    return imgCache.get(p);
  }
  function tick() {
    loaded++;
    $("loadBar").style.width = Math.round(loaded / Math.max(toLoad, 1) * 100) + "%";
  }

  function coverFit(ctx, img, x, y, w, h, fallback = "#eef1f4") {
    if (!img) { ctx.fillStyle = fallback; ctx.fillRect(x, y, w, h); return; }
    const s = Math.max(w / img.width, h / img.height);
    const sw = w / s, sh = h / s;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  }

  function wrap(ctx, text, maxW) {
    const lines = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  /* ============ the book covers ============
     A cream linen board, trimmed with eyelet lace and a soft gold rule:
     an arched photo window strung with pearls, the title, a satin ribbon
     with the name, a wax seal and little sprigs of baby's breath.         */
  const COVER_INK = "#53637c", COVER_ACC = "#8aa6c6";
  const GOLD = "rgba(201, 169, 106, .8)", GOLD_SOFT = "rgba(201, 169, 106, .42)";
  const LACE = "rgba(255, 253, 248, .95)";
  const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

  // a tall window with a round top, like a photo arch
  function archPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x, y + h - r);
    ctx.lineTo(x, y + w / 2);
    ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.closePath();
  }

  // bobble lace: a row of little scallops straddling the panel's edge, each with an eyelet
  function laceTrim(ctx, x, y, w, h, s) {
    const dots = [];
    const put = (cx, cy) => { ctx.beginPath(); ctx.arc(cx, cy, s, 0, Math.PI * 2); ctx.fill(); dots.push([cx, cy]); };
    ctx.save();
    ctx.fillStyle = LACE;
    ctx.shadowColor = "rgba(120, 130, 150, .2)"; ctx.shadowBlur = s * 0.7; ctx.shadowOffsetY = s * 0.12;
    const nx = Math.max(2, Math.round(w / (s * 1.75))), ny = Math.max(2, Math.round(h / (s * 1.75)));
    for (let k = 0; k <= nx; k++) { const cx = x + k * w / nx; put(cx, y); put(cx, y + h); }
    for (let k = 1; k < ny; k++) { const cy = y + k * h / ny; put(x, cy); put(x + w, cy); }
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "rgba(206, 196, 178, .45)";
    for (const [cx, cy] of dots) { ctx.beginPath(); ctx.arc(cx, cy, s * 0.26, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // a string of pearls following a path given as points
  function pearls(ctx, pts, r) {
    for (const [px, py] of pts) {
      const g = ctx.createRadialGradient(px - r * 0.35, py - r * 0.4, r * 0.1, px, py, r * 1.15);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.55, "#f6eee2"); g.addColorStop(1, "#ddd0bd");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // a sprig of baby's breath
  function sprig(ctx, x, y, len, angle) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle * Math.PI / 180);
    ctx.strokeStyle = "rgba(132, 150, 126, .8)"; ctx.lineWidth = Math.max(1.4, len * 0.018); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.55, -len * 0.1, len, -len * 0.04); ctx.stroke();
    for (let k = 1; k <= 5; k++) {
      const t = k / 6, bx = len * t, by = -len * 0.08 * Math.sin(t * Math.PI);
      const side = k % 2 ? -1 : 1, bl = len * 0.2;
      const fx = bx + bl * 0.55, fy = by + side * bl * 0.95;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + bl * 0.3, by + side * bl * 0.4, fx, fy); ctx.stroke();
      for (let j = 0; j < 3; j++) {
        ctx.fillStyle = j === 1 ? "#fffdf8" : "rgba(255, 252, 245, .92)";
        ctx.beginPath();
        ctx.arc(fx + Math.cos(j * 2.1 + k) * bl * 0.22, fy + Math.sin(j * 2.1 + k) * bl * 0.22, bl * 0.21, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // a satin ribbon banner with a word on it
  function ribbonBanner(ctx, cx, cy, w, h, text, size, ink) {
    const half = w / 2, tail = h * 1.15, notch = h * 0.45;
    ctx.save();
    ctx.shadowColor = "rgba(80, 95, 120, .22)"; ctx.shadowBlur = h * 0.35; ctx.shadowOffsetY = h * 0.12;
    // the two tails, tucked behind
    ctx.fillStyle = "#b9cde4";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * (half - h * 0.1), cy - h * 0.34);
      ctx.lineTo(cx + s * (half + tail), cy - h * 0.6);
      ctx.lineTo(cx + s * (half + tail - notch), cy);
      ctx.lineTo(cx + s * (half + tail), cy + h * 0.6);
      ctx.lineTo(cx + s * (half - h * 0.1), cy + h * 0.34);
      ctx.closePath(); ctx.fill();
    }
    // the band
    const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    g.addColorStop(0, "#e4edf7"); g.addColorStop(0.42, "#cfdeee"); g.addColorStop(1, "#aec4dd");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - half, cy - h / 2);
    ctx.quadraticCurveTo(cx, cy - h * 0.62, cx + half, cy - h / 2);
    ctx.lineTo(cx + half, cy + h / 2);
    ctx.quadraticCurveTo(cx, cy + h * 0.62, cx - half, cy + h / 2);
    ctx.closePath(); ctx.fill();
    ctx.shadowColor = "transparent";
    // a satin highlight
    ctx.fillStyle = "rgba(255, 255, 255, .4)";
    ctx.beginPath();
    ctx.moveTo(cx - half, cy - h * 0.28);
    ctx.quadraticCurveTo(cx, cy - h * 0.4, cx + half, cy - h * 0.28);
    ctx.lineTo(cx + half, cy - h * 0.1);
    ctx.quadraticCurveTo(cx, cy - h * 0.22, cx - half, cy - h * 0.1);
    ctx.closePath(); ctx.fill();
    if (text) {
      ctx.font = `500 ${size}px ${HAND}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = ink;
      ctx.fillText(text, cx, cy + h * 0.04);
    }
    ctx.restore();
  }

  // a pressed wax seal with a heart in it
  function waxSeal(ctx, cx, cy, r) {
    ctx.save();
    ctx.shadowColor = "rgba(90, 80, 90, .3)"; ctx.shadowBlur = r * 0.5; ctx.shadowOffsetY = r * 0.14;
    ctx.beginPath();
    for (let k = 0; k <= 80; k++) {
      const a = k / 80 * Math.PI * 2, rad = r * (1 + 0.075 * Math.sin(a * 9));
      const qx = cx + Math.cos(a) * rad, qy = cy + Math.sin(a) * rad;
      k ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.2);
    g.addColorStop(0, "#f7e2e8"); g.addColorStop(0.6, "#e9c6d1"); g.addColorStop(1, "#d3a9b8");
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = "transparent";
    // the pressed heart
    ctx.fillStyle = "rgba(160, 112, 130, .5)";
    const s = r * 0.52;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.8);
    ctx.bezierCurveTo(cx - s * 1.1, cy - s * 0.1, cx - s * 0.6, cy - s * 1.05, cx, cy - s * 0.35);
    ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.05, cx + s * 1.1, cy - s * 0.1, cx, cy + s * 0.8);
    ctx.fill();
    ctx.restore();
  }

  // a word in the plain serif followed by a word in the italic serif, centred
  function serifPair(ctx, plain, fancy, y, size, ink, accent) {
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.font = `500 ${size}px ${SERIF}`;
    const w1 = plain ? ctx.measureText(plain + " ").width : 0;
    ctx.font = `italic 500 ${size}px ${SERIF}`;
    const w2 = fancy ? ctx.measureText(fancy).width : 0;
    const x = (PW - w1 - w2) / 2;
    ctx.shadowColor = "rgba(120, 135, 160, .22)"; ctx.shadowBlur = size * 0.1; ctx.shadowOffsetY = size * 0.03;
    if (plain) { ctx.font = `500 ${size}px ${SERIF}`; ctx.fillStyle = ink; ctx.fillText(plain + " ", x, y); }
    if (fancy) { ctx.font = `italic 500 ${size}px ${SERIF}`; ctx.fillStyle = accent; ctx.fillText(fancy, x + w1, y); }
    ctx.shadowColor = "transparent";
  }

  // a gold hairline with a tiny diamond in the middle
  function ruleDiamond(ctx, y, half, u) {
    ctx.strokeStyle = GOLD; ctx.lineWidth = 0.2 * u;
    ctx.beginPath(); ctx.moveTo(PW / 2 - half, y); ctx.lineTo(PW / 2 - 2.6 * u, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PW / 2 + 2.6 * u, y); ctx.lineTo(PW / 2 + half, y); ctx.stroke();
    ctx.save();
    ctx.translate(PW / 2, y); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = GOLD; ctx.fillRect(-0.75 * u, -0.75 * u, 1.5 * u, 1.5 * u);
    ctx.restore();
  }

  /* the cover: a Pinterest scrapbook page – gingham paper, a taped polaroid, bubbly words and sticker doodles */
  function flatSticker(ctx, shape, cx, cy, r, color, rot = 0) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 180);
    const path = () => {
      ctx.beginPath();
      if (shape === "heart") {
        ctx.moveTo(0, r * 0.9); ctx.bezierCurveTo(-r * 1.5, -r * 0.1, -r * 0.9, -r * 1.1, 0, -r * 0.35);
        ctx.bezierCurveTo(r * 0.9, -r * 1.1, r * 1.5, -r * 0.1, 0, r * 0.9);
      } else {
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr2 = k % 2 ? r * 0.5 : r * 1.1; ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
      }
      ctx.closePath();
    };
    ctx.shadowColor = "rgba(70, 100, 140, .35)"; ctx.shadowBlur = r * 0.4; ctx.shadowOffsetY = r * 0.12;
    path(); ctx.lineJoin = "round"; ctx.lineWidth = r * 0.5; ctx.strokeStyle = "#ffffff"; ctx.stroke();
    ctx.shadowColor = "transparent"; ctx.fillStyle = color; path(); ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, .4)"; ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.25, r * 0.13, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3d4352";
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * r * 0.28, r * 0.05, r * 0.09, r * 0.12, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "rgba(246, 150, 175, .7)";
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * r * 0.5, r * 0.28, r * 0.14, r * 0.08, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function tapeStrip(ctx, cx, cy, w, h, ang, color) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang * Math.PI / 180);
    ctx.globalAlpha = 0.9; ctx.fillStyle = color; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = "rgba(255, 255, 255, .55)";
    for (let x = -w / 2 + h * 0.4; x < w / 2; x += h * 0.9) ctx.fillRect(x, -h / 2, h * 0.35, h);
    ctx.restore();
  }

  // words with a thick white sticker outline
  function stickerWords(ctx, text, cx, y, font, size, color, maxW) {
    ctx.save(); ctx.font = font.replace("SIZE", size + "px"); ctx.textAlign = "center"; ctx.textBaseline = "top";
    while (ctx.measureText(text).width > maxW && size > 20) { size *= 0.94; ctx.font = font.replace("SIZE", size + "px"); }
    ctx.lineJoin = "round"; ctx.lineWidth = size * 0.2; ctx.strokeStyle = "#ffffff";
    ctx.shadowColor = "rgba(70, 100, 140, .35)"; ctx.shadowBlur = size * 0.15; ctx.shadowOffsetY = size * 0.05;
    ctx.strokeText(text, cx, y); ctx.shadowColor = "transparent";
    ctx.fillStyle = color; ctx.fillText(text, cx, y); ctx.restore();
  }

  async function drawCoverArt(ctx, pg, u, v) {
    const C = pg.cover;
    coverFit(ctx, await loadImg(C.paper || pg.bg), 0, 0, PW, PH, "#dbe7f6");
    ctx.fillStyle = "rgba(255, 255, 255, .16)"; ctx.fillRect(0, 0, PW, PH);

    const named = C.name && fill(C.name).trim()
      && !(C.name.includes("{name}") && !NAME) && !(C.name.includes("{from}") && !FROM);
    const cx = PW / 2, SANS_B = `500 SIZE ${SERIF}`, ITAL = `italic 600 SIZE ${SERIF}`;

    if (C.photo) {
      /* a sticker-sheet cover: bold letters in the middle, small stickers all around */
      for (const [text, y, font, size, color, maxW] of THEME.cover.words) stickerWords(ctx, text, cx, y * v, fontOf(font), size * u, color, maxW * u);
      if (named) {
        const nw = 52 * u, nh = 10 * v, nx = cx - nw / 2, ny = CV.noteY * v;
        ctx.save(); ctx.translate(cx, ny + nh / 2); ctx.rotate(-1.5 * Math.PI / 180);
        ctx.shadowColor = `rgba(${CV.shadow}, .3)`; ctx.shadowBlur = 2.4 * u; ctx.shadowOffsetY = u;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(-nw / 2, -nh / 2, nw, nh); ctx.shadowColor = "transparent";
        ctx.fillStyle = INK; ctx.font = `500 ${8 * u}px ${HAND}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(fill(C.name), 0, 0.2 * u); ctx.restore();
        tapeStrip(ctx, nx + 2 * u, ny, 13 * u, 4.4 * u, -35, CV.noteTapes[0]);
        tapeStrip(ctx, nx + nw - 2 * u, ny + nh, 13 * u, 4.4 * u, -35, CV.noteTapes[1]);
      }
      for (const [t, x, y, q, rot, col] of THEME.cover.stickers) THEME.sticker(ctx, t, x * u, y * v, q * u, rot, col);
      /* a little polaroid of him, taped at the top */
      const pw = 32 * u, pad = 2 * u, iw = pw - 2 * pad, ih = iw * 1.05, ph = pad + ih + 5 * u, py = 7 * v;
      ctx.save(); ctx.translate(cx, py + ph / 2); ctx.rotate(3 * Math.PI / 180);
      ctx.shadowColor = `rgba(${CV.shadow}, .35)`; ctx.shadowBlur = 2.6 * u; ctx.shadowOffsetY = u;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(-pw / 2, -ph / 2, pw, ph); ctx.shadowColor = "transparent";
      coverFit(ctx, await loadImg(C.photo), -pw / 2 + pad, -ph / 2 + pad, iw, ih, CV.polaroidBg);
      ctx.restore();
      tapeStrip(ctx, cx - 9 * u, py + 0.5 * u, 11 * u, 3.8 * u, -28, CV.polaroidTapes[0]);
      tapeStrip(ctx, cx + 10 * u, py + 1.2 * u, 11 * u, 3.8 * u, 30, CV.polaroidTapes[1]);
    } else {
      /* the back: big words and stickers */
      if (C.title) {
        stickerWords(ctx, C.title[0], cx, 30 * v, SANS_B, 12 * u, CV.backWords[0], 80 * u);
        stickerWords(ctx, C.title[1], cx, 37 * v, ITAL, 20 * u, CV.backWords[1], 86 * u);
      }
      if (named) stickerWords(ctx, fill(C.name), cx, 52 * v, `500 SIZE ${HAND}`, 8 * u, CV.backWords[0], 70 * u);
      for (const [t, x, y, q, rot, col] of THEME.cover.backStickers) THEME.sticker(ctx, t, x * u, y * v, q * u, rot, col);
    }
    if (C.foot && !C.photo) {
      ctx.save(); ctx.font = `500 ${5.6 * u}px ${HAND}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff"; ctx.shadowColor = "rgba(70, 100, 140, .6)"; ctx.shadowBlur = 1.6 * u;
      ctx.fillText(fill(C.foot), cx, 92 * v); ctx.restore();
    }
  }

  const canvases = PAGES.map(() => Object.assign(document.createElement("canvas"), { width: PW, height: PH }));
  const regions = PAGES.map(() => []);        // clickable areas (wish / read again), in 0..1 page units
  let textures = [];

  // the content is drawn inside a margin so the punched holes stay clear
  const BIND = 4;                             // % of the page width kept free next to the coil

  async function drawPage(i) {
    const pg = PAGES[i];
    const ctx = canvases[i].getContext("2d");
    const right = i % 2 === 0;                // even pages are right-hand pages (coil on their left)
    const cover = i === 0 || i === PAGES.length - 1;
    const u = PW / 100, v = PH / 100;
    regions[i] = [];

    ctx.save();
    ctx.clearRect(0, 0, PW, PH);
    if (pg.cover) await drawCoverArt(ctx, pg, u, v);
    else coverFit(ctx, await loadImg(pg.bg), 0, 0, PW, PH, "#fbf8f2");

    // shrink the content a little, away from the coil, so the holes stay clear
    const sq = cover ? 1 : (100 - BIND) / 100;
    const offX = cover ? 0 : right ? PW * (1 - sq) : 0, offY = PH * (1 - sq) / 2;
    ctx.translate(offX, offY);
    ctx.scale(sq, sq);
    const map = { x: fx => offX / PW + fx * sq, y: fy => offY / PH + fy * sq };   // content → page (0..1)

    if (pg.title) {
      const [plain, fancy] = pg.title;
      const size = 9.5 * u;
      ctx.textBaseline = "top";
      ctx.font = `500 ${size}px ${SERIF}`;
      const w1 = ctx.measureText(plain).width;
      ctx.font = `italic 500 ${size}px ${SERIF}`;
      const w2 = ctx.measureText(fancy).width;
      const x = (PW - w1 - w2) / 2;
      const titleBg = pg.titleBg === undefined ? THEME.titleBg : pg.titleBg;
      if (titleBg) {
        // a taped paper label behind the title, so it reads on busy papers
        const pad = 3.4 * u, bx = x - pad, by = 3.2 * v, bw = w1 + w2 + pad * 2, bh = size * 1.12;
        ctx.save();
        ctx.shadowColor = "rgba(60, 70, 90, .2)"; ctx.shadowBlur = 2 * u; ctx.shadowOffsetY = .6 * u;
        ctx.fillStyle = titleBg === true ? "#fffdf8" : pastel(titleBg);
        ctx.translate(PW / 2, by + bh / 2); ctx.rotate(-0.012); ctx.translate(-PW / 2, -by - bh / 2);
        ctx.fillRect(bx, by, bw, bh);
        ctx.shadowColor = "transparent";
        ctx.fillStyle = "rgba(226, 214, 192, .85)";
        ctx.fillRect(bx - 2 * u, by - 1.2 * u, 9 * u, 3.4 * u);
        ctx.fillRect(bx + bw - 7 * u, by + bh - 2.2 * u, 9 * u, 3.4 * u);
        ctx.restore();
      }
      ctx.font = `500 ${size}px ${SERIF}`; ctx.fillStyle = pg.ink || INK; ctx.fillText(plain, x, 4 * v);
      ctx.font = `italic 500 ${size}px ${SERIF}`; ctx.fillStyle = pg.accent || BLUE; ctx.fillText(fancy, x + w1, 4 * v);
    }

    // (photos are real 3D polaroids – see makePhoto)
    for (const t of pg.texts || []) drawText(ctx, t, u, v, i, map);
    ctx.restore();

    // soft shading next to the coil
    if (!cover) {
      const g = ctx.createLinearGradient(right ? 0 : PW, 0, right ? 9 * u : PW - 9 * u, 0);
      g.addColorStop(0, "rgba(90,100,120,.16)");
      g.addColorStop(1, "rgba(90,100,120,0)");
      ctx.fillStyle = g;
      ctx.fillRect(right ? 0 : PW - 9 * u, 0, 9 * u, PH);
    }

    // the inside of each cover is a little bigger than the pages: give it a cream mount border
    if (i === 1 || i === PAGES.length - 2) {
      const m = ((COVER_GROW - 1) / 2 / COVER_GROW + 0.014) * PW;   // border width in pixels
      ctx.save();
      ctx.fillStyle = "#f6f2ea";
      ctx.beginPath();
      ctx.rect(0, 0, PW, PH);
      ctx.rect(m, m, PW - 2 * m, PH - 2 * m);
      ctx.fill("evenodd");
      ctx.restore();
    }

    // punched holes for the spiral
    const w = cover ? W * COVER_GROW : W, h = cover ? H * COVER_GROW : H;
    const hx = (HOLE_IN / w) * PW;
    const rx = (HOLE_R / w) * PW, ry = ((PAIR + WIRE + 0.005) / h) * PH;
    ctx.save();
    for (const z of RINGS) {
      if (Math.abs(z) > h / 2 - 0.03) continue;
      const cy = (z + h / 2) / h * PH;
      const cx = right ? hx : PW - hx;
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath(); ctx.roundRect(cx - rx, cy - ry, rx * 2, ry * 2, rx); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(70, 75, 90, .3)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(cx - rx - 1, cy - ry - 1, rx * 2 + 2, ry * 2 + 2, rx + 1); ctx.stroke();
    }
    ctx.restore();

    // rounded book corners: the paper outside them is rubbed out, and alphaTest hides it in 3D
    {
      const rad = cover ? CORNER_R / COVER_GROW * PW : CORNER_R * 0.55 * PW;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.rect(0, 0, PW, PH);
      ctx.roundRect(0, 0, PW, PH, rad);
      ctx.fill("evenodd");
      ctx.restore();
    }

    if (textures[i]) textures[i].needsUpdate = true;
  }

  function drawPolaroid(ctx, img, p, u, v, page, map) {
    const w = p.w * u, pad = 2.4 * u, iw = w - 2 * pad, ih = iw * (p.square ? 1 : 1.25);
    const capSize = 4.6 * u;
    ctx.font = `500 ${capSize}px ${HAND}`;
    const lines = p.cap ? wrap(ctx, p.cap, iw) : [];
    const capH = lines.length ? 1.4 * u + lines.length * capSize * 1.05 + 2.4 * u : 6 * u;
    const h = pad + ih + capH;
    const x = p.x * u, y = p.y * v;

    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((p.r || 0) * Math.PI / 180);
    ctx.shadowColor = "rgba(70, 80, 100, .25)";
    ctx.shadowBlur = 3.2 * u;
    ctx.shadowOffsetY = 1.2 * u;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.shadowColor = "transparent";
    coverFit(ctx, img, -w / 2 + pad, -h / 2 + pad, iw, ih);

    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    lines.forEach((l, k) => ctx.fillText(l, 0, -h / 2 + pad + ih + 1.4 * u + k * capSize * 1.05));

    // washi tape
    ctx.rotate(-3 * Math.PI / 180);
    ctx.fillStyle = "rgba(226, 214, 192, .88)";
    ctx.fillRect(-w * 0.14, -h / 2 - 2.6 * u, w * 0.28, 5.4 * u);
    ctx.restore();

    if (p.action) regions[page].push({ action: p.action, x0: map.x(p.x / 100), y0: map.y(p.y / 100), x1: map.x((x + w) / PW), y1: map.y((y + h) / PH) });
  }

  function drawText(ctx, t, u, v, page, map) {
    ctx.save();
    ctx.textBaseline = "top";
    const x = t.x * u, y = t.y * v, w = (t.w ?? 100) * u;
    const align = t.align || "center";
    ctx.textAlign = align;
    const ax = align === "center" ? x + w / 2 : align === "right" ? x + w : x;
    if (t.shadow) { ctx.shadowColor = "rgba(50, 70, 100, .55)"; ctx.shadowBlur = 1.6 * u; }

    // lines that use {name} / {from} are left out when no name is given
    if ((t.text.includes("{name}") && !NAME) || (t.text.includes("{from}") && !FROM)) { ctx.restore(); return; }
    let text = fill(t.text);
    if (t.id === "wishMsg" && state.wished) text = `your wish is on its way ${THEME.emoji}`;

    if (t.kind === "cover") {
      const size = (t.size || 21) * u;
      ctx.font = `${t.italic ? "italic " : ""}500 ${size}px ${SERIF}`;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(70, 90, 120, .45)"; ctx.shadowBlur = 3 * u; ctx.shadowOffsetY = .6 * u;
      ctx.fillText(text, ax, y);
    } else if (t.kind === "small") {
      ctx.font = `400 ${3 * u}px ${SANS}`;
      if ("letterSpacing" in ctx) ctx.letterSpacing = `${0.6 * u}px`;
      ctx.fillStyle = t.color || INK;
      ctx.fillText(text, ax, y);
    } else if (t.kind === "button") {
      ctx.font = `400 ${3.6 * u}px ${SANS}`;
      const bw = ctx.measureText(text).width + 10 * u, bh = 8 * u;
      const bx = x - bw / 2;
      ctx.shadowColor = "rgba(70, 90, 120, .25)"; ctx.shadowBlur = 2 * u; ctx.shadowOffsetY = .8 * u;
      ctx.fillStyle = "rgba(255, 255, 255, .9)";
      ctx.beginPath(); ctx.roundRect(bx, y, bw, bh, bh / 2); ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = BLUE; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(text, x, y + bh / 2);
      regions[page].push({ action: t.action, x0: map.x(bx / PW), y0: map.y(y / PH), x1: map.x((bx + bw) / PW), y1: map.y((y + bh) / PH) });
    } else {
      const letter = t.kind === "letter";
      const size = (t.size || (letter ? 5.2 : 5.4)) * u, lh = size * (letter ? 1.45 : 1.25);
      ctx.font = `500 ${size}px ${HAND}`;
      const lines = wrap(ctx, text, w);
      if (t.r) {
        const cx = x + w / 2, cy = y + lines.length * lh / 2;
        ctx.translate(cx, cy); ctx.rotate(t.r * Math.PI / 180); ctx.translate(-cx, -cy);
      }
      if (t.paper) {
        // a scrap of paper behind the words, taped down
        const tw = Math.max(...lines.map(l => ctx.measureText(l).width));
        const pad = 3.2 * u, bw = tw + pad * 2, bh = lines.length * lh + pad * 1.4;
        const bx = align === "center" ? ax - bw / 2 : align === "right" ? ax - bw + pad : ax - pad;
        const by = y - pad * 0.6;
        ctx.save();
        ctx.shadowColor = "rgba(60, 70, 90, .22)"; ctx.shadowBlur = 2 * u; ctx.shadowOffsetY = .7 * u;
        ctx.fillStyle = t.paper === true ? "#fffdf8" : pastel(t.paper);
        ctx.fillRect(bx, by, bw, bh);
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = "rgba(127,156,191,.22)"; ctx.lineWidth = .25 * u;
        for (let k = 1; k <= lines.length; k++) { ctx.beginPath(); ctx.moveTo(bx + pad * .5, y + k * lh - lh * .1); ctx.lineTo(bx + bw - pad * .5, y + k * lh - lh * .1); ctx.stroke(); }
        ctx.fillStyle = "rgba(226, 214, 192, .85)";
        ctx.translate(bx + bw / 2, by); ctx.rotate(-.05);
        ctx.fillRect(-bw * .14, -1.8 * u, bw * .28, 3.6 * u);
        ctx.restore();
      }
      ctx.fillStyle = t.color || INK;
      lines.forEach((l, k) => ctx.fillText(l, ax, y + k * lh));
    }
    ctx.restore();
  }

  /* ============ 3D scene ============ */
  const canvas = $("scene");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe4ec, 2.0));
  const sun = new THREE.DirectionalLight(0xfff6ea, 1.7);
  sun.position.set(-1.8, 4.4, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -2.6, right: 2.6, top: 2.4, bottom: -2.4, near: 0.5, far: 12 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.01;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.17 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // a soft studio reflection for the metal coil
  const envCanvas = Object.assign(document.createElement("canvas"), { width: 256, height: 128 });
  {
    const c = envCanvas.getContext("2d"), g = c.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.45, "#cfdcec"); g.addColorStop(0.55, "#7d8896"); g.addColorStop(1, "#e8e1d6");
    c.fillStyle = g; c.fillRect(0, 0, 256, 128);
    c.fillStyle = "#ffffff"; c.fillRect(40, 18, 60, 22); c.fillRect(160, 24, 50, 16);
  }
  const envTex = new THREE.CanvasTexture(envCanvas);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromEquirectangular(envTex).texture;

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  textures = canvases.map((c, i) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    if (i % 2 === 1) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }   // back pages are seen mirrored
    return t;
  });

  const board = new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.85 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xd9dde3, metalness: 1, roughness: 0.28, envMap, envMapIntensity: 1.2 });
  // the spiral binding takes the theme's colour (BOOK.coil, or from the order)
  const coilMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(BOOK.coil || "#d9dde3"), metalness: 0.6, roughness: 0.3, envMap, envMapIntensity: 1.1 });

  // striped page edges for the paper blocks
  const edgeCanvas = Object.assign(document.createElement("canvas"), { width: 64, height: 256 });
  {
    const c = edgeCanvas.getContext("2d");
    c.fillStyle = "#fbf9f4"; c.fillRect(0, 0, 64, 256);
    for (let y = 0; y < 256; y += 3) { c.fillStyle = `rgba(140,145,155,${0.08 + Math.random() * 0.1})`; c.fillRect(0, y, 64, 1); }
  }
  const edgeTex = new THREE.CanvasTexture(edgeCanvas);
  edgeTex.colorSpace = THREE.SRGBColorSpace;
  const edgeMat = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.95 });
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xfbf9f4, roughness: 0.95 });

  /* a flat slab with rounded corners: w across x, h across z, t thick in y.
     The binding edge is left square, because it hides under the coil. */
  function roundedSlabGeo(w, h, t, rx, rz, squareLeft) {
    const lx = squareLeft ? 0 : rx, lz = squareLeft ? 0 : rz;
    const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
    const sh = new THREE.Shape();
    sh.moveTo(x0 + lx, y0);
    sh.lineTo(x1 - rx, y0); sh.quadraticCurveTo(x1, y0, x1, y0 + rz);
    sh.lineTo(x1, y1 - rz); sh.quadraticCurveTo(x1, y1, x1 - rx, y1);
    sh.lineTo(x0 + lx, y1); sh.quadraticCurveTo(x0, y1, x0, y1 - lz);
    sh.lineTo(x0, y0 + lz); sh.quadraticCurveTo(x0, y0, x0 + lx, y0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 7 });
    g.translate(0, 0, -t / 2);
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }

  // the block of paper edges under each cover: rounded to match the pages
  const BLOCK_W = W - HOLE_IN - HOLE_R * 1.8 - 0.004, BLOCK_H = H * 0.994, BLOCK_R = CORNER_R * 0.55;
  function makeBlock() {
    const m = new THREE.Mesh(roundedSlabGeo(1, 1, 1, BLOCK_R / BLOCK_W, BLOCK_R / BLOCK_H, true), [paperMat, edgeMat]);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    return m;
  }
  const blockR = makeBlock(), blockL = makeBlock();

  // the spiral coil: one slightly tilted metal loop per hole, so it reads as a spiral
  // twin-loop wire binding: two parallel loops pass through every slot, so the wire always lines up with the holes
  const coil = new THREE.Group();
  {
    const loop = new THREE.TorusGeometry(RING_R, WIRE, 10, 72);
    for (const z of RINGS) for (const dz of [-PAIR, PAIR]) {
      const m = new THREE.Mesh(loop, coilMat);
      m.position.set(0, RING_Y, z + dz);
      m.castShadow = true;
      coil.add(m);
    }
  }
  scene.add(coil);

  /* a sheet: two pages back to back */
  function sheetGeometry(w, h) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array((SEG + 1) * 2 * 3), uv = new Float32Array((SEG + 1) * 2 * 2), idx = [];
    for (let k = 0; k <= SEG; k++) {
      uv.set([k / SEG, 1], k * 2);
      uv.set([k / SEG, 0], (SEG + 1 + k) * 2);
      pos.set([k / SEG * w, 0, -h / 2], k * 3);
      pos.set([k / SEG * w, 0, h / 2], (SEG + 1 + k) * 3);
      if (k < SEG) { const a = k, b = k + 1, c = SEG + 1 + k, d = c + 1; idx.push(a, c, b, b, c, d); }
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  const leaves = [];
  for (let i = 0; i < N; i++) {
    const hard = i === 0 || i === N - 1;
    const w = hard ? W * COVER_GROW : W, h = hard ? H * COVER_GROW : H;
    const geo = sheetGeometry(w, h);
    const group = new THREE.Group();
    const mat = (map, side) => new THREE.MeshStandardMaterial({ map, side, roughness: hard ? 0.75 : 0.9, alphaTest: 0.5 });
    const front = new THREE.Mesh(geo, mat(textures[2 * i], THREE.FrontSide));
    const back = new THREE.Mesh(geo, mat(textures[2 * i + 1], THREE.BackSide));
    front.userData = { leaf: i, page: 2 * i };
    back.userData = { leaf: i, page: 2 * i + 1 };
    for (const m of [front, back]) { m.castShadow = m.receiveShadow = true; group.add(m); }
    if (hard) {
      // the cover board: thick, starting just after the holes
      back.position.y = -COVER_T;
      const x0 = HOLE_IN + HOLE_R * 1.6;
      const box = new THREE.Mesh(roundedSlabGeo(w - x0, h, COVER_T * 0.9, CORNER_R, CORNER_R, true), board);
      box.position.set(x0 + (w - x0) / 2, -COVER_T / 2, 0);
      box.castShadow = box.receiveShadow = true;
      group.add(box);
    }
    scene.add(group);
    const flat = k => k / SEG * w;
    leaves.push({ i, hard, w, h, T: hard ? COVER_T : LEAF_T, geo, group, front, back, p: 0, from: 0, to: 0, t0: 0, dur: 1, lastP: -1,
      xs: Array.from({ length: SEG + 1 }, (_, k) => flat(k)), ys: new Array(SEG + 1).fill(0), as: new Array(SEG + 1).fill(0) });
  }
  const pickables = leaves.flatMap(l => [l.front, l.back]);

  function bendSheet(l, theta, bend) {
    const pos = l.geo.attributes.position.array;
    const ds = l.w / SEG;
    let x = 0, y = 0;
    for (let k = 0; k <= SEG; k++) {
      if (k > 0) {
        const a = theta + bend * ((k - 0.5) / SEG);
        x += Math.cos(a) * ds; y += Math.sin(a) * ds;
      }
      pos[k * 3] = x; pos[k * 3 + 1] = y;
      pos[(SEG + 1 + k) * 3] = x; pos[(SEG + 1 + k) * 3 + 1] = y;
      l.xs[k] = x; l.ys[k] = y; l.as[k] = theta + bend * (k / SEG);   // remembered so notes can follow the page
    }
    l.geo.attributes.position.needsUpdate = true;
    l.geo.computeVertexNormals();
    l.geo.computeBoundingSphere();
  }

  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  // where a sheet's holes sit on the coil when the sheet lies at height y on the right (or left)
  const ringAngle = y => Math.asin(clamp((y - RING_Y) / RING_R, -0.97, 0.97));

  function updateLeaves(now) {
    for (const l of leaves) {
      if (!l.dragging && l.p !== l.to) {
        const k = clamp((now - l.t0) / l.dur, 0, 1);
        l.p = l.from + (l.to - l.from) * ease(k);
        if (k >= 1) l.p = l.to;
      }
    }

    let restR = 0, restL = 0, edgeR = null, edgeL = null;
    for (const l of leaves) {
      let below = 0, belowL = 0;
      for (const o of leaves) {
        if (o.i > l.i) below += o.T * (1 - o.p);
        if (o.i < l.i) belowL += o.T * o.p;
      }
      if (!l.hard && l.p === 0 && below + l.T > restR) restR = below + l.T, edgeR = l;
      if (!l.hard && l.p === 1 && belowL + l.T > restL) restL = belowL + l.T, edgeL = l;

      // height of the sheet's page surface on each side
      const yR = below + l.T;
      const yL = l.hard ? belowL : belowL + l.T;
      // the holes slide round the coil, from the right side over the top to the left side
      const aR = ringAngle(yR), aL = Math.PI - ringAngle(yL);
      const a = aR + (aL - aR) * l.p;
      const hx = Math.cos(a) * RING_R, hy = RING_Y + Math.sin(a) * RING_R;
      let theta = l.p * Math.PI;
      if (l.i === 0 && l.p === 0 && l.to === 0 && !l.dragging) {
        const c = (now / 1000) % 4.5;
        theta += c < 0.9 ? Math.sin(c / 0.9 * Math.PI) * 0.09 : 0;
      }
      // the sheet's inner edge sits HOLE_IN before the hole
      l.group.position.set(hx - Math.cos(theta) * HOLE_IN, hy - Math.sin(theta) * HOLE_IN, 0);
      if (l.hard) {
        l.group.rotation.z = theta;
      } else if (l.p !== l.lastP) {
        bendSheet(l, theta, Math.sin(l.p * Math.PI) * 0.35);
        l.lastP = l.p;
      }
    }

    // paper blocks under the sheets
    const first = leaves[0], last = leaves[N - 1];
    const baseR = last.T * (1 - last.p), baseL = first.T * first.p;
    const inner = (l, dir) => l ? dir * l.group.position.x + HOLE_IN + HOLE_R * 1.8 : RING_R;
    placeBlock(blockR, baseR, Math.max(0, restR - baseR), 1, inner(edgeR, 1));
    placeBlock(blockL, baseL, Math.max(0, restL - baseL), -1, inner(edgeL, -1));
  }

  function placeBlock(m, base, h, dir, x0) {
    m.visible = h > 0.0015;
    const x1 = x0 + W - HOLE_IN - HOLE_R * 1.8 - 0.004;
    m.scale.set(x1 - x0, Math.max(h - 0.0015, 0.0005), H * 0.994);
    m.position.set(dir * (x0 + x1) / 2, base + h / 2 - 0.001, 0);
  }

  /* ============ 3D sticky notes & puffy stickers ============ */
  const PASTEL = THEME.pastel;
  const pastel = c => PASTEL[c] || c || PASTEL.butter;
  const decos = [];
  const notePicks = [];

  function noteTexture(text, color, underside, body) {
    const c = Object.assign(document.createElement("canvas"), { width: 320, height: 320 });
    const x = c.getContext("2d");
    x.fillStyle = color; x.fillRect(0, 0, 320, 320);
    // sticky strip and a soft paper shade
    const g = x.createLinearGradient(0, 0, 0, 320);
    g.addColorStop(0, "rgba(0,0,0,.07)"); g.addColorStop(.16, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(255,255,255,.18)");
    x.fillStyle = g; x.fillRect(0, 0, 320, 320);
    x.fillStyle = INK; x.textAlign = "center"; x.textBaseline = "middle";
    if (body) {
      // small heading, the wish underneath
      x.font = `500 26px ${SANS}`; x.fillStyle = "rgba(75,85,99,.6)";
      x.fillText(text.toLowerCase(), 160, 62);
      x.fillStyle = INK;
      let size = 46, lines;
      for (;;) { x.font = `500 ${size}px ${HAND}`; lines = wrap(x, body, 270); if (lines.length <= 4 || size < 30) break; size -= 4; }
      lines.forEach((l, k) => x.fillText(l, 160, 182 + (k - (lines.length - 1) / 2) * size * 1.08));
    } else if (text) {
      x.font = `500 ${underside ? 46 : 54}px ${HAND}`;
      const lines = wrap(x, text, 270);
      const lh = underside ? 52 : 60;
      lines.forEach((l, k) => x.fillText(l, 160, 168 + (k - (lines.length - 1) / 2) * lh));
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    if (underside) t.flipY = false;           // the underside is seen after the note flips over
    return t;
  }

  const pinMats = {};
  function makeNote(d, leaf, page) {
    const size = (d.size || 30) / 100 * W;
    const geo = new THREE.PlaneGeometry(size, size, 10, 10);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, size / 2);            // hinged along its top edge
    const base = geo.attributes.position.array.slice();
    const color = pastel(d.color);
    const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: noteTexture(fill(d.text), color, false, d.secret && fill(d.secret)), roughness: 0.85 }));
    const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: noteTexture("", color, true), roughness: 0.85, side: THREE.BackSide }));
    front.castShadow = back.castShadow = true;
    const hinge = new THREE.Group();
    hinge.add(front, back);

    // a tiny push pin holding the note
    const pinColor = d.pin || "#f4a7b9";
    pinMats[pinColor] ??= new THREE.MeshPhysicalMaterial({ color: pinColor, roughness: 0.3, clearcoat: 1 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(size * 0.075, 20, 14), pinMats[pinColor]);
    head.scale.y = 0.75;
    head.position.set(0, size * 0.07, size * 0.1);
    head.castShadow = true;
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.012, size * 0.012, size * 0.07, 8), metal);
    needle.position.set(0, size * 0.035, size * 0.1);

    const tilt = new THREE.Group();
    tilt.rotation.y = -(d.r || 0) * Math.PI / 180;
    tilt.add(hinge, head, needle);
    const holder = new THREE.Group();
    holder.add(tilt);
    leaf.group.add(holder);
    const deco = { kind: "note", d, leaf, page, holder, tilt, hinge, geo, base, size, pop: 0, vel: 0, flip: 0, flipTo: 0, phase: Math.random() * 6 };
    front.userData.deco = back.userData.deco = deco;
    notePicks.push(front, back);
    decos.push(deco);
  }

  // puffy sticker shapes, drawn about 1 unit wide
  const SHAPES = {
    heart() {
      const s = new THREE.Shape();
      s.moveTo(0, -0.42);
      s.bezierCurveTo(-0.15, -0.3, -0.55, -0.05, -0.5, 0.2);
      s.bezierCurveTo(-0.45, 0.45, -0.12, 0.5, 0, 0.27);
      s.bezierCurveTo(0.12, 0.5, 0.45, 0.45, 0.5, 0.2);
      s.bezierCurveTo(0.55, -0.05, 0.15, -0.3, 0, -0.42);
      return s;
    },
    star() {
      const s = new THREE.Shape();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 0.24 : 0.52, a = Math.PI / 2 + k * Math.PI / 5;
        if (k) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      return s;
    },
    moon() {
      const s = new THREE.Shape();
      s.absarc(0, 0, 0.5, 0.984, Math.PI * 2 - 0.984, false);          // the outer curve, tip to tip
      s.absarc(0.22, 0, 0.42, Math.PI * 2 - 1.436, 1.436, true);       // the inner curve meets it exactly at the tips
      return s;
    },
    cloud() {
      const s = new THREE.Shape();
      s.moveTo(-0.5, -0.18);
      s.lineTo(0.5, -0.18);
      s.absarc(0.38, 0.0, 0.2, -Math.PI / 2, Math.PI * 0.55, false);
      s.absarc(0.1, 0.12, 0.27, 0.1, Math.PI * 0.9, false);
      s.absarc(-0.25, 0.04, 0.22, Math.PI * 0.25, Math.PI * 1.0, false);
      s.absarc(-0.42, -0.06, 0.12, Math.PI * 0.5, Math.PI * 1.5, false);
      return s;
    },
  };
  const FACE_X = { heart: 0, star: 0, moon: -0.22, cloud: 0.02 };
  const FACE_Z = { heart: 0.02, star: 0.06, moon: 0, cloud: 0.02 };
  const shapeGeo = {};
  function stickerGeometry(name) {
    if (!shapeGeo[name]) {
      const g = new THREE.ExtrudeGeometry(SHAPES[name](), {
        depth: 0.12, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.07, bevelSegments: 6, curveSegments: 28,
      });
      g.rotateX(-Math.PI / 2);                // lie flat on the page, puffing upwards
      g.computeBoundingBox();
      const b = g.boundingBox;
      g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
      g.computeBoundingBox();
      shapeGeo[name] = g;
    }
    return shapeGeo[name];
  }
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x3d4352, roughness: 0.4 });
  const blushMat = new THREE.MeshStandardMaterial({ color: 0xf6a9b9, roughness: 0.9, transparent: true, opacity: 0.8 });
  const eyeGeo = new THREE.SphereGeometry(0.045, 14, 10);
  const blushGeo = new THREE.CircleGeometry(0.06, 20).rotateX(-Math.PI / 2);

  function makeSticker(d, leaf, page) {
    const name = d.shape || "heart";
    const geo = stickerGeometry(name);
    const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
      color: pastel(d.color), roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.25,
    }));
    mesh.castShadow = true;
    const body = new THREE.Group();
    body.add(mesh);
    if (d.face !== false) {
      const top = geo.boundingBox.max.y, fx = FACE_X[name], fz = FACE_Z[name];
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.scale.set(1, 0.6, 1.25);
        eye.position.set(fx + sx * 0.13, top - 0.01, fz - 0.02);
        const blush = new THREE.Mesh(blushGeo, blushMat);
        blush.position.set(fx + sx * 0.22, top + 0.002, fz + 0.08);
        body.add(eye, blush);
      }
    }
    const size = (d.size || 9) * 1.35 / 100 * W;
    body.scale.setScalar(size);
    const tilt = new THREE.Group();
    tilt.rotation.y = -(d.r || 0) * Math.PI / 180;
    tilt.add(body);
    const holder = new THREE.Group();
    holder.add(tilt);
    leaf.group.add(holder);
    decos.push({ kind: "sticker", d, leaf, page, holder, tilt, body, size, pop: 0, vel: 0, phase: Math.random() * 6 });
  }

  // shared helpers for the animated models in models.js
  const glowTex = {};
  function glowTexture(color) {
    if (!glowTex[color]) {
      const c = Object.assign(document.createElement("canvas"), { width: 64, height: 64 }), x = c.getContext("2d");
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, color); g.addColorStop(0.35, color + "aa"); g.addColorStop(1, color + "00");
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      glowTex[color] = new THREE.CanvasTexture(c);
    }
    return glowTex[color];
  }
  const kit = {
    pastel,
    gloss: (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.25, ...o }),
    sticker: name => stickerGeometry(name),
    glow(color, size, soft) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(color), transparent: true, depthWrite: false,
        blending: soft ? THREE.NormalBlending : THREE.AdditiveBlending, opacity: soft ? 0.5 : 1,
      }));
      m.scale.setScalar(size);
      return m;
    },
    stripeTexture(a, b) {
      const c = Object.assign(document.createElement("canvas"), { width: 64, height: 64 }), x = c.getContext("2d");
      x.fillStyle = a; x.fillRect(0, 0, 64, 64);
      x.fillStyle = b;
      for (let i = -64; i < 64; i += 16) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 8, 64); x.lineTo(i + 72, 0); x.lineTo(i + 64, 0); x.fill(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 2);
      return t;
    },
    footballTexture() {
      // white ball with dark patches where an icosahedron's corners point
      const c = Object.assign(document.createElement("canvas"), { width: 512, height: 256 }), x = c.getContext("2d");
      x.fillStyle = "#fbfbfb"; x.fillRect(0, 0, 512, 256);
      const ico = new THREE.IcosahedronGeometry(1, 0).attributes.position, seen = new Set();
      x.fillStyle = "#3a4150";
      for (let i = 0; i < ico.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(ico, i).normalize(), key = v.toArray().map(n => n.toFixed(2)).join();
        if (seen.has(key)) continue; seen.add(key);
        const lon = Math.atan2(v.x, v.z), lat = Math.asin(v.y);
        const cx = (lon / (2 * Math.PI) + 0.5) * 512, cy = (0.5 - lat / Math.PI) * 256, r = 22;
        for (const ox of [-512, 0, 512]) {
          x.beginPath();
          for (let k = 0; k < 5; k++) {
            const a = k / 5 * Math.PI * 2;
            x.lineTo(cx + ox + Math.cos(a) * r / Math.max(0.25, Math.cos(lat)), cy + Math.sin(a) * r);
          }
          x.fill();
        }
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return t;
    },
    // a text label lying on the page (scores etc.); label.set("text", "#colour")
    label(w, h, size = 0.42) {
      const c = Object.assign(document.createElement("canvas"), { width: 512, height: Math.round(512 * h / w) });
      const x = c.getContext("2d"), tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      mesh.position.y = 0.003;
      let last = "";
      mesh.set = (text, color = INK) => {
        if (text + color === last) return; last = text + color;
        x.clearRect(0, 0, c.width, c.height);
        x.font = `500 ${Math.round(c.height * size)}px ${HAND}`;
        x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = color;
        x.fillText(text, c.width / 2, c.height / 2);
        tex.needsUpdate = true;
      };
      return mesh;
    },
    sound: SOUND,
    burst: (x, y, n) => burst(x, y, n),
    wish(on) {
      state.wished = on;
      PAGES.forEach((pg, i) => { if ((pg.texts || []).some(t => t.id === "wishMsg")) drawPage(i); });
    },
  };

  const tapPicks = [];

  /* ----- 3D photos (polaroid, print or film): tap to pick one up, tap again to put it down ----- */
  const cardMat = new THREE.MeshStandardMaterial({ color: "#fdfdfb", roughness: 0.7 });
  const tapeMat = new THREE.MeshStandardMaterial({ color: "#e9dcc4", roughness: 0.9, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const filmMat = new THREE.MeshStandardMaterial({ color: "#1f2126", roughness: 0.6 });
  const PHOTO_T = 0.0035;                    // card thickness

  function roundedCard(w, h, r) {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2 + r, -h / 2);
    sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const g = new THREE.ExtrudeGeometry(sh, { depth: PHOTO_T, bevelEnabled: false, curveSegments: 6 });
    g.rotateX(-Math.PI / 2);                 // lie flat, thickness pointing up
    return g;
  }

  function cardTexture(draw, w, h) {
    const c = Object.assign(document.createElement("canvas"), { width: 512, height: Math.round(512 * h / w) });
    draw(c.getContext("2d"), c.width, c.height);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  }

  function makePhoto(p, leaf, page) {
    const right = page % 2 === 0, cover = page === 0 || page === PAGES.length - 1;
    const sq = cover ? 1 : (100 - BIND) / 100;
    const offX = cover ? 0 : right ? 1 - sq : 0, offY = (1 - sq) / 2;
    const lw = leaf.w, lh = leaf.h, unit = 0.01 * sq * lw;   // 1% of the page width, in 3D units

    // measure the caption so the card is the right height
    const style = p.style || "polaroid", film = style === "film", print = style === "print";
    const cw = p.w * unit, pad = (film ? 5 : print ? 1.4 : 2.4) * unit, iw = cw - 2 * pad;
    const ih = iw * (p.ratio || (p.square ? 1 : film ? 0.8 : 1.25));
    const capSize = (film ? 3.6 : 4.6) * unit;
    const meas = document.createElement("canvas").getContext("2d");
    meas.font = `500 ${capSize * 1000}px ${HAND}`;
    const lines = p.cap && !print ? wrap(meas, p.cap, iw * 1000) : [];
    const capH = print ? pad : film ? (lines.length ? 1 * unit + lines.length * capSize * 1.05 + 1.6 * unit : 2.4 * unit) :
      lines.length ? 1.4 * unit + lines.length * capSize * 1.05 + 2.4 * unit : 6 * unit;
    const top = film ? 2.4 * unit : pad;
    const ch = top + ih + capH;

    const front = cardTexture((x, W2, H2) => {
      const k = W2 / cw;
      const paint = img => {
        x.fillStyle = film ? "#1f2126" : "#ffffff"; x.fillRect(0, 0, W2, H2);
        if (film) {
          // sprocket holes down both sides
          x.fillStyle = "#f4efe6";
          const hw = 1.8 * unit * k, hh = 2.6 * unit * k, gap = 4.2 * unit * k;
          for (let y = gap * 0.4; y < H2 - hh; y += gap) for (const hx of [1.6 * unit * k, W2 - 1.6 * unit * k - hw]) {
            x.beginPath(); x.roundRect(hx, y, hw, hh, hw * 0.25); x.fill();
          }
        }
        coverFit(x, img, pad * k, top * k, iw * k, ih * k);
        // a soft inner shadow makes the print look set into the card
        x.strokeStyle = "rgba(0,0,0,.08)"; x.lineWidth = 2; x.strokeRect(pad * k, top * k, iw * k, ih * k);
        x.fillStyle = film ? "#f4efe6" : INK; x.textAlign = "center"; x.textBaseline = "top";
        x.font = `500 ${capSize * k}px ${HAND}`;
        lines.forEach((l, i) => x.fillText(l, W2 / 2, (top + ih + (film ? 1 : 1.4) * unit + i * capSize * 1.05) * k));
        if (film) { x.font = `500 ${1.7 * unit * k}px ${SANS}`; x.fillStyle = "#e7b45a"; x.textAlign = "left"; x.fillText("▸ 24   KODAK 400", pad * k, 0.4 * unit * k); }
      };
      paint(null);
      loadImg(p.img).then(async img => {
        await document.fonts.load(`500 40px ${HAND}`).catch(() => {});
        paint(img);
        frontTex.needsUpdate = true;
      });
    }, cw, ch);
    const frontTex = front;
    const backText = p.back || (p.cap ? `${p.cap}… remember this? ♡` : "♡");
    const back = cardTexture((x, W2, H2) => {
      x.fillStyle = "#fbf8f1"; x.fillRect(0, 0, W2, H2);
      x.strokeStyle = "rgba(127,156,191,.25)"; x.lineWidth = 2;
      for (let y = 70; y < H2 - 20; y += 44) { x.beginPath(); x.moveTo(30, y); x.lineTo(W2 - 30, y); x.stroke(); }
      x.fillStyle = INK; x.textAlign = "center"; x.textBaseline = "middle";
      x.font = `500 ${Math.round(W2 * 0.085)}px ${HAND}`;
      const ls = wrap(x, fill(backText), W2 * 0.8);
      ls.forEach((l, i) => x.fillText(l, W2 / 2, H2 / 2 + (i - (ls.length - 1) / 2) * W2 * 0.1));
      x.font = `400 ${Math.round(W2 * 0.04)}px ${SANS}`; x.fillStyle = "rgba(75,85,99,.5)";
      x.fillText("tap to put it back", W2 / 2, H2 - W2 * 0.07);
    }, cw, ch);
    back.wrapS = back.wrapT = THREE.RepeatWrapping;                              // read the right way round after the flip
    back.repeat.set(-1, -1); back.offset.set(1, 1);

    const body = new THREE.Group();
    const card = new THREE.Mesh(roundedCard(cw, ch, unit * 0.6), film ? filmMat : cardMat);
    card.castShadow = card.receiveShadow = true;
    const faceGeo = new THREE.PlaneGeometry(cw * 0.995, ch * 0.995).rotateX(-Math.PI / 2);
    const faceF = new THREE.Mesh(faceGeo, new THREE.MeshPhysicalMaterial({ map: front, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.18 }));
    faceF.position.y = PHOTO_T + 0.0004;
    const faceB = new THREE.Mesh(new THREE.PlaneGeometry(cw * 0.995, ch * 0.995).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ map: back, roughness: 0.85 }));
    faceB.position.y = -0.0004;
    body.add(card, faceF, faceB);
    if (p.clip) {
      // a paper clip over the top edge
      const L = cw * 0.34, clip = new THREE.Mesh(clipGeometry(), clipMat(p.clip));
      clip.scale.setScalar(L);
      clip.position.set(cw * (p.clipX ?? -0.18), PHOTO_T + L * 0.012, -ch / 2 + L * 0.14);
      clip.rotation.y = 0.06 - Math.random() * 0.12;
      clip.castShadow = true;
      body.add(clip);
    } else {
      const tape = new THREE.Mesh(new THREE.PlaneGeometry(cw * 0.3, cw * 0.11).rotateX(-Math.PI / 2), tapeMat);
      tape.position.set(0, PHOTO_T + 0.0012, -ch / 2 + cw * 0.01);
      tape.rotation.y = 0.05 - Math.random() * 0.1;
      body.add(tape);
    }
    const tag = p.wish ? makeWishTag(p, cw, ch) : null;
    if (tag) body.add(tag);
    body.position.z = ch / 2;

    const pivot = new THREE.Group();          // hinge along the top edge, under the tape
    pivot.position.z = -ch / 2;
    pivot.add(body);
    const lifter = new THREE.Group();
    lifter.add(pivot);
    const tilt = new THREE.Group();
    tilt.rotation.y = -(p.r || 0) * Math.PI / 180;
    tilt.add(lifter);
    const holder = new THREE.Group();
    holder.add(tilt);
    leaf.group.add(holder);

    const fx = offX + (p.x / 100 + p.w / 200) * sq;
    const fy = offY + (p.y / 100) * sq + (ch / lh) / 2;
    const deco = {
      kind: "photo", d: { x: fx * 100, y: fy * 100, r: p.r || 0 }, leaf, page, holder, tilt, lifter, pivot, body,
      cw, ch, pop: 0, vel: 0, phase: Math.random() * 6, lift: 0, liftTo: 0, flip: 0, flipTo: 0, rest: 0.018 + Math.random() * 0.012,
    };
    for (const m of [card, faceF, faceB, ...(tag ? tag.children : [])]) { m.userData.deco = deco; tapPicks.push(m); }
    decos.push(deco);
  }

  // a gem paper clip, 1 unit long, lying flat with its top end at z = -0.5
  let clipGeo = null;
  function clipGeometry() {
    if (clipGeo) return clipGeo;
    const a = 0.17, b = 0.1, c = 0.035;      // half widths of the outer, middle and inner wire
    const pts = [];
    const line = (x, z0, z1, first) => { for (let k = first ? 0 : 1; k <= 4; k++) pts.push(new THREE.Vector3(x, 0, z0 + (z1 - z0) * k / 4)); };
    const arc = (cx, cz, r, t0, t1) => { for (let k = 1; k < 14; k++) { const t = t0 + (t1 - t0) * k / 14; pts.push(new THREE.Vector3(cx + Math.cos(t) * r, 0, cz + Math.sin(t) * r)); } };
    const r1 = (b + c) / 2, x1 = (b - c) / 2, z1 = 0.5 - 0.16 - r1;   // inner loop, bottom
    const r2 = (a + b) / 2, x2 = (b - a) / 2, z2 = -0.5 + r2;         // top loop
    const z3 = 0.5 - a;                                               // outer loop, bottom
    line(-c, -0.22, z1, true); arc(x1, z1, r1, Math.PI, 0);
    line(b, z1, z2);           arc(x2, z2, r2, 0, -Math.PI);
    line(-a, z2, z3);          arc(0, z3, a, Math.PI, 0);
    line(a, z3, -0.12);
    clipGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.1), 300, 0.015, 8, false);
    return clipGeo;
  }
  const CLIP = THEME.clip;   // coated clips, a bit brighter than the paper
  const clipMats = {};
  function clipMat(c) {
    if (c === true || c === "silver") return metal;
    return clipMats[c] ??= c === "gold"
      ? new THREE.MeshStandardMaterial({ color: "#e6c47e", metalness: 1, roughness: 0.25, envMap, envMapIntensity: 1.2 })
      : new THREE.MeshPhysicalMaterial({ color: CLIP[c] || c, metalness: 0.15, roughness: 0.35, clearcoat: 1, envMap, envMapIntensity: 0.35 });
  }

  // a little wish tag tucked under the photo's bottom corner, held by a strip of tape
  function makeWishTag(p, cw, ch) {
    const tw = cw * 0.68, th = tw * 0.5;
    let tex = null;
    tex = cardTexture((x, W2, H2) => {
      const paint = () => {
        x.fillStyle = pastel(p.wishColor || "butter"); x.fillRect(0, 0, W2, H2);
        x.strokeStyle = "rgba(127,156,191,.28)"; x.lineWidth = 2;
        for (let y = H2 * 0.4; y < H2 - 10; y += H2 * 0.22) { x.beginPath(); x.moveTo(24, y); x.lineTo(W2 - 24, y); x.stroke(); }
        x.font = `500 ${Math.round(W2 * 0.042)}px ${SANS}`; x.fillStyle = "rgba(75,85,99,.55)";
        x.textAlign = "left"; x.textBaseline = "top";
        x.fillText("a wish for you ♡", 26, H2 * 0.09);
        let size = W2 * 0.12, lines;
        for (;;) { x.font = `500 ${size}px ${HAND}`; lines = wrap(x, fill(p.wish), W2 - 52); if (lines.length <= 3 || size < W2 * 0.07) break; size *= 0.9; }
        x.fillStyle = INK; x.textBaseline = "alphabetic";
        lines.forEach((l, i) => x.fillText(l, 26, H2 * 0.4 + (i + 0.82) * H2 * 0.22 - (lines.length === 3 ? H2 * 0.1 : 0)));
        if (tex) tex.needsUpdate = true;
      };
      paint();
      document.fonts.load(`500 40px ${HAND}`).then(paint, () => {});
    }, tw, th);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(tw, th).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    tag.castShadow = true;
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(tw * 0.34, tw * 0.11).rotateX(-Math.PI / 2), tapeMat);
    strip.position.set(0, 0.0008, -th / 2 + tw * 0.02);
    strip.rotation.y = 0.12;
    const g = new THREE.Group();
    g.add(tag, strip);
    const side = p.wishSide === "left" ? -1 : 1;
    g.position.set(side * (cw / 2 - tw * 0.3), PHOTO_T + 0.0018, ch / 2 + th * 0.36);
    g.rotation.y = -side * 0.07;
    return g;
  }

  function tapPhoto(o) {
    if (!o.liftTo) {                           // pick it up (and put any other photo down)
      for (const other of decos) if (other.kind === "photo" && other !== o) other.liftTo = 0;
      o.liftTo = 1; SOUND.pop();
    } else { o.liftTo = 0; SOUND.tick(); }     // put it back
  }

  function updatePhoto(o, t, dt, visible) {
    if (!visible) o.liftTo = o.flipTo = 0;
    const k1 = 1 - Math.exp(-dt * 5);
    o.lift += (o.liftTo - o.lift) * k1;
    o.flip += (o.flipTo - o.flip) * (1 - Math.exp(-dt * 6));
    const L = o.lift, l = o.leaf;
    // float towards the middle of the page, rise and turn to face the camera
    const fx = o.d.x / 100, fy = o.d.y / 100;
    const dx = (0.5 - fx) * l.w, dz = (0.48 - fy) * l.h;
    const ease = L * L * (3 - 2 * L);
    o.lifter.position.set(dx * ease, (0.2 + Math.sin(t * 1.6) * 0.008) * ease, dz * ease);
    o.lifter.rotation.x = (Math.PI / 2 - view.elev) * 0.85 * ease;
    o.lifter.scale.setScalar(1 + 0.45 * ease);
    o.tilt.rotation.y = -(o.d.r * Math.PI / 180) * (1 - ease) + Math.sin(t * 1.1 + o.phase) * 0.04 * ease;
    // resting on the page: the bottom edge curls up a little; while held it sways gently
    o.pivot.rotation.x = -o.rest * (1 - ease) + Math.sin(t * 1.3 + o.phase) * 0.03 * ease;
    o.body.rotation.z = Math.PI * o.flip;
    o.body.position.y = Math.sin(Math.PI * o.flip) * o.cw * 0.5;
  }

  function makeModel(d, leaf, page) {
    const m = MODELS[d.type]?.(d, kit);
    if (!m) return;
    m.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const tilt = new THREE.Group();
    tilt.rotation.y = -(d.r || 0) * Math.PI / 180;
    tilt.add(m.group);
    const holder = new THREE.Group();
    holder.add(tilt);
    leaf.group.add(holder);
    const deco = { kind: "model", d, leaf, page, holder, tilt, model: m, pop: 0, vel: 0, phase: Math.random() * 6 };
    if (m.tap) m.group.traverse(o => { if (o.isMesh) { o.userData.deco = deco; tapPicks.push(o); } });
    decos.push(deco);
  }

  PAGES.forEach((pg, page) => {
    const leaf = leaves[Math.floor(page / 2)];
    for (const n of pg.notes || []) makeNote(n, leaf, page);
    for (const s of pg.stickers || []) makeSticker(s, leaf, page);
    for (const m of pg.models || []) makeModel(m, leaf, page);
    for (const ph of pg.photos || []) makePhoto(ph, leaf, page);
  });
  tapPicks.push(...notePicks);

  // a point on a sheet (s = distance from its inner edge) in the sheet's own space
  function sheetFrame(l, s) {
    if (l.hard) return { x: s, y: 0, a: 0 };
    const k = clamp(s / (l.w / SEG), 0, SEG - 0.001), k0 = Math.floor(k), t = k - k0;
    return {
      x: l.xs[k0] + (l.xs[k0 + 1] - l.xs[k0]) * t,
      y: l.ys[k0] + (l.ys[k0 + 1] - l.ys[k0]) * t,
      a: l.as[k0] + (l.as[k0 + 1] - l.as[k0]) * t,
    };
  }

  // is this page lying face-up and fully landed? (only then do its 3D objects stand up –
  // nothing from the next page shows while a page is still turning)
  function pageExposed(page) {
    const i = Math.floor(page / 2);
    if (page % 2 === 0) return leaves[i].p < 0.02 && (i === 0 || leaves[i - 1].p > 0.98);
    return leaves[i].p > 0.98 && (i === N - 1 || leaves[i + 1].p < 0.02);
  }

  function updateDecos(now, dt) {
    const t = now / 1000;
    for (const o of decos) {
      const l = o.leaf, back = o.page % 2 === 1;
      // spring "pop" when the page is open
      const target = pageExposed(o.page) ? 1 : 0;
      if (o.kind === "photo") { o.pop = target; o.vel = 0; }       // photos are simply there
      else if (target === 0) { o.pop = 0; o.vel = 0; }   // gone the moment its page starts to turn
      else { o.vel += ((1 - o.pop) * 170 - o.vel * 14) * dt; o.pop += o.vel * dt; }
      if (target === 0 && o.pop < 0.02) { o.pop = 0; o.vel = 0; }
      o.holder.visible = o.pop > 0.01;
      if (!o.holder.visible) continue;
      o.holder.scale.setScalar(Math.max(0.001, o.pop));

      // follow the page, even while it bends
      const fx = o.d.x / 100;
      const s = (back ? 1 - fx : fx) * l.w;
      const f = sheetFrame(l, s);
      const side = back ? -1 : 1;
      const lift = o.kind === "note" ? 0.012 : o.kind === "photo" ? 0.0012 : o.kind === "sticker" ? 0.006 : 0.001;
      const bob = o.kind === "sticker" ? (Math.sin(t * 1.8 + o.phase) * 0.5 + 0.5) * 0.006 * o.pop : 0;
      const z = -l.h / 2 + (o.d.y / 100) * l.h;
      const nY = l.hard && back ? -COVER_T : 0;
      o.holder.position.set(f.x - Math.sin(f.a) * (lift + bob) * side, f.y + nY + Math.cos(f.a) * (lift + bob) * side, z);
      o.holder.rotation.set(0, 0, f.a + (back ? Math.PI : 0));

      if (o.kind === "photo") {
        updatePhoto(o, t, dt, target === 1);
      } else if (o.kind === "model") {
        o.model.update(t, dt, o);
      } else if (o.kind === "sticker") {
        o.tilt.rotation.y = -(o.d.r || 0) * Math.PI / 180 + Math.sin(t * 1.3 + o.phase) * 0.12;
      } else {
        // flip the note open / closed, and let its corner flutter
        // a tapped note hops up on its pin and settles again
        o.flip = Math.max(0, o.flip - dt * 1.6);
        o.hinge.rotation.x = -Math.sin(o.flip * Math.PI) * 0.55;
        const curl = 0.5 + Math.sin(t * 2.1 + o.phase) * 0.18 + o.flip * 0.3;
        const pos = o.geo.attributes.position.array, sz = o.size;
        for (let k = 0; k < pos.length; k += 3) {
          const xn = o.base[k] / sz + 0.5, zn = o.base[k + 2] / sz;
          pos[k + 1] = o.base[k + 1] + curl * Math.pow(Math.max(0, xn + zn - 1.15), 2) * sz;
        }
        o.geo.attributes.position.needsUpdate = true;
        o.geo.computeVertexNormals();
      }
    }
  }

  // the note or model under the pointer (if it isn't hidden behind a page)
  function pickNote(x, y) {
    ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(tapPicks.filter(m => m.userData.deco.holder.visible), false)[0];
    if (!hit) return null;
    const page = ray.intersectObjects(pickables, false)[0];
    if (page && page.distance < hit.distance - 0.002) return null;
    pickNote.mesh = hit.object;
    return hit.object.userData.deco;
  }

  /* ============ around the album: fireworks ============ */
  const FW_MAX = 900;
  const fwGeo = new THREE.BufferGeometry();
  const fwPos = new Float32Array(FW_MAX * 3), fwCol = new Float32Array(FW_MAX * 3);
  fwGeo.setAttribute("position", new THREE.BufferAttribute(fwPos, 3));
  fwGeo.setAttribute("color", new THREE.BufferAttribute(fwCol, 3));
  const fireworks = new THREE.Points(fwGeo, new THREE.PointsMaterial({
    size: 0.06, map: glowTexture("#ffffff"), vertexColors: true, transparent: true, depthWrite: false,
  }));
  fireworks.frustumCulled = false;
  scene.add(fireworks);
  const sparks = [];
  let nextBurst = 0;
  const FW_COLORS = THEME.fireworks.map(c => new THREE.Color(c));

  function updateScene(now, dt) {
    const t = now / 1000;
    // fireworks while the "happy birthday" page is open
    if (pageExposed(PAGES.length - 2) && t > nextBurst && sparks.length < FW_MAX - 80) {
      nextBurst = t + 0.75 + Math.random() * 0.5;
      const o = new THREE.Vector3(-0.9 + Math.random() * 1.8, 0.3 + Math.random() * 0.2, -0.45 + Math.random() * 0.4);
      const col = FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)];
      for (let i = 0; i < 80; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(0.38 + Math.random() * 0.12);
        sparks.push({ p: o.clone(), v, life: 1.2 + Math.random() * 0.4, col });
      }
      SOUND.pop();
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= dt;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      s.v.y -= 0.25 * dt; s.v.multiplyScalar(1 - dt * 1.2);
      s.p.addScaledVector(s.v, dt);
    }
    for (let i = 0; i < FW_MAX; i++) {
      const s = sparks[i];
      if (s) {
        fwPos.set([s.p.x, s.p.y, s.p.z], i * 3);
        // sparks twinkle as they fall
        const f = s.life < 0.4 ? (Math.random() < 0.5 ? 1 : 0.4) : 1;
        fwCol.set([s.col.r * f, s.col.g * f, s.col.b * f], i * 3);
      } else fwCol.set([0, 0, 0], i * 3);
    }
    fwGeo.setDrawRange(0, Math.max(1, sparks.length));
    fwGeo.attributes.position.needsUpdate = fwGeo.attributes.color.needsUpdate = true;
  }

  /* ============ camera: frames the book on any screen, can be rotated and zoomed ============ */
  const view = { x: 0.5, d: 6, yaw: 0, elev: 50 * Math.PI / 180, zoom: 1 };
  const DEFAULT_ELEV = 50 * Math.PI / 180;
  const user = { yaw: 0, elev: DEFAULT_ELEV, zoom: 1, idle: 0 };
  const tmpCam = new THREE.PerspectiveCamera();
  const corner = new THREE.Vector3();

  function region() {
    const closedStart = leaves.every(l => l.to === 0);
    const closedEnd = leaves.every(l => l.to === 1);
    let tall = 0;
    for (const o of decos) {
      if (o.kind === "model" && o.holder.visible) tall = Math.max(tall, o.model.height * o.pop);
      if (o.kind === "photo" && o.lift > 0.01) tall = Math.max(tall, 0.45 * o.lift);
    }
    const top = TOTAL_T + 0.05 + tall, hz = H * COVER_GROW / 2 + 0.02;
    if (isPortrait() && !closedStart && !closedEnd) {
      return state.side === "right" ? { x0: 0.02, x1: W + 0.14, top, hz } : { x0: -(W + 0.14), x1: -0.02, top, hz };
    }
    if (closedStart) return { x0: -RING_R - 0.02, x1: W + 0.14, top, hz };
    if (closedEnd) return { x0: -(W + 0.14), x1: RING_R + 0.02, top, hz };
    return { x0: -(W + 0.14), x1: W + 0.14, top, hz };
  }

  function placeCamera(cam, cx, d, yaw, elev) {
    cam.position.set(cx + Math.sin(yaw) * Math.cos(elev) * d, Math.sin(elev) * d, Math.cos(yaw) * Math.cos(elev) * d);
    cam.lookAt(cx, 0, 0);
  }

  // smallest distance at which the whole region fits on screen (leaving room for the buttons)
  function fitDistance(r, cx, yaw, elev) {
    tmpCam.fov = camera.fov; tmpCam.aspect = camera.aspect; tmpCam.near = 0.05; tmpCam.far = 60;
    tmpCam.updateProjectionMatrix();
    const fits = d => {
      placeCamera(tmpCam, cx, d, yaw, elev);
      tmpCam.updateMatrixWorld();
      for (const x of [r.x0, r.x1]) for (const y of [0, r.top]) for (const z of [-r.hz, r.hz]) {
        corner.set(x, y, z).project(tmpCam);
        if (corner.x < -0.92 || corner.x > 0.92 || corner.y < -0.74 || corner.y > 0.86 || corner.z > 1) return false;
      }
      return true;
    };
    let lo = 0.5, hi = 40;
    for (let k = 0; k < 22; k++) { const mid = (lo + hi) / 2; fits(mid) ? hi = mid : lo = mid; }
    return hi;
  }

  function updateCamera(dt, now) {
    const r = region();
    const cx = (r.x0 + r.x1) / 2;
    // drift back to the default angle a few seconds after the user lets go
    if (!orbiting && now - user.idle > 4000) {
      const k = 1 - Math.exp(-dt * 0.8);
      user.yaw += (0 - user.yaw) * k;
      user.elev += (DEFAULT_ELEV - user.elev) * k;
    }
    const sway = Math.sin(now / 2600) * 0.035;
    const k = 1 - Math.exp(-dt * 3.4);
    view.x += (cx - view.x) * k;
    view.yaw += (user.yaw + sway - view.yaw) * k;
    view.elev += (user.elev - view.elev) * k;
    const d = fitDistance(r, cx, view.yaw, view.elev) * user.zoom;
    view.d += (d - view.d) * k;
    placeCamera(camera, view.x, view.d, view.yaw, view.elev);
  }

  /* ============ turning pages ============ */
  function setTarget(l, to, delay = 0) {
    l.from = l.p; l.to = to;
    l.t0 = performance.now() + delay;
    l.dur = Math.max(250, FLIP_MS * Math.abs(to - l.p));
  }

  function next() {
    if (isPortrait() && state.side === "left" && state.current > 0 && state.current < N) state.side = "right";
    else if (state.current < N) { setTarget(leaves[state.current], 1); state.current++; state.side = "left"; SOUND.flip(); }
    afterTurn();
  }

  function prev() {
    if (isPortrait() && state.side === "right" && state.current > 0 && state.current < N) state.side = "left";
    else if (state.current > 0) { state.current--; setTarget(leaves[state.current], 0); state.side = "right"; SOUND.flip(); }
    afterTurn();
  }

  function restart() {
    leaves.slice().reverse().forEach((l, k) => { if (l.to !== 0) setTarget(l, 0, k * 140); });
    state.current = 0; state.side = "right";
    afterTurn();
  }

  function afterTurn() {
    const c = state.current, portrait = isPortrait();
    $("prev").disabled = c === 0 && (!portrait || state.side === "right");
    $("next").disabled = c === N;
    let label;
    if (c === 0) label = "cover";
    else if (c === N) label = "the end";
    else if (portrait) label = `page ${state.side === "left" ? 2 * c - 1 : 2 * c}`;
    else label = `pages ${2 * c - 1}–${2 * c}`;
    $("counter").textContent = label;
    if (c === N - 1 && !state.celebrated) {
      state.celebrated = true;
      setTimeout(() => { burst(innerWidth / 2, innerHeight / 3); SOUND.chime(); }, 700);
    }
  }

  /* ============ pointer: tap or drag a page to turn it, drag around the book to rotate the view ============ */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(x, y) {
    ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    if (!hit) return null;
    const { page } = hit.object.userData;
    const u = page % 2 === 1 ? 1 - hit.uv.x : hit.uv.x;
    return { page, u, v: 1 - hit.uv.y, point: hit.point };
  }
  const regionAt = h => h && regions[h.page].find(r => h.u >= r.x0 && h.u <= r.x1 && h.v >= r.y0 && h.v <= r.y1);

  let down = null, orbiting = false;
  const pointers = new Map();
  let pinch = null;

  canvas.addEventListener("pointerdown", e => {
    SOUND.unlock();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not a real pointer */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {               // two fingers: zoom
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: user.zoom };
      if (down?.leaf) { down.leaf.l.dragging = false; setTarget(down.leaf.l, down.leaf.l.p > 0.5 ? 1 : 0); }
      down = null;
      return;
    }
    const onBook = !!pick(e.clientX, e.clientY) || !!pickNote(e.clientX, e.clientY);
    down = { x: e.clientX, y: e.clientY, onBook, leaf: null, yaw: user.yaw, elev: user.elev };
    orbiting = !onBook;
  });

  canvas.addEventListener("pointermove", e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      user.zoom = clamp(pinch.zoom * pinch.dist / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 0.55, 1.6);
      user.idle = performance.now();
      return;
    }
    if (!down) { canvas.style.cursor = pick(e.clientX, e.clientY) || pickNote(e.clientX, e.clientY) ? "pointer" : "grab"; return; }
    const dx = e.clientX - down.x, dy = e.clientY - down.y;

    if (orbiting) {
      canvas.style.cursor = "grabbing";
      user.yaw = clamp(down.yaw - dx * 0.006, -1.1, 1.1);
      user.elev = clamp(down.elev + dy * 0.005, 0.35, 1.35);
      user.idle = performance.now();
      return;
    }

    const span = Math.min(innerWidth * 0.5, 520);
    if (!down.leaf && Math.abs(dx) > 10) {
      if (dx < 0 && state.current < N) down.leaf = { l: leaves[state.current], dir: 1 };
      else if (dx > 0 && state.current > 0) down.leaf = { l: leaves[state.current - 1], dir: -1 };
      if (down.leaf) down.leaf.l.dragging = true;
    }
    if (down.leaf) {
      const { l, dir } = down.leaf;
      l.p = dir === 1 ? clamp(-dx / span, 0, 1) : clamp(1 - dx / span, 0, 1);
      l.from = l.to = l.p;
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!down) return;
    const d = down; down = null;
    if (orbiting) { orbiting = false; canvas.style.cursor = "grab"; user.idle = performance.now(); return; }
    if (d.leaf) {
      const { l, dir } = d.leaf;
      l.dragging = false;
      if (dir === 1) {
        if (l.p > 0.35) { setTarget(l, 1); state.current++; state.side = "left"; SOUND.flip(); } else setTarget(l, 0);
      } else {
        if (l.p < 0.65) { setTarget(l, 0); state.current--; state.side = "right"; SOUND.flip(); } else setTarget(l, 1);
      }
      afterTurn();
      return;
    }
    if (e.type === "pointercancel") return;
    const deco = pickNote(e.clientX, e.clientY);
    if (deco?.kind === "note") {               // tap a note: it hops on its pin
      deco.flip = 1;
      SOUND.tick();
      burst(e.clientX, e.clientY, 24);
      return;
    }
    if (deco?.kind === "model") { deco.model.tap(e.clientX, e.clientY, pickNote.mesh); return; }
    if (deco?.kind === "photo") { tapPhoto(deco); return; }
    const h = pick(e.clientX, e.clientY), r = regionAt(h);
    if (r && r.action === "wish") {
      state.wished = !state.wished;
      drawPage(h.page);
      if (state.wished) burst(e.clientX, e.clientY);
      return;
    }
    if (r && r.action === "again") { restart(); return; }
    const portrait = isPortrait();
    if (state.current === 0 && !portrait) return next();
    if (state.current === N && !portrait) return prev();
    const forward = portrait || !h ? e.clientX > innerWidth / 2 : h.point.x > 0;
    forward ? next() : prev();
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    user.zoom = clamp(user.zoom * Math.exp(e.deltaY * 0.0012), 0.55, 1.6);
    user.idle = performance.now();
  }, { passive: false });

  $("next").addEventListener("click", next);
  $("prev").addEventListener("click", prev);

  $("music").addEventListener("click", () => {
    SOUND.toggleMusic();
    $("music").classList.toggle("on", SOUND.musicOn);
    $("music").setAttribute("aria-pressed", SOUND.musicOn);
  });

  function toast(text) {
    const el = $("toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
  }
  $("share").addEventListener("click", async () => {
    const url = location.href.split("#")[0];
    const title = NAME ? `Happy Birthday, ${NAME} ${THEME.emoji}` : `Happy Birthday ${THEME.emoji}`;
    try {
      if (navigator.share) { await navigator.share({ title, text: "I made you a little birthday book ♡", url }); return; }
      await navigator.clipboard.writeText(url);
      toast("link copied ♡ send it to them!");
    } catch (e) {
      if (e.name !== "AbortError") toast("copy the link from the address bar ♡");
    }
  });
  addEventListener("keydown", e => {
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });

  /* ============ confetti ============ */
  const conf = $("confetti"), cctx = conf.getContext("2d");
  const COLORS = THEME.confetti;
  let bits = [];
  function burst(x, y, count = 120) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 8;
      bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 5, w: 6 + Math.random() * 6, h: 4 + Math.random() * 5,
        r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: COLORS[i % COLORS.length], life: 120 + Math.random() * 60 });
    }
  }
  function drawConfetti() {
    if (!bits.length) return;
    conf.width = innerWidth; conf.height = innerHeight;
    bits = bits.filter(b => b.life-- > 0 && b.y < innerHeight + 20);
    for (const b of bits) {
      b.vy += .25; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      cctx.save(); cctx.translate(b.x, b.y); cctx.rotate(b.r);
      cctx.globalAlpha = Math.min(1, b.life / 40);
      cctx.fillStyle = b.c; cctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      cctx.restore();
    }
    if (!bits.length) cctx.clearRect(0, 0, conf.width, conf.height);
  }

  /* ============ start ============ */
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    afterTurn();
  }
  addEventListener("resize", resize);
  resize();

  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    updateLeaves(now);
    updateDecos(now, dt);
    updateScene(now, dt);
    updateCamera(dt, now);
    if (!REDUCED) { scene.rotation.y = Math.sin(now / 4300) * 0.012; scene.position.y = Math.sin(now / 2700) * 0.006; }   // the book breathes
    renderer.render(scene, camera);
    drawConfetti();
    requestAnimationFrame(loop);
  }

  async function start() {
    if (BOOK.backdrop) document.body.style.setProperty("--backdrop", `url("${imageUrl(BOOK.backdrop)}")`);
    const all = new Set(PAGES.flatMap(p => [p.bg, p.cover && p.cover.paper, p.cover && p.cover.photo, ...(p.photos || []).map(x => x.img)]).filter(Boolean));
    toLoad = all.size;
    await Promise.all([
      document.fonts.load(`500 40px ${SERIF}`), document.fonts.load(`italic 500 40px ${SERIF}`),
      document.fonts.load(`500 40px ${HAND}`), document.fonts.load(`400 40px ${SANS}`),
    ]).catch(() => {});
    await Promise.all(PAGES.map((_, i) => drawPage(i)));
    updateLeaves(performance.now());
    const r = region();
    view.x = (r.x0 + r.x1) / 2;
    view.d = fitDistance(r, view.x, view.yaw, view.elev) * 1.6;   // start further away and glide in
    // the gift splash (polish.js) holds the book until it is tapped, then the book glides in
    dispatchEvent(new Event("book-ready"));
    if (window.BOOK_GATE) await window.BOOK_GATE;
    $("loader").classList.add("done");
    requestAnimationFrame(loop);
  }
  start();
})();
