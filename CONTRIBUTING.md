# Contributing

No dependencies. You need Node 18 or newer.

```
npm test
```

That runs `tests/spy.test.js` (colour maths, image palette, page extraction, sheet output) and `tests/cli.test.js` (the CLI against a local server, no internet).

Layout:

- `src/color.js` colour maths and palette quantizing
- `src/extract.js` colours and fonts from HTML and CSS
- `src/sheet.js` brand sheet and CSS variables
- `cli/spy.js` the command line tool
- `index.html`, `web/` the app

Keep it dependency free and keep public text plain, no em dashes.
