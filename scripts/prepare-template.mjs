// Prepares one of the client-rendered ('spa') templates for hosting, so the studio's
// customize editor can reach into it.
//
//   node scripts/prepare-template.mjs ../web-wedding-template-13
//   node scripts/prepare-template.mjs ../web-wedding-template-13 --base /web-wedding-template-13/
//   node scripts/prepare-template.mjs ../web-wedding-template-13 --bridge https://example.com/template-bridge.js
//
// Two jobs:
//
//  1. Inject <script src="<bridge>"></script> into every index.html. The editor can only
//     inject the bridge itself when the template is served from this app; a template hosted
//     on another origin has to carry it. Running the script again is a no-op.
//
//  2. Optionally rewrite the template's absolute asset paths (`/assets/...`, `/__l5e/...`,
//     `/favicon.png`, `/apple-touch-icon.png`) to sit under --base. These templates expect to
//     own a web root, so --base is only needed when the host serves them from a sub-path —
//     GitHub Pages project sites (`user.github.io/<repo>/`) do, while Cloudflare Pages and
//     Netlify give each project its own root and need no rewrite at all.
//
// Always run this on a clean checkout, and check the result into the template's own repo.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

if (!dir) {
  console.error('Usage: node scripts/prepare-template.mjs <template-dir> [--base /prefix/] [--bridge <url>]');
  process.exit(1);
}

const root = resolve(dir);
const bridge = flag('bridge') ?? 'https://a2craft-studio.onrender.com/template-bridge.js';
const base = flag('base');

if (base && (!base.startsWith('/') || !base.endsWith('/'))) {
  console.error(`--base must start and end with a slash, e.g. /web-wedding-template-13/ (got ${base})`);
  process.exit(1);
}

const ROOTS = ['/assets/', '/__l5e/', '/favicon.png', '/apple-touch-icon.png'];
const TEXT = /\.(html|js|css|mjs|json|webmanifest)$/i;
const SKIP = new Set(['.git', 'node_modules']);

function* files(d) {
  for (const name of readdirSync(d)) {
    if (SKIP.has(name)) continue;
    const p = join(d, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else yield p;
  }
}

/** Only quoted occurrences, so a bare `/assets/` inside prose or a regex is left alone. */
function rewrite(text) {
  let out = text;
  for (const r of ROOTS) {
    for (const q of ['"', "'", '`', '(']) {
      out = out.split(`${q}${r}`).join(`${q}${base}${r.slice(1)}`);
    }
  }
  // Moving the assets is not enough: the router matches on the URL path, so it needs the
  // same prefix or every route 404s. The bundle ships one empty basepath to fill in.
  out = out.split('basepath:``').join(`basepath:\`${base.replace(/\/$/, '')}\``);

  // Vite's preload helper keeps the build's base as a function over relative dep paths —
  // `function(e){return`/`+e}` — and lazily-loaded route chunks go through it, so without
  // this they are fetched from the server root and 404. The damage varies by bundle: where
  // the HTML already preloads a chunk the failure is invisible, and where it does not the
  // page renders nothing at all.
  return out.replace(
    /function\(([A-Za-z_$][\w$]*)\)\{return`\/`\+\1\}/g,
    (_m, v) => `function(${v}){return\`${base}\`+${v}}`,
  );
}

/** One bridge tag per page: an earlier one is repointed, so re-running with a new URL is safe. */
const BRIDGE_TAG = /<script[^>]+src="[^"]*template-bridge\.js"[^>]*><\/script>/g;

function inject(html) {
  const tag = `<script src="${bridge}"></script>`;
  if (BRIDGE_TAG.test(html)) return html.replace(BRIDGE_TAG, tag);
  if (html.includes('</body>')) return html.replace('</body>', `${tag}</body>`);
  return html + tag;
}

let rewritten = 0;
let injected = 0;

for (const file of files(root)) {
  if (!TEXT.test(file)) continue;
  const before = readFileSync(file, 'utf8');
  let after = before;
  if (base) after = rewrite(after);
  if (file.endsWith('.html')) after = inject(after);
  if (after === before) continue;
  writeFileSync(file, after);
  if (file.endsWith('.html')) injected++;
  else rewritten++;
  console.log(`  updated ${file.slice(root.length + 1)}`);
}

console.log(
  `\n${injected} HTML file(s) and ${rewritten} asset file(s) updated in ${root}.` +
    (base ? `\nAbsolute paths now point under ${base}.` : '\nPaths left alone: host this template at its own web root.') +
    `\nBridge: ${bridge}` +
    `\n\nNext: deploy the folder, then add its public URL to SPA_TEMPLATE_URLS in src/app/core/templates.ts.`,
);
