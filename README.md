# Brand Palette Spy

Drop in a logo or a website and get the exact colours, the fonts and a brand sheet you can hand to someone.

Made by Zero3.

## What it does

- **Logo or image:** drop, click or paste an image. You get the main colours with HEX, RGB, HSL, a colour name and the contrast against white and black.
- **Website:** the command line tool reads a site's page and stylesheets and pulls out the brand colours, neutrals and fonts, plus the logo and icon it finds.
- **Brand sheet:** one standalone HTML page with the swatches, fonts and CSS variables. Also a palette PNG, copyable CSS and a JSON file.

## Use it

Open `index.html` in a browser. Nothing is uploaded anywhere, images stay on your machine.

For a website, a web page can't read other sites, so use the command line (Node 18 or newer, nothing to install):

```
node cli/spy.js https://example.com
```

It writes `brand.json`, `brand-sheet.html` and `brand.css`. You can drop that `brand.json` into the Website tab to see it in the app. You can also paste a page's source there.

## Things to know

- Colours come from the site's own CSS, so they are what the site uses, not always the official brand colour.
- Fonts are read from the CSS and Google Fonts links. Fonts baked into images are not detected.
- Sites that build everything with JavaScript, or that block scripts, can give little or nothing.
- SVG logos depend on your browser drawing them.
- Colour names are the nearest match from a small list, so treat them as a hint.

## Licence

MIT. See `LICENSE`. Developer notes are in `CONTRIBUTING.md`.
