# shared

The code every birthday book (soft-blue and rose-pink) uses. A book only holds what makes it different:

| file | what it is |
| --- | --- |
| `main.js` | the 3D engine: book, spiral, page turning, wishes, confetti |
| `models.js` | the 3D pop-ups (cake, balloons, gift, ball, teddy) |
| `extras.js`, `sound.js` | small 3D extras and the music-box sounds |
| `polish.js` | the gift splash ("tap to open", starts the music), drifting emoji, a WhatsApp button, the "make one" link at the end |
| `remote.js` | fetches an order from the API and merges it over the static data (format in the file header) |
| `config.js` | the API address (`url: ""` = static data only) and `brand.url` for the "make one for someone" link at the end |
| `base.css` | the page around the book |

Each template folder has only: `index.html`, `src/js/pages.js` (the content), `src/js/theme.js` (the look: colours,
cover stickers, cake), `src/css/theme.css` (the backdrop), `src/photos/` and `sample-order.json`.

A fix or a new feature goes here once and every template gets it. To make a new template, copy an existing one and change
`pages.js`, `theme.js`, `theme.css` and the pictures. Serve the folder that contains both `shared/` and the templates
(for example the `BirthDay-Tempale-2` folder with Live Server), because the templates load `../shared/`.
