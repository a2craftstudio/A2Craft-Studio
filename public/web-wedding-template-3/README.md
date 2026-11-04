# Wedding template 3 — Phulkari

An original Punjabi wedding invitation template. One self-contained
`index.html`: no image files, no build step, ~20 KB.

The embroidery motifs are drawn in SVG — a darning-stitch petal rotated
into an eight-petal bloom, and a lattice pattern for the running border.
Nothing is downloaded except the Google Fonts stylesheet, so the page
works offline apart from its typefaces.

## Opening it

Double-click `index.html`, or serve the folder:

```
python -m http.server 4401
```

## Editing it

Everything a couple changes lives in the `INVITE` object near the top of
the `<script>` block: names, parents, wedding date and time, venue, RSVP
deadline, and the list of events. The page builds its heading, title,
maps link, event cards and countdown from that object alone.

## Not finished

- The RSVP form posts nowhere. Its submit handler only prints a
  confirmation — wire it to your own endpoint.
- Placeholder copy ("Put the full address here") is meant to be replaced.
