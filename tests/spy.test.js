// node tests/spy.test.js
const assert = require("assert"), C = require("../src/color.js"), E = require("../src/extract.js"), S = require("../src/sheet.js");
// colour maths
assert.strictEqual(C.rgbToHex([30, 100, 240]), "#1E64F0");
assert.deepStrictEqual(C.hexToRgb("#fff"), [255, 255, 255]);
assert.deepStrictEqual(C.hexToRgb("0a66c2"), [10, 102, 194]);
assert.strictEqual(C.contrast([255, 255, 255], [0, 0, 0]), 21);
assert.ok(Math.abs(C.contrast([255, 255, 255], [119, 119, 119]) - 4.48) < 0.05);   // #777 on white is just under AA
assert.deepStrictEqual(C.rgbToHsl(C.hslToRgb(210, 50, 40)), [210, 50, 40]);
assert.strictEqual(C.nameOf([255, 255, 255]), "White"); assert.strictEqual(C.nameOf([0, 0, 0]), "Black");

// image palette: a flat 3-colour picture comes back as those three colours with the right shares
const px = []; for (let i = 0; i < 1000; i++) px.push(i < 600 ? [255, 98, 24, 255] : i < 900 ? [30, 100, 240, 255] : [20, 20, 60, 255]);
const q = C.quantize(Uint8ClampedArray.from([].concat.apply([], px)), 6, { merge: 16 });
assert.strictEqual(q.length, 3); assert.strictEqual(C.rgbToHex(q[0].rgb), "#FF6218"); assert.ok(Math.abs(q[0].share - 0.6) < 0.02);
// transparent pixels are ignored
assert.strictEqual(C.quantize(Uint8ClampedArray.from([255, 0, 0, 0, 255, 0, 0, 0]), 4).length, 0);

// page extraction
const html = `<html><head><title>Acme Co | Home</title><meta name="theme-color" content="#0A66C2"><meta property="og:image" content="/og.png">
<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/a.css"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&family=Inter&display=swap" rel="stylesheet"></head>
<body><header><img class="site-logo" src="/img/logo.svg" alt="Acme"></header><section class="customer-logos"><img class="customerLogo" src="/img/openai-logo.svg"></section><style>:root{--brand-primary:#0A66C2;--text:#222;--bg:#fff} a{color:#0a66c3} .btn{background:#0A66C2;color:#fff} .btn2{background:rgb(255,98,24)}
h1{font-family:"Poppins",Helvetica,sans-serif} p{font-family:Inter,system-ui} @font-face{font-family:"Acme Display";src:url(a.woff2)} .x{font-size:2em}</style></body></html>`;
const b = E.extract(html, ["/* c */ .c{background:#0a66c2} .d{color:rgba(0,0,0,.9)} .e{color:rgba(255,0,0,.1)}"], "https://acme.test/");
assert.strictEqual(b.title, "Acme Co | Home");
assert.strictEqual(b.colors.brand[0].hex, "#0A66C2");                       // the declared brand colour wins and near copies (#0a66c3) merge into it
assert.ok(b.colors.brand.some(c => c.hex === "#FF6218"));
assert.ok(!b.colors.brand.some(c => c.hex === "#FF0000"));                  // a 10% transparent red is not a brand colour
assert.ok(b.colors.neutrals.some(c => c.hex === "#FFFFFF"));
assert.deepStrictEqual(b.fonts.map(f => f.family).slice(0, 3).sort(), ["Acme Display", "Inter", "Poppins"]);
assert.ok(!b.fonts.some(f => /helvetica|sans-serif|system-ui/i.test(f.family)));
assert.strictEqual(b.logo, "https://acme.test/img/logo.svg"); assert.strictEqual(b.icon, "https://acme.test/favicon.ico"); assert.strictEqual(b.ogImage, "https://acme.test/og.png");
assert.strictEqual(b.stylesheets[0], "https://acme.test/a.css");
// unused rules (editor chrome, other templates) must not count; used ones report where the colour appears
const pg = '<body><a class="cta">Go</a><div class="hero"></div><style>.cta{background:#0A66C2;color:#fff}.hero{background:#111}.editor-tooltip{background:#F0523D}.other-theme .x{color:#7DBB00}mark{background:#ff0}.cta:hover{background:#0A66C2}</style></body>';
const up = E.extract(pg, [], "https://u.test/");
assert.strictEqual(up.colors.brand.length, 1); assert.strictEqual(up.colors.brand[0].hex, "#0A66C2");
assert.ok(up.colors.brand[0].uses.indexOf("buttons") >= 0 && up.colors.brand[0].uses.indexOf("backgrounds") >= 0);
// official brand and font pages the site links to
const bl = E.pageInfo('<footer><a href="/brand-guidelines">Brand guidelines</a> <a href="https://acme.test/press/kit.zip">Press kit</a> <a href="/about">About</a> <a href="/blog/rebranding">Our rebrand story</a> <a href="mailto:brand@x.test">brand</a></footer>', "https://acme.test/").brandLinks;
assert.deepStrictEqual(bl.map(l => l.url), ["https://acme.test/brand-guidelines", "https://acme.test/press/kit.zip"]); assert.strictEqual(bl[1].file, true);
// font files the site serves: relative urls resolve against the stylesheet, installable formats come first, data urls are skipped
const ff = E.fontFaces([{ url: "https://a.test/css/x.css", css: '@font-face{font-family:"Acme Sans";font-weight:700;src:url(../f/a.woff2) format("woff2"),url(../f/a.ttf) format("truetype")}@font-face{font-family:D;src:url(data:font/woff2;base64,AAAA)}' }]);
assert.deepStrictEqual(ff["acme sans"], [{ url: "https://a.test/f/a.ttf", ext: "ttf", weight: "700", style: "normal" }]); assert.ok(!ff.d);
// icon choice: apple-touch-icon beats favicon, &amp; in urls is decoded, customer logos are never picked
const ic = E.pageInfo('<link rel="icon" href="/f.ico"><link rel="icon" type="image/png" sizes="96x96" href="/i.png?w=96&amp;h=96"><link rel="apple-touch-icon" href="/t.png"><body><div class="customerLogo"><img class="customerLogo-img" src="/openai.svg"></div>', "https://x.test/");
assert.strictEqual(ic.icon, "https://x.test/t.png"); assert.strictEqual(ic.logo, "");
assert.strictEqual(E.pageInfo('<link rel="icon" type="image/png" sizes="96x96" href="/i.png?w=96&amp;h=96"><link rel="shortcut icon" href="/f.ico">', "https://x.test/").icon, "https://x.test/i.png?w=96&h=96");
// family variants are one font
assert.strictEqual(E.fontsIn("a{font-family:CircularSp,sans-serif} b{font-family:CircularSp-Arab} c{font-family:CircularSp-Deva}", "").fonts.length, 1);
// letter-spacing in a font variable is not a font
assert.strictEqual(E.fontsIn(":root{--font-tracking:-0.01em;--font-main:'Lato',sans-serif}", "").fonts.map(f => f.family).join(), "Lato");

// sheet and css
const sheet = S.sheetHtml(Object.assign({}, b, { title: "<script>alert(1)</script>" }), {});
assert.ok(sheet.indexOf("<script>alert") < 0, "title must be escaped");
assert.ok(/#0A66C2/.test(sheet) && /Poppins/.test(sheet) && /fonts\.googleapis\.com/.test(sheet));
assert.ok(/--brand-1: #0A66C2/.test(S.cssVars(b)));
console.log("spy tests passed");
