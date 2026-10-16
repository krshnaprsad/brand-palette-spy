# Contributing

No dependencies. You need Node 18 or newer.

```
npm test
```

That runs `tests/spy.test.js` (colour maths, image palette, page extraction, sheet output), `tests/cli.test.js` (the CLI against a local server) and `tests/worker.test.js` (the helper's address rules and rate limit). None of them need internet.

Layout:

- `src/color.js` colour maths and palette quantizing
- `src/extract.js` colours and fonts from HTML and CSS
- `src/sheet.js` brand sheet and CSS variables
- `cli/spy.js` the command line tool
- `index.html`, `web/` the app
- `worker/worker.js` the Cloudflare Worker helper (deploy with `npx wrangler deploy` from `worker/`, free plan)

Keep it dependency free and keep public text plain, no em dashes.
