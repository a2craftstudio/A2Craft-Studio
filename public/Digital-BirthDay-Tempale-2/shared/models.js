/* ============================================================
   Animated 3D pop-up models that live on the album's pages.
   Each model is built from simple shapes (no downloads) and is
   placed from pages.js with   models: [{ type: "cake", x, y, ... }]
   (the cake's colours and decorations are part of each theme: THEME.cake in theme.js)
   Sizes are in page widths (the page is 1 unit wide).
   ============================================================ */
window.MODELS = {

  /* ---------- birthday cake: tap to blow out the candles ---------- */
  cake(d, k) {
    const g = new THREE.Group();
    const s = d.scale || 1;
    // the shapes of the cake (colours, tiers, decorations) come from the theme
    const cyl = (r, h, y, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 56), mat); m.position.y = y; g.add(m); return m; };
    const rim = (r, y, mat) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.01, 10, 56), mat); m.rotation.x = Math.PI / 2; m.position.y = y; g.add(m); };
    const TOP = THEME.cake.body(g, k, { cyl, rim });
    // candles + flames
    const flames = [];
    const stripes = k.stripeTexture(...THEME.cake.candle);
    const n = d.candles || 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4, x = Math.cos(a) * 0.03, z = Math.sin(a) * 0.03;
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 14), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.6 }));
      candle.position.set(x, TOP + 0.035, z);
      const flame = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.011, 14, 10), new THREE.MeshBasicMaterial({ color: "#ffd98a" }));
      core.scale.set(1, 1.9, 1);
      const glow = k.glow("#ffcf70", 0.07);
      flame.add(core, glow);
      flame.position.set(x, TOP + 0.07 + 0.016, z);
      g.add(candle, flame);
      flames.push(flame);
    }
    g.scale.setScalar(s);

    let lit = true, fade = 1;
    const smoke = [];
    return {
      group: g, height: 0.3 * s,
      update(t, dt) {
        fade += ((lit ? 1 : 0) - fade) * Math.min(1, dt * 6);
        flames.forEach((f, i) => {
          const fl = 1 + Math.sin(t * 17 + i * 2) * 0.08 + Math.sin(t * 29 + i) * 0.05;
          f.scale.set(fade, fade * fl, fade);
          f.rotation.z = Math.sin(t * 9 + i) * 0.08;
          f.visible = fade > 0.02;
        });
        for (let i = smoke.length - 1; i >= 0; i--) {
          const p = smoke[i];
          p.life -= dt;
          p.sprite.position.y += dt * 0.06;
          p.sprite.position.x += Math.sin(t * 3 + i) * dt * 0.01;
          p.sprite.material.opacity = Math.max(0, p.life / 1.6) * 0.5;
          p.sprite.scale.setScalar(0.03 + (1.6 - p.life) * 0.03);
          if (p.life <= 0) { g.remove(p.sprite); smoke.splice(i, 1); }
        }
      },
      tap(x, y) {
        lit = !lit;
        if (!lit) {
          k.sound.blow();
          flames.forEach(f => {
            const sp = k.glow("#d9dde6", 0.03, true);
            sp.position.copy(f.position);
            g.add(sp); smoke.push({ sprite: sp, life: 1.6 });
          });
          setTimeout(() => { k.sound.chime(); k.burst(x, y, 110); }, 350);
        } else k.sound.pop();
        k.wish(!lit);
      },
    };
  },

  /* ---------- balloons on strings: tap one to pop it ---------- */
  balloons(d, k) {
    const g = new THREE.Group();
    const s = d.scale || 1;
    const colors = d.colors || ["blue", "butter", "pink", "mint", "lilac"];
    const n = d.count || 4;
    const weight = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.035), k.gloss(k.pastel("peach")));
    weight.position.y = 0.015;
    const bowA = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.004, 8, 16), k.gloss(k.pastel("pink")));
    bowA.position.set(0, 0.034, 0);
    g.add(weight, bowA);
    const anchor = new THREE.Vector3(0, 0.03, 0);
    const list = [];
    for (let i = 0; i < n; i++) {
      const color = k.pastel(colors[i % colors.length]);
      const b = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 32, 24), k.gloss(color, { transmission: 0, clearcoat: 1, roughness: 0.18 }));
      ball.scale.set(1, 1.18, 1);
      ball.castShadow = true;
      const knot = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.016, 10), k.gloss(color));
      knot.position.y = -0.088;
      knot.rotation.x = Math.PI;
      const shine = k.glow("#ffffff", 0.035);
      shine.position.set(-0.025, 0.035, 0.05);
      b.add(ball, knot, shine);
      const str = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 14 }, () => new THREE.Vector3())),
        new THREE.LineBasicMaterial({ color: "#9aa3b2", transparent: true, opacity: 0.8 }));
      g.add(b, str);
      const spread = (i - (n - 1) / 2);
      list.push({ b, str, len: 0.36 + (i % 2) * 0.08 + Math.random() * 0.04, dx: spread * 0.07, dz: (i % 2 ? -0.03 : 0.03),
        ph: Math.random() * 6, popped: 0, respawn: 0 });
    }
    g.scale.setScalar(s);
    const tmp = new THREE.Vector3();
    return {
      group: g, height: 0.55 * s,
      update(t, dt) {
        for (const o of list) {
          if (o.popped) {
            o.respawn -= dt;
            if (o.respawn <= 0) { o.popped = 0; o.b.visible = o.str.visible = true; o.rise = 0; }
            continue;
          }
          o.rise = Math.min(1, (o.rise ?? 1) + dt * 0.8);
          const sway = Math.sin(t * 1.1 + o.ph) * 0.1, sway2 = Math.cos(t * 0.8 + o.ph) * 0.06;
          const L = o.len * (0.35 + 0.65 * o.rise);
          const top = tmp.set(o.dx + Math.sin(sway) * L * 0.5, 0.03 + Math.cos(sway) * L, o.dz + Math.sin(sway2) * L * 0.3);
          o.b.position.set(top.x, top.y + 0.088, top.z);
          o.b.rotation.z = -sway * 0.6;
          const pos = o.str.geometry.attributes.position;
          for (let i = 0; i < 14; i++) {
            const u = i / 13, sag = Math.sin(u * Math.PI) * 0.02;
            pos.setXYZ(i, anchor.x + (top.x - anchor.x) * u + sag, anchor.y + (top.y - anchor.y) * u, anchor.z + (top.z - anchor.z) * u);
          }
          pos.needsUpdate = true;
        }
      },
      tap(x, y) {
        const alive = list.filter(o => !o.popped);
        if (!alive.length) return;
        const o = alive[Math.floor(Math.random() * alive.length)];
        o.popped = 1; o.respawn = 2.2; o.b.visible = o.str.visible = false;
        k.sound.popBig();
        k.burst(x, y - 40, 40);
      },
    };
  },

  /* ---------- gift box: tap to open, a heart pops out ---------- */
  gift(d, k) {
    const g = new THREE.Group();
    const s = d.scale || 1;
    const boxMat = k.gloss(k.pastel(d.color || "blue"), { roughness: 0.5, clearcoat: 0.4 });
    const ribbonMat = k.gloss(k.pastel(d.ribbon || "pink"), { roughness: 0.3, clearcoat: 1 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), boxMat);
    box.position.y = 0.06; box.castShadow = true;
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.162, 0.121, 0.03), ribbonMat); r1.position.y = 0.06;
    const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.121, 0.162), ribbonMat); r2.position.y = 0.06;
    const body = new THREE.Group(); body.add(box, r1, r2);

    const lid = new THREE.Group();
    const lidBox = new THREE.Mesh(new THREE.BoxGeometry(0.176, 0.035, 0.176), boxMat); lidBox.castShadow = true;
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.178, 0.036, 0.03), ribbonMat);
    const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.036, 0.178), ribbonMat);
    lid.add(lidBox, l1, l2);
    for (const sx of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 10, 24), ribbonMat);
      loop.scale.set(1, 0.7, 1);
      loop.position.set(sx * 0.03, 0.035, 0);
      loop.rotation.set(0, 0, sx * 0.5);
      lid.add(loop);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), ribbonMat);
    knot.position.y = 0.03;
    lid.add(knot);
    lid.position.y = 0.12 + 0.0175;

    const heart = new THREE.Mesh(k.sticker("heart"), k.gloss(k.pastel("pink")));
    heart.rotation.x = Math.PI / 2;            // stand up, facing the viewer
    heart.scale.setScalar(0.001);
    const surprise = new THREE.Group();
    surprise.add(heart);
    surprise.position.y = 0.06;
    g.add(body, lid, surprise);
    g.scale.setScalar(s);

    let open = 0, openTo = 0, wiggle = 0;
    return {
      group: g, height: 0.42 * s,
      update(t, dt) {
        open += (openTo - open) * Math.min(1, dt * 4);
        lid.position.set(open * 0.11, 0.1375 + Math.sin(open * Math.PI * 0.9) * 0.16 + open * 0.02, 0);
        lid.rotation.z = -open * 1.9;
        const hs = Math.max(0.001, open) * 0.13;
        heart.scale.setScalar(hs);
        surprise.position.y = 0.06 + open * (0.17 + Math.sin(t * 2.4) * 0.012);
        surprise.rotation.y = Math.sin(t * 1.5) * 0.35 * open;
        // a little shake now and then, inviting a tap
        if (openTo === 0) {
          wiggle = (t % 3.2) < 0.45 ? Math.sin(t * 40) * 0.05 * Math.sin(((t % 3.2) / 0.45) * Math.PI) : 0;
          body.rotation.z = lid.rotation.z = wiggle;
        } else body.rotation.z = 0;
      },
      tap(x, y) {
        openTo = openTo ? 0 : 1;
        if (openTo) { k.sound.chime(); k.burst(x, y - 30, 90); } else k.sound.pop();
      },
    };
  },

  /* ---------- football: bounces, tap to kick it higher ---------- */
  ball(d, k) {
    const g = new THREE.Group();
    const s = d.scale || 1;
    const r = 0.055;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 30), new THREE.MeshPhysicalMaterial({ map: k.footballTexture(), roughness: 0.45, clearcoat: 0.6 }));
    ball.castShadow = true;
    g.add(ball);
    g.scale.setScalar(s);
    let kick = 0, spin = 0;
    return {
      group: g, height: 0.3 * s,
      update(t, dt) {
        kick = Math.max(0, kick - dt * 0.9);
        const speed = 2.6 + kick * 2;
        const h = Math.abs(Math.sin(t * speed)) * (0.1 + kick * 0.25);
        const squash = 1 - 0.18 * Math.max(0, 1 - h / 0.015);
        ball.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
        ball.position.y = r * squash + h;
        spin += dt * (2 + kick * 10);
        ball.rotation.set(spin, spin * 0.3, 0);
      },
      tap() { kick = 1; k.sound.boing(); },
    };
  },

  /* ---------- teddy bear hugging a heart: tap for a hug ---------- */
  teddy(d, k) {
    const g = new THREE.Group();
    const s = d.scale || 1;
    const fur = new THREE.MeshPhysicalMaterial({ color: d.color || "#e9cfb3", roughness: 0.95, sheen: 1, sheenColor: new THREE.Color("#fff3e6"), sheenRoughness: 0.6 });
    const light = new THREE.MeshPhysicalMaterial({ color: "#f8e9d8", roughness: 0.9, sheen: 1, sheenColor: new THREE.Color("#ffffff") });
    const dark = new THREE.MeshStandardMaterial({ color: "#3d3a40", roughness: 0.35 });
    const ball = (r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), mat);
      m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true;
      return m;
    };
    const body = new THREE.Group();
    body.add(ball(0.075, fur, 0, 0.075, 0, 1, 1.05, 0.9));
    body.add(ball(0.045, light, 0, 0.07, 0.045, 1, 1.1, 0.6));                 // tummy
    body.add(ball(0.03, fur, -0.05, 0.025, 0.05, 1, 0.8, 1.3));                 // feet
    body.add(ball(0.03, fur, 0.05, 0.025, 0.05, 1, 0.8, 1.3));
    body.add(ball(0.014, light, -0.05, 0.025, 0.088, 1, 1, 0.4));
    body.add(ball(0.014, light, 0.05, 0.025, 0.088, 1, 1, 0.4));

    const head = new THREE.Group();
    head.position.y = 0.175;
    head.add(ball(0.062, fur, 0, 0, 0));
    for (const sx of [-1, 1]) {
      head.add(ball(0.024, fur, sx * 0.045, 0.048, -0.005));
      head.add(ball(0.013, light, sx * 0.045, 0.048, 0.008, 1, 1, 0.5));
      head.add(ball(0.0085, dark, sx * 0.022, 0.012, 0.055));
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.011, 18), new THREE.MeshBasicMaterial({ color: "#f6a9b9", transparent: true, opacity: 0.75 }));
      blush.position.set(sx * 0.037, -0.006, 0.054);
      blush.rotation.y = sx * 0.55;
      head.add(blush);
    }
    head.add(ball(0.026, light, 0, -0.014, 0.05, 1, 0.8, 0.8));                 // snout
    head.add(ball(0.009, dark, 0, -0.006, 0.072, 1.3, 0.9, 1));                 // nose

    // arms hugging a heart
    const heart = new THREE.Mesh(k.sticker("heart"), k.gloss(k.pastel(d.heart || "pink")));
    heart.rotation.x = Math.PI / 2;
    heart.scale.setScalar(0.075);
    const heartHolder = new THREE.Group();
    heartHolder.add(heart);
    heartHolder.position.set(0, 0.09, 0.085);
    const arms = [];
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(sx * 0.06, 0.115, 0.01);
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.019, 0.05, 6, 14), fur);
      a.position.set(0, -0.03, 0.025);
      a.rotation.set(1.1, 0, sx * 0.5);
      a.castShadow = true;
      arm.add(a);
      body.add(arm);
      arms.push(arm);
    }
    g.add(body, head, heartHolder);
    g.scale.setScalar(s);

    let hug = 0;
    const floaters = [];
    return {
      group: g, height: 0.3 * s,
      update(t, dt) {
        hug = Math.max(0, hug - dt * 1.4);
        const squish = 1 + Math.sin(hug * Math.PI) * 0.12;
        g.scale.set(s * squish, s / squish, s * squish);
        head.rotation.z = Math.sin(t * 1.4) * 0.12;
        head.rotation.x = Math.sin(t * 0.9) * 0.05;
        arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * (0.1 + Math.sin(hug * Math.PI) * 0.35); });
        heartHolder.scale.setScalar(1 + Math.sin(t * 3.2) * 0.06 + Math.sin(hug * Math.PI) * 0.25);
        for (let i = floaters.length - 1; i >= 0; i--) {
          const f = floaters[i];
          f.life -= dt;
          f.m.position.y += dt * 0.12;
          f.m.position.x += Math.sin(t * 3 + f.ph) * dt * 0.03;
          f.m.scale.setScalar(Math.min(1, f.life) * 0.035);
          if (f.life <= 0) { g.remove(f.m); floaters.splice(i, 1); }
        }
      },
      tap(x, y) {
        hug = 1;
        k.sound.chime();
        for (let i = 0; i < 4; i++) {
          const m = new THREE.Mesh(k.sticker("heart"), k.gloss(k.pastel(["pink", "blue", "lilac", "peach"][i])));
          m.rotation.x = Math.PI / 2;
          m.position.set((i - 1.5) * 0.04, 0.24, 0.02);
          g.add(m);
          floaters.push({ m, life: 1.6 + i * 0.15, ph: i * 1.7 });
        }
      },
    };
  },
};
