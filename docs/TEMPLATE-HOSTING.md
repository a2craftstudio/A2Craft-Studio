# Getting a template from its repo onto the site

Every template in `src/app/core/templates.ts` is a repo under `github.com/a2craftstudio`.
A template stays in the catalogue — and shows "coming soon" instead of an empty frame —
until its files are reachable. This is how to make one reachable.

**All of those repos are currently private, and GitHub Pages will not serve a private repo
on a free plan.** Whatever route you take below, that is the first thing to settle: make the
repo public, pay for Pages, or host somewhere else.

## Which route a template takes

Check its `kind` in the registry.

### `html` and `nuxt` — copy into `public/`

Their paths are relative, so they need no host of their own:

```bash
cp -r ../web-wedding-template-7/. public/web-wedding-template-7/
```

Then drop the `status: 'pending'` line from its entry. The editor injects
`template-bridge.js` into anything this app serves, so nothing else is needed and the
template is editable straight away.

Two things to watch. A Nuxt template carries its router base inside the bundle and has to be
repointed at the sub-path. And these are
3–21 MB each, so copying all of them in adds well over 100 MB to this repo and to every
Render build; prefer bringing in the ones you actually sell.

### `spa` — host it on its own

These are client-rendered scrapes whose asset URLs are absolute and whose router matches on
the full path, so they expect to own a web root. First prepare the folder:

```bash
node scripts/prepare-template.mjs ../web-wedding-template-13 --base /web-wedding-template-13/
```

`--base` is needed only where the host serves from a sub-path. GitHub Pages project sites
(`a2craftstudio.github.io/<repo>/`) do; Cloudflare Pages and Netlify give each project its
own root, so there you leave `--base` off and nothing is rewritten. The script prefixes the
absolute asset paths and the router's `basepath`, and adds `template-bridge.js` to every
`index.html` — that second part is what makes the template editable, because the editor can
only inject the bridge into a template this app serves itself. Re-running is safe; an
existing bridge tag is repointed rather than duplicated.

Then push and turn Pages on:

```bash
gh auth switch --user a2craftstudio
```

```bash
cd ../web-wedding-template-13 && gh repo create a2craftstudio/web-wedding-template-13 --public --source . --remote origin --push
```

```bash
gh api -X POST repos/a2craftstudio/web-wedding-template-13/pages -f build_type=legacy -F 'source[branch]=main' -F 'source[path]=/'
```

```bash
gh auth switch --user avneesh9908
```

If the repo already exists, `git push -u origin main` replaces the `gh repo create` step.

## Switching it on here

Add the URL to `SPA_TEMPLATE_URLS` in `src/app/core/templates.ts`. Each scrape answers on
its own demo route rather than at the host root, and the registry records which — the
`pagesUrl` helper in that file spells out the exact value, so there is no need to guess:

```ts
'web-wedding-template-13': 'https://a2craftstudio.github.io/web-wedding-template-13/demo12/',
```

The demo routes differ per template (`demo1`, `demo3`, `demo5`, `demo7`, `demo8`, `demo10`,
`demo11`, `demo12`), which is why `demoPath` is part of each entry and a test asserts every
`spa` template has one.

## Checking it worked

Open `/customize/<slug>`. The panel reads "Reading the design…" until the bridge answers; if
it never does, the page is not carrying `template-bridge.js`, or the studio origin in that
script tag is wrong. Once it answers, the opening video covers everything, so the panel
starts with a single slot — skip the video in the preview and the rest appear.

## What `--base` has to rewrite, and why all three matter

Three separate things in these bundles hold the site root, and missing any one of them
produces a different failure:

1. **The asset URLs in the HTML and JS** (`/assets/…`, `/__l5e/…`). Miss these and nothing
   loads at all.
2. **The router's `basepath`.** Miss this and the files load but no route matches, so the
   page stays blank.
3. **Vite's preload helper** — `function(e){return`/`+e}` — which turns relative dep paths
   back into root-absolute URLs for lazily-loaded route chunks. Miss this and the symptom
   depends on the bundle: where the HTML already preloads a chunk the duplicate request
   just 404s invisibly, and where it does not the page renders nothing.

That third one is worth dwelling on, because it is easy to misread. An earlier version of
this document described those 404s as harmless, on the evidence of one template that
happened to render anyway. It was not harmless — the same defect left other templates
completely blank. If you see requests to `/assets/*.js` without the repo prefix, the preload
helper has not been patched, whatever the page looks like.

Hosting at a web root avoids all three, which is why Cloudflare Pages or Netlify is the
simpler option when it is available.

## Not in the catalogue

`web-wedding-template-4-5` holds copies of templates 4 and 5 and is skipped as a duplicate.
`web-wedding-template-15` exists locally but was never pushed, so it has no repo.

## Read a scrape before you commit it

A scraped site is somebody else's build output, and build output can carry things that
were never meant to leave their server. The one Romance clone we pulled in,
einvite.website, had its **live Stripe secret key and live Razorpay key** sitting in a
client-side Nuxt chunk. GitHub push protection caught it on the way out; the folder is now
in `.gitignore` and is not in this repo.

So before adding a template here, grep the thing:

```bash
grep -rlE '(sk|rk)_(live|test)_[A-Za-z0-9]{20}|rzp_(live|test)_|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30}' public/<slug>/
```

Nothing printed means nothing matched. A hit is not ours to publish, and scrubbing the
key is not enough — it is still live on the site it came from, and whoever owns it needs
to hear about it and rotate it.
