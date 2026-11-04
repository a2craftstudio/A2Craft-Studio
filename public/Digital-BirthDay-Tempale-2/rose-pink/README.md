# rose-pink – A Little Book of Wishes (girly 3D edition)

A soft pink-and-lilac 3D birthday wishes book for a girl: a real spiral-bound album built with
[Three.js](https://threejs.org), with a sticker-sheet cover (bows, butterflies, flowers, cherries, a little taped polaroid),
Pinterest papers (pink satin bows, blush roses, lavender, cream florals) and clipped polaroids with wish tags.
Plain HTML, CSS and JavaScript, no build step.

**To view:** open the folder with a local server (VS Code *Live Server*, or `npx serve`) – browsers block local
pictures in the 3D scene when `index.html` is opened by double-click. It also works on Netlify (drag the folder onto https://app.netlify.com/drop).
Fonts and Three.js still come from the internet; every picture is saved in `src/photos/`.

**Make it personal:** add the names to the link, e.g. `index.html?name=xyz&from=xyz`.

## Make it yours – `src/js/pages.js`

All the words, photos and papers are in `pages.js` (the header comment explains every field). Pictures are in
`src/photos/` – to use your own, save a photo there and write its file name, e.g. `img: "her-photo.jpg"`.
The cover photo is `cover.photo` on page 0 (it is a stand-in – replace it with her photo).

## What's inside

Cover · hello, you · wishes in pictures · little moments · my wishes for you · reasons i love you ·
wishes from the girls · wishes from the family · the year ahead · let your wishes fly (3D balloons) ·
make a wish (3D cake – tap to blow out the candles) · open when… · our memories · inside jokes ·
a gift for you (3D gift box) · all about you · bucket list · dear you (the letter) · a hug for you (3D teddy) ·
birthday quotes · happy birthday! (fireworks and "read again") · back cover.

Tap a photo to lift it for a closer look, tap a sticky note to make it hop, drag a page to turn it, drag the empty space to rotate, scroll or pinch to zoom.

The Pinterest pictures belong to their owners: fine for a personal gift, not for public or commercial use.

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

Serve the `BirthDay-Tempale-2` folder (it holds `shared/` and the books) and open `rose-pink/`.
