/* Turns a brand description (from extract.js, or built from an image palette) into a standalone brand sheet and CSS variables. */
(function (root) {
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function aa(r) { return r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "AA large" : "fail"; }
  function swatch(c, big) {
    var rgb = c.rgb.join(", "), hsl = c.hsl[0] + ", " + c.hsl[1] + "%, " + c.hsl[2] + "%";
    return '<div class="sw' + (big ? " big" : "") + '"><div class="chip" style="background:' + esc(c.hex) + ';color:' + esc(c.text) + '"><b>' + esc(c.name) + '</b><span>' + esc(c.hex) + '</span></div>' +
      '<dl><dt>RGB</dt><dd>' + rgb + '</dd><dt>HSL</dt><dd>' + hsl + '</dd><dt>White text</dt><dd>' + c.onWhite + ':1 ' + aa(c.onWhite) + '</dd><dt>Black text</dt><dd>' + c.onBlack + ':1 ' + aa(c.onBlack) + '</dd></dl></div>';
  }
  function gfonts(brand) {
    var g = (brand.fonts || []).filter(function (f) { return f.source === "google"; }).slice(0, 3);
    return g.length ? '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' + g.map(function (f) { return "family=" + encodeURIComponent(f.family).replace(/%20/g, "+"); }).join("&") + '&display=swap">' : "";
  }
  function sheetHtml(brand, opts) {
    opts = opts || {}; var cols = brand.colors || { brand: [], neutrals: [] }, name = brand.title || brand.url || "Brand sheet";
    var h = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(name) + ' - brand sheet</title>' + gfonts(brand) + '<style>' +
      ':root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#000;color:#f2f2f2;font:15px/1.5 system-ui,Segoe UI,Arial,sans-serif;padding:40px 5vw}' +
      'h1{font-size:28px;margin:0 0 4px}h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8a8a8a;margin:40px 0 14px;font-weight:600}.top{display:flex;gap:20px;align-items:center}.top img{max-height:64px;max-width:160px;background:#fff;border-radius:8px;padding:6px}' +
      '.sub{color:#8a8a8a;font-size:13px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}.sw{border:1px solid #222;border-radius:10px;overflow:hidden;background:#0a0a0a}.chip{height:110px;padding:12px;display:flex;flex-direction:column;justify-content:flex-end}.big .chip{height:150px}.chip b{font-size:15px}.chip span{font:13px ui-monospace,Consolas,monospace;opacity:.9}' +
      'dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:0;padding:10px 12px;font-size:12px}dt{color:#8a8a8a}dd{margin:0;text-align:right}.fonts{display:grid;gap:12px}.font{border:1px solid #222;border-radius:10px;padding:16px 18px;background:#0a0a0a}.font small{color:#8a8a8a;font-size:12px}.font .s{font-size:30px;line-height:1.2;margin:6px 0}.font .p{color:#cfcfcf;font-size:15px}' +
      'pre{background:#0a0a0a;border:1px solid #222;border-radius:10px;padding:14px;overflow:auto;font-size:12.5px}footer{margin-top:48px;color:#666;font-size:12px}</style></head><body>';
    h += '<div class="top">' + (opts.logoData ? '<img src="' + esc(opts.logoData) + '" alt="">' : "") + '<div><h1>' + esc(name) + '</h1><div class="sub">' + esc(brand.url || "") + (brand.description ? " &middot; " + esc(brand.description).slice(0, 140) : "") + '</div></div></div>';
    h += '<h2>Brand colours</h2><div class="grid">' + (cols.brand.length ? cols.brand.slice(0, 8).map(function (c, i) { return swatch(c, i < 2); }).join("") : '<p class="sub">No strong brand colours found.</p>') + '</div>';
    if (cols.neutrals.length) h += '<h2>Neutrals</h2><div class="grid">' + cols.neutrals.map(function (c) { return swatch(c, false); }).join("") + '</div>';
    if (brand.fonts && brand.fonts.length) {
      h += '<h2>Fonts</h2><div class="fonts">' + brand.fonts.slice(0, 4).map(function (f) { return '<div class="font"><small>' + esc(f.source === "google" ? "Google Fonts" : f.source === "font-face" ? "Custom font on the site" : "Used in the site CSS") + '</small><div class="s" style="font-family:\'' + esc(f.family) + '\',sans-serif">' + esc(f.family) + '</div><div class="p" style="font-family:\'' + esc(f.family) + '\',sans-serif">The quick brown fox jumps over the lazy dog. 0123456789</div></div>'; }).join("") + '</div>';
    }
    h += '<h2>CSS variables</h2><pre>' + esc(cssVars(brand)) + '</pre><footer>Made with Brand Palette Spy. Colours are read from the site\'s own CSS, so check them against the official brand guidelines before using them in client work.</footer></body></html>';
    return h;
  }
  function cssVars(brand) {
    var cols = brand.colors || { brand: [], neutrals: [] }, l = [":root {"];
    cols.brand.slice(0, 6).forEach(function (c, i) { l.push("  --brand-" + (i + 1) + ": " + c.hex + ";  /* " + c.name + " */"); });
    cols.neutrals.slice(0, 4).forEach(function (c, i) { l.push("  --neutral-" + (i + 1) + ": " + c.hex + ";"); });
    (brand.fonts || []).slice(0, 2).forEach(function (f, i) { l.push("  --font-" + (i + 1) + ": '" + f.family + "', sans-serif;"); });
    l.push("}"); return l.join("\n");
  }
  var api = { sheetHtml: sheetHtml, cssVars: cssVars, esc: esc };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SpySheet = api;
})(typeof window !== "undefined" ? window : this);
