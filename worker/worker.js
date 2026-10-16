// Brand Palette Spy helper. A tiny Cloudflare Worker that fetches a public web page and its
// stylesheets for the app, because a browser page can't read other sites by itself.
// It returns raw HTML and CSS only. The app reads the colours and fonts on your machine.
const ALLOW = ["https://krshnaprsad.github.io", "http://localhost:8000", "http://127.0.0.1:8000", "http://localhost:8080"];
const PAGE_MAX = 1500000, CSS_MAX = 600000, IMG_MAX = 300000, FONT_MAX = 3000000, MAX_CSS = 8, MAX_REDIRECTS = 4, TIMEOUT = 8000;
const PER_IP = 20, PER_IP_WINDOW = 10 * 60 * 1000, GLOBAL = 1500, GLOBAL_WINDOW = 60 * 60 * 1000;
const UA = "Mozilla/5.0 (compatible; BrandPaletteSpy/1.0; +https://github.com/krshnaprsad/brand-palette-spy)";
const hits = new Map(); let gHits = [];

function cors(req) { const o = req.headers.get("origin"); return { "access-control-allow-origin": ALLOW.includes(o) ? o : ALLOW[0], "vary": "origin", "cache-control": "no-store" }; }
function json(req, obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ "content-type": "application/json" }, cors(req)) }); }
function limited(ip) {
  const now = Date.now();
  gHits = gHits.filter(t => now - t < GLOBAL_WINDOW); if (gHits.length >= GLOBAL) return true;
  const a = (hits.get(ip) || []).filter(t => now - t < PER_IP_WINDOW); if (a.length >= PER_IP) { hits.set(ip, a); return true; }
  a.push(now); hits.set(ip, a); gHits.push(now);
  if (hits.size > 5000) hits.clear();
  return false;
}
function blockedHost(h) {
  h = h.toLowerCase().replace(/\.$/, "");
  if (!h || h === "localhost" || /\.(local|localhost|internal|lan|home|corp|intranet)$/.test(h)) return true;
  if (h.indexOf(":") >= 0 || h[0] === "[") return true;                     // no IPv6 literals
  if (/^\d+$/.test(h) || /^0x/i.test(h)) return true;                        // decimal or hex IP tricks
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [+m[1], +m[2]];
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return true;
  }
  return !/^[a-z0-9.-]+$/.test(h) || h.indexOf(".") < 0;
}
function check(u) {
  let x; try { x = new URL(u); } catch (e) { throw new Error("That is not a valid address."); }
  if (!/^https?:$/.test(x.protocol)) throw new Error("Only http and https addresses.");
  if (x.username || x.password) throw new Error("Addresses with a login are not allowed.");
  if (x.port && x.port !== "80" && x.port !== "443") throw new Error("Only the normal web ports.");
  if (blockedHost(x.hostname)) throw new Error("That address is not allowed.");
  return x;
}
async function grab(u, max, wantBuf) {
  let cur = check(u).href;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), TIMEOUT);
    let r;
    try { r = await fetch(cur, { headers: { "user-agent": UA, accept: "text/html,text/css,image/*,*/*;q=0.8" }, redirect: "manual", signal: ctl.signal }); }
    catch (e) { clearTimeout(t); throw new Error("Could not reach that site."); }
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { clearTimeout(t); cur = check(new URL(r.headers.get("location"), cur).href).href; continue; }
    if (!r.ok) { clearTimeout(t); throw new Error("The site answered with HTTP " + r.status + "."); }
    // read at most `max` bytes, then stop
    const rd = r.body.getReader(), parts = []; let n = 0;
    try { for (;;) { const c = await rd.read(); if (c.done) break; parts.push(c.value); n += c.value.length; if (n > max) { await rd.cancel(); break; } } }
    finally { clearTimeout(t); }
    const buf = new Uint8Array(Math.min(n, max)); let o = 0;
    for (const p of parts) { const take = Math.min(p.length, buf.length - o); if (take <= 0) break; buf.set(p.subarray(0, take), o); o += take; }
    return { url: cur, type: r.headers.get("content-type") || "", buf, truncated: n > max };
  }
  throw new Error("Too many redirects.");
}
const text = b => new TextDecoder("utf-8").decode(b.buf);
function b64(buf) { let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); }

// Looks for a brand guideline or brand assets page. Only pages that really load and really mention it are returned.
const PATHS = ["/brand", "/brand-guidelines", "/brand-assets", "/brand-kit", "/brand-resources", "/brand-center", "/press", "/press-kit", "/media-kit", "/styleguide", "/style-guide", "/about/brand", "/company/brand", "/brand/guidelines", "/press/brand"];
const KW = /\bbrand|style[\s-]*guide|\bguidelines|\bpress\b|media[\s-]*kit|\bidentity|\blogos?\b/i;
const GUIDE = /guideline|brand[\s-]*book|style[\s-]*guide|identity|brand[\s-]*(center|centre|portal|hub)|^brand$/i;
const ent = t => t.replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const titleOf = h => { const m = h.match(/<title[^>]*>([\s\S]*?)<\/title>/i); return m ? ent(m[1].replace(/\s+/g, " ").trim()) : ""; };
const h1Of = h => { const m = h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i); return m ? m[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().replace(/&amp;/g, "&") : ""; };
async function probe(u, home) {
  try {
    const g = await grab(u, 150000), isPdf = String.fromCharCode(g.buf[0], g.buf[1], g.buf[2], g.buf[3]) === "%PDF";
    const x = new URL(g.url), reg = h => h.split(".").slice(-2).join(".");
    if (reg(x.hostname) !== reg(new URL(u).hostname)) return null;
    if (isPdf) return { url: g.url, label: decodeURIComponent(x.pathname.split("/").pop() || "Brand PDF").replace(/\.pdf$/i, "").replace(/[-_]+/g, " "), pdf: true, guide: GUIDE.test(x.pathname.replace(/[-_]/g, " ")) || /guideline/i.test(x.pathname) };
    if (!/html/i.test(g.type)) return null;
    if (x.pathname === "/" || x.pathname === "") return null;
    const h = text(g), t = titleOf(h), h1 = h1Of(h);
    if (/not found|404|page (doesn.t|does not) exist|can.t be found/i.test(t + " " + h1)) return null;
    if (home && t && t === home.title && home.title.length > 3) return null;
    if (!KW.test(t + " " + h1)) return null;
    if (/<meta[^>]+property=["']og:type["'][^>]+content=["'](profile|object)["']/i.test(h) || /<meta[^>]+content=["'](profile|object)["'][^>]+property=["']og:type["']/i.test(h)) return null;
    const label = (h1 && h1.length < 70 ? h1 : t || x.pathname).slice(0, 70);
    return { url: g.url, label: label, pdf: false, guide: GUIDE.test(t + " " + h1 + " " + x.pathname.replace(/[-_]/g, " ")) };
  } catch (e) { return null; }
}
async function findGuides(site, extra) {
  const root = check(site), origin = root.origin;
  let home = null; try { const hp = await grab(origin + "/", 400000); home = { title: titleOf(text(hp)) }; } catch (e) {}
  const cands = []; const add = u => { try { const h = check(new URL(u, origin).href).href; if (cands.indexOf(h) < 0 && cands.length < 28) cands.push(h); } catch (e) {} };
  extra.slice(0, 6).forEach(add); PATHS.forEach(p => add(origin + p));
  try { const sm = text(await grab(origin + "/sitemap.xml", 400000)); const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi; let m, n = 0; while ((m = re.exec(sm)) && n < 4) { let path = ""; try { path = new URL(m[1]).pathname; } catch (e) { continue; } if (/(^|\/)(brand(-?(assets|guidelines|kit|center|centre|resources|book|identity))?|press-?kit|media-?kit|style-?guide)\/?$/i.test(path)) { add(m[1]); n++; } } } catch (e) {}
  const res = await Promise.all(cands.map(u => probe(u, home))), seen = {}, out = [];
  res.forEach(r => { if (r && !seen[r.url]) { seen[r.url] = 1; out.push(r); } });
  out.sort((a, b) => (b.guide ? 1 : 0) - (a.guide ? 1 : 0));
  return { site: origin, checked: cands.length, found: out.slice(0, 6) };
}

export default {
  async fetch(req) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: Object.assign({ "access-control-allow-methods": "GET", "access-control-max-age": "86400" }, cors(req)) });
    if (req.method !== "GET") return json(req, { error: "GET only." }, 405);
    const origin = req.headers.get("origin");
    if (origin && !ALLOW.includes(origin)) return json(req, { error: "This helper only works with the Brand Palette Spy app." }, 403);
    const q = new URL(req.url).searchParams, ip = req.headers.get("cf-connecting-ip") || "x";
    if (!q.get("url") && !q.get("img") && !q.get("font") && !q.get("guide")) return json(req, { ok: true, name: "brand-palette-spy helper" });
    if (limited(ip)) return json(req, { error: "Too many requests. Try again in a few minutes." }, 429);
    try {
      if (q.get("guide")) return json(req, await findGuides(q.get("guide"), q.getAll("l")));
      if (q.get("font")) {
        // pass-through only: the bytes go straight to the visitor's browser and nothing is kept here
        const g = await grab(q.get("font"), FONT_MAX + 1);
        const m4 = String.fromCharCode(g.buf[0] || 0, g.buf[1] || 0, g.buf[2] || 0, g.buf[3] || 0);
        const isFont = m4 === "wOF2" || m4 === "wOFF" || m4 === "OTTO" || m4 === "true" || m4 === "\u0000\u0001\u0000\u0000";
        if (g.truncated || !isFont) return json(req, { error: "That is not a font file I can pass on." }, 415);
        return new Response(g.buf, { headers: Object.assign({ "content-type": "application/octet-stream" }, cors(req)) });
      }
      if (q.get("img")) {
        const g = await grab(q.get("img"), IMG_MAX + 1);
        const type = g.type.split(";")[0].trim().toLowerCase();
        if (g.truncated || !/^image\/(png|jpe?g|gif|webp|svg\+xml|x-icon|vnd\.microsoft\.icon)$/.test(type)) return json(req, { error: "No usable image." }, 415);
        return json(req, { dataUri: "data:" + type + ";base64," + b64(g.buf) });
      }
      const page = await grab(q.get("url"), PAGE_MAX);
      if (!/html|xml/i.test(page.type) && page.type) return json(req, { error: "That address is not a web page." }, 415);
      const html = text(page), links = [];
      const re = /<link\b[^>]*>/gi; let m;
      while ((m = re.exec(html)) && links.length < MAX_CSS) {
        if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(m[0])) continue;
        const h = m[0].match(/href\s*=\s*["']?([^"'\s>]+)/i); if (!h) continue;
        try { const u = new URL(h[1].replace(/&amp;/g, "&"), page.url).href; if (links.indexOf(u) < 0) links.push(u); } catch (e) {}
      }
      const styles = [];
      await Promise.all(links.map(async (u, i) => { try { const c = await grab(u, CSS_MAX); styles[i] = text(c); } catch (e) { styles[i] = ""; } }));
      return json(req, { url: page.url, html: html, sheets: links.map((u, i) => ({ url: u, css: styles[i] })).filter(x => x.css), stylesheets: links, truncated: page.truncated });
    } catch (e) { return json(req, { error: e.message || "Something went wrong." }, 400); }
  }
};
