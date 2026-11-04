# soft-blue – A Little Book of Wishes (3D)

A soft, light, 3D birthday wishes book for a boy. It's a real spiral-bound album built with
[Three.js](https://threejs.org) (WebGL): metal twin-loop wire binding, stiff covers, thick page
blocks and pages that swing over the coil. Plain HTML, CSS and JavaScript, no build step.

**To view:** double-click `index.html` (it needs internet for the pictures, fonts and Three.js).

**Make it personal:** add the names to the link, e.g. `index.html?name=xyz&from=xyz`
(or `https://your-site.netlify.app/?name=xyz&from=xyz`). The name appears on the cover and the
last page, yours on the back cover. You can also type them into `name` and `from` at the top of `pages.js`.

## What's inside

The sections follow what birthday memory books usually contain:

| Pages | Section |
|-------|---------|
| Cover | "happy birthday" with his name |
| 1 | hello, you – a clipped photo with a wish tag (blue-flower paper) |
| 2 | wishes in pictures – clipped polaroids with wish tags (blue gingham) |
| 3 | little moments – more wish photos (blue bow paper) |
| 4 | my wishes for you – a print and torn paper wish strips (pink clouds) |
| 5 | reasons i love you – three polaroids (cream roses) |
| 6 | wishes from the squad – film-strip photos (kraft paper) |
| 7 | wishes from the family – little paper letters (blue damask) |
| 8 | the year ahead – a photo for every season (blue watercolour) |
| 9 | let your wishes fly – 3D balloons (sunset clouds) |
| 10 | make a wish – 3D cake, blow out the candles |
| 11 | open when… – notes under the stars |
| 12 | our memories – photo chapters (vintage script paper) |
| 13 | inside jokes – film strip & polaroid (gingham) |
| 14 | a gift for you – 3D gift box (blue bows) |
| 15 | all about you – favourites as polaroids (kraft & roses) |
| 16 | bucket list – film photo and a checklist |
| 17 | dear you – the birthday letter |
| 18 | a hug for you – 3D teddy |
| 19 | birthday quotes – paper strips on a navy sky |
| 20 | happy birthday! – fireworks and "read again" |
| Back cover | made with love, from you |

## How to use it

- **Turn pages:** tap a page, drag it sideways, use the ‹ › buttons or the arrow keys.
- **Look around in 3D:** drag the empty space around the album to rotate, scroll or pinch to zoom.
- **Tap a photo** to pick it up for a closer look; tap again to put it down. **Tap a sticky note** and it hops on its pin.
- **Tap the 3D things:** the cake (blow out the candles), the gift (opens), the teddy (a hug), the balloons (pop one).
- **♫** plays a music-box "Happy Birthday". **Share** opens the share menu or copies the link.
- Objects on a page only appear once the page has landed, so nothing from the next page flashes while you turn.

## Make it yours – `src/js/pages.js`

All the words are in `pages.js`. The notes are written as friendly examples, so **replace them with your own**
memories, jokes and wishes. Each page looks like this:

```js
{
  bg: PAPER_2, title: ["my wishes ", "for you"],
  notes: [
    { text: "wish #1", secret: "may your year be full of laughter", x: 30, y: 18, r: -4, color: "blue", size: 34 },
  ],
  stickers: [{ shape: "heart", x: 88, y: 91, size: 8, color: "pink" }],
  models: [{ type: "cake", x: 50, y: 58, scale: 1.35 }],
}
```

- `notes`: `text` is the small heading and `secret` the wish written under it (both on the front). `x`, `y` are the note's centre-top in % of the page;
  on right-hand pages keep `x` between 30 and 72 and on left-hand pages between 22 and 62 so notes stay clear of the spiral.
- `stickers`: shapes `heart`, `star`, `moon`, `cloud`.
- `models`: `cake`, `gift`, `teddy`, `balloons`, `ball`.
- `photos`: 3D photos – `{ img, x, y, w, r, cap }`; tap to pick up, tap again to put down.
  `style: "print"` (thin white border) or `style: "film"` (dark film frame) instead of a polaroid; `ratio` sets the picture shape.
  Add `clip: "pink"` (any colour, `"gold"` or `"silver"`) for a 3D paper clip instead of tape, and
  `wish: "…"` for a little wish tag tucked under the bottom corner (`wishSide: "left"`, `wishColor: "blue"`).
- `accent` / `ink`: colours of the two halves of the page title; `titleBg: true` puts the title on a taped paper label.
- `texts` with `paper: true` (or a colour) sit on a taped scrap of paper – great for wish strips and checklists.
- Page papers are Pinterest backgrounds, listed in `BG` at the top of `pages.js`.
  To use a photo from Pinterest: open the pin, right-click the image, **Copy image address**, and paste the part
  after `i.pinimg.com/736x/` (or the whole address).
- Colours: `blue`, `butter`, `mint`, `lilac`, `peach`, `pink` or any `#hex`.
- The letter is the page with `kind: "letter"` – write your own message there.

```
BirthDay-Tempale-2/
├── shared/                # the code every birthday book uses (engine, 3D models, sounds, API loader, base styles)
└── soft-blue/
    ├── index.html         # page, buttons, loading screen
    ├── sample-order.json  # an example order for the API
    └── assets/
        ├── css/theme.css  # the backdrop and colours around the book
        ├── img/           # the pictures
        └── js/
            ├── pages.js   # ✎ THE CONTENT – every page, note, sticker and photo
            └── theme.js   # the look – colours, cover stickers, the cake
```

## Notes

- Images load from Pinterest through the free image proxy [wsrv.nl](https://wsrv.nl) (WebGL needs it).
  The pins are other people's photos: fine for a personal gift, but don't reuse them publicly or commercially.
- Sections were chosen from common birthday memory-book ideas: reasons-I-love-you pages, timelines,
  favourites, "open when" notes, inside jokes, letters and wishes from friends, and a future bucket list.

## Putting it online (free)

1. Go to https://app.netlify.com/drop
2. drag the whole `soft-blue` folder onto the page
3. Share the link, with `?name=…&from=…` added

## Order data from an API (with the static data as the fallback)

Each order can have its own name, photos, wishes, quotes and letter. The link carries the order id,
`index.html?order=1234`, and `../shared/config.js` says where to fetch it:

```js
window.BOOK_API = { url: "https://api.example.com/birthday-books/{order}", timeout: 4000 };
```

`../shared/remote.js` fetches that address **before the 3D book is built** and merges the reply over the static content in
`pages.js`. If `url` is empty, the link has no `order`, the API is slow, fails or does not return JSON, the book opens with the
static data – so it always works. A picture that fails to load falls back to the static picture it replaced.
The JSON format is documented at the top of `remote.js`; `sample-order.json` is a working example
(set `url: "sample-order.json?{order}"` and open `index.html?order=demo` on a local server to try it).
Every field is optional: `name`, `from`, `coil` (the spiral's colour), `cover`, `photos` (every photo in page order),
`wishes`, `quotes`, `letter`, `signature`, and `pages` (edit one page by its number).

The **spiral** colour belongs to the theme (`coil` at the top of `BOOK` in `pages.js`); an order can override it.

## How the code is organised

The engine, models, sounds, API loader and base styles are shared by every birthday book and live in `../shared/`
(see `../shared/README.md`). This folder only has what is different about this book:

- `src/js/pages.js` - the content: pages, photos, text, notes, stickers
- `src/js/theme.js` - the look: colours, cover stickers, the cake
- `src/css/theme.css` - the backdrop around the book
- `src/photos/` - the pictures

Serve the `BirthDay-Tempale-2` folder (it holds `shared/` and the books) and open `soft-blue/`.
