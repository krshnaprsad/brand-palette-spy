/* Pulls brand colours, fonts and a logo candidate out of a page's HTML and CSS text. Works in Node and in the browser. */
(function (root) {
  var C = typeof module !== "undefined" && module.exports ? require("./color.js") : root.SpyColor;
  var GENERIC = /(^.* fallback$)|^(inherit|initial|unset|serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|-apple-system|blinkmacsystemfont|emoji|math|fangsong|segoe ui|roboto|helvetica neue|helvetica|arial|times new roman|times|courier new|courier|georgia|verdana|tahoma|trebuchet ms|lucida grande|lucida sans unicode|noto sans|apple color emoji|segoe ui emoji|segoe ui symbol|noto color emoji|oxygen|ubuntu|cantarell|fira sans|droid sans|open sans|menlo|monaco|consolas|sfmono-regular|sf mono|liberation mono|var)$/i;

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
  // ---- what is actually used on the page ----
  function unesc(t) { return t.replace(/\\(.)/g, "$1"); }
  function htmlTokens(html) {
    var cls = {}, ids = {}, m, re = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
    while ((m = re.exec(html))) (m[1] || m[2] || "").split(/\s+/).forEach(function (c) { if (c) cls[c] = (cls[c] || 0) + 1; });
    re = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)')/gi; while ((m = re.exec(html))) ids[m[1] || m[2]] = 1;
    var tags = {}; (html.match(/<([a-z][\w-]*)/gi) || []).forEach(function (t) { tags[t.slice(1).toLowerCase()] = 1; });
    return { cls: cls, ids: ids, tags: tags };
  }
  // flat list of {sel, body}; keyframes, font-face and other at-rule bodies are skipped
  function parseRules(css) {
    var out = [], i = 0, start = 0, n = css.length;
    while (i < n) {
      var ch = css.charCodeAt(i);
      if (ch === 123) { // {
        var pre = css.slice(start, i).trim(), depth = 1, j = i + 1;
        if (pre.charAt(0) === "@" && /^@(media|supports|layer|container|document)\b/i.test(pre)) { i++; start = i; continue; }
        while (j < n && depth) { var cc = css.charCodeAt(j); if (cc === 123) depth++; else if (cc === 125) depth--; j++; }
        if (pre.charAt(0) !== "@") out.push({ sel: pre, body: css.slice(i + 1, j - 1) });
        i = j; start = i; continue;
      }
      if (ch === 125 || ch === 59) start = i + 1;   // } or ;
      i++;
    }
    return out;
  }
  // 0 if the rule points at classes or ids that are not on the page, otherwise a weight from how often they appear
  function ruleUse(sel, tok) {
    var best = 0, parts = sel.split(",");
    for (var p = 0; p < parts.length; p++) {
      var s = parts[p].replace(/:(not|is|where|has)\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, ""), re = /([.#])((?:\\.|[\w-])+)/g, m, ok = true, top = 1;
      while ((m = re.exec(s))) { var name = unesc(m[2]); if (m[1] === ".") { if (!tok.cls[name]) { ok = false; break; } top = Math.max(top, tok.cls[name]); } else if (!tok.ids[name]) { ok = false; break; } }
      if (ok) { var tg = s.replace(/([.#])((?:\\.|[\w-])+)/g, " ").replace(/::?[\w-]+(\([^)]*\))?/g, " ").match(/(^|[\s>+~])[a-z][\w-]*/gi) || []; tg.forEach(function (t) { t = t.replace(/^[\s>+~]/, "").toLowerCase(); if (t !== "html" && t !== "body" && !tok.tags[t]) ok = false; }); }
      if (ok) best = Math.max(best, 1 + Math.min(2, Math.log(top) / Math.LN10));
    }
    return best;
  }
  function usesLabels(prefix, sel) {
    var out = [];
    if (/(background(-color)?|background-image)\s*:\s*$/i.test(prefix)) out.push("backgrounds");
    else if (/(^|[^-\w])color\s*:\s*$/i.test(prefix)) out.push("text");
    else if (/(border(-\w+)*(-color)?|outline(-color)?)\s*:\s*$/i.test(prefix)) out.push("borders");
    else if (/(fill|stroke)\s*:\s*$/i.test(prefix)) out.push("icons and graphics");
    if (/btn|button|cta/i.test(sel)) out.push("buttons");
    if (/(^|[\s>,+~])a([\s.:#\[,>+~]|$)|link/i.test(sel)) out.push("links");
    if (/logo|brand/i.test(sel)) out.push("logo");
    return out;
  }
  function analyseColors(css, extra, html) {
    var map = {}, text = stripComments(css), meta = (extra || []).slice();
    function put(rgb, w, labels) {
      var k = C.rgbToHex(rgb); map[k] = map[k] || { rgb: rgb, count: 0, score: 0, uses: {} };
      map[k].count++; map[k].score += w; (labels || []).forEach(function (l) { map[k].uses[l] = (map[k].uses[l] || 0) + w; });
    }
    var tok = html ? htmlTokens(html) : null, usedRules = null;
    if (tok && Object.keys(tok.cls).length) {
      usedRules = []; var refs = {};
      parseRules(text).forEach(function (r) { var u = ruleUse(r.sel, tok); if (u) { usedRules.push({ sel: r.sel, body: r.body, mult: u }); (r.body.match(/var\(\s*--[\w-]+/g) || []).forEach(function (v) { refs[v.replace(/var\(\s*/, "")] = 1; }); } });
      (html.match(/var\(\s*--[\w-]+/g) || []).forEach(function (v) { refs[v.replace(/var\(\s*/, "")] = 1; });
      // where each custom property is read: "background: var(--x)" means --x is a background colour
      var varLabels = {};
      usedRules.forEach(function (r) { var re = /([\w-]+)\s*:\s*[^;{}]*?var\(\s*(--[\w-]+)/g, m; while ((m = re.exec(r.body))) { if (m[1].indexOf("--") === 0) continue; (varLabels[m[2]] = varLabels[m[2]] || []).push.apply(varLabels[m[2]], usesLabels(m[1] + ":", r.sel)); } });
      usedRules.forEach(function (r) {
        var body = r.body.replace(/(^|[;{\s])(--[\w-]+)\s*:\s*([^;]*)/g, function (all, pre, name, val) {
          if (refs[name]) colorsIn(val).forEach(function (c) { var direct = varLabels[name] && varLabels[name].length; put(c.rgb, weightFor(name + ":") * r.mult * (direct ? 1 : 0.25), direct ? varLabels[name] : ["theme variable"]); });
          return pre + "x:0";
        });
        colorsIn(body).forEach(function (c) { var pre = body.slice(Math.max(0, c.index - 40), c.index); put(c.rgb, weightFor(pre) * r.mult, usesLabels(pre, r.sel)); });
      });
      if (Object.keys(map).length < 3) { map = {}; usedRules = null; }
    }
    if (!usedRules) colorsIn(text).forEach(function (c) { var pre = text.slice(Math.max(0, c.index - 40), c.index); put(c.rgb, weightFor(pre), usesLabels(pre, "")); });
    meta.forEach(function (rgb) { put(rgb, 12, ["theme colour"]); map[C.rgbToHex(rgb)].count += 2; });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    // merge near-identical colours (#0A66C2 vs #0A67C3) into the more frequent one
    list.sort(function (a, b) { return b.score - a.score; });
    var merged = [];
    list.forEach(function (c) { var m = merged.filter(function (x) { return C.deltaE(x.rgb, c.rgb) < 6; })[0]; if (m) { m.count += c.count; m.score += c.score; Object.keys(c.uses).forEach(function (l) { m.uses[l] = (m.uses[l] || 0) + c.uses[l]; }); } else merged.push({ rgb: c.rgb, uses: c.uses, count: c.count, score: c.score }); });
    var neutrals = [], brand = [];
    merged.forEach(function (c) {
      var d = C.describe(c.rgb); d.count = c.count; d.score = c.score; d.uses = Object.keys(c.uses || {}).sort(function (a, b) { return c.uses[b] - c.uses[a]; }).slice(0, 3);
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
      if (!name || name.length > 40 || !/^[A-Za-z][A-Za-z0-9 ._-]*$/.test(name) || /^[-\d.]|\(|var\b|\\|^(normal|bold|bolder|lighter|italic|\d)/i.test(name) || /^[\d.]+(px|em|rem|%)/.test(name)) return;
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
  function attr(tag, name) { var m = new RegExp("\\b" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')", "i").exec(tag); return m ? (m[1] !== undefined ? m[1] : m[2]).replace(/&amp;/g, "&") : ""; }
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
      if (/\bicon\b/.test(rel)) {
        // best own icon: apple-touch-icon, then the biggest declared size, then svg, then whatever is left (.ico last)
        var sz = parseInt((attr(t, "sizes").match(/\d+/) || [0])[0], 10) || 0, u = absolute(href, base);
        var score = (/apple-touch-icon/.test(rel) ? 1000 : 0) + sz + (/\.svg(\?|$)/i.test(u) ? 500 : 0) + (/\.png(\?|$)/i.test(u) ? 50 : 0) - (/\.ico(\?|$)/i.test(u) ? 40 : 0);
        if (score > (info.iconScore === undefined ? -1e9 : info.iconScore)) { info.icon = u; info.iconScore = score; }
      }
    });
    // the site's own logo: only an image inside the page header or nav, never partner, customer or press logos
    var NOT = /customer|partner|client|sponsor|trusted|testimonial|press|featured|brands?-|case-?stud|integration|award|logos?-(wall|grid|strip|cloud)|logo-?(wall|grid|strip|cloud)/i;
    var blocks = (html.match(/<header\b[\s\S]*?<\/header>|<nav\b[\s\S]*?<\/nav>/gi) || []).join(" ");
    (blocks.match(/<img\b[^>]*>/gi) || []).forEach(function (t) {
      var meta = attr(t, "src") + " " + attr(t, "alt") + " " + attr(t, "class") + " " + attr(t, "id");
      if (!info.logo && /logo/i.test(meta) && !NOT.test(meta)) { var s = attr(t, "src"); if (s && !/^data:/.test(s)) info.logo = absolute(s, base); }
    });
    delete info.iconScore;
    // links the site itself offers for brand assets, press kits and fonts
    var BL = /brand[\s-]*(assets?|guidelines?|kit|resources?|center|centre|portal|identity|book)|(press|media|logo|design)[\s-]*(kit|assets?|resources?)|style[\s-]*guide|download[^<]{0,20}fonts?|fonts?[^<]{0,20}download|our fonts?|typefaces?|brand\b/i;
    var seen = {}; info.brandLinks = [];
    (html.match(/<a\b[^>]*>[\s\S]{0,300}?<\/a>/gi) || []).forEach(function (t) {
      if (info.brandLinks.length >= 4) return;
      var href = attr(t, "href"); if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) return;
      var label = t.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 60), hay = label + " " + href;
      if (!BL.test(hay) || label.length < 2 || /\b(rebrand|branded|brand-?safe|brandon)\b/i.test(hay)) return;
      var u = absolute(href, base); if (seen[u] || !/^https?:/i.test(u)) return; seen[u] = 1;
      info.brandLinks.push({ label: label, url: u, file: /\.(zip|otf|ttf|woff2?|pdf)(\?|$)/i.test(u) });
    });
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
    var colors = analyseColors(css, extra, html), fonts = fontsIn(css, html);
    return { url: base || "", title: info.title, description: info.description, themeColor: info.themeColor ? C.rgbToHex(info.themeColor) : null, logo: info.logo, icon: info.icon, ogImage: info.ogImage, brandLinks: info.brandLinks, stylesheets: info.stylesheets, colors: colors, fonts: fonts.fonts, genericFonts: fonts.generic };
  }
  // font files the page's own @font-face rules point at: {family: [{url, weight, style, ext}]}
  function fontFaces(sheets) {
    var out = {};
    (sheets || []).forEach(function (sh) {
      var css = stripComments(sh.css || ""), re = /@font-face\s*\{([^}]*)\}/gi, m;
      while ((m = re.exec(css))) {
        var body = m[1], fam = /font-family\s*:\s*([^;]+)/i.exec(body); if (!fam) continue;
        var name = fam[1].replace(/["']/g, "").trim(), weight = (/font-weight\s*:\s*([^;]+)/i.exec(body) || [0, "400"])[1].trim(), style = (/font-style\s*:\s*([^;]+)/i.exec(body) || [0, "normal"])[1].trim();
        var files = [], ur = /url\(\s*["']?([^"')]+?)["']?\s*\)(?:\s*format\(\s*["']?([\w-]+))?/gi, u;
        while ((u = ur.exec(body))) {
          if (/^data:/i.test(u[1])) continue;
          var ext = ((u[1].split(/[?#]/)[0].match(/\.(woff2|woff|ttf|otf)$/i) || [0, (u[2] || "").replace("truetype", "ttf").replace("opentype", "otf")])[1] || "").toLowerCase();
          if (!/^(woff2|woff|ttf|otf)$/.test(ext)) continue;
          files.push({ url: absolute(u[1], sh.url || ""), ext: ext });
        }
        if (!files.length) continue;
        // prefer a file that installs on a computer (ttf, otf), then woff, then woff2
        var rank = { ttf: 0, otf: 0, woff: 1, woff2: 2 }; files.sort(function (a, b) { return rank[a.ext] - rank[b.ext]; });
        var list = out[name.toLowerCase()] = out[name.toLowerCase()] || [];
        if (!list.some(function (x) { return x.url === files[0].url; })) list.push({ url: files[0].url, ext: files[0].ext, weight: weight, style: style });
      }
    });
    return out;
  }
  var api = { fontFaces: fontFaces, extract: extract, analyseColors: analyseColors, fontsIn: fontsIn, pageInfo: pageInfo, colorsIn: colorsIn };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SpyExtract = api;
})(typeof window !== "undefined" ? window : this);
