(function () {
  var C = window.SpyColor, E = window.SpyExtract, S = window.SpySheet;
  function $(s) { return document.querySelector(s); }
  var brand = null, imgData = null, imgName = "", imgURL = "";

  // tabs
  document.querySelectorAll("#tabs button").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll("#tabs button").forEach(function (x) { x.className = x === b ? "on" : ""; });
      $("#pane-image").hidden = b.dataset.t !== "image"; $("#pane-site").hidden = b.dataset.t !== "site";
    });
  });
  function msg(t, bad) { var m = $("#msg"); m.hidden = !t; m.textContent = t || ""; m.className = "msg" + (bad ? " bad" : ""); }

  // ---- image ----
  function pickFile(f) {
    if (!f) return;
    if (!/^image\//.test(f.type)) { msg("That file is not an image.", true); return; }
    var url = URL.createObjectURL(f), img = new Image();
    img.onload = function () {
      var w = img.naturalWidth || 300, h = img.naturalHeight || 300, k = Math.min(1, 260 / Math.max(w, h)), cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
      var ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0, cv.width, cv.height);
      imgData = ctx.getImageData(0, 0, cv.width, cv.height); imgName = f.name || "pasted image"; imgURL = url; fromImage();
    };
    img.onerror = function () { msg("Could not read that image.", true); };
    img.src = url;
  }
  function fromImage() {
    if (!imgData) return;
    var d = new Uint8ClampedArray(imgData.data), w = imgData.width, h = imgData.height, i;
    if ($("#bg").checked) {   // flat background: all four corners opaque and the same colour
      var cs = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(function (p) { var i2 = (p[1] * w + p[0]) * 4; return [d[i2], d[i2 + 1], d[i2 + 2], d[i2 + 3]]; });
      if (cs.every(function (c) { return c[3] > 200 && C.deltaE(c.slice(0, 3), cs[0].slice(0, 3)) < 6; })) {
        for (i = 0; i < d.length; i += 4) if (C.deltaE([d[i], d[i + 1], d[i + 2]], cs[0].slice(0, 3)) < 9) d[i + 3] = 0;
      }
    }
    // anti-aliased edges blend two colours into a third that is not in the logo: ignore pixels that sit on a hard edge
    var e = new Uint8Array(w * h), x, y, n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { var p = (y * w + x) * 4; if (d[p + 3] < 128) continue; n4.forEach(function (o) { var q2 = ((y + o[1]) * w + x + o[0]) * 4; if (d[q2 + 3] >= 128 && C.deltaE([d[p], d[p + 1], d[p + 2]], [d[q2], d[q2 + 1], d[q2 + 2]]) > 14) e[y * w + x] = 1; }); }
    var kept = 0; for (i = 0; i < w * h; i++) if (!e[i] && d[i * 4 + 3] >= 128) kept++;
    if (kept > 200) for (i = 0; i < w * h; i++) if (e[i]) d[i * 4 + 3] = 0;
    var q = C.quantize(d, +$("#count").value + 2, { merge: 16 }).filter(function (c) { return c.share >= 0.015; }).slice(0, +$("#count").value), br = [], ne = [];
    q.forEach(function (c) { var x = C.describe(c.rgb); x.share = Math.round(c.share * 100); if (C.chroma(c.rgb) < 12) ne.push(x); else br.push(x); });
    brand = { title: imgName.replace(/\.[a-z0-9]+$/i, ""), url: "", description: "", colors: { brand: br, neutrals: ne }, fonts: [], source: "image" };
    show();
  }
  var drop = $("#drop"), file = $("#file");
  drop.addEventListener("click", function () { file.click(); });
  drop.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } });
  file.addEventListener("change", function () { pickFile(file.files[0]); });
  ["dragenter", "dragover"].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
  drop.addEventListener("drop", function (e) { pickFile(e.dataTransfer.files[0]); });
  document.addEventListener("paste", function (e) { var it = e.clipboardData && e.clipboardData.files; if (it && it[0] && /^image\//.test(it[0].type)) pickFile(it[0]); });
  $("#bg").addEventListener("change", fromImage); $("#count").addEventListener("input", fromImage);

  // ---- website ----
  $("#read").addEventListener("click", function () {
    var html = $("#src").value; if (html.trim().length < 20) { msg("Paste the page source first.", true); return; }
    var u = $("#srcurl").value.trim(), base = ""; if (u) { if (!/^https?:\/\//i.test(u)) u = "https://" + u; base = u; }
    var css = []; (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []);
    // pasted text may be plain CSS rather than HTML
    if (!/<\w+[^>]*>/.test(html)) { css.push(html); html = ""; }
    brand = E.extract(html, css, base); if (!brand.title && base) brand.title = base.replace(/^https?:\/\/(www\.)?/, ""); brand.source = "source";
    if (!brand.colors.brand.length && !brand.colors.neutrals.length) msg("No colours found. Linked stylesheets are not included in the page source, so paste the CSS too, or use the command line tool.", true); else msg("");
    imgURL = ""; show();
  });
  function loadJson(f) {
    if (!f) return; var r = new FileReader();
    r.onload = function () { try { var j = JSON.parse(r.result); if (!j.colors) throw 0; brand = j; imgURL = ""; msg(""); show(); } catch (e) { msg("That is not a brand.json from this tool.", true); } };
    r.readAsText(f);
  }
  $("#jsonfile").addEventListener("change", function () { loadJson(this.files[0]); });
  var dj = $("#dropjson"); dj.addEventListener("click", function () { $("#jsonfile").click(); });
  ["dragenter", "dragover"].forEach(function (n) { dj.addEventListener(n, function (e) { e.preventDefault(); dj.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (n) { dj.addEventListener(n, function (e) { e.preventDefault(); dj.classList.remove("over"); }); });
  dj.addEventListener("drop", function (e) { loadJson(e.dataTransfer.files[0]); });

  // ---- result ----
  function chip(c) {
    var d = document.createElement("button"); d.className = "sw"; d.title = "Click to copy " + c.hex;
    d.innerHTML = '<span class="chip" style="background:' + S.esc(c.hex) + ';color:' + S.esc(c.text) + '"><b>' + S.esc(c.name) + '</b><i>' + S.esc(c.hex) + (c.share ? " &middot; " + c.share + "%" : "") + '</i></span>' +
      '<span class="meta">RGB ' + c.rgb.join(", ") + '<br>HSL ' + c.hsl[0] + ", " + c.hsl[1] + "%, " + c.hsl[2] + '%<br>White text ' + c.onWhite + ':1<br>Black text ' + c.onBlack + ':1</span>';
    d.addEventListener("click", function () { copy(c.hex, "Copied " + c.hex); });
    return d;
  }
  function copy(t, note) { if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { msg(note); }, function () { msg("Copy was blocked by the browser.", true); }); else msg("Copy is not available here.", true); }
  function show() {
    $("#result").hidden = false; $("#rtitle").textContent = brand.title || "Result";
    var pv = $("#preview"); if (imgURL) { pv.src = imgURL; pv.hidden = false; } else pv.hidden = true;
    var bg = $("#brandGrid"), ng = $("#neutralGrid"); bg.innerHTML = ""; ng.innerHTML = "";
    brand.colors.brand.forEach(function (c) { bg.appendChild(chip(c)); }); brand.colors.neutrals.forEach(function (c) { ng.appendChild(chip(c)); });
    if (!brand.colors.brand.length) bg.innerHTML = '<p class="note">No strong colours found.</p>';
    $("#nh").hidden = ng.hidden = !brand.colors.neutrals.length;
    var fb = $("#fonts"); fb.innerHTML = ""; $("#fontBox").hidden = brand.source === "image";
    if (brand.source !== "image") {
      if (!(brand.fonts || []).length) fb.innerHTML = '<p class="note">No named fonts found. They may be set in a stylesheet that was not included.</p>';
      (brand.fonts || []).slice(0, 5).forEach(function (f) { var d = document.createElement("div"); d.className = "font"; d.innerHTML = "<b>" + S.esc(f.family) + "</b><small>" + S.esc(f.source === "google" ? "Google Fonts" : f.source === "font-face" ? "Custom font on the site" : "Used in the site CSS") + "</small>"; fb.appendChild(d); });
    }
    $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function save(name, type, data) { var a = document.createElement("a"), b = new Blob([data], { type: type }); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); }
  function slug() { return (brand.title || "brand").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "brand"; }
  $("#dlSheet").addEventListener("click", function () { if (brand) save(slug() + "-brand-sheet.html", "text/html", S.sheetHtml(brand, { logoData: brand.source === "image" ? imgThumb() : "" })); });
  $("#dlJson").addEventListener("click", function () { if (brand) save(slug() + "-brand.json", "application/json", JSON.stringify(brand, null, 2)); });
  $("#cpCss").addEventListener("click", function () { if (brand) copy(S.cssVars(brand), "CSS variables copied"); });
  function imgThumb() { if (!imgData) return ""; var cv = document.createElement("canvas"); cv.width = imgData.width; cv.height = imgData.height; cv.getContext("2d").putImageData(imgData, 0, 0); return cv.toDataURL("image/png"); }
  $("#dlPng").addEventListener("click", function () {
    if (!brand) return; var cols = brand.colors.brand.concat(brand.colors.neutrals).slice(0, 10), W = 1200, H = 360, cv = document.createElement("canvas"); cv.width = W; cv.height = H; var x = cv.getContext("2d");
    x.fillStyle = "#000"; x.fillRect(0, 0, W, H); var cw = (W - 40) / Math.max(1, cols.length);
    cols.forEach(function (c, i) { x.fillStyle = c.hex; x.fillRect(20 + i * cw, 20, cw - 6, 240); x.fillStyle = "#f2f2f2"; x.font = "600 18px system-ui,Arial"; x.fillText(c.hex, 24 + i * cw, 292); x.fillStyle = "#8a8a8a"; x.font = "14px system-ui,Arial"; x.fillText(c.name, 24 + i * cw, 316); });
    cv.toBlob(function (b) { var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = slug() + "-palette.png"; document.body.appendChild(a); a.click(); a.remove(); });
  });
  window.BrandSpy = { load: pickFile, state: function () { return brand; } };
})();
