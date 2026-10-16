/* Pulls brand colours, fonts and a logo candidate out of a page's HTML and CSS text. Works in Node and in the browser. */
(function (root) {
  var C = typeof module !== "undefined" && module.exports ? require("./color.js") : root.SpyColor;
  var GENERIC = /^(inherit|initial|unset|serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|-apple-system|blinkmacsystemfont|emoji|math|fangsong|segoe ui|roboto|helvetica neue|helvetica|arial|times new roman|times|courier new|courier|georgia|verdana|tahoma|trebuchet ms|lucida grande|lucida sans unicode|noto sans|apple color emoji|segoe ui emoji|segoe ui symbol|noto color emoji|oxygen|ubuntu|cantarell|fira sans|droid sans|open sans|menlo|monaco|consolas|sfmono-regular|sf mono|liberation mono|var)$/i;

  function stripComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, " "); }
  function colorsIn(text) {
    var out = [], m, re = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:\s*[,/]\s*([\d.]+%?))?\s*\)|hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/gi;
    while ((m = re.exec(text))) {
      var rgb = null, alpha = 1;
      if (m[1]) { rgb = C.hexToRgb(m[1]); if (m[1].length === 8) alpha = parseInt(m[1].slice(6), 16) / 255; else if (m[1].length === 4) alpha = parseInt(m[1][3] + m[1][3], 16) / 255; }
      else if (m[2] !== undefined) { rgb = [+m[2], +m[3], +m[4]]; if (m[5] !== undefined) alpha = /%$/.test(m[5]) ? parseFloat(m[5]) / 100 : parseFloat(m[5]); }
      else rgb = C.hslToRgb(+m[6], +m[7], +m[8]);
      if (rgb && rgb.every(function (v) { return v >= 0 && v <= 255; }) && alpha >= 0.5) out.push({ rgb: rgb, index: m.index });
    }
    return out;
  }
  // Colours used in declarations that matter for a brand: background, fill, button, link, accents, custom properties.
  function weightFor(prefix) {
    if (/--[\w-]*(primary|brand|accent|main|theme|cta)/i.test(prefix)) return 6;
    if (/--/.test(prefix)) return 2;
    if (/(background(-color)?|fill|stroke|border-color)\s*:\s*$/i.test(prefix)) return 2;
    if (/(^|[^-\w])color\s*:\s*$/i.test(prefix)) return 1;
    return 1;
  }
  function analyseColors(css, extra) {
    var map = {}, text = stripComments(css), meta = (extra || []).slice();
    colorsIn(text).forEach(function (c) {
      var pre = text.slice(Math.max(0, c.index - 40), c.index), w = weightFor(pre), k = C.rgbToHex(c.rgb);
      map[k] = map[k] || { rgb: c.rgb, count: 0, score: 0 }; map[k].count++; map[k].score += w;
    });
    meta.forEach(function (rgb) { var k = C.rgbToHex(rgb); map[k] = map[k] || { rgb: rgb, count: 0, score: 0 }; map[k].count += 3; map[k].score += 12; });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    // merge near-identical colours (#0A66C2 vs #0A67C3) into the more frequent one
    list.sort(function (a, b) { return b.score - a.score; });
    var merged = [];
    list.forEach(function (c) { var m = merged.filter(function (x) { return C.deltaE(x.rgb, c.rgb) < 6; })[0]; if (m) { m.count += c.count; m.score += c.score; } else merged.push({ rgb: c.rgb, count: c.count, score: c.score }); });
    var neutrals = [], brand = [];
    merged.forEach(function (c) {
      var d = C.describe(c.rgb); d.count = c.count; d.score = c.score;
      var hsl = d.hsl, ch = C.chroma(c.rgb);
      if (ch < 12 || hsl[1] < 8) neutrals.push(d); else { d.chroma = Math.round(ch); brand.push(d); }
    });
    // brand score: how often it is used, boosted by saturation, so a loud blue beats a faint tint used once more
    brand.forEach(function (d) { d.rank = d.score * (0.6 + Math.min(d.chroma, 90) / 90); });
    brand.sort(function (a, b) { return b.rank - a.rank; });
    neutrals.sort(function (a, b) { return b.score - a.score; });
    return { brand: brand.slice(0, 8), neutrals: neutrals.slice(0, 6) };
  }

  function fontsIn(css, html) {
    var text = stripComments(css), map = {}, m, re = /font-family\s*:\s*([^;}{]+)/gi, order = 0;
    function add(name, w, source) {
      name = name.replace(/!important/i, "").replace(/^["'\s]+|["'\s]+$/g, "").trim();
      if (!name || name.length > 40 || /^[-\d.]|\(|var\b|\\|^(normal|bold|bolder|lighter|italic|\d)/i.test(name) || /^[\d.]+(px|em|rem|%)/.test(name)) return;
      var k = name.toLowerCase(); map[k] = map[k] || { family: name, count: 0, generic: GENERIC.test(name), source: source, order: order++ }; map[k].count += w;
      if (source === "google" || source === "font-face") map[k].source = source;
    }
    while ((m = re.exec(text))) { var parts = m[1].split(","); parts.forEach(function (p, i) { add(p, i === 0 ? 3 : 1, "css"); }); }
    re = /--[\w-]*font[\w-]*\s*:\s*([^;}{]+)/gi; while ((m = re.exec(text))) m[1].split(",").forEach(function (p, i) { add(p, i === 0 ? 2 : 1, "css"); });
    re = /@font-face\s*{[^}]*font-family\s*:\s*([^;}]+)/gi; while ((m = re.exec(text))) add(m[1], 4, "font-face");
    var g = /fonts\.googleapis\.com\/css2?\?([^"'<>\s)]+)/gi, q;
    var blob = html + " " + text;
    while ((q = g.exec(blob))) { var fam = /family=([^&:;]+)/g, f; while ((f = fam.exec(q[1].replace(/&amp;/g, "&")))) add(decodeURIComponent(f[1]).replace(/\+/g, " "), 6, "google"); }
    var list = Object.keys(map).map(function (k) { return map[k]; });
    // CircularSp, CircularSp-Arab, CircularSp-Deva ... are one family: keep the shortest name and add up the counts
    list.sort(function (a, b) { return a.family.length - b.family.length; });
    var grouped = []; list.forEach(function (f) { var base = grouped.filter(function (g) { return f.family.toLowerCase().indexOf(g.family.toLowerCase() + "-") === 0; })[0]; if (base) { base.count += f.count; if (f.source === "google" || f.source === "font-face") base.source = f.source; } else grouped.push(f); });
    list = grouped;
    var named = list.filter(function (f) { return !f.generic; }).sort(function (a, b) { return b.count - a.count || a.order - b.order; });
    return { fonts: named.slice(0, 6), generic: list.filter(function (f) { return f.generic; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 3) };
  }
  function attr(tag, name) { var m = new RegExp("\\b" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')", "i").exec(tag); return m ? (m[1] !== undefined ? m[1] : m[2]) : ""; }
  function absolute(u, base) { try { return new URL(u, base).href; } catch (e) { return u; } }
  function pageInfo(html, base) {
    var info = { title: "", description: "", themeColor: null, logo: "", icon: "", ogImage: "", stylesheets: [] }, m;
    m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html); if (m) info.title = m[1].replace(/\s+/g, " ").trim();
    (html.match(/<meta\b[^>]*>/gi) || []).forEach(function (t) {
      var n = (attr(t, "name") || attr(t, "property")).toLowerCase(), c = attr(t, "content");
      if (n === "theme-color" && c) { var cs = colorsIn(c); if (cs[0]) info.themeColor = cs[0].rgb; }
      if (n === "msapplication-tilecolor" && c && !info.themeColor) { var t2 = colorsIn(c); if (t2[0]) info.tile = t2[0].rgb; }
      if (n === "description" || n === "og:description") info.description = info.description || c;
      if (n === "og:image" && c) info.ogImage = absolute(c, base);
    });
    (html.match(/<link\b[^>]*>/gi) || []).forEach(function (t) {
      var rel = attr(t, "rel").toLowerCase(), href = attr(t, "href"); if (!href) return;
      if (/stylesheet/.test(rel)) info.stylesheets.push(absolute(href, base));
      if (/apple-touch-icon/.test(rel)) info.icon = absolute(href, base);
      else if (/\bicon\b/.test(rel) && !info.icon) info.icon = absolute(href, base);
    });
    (html.match(/<img\b[^>]*>/gi) || []).forEach(function (t) { if (!info.logo && /logo/i.test(attr(t, "src") + " " + attr(t, "alt") + " " + attr(t, "class") + " " + attr(t, "id"))) { var s = attr(t, "src"); if (s && !/^data:/.test(s)) info.logo = absolute(s, base); } });
    return info;
  }
  function inlineCss(html) {
    var out = [], m, re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi; while ((m = re.exec(html))) out.push(m[1]);
    (html.match(/\bstyle\s*=\s*"[^"]*"/gi) || []).forEach(function (s) { out.push("x{" + s.replace(/^style\s*=\s*"/i, "").replace(/"$/, "") + "}"); });
    return out.join("\n");
  }
  // html: page source; cssTexts: array of stylesheet bodies. Returns the brand description.
  function extract(html, cssTexts, base) {
    var info = pageInfo(html, base || ""), css = inlineCss(html) + "\n" + (cssTexts || []).join("\n");
    var extra = []; if (info.themeColor) extra.push(info.themeColor); if (info.tile) extra.push(info.tile);
    var colors = analyseColors(css, extra), fonts = fontsIn(css, html);
    return { url: base || "", title: info.title, description: info.description, themeColor: info.themeColor ? C.rgbToHex(info.themeColor) : null, logo: info.logo, icon: info.icon, ogImage: info.ogImage, stylesheets: info.stylesheets, colors: colors, fonts: fonts.fonts, genericFonts: fonts.generic };
  }
  var api = { extract: extract, analyseColors: analyseColors, fontsIn: fontsIn, pageInfo: pageInfo, colorsIn: colorsIn };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SpyExtract = api;
})(typeof window !== "undefined" ? window : this);
