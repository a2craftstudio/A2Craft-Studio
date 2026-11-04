# Sweet Drip – Dessert Parlour website

A dessert site: **Home, Explore, Our Story, Moments, Visit Us** and a **Saved** board.

## Run it

```bash
python -m http.server 5500
```

Then open http://localhost:5500.

## Make it yours

Almost everything you'll want to change lives in **`js/data.js`**:

| What | Where in `js/data.js` |
| --- | --- |
| Menu items, prices, photos | `MENU` |
| Categories (name, colour, icon) | `CATEGORIES` |
| Team members & their photos | `TEAM` |
| Family album photos & captions | `MEMORIES` |
| Ingredients you use most | `INGREDIENTS` |
| Love-wall photos (couples, kids…) | `MOMENTS` |
| FAQ questions | `FAQS` |

**Using your own photos:** drop them into `img/` and change the path in `js/data.js`
(for example `img: "img/team-dada.jpg"`). Square-ish photos around 800px work best.
Shop photos on the Our Story page and the Visit Us page are set directly in `about.html` and `contact.html`.

**Phone number / WhatsApp:** change `WHATSAPP` near the top of `js/main.js`,
and the phone numbers in `contact.html`.

## Features

- Masonry pin feed, topic chips and boards; click any pin for the closeup with comments and "More like this".
- Red **Save** buttons keep pins on the visitor's Saved board (`saved.html`).
- Deep links: `menu.html?pin=fa1` opens a pin, `menu.html?topic=gola` opens a board.

## Map & parlours

- `contact.html` shows a live street map (Leaflet + OpenStreetMap) with all parlours from `BRANCHES` in `js/data.js`.
- Change a parlour's address, phone, hours, photo or exact pin (`lat`, `lng`) there — copy the coordinates from
  Google Maps (right-click a spot → the numbers at the top).
- Visitors can tap "Find nearest to me", get Google Maps directions, call, WhatsApp or book a table per parlour.
- OpenStreetMap's free tiles are fine for a small site; for heavy traffic switch to a tile provider such as MapTiler.

## Gola builder

`img/gola-base.jpg` is a real shaved-ice photo and `img/gola-mask.png` marks where the ice is.
Syrup colours are blended into the ice through that mask. To use your own gola photo, use a
white gola on a darker background and ask for a new mask to be generated.
Toppings are real photo cut-outs in `img/toppings/` (scoop, cherry, pistachio, mango, gummy bears); prices are the
`data-price` values on the topping buttons in `index.html`.

## Notes

- Icons are [Phosphor Icons](https://phosphoricons.com) (MIT), stored in `vendor/phosphor` so they work offline.
- Photos are free-license images from Unsplash and Pexels — placeholders until you add your own.
- The cart, likes, shared photos and questions are saved in the visitor's browser only
  (no server). Connecting real orders or messages needs a backend or a service like WhatsApp Business / Google Forms.
- The earlier Figma-based version is kept in `figma-version/`.
