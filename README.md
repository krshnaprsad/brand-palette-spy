# Brand Palette Spy

Drop in a logo or a website and get the exact colours, the fonts and a brand sheet you can hand to someone.

Made by Zero3.

## Why I built Brand Palette Spy

When I paste a website or a logo in, it shows every colour exactly, with the hex code, so I can use it straight in my artwork. Fonts are the same story. Client briefs often name a font but do not give the file, and if it is a brand guideline font, their website almost certainly uses it. Normally I would have to open the browser inspector and dig around to get it. With Brand Palette Spy I just scroll, grab the font easily, and see the palette and colour theme of the brand.

## What it does

- **Logo or image:** drop, click or paste an image. You get the main colours with HEX, RGB, HSL, a colour name and the contrast against white and black. Images never leave your computer.
- **Website:** paste a web address and it reads the site's page and stylesheets, then shows the brand colours, neutrals, fonts and the logo it finds.
- **Brand sheet:** one standalone HTML page with the swatches, fonts and CSS variables. Also a palette PNG, copyable CSS and a JSON file.

## Use it

Open the app: https://krshnaprsad.github.io/brand-palette-spy/

Or download the repo and open `index.html`.

For websites, a browser page can't read other sites by itself. The address goes to a small helper (a free Cloudflare Worker in `worker/`) that fetches the page and its stylesheets and sends the raw text back. The colours and fonts are worked out in your browser. The helper stores nothing, blocks private and internal addresses, limits the size and time of each fetch, and rate limits each visitor. It runs on a free plan with a daily limit, so if it is busy, try again later.

You can also skip the helper:

```
node cli/spy.js https://example.com
```

That needs Node 18 or newer and nothing to install. It writes `brand.json`, `brand-sheet.html` and `brand.css`. Drop the `brand.json` into the Website tab to see it in the app. You can also paste a page's source there (Ctrl+U on the site).

## Run your own helper

If you would rather not rely on mine, deploy `worker/worker.js` to your own free Cloudflare account (Workers, free plan), then set `HELPER` at the top of the website section in `web/app.js` to your Worker address and change `ALLOW` in `worker.js` to the address where you host the app.

## Things to know

- Colours come from the site's own CSS, so they are what the site uses, not always the official brand colour.
- Only CSS rules that point at things on the page are counted, so template and editor leftovers are mostly ignored. The "Found in CSS for" note comes from reading the CSS, not from drawing the page, so treat it as a hint.
- Brand guideline: after reading a site I check its homepage links, its sitemap and usual pages like /brand and /press, and only show pages that really load and mention a brand guideline or press kit. If none is found it says so. Sites that build their pages with JavaScript or block bots can hide theirs.
- Fonts: open fonts (OFL, Apache and similar, checked against the Fontsource list) also get a zip and a Google Fonts link. If the site's homepage links to a brand assets, press kit or fonts page, that link is shown too. Sites that hide those pages won't show one.
- Every detected font can be downloaded if the site serves a file for it: your browser fetches the file the site itself uses (through the helper, since other sites block direct downloads) and saves it. Nothing is stored. These are often web formats (woff2), and a font on a website is not always free to use, so check the licence first.
- Fonts are read from the CSS and Google Fonts links. Fonts baked into images are not detected.
- Sites that build everything with JavaScript, or that block bots, can give little or nothing. The helper also can't see pages behind a login.
- The helper's rate limit is per visitor and kept in memory, so it is a polite guard, not a hard wall.
- SVG logos depend on your browser drawing them.
- Colour names are the nearest match from a small list, so treat them as a hint.

## Licence

I made this and it is free to use, including for paid work. What it is not free to do is be copied: please don't republish, redistribute or sell the code, or build your own version from it. The full terms are in [LICENSE](LICENSE). Versions published before 19 October 2026 were MIT and stay that way. The Zero3 name and logo are not part of the licence.
