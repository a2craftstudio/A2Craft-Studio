const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const photo = (id, w) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover)').matches;

/* photos */
$$('[data-img]').forEach(el => {
  const url = photo(el.dataset.img, el.dataset.w || 800);
  if (el.tagName === 'IMG') { el.src = url; el.loading = 'lazy'; } else el.style.backgroundImage = `url(${url})`;
});

/* loader */
document.body.classList.add('loading');
(function () {
  let p = 0;
  const start = performance.now();
  const t = setInterval(() => {
    p = performance.now() - start > 2500 ? 100 : Math.min(100, p + 3 + Math.random() * 6);
    $('#pct').textContent = Math.floor(p);
    $('#fill').style.height = p + '%';
    if (p >= 100) {
      clearInterval(t);
      setTimeout(() => {
        $('#loader').classList.add('done');
        document.body.classList.remove('loading');
        document.body.classList.add('ready');
        setTimeout(() => $('#loader').remove(), 1100);
      }, 250);
    }
  }, 45);
})();

/* nav + progress + parallax */
const nav = $('#nav'), links = $('nav', nav), burger = $('.burger');
burger.onclick = () => burger.setAttribute('aria-expanded', links.classList.toggle('open'));
links.onclick = e => e.target.tagName === 'A' && links.classList.remove('open');
$('#year').textContent = new Date().getFullYear();

const hs = $('#signature'), track = $('#hsTrack'), heroBg = $('.hero-bg'), minis = $$('.ha'), reviews = $('.reviews');
function onScroll() {
  const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
  nav.classList.toggle('solid', y > 60);
  $('#progress').style.width = (y / max * 100) + '%';
  if (!reduce) {
    if (y < innerHeight * 1.2) {
      heroBg.style.transform = `translateY(${y * .25}px) scale(1.05)`;
      minis.forEach((m, i) => m.style.transform = `translateY(${-y * (.12 + i * .08)}px)`);
    }
    // horizontal scroll section
    const r = hs.getBoundingClientRect();
    const total = hs.offsetHeight - innerHeight;
    const prog = Math.min(1, Math.max(0, -r.top / total));
    const dist = track.scrollWidth - innerWidth + 40;
    track.style.transform = `translateX(${-prog * Math.max(0, dist)}px)`;
  }
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
onScroll();

/* reveal on scroll */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in'); io.unobserve(e.target);
  if (e.target.matches('.stats div')) count($('b', e.target));
}), { threshold: .12 });
$$('.section .wrap > *, .stats div').forEach(el => { el.classList.add('reveal'); io.observe(el); });
function count(el) {
  const n = +el.dataset.n, s = el.dataset.s, t0 = performance.now();
  (function step(t) {
    const k = Math.min(1, (t - t0) / 1600), v = Math.round(n * (1 - Math.pow(1 - k, 3)));
    el.textContent = v + s;
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}

/* cursor + magnetic buttons */
if (fine && !reduce) {
  const c = $('#cursor'); let x = 0, y = 0, cx = 0, cy = 0;
  addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; c.classList.add('on'); });
  (function loop() { cx += (x - cx) * .18; cy += (y - cy) * .18; c.style.transform = `translate(${cx}px,${cy}px)`; requestAnimationFrame(loop); })();
  document.addEventListener('mouseover', e => c.classList.toggle('big', !!e.target.closest('a,button,.masonry img,.sig')));
  $$('.magnet').forEach(b => {
    b.addEventListener('mousemove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px,${(e.clientY - r.top - r.height / 2) * .35}px)`; });
    b.addEventListener('mouseleave', () => b.style.transform = '');
  });
  // hero mini parallax by mouse is handled by scroll; tilt on signature cards
  document.addEventListener('mousemove', e => {
    const card = e.target.closest?.('.sig'); if (!card) return;
    const r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
    card.style.transform = `perspective(800px) rotateY(${px * 10}deg) rotateX(${-py * 10}deg) translateY(-6px)`;
  });
  document.addEventListener('mouseout', e => { const card = e.target.closest?.('.sig'); if (card) card.style.transform = ''; });
}

/* signatures */
const SIG = [
  ['1509042239860-f550ce710b93', 'Oak Latte', 'Espresso, steamed milk, maple and a pinch of sea salt.', '$5.00'],
  ['1555507036-ab1f4038808a', 'Butter Croissant', 'Hand-laminated, baked until it shatters.', '$3.75'],
  ['1461023058943-07fcbe16d735', 'Cold Brew', 'Steeped 18 hours. Smooth, bold, dangerously drinkable.', '$4.50'],
  ['1495147466023-ac5c588e2e94', 'Seasonal Fruit Tart', 'Vanilla custard, glazed fruit, buttery crust.', '$4.95'],
  ['1442512595331-e89e73853f31', 'Single-Origin Pour-over', 'Hand-brewed to order. Ask what is on today.', '$5.50'],
  ['1551024601-bec78aea704b', 'Glazed Donut', 'Yeasted dough, new flavour every morning.', '$3.50'],
];
track.innerHTML = SIG.map(([id, n, d, p]) => `<article class="sig"><div class="ph" style="background-image:url(${photo(id, 700)})"></div><div><h3>${n}</h3><p>${d}</p><b>${p}</b></div></article>`).join('');

/* menu */
const MENU = {
  coffee: { img: '1509042239860-f550ce710b93', items: [['Espresso', '3.00', 'Double shot, single-origin, rich and syrupy.'], ['Flat White', '4.50', 'Velvety microfoam over a ristretto base.'], ['Cappuccino', '4.25', 'Equal parts espresso, steamed milk and foam.'], ['Oak Latte', '5.00', 'Our house latte with maple and sea salt.'], ['Pour-over', '5.50', 'Hand-brewed to order.']] },
  cold: { img: '1461023058943-07fcbe16d735', items: [['Iced Latte', '4.75', 'Espresso, cold milk, lots of ice.'], ['Cold Brew', '4.50', 'Steeped 18 hours. Smooth and bold.'], ['Espresso Tonic', '5.25', 'Sparkling tonic, citrus peel, double shot.'], ['Iced Mocha', '5.25', 'Dark chocolate, espresso, cold milk.']] },
  bakery: { img: '1555507036-ab1f4038808a', items: [['Butter Croissant', '3.75', 'Laminated by hand. Baked until shattering.'], ['Seasonal Fruit Tart', '4.95', 'Vanilla custard, glazed fruit, buttery crust.'], ['Sourdough Toast', '6.50', 'Whipped ricotta, honey and toasted seeds.'], ['Glazed Donut', '3.50', 'Yeasted dough, daily flavours.']] },
};
const list = $('#list'), img = $('#menuImg');
function show(key) {
  const m = MENU[key];
  list.innerHTML = m.items.map(([n, p, d], i) => `<li style="animation-delay:${i * 70}ms"><div><span>${n}</span><b>$${p}</b></div><p>${d}</p></li>`).join('');
  img.style.opacity = 0;
  setTimeout(() => { img.src = photo(m.img, 700); img.alt = key; img.onload = () => img.style.opacity = 1; }, 150);
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.t === key));
}
$$('.tab').forEach(t => t.onclick = () => show(t.dataset.t));
show('coffee');

/* gallery + lightbox with prev/next */
const G = [['1495474472287-4d71bcdd2085', 'Cheers over latte art', 'Coffee', 'h4'], ['1559925393-8be0ec4767c8', 'Sunny terrace', 'Space', 'h1'], ['1551024601-bec78aea704b', 'Sprinkle donuts', 'Bakery', 'h2'],
  ['1514432324607-a09d9b4aefdd', 'Fresh espresso crema', 'Coffee', 'h2'], ['1495147466023-ac5c588e2e94', 'Fruit tarts', 'Bakery', 'h4'], ['1445116572660-236099ec97a0', 'Window table', 'Space', 'h3'],
  ['1501339847302-ac426a4a7cbb', 'The cafe sign', 'Space', 'h1'], ['1507133750040-4a8f57021571', 'Two cups of latte art', 'Coffee', 'h3'], ['1517248135467-4c7edcad34c4', 'Evening dining room', 'Space', 'h4'],
  ['1555507036-ab1f4038808a', 'Golden croissants', 'Bakery', 'h1'], ['1461023058943-07fcbe16d735', 'Iced coffee pour', 'Coffee', 'h3'], ['1509042239860-f550ce710b93', 'Morning latte art', 'Coffee', 'h2'],
  ['1442512595331-e89e73853f31', 'Pour-over ritual', 'Coffee', 'h1'], ['1554118811-1e0d58224f24', 'Our dining room', 'Space', 'h4']];
let saved = new Set(); try { saved = new Set(JSON.parse(localStorage.getItem('pins') || '[]')); } catch (e) {}
let cat = 'all', q = '';
function persist() { try { localStorage.setItem('pins', JSON.stringify([...saved])); } catch (e) {} $('#savedCount').textContent = saved.size; }
function renderPins() {
  const items = G.map((g, i) => ({ g, i })).filter(({ g, i }) => (cat === 'all' || (cat === 'Saved' ? saved.has(i) : g[2] === cat)) && g[1].toLowerCase().includes(q));
  $('#masonry').innerHTML = items.map(({ g, i }, k) => `<div class="pin ${g[3]}" data-i="${i}" style="animation-delay:${k * 40}ms"><img loading="lazy" src="${photo(g[0], 600)}" alt="${g[1]}"><div class="ov"><div class="top"><button class="save" aria-pressed="${saved.has(i)}">${saved.has(i) ? 'Saved' : '♥ Save'}</button></div><div class="cap"><small>${g[2]}</small>${g[1]}</div></div></div>`).join('');
  $('#emptyPins').hidden = items.length > 0;
}
$('#pinChips').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; cat = b.dataset.c; $$('#pinChips .chip').forEach(c => c.classList.toggle('active', c === b)); renderPins(); };
$('#pinSearch').oninput = e => { q = e.target.value.trim().toLowerCase(); renderPins(); };
persist(); renderPins();
const lb = $('#lightbox'); let li = 0;
function openLb(i) { li = (i + G.length) % G.length; $('img', lb).src = photo(G[li][0], 1600); $('img', lb).alt = G[li][1]; lb.classList.add('open'); }
$('#masonry').onclick = e => {
  const pin = e.target.closest('.pin'); if (!pin) return;
  const i = +pin.dataset.i;
  if (e.target.closest('.save')) { saved.has(i) ? saved.delete(i) : saved.add(i); persist(); if (cat === 'Saved') renderPins(); else { const b = e.target.closest('.save'); b.setAttribute('aria-pressed', saved.has(i)); b.textContent = saved.has(i) ? 'Saved' : '♥ Save'; } return; }
  openLb(i);
};
$('.prev', lb).onclick = e => { e.stopPropagation(); openLb(li - 1); };
$('.next', lb).onclick = e => { e.stopPropagation(); openLb(li + 1); };
lb.onclick = e => { if (e.target === lb || e.target.classList.contains('x')) lb.classList.remove('open'); };
addEventListener('keydown', e => {
  if (!lb.classList.contains('open')) return;
  if (e.key === 'Escape') lb.classList.remove('open');
  if (e.key === 'ArrowLeft') openLb(li - 1);
  if (e.key === 'ArrowRight') openLb(li + 1);
});

/* reviews carousel */
const R = [['The croissant alone is worth the trip. Flaky, buttery, still warm.', 'Maya R.'], ['Best flat white in town and the nicest staff. My daily ritual.', 'Daniel K.'], ['Cosy, beautiful and the Oak Latte is dangerously good.', 'Priya S.'], ['We came for coffee and stayed three hours. No regrets.', 'Tom & Elise']];
$('#rev').innerHTML = R.map(([q, a], i) => `<div class="rev${i ? '' : ' on'}"><q>“${q}”</q><cite>— ${a}</cite></div>`).join('');
$('#dots').innerHTML = R.map((_, i) => `<button class="${i ? '' : 'on'}" aria-label="Review ${i + 1}"></button>`).join('');
let ri = 0, timer;
function goR(i) { ri = i; $$('.rev').forEach((e, j) => e.classList.toggle('on', j === i)); $$('#dots button').forEach((e, j) => e.classList.toggle('on', j === i)); }
function autoR() { clearInterval(timer); timer = setInterval(() => goR((ri + 1) % R.length), 5000); }
$$('#dots button').forEach((b, i) => b.onclick = () => { goR(i); autoR(); });
autoR();

/* open status */
(function () {
  const d = new Date(), day = d.getDay(), h = d.getHours() + d.getMinutes() / 60;
  const [o, c] = day === 0 ? [8, 16] : day === 6 ? [8, 20] : [7, 18];
  const open = h >= o && h < c;
  $('#open').textContent = open ? '● Open now' : '○ Closed now — we open soon';
})();

/* forms */
$('#form').onsubmit = e => { e.preventDefault(); $('#msg').textContent = `Thanks ${e.target.name.value}! We'll confirm by email shortly.`; e.target.reset(); };
$('#club').onsubmit = e => { e.preventDefault(); $('#clubMsg').textContent = 'You are in! Show this message at the counter for your free croissant.'; e.target.reset(); };
