// Runs the CLI against a local server, no internet needed.
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), cp = require("child_process"), assert = require("assert");
const srv = http.createServer((q, r) => {
  if (q.url === "/a.css") { r.setHeader("content-type", "text/css"); return r.end(".b{background:#0A66C2;color:#fff} h1{font-family:'Poppins',sans-serif}"); }
  r.setHeader("content-type", "text/html");
  r.end('<title>Local Co</title><link rel="stylesheet" href="/a.css"><body class="b">hi</body>');
}).listen(0, () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "bps-"));
  cp.execFile("node", [path.join(__dirname, "../cli/spy.js"), "http://127.0.0.1:" + srv.address().port + "/", out], (e) => {
    srv.close(); assert.ifError(e);
    const j = JSON.parse(fs.readFileSync(path.join(out, "brand.json"), "utf8"));
    assert.strictEqual(j.colors.brand[0].hex, "#0A66C2"); assert.strictEqual(j.fonts[0].family, "Poppins");
    assert.ok(fs.existsSync(path.join(out, "brand-sheet.html")) && fs.existsSync(path.join(out, "brand.css")));
    console.log("cli test passed");
  });
});
