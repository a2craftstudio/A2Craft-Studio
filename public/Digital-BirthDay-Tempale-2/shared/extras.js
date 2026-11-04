/* ============================================================
   Extra pop-up: balloons (tap one to pop it; they float back up
   once all are popped). Same format as models.js.
   ============================================================ */
Object.assign(window.MODELS, {

  /* ---------- balloons: tap to pop one; when all are popped they float back up ---------- */
  balloons(d, k) {
    const g = new THREE.Group(), s = d.scale || 1;
    const colors = d.colors || ["blue", "butter", "pink", "mint", "lilac"];
    const n = d.count || 5;
    const weight = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.035), k.gloss(k.pastel("peach")));
    weight.position.y = 0.015; g.add(weight);
    const anchor = new THREE.Vector3(0, 0.03, 0), list = [];
    for (let i = 0; i < n; i++) {
      const color = k.pastel(colors[i % colors.length]);
      const b = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 32, 24), k.gloss(color, { clearcoat: 1, roughness: 0.18 }));
      ball.scale.set(1, 1.18, 1); ball.castShadow = true;
      const knot = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.016, 10), k.gloss(color));
      knot.position.y = -0.088; knot.rotation.x = Math.PI;
      const shine = k.glow("#ffffff", 0.035); shine.position.set(-0.025, 0.035, 0.05);
      b.add(ball, knot, shine);
      const str = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 14 }, () => new THREE.Vector3())),
        new THREE.LineBasicMaterial({ color: "#9aa3b2", transparent: true, opacity: 0.8 }));
      g.add(b, str);
      list.push({ b, str, ball, len: 0.36 + (i % 2) * 0.08, dx: (i - (n - 1) / 2) * 0.07, dz: i % 2 ? -0.03 : 0.03, ph: i * 1.3, popped: false, rise: 1 });
    }
    const label = d.label === false ? null : k.label(0.4, 0.07);
    if (label) { label.position.set(0, 0.003, 0.09); g.add(label); }
    g.scale.setScalar(s);
    let resetAt = 0, popCount = 0;
    const tmp = new THREE.Vector3();
    return {
      group: g, height: 0.55 * s,
      update(t, dt) {
        if (label) label.set(popCount >= n ? "all popped! up they go again" : `balloons · popped ${popCount} / ${n}`);
        if (resetAt > 0 && (resetAt -= dt) <= 0) { resetAt = 0; popCount = 0; list.forEach(o => { o.popped = false; o.rise = 0; o.b.visible = o.str.visible = true; }); }
        for (const o of list) {
          if (o.popped) continue;
          o.rise = Math.min(1, o.rise + dt * 0.8);
          const sway = Math.sin(t * 1.1 + o.ph) * 0.1, sway2 = Math.cos(t * 0.8 + o.ph) * 0.06;
          const L = o.len * (0.35 + 0.65 * o.rise);
          const top = tmp.set(o.dx + Math.sin(sway) * L * 0.5, 0.03 + Math.cos(sway) * L, o.dz + Math.sin(sway2) * L * 0.3);
          o.b.position.set(top.x, top.y + 0.088, top.z); o.b.rotation.z = -sway * 0.6;
          const pos = o.str.geometry.attributes.position;
          for (let i = 0; i < 14; i++) {
            const u = i / 13;
            pos.setXYZ(i, anchor.x + (top.x - anchor.x) * u + Math.sin(u * Math.PI) * 0.02, anchor.y + (top.y - anchor.y) * u, anchor.z + (top.z - anchor.z) * u);
          }
          pos.needsUpdate = true;
        }
      },
      tap(x, y, mesh) {
        const o = list.find(q => !q.popped && q.b.children.includes(mesh)) || list.find(q => !q.popped);
        if (!o) return;
        o.popped = true; o.b.visible = o.str.visible = false; popCount++;
        k.sound.popBig(); k.burst(x, y - 40, 36);
        if (popCount >= n) { k.sound.chime(); k.burst(x, y - 40, 110); resetAt = 1.8; }
      },
    };
  },
});
