#!/usr/bin/env node
/* Brand Palette Spy, command line. Usage: node cli/spy.js https://example.com [out-folder] */
const fs = require("fs"), path = require("path");
const E = require("../src/extract.js"), S = require("../src/sheet.js");
const UA = "Mozilla/5.0 (compatible; BrandPaletteSpy/1.0; +https://github.com/krshnaprsad/brand-palette-spy)";
async function get(url, asBuffer) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,text/css,image/*,*/*" }, redirect: "follow", signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    if (asBuffer) return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") || "", url: r.url };
    return { text: (await r.text()).slice(0, 1500000), url: r.url };
  } finally { clearTimeout(t); }
}
async function main() {
  let target = process.argv[2], out = process.argv[3];
  if (!target) { console.log("Usage: node cli/spy.js https://example.com [out-folder]"); process.exit(1); }
  if (!/^https?:\/\//i.test(target)) target = "https://" + target;
  console.log("Reading " + target + " ...");
  const page = await get(target), css = [];
  const info = E.pageInfo(page.text, page.url);
  for (const u of info.stylesheets.slice(0, 8)) { try { const c = await get(u); css.push(c.text); } catch (e) { console.log("  skipped stylesheet " + u + " (" + e.message + ")"); } }
  // @import one level deep
  for (const c of css.slice()) { const re = /@import\s+(?:url\()?["']?([^"')\s;]+)/g; let m, n = 0; while ((m = re.exec(c)) && n++ < 3) { try { css.push((await get(new URL(m[1], page.url).href)).text); } catch (e) {} } }
  const brand = E.extract(page.text, css, page.url);
  let logoData = "";
  for (const cand of [brand.logo, brand.icon, brand.ogImage].filter(Boolean)) {
    try { const g = await get(cand, true); if (/^image\/(png|jpe?g|gif|webp|svg\+xml|x-icon|vnd.microsoft.icon)/.test(g.type) && g.buf.length < 300000) { logoData = "data:" + g.type.split(";")[0] + ";base64," + g.buf.toString("base64"); brand.logoUsed = cand; break; } } catch (e) {}
  }
  const host = new URL(page.url).hostname.replace(/^www\./, ""), dir = out || path.join("brand-" + host);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "brand.json"), JSON.stringify(brand, null, 2));
  fs.writeFileSync(path.join(dir, "brand-sheet.html"), S.sheetHtml(brand, { logoData }));
  fs.writeFileSync(path.join(dir, "brand.css"), S.cssVars(brand));
  console.log("\n" + (brand.title || host));
  console.log("Colours:  " + (brand.colors.brand.slice(0, 5).map(c => c.hex).join("  ") || "none found"));
  console.log("Neutrals: " + (brand.colors.neutrals.slice(0, 4).map(c => c.hex).join("  ") || "none"));
  console.log("Fonts:    " + (brand.fonts.slice(0, 4).map(f => f.family).join(", ") || "none found"));
  console.log("\nSaved to " + dir + "/ (brand-sheet.html, brand.json, brand.css)");
}
main().catch(e => { console.error("Could not read that site: " + e.message); process.exit(1); });
