import { Motif } from './models';

/**
 * Clean line illustrations as data URIs: soft off-white card, dark outline art, one small red accent.
 * Each motif matches a product theme. Replace with real photography via the admin area.
 */
const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100003; return h; };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const INK = '#1a1a1a';
const ACCENT = '#e60023';
const BG = '#f5f5f5';
const S = `stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;

const heart = (cx: number, cy: number, s: number, fill = ACCENT) =>
  `<path d="M${cx} ${cy + s * 0.9}C${cx - s * 1.6} ${cy - s * 0.2} ${cx - s * 0.6} ${cy - s * 1.2} ${cx} ${cy - s * 0.4}C${cx + s * 0.6} ${cy - s * 1.2} ${cx + s * 1.6} ${cy - s * 0.2} ${cx} ${cy + s * 0.9}Z" fill="${fill}" ${fill === 'none' ? S : ''}/>`;

function flower(cx: number, cy: number, r: number) {
  let p = '';
  for (let i = 0; i < 6; i++) p += `<ellipse cx="${cx}" cy="${cy - r * 0.55}" rx="${r * 0.28}" ry="${r * 0.5}" fill="#fff" ${S} transform="rotate(${i * 60} ${cx} ${cy})"/>`;
  return p + `<circle cx="${cx}" cy="${cy}" r="${r * 0.2}" fill="${ACCENT}" ${S}/>`;
}

function art(motif: Motif, cx: number, cy: number): string {
  switch (motif) {
    case 'cake':
      return `<rect x="${cx - 70}" y="${cy + 10}" width="140" height="70" rx="8" fill="#fff" ${S}/><path d="M${cx - 70} ${cy + 30}q17 14 35 0t35 0t35 0t35 0" fill="none" ${S}/>` +
        [-30, 0, 30].map((x) => `<rect x="${cx + x - 4}" y="${cy - 28}" width="8" height="38" rx="3" fill="#fff" ${S}/><path d="M${cx + x} ${cy - 56}q-9 12 0 22q9 -10 0 -22Z" fill="${ACCENT}" ${S}/>`).join('');
    case 'book':
      return `<path d="M${cx} ${cy - 56}c-26 -14 -56 -14 -78 -4v112c22 -10 52 -10 78 4c26 -14 56 -14 78 -4v-112c-22 -10 -52 -10 -78 4Z" fill="#fff" ${S}/><path d="M${cx} ${cy - 56}v112" fill="none" ${S}/>${heart(cx - 40, cy - 6, 14)}<path d="M${cx + 22} ${cy - 20}h38M${cx + 22} ${cy - 4}h30M${cx + 22} ${cy + 12}h34" fill="none" ${S}/>`;
    case 'frame':
      return `<rect x="${cx - 72}" y="${cy - 80}" width="144" height="160" rx="6" fill="#fff" ${S}/><rect x="${cx - 54}" y="${cy - 62}" width="108" height="100" rx="3" fill="${BG}" ${S}/>${flower(cx, cy - 12, 34)}<path d="M${cx - 38} ${cy + 58}h76" fill="none" ${S}/>`;
    case 'story':
      return `<rect x="${cx - 56}" y="${cy - 96}" width="112" height="196" rx="18" fill="#fff" ${S}/><rect x="${cx - 42}" y="${cy - 72}" width="84" height="100" rx="8" fill="${BG}" ${S}/>${heart(cx, cy - 26, 20)}<path d="M${cx - 34} ${cy + 52}h68M${cx - 22} ${cy + 68}h44" fill="none" ${S}/>`;
    case 'letter':
      return `<rect x="${cx - 88}" y="${cy - 54}" width="176" height="112" rx="8" fill="#fff" ${S}/><path d="M${cx - 88} ${cy - 48}L${cx} ${cy + 16}L${cx + 88} ${cy - 48}" fill="none" ${S}/>${heart(cx, cy + 26, 12)}`;
    case 'video':
      return `<rect x="${cx - 96}" y="${cy - 60}" width="192" height="120" rx="14" fill="#fff" ${S}/><circle cx="${cx}" cy="${cy}" r="28" fill="${ACCENT}" ${S}/><path d="M${cx - 8} ${cy - 15}L${cx + 17} ${cy}L${cx - 8} ${cy + 15}Z" fill="#fff" ${S}/>`;
    case 'rings':
      return `<circle cx="${cx - 26}" cy="${cy + 10}" r="46" fill="none" ${S}/><circle cx="${cx + 26}" cy="${cy + 10}" r="46" fill="none" ${S}/><path d="M${cx} ${cy - 50}l-10 -16h20Z" fill="${ACCENT}" ${S}/>`;
    case 'hearts':
      return heart(cx, cy, 62) + heart(cx - 76, cy + 52, 22, 'none') + heart(cx + 80, cy - 44, 18, 'none');
    case 'card':
      return `<rect x="${cx - 72}" y="${cy - 94}" width="144" height="188" rx="8" fill="#fff" ${S}/>${flower(cx, cy - 28, 42)}${flower(cx + 34, cy + 34, 20)}<path d="M${cx - 40} ${cy + 70}h80" fill="none" ${S}/>`;
    case 'lamp':
      return `<path d="M${cx - 80} ${cy + 20}q80 80 160 0Z" fill="#fff" ${S}/><path d="M${cx} ${cy - 70}q-26 28 0 60q26 -32 0 -60Z" fill="${ACCENT}" ${S}/><path d="M${cx - 50} ${cy + 20}v-6h100v6" fill="none" ${S}/>`;
    default:
      return flower(cx, cy, 84) + flower(cx - 96, cy + 70, 30) + flower(cx + 98, cy - 64, 26);
  }
}

export function coverArt(opts: {
  seed: string;
  title: string;
  palette: [string, string];
  motif: Motif;
  aspect: number;
  variant?: number;
  label?: string;
}): string {
  const w = 400;
  const h = Math.round(w * opts.aspect);
  const label = (opts.label ?? opts.title).trim();
  const lines: string[] = [];
  let cur = '';
  for (const wd of label.split(' ')) {
    if ((cur + ' ' + wd).trim().length > 20) { lines.push(cur.trim()); cur = wd; } else cur = (cur + ' ' + wd).trim();
  }
  if (cur) lines.push(cur);
  const hasText = lines.length > 0 && lines[0] !== '';
  const cy = hasText ? h * 0.42 : h / 2;
  const text = hasText
    ? lines.slice(0, 3).map((l, i) => `<text x="${w / 2}" y="${h * 0.8 + i * 28}" text-anchor="middle" font-family="Figtree, system-ui, sans-serif" font-size="24" font-weight="700" fill="${INK}">${esc(l)}</text>`).join('')
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><style>.fl{animation:fl 4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}@keyframes fl{0%,100%{transform:translateY(0) rotate(-1.5deg)}50%{transform:translateY(-9px) rotate(1.5deg)}}@media (prefers-reduced-motion:reduce){.fl{animation:none}}</style><rect width="${w}" height="${h}" fill="${BG}"/><g class="fl" style="animation-delay:-${(hash(opts.seed) % 30) / 10}s">${art(opts.motif, w / 2, cy)}</g>${text}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
