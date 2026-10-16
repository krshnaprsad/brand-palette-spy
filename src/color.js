/* Colour maths shared by the web page and the command line tool. No dependencies. */
(function (root) {
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hexToRgb(h) {
    h = String(h).trim().replace(/^#/, "");
    if (h.length === 3 || h.length === 4) h = h.split("").map(function (c) { return c + c; }).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    var n = parseInt(h.slice(0, 6), 16); if (isNaN(n)) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(c) { return "#" + c.map(function (v) { return ("0" + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2); }).join("").toUpperCase(); }
  function rgbToHsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
    if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
  }
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    var a = s * Math.min(l, 1 - l);
    function f(n) { var k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }
  function luminance(c) {
    var v = c.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function contrast(a, b) { var la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
  function toLab(c) {
    var v = c.map(function (x) { x /= 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    var X = (v[0] * 0.4124 + v[1] * 0.3576 + v[2] * 0.1805) / 0.95047, Y = v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722, Z = (v[0] * 0.0193 + v[1] * 0.1192 + v[2] * 0.9505) / 1.08883;
    function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
  }
  function deltaE(a, b) { var x = toLab(a), y = toLab(b); return Math.sqrt(Math.pow(x[0] - y[0], 2) + Math.pow(x[1] - y[1], 2) + Math.pow(x[2] - y[2], 2)); }
  function chroma(c) { var l = toLab(c); return Math.sqrt(l[1] * l[1] + l[2] * l[2]); }

  var NAMES = ("Black 000000,White FFFFFF,Charcoal 36454F,Slate 708090,Silver C0C0C0,Light Gray D3D3D3,Gray 808080,Dark Gray 404040,Ivory FFFFF0,Cream FFFDD0,Beige F5F5DC,Sand C2B280,Tan D2B48C,Brown 8B4513,Chocolate 5C3317,Maroon 800000,Burgundy 800020," +
    "Red E32636,Crimson DC143C,Scarlet FF2400,Vermilion E34234,Coral FF7F50,Salmon FA8072,Pink FFC0CB,Hot Pink FF69B4,Magenta FF00FF,Fuchsia C154C1,Rose E8548C,Orange FF8C00,Tangerine F28500,Peach FFE5B4,Amber FFBF00,Gold FFD700,Yellow FFE600,Lemon FFF44F,Mustard E1AD01," +
    "Lime 9ACD32,Chartreuse 7FFF00,Green 2E8B57,Emerald 50C878,Forest Green 228B22,Olive 808000,Mint 98FF98,Teal 008080,Turquoise 40E0D0,Aqua 00FFFF,Cyan 00B7EB,Sky Blue 87CEEB,Azure 007FFF,Blue 1E64F0,Royal Blue 4169E1,Cobalt 0047AB,Navy 000080,Midnight 191970,Indigo 4B0082," +
    "Violet 8F00FF,Purple 800080,Lavender B57EDC,Lilac C8A2C8,Plum 8E4585,Mauve E0B0FF").split(",").map(function (s) { var p = s.split(" "), hex = p.pop(); return { name: p.join(" "), rgb: hexToRgb(hex) }; });
  function nameOf(c) { var best = NAMES[0], bd = 1e9; NAMES.forEach(function (n) { var d = deltaE(c, n.rgb); if (d < bd) { bd = d; best = n; } }); return best.name; }

  // Median cut on RGBA pixel data. Returns [{ rgb, share }] sorted by share, similar colours merged.
  function quantize(data, count, opts) {
    opts = opts || {}; var pts = [], i, step = Math.max(1, Math.floor((data.length / 4) / 40000));
    for (i = 0; i < data.length; i += 4 * step) { if (data[i + 3] < 128) continue; pts.push([data[i], data[i + 1], data[i + 2]]); }
    if (!pts.length) return [];
    var boxes = [pts];
    while (boxes.length < count) {
      var bi = -1, bs = 0;
      boxes.forEach(function (b, k) { if (b.length < 2) return; var sp = range(b).span * Math.sqrt(b.length); if (sp > bs) { bs = sp; bi = k; } });
      if (bi < 0) break;
      var b = boxes[bi], ch = range(b).ch; b.sort(function (p, q) { return p[ch] - q[ch]; });
      var mid = b.length >> 1, j, cut = -1; for (j = 1; j < b.length; j++) if (b[j][ch] !== b[j - 1][ch] && (cut < 0 || Math.abs(j - mid) < Math.abs(cut - mid))) cut = j;
      if (cut > 0) mid = cut;   // split where the value really changes, so flat colours stay whole
      boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid));
    }
    var total = pts.length, out = boxes.map(function (b) {
      var s = [0, 0, 0]; b.forEach(function (p) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; });
      return { rgb: [Math.round(s[0] / b.length), Math.round(s[1] / b.length), Math.round(s[2] / b.length)], share: b.length / total };
    }).sort(function (p, q) { return q.share - p.share; });
    var merged = [], thr = opts.merge || 14;
    out.forEach(function (c) { var m = merged.filter(function (x) { return deltaE(x.rgb, c.rgb) < thr; })[0]; if (m) { var t = m.share + c.share; m.rgb = m.rgb.map(function (v, k) { return Math.round((v * m.share + c.rgb[k] * c.share) / t); }); m.share = t; } else merged.push({ rgb: c.rgb, share: c.share }); });
    return merged.sort(function (p, q) { return q.share - p.share; });
  }
  function range(b) {
    var mn = [255, 255, 255], mx = [0, 0, 0]; b.forEach(function (p) { for (var k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; } });
    var sp = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]], ch = sp[0] >= sp[1] && sp[0] >= sp[2] ? 0 : sp[1] >= sp[2] ? 1 : 2; return { ch: ch, span: sp[ch] };
  }
  // Describe one colour for display and export.
  function describe(c) {
    var hsl = rgbToHsl(c), cw = contrast(c, [255, 255, 255]), cb = contrast(c, [0, 0, 0]);
    return { hex: rgbToHex(c), rgb: c.slice(), hsl: hsl, name: nameOf(c), onWhite: Math.round(cw * 100) / 100, onBlack: Math.round(cb * 100) / 100, text: cw >= cb ? "#FFFFFF" : "#000000" };
  }
  var api = { hexToRgb: hexToRgb, rgbToHex: rgbToHex, rgbToHsl: rgbToHsl, hslToRgb: hslToRgb, luminance: luminance, contrast: contrast, deltaE: deltaE, chroma: chroma, nameOf: nameOf, quantize: quantize, describe: describe };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SpyColor = api;
})(typeof window !== "undefined" ? window : this);
