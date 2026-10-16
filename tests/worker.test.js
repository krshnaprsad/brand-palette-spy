// Checks the helper's address rules and rate limit. No network needed.
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "../worker/worker.js"), "utf8").replace("export default", "module.exports =");
const m = { exports: {} }; new Function("module", "exports", src)(m, m.exports);
const w = m.exports, ORIGIN = "https://krshnaprsad.github.io";
const call = (u, ip, origin) => w.fetch(new Request("https://h/?url=" + encodeURIComponent(u), { headers: { origin: origin || ORIGIN, "cf-connecting-ip": ip || "1.1.1.1" } })).then(r => r.json().then(j => [r.status, j]));
(async () => {
  const bad = ["http://localhost/", "http://127.0.0.1/", "http://10.0.0.5/", "http://172.16.0.1/", "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data", "http://100.64.0.1/", "http://2130706433/", "http://0x7f.0.0.1/", "http://[::1]/", "http://printer.local/", "http://db.internal/", "http://intranet/", "file:///etc/passwd", "ftp://example.com/", "http://user:pw@example.com/", "http://example.com:8080/"];
  for (const u of bad) { const [s, j] = await call(u, "2.2.2." + bad.indexOf(u)); assert.strictEqual(s, 400, u); assert.ok(j.error, u); }
  for (const q of ["font", "img"]) { const [s, j] = await w.fetch(new Request("https://h/?" + q + "=" + encodeURIComponent("http://169.254.169.254/x"), { headers: { origin: ORIGIN, "cf-connecting-ip": "5.5.5.5" } })).then(r => r.json().then(j => [r.status, j])); assert.strictEqual(s, 400, q); }
  const [s403] = await call("https://example.com", "3.3.3.3", "https://evil.example"); assert.strictEqual(s403, 403);
  let limited = false; for (let i = 0; i < 25; i++) { const [s] = await call("http://localhost/", "9.9.9.9"); if (s === 429) { limited = true; break; } }
  assert.ok(limited, "rate limit should kick in");
  console.log("worker test passed");
})();
